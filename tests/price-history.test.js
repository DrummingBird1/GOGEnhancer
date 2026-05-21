import { describe, it, expect, beforeEach } from "vitest";

// Loads the storage stack first so price-history can use GOGPlusStorage.
await import("../lib/defaults.js");
await import("../lib/storage.js");
await import("../content/price-history.js");

const History = window.GOGPlusPriceHistory;

beforeEach(() => globalThis.__resetChromeStores());

describe("GOGPlusPriceHistory.record", () => {
  it("creates the slug entry on first record", async () => {
    await History.record("witcher_3", 29.99, "USD");
    const entries = await History.get("witcher_3");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ p: 29.99, c: "USD" });
    expect(entries[0].d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("dedupes when the same price is recorded the same day", async () => {
    await History.record("witcher_3", 29.99, "USD");
    await History.record("witcher_3", 29.99, "USD");
    const entries = await History.get("witcher_3");
    expect(entries).toHaveLength(1);
  });

  it("appends a new entry when the price changes", async () => {
    await History.record("witcher_3", 29.99, "USD");
    await History.record("witcher_3", 19.99, "USD");
    const entries = await History.get("witcher_3");
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.p)).toEqual([29.99, 19.99]);
  });

  it("ignores invalid inputs (no slug, non-positive price)", async () => {
    await History.record("", 10, "USD");
    await History.record("g", 0, "USD");
    await History.record("g", -5, "USD");
    expect(await History.get("g")).toEqual([]);
  });

  it("trims history to MAX_ENTRIES (100) by dropping oldest", async () => {
    // 110 distinct prices so each call creates a new entry
    for (let i = 1; i <= 110; i++) {
      await History.record("g", i, "USD");
    }
    const entries = await History.get("g");
    expect(entries.length).toBe(100);
    // Oldest 10 were dropped: first entry should be price 11, last should be 110
    expect(entries[0].p).toBe(11);
    expect(entries[entries.length - 1].p).toBe(110);
  });
});

describe("GOGPlusPriceHistory.get", () => {
  it("returns an empty array for an unknown slug", async () => {
    const entries = await History.get("never_seen");
    expect(entries).toEqual([]);
  });
});

describe("GOGPlusPriceHistory.lowest", () => {
  it("returns null when no snapshots exist", async () => {
    expect(await History.lowest("never_seen")).toBe(null);
  });

  it("finds the lowest price across snapshots", async () => {
    await History.record("g", 29.99, "USD");
    await History.record("g", 9.99, "USD");
    await History.record("g", 19.99, "USD");
    const low = await History.lowest("g");
    expect(low).toMatchObject({ price: 9.99, currency: "USD" });
    expect(low.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("GOGPlusPriceHistory.stats", () => {
  it("returns null with no snapshots", async () => {
    expect(await History.stats("nothing_here")).toBe(null);
  });

  it("computes count / min / max / avg / first / latest / currency", async () => {
    await History.record("g", 20, "USD");
    await History.record("g", 10, "USD");
    await History.record("g", 30, "USD");
    const s = await History.stats("g");
    expect(s.count).toBe(3);
    expect(s.min.price).toBe(10);
    expect(s.max.price).toBe(30);
    expect(s.avg).toBe(20);
    expect(s.first.p).toBe(20);
    expect(s.latest.p).toBe(30);
    expect(s.currency).toBe("USD");
  });
});
