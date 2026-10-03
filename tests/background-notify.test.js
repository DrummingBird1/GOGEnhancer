import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getLocal = (keys) => new Promise((r) => chrome.storage.local.get(keys, r));
const setLocal = (items) => new Promise((r) => chrome.storage.local.set(items, r));
const setSync = (items) => new Promise((r) => chrome.storage.sync.set(items, r));

// The shared chrome shim's reset wipes storage.onChanged listeners and
// background.js registers its own at import, so each test re-imports it.
async function loadBackground() {
  globalThis.__resetChromeStores();
  vi.resetModules();
  globalThis.__chromeListeners.alarm.length = 0;
  globalThis.__chromeListeners.onMessage.length = 0;
  globalThis.__chromeListeners.onInstalled.length = 0;
  await import("../extension/lib/defaults.js");
  await import("../extension/lib/storage.js");
  await import("../extension/lib/migrations.js");
  await import("../extension/background/background.js");
}

const fireAlarm = (name) => globalThis.__chromeListeners.alarm.forEach((fn) => fn({ name }));
function fireMessage(msg) {
  return new Promise((resolve) => {
    let async = false;
    for (const fn of globalThis.__chromeListeners.onMessage) if (fn(msg, {}, resolve)) async = true;
    if (!async) resolve(undefined);
  });
}
const settle = (ms = 20) => new Promise((r) => setTimeout(r, ms));

const created = () => chrome.notifications.create.mock.calls;
// A price alert that is due: threshold 50, latest price 45.
const dueAlert = (slug = "hades", extra = {}) => ({
  priceAlerts: { [slug]: { threshold: 50, currency: "USD", createdAt: 0 }, ...(extra.priceAlerts || {}) },
  priceHistory: { [slug]: [{ d: "2026-01-01", p: 100, c: "USD" }, { d: "2026-02-01", p: 45, c: "USD" }], ...(extra.priceHistory || {}) },
});

beforeEach(async () => {
  vi.clearAllMocks();
  globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200 }));
  chrome.permissions = { contains: vi.fn(async () => true) };
  await loadBackground();
});
afterEach(() => vi.useRealTimers());

describe("quiet hours", () => {
  const quiet = { quietHours: { enabled: true, from: "22:00", to: "08:00" }, desktopNotifications: true };

  it("holds an alert back during quiet hours and releases it afterwards", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 2, 23, 0));
    await setSync(quiet);
    await setLocal(dueAlert());
    fireAlarm("gog-plus-daily");
    await vi.waitFor(async () => expect((await getLocal(["notifyQueue"])).notifyQueue).toHaveLength(1));
    expect(created()).toHaveLength(0);
    // the alert is marked as handled so tomorrow it isn't queued again
    expect(Object.keys((await getLocal(["notifLog"])).notifLog)).toContain("priceAlert:hades:50");

    // still quiet at 01:00 → the hourly check keeps holding it
    vi.setSystemTime(new Date(2026, 9, 3, 1, 0));
    fireAlarm("gog-plus-flush");
    await settle();
    expect(created()).toHaveLength(0);

    vi.setSystemTime(new Date(2026, 9, 3, 8, 30));
    fireAlarm("gog-plus-flush");
    await vi.waitFor(() => expect(created()).toHaveLength(1));
    expect(created()[0][1]).toMatchObject({ title: "Price alert — Hades" }); // a single item arrives as itself
    expect((await getLocal(["notifyQueue"])).notifyQueue).toEqual([]);
  });

  it("combines several held-back alerts into one summary", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 2, 23, 0));
    await setSync(quiet);
    await setLocal({
      priceAlerts: { a: { threshold: 50, currency: "USD", createdAt: 0 }, b: { threshold: 50, currency: "USD", createdAt: 0 } },
      priceHistory: { a: [{ d: "1", p: 40, c: "USD" }], b: [{ d: "1", p: 40, c: "USD" }] },
    });
    fireAlarm("gog-plus-daily");
    await vi.waitFor(async () => expect((await getLocal(["notifyQueue"])).notifyQueue).toHaveLength(2));
    vi.setSystemTime(new Date(2026, 9, 3, 9, 0));
    fireAlarm("gog-plus-flush");
    await vi.waitFor(() => expect(created()).toHaveLength(1));
    expect(created()[0][1].title).toBe("2 GOG alerts");
  });
});

describe("one-a-day mode", () => {
  it("queues alerts, ignores the hourly check, and sends one summary from the daily job", async () => {
    await setSync({ desktopNotifications: true, notifyMode: "daily" });
    await setLocal(dueAlert("hades", { priceAlerts: { doom: { threshold: 50, currency: "USD", createdAt: 0 } }, priceHistory: { doom: [{ d: "1", p: 10, c: "USD" }] } }));
    // The daily job queues both alerts, then — being the daily job — flushes them as ONE summary.
    fireAlarm("gog-plus-daily");
    await vi.waitFor(() => expect(created()).toHaveLength(1));
    expect(created()[0][1].title).toBe("2 GOG alerts");
    expect((await getLocal(["notifyQueue"])).notifyQueue).toEqual([]);
  });

  it("the hourly check leaves a daily-mode queue alone", async () => {
    await setSync({ desktopNotifications: true, notifyMode: "daily" });
    await setLocal({ notifyQueue: [{ id: "x", kind: "sale", title: "T", message: "M", t: 1 }] });
    fireAlarm("gog-plus-flush");
    await settle();
    expect(created()).toHaveLength(0);
    expect((await getLocal(["notifyQueue"])).notifyQueue).toHaveLength(1);
    expect(await fireMessage({ type: "force-flush" })).toEqual({ ok: true });
    expect(created()).toHaveLength(1);
  });

  it("drops a queue nobody is listening for any more", async () => {
    await setSync({ desktopNotifications: false });
    await setLocal({ notifyQueue: [{ id: "x", kind: "sale", title: "T", message: "M", t: 1 }] });
    fireAlarm("gog-plus-flush");
    await vi.waitFor(async () => expect((await getLocal(["notifyQueue"])).notifyQueue).toEqual([]));
    expect(created()).toHaveLength(0);
  });
});

describe("thresholds", () => {
  it("does not alert for a drop below the user's minimum, and does not mark it as handled", async () => {
    await setSync({ desktopNotifications: true, notifyMinDiscount: 80 });
    await setLocal(dueAlert()); // 100 → 45 is a 55% drop
    fireAlarm("gog-plus-daily");
    await settle();
    expect(created()).toHaveLength(0);
    expect((await getLocal(["notifLog"])).notifLog || {}).toEqual({});
    // lowering the bar lets the very same alert through
    await setSync({ notifyMinDiscount: 50 });
    fireAlarm("gog-plus-daily");
    await vi.waitFor(() => expect(created()).toHaveLength(1));
  });

  it("can require the tracked low, or cap the price", async () => {
    await setSync({ desktopNotifications: true, notifyOnlyAtLow: true });
    await setLocal({
      priceAlerts: { hades: { threshold: 50, currency: "USD", createdAt: 0 } },
      priceHistory: { hades: [{ d: "1", p: 20, c: "USD" }, { d: "2", p: 45, c: "USD" }] }, // latest 45 is not the low (20)
    });
    fireAlarm("gog-plus-daily");
    await settle();
    expect(created()).toHaveLength(0);
    await setSync({ notifyOnlyAtLow: false, notifyMaxPrice: 30 });
    fireAlarm("gog-plus-daily");
    await settle();
    expect(created()).toHaveLength(0);
  });
});

describe("alerts by tag", () => {
  const data = {
    tagAlerts: { "co-op": { threshold: 10, currency: "USD" } },
    tags: { hades: ["co-op"], doom: ["co-op"] },
    priceHistory: { hades: [{ d: "1", p: 8, c: "USD" }], doom: [{ d: "1", p: 30, c: "USD" }] },
  };

  it("fires once for each game under the tag's threshold", async () => {
    await setSync({ desktopNotifications: true });
    await setLocal(data);
    fireAlarm("gog-plus-daily");
    await vi.waitFor(() => expect(created()).toHaveLength(1));
    expect(created()[0][0]).toBe("tagAlert:hades:co-op:10");
    expect(created()[0][1].message).toContain("under your $10.00 for “co-op” games");
    chrome.notifications.create.mockClear();
    fireAlarm("gog-plus-daily");
    await settle();
    expect(created()).toHaveLength(0); // deduped
  });

  it("does nothing without alerts or channels", async () => {
    await setLocal(data);
    fireAlarm("gog-plus-daily");
    await settle();
    expect(created()).toHaveLength(0);
    await setSync({ desktopNotifications: true });
    await setLocal({ tagAlerts: {} });
    fireAlarm("gog-plus-daily");
    await settle();
    expect(created()).toHaveLength(0);
  });
});

describe("season radar", () => {
  it("announces a store-wide sale once per headline, when switched on", async () => {
    await setSync({ desktopNotifications: true, seasonRadar: true });
    expect(await fireMessage({ type: "sale-radar", text: "8000+ deals up to -95%" })).toEqual({ ok: true });
    expect(created()).toHaveLength(1);
    expect(created()[0][1]).toMatchObject({ title: "A GOG sale is on", message: "8000+ deals up to -95%" });
    expect((await getLocal(["lastSaleSeen"])).lastSaleSeen).toBe("8000+ deals up to -95%");
    await fireMessage({ type: "sale-radar", text: "8000+ deals up to -95%" });
    expect(created()).toHaveLength(1);
    await fireMessage({ type: "sale-radar", text: "Winter Sale" });
    expect(created()).toHaveLength(2);
  });

  it("is silent when off, empty, or when there is nowhere to send it", async () => {
    await setSync({ desktopNotifications: true, seasonRadar: false });
    await fireMessage({ type: "sale-radar", text: "Autumn Sale" });
    await setSync({ seasonRadar: true });
    await fireMessage({ type: "sale-radar", text: "   " });
    await setSync({ desktopNotifications: false });
    await fireMessage({ type: "sale-radar", text: "Autumn Sale" });
    expect(created()).toHaveLength(0);
  });
});

describe("the user's own webhook", () => {
  const hook = "https://discord.com/api/webhooks/1/abc";

  it("posts the notification text — and only that — when enabled and permitted", async () => {
    await setLocal({ webhookEnabled: true, webhookUrl: hook, ...dueAlert(), tags: { hades: ["secret-tag"] }, notes: { hades: "private note" } });
    fireAlarm("gog-plus-daily");
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toBe(hook);
    expect(init).toMatchObject({ method: "POST", credentials: "omit", referrerPolicy: "no-referrer" });
    const body = JSON.parse(init.body);
    expect(body.content).toContain("Price alert — Hades");
    expect(JSON.stringify(body)).not.toContain("secret-tag");
    expect(JSON.stringify(body)).not.toContain("private note");
    expect(chrome.permissions.contains).toHaveBeenCalledWith({ origins: ["https://discord.com/*"] });
    expect(created()).toHaveLength(0); // desktop notifications are off — webhook only
  });

  it("does not post without the browser's permission, and survives a failing endpoint", async () => {
    chrome.permissions.contains.mockResolvedValue(false);
    await setLocal({ webhookEnabled: true, webhookUrl: hook, ...dueAlert() });
    fireAlarm("gog-plus-daily");
    await settle();
    expect(globalThis.fetch).not.toHaveBeenCalled();

    chrome.permissions.contains.mockResolvedValue(true);
    globalThis.fetch.mockResolvedValue({ ok: false, status: 500 });
    await setLocal({ notifLog: {} });
    fireAlarm("gog-plus-daily");
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    globalThis.fetch.mockRejectedValue(new Error("offline"));
    await setLocal({ notifLog: {} });
    fireAlarm("gog-plus-daily");
    await settle();
  });

  it("refuses an address that isn't https", async () => {
    await setLocal({ webhookEnabled: true, webhookUrl: "http://example.com/x", ...dueAlert() });
    fireAlarm("gog-plus-daily");
    await settle();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("answers the options page's test button", async () => {
    expect(await fireMessage({ type: "webhook-test" })).toEqual({ ok: false, error: "no webhook address saved" });
    await setLocal({ webhookUrl: hook });
    expect(await fireMessage({ type: "webhook-test" })).toEqual({ ok: true });
    expect(JSON.parse(globalThis.fetch.mock.calls[0][1].body).content).toContain("GOG Enhancer test");
    globalThis.fetch.mockResolvedValue({ ok: false, status: 404 });
    expect(await fireMessage({ type: "webhook-test" })).toEqual({ ok: false, error: "HTTP 404" });
  });

  it("uses a plain JSON body for non-Discord endpoints", async () => {
    await setLocal({ webhookUrl: "https://ntfy.example/topic" });
    await fireMessage({ type: "webhook-test" });
    expect(JSON.parse(globalThis.fetch.mock.calls[0][1].body)).toMatchObject({ source: "gog-enhancer", title: "GOG Enhancer test" });
  });
});

describe("status dates", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
  });

  it("dates when a game was started and finished", async () => {
    await setLocal({ gameStatus: { hades: "playing" } });
    await vi.waitFor(async () => expect((await getLocal(["statusDates"])).statusDates?.hades).toEqual({ playing: "2026-10-02" }));
    vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
    await setLocal({ gameStatus: { hades: "finished" } });
    await vi.waitFor(async () => expect((await getLocal(["statusDates"])).statusDates.hades).toEqual({ playing: "2026-10-02", finished: "2026-10-20" }));
  });

  it("ignores backlog and unchanged statuses, and a status that arrives with a sync", async () => {
    await setLocal({ gameStatus: { a: "backlog" } });
    await settle();
    expect((await getLocal(["statusDates"])).statusDates).toBeUndefined();
    // a sync being applied carries syncMeta in the same write — its dates come with it
    await setLocal({ gameStatus: { a: "finished" }, syncMeta: { "gameStatus:a": { t: 1 } } });
    await settle();
    expect((await getLocal(["statusDates"])).statusDates).toBeUndefined();
  });
});

describe("automatic sync alarm", () => {
  it("asks the sync core to run without prompting, and never throws if it can't", async () => {
    const core = self.GOGPlusFolderSyncCore;
    const spy = vi.spyOn(core, "autoSync").mockResolvedValue({ ran: false, reason: "off" });
    fireAlarm("gog-plus-autosync");
    await settle();
    expect(spy).toHaveBeenCalledWith({ interactive: false });
    spy.mockRejectedValue(new Error("boom"));
    fireAlarm("gog-plus-autosync");
    await settle();
  });
});
