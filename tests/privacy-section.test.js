import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/net.js");
await import("../extension/lib/privacy-view.js");
await import("../extension/options/privacy-section.js");

const V = () => window.GOGPlusPrivacyView;
const S = () => window.GOGPlusPrivacySection;
const $ = (id) => document.getElementById(id);
const NOW = Date.parse("2026-10-03T12:00:00Z");

const getLocal = (k) => new Promise((r) => chrome.storage.local.get(k, r));
const setLocal = (o) => new Promise((r) => chrome.storage.local.set(o, r));
const settle = () => new Promise((r) => setTimeout(r, 15));

describe("formatBytes / ago", () => {
  it("formats sizes", () => {
    expect(V().formatBytes(0)).toBe("0 B");
    expect(V().formatBytes(NaN)).toBe("0 B");
    expect(V().formatBytes(512)).toBe("512 B");
    expect(V().formatBytes(2048)).toBe("2.0 KB");
    expect(V().formatBytes(50 * 1024)).toBe("50 KB");
    expect(V().formatBytes(3.5 * 1024 * 1024)).toBe("3.5 MB");
  });

  it("says how long ago", () => {
    expect(V().ago(NOW - 5000, NOW)).toBe("just now");
    expect(V().ago(NOW - 5 * 60e3, NOW)).toBe("5 min ago");
    expect(V().ago(NOW - 3 * 3600e3, NOW)).toBe("3 h ago");
    expect(V().ago(NOW - 86400e3, NOW)).toBe("yesterday");
    expect(V().ago(NOW - 4 * 86400e3, NOW)).toBe("4 days ago");
  });
});

describe("recentRows", () => {
  const log = [
    { t: NOW - 9000e3, kind: "fx", host: "api.frankfurter.app", path: "/latest", status: 200, ok: true },
    { t: NOW - 60e3, kind: "catalog", host: "catalog.gog.com", path: "/v1/catalog", status: null, ok: false, error: "offline" },
    { t: NOW - 30e3, kind: "webhook", host: "discord.com", path: "", status: 500, ok: false },
  ];

  it("lists newest first with a purpose, a place and a result", () => {
    const rows = V().recentRows(log, 20, NOW);
    expect(rows.map((r) => r.where)).toEqual(["discord.com", "catalog.gog.com/v1/catalog", "api.frankfurter.app/latest"]);
    expect(rows[0]).toMatchObject({ what: "A notification sent to your own webhook", result: "failed (500)", ok: false });
    expect(rows[1].result).toBe("failed — offline");
    expect(rows[2]).toMatchObject({ what: "Currency exchange rates", result: "OK (200)", ok: true });
  });

  it("copes with no log", () => {
    expect(V().recentRows(undefined)).toEqual([]);
  });
});

describe("groupSizes", () => {
  it("sums keys per group, drops empty groups and sorts largest first", () => {
    const r = V().groupSizes({ tags: 100, notes: 400, priceHistory: 1000, ownedSlugs: 50, gameFacts: 70 });
    expect(r.rows.map((x) => x.id)).toEqual(["prices", "tags", "library"]);
    expect(r.rows.find((x) => x.id === "tags").bytes).toBe(500);
    expect(r.rows.find((x) => x.id === "library").forgettable).toBe(true);
    expect(r.total).toBe(1620);
  });

  it("never hides a key it doesn't know — it is shown as Other", () => {
    const r = V().groupSizes({ tags: 10, mysteryKey: 90 });
    expect(r.rows.find((x) => x.id === "other").bytes).toBe(90);
    expect(r.total).toBe(100);
  });

  it("gives every local storage key a home, so the table can't quietly leave something out", () => {
    const storageSrc = readFileSync(resolve(__dirname, "../extension/lib/storage.js"), "utf8");
    const block = storageSrc.slice(storageSrc.indexOf("const LOCAL_KEYS"), storageSrc.indexOf("]);", storageSrc.indexOf("const LOCAL_KEYS")));
    const keys = [...block.matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(40);
    const known = new Set(V().GROUPS.flatMap((g) => g.keys));
    expect(keys.filter((k) => !known.has(k))).toEqual([]);
  });
});

function mountPage() {
  document.body.innerHTML = `
    <div id="privNet"></div><div id="privStore"></div><div id="privPerms"></div>
    <button id="privClearLog"></button><button id="privForget"></button><button id="privDeleteAll"></button>
    <button id="clearAll"></button>`;
}

beforeEach(() => {
  globalThis.__resetChromeStores();
  mountPage();
  chrome.runtime.getManifest = () => ({ version: "4.0.0", host_permissions: ["https://www.gog.com/*"] });
  chrome.permissions = { getAll: vi.fn(async () => ({ origins: ["https://www.gog.com/*"] })), remove: vi.fn(async () => true) };
});

describe("the request list", () => {
  it("says so when nothing has been requested", async () => {
    await S().renderNet();
    expect($("privNet").textContent).toContain("Nothing yet");
  });

  it("summarises per address and offers the recent requests", async () => {
    await setLocal({
      netLog: [
        { t: NOW - 1000, kind: "fx", host: "api.frankfurter.app", path: "/latest", status: 200, ok: true },
        { t: NOW - 500, kind: "fx", host: "api.frankfurter.app", path: "/latest", status: null, ok: false, error: "offline" },
      ],
    });
    await S().renderNet();
    const rows = [...$("privNet").querySelectorAll("table")[0].querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("api.frankfurter.app");
    expect(rows[0].textContent).toContain("Currency exchange rates");
    expect(rows[0].querySelector(".priv-bad").textContent).toBe("1");
    expect($("privNet").querySelector("details table tbody").children).toHaveLength(2);
  });

  it("can be cleared", async () => {
    await setLocal({ netLog: [{ t: NOW, kind: "fx", host: "api.frankfurter.app", path: "/", status: 200, ok: true }] });
    await S().clearLog();
    expect((await getLocal("netLog")).netLog).toEqual([]);
    expect($("privNet").textContent).toContain("Nothing yet");
  });

  it("renders request text as text, never as markup", async () => {
    await setLocal({ netLog: [{ t: NOW, kind: "x", host: "<img src=x onerror=alert(1)>", path: "", status: 200, ok: true }] });
    await S().renderNet();
    expect($("privNet").querySelector("img")).toBeNull();
  });
});

describe("what it keeps", () => {
  it("shows kinds and sizes with a total", async () => {
    await setLocal({ tags: { a: ["x"] }, priceHistory: { a: [{ d: "2026-01-01", p: 1, c: "USD" }] }, ownedSlugs: { a: "2026-01-01" } });
    await S().renderStore();
    const text = $("privStore").textContent;
    expect(text).toContain("Price history");
    expect(text).toContain("Tags, notes and note history");
    expect(text).toContain("What the extension learned about your library as you browsed");
    expect(text).toContain("Total on this device");
  });

  it("says so when nothing is stored", async () => {
    await S().renderStore();
    expect($("privStore").textContent).toContain("Nothing is stored");
  });

  it("forgets only what it learned — after a confirmation", async () => {
    await setLocal({ ownedSlugs: { a: 1 }, gameFacts: { a: {} }, packInfo: { a: {} }, gameGenres: { a: "rpg" }, tags: { a: ["keep"] }, notInterested: { b: "2026-01-01" } });
    const confirm = vi.fn(() => false);
    window.confirm = confirm;
    await S().forgetLearned();
    expect((await getLocal("ownedSlugs")).ownedSlugs).toBeTruthy();
    confirm.mockReturnValue(true);
    await S().forgetLearned();
    const after = await getLocal(null);
    expect(after.ownedSlugs).toBeUndefined();
    expect(after.gameFacts).toBeUndefined();
    expect(after.packInfo).toBeUndefined();
    expect(after.tags).toEqual({ a: ["keep"] }); // your own data stays
    expect(after.notInterested).toEqual({ b: "2026-01-01" });
  });
});

describe("extra site access", () => {
  it("says there is none when only the declared hosts are granted", async () => {
    await S().renderPerms();
    expect($("privPerms").textContent).toContain("None.");
  });

  it("lists a granted webhook origin and can take it back", async () => {
    chrome.permissions.getAll.mockResolvedValue({ origins: ["https://www.gog.com/*", "https://discord.com/*"] });
    await S().renderPerms();
    expect($("privPerms").textContent).toContain("https://discord.com/*");
    chrome.permissions.getAll.mockResolvedValue({ origins: ["https://www.gog.com/*"] });
    $("privPerms").querySelector("button").click();
    await settle();
    expect(chrome.permissions.remove).toHaveBeenCalledWith({ origins: ["https://discord.com/*"] });
    expect($("privPerms").textContent).toContain("None.");
  });

  it("copes with a browser that can't report permissions", async () => {
    chrome.permissions = undefined;
    await S().renderPerms();
    expect($("privPerms").textContent).toContain("doesn't report");
  });
});

describe("wiring", () => {
  it("'Delete everything' presses the Reset everything button, which has its own confirmations", async () => {
    const reset = vi.fn();
    $("clearAll").addEventListener("click", reset);
    await S().init();
    $("privDeleteAll").click();
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("refreshes the list when the log changes", async () => {
    await S().init();
    expect($("privNet").textContent).toContain("Nothing yet");
    await window.GOGPlusStorage.set({ netLog: [{ t: Date.now(), kind: "fx", host: "api.frankfurter.app", path: "/", status: 200, ok: true }] });
    await settle();
    expect($("privNet").textContent).toContain("api.frankfurter.app");
  });
});
