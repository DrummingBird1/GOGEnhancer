import { describe, it, expect, beforeEach } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/migrations.js");

const CURRENT_VERSION = window.GOG_PLUS_SETTINGS_VERSION; // 2

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
