import { describe, it, expect, beforeEach, vi } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/net.js");
await import("../extension/lib/gog-api.js");

const Api = () => window.GOGPlusGogApi;

// A product shaped like a real catalog.gog.com response (inspected 2026-10-03).
const PRODUCT = {
  id: "1207658980",
  slug: "lands_of_lore_1_2",
  title: "Lands of Lore™ 1+2",
  productType: "pack",
  coverVertical: "https://images.gog-statics.com/abc_product_card_v2_mobile_slider_639.jpg",
  releaseDate: "1993.01.02",
  genres: [{ name: "Role-playing", slug: "role-playing" }, { name: "Fantasy" }],
  reviewsRating: 4.6,
  reviewsCount: 757,
  price: {
    final: "$1.49",
    base: "$5.99",
    discount: "-75%",
    finalMoney: { amount: "1.49", currency: "USD", discount: "4.50" },
    baseMoney: { amount: "5.99", currency: "USD" },
  },
};

describe("queryFromResources", () => {
  it("takes the most recent catalog request the page made", () => {
    const q = Api().queryFromResources([
      { name: "https://catalog.gog.com/v1/catalog?limit=48&order=desc%3Atrending&page=1&currencyCode=ILS" },
      { name: "https://www.gog.com/other.js" },
      { name: "https://catalog.gog.com/v1/catalog?limit=48&order=asc%3Aprice&genres=in%3Aaction&page=3&currencyCode=ILS" },
    ]);
    expect(q.get("order")).toBe("asc:price");
    expect(q.get("genres")).toBe("in:action");
    expect(q.get("currencyCode")).toBe("ILS");
  });

  it("returns null when the page made no such request (server-rendered)", () => {
    expect(Api().queryFromResources([{ name: "https://www.gog.com/x.js" }])).toBeNull();
    expect(Api().queryFromResources([])).toBeNull();
  });
});

describe("queryFromLocation", () => {
  it("passes through only known filter parameters, cleaned", () => {
    const q = Api().queryFromLocation("?order=desc:discount&genres=in:action&utm_source=x&page=4&discounted=eq:true&query=<script>");
    expect(q.get("order")).toBe("desc:discount");
    expect(q.get("genres")).toBe("in:action");
    expect(q.get("discounted")).toBe("eq:true");
    expect(q.has("utm_source")).toBe(false);
    expect(q.has("page")).toBe(false);
    expect(q.get("query")).toBe("script"); // < and > stripped
  });

  it("defaults to the site's own default order", () => {
    expect(Api().queryFromLocation("").get("order")).toBe("desc:trending");
  });
});

describe("pageUrl / locale / page number", () => {
  it("builds a catalog URL with page size, page and environment", () => {
    const u = new URL(Api().pageUrl(new URLSearchParams("order=desc:trending"), 3, { locale: "de-DE", currency: "EUR" }));
    expect(u.origin + u.pathname).toBe("https://catalog.gog.com/v1/catalog");
    expect(u.searchParams.get("limit")).toBe("48");
    expect(u.searchParams.get("page")).toBe("3");
    expect(u.searchParams.get("locale")).toBe("de-DE");
    expect(u.searchParams.get("currencyCode")).toBe("EUR");
  });

  it("does not override locale / currency the page's own request already had", () => {
    const u = new URL(Api().pageUrl(new URLSearchParams("locale=fr-FR&currencyCode=GBP"), 2, { locale: "en-US", currency: "USD" }));
    expect(u.searchParams.get("locale")).toBe("fr-FR");
    expect(u.searchParams.get("currencyCode")).toBe("GBP");
  });

  it("ignores a malformed currency or country and clamps the page", () => {
    const u = new URL(Api().pageUrl(new URLSearchParams(), -4, { currency: "dollars", country: "USA" }));
    expect(u.searchParams.get("page")).toBe("1");
    expect(u.searchParams.has("currencyCode")).toBe(false);
    expect(u.searchParams.has("countryCode")).toBe(false);
  });

  it("maps the URL language to an API locale", () => {
    expect(Api().localeFromPath("/en/games")).toBe("en-US");
    expect(Api().localeFromPath("/de/games")).toBe("de-DE");
    expect(Api().localeFromPath("/games")).toBe("en-US");
    expect(Api().localeFromPath("/xx/games")).toBe("en-US");
  });

  it("reads the page number, defaulting to 1", () => {
    expect(Api().pageFromLocation("?page=7")).toBe(7);
    expect(Api().pageFromLocation("?page=abc")).toBe(1);
    expect(Api().pageFromLocation("")).toBe(1);
  });
});

describe("sameList — proof we're continuing the list on screen", () => {
  const dom = ["a", "b", "c", "d", "e", "f", "g", "h"];
  it("accepts a list that is the same set with a little reordering", () => {
    expect(Api().sameList(dom, ["b", "a", "c", "d", "e", "f", "x", "y"])).toBe(true);
  });
  it("rejects a different list", () => {
    expect(Api().sameList(dom, ["m", "n", "o", "p", "q", "r", "s", "t"])).toBe(false);
    expect(Api().sameList(dom, ["a", "b", "x", "y", "z"])).toBe(false);
  });
  it("won't vouch for a handful of tiles", () => {
    expect(Api().sameList(["a", "b", "c"], ["a", "b", "c"])).toBe(false);
  });
});

describe("normalizeProduct / parseCatalog", () => {
  it("reduces a real-shaped product to what a card needs", () => {
    expect(Api().normalizeProduct(PRODUCT)).toEqual({
      id: "1207658980",
      slug: "lands_of_lore_1_2",
      title: "Lands of Lore™ 1+2",
      type: "pack",
      cover: PRODUCT.coverVertical,
      price: 1.49,
      base: 5.99,
      discountPct: 75,
      currency: "USD",
      releaseDate: "1993-01-02",
      genres: ["Role-playing", "Fantasy"],
      rating: 4.6,
      reviews: 757,
    });
  });

  it("copes with a free, undiscounted, sparse product", () => {
    const it = Api().normalizeProduct({ slug: "free_game", price: { finalMoney: { amount: "0.00", currency: "USD" } } });
    expect(it).toMatchObject({ slug: "free_game", title: "free_game", price: 0, base: null, discountPct: 0, cover: "", genres: [], rating: null });
  });

  it("refuses a cover that isn't https and a product without a slug", () => {
    expect(Api().normalizeProduct({ slug: "x", coverVertical: "http://x/y.jpg" }).cover).toBe("");
    expect(Api().normalizeProduct({ title: "no slug" })).toBeNull();
    expect(Api().normalizeProduct(null)).toBeNull();
  });

  it("parses a response and drops products it can't use", () => {
    const r = Api().parseCatalog({ products: [PRODUCT, { nope: 1 }], pages: "209", productCount: 12859 });
    expect(r.items).toHaveLength(1);
    expect(r.pages).toBe(209);
    expect(r.total).toBe(12859);
    expect(Api().parseCatalog({})).toBeNull();
    expect(Api().parseCatalog(null)).toBeNull();
  });
});

describe("fetchCatalogPage", () => {
  beforeEach(() => globalThis.__resetChromeStores());

  it("fetches through the network layer and parses", async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ products: [PRODUCT], pages: 2, productCount: 50 }) }));
    const url = Api().pageUrl(new URLSearchParams("order=desc:trending"), 2);
    const r = await Api().fetchCatalogPage(url);
    expect(r.items[0].slug).toBe("lands_of_lore_1_2");
    expect(globalThis.fetch.mock.calls[0][0]).toBe(url);
  });

  it("refuses a URL that isn't a catalog request", async () => {
    globalThis.fetch = vi.fn();
    expect(await Api().fetchCatalogPage("https://catalog.gog.com/other")).toBeNull();
    expect(await Api().fetchCatalogPage("https://evil.example/v1/catalog?x=1")).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("packs", () => {
  const PACK = {
    _embedded: { productType: "PACK", product: { title: "Lands of Lore 1+2" } },
    _links: {
      store: { href: "https://www.gog.com/en/game/lands_of_lore_1_2" },
      includesGames: [
        { href: "https://api.gog.com/v2/games/1207662513?locale=en-US" },
        { href: "https://api.gog.com/v2/games/1207662563?locale=en-US" },
      ],
    },
  };
  const child = (slug, title) => ({ _embedded: { product: { title } }, _links: { store: { href: `https://www.gog.com/en/game/${slug}` } } });

  it("reads the included product ids", () => {
    expect(Api().includedIds(PACK)).toEqual(["1207662513", "1207662563"]);
    expect(Api().includedIds({ _links: { includesGames: { href: "https://api.gog.com/v2/games/42?x" } } })).toEqual(["42"]);
    expect(Api().includedIds({ _links: {} })).toEqual([]);
    expect(Api().includedIds(null)).toEqual([]);
  });

  it("reads a store slug and title", () => {
    expect(Api().storeSlugOf(PACK)).toBe("lands_of_lore_1_2");
    expect(Api().storeSlugOf({ _links: { store: { href: "https://www.gog.com/en/games" } } })).toBe("");
    expect(Api().titleOfProduct(PACK)).toBe("Lands of Lore 1+2");
  });

  beforeEach(() => globalThis.__resetChromeStores());

  it("resolves a pack to its children's slugs and titles", async () => {
    const answers = {
      "1207658980": PACK,
      "1207662513": child("lands_of_lore_the_throne_of_chaos", "Lands of Lore: The Throne of Chaos"),
      "1207662563": child("lands_of_lore_guardians_of_destiny", "Lands of Lore: Guardians of Destiny"),
    };
    globalThis.fetch = vi.fn(async (url) => ({ ok: true, status: 200, json: async () => answers[/games\/(\d+)/.exec(url)[1]] }));
    const r = await Api().fetchPackContents("1207658980");
    expect(r).toEqual([
      { id: "1207662513", slug: "lands_of_lore_the_throne_of_chaos", title: "Lands of Lore: The Throne of Chaos" },
      { id: "1207662563", slug: "lands_of_lore_guardians_of_destiny", title: "Lands of Lore: Guardians of Destiny" },
    ]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it("says [] for an ordinary game and null when the lookup failed", async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ _links: {}, _embedded: {} }) }));
    expect(await Api().fetchPackContents("1207659094")).toEqual([]);
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    expect(await Api().fetchPackContents("1207659094")).toBeNull();
  });

  it("only looks up numeric ids, and at most MAX_PACK_CHILDREN children", async () => {
    globalThis.fetch = vi.fn();
    expect(await Api().fetchPackContents("../../etc")).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();

    const many = { _links: { includesGames: Array.from({ length: 30 }, (_, i) => ({ href: `https://api.gog.com/v2/games/${1000 + i}` })) } };
    globalThis.fetch = vi.fn(async (url) => ({
      ok: true,
      status: 200,
      json: async () => (/games\/1207658980/.test(url) ? many : child(`g_${/games\/(\d+)/.exec(url)[1]}`, "x")),
    }));
    const r = await Api().fetchPackContents("1207658980");
    expect(r).toHaveLength(Api().MAX_PACK_CHILDREN);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1 + Api().MAX_PACK_CHILDREN);
  });
});

describe("sanitizeParams", () => {
  it("keeps only known parameter names, with cleaned values", () => {
    const q = Api().sanitizeParams(new URLSearchParams("order=desc%3Adiscount&evil=1&countryCode=IL&price=between%3A0%2C10&query=%3Cb%3Ex"));
    expect(Object.fromEntries(q)).toEqual({ order: "desc:discount", countryCode: "IL", price: "between:0,10", query: "bx" });
  });
  it("caps how many parameters it will carry", () => {
    const many = new URLSearchParams();
    for (let i = 0; i < 60; i++) many.append("genres", `g${i}`);
    expect([...Api().sanitizeParams(many)].length).toBeLessThanOrEqual(1); // same name collapses
  });
});

describe("catalogRequestsFromState — the site's own server-side request", () => {
  const key = "catalog.gog/v1/catalog?limit=48&order=desc%3Adiscount&productType=in%3Agame%2Cpack%2Cdlc%2Cextras&page=2&countryCode=IL&locale=en-US&currencyCode=USD";
  const state = (extra = {}) =>
    JSON.stringify({
      consulConfig: { x: 1 },
      "sections.gog/v1/pages/2f67616d6573?countryCode=IL": { status: 200, body: {} },
      [key]: { status: 200, body: { pages: 209, products: [{ slug: "a_game" }, { slug: "b_game" }, { nope: 1 }] } },
      ...extra,
    });

  it("reads the exact query (country and currency included), the page and the games listed", () => {
    const r = Api().catalogRequestsFromState(state());
    expect(r).toHaveLength(1);
    expect(r[0].page).toBe(2);
    expect(r[0].slugs).toEqual(["a_game", "b_game"]);
    expect(r[0].params.get("countryCode")).toBe("IL");
    expect(r[0].params.get("currencyCode")).toBe("USD");
    expect(r[0].params.get("productType")).toBe("in:game,pack,dlc,extras");
    expect(r[0].params.get("order")).toBe("desc:discount");
  });

  it("ignores other entries, entries without products, and bad input", () => {
    expect(Api().catalogRequestsFromState(state({ "catalog.gog/v1/catalog?limit=1&page=1": { status: 200, body: {} } }))).toHaveLength(1);
    expect(Api().catalogRequestsFromState("not json")).toEqual([]);
    expect(Api().catalogRequestsFromState("")).toEqual([]);
    expect(Api().catalogRequestsFromState(undefined)).toEqual([]);
    expect(Api().catalogRequestsFromState("x".repeat(9e6))).toEqual([]);
  });
});
