import { describe, it, expect, beforeEach } from "vitest";

// Loads the storage stack first so price-history can use GOGPlusStorage.
await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/content/price-history.js");

const History = window.GOGPlusPriceHistory;
const { evictLeastRecentlyUpdated, TOTAL_BUDGET_BYTES } = History._internals;

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

// STOR-2: historyMaxEntries caps entries PER game, but nothing capped the
// number of GAMES tracked. A long-time user visiting hundreds of titles had
// no eviction path before storage.local's ~5MB ceiling.
describe("price-history total-size eviction (evictLeastRecentlyUpdated)", () => {
  it("leaves a small history untouched", () => {
    const history = { a: [{ d: "2024-01-01", p: 10, c: "USD" }] };
    const before = JSON.stringify(history);
    evictLeastRecentlyUpdated(history);
    expect(JSON.stringify(history)).toBe(before);
  });

  // ~19KB per fully-populated (500-entry) game, so ~111 games clears the
  // 2MB budget — 140 gives headroom without the test getting too slow.
  const GAMES_TO_EXCEED_BUDGET = 140;
  const bigEntries = (lastDate) =>
    Array.from({ length: 500 }, (_, i) => ({
      d: i === 499 ? lastDate : "2020-01-01",
      p: 9.99,
      c: "USD",
    }));

  it("evicts the least-recently-updated games first when over budget, keeping the newest", () => {
    const history = {};
    for (let g = 0; g < GAMES_TO_EXCEED_BUDGET; g++) {
      // Ascending dates: game_0 is the stalest, the last one is the newest.
      const year = 1990 + g;
      history[`game_${g}`] = bigEntries(`${year}-01-01`);
    }
    expect(JSON.stringify(history).length).toBeGreaterThan(TOTAL_BUDGET_BYTES);

    evictLeastRecentlyUpdated(history);

    expect(history.game_0).toBeUndefined();
    expect(history[`game_${GAMES_TO_EXCEED_BUDGET - 1}`]).toBeDefined();
    expect(JSON.stringify(history).length).toBeLessThanOrEqual(TOTAL_BUDGET_BYTES);
  });

  it("never evicts every game if evicting fewer already fits the budget", () => {
    const history = {
      oldest: bigEntries("2021-01-01"),
      newest: bigEntries("2024-12-31"),
    };
    evictLeastRecentlyUpdated(history);
    // Well under budget already — nothing should be evicted.
    expect(history.oldest).toBeDefined();
    expect(history.newest).toBeDefined();
  });

  it("is wired into record(): recording for a fresh slug can evict stale games once over budget", async () => {
    // Seed storage directly with an over-budget history, bypassing record()'s
    // own per-call trimming, then confirm a real record() call triggers
    // eviction as a side effect.
    const seeded = {};
    for (let g = 0; g < GAMES_TO_EXCEED_BUDGET; g++) {
      seeded[`stale_game_${g}`] = bigEntries("2019-01-01");
    }
    expect(JSON.stringify(seeded).length).toBeGreaterThan(TOTAL_BUDGET_BYTES);
    await window.GOGPlusStorage.set({ priceHistory: seeded });

    await History.record("brand_new_game", 19.99, "USD");

    const after = await window.GOGPlusStorage.get({ priceHistory: {} });
    expect(after.priceHistory.brand_new_game).toBeDefined();
    expect(JSON.stringify(after.priceHistory).length).toBeLessThanOrEqual(TOTAL_BUDGET_BYTES);
  });
});
