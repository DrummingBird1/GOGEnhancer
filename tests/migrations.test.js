import { describe, it, expect, beforeEach } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/migrations.js");

const CURRENT_VERSION = window.GOG_PLUS_SETTINGS_VERSION; // 3

beforeEach(() => globalThis.__resetChromeStores());

// Shared by both background.js's onInstalled path and the Advanced Options
// import flow (see SEC-2) — a broken migration here risks silently losing a
// user's tags/notes, or leaving an imported old-shape export un-migrated.
describe("GOGPlusMigrations.run — v1→v2 (tags/notes: sync → local)", () => {
  it("moves tags and notes out of sync into local, and bumps settingsVersion", async () => {
    await new Promise((r) =>
      chrome.storage.sync.set(
        { settingsVersion: 1, tags: { foo: ["bar"] }, notes: { foo: "hi" } },
        r
      )
    );

    await window.GOGPlusMigrations.run();

    const local = await new Promise((r) => chrome.storage.local.get(null, r));
    const sync = await new Promise((r) => chrome.storage.sync.get(null, r));

    expect(local.tags).toEqual({ foo: ["bar"] });
    expect(local.notes).toEqual({ foo: "hi" });
    expect(sync.tags).toBeUndefined();
    expect(sync.notes).toBeUndefined();
    expect(sync.settingsVersion).toBe(CURRENT_VERSION);
  });

  it("moves only tags when notes were never set", async () => {
    await new Promise((r) => chrome.storage.sync.set({ settingsVersion: 1, tags: { foo: ["bar"] } }, r));

    await window.GOGPlusMigrations.run();

    const local = await new Promise((r) => chrome.storage.local.get(null, r));
    expect(local.tags).toEqual({ foo: ["bar"] });
    expect(local.notes).toBeUndefined();
  });

  it("is a safe no-op for a fresh install (nothing in sync yet)", async () => {
    await window.GOGPlusMigrations.run();

    const sync = await new Promise((r) => chrome.storage.sync.get(null, r));
    const local = await new Promise((r) => chrome.storage.local.get(null, r));
    expect(sync.settingsVersion).toBe(CURRENT_VERSION);
    expect(local.tags).toBeUndefined();
    expect(local.notes).toBeUndefined();
  });

  it("is idempotent — running again on an already-migrated store changes nothing further", async () => {
    await new Promise((r) =>
      chrome.storage.sync.set({ settingsVersion: 1, tags: { foo: ["bar"] } }, r)
    );
    await window.GOGPlusMigrations.run();
    await window.GOGPlusMigrations.run(); // second run

    const local = await new Promise((r) => chrome.storage.local.get(null, r));
    const sync = await new Promise((r) => chrome.storage.sync.get(null, r));
    expect(local.tags).toEqual({ foo: ["bar"] });
    expect(sync.tags).toBeUndefined();
    expect(sync.settingsVersion).toBe(CURRENT_VERSION);
  });

  it("does not touch tags/notes already living in local (nothing to migrate)", async () => {
    await new Promise((r) => chrome.storage.sync.set({ settingsVersion: 1 }, r));
    await new Promise((r) => chrome.storage.local.set({ tags: { existing: ["x"] } }, r));

    await window.GOGPlusMigrations.run();

    const local = await new Promise((r) => chrome.storage.local.get(null, r));
    expect(local.tags).toEqual({ existing: ["x"] });
  });

  it("simulates an old settings export being imported: pre-v2 shape gets fixed up", async () => {
    // What SEC-2 actually protects: an export taken before v1→v2 still has
    // tags/notes under sync. Write it in raw (as the import handler does),
    // then confirm the same migration pass used on upgrade cleans it up.
    const oldExport = {
      sync: { settingsVersion: 1, targetCurrency: "ILS", tags: { imported: ["old"] } },
      local: { priceHistory: {} },
    };
    await new Promise((r) => chrome.storage.sync.set(oldExport.sync, r));
    await new Promise((r) => chrome.storage.local.set(oldExport.local, r));

    await window.GOGPlusMigrations.run();

    const sync = await new Promise((r) => chrome.storage.sync.get(null, r));
    const local = await new Promise((r) => chrome.storage.local.get(null, r));
    expect(sync.tags).toBeUndefined();
    expect(local.tags).toEqual({ imported: ["old"] });
    expect(sync.settingsVersion).toBe(CURRENT_VERSION);
    expect(sync.targetCurrency).toBe("ILS"); // untouched, unrelated key
  });
});

describe("GOGPlusMigrations.run — v2→v3 (purchaseLog: string → {date, price?, currency?})", () => {
  it("wraps every bare-string purchaseLog entry into { date }", async () => {
    await new Promise((r) =>
      chrome.storage.sync.set({ settingsVersion: 2 }, r)
    );
    await new Promise((r) =>
      chrome.storage.local.set(
        { purchaseLog: { hades: "2026-01-10", celeste: "2026-02-20" } },
        r
      )
    );

    await window.GOGPlusMigrations.run();

    const local = await new Promise((r) => chrome.storage.local.get(["purchaseLog"], r));
    expect(local.purchaseLog.hades).toEqual({ date: "2026-01-10" });
    expect(local.purchaseLog.celeste).toEqual({ date: "2026-02-20" });
    const sync = await new Promise((r) => chrome.storage.sync.get(["settingsVersion"], r));
    expect(sync.settingsVersion).toBe(CURRENT_VERSION);
  });

  it("leaves an already-upgraded entry (object shape) untouched", async () => {
    await new Promise((r) => chrome.storage.sync.set({ settingsVersion: 2 }, r));
    const already = { date: "2026-01-10", price: 19.99, currency: "USD" };
    await new Promise((r) => chrome.storage.local.set({ purchaseLog: { hades: already } }, r));

    await window.GOGPlusMigrations.run();

    const local = await new Promise((r) => chrome.storage.local.get(["purchaseLog"], r));
    expect(local.purchaseLog.hades).toEqual(already);
  });

  it("handles a mix of legacy strings and already-upgraded objects in the same store", async () => {
    await new Promise((r) => chrome.storage.sync.set({ settingsVersion: 2 }, r));
    await new Promise((r) =>
      chrome.storage.local.set(
        { purchaseLog: { hades: "2026-01-10", celeste: { date: "2026-02-20", price: 5 } } },
        r
      )
    );

    await window.GOGPlusMigrations.run();

    const local = await new Promise((r) => chrome.storage.local.get(["purchaseLog"], r));
    expect(local.purchaseLog.hades).toEqual({ date: "2026-01-10" });
    expect(local.purchaseLog.celeste).toEqual({ date: "2026-02-20", price: 5 });
  });

  it("is a safe no-op when purchaseLog is empty or absent", async () => {
    await new Promise((r) => chrome.storage.sync.set({ settingsVersion: 2 }, r));
    await window.GOGPlusMigrations.run();
    const local = await new Promise((r) => chrome.storage.local.get(["purchaseLog"], r));
    expect(local.purchaseLog).toBeUndefined();
    const sync = await new Promise((r) => chrome.storage.sync.get(["settingsVersion"], r));
    expect(sync.settingsVersion).toBe(CURRENT_VERSION);
  });

  it("also runs the v1→v2 step first when upgrading from v1 all the way to current", async () => {
    await new Promise((r) =>
      chrome.storage.sync.set({ settingsVersion: 1, tags: { foo: ["bar"] } }, r)
    );
    await new Promise((r) => chrome.storage.local.set({ purchaseLog: { hades: "2026-01-10" } }, r));

    await window.GOGPlusMigrations.run();

    const local = await new Promise((r) => chrome.storage.local.get(null, r));
    expect(local.tags).toEqual({ foo: ["bar"] }); // v1->v2
    expect(local.purchaseLog.hades).toEqual({ date: "2026-01-10" }); // v2->v3
    const sync = await new Promise((r) => chrome.storage.sync.get(["settingsVersion"], r));
    expect(sync.settingsVersion).toBe(CURRENT_VERSION);
  });
});
