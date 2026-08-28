import { describe, it, expect, vi, beforeEach } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/migrations.js");
await import("../extension/background/background.js");

const listeners = globalThis.__chromeListeners;

function fireAlarm(name) {
  listeners.alarm.forEach((fn) => fn({ name }));
}

function fireCommand(command) {
  return Promise.all(listeners.command.map((fn) => fn(command)));
}

// Message listeners either respond synchronously or return true and call
// sendResponse asynchronously (the real chrome.runtime.onMessage contract).
function fireMessage(msg) {
  return new Promise((resolve) => {
    let willRespondAsync = false;
    for (const fn of listeners.onMessage) {
      const keepAlive = fn(msg, {}, resolve);
      if (keepAlive) willRespondAsync = true;
    }
    if (!willRespondAsync) resolve(undefined);
  });
}

function getSync(keys) {
  return new Promise((r) => chrome.storage.sync.get(keys, r));
}
function getLocal(keys) {
  return new Promise((r) => chrome.storage.local.get(keys, r));
}
function setLocal(items) {
  return new Promise((r) => chrome.storage.local.set(items, r));
}
function setSync(items) {
  return new Promise((r) => chrome.storage.sync.set(items, r));
}

beforeEach(() => {
  globalThis.__resetChromeStores();
  vi.clearAllMocks();
  globalThis.fetch = vi.fn();
});

describe("force-fx-refresh", () => {
  it("merges new rates into storage and clears lastFxError on success", async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { ILS: 3.7, EUR: 0.91, GBP: 0.78, PLN: 4.1 } }),
    });
    const resp = await fireMessage({ type: "force-fx-refresh" });
    expect(resp).toEqual({ ok: true });
    const s = await getSync(["rates", "ratesUpdatedAt", "lastFxError"]);
    expect(s.rates.ILS).toBe(3.7);
    expect(s.rates.RUB).toBe(92); // frankfurter didn't return RUB this call — GOG_PLUS_DEFAULTS' RUB rate carries through
    expect(s.lastFxError).toBe(null);
    expect(s.ratesUpdatedAt).toBeGreaterThan(0);
  });

  it("preserves a rate not present in the latest response (partial merge)", async () => {
    await setSync({ rates: { RUB: 91.5 } });
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { ILS: 3.7, EUR: 0.91, GBP: 0.78, PLN: 4.1 } }),
    });
    await fireMessage({ type: "force-fx-refresh" });
    const s = await getSync(["rates"]);
    expect(s.rates.RUB).toBe(91.5);
    expect(s.rates.ILS).toBe(3.7);
  });

  it("records lastFxError and leaves rates untouched on a non-ok response", async () => {
    await setSync({ rates: { ILS: 3.65 } });
    globalThis.fetch.mockResolvedValue({ ok: false, status: 500 });
    await fireMessage({ type: "force-fx-refresh" });
    const s = await getSync(["rates", "lastFxError"]);
    expect(s.rates.ILS).toBe(3.65);
    expect(s.lastFxError).toContain("500");
  });

  it("records lastFxError when fetch itself rejects", async () => {
    globalThis.fetch.mockRejectedValue(new TypeError("Failed to fetch"));
    await fireMessage({ type: "force-fx-refresh" });
    const s = await getSync(["lastFxError"]);
    expect(s.lastFxError).toContain("Failed to fetch");
  });
});

describe("force-mods-refresh", () => {
  it("extracts game slugs from the mods page HTML", async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      text: async () =>
        `<a href="/game/cyberpunk_2077">x</a><a href="/en/game/hades">y</a>`,
    });
    await fireMessage({ type: "force-mods-refresh" });
    const s = await getLocal(["modsList", "modsUpdatedAt"]);
    expect(s.modsList.sort()).toEqual(["cyberpunk_2077", "hades"]);
    expect(s.modsUpdatedAt).toBeGreaterThan(0);
  });

  it("leaves modsList untouched when zero slugs are found", async () => {
    await setLocal({ modsList: ["prior_game"] });
    globalThis.fetch.mockResolvedValue({ ok: true, text: async () => "<p>nothing here</p>" });
    await fireMessage({ type: "force-mods-refresh" });
    const s = await getLocal(["modsList"]);
    expect(s.modsList).toEqual(["prior_game"]);
  });

  it("does not throw when the fetch fails", async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 503 });
    await expect(fireMessage({ type: "force-mods-refresh" })).resolves.toEqual({ ok: true });
  });
});

describe("wishlist badge", () => {
  it("clears the badge when wishlistAlerts is off", async () => {
    await setSync({ wishlistAlerts: false });
    await fireMessage({ type: "force-wishlist-refresh" });
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
  });

  it("shows the discounted count when the cache is fresh", async () => {
    await setSync({ wishlistAlerts: true, theme: "neon" });
    await setLocal({
      wishlistCache: { discountedCount: 5, total: 20 },
      wishlistCacheUpdatedAt: Date.now(),
    });
    await fireMessage({ type: "force-wishlist-refresh" });
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "5" });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: "#c64fff" });
  });

  it("caps the displayed badge count at 99", async () => {
    await setSync({ wishlistAlerts: true });
    await setLocal({
      wishlistCache: { discountedCount: 250, total: 300 },
      wishlistCacheUpdatedAt: Date.now(),
    });
    await fireMessage({ type: "force-wishlist-refresh" });
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "99" });
  });

  it("clears the badge when the cache has gone stale (past the 24h TTL)", async () => {
    await setSync({ wishlistAlerts: true });
    await setLocal({
      wishlistCache: { discountedCount: 5, total: 20 },
      wishlistCacheUpdatedAt: Date.now() - 25 * 60 * 60 * 1000,
    });
    await fireMessage({ type: "force-wishlist-refresh" });
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
    expect(chrome.action.setTitle).toHaveBeenCalledWith({
      title: expect.stringContaining("visit your wishlist"),
    });
  });
});

describe("wishlist-report message", () => {
  it("caches the reported count, slugs, and refreshes the badge", async () => {
    await setSync({ wishlistAlerts: true });
    const resp = await fireMessage({
      type: "wishlist-report",
      discountedCount: 3,
      total: 10,
      slugs: ["hades", "disco_elysium"],
    });
    expect(resp).toEqual({ ok: true });
    const s = await getLocal(["wishlistCache", "wishlistSlugs", "wishlistCacheUpdatedAt"]);
    expect(s.wishlistCache).toEqual({ discountedCount: 3, total: 10 });
    expect(s.wishlistSlugs).toEqual(["hades", "disco_elysium"]);
    expect(s.wishlistCacheUpdatedAt).toBeGreaterThan(0);
  });

  it("clamps discountedCount into [0, 99]", async () => {
    await fireMessage({ type: "wishlist-report", discountedCount: 500, total: 10, slugs: [] });
    const s = await getLocal(["wishlistCache"]);
    expect(s.wishlistCache.discountedCount).toBe(99);
  });

  it("fires a desktop notification when the discounted count jumps and notifications are opted in", async () => {
    await setSync({ wishlistAlerts: true, desktopNotifications: true });
    await setLocal({ wishlistCache: { discountedCount: 2, total: 10 } });
    await fireMessage({ type: "wishlist-report", discountedCount: 5, total: 10, slugs: [] });
    expect(chrome.notifications.create).toHaveBeenCalled();
  });

  it("does not notify on a jump when desktopNotifications is off", async () => {
    await setSync({ wishlistAlerts: true, desktopNotifications: false });
    await setLocal({ wishlistCache: { discountedCount: 2, total: 10 } });
    await fireMessage({ type: "wishlist-report", discountedCount: 5, total: 10, slugs: [] });
    expect(chrome.notifications.create).not.toHaveBeenCalled();
  });

  it("does not notify when the count did not increase", async () => {
    await setSync({ desktopNotifications: true });
    await setLocal({ wishlistCache: { discountedCount: 5, total: 10 } });
    await fireMessage({ type: "wishlist-report", discountedCount: 5, total: 10, slugs: [] });
    expect(chrome.notifications.create).not.toHaveBeenCalled();
  });
});

describe("open-tag-dashboard message", () => {
  it("opens the tag dashboard in a new tab", async () => {
    await fireMessage({ type: "open-tag-dashboard" });
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "chrome-extension://test-id/tags/tags.html",
    });
  });
});

describe("commands", () => {
  it("toggle-master flips the enabled flag", async () => {
    await setSync({ enabled: true });
    await fireCommand("toggle-master");
    expect((await getSync(["enabled"])).enabled).toBe(false);
    await fireCommand("toggle-master");
    expect((await getSync(["enabled"])).enabled).toBe(true);
  });

  it("toggle-hebrew flips hebrewTranslations", async () => {
    await setSync({ hebrewTranslations: false });
    await fireCommand("toggle-hebrew");
    expect((await getSync(["hebrewTranslations"])).hebrewTranslations).toBe(true);
  });
});

describe("onInstalled", () => {
  it("creates all four alarms and opens onboarding on a fresh install", async () => {
    await Promise.all(listeners.onInstalled.map((fn) => fn({ reason: "install" })));
    expect(chrome.alarms.create).toHaveBeenCalledTimes(4);
    expect(chrome.alarms.create.mock.calls.map((c) => c[0])).toEqual([
      "gog-plus-fx",
      "gog-plus-mods",
      "gog-plus-wishlist",
      "gog-plus-daily",
    ]);
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "chrome-extension://test-id/onboarding/onboarding.html",
    });
  });

  it("does not open onboarding on an update", async () => {
    await Promise.all(listeners.onInstalled.map((fn) => fn({ reason: "update" })));
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it("fills in any settings keys missing from storage with defaults", async () => {
    await setSync({ targetCurrency: "EUR" }); // simulate a partially-seeded store
    await Promise.all(listeners.onInstalled.map((fn) => fn({ reason: "update" })));
    const s = await getSync(["targetCurrency", "vatPercent"]);
    expect(s.targetCurrency).toBe("EUR"); // untouched — already set
    expect(s.vatPercent).toBe(18); // filled from GOG_PLUS_DEFAULTS
  });
});

describe("daily jobs — refund window notifications", () => {
  it("fires a notification when exactly 2 days remain and dedupes on the second run", async () => {
    const purchasedAt = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    const dateStr = purchasedAt.toISOString().slice(0, 10);
    await setSync({ desktopNotifications: true });
    await setLocal({ purchaseLog: { cyberpunk_2077: dateStr } });

    fireAlarm("gog-plus-daily");
    await vi.waitFor(() => expect(chrome.notifications.create).toHaveBeenCalled());
    expect(chrome.notifications.create.mock.calls[0][0]).toMatch(/^refund:cyberpunk_2077:/);

    chrome.notifications.create.mockClear();
    fireAlarm("gog-plus-daily");
    await new Promise((r) => setTimeout(r, 0));
    expect(chrome.notifications.create).not.toHaveBeenCalled();
  });

  it("does nothing when desktopNotifications is off", async () => {
    const dateStr = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await setSync({ desktopNotifications: false });
    await setLocal({ purchaseLog: { hades: dateStr } });
    fireAlarm("gog-plus-daily");
    await new Promise((r) => setTimeout(r, 0));
    expect(chrome.notifications.create).not.toHaveBeenCalled();
  });
});

describe("daily jobs — per-game price alerts", () => {
  it("fires when the latest price (same currency) is at or below the threshold", async () => {
    await setSync({ desktopNotifications: true });
    await setLocal({
      priceAlerts: { hades: { threshold: 50, currency: "USD", createdAt: 0 } },
      priceHistory: { hades: [{ d: "2026-01-01", p: 60, c: "USD" }, { d: "2026-02-01", p: 45, c: "USD" }] },
    });
    fireAlarm("gog-plus-daily");
    await vi.waitFor(() => expect(chrome.notifications.create).toHaveBeenCalled());
    expect(chrome.notifications.create.mock.calls[0][0]).toBe("priceAlert:hades:50");
  });

  it("converts currencies via the rates table before comparing", async () => {
    await setSync({ desktopNotifications: true, rates: { ILS: 4 } });
    await setLocal({
      priceAlerts: { hades: { threshold: 10, currency: "USD", createdAt: 0 } },
      // 36 ILS / 4 = 9 USD, below the 10 USD threshold
      priceHistory: { hades: [{ d: "2026-01-01", p: 36, c: "ILS" }] },
    });
    fireAlarm("gog-plus-daily");
    await vi.waitFor(() => expect(chrome.notifications.create).toHaveBeenCalled());
  });

  it("skips the alert when the required exchange rate is missing", async () => {
    await setSync({ desktopNotifications: true, rates: {} });
    await setLocal({
      priceAlerts: { hades: { threshold: 10, currency: "USD", createdAt: 0 } },
      priceHistory: { hades: [{ d: "2026-01-01", p: 5, c: "ILS" }] },
    });
    fireAlarm("gog-plus-daily");
    await new Promise((r) => setTimeout(r, 0));
    expect(chrome.notifications.create).not.toHaveBeenCalled();
  });

  it("does not fire while the price stays above the threshold", async () => {
    await setSync({ desktopNotifications: true });
    await setLocal({
      priceAlerts: { hades: { threshold: 10, currency: "USD", createdAt: 0 } },
      priceHistory: { hades: [{ d: "2026-01-01", p: 25, c: "USD" }] },
    });
    fireAlarm("gog-plus-daily");
    await new Promise((r) => setTimeout(r, 0));
    expect(chrome.notifications.create).not.toHaveBeenCalled();
  });
});

describe("daily jobs — wishlist-wide price alerts", () => {
  it("fires when a wishlisted game drops the configured % off its tracked peak", async () => {
    await setSync({ desktopNotifications: true, wishlistPriceAlerts: true, wishlistAlertPercent: 20 });
    await setLocal({
      wishlistSlugs: ["hades"],
      priceHistory: {
        hades: [
          { d: "2026-01-01", p: 100, c: "USD" },
          { d: "2026-02-01", p: 75, c: "USD" }, // 25% off peak — over the 20% bar
        ],
      },
    });
    fireAlarm("gog-plus-daily");
    await vi.waitFor(() => expect(chrome.notifications.create).toHaveBeenCalled());
    expect(chrome.notifications.create.mock.calls[0][0]).toBe("wishlistPriceAlert:hades:75");
  });

  it("does not fire below the configured drop threshold", async () => {
    await setSync({ desktopNotifications: true, wishlistPriceAlerts: true, wishlistAlertPercent: 30 });
    await setLocal({
      wishlistSlugs: ["hades"],
      priceHistory: {
        hades: [
          { d: "2026-01-01", p: 100, c: "USD" },
          { d: "2026-02-01", p: 85, c: "USD" }, // only 15% off
        ],
      },
    });
    fireAlarm("gog-plus-daily");
    await new Promise((r) => setTimeout(r, 0));
    expect(chrome.notifications.create).not.toHaveBeenCalled();
  });

  it("skips a slug with fewer than two price snapshots", async () => {
    await setSync({ desktopNotifications: true, wishlistPriceAlerts: true });
    await setLocal({
      wishlistSlugs: ["hades"],
      priceHistory: { hades: [{ d: "2026-01-01", p: 100, c: "USD" }] },
    });
    fireAlarm("gog-plus-daily");
    await new Promise((r) => setTimeout(r, 0));
    expect(chrome.notifications.create).not.toHaveBeenCalled();
  });

  it("skips mixed-currency history rather than misreporting a drop", async () => {
    await setSync({ desktopNotifications: true, wishlistPriceAlerts: true, wishlistAlertPercent: 5 });
    await setLocal({
      wishlistSlugs: ["hades"],
      priceHistory: {
        hades: [
          { d: "2026-01-01", p: 100, c: "USD" },
          { d: "2026-02-01", p: 50, c: "ILS" },
        ],
      },
    });
    fireAlarm("gog-plus-daily");
    await new Promise((r) => setTimeout(r, 0));
    expect(chrome.notifications.create).not.toHaveBeenCalled();
  });

  it("is off by default even with desktopNotifications on (wishlistPriceAlerts opt-in)", async () => {
    await setSync({ desktopNotifications: true, wishlistPriceAlerts: false });
    await setLocal({
      wishlistSlugs: ["hades"],
      priceHistory: {
        hades: [
          { d: "2026-01-01", p: 100, c: "USD" },
          { d: "2026-02-01", p: 50, c: "USD" },
        ],
      },
    });
    fireAlarm("gog-plus-daily");
    await new Promise((r) => setTimeout(r, 0));
    expect(chrome.notifications.create).not.toHaveBeenCalled();
  });
});

describe("notifLog pruning", () => {
  it("drops entries older than the 90-day TTL but keeps the wishlist-jump throttle key", async () => {
    const old = Date.now() - 100 * 24 * 60 * 60 * 1000;
    const recent = Date.now() - 1 * 24 * 60 * 60 * 1000;
    await setLocal({
      notifLog: {
        "refund:old_game:1": old,
        "refund:recent_game:1": recent,
        __wishlistJump: old,
      },
    });
    fireAlarm("gog-plus-daily");
    await vi.waitFor(async () => {
      const s = await getLocal(["notifLog"]);
      expect("refund:old_game:1" in s.notifLog).toBe(false);
    });
    const s = await getLocal(["notifLog"]);
    expect(s.notifLog["refund:recent_game:1"]).toBe(recent);
    expect(s.notifLog.__wishlistJump).toBe(old); // rolling throttle, never pruned by age
  });
});
