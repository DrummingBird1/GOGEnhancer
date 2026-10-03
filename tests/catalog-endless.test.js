import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resetEnv, tick, state } from "./helpers/content-env.js";
import { gridHtml } from "./helpers/fixtures.js";

const E = () => window.GOGPlusEndless;

const TILES = ["alpha", "beta", "gamma", "delta", "epsilon"].map((slug) => ({ slug, title: slug, price: "$5.00" }));

const product = (slug, extra = {}) => ({
  id: `id_${slug}`,
  slug,
  title: `Title ${slug}`,
  productType: "game",
  coverVertical: `https://images.gog-statics.com/${slug}.jpg`,
  releaseDate: "2020.05.06",
  genres: [{ name: "RPG" }],
  reviewsRating: 4.2,
  reviewsCount: 10,
  price: { finalMoney: { amount: "9.99", currency: "USD" }, baseMoney: { amount: "19.99", currency: "USD" }, discount: "-50%" },
  ...extra,
});

/** Answers catalog requests from a table: page number -> products. */
function mockCatalog(pages, { totalPages = Object.keys(pages).length } = {}) {
  globalThis.fetch = vi.fn(async (url) => {
    const page = Number(new URL(url).searchParams.get("page"));
    const products = pages[page] || [];
    return { ok: true, status: 200, json: async () => ({ products, pages: totalPages, productCount: 999 }) };
  });
}

let ioCallbacks = [];
class FakeIO {
  constructor(cb) {
    this.cb = cb;
    ioCallbacks.push(this);
  }
  observe() {}
  disconnect() {
    this.dead = true;
  }
  fire() {
    this.cb([{ isIntersecting: true }]);
  }
}
const fireIO = () => ioCallbacks.filter((o) => !o.dead).forEach((o) => o.fire());

function mount() {
  [...document.body.children].forEach((c) => {
    if (!c.classList.contains("gog-plus-toasts")) c.remove();
  });
  document.body.insertAdjacentHTML("afterbegin", gridHtml(TILES));
}

/** The resource timeline as a page that made its own catalog request would have it. */
function pageMadeRequest(query = "limit=48&order=desc%3Atrending&page=1&currencyCode=USD&locale=en-US") {
  vi.spyOn(performance, "getEntriesByType").mockReturnValue([{ name: `https://catalog.gog.com/v1/catalog?${query}` }]);
}

const cards = () => [...document.querySelectorAll(".gog-plus-more-card")];
const slugs = () => cards().map((c) => c.dataset.slug);

beforeEach(() => {
  ioCallbacks = [];
  vi.stubGlobal("IntersectionObserver", FakeIO);
  resetEnv({ path: "/en/games?order=desc:trending", settings: { endlessCatalog: true } });
  E().reset();
  mount();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  E().reset();
});

describe("when it runs", () => {
  it("does nothing while the switch is off (the default)", () => {
    state.settings.endlessCatalog = false;
    pageMadeRequest();
    E().applyEndless();
    expect(document.getElementById("gog-plus-endless")).toBeNull();
  });

  it("does nothing off the catalog, or without catalog tools", () => {
    pageMadeRequest();
    state.settings.catalogTools = false;
    E().applyEndless();
    expect(document.getElementById("gog-plus-endless")).toBeNull();
    state.settings.catalogTools = true;
    window.history.replaceState({}, "", "/en/game/some_game");
    E().applyEndless();
    expect(document.getElementById("gog-plus-endless")).toBeNull();
  });

  it("mounts one container right after the grid, however many passes run", () => {
    pageMadeRequest();
    E().applyEndless();
    E().applyEndless();
    const boxes = document.querySelectorAll("#gog-plus-endless");
    expect(boxes).toHaveLength(1);
    expect(boxes[0].previousElementSibling).toBe(document.querySelector(".paginated-products-grid"));
  });

  it("waits until there is a real list on screen", () => {
    document.querySelector(".paginated-products-grid").replaceChildren();
    E().applyEndless();
    expect(document.getElementById("gog-plus-endless")).toBeNull();
  });

  it("is removed when the switch goes off or the page stops being a catalog", () => {
    pageMadeRequest();
    E().applyEndless();
    state.settings.endlessCatalog = false;
    E().applyEndless();
    expect(document.getElementById("gog-plus-endless")).toBeNull();
  });

  it("starts over when the filters (the URL) change", () => {
    pageMadeRequest();
    E().applyEndless();
    const first = document.getElementById("gog-plus-endless");
    window.history.replaceState({}, "", "/en/games?order=asc:price");
    E().applyEndless();
    expect(document.getElementById("gog-plus-endless")).not.toBe(first);
    expect(document.querySelectorAll("#gog-plus-endless")).toHaveLength(1);
  });
});

describe("loading the next page", () => {
  it("appends the next page's games as cards when the end of the grid is reached", async () => {
    pageMadeRequest();
    mockCatalog({ 2: [product("one"), product("two")] }, { totalPages: 5 });
    E().applyEndless();
    fireIO();
    await tick(5);
    expect(slugs()).toEqual(["one", "two"]);
    const url = new URL(globalThis.fetch.mock.calls[0][0]);
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("order")).toBe("desc:trending"); // the page's own query, reused
    const first = cards()[0];
    expect(first.querySelector("a").getAttribute("href")).toBe("/en/game/one");
    expect(first.textContent).toContain("Title one");
    expect(first.textContent).toContain("-50%");
    expect(first.textContent).toContain("$9.99");
    expect(document.querySelector(".gog-plus-endless-sep").textContent).toBe("Page 2");
  });

  it("asks for the page after the one on screen, and continues the numbering", async () => {
    window.history.replaceState({}, "", "/en/games?order=desc:trending&page=3");
    pageMadeRequest("limit=48&order=desc%3Atrending&page=3");
    mockCatalog({ 4: [product("p4")], 5: [product("p5")] }, { totalPages: 9 });
    E().applyEndless();
    fireIO();
    await tick(5);
    fireIO();
    await tick(5);
    expect(globalThis.fetch.mock.calls.map((c) => new URL(c[0]).searchParams.get("page"))).toEqual(["4", "5"]);
    expect(slugs()).toEqual(["p4", "p5"]);
  });

  it("says so when it reaches the last page, and stops asking", async () => {
    pageMadeRequest();
    mockCatalog({ 2: [product("last")] }, { totalPages: 2 });
    E().applyEndless();
    fireIO();
    await tick(5);
    expect(document.querySelector(".gog-plus-endless-status").textContent).toContain("everything");
    fireIO();
    await tick(5);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("treats an empty page as the end", async () => {
    pageMadeRequest();
    mockCatalog({}, { totalPages: 50 });
    E().applyEndless();
    fireIO();
    await tick(5);
    expect(cards()).toHaveLength(0);
    expect(document.querySelector(".gog-plus-endless-status").textContent).toContain("everything");
  });

  it("offers a retry when the request fails, and retrying works", async () => {
    pageMadeRequest();
    globalThis.fetch = vi.fn(async () => {
      throw new Error("offline");
    });
    E().applyEndless();
    fireIO();
    await tick(5);
    const retry = [...document.querySelectorAll(".gog-plus-endless-status button")].find((b) => b.textContent === "Try again");
    expect(retry).toBeTruthy();
    expect(state.failures["endless scrolling"]).toBeTruthy();
    mockCatalog({ 2: [product("back")] }, { totalPages: 4 });
    retry.click();
    await tick(5);
    expect(slugs()).toEqual(["back"]);
  });

  it("never runs two requests at once", async () => {
    pageMadeRequest();
    let release;
    globalThis.fetch = vi.fn(() => new Promise((r) => (release = () => r({ ok: true, status: 200, json: async () => ({ products: [product("x")], pages: 5 }) }))));
    E().applyEndless();
    fireIO();
    fireIO();
    fireIO();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    release();
    await tick(5);
    expect(slugs()).toEqual(["x"]);
  });

  it("pauses for a button after a run of automatic pages", async () => {
    pageMadeRequest();
    const pages = {};
    for (let p = 2; p <= 12; p++) pages[p] = [product(`g${p}`)];
    mockCatalog(pages, { totalPages: 12 });
    E().applyEndless();
    for (let i = 0; i < 10; i++) {
      fireIO();
      await tick(2);
    }
    // 8 automatic pages, then it waits for the user
    expect(globalThis.fetch).toHaveBeenCalledTimes(8);
    const more = [...document.querySelectorAll(".gog-plus-endless-status button")].find((b) => b.textContent === "Load more games");
    expect(more).toBeTruthy();
    more.click();
    await tick(5);
    expect(globalThis.fetch).toHaveBeenCalledTimes(9);
  });
});

describe("proving it is the same list (server-rendered first load)", () => {
  it("builds the query from the URL, checks it against the tiles on screen, then continues", async () => {
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([]);
    const onScreen = TILES.map((t) => product(t.slug));
    mockCatalog({ 1: onScreen, 2: [product("next")] }, { totalPages: 3 });
    E().applyEndless();
    fireIO();
    await tick(5);
    const asked = globalThis.fetch.mock.calls.map((c) => new URL(c[0]).searchParams.get("page"));
    expect(asked).toEqual(["1", "2"]); // calibrate, then the next page
    expect(slugs()).toEqual(["next"]);
  });

  it("refuses to append anything when the API's page 1 isn't the list on screen", async () => {
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([]);
    mockCatalog({ 1: ["q", "r", "s", "t", "u"].map((s) => product(s)), 2: [product("never")] }, { totalPages: 3 });
    E().applyEndless();
    fireIO();
    await tick(5);
    expect(cards()).toHaveLength(0);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".gog-plus-endless-status").textContent).toContain("stays off");
    expect(state.failures["endless scrolling"].message).toContain("could not match");
  });
});

describe("our cards", () => {
  async function load(extra = {}, settings = {}) {
    Object.assign(state.settings, settings);
    pageMadeRequest();
    mockCatalog({ 2: [product("mine", extra), product("other")] }, { totalPages: 4 });
    E().applyEndless();
    fireIO();
    await tick(5);
  }

  it("hides games you marked not interested, and dims or hides owned ones", async () => {
    await load({}, { notInterested: { other: "2026-01-01" }, ownedSlugs: { mine: "2026-01-01" }, ownedDisplay: "dim" });
    const byslug = Object.fromEntries(cards().map((c) => [c.dataset.slug, c]));
    expect(byslug.other.classList.contains("gog-plus-tile-hidden")).toBe(true);
    expect(byslug.mine.classList.contains("gog-plus-tile-dim")).toBe(true);
    state.settings.ownedDisplay = "hide";
    E().applyEndless();
    expect(byslug.mine.classList.contains("gog-plus-tile-hidden")).toBe(true);
  });

  it("has a not-interested button that records the choice", async () => {
    await load();
    cards()[0].querySelector(".gog-plus-more-hide").click();
    await tick(5);
    expect(state.settings.notInterested.mine).toBeTruthy();
    expect(cards()[0].classList.contains("gog-plus-tile-hidden")).toBe(true);
  });

  it("shows the converted price when the converter is on", async () => {
    await load({}, { currencyConverter: true, taxEstimator: false, targetCurrency: "ILS", rates: { ILS: 3.65 } });
    expect(cards()[0].querySelector(".gog-plus-more-price em").textContent).toMatch(/≈\s*₪\s*36/);
  });

  it("builds cards without innerHTML — a hostile title stays text", async () => {
    await load({ title: '<img src=x onerror="alert(1)">' });
    const t = cards()[0].querySelector(".gog-plus-more-title");
    expect(t.textContent).toBe('<img src=x onerror="alert(1)">');
    expect(t.querySelector("img")).toBeNull();
  });

  it("are our UI: their prices are never mistaken for the site's", async () => {
    await load();
    const Dom = window.GOGPlusGogDom;
    expect(Dom.isSiteElement(document.querySelector(".gog-plus-more-price"))).toBe(false);
  });
});

describe("the query comes from the site's own server-side render when it can", () => {
  const stateKey = (page, extra = "") => `catalog.gog/v1/catalog?limit=48&order=desc%3Atrending${extra}&productType=in%3Agame%2Cpack&page=${page}&countryCode=IL&locale=en-US&currencyCode=USD`;
  function addState(slugs, page = 1) {
    const s = document.createElement("script");
    s.id = "gogcom-store-state";
    s.type = "application/json";
    s.textContent = JSON.stringify({ [stateKey(page)]: { status: 200, body: { pages: 9, products: slugs.map((slug) => ({ slug })) } } });
    document.body.appendChild(s);
  }

  it("reuses it — country, currency, product types — and asks for nothing extra to check it", async () => {
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([]);
    addState(TILES.map((t) => t.slug));
    mockCatalog({ 2: [product("next")] }, { totalPages: 9 });
    E().applyEndless();
    fireIO();
    await tick(5);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1); // no calibration request
    const u = new URL(globalThis.fetch.mock.calls[0][0]);
    expect(u.searchParams.get("page")).toBe("2");
    expect(u.searchParams.get("countryCode")).toBe("IL");
    expect(u.searchParams.get("currencyCode")).toBe("USD");
    expect(u.searchParams.get("productType")).toBe("in:game,pack");
    expect(slugs()).toEqual(["next"]);
  });

  it("continues from the page the render was for", async () => {
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([]);
    addState(TILES.map((t) => t.slug), 4);
    window.history.replaceState({}, "", "/en/games?order=desc:trending&page=4");
    mockCatalog({ 5: [product("p5")] }, { totalPages: 9 });
    E().applyEndless();
    fireIO();
    await tick(5);
    expect(new URL(globalThis.fetch.mock.calls[0][0]).searchParams.get("page")).toBe("5");
  });

  it("ignores it when it describes a different list than the one on screen (the site changed page since)", async () => {
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([{ name: "https://catalog.gog.com/v1/catalog?limit=48&order=asc%3Aprice&page=3&countryCode=IL" }]);
    addState(["x1", "x2", "x3", "x4", "x5"]); // the originally rendered list — not what is shown now
    mockCatalog({ 4: [product("later")] }, { totalPages: 9 });
    E().applyEndless();
    fireIO();
    await tick(5);
    const u = new URL(globalThis.fetch.mock.calls[0][0]);
    expect(u.searchParams.get("order")).toBe("asc:price"); // the page's latest own request wins
    expect(u.searchParams.get("page")).toBe("4");
  });
});
