import { describe, it, expect, vi, afterEach } from "vitest";

await import("../extension/lib/price-compare.js");

const { fetchDeals, normalizeTitle, titlesMatch, STORE_NAMES } = window.GOGPlusPriceCompare;

function mockFetch(payload, ok = true) {
  globalThis.fetch = vi.fn(async () => ({
    ok,
    json: async () => payload,
  }));
}

describe("normalizeTitle / titlesMatch", () => {
  it("strips trademark symbols and punctuation, lowercases", () => {
    expect(normalizeTitle("Cyberpunk 2077™: Ultimate Edition")).toBe("cyberpunk 2077 ultimate edition");
  });

  it("matches titles that are equal after normalization", () => {
    expect(titlesMatch("Hades", "hades")).toBe(true);
  });

  it("matches when one normalized title contains the other", () => {
    expect(titlesMatch("Hades", "Hades II")).toBe(true);
  });

  it("does not match unrelated titles", () => {
    expect(titlesMatch("Hades", "Stardew Valley")).toBe(false);
  });

  it("does not match on two empty/blank titles", () => {
    expect(titlesMatch("", "")).toBe(false);
  });
});

describe("fetchDeals", () => {
  const origFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.restoreAllMocks();
  });

  it("returns [] for an empty title without calling fetch", async () => {
    globalThis.fetch = vi.fn();
    expect(await fetchDeals("")).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("keeps only recognized stores, parses numeric fields, and sorts ascending by price", async () => {
    mockFetch([
      { storeID: "1", title: "Hades", dealID: "d1", salePrice: "12.50", normalPrice: "25.00", isOnSale: "1", savings: "50.0" },
      { storeID: "7", title: "Hades", dealID: "d2", salePrice: "9.99", normalPrice: "9.99", isOnSale: "0", savings: "0" }, // GOG itself — excluded
      { storeID: "25", title: "Hades", dealID: "d3", salePrice: "8.99", normalPrice: "24.99", isOnSale: "1", savings: "64.0" },
      { storeID: "999", title: "Hades", dealID: "d4", salePrice: "1.00", normalPrice: "1.00", isOnSale: "0", savings: "0" }, // unrecognized store
    ]);
    const deals = await fetchDeals("Hades");
    expect(deals.map((d) => d.storeId)).toEqual([25, 1]); // cheapest first, GOG(7) and unknown(999) excluded
    expect(deals[0].storeName).toBe(STORE_NAMES[25]);
    expect(deals[0].price).toBe(8.99);
    expect(deals[0].savingsPct).toBe(64);
    expect(deals[0].url).toContain("dealID=d3");
  });

  it("filters out results whose title doesn't match the requested game", async () => {
    mockFetch([
      { storeID: "1", title: "Some Unrelated Game", dealID: "d1", salePrice: "5.00", normalPrice: "5.00", isOnSale: "0", savings: "0" },
    ]);
    const deals = await fetchDeals("Hades");
    expect(deals).toEqual([]);
  });

  it("de-dupes to the cheapest listing per store", async () => {
    mockFetch([
      { storeID: "1", title: "Hades", dealID: "d1", salePrice: "15.00", normalPrice: "20.00", isOnSale: "1", savings: "25" },
      { storeID: "1", title: "Hades", dealID: "d2", salePrice: "10.00", normalPrice: "20.00", isOnSale: "1", savings: "50" },
    ]);
    const deals = await fetchDeals("Hades");
    expect(deals).toHaveLength(1);
    expect(deals[0].price).toBe(10);
  });

  it("fails soft to [] on a non-ok response", async () => {
    mockFetch([], false);
    expect(await fetchDeals("Hades")).toEqual([]);
  });

  it("fails soft to [] when fetch itself rejects", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    });
    expect(await fetchDeals("Hades")).toEqual([]);
  });

  it("fails soft to [] on malformed JSON", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => {
        throw new Error("bad json");
      },
    }));
    expect(await fetchDeals("Hades")).toEqual([]);
  });

  it("fails soft to [] when the response body isn't an array", async () => {
    mockFetch({ error: "Missing or generic User-Agent header detected." });
    expect(await fetchDeals("Hades")).toEqual([]);
  });

  it("skips entries with a non-numeric sale price", async () => {
    mockFetch([
      { storeID: "1", title: "Hades", dealID: "d1", salePrice: "not-a-number", normalPrice: "20.00", isOnSale: "0", savings: "0" },
    ]);
    expect(await fetchDeals("Hades")).toEqual([]);
  });
});
