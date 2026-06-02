import { describe, it, expect, beforeEach } from "vitest";

// Import-for-side-effects: each file is an IIFE that attaches singletons to window.
// Vitest caches modules between tests, so the globals stay defined.
await import("../lib/defaults.js");
await import("../lib/storage.js");

const Storage = window.GOGPlusStorage;

beforeEach(() => globalThis.__resetChromeStores());

describe("GOGPlusStorage", () => {
  it("exposes promise-based get / set / remove / onChange", () => {
    expect(Storage).toBeDefined();
    expect(typeof Storage.get).toBe("function");
    expect(typeof Storage.set).toBe("function");
    expect(typeof Storage.remove).toBe("function");
    expect(typeof Storage.onChange).toBe("function");
  });

  it("routes a SYNC key to chrome.storage.sync and a LOCAL key to chrome.storage.local", async () => {
    await Storage.set({ enabled: false, tags: { foo: ["bar"] } });
    expect(await new Promise((r) => chrome.storage.sync.get(["enabled"], r))).toEqual({
      enabled: false,
    });
    expect(await new Promise((r) => chrome.storage.local.get(["tags"], r))).toEqual({
      tags: { foo: ["bar"] },
    });
  });

  it("merges sync + local results when get() is called with mixed keys", async () => {
    await Storage.set({ enabled: false, tags: { x: ["y"] } });
    const result = await Storage.get(["enabled", "tags"]);
    expect(result).toEqual({ enabled: false, tags: { x: ["y"] } });
  });

  it("returns defaults from the object form when keys are missing", async () => {
    const result = await Storage.get({ vatPercent: 18, tags: {} });
    expect(result).toEqual({ vatPercent: 18, tags: {} });
  });

  it("string form returns the GOG_PLUS_DEFAULTS default when key is unset", async () => {
    const result = await Storage.get("vatPercent");
    expect(result).toEqual({ vatPercent: 18 });
  });

  it("array form returns defaults for each known key when unset", async () => {
    const result = await Storage.get(["vatPercent", "targetCurrency"]);
    expect(result).toEqual({ vatPercent: 18, targetCurrency: "ILS" });
  });

  it("string form for an unknown key still returns {} when unset", async () => {
    const result = await Storage.get("trulyNovelKey");
    expect(result).toEqual({});
  });

  it("falls unknown keys through to local (safer-by-default)", async () => {
    await Storage.set({ unknownNewKey: "value" });
    const localRead = await new Promise((r) =>
      chrome.storage.local.get(["unknownNewKey"], r)
    );
    expect(localRead).toEqual({ unknownNewKey: "value" });
  });

  it("notifies onChange listeners with the key, area, oldValue, newValue", async () => {
    const seen = [];
    const unsubscribe = Storage.onChange(({ key, area, newValue }) => {
      seen.push({ key, area, newValue });
    });
    await Storage.set({ enabled: true });
    await Storage.set({ tags: { a: ["b"] } });
    unsubscribe();
    expect(seen).toEqual([
      { key: "enabled", area: "sync", newValue: true },
      { key: "tags", area: "sync" /* placeholder */, newValue: { a: ["b"] } },
    ].map((e, i) => ({ ...e, area: i === 0 ? "sync" : "local" })));
  });

  it("removes from the correct area per key", async () => {
    await Storage.set({ enabled: false, tags: { a: ["b"] } });
    await Storage.remove(["enabled", "tags"]);
    // After removal, get() falls back to GOG_PLUS_DEFAULTS values.
    expect(await Storage.get(["enabled", "tags"])).toEqual({
      enabled: true,
      tags: {},
    });
    // The raw chrome.storage.* areas no longer have the keys.
    expect(await new Promise((r) => chrome.storage.sync.get(["enabled"], r))).toEqual({});
    expect(await new Promise((r) => chrome.storage.local.get(["tags"], r))).toEqual({});
  });
});

describe("GOG_PLUS_DEFAULTS", () => {
  it("exposes the canonical defaults and version", () => {
    expect(window.GOG_PLUS_DEFAULTS).toBeDefined();
    expect(window.GOG_PLUS_SETTINGS_VERSION).toBe(2);
  });

  it("defines enabled, targetCurrency, rates", () => {
    const d = window.GOG_PLUS_DEFAULTS;
    expect(d.enabled).toBe(true);
    expect(d.targetCurrency).toBe("ILS");
    expect(d.rates.ILS).toBeGreaterThan(0);
  });

  it("includes every prefs and data key the wrapper knows about", () => {
    const d = window.GOG_PLUS_DEFAULTS;
    const expected = [
      "enabled", "currencyConverter", "taxEstimator",
      "targetCurrency", "rates", "ratesUpdatedAt", "lastFxError",
      "tags", "tagColors", "tagOrder", "notes", "priceHistory", "purchaseLog",
      "notifLog", "theme", "debugLogging", "desktopNotifications",
      "refundTimer", "settingsVersion", "onboardingComplete",
      "tagDashboardDensity", "historyMaxEntries",
    ];
    for (const k of expected) {
      expect(d, `missing default for "${k}"`).toHaveProperty(k);
    }
  });
});
