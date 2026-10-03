import { describe, it, expect, beforeEach } from "vitest";
import { resetEnv, getLocal, state } from "./helpers/content-env.js";
import { gamePageHtml, gridHtml, wishlistPageHtml } from "./helpers/fixtures.js";

const K = () => window.GOGPlusKnowledge;
const NOW = Date.parse("2026-10-02T12:00:00Z");

describe("learnOwnership", () => {
  beforeEach(() => resetEnv({ path: "/en/games" }));

  it("learns owned games from the 'IN LIBRARY' label on catalog tiles", async () => {
    document.body.innerHTML = gridHtml([{ slug: "a", owned: true }, { slug: "b" }, { slug: "c", owned: true }]);
    await K().learnOwnership();
    expect(Object.keys(state.settings.ownedSlugs).sort()).toEqual(["a", "c"]);
    expect(Object.keys((await getLocal("ownedSlugs")).ownedSlugs).sort()).toEqual(["a", "c"]);
    expect(state.settings.ownedSlugs.a).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("never un-learns from a tile (a tile can't prove a game isn't owned)", async () => {
    state.settings.ownedSlugs = { a: "2026-01-01" };
    document.body.innerHTML = gridHtml([{ slug: "a" }]);
    await K().learnOwnership();
    expect(state.settings.ownedSlugs).toEqual({ a: "2026-01-01" });
  });

  it("does not write when nothing is new", async () => {
    state.settings.ownedSlugs = { a: "2026-01-01" };
    document.body.innerHTML = gridHtml([{ slug: "a", owned: true }]);
    await K().learnOwnership();
    expect(await getLocal("ownedSlugs")).toEqual({});
  });

  it("learns from owned wishlist rows", async () => {
    window.history.replaceState({}, "", "/en/account/wishlist");
    document.body.innerHTML = wishlistPageHtml([{ slug: "w1", owned: true }, { slug: "w2", price: "5.00" }]);
    await K().learnOwnership();
    expect(Object.keys(state.settings.ownedSlugs)).toEqual(["w1"]);
  });

  it("does nothing when ownership learning is off", async () => {
    state.settings.ownershipLearning = false;
    document.body.innerHTML = gridHtml([{ slug: "a", owned: true }]);
    await K().learnOwnership();
    expect(state.settings.ownedSlugs).toEqual({});
  });

  it("learns from a game page, and un-learns a refunded game only while logged in", async () => {
    window.history.replaceState({}, "", "/en/game/the_witcher_3");
    document.body.className = "productcard user-logged-in";
    document.body.innerHTML = gamePageHtml({ owned: true });
    await K().learnOwnership();
    expect(state.settings.ownedSlugs.the_witcher_3).toBeTruthy();

    document.body.innerHTML = gamePageHtml({ owned: false });
    await K().learnOwnership();
    expect(state.settings.ownedSlugs.the_witcher_3).toBeUndefined();

    // Logged out: the page proves nothing, so nothing is removed.
    state.settings.ownedSlugs = { the_witcher_3: "2026-01-01" };
    document.body.className = "productcard";
    await K().learnOwnership();
    expect(state.settings.ownedSlugs.the_witcher_3).toBe("2026-01-01");
  });
});

describe("recordGameFacts", () => {
  beforeEach(() => {
    resetEnv({ path: "/en/game/the_witcher_3", bodyClass: "productcard _prices-in-usd user-logged-in" });
    K()._internals.writeLog.length = 0;
  });

  it("does not see a record as changed just because its keys come back in another order (chrome.storage sorts them)", async () => {
    document.body.innerHTML = gamePageHtml();
    await K().recordGameFacts("the_witcher_3", NOW);
    const sorted = (o) => (Array.isArray(o) ? o.map(sorted) : o && typeof o === "object" ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, sorted(o[k])])) : o);
    // exactly what chrome.storage returns: same data, alphabetical keys
    state.settings.gameFacts = { the_witcher_3: sorted(state.settings.gameFacts.the_witcher_3) };
    globalThis.__resetChromeStores();
    await K().recordGameFacts("the_witcher_3", NOW + 1000);
    expect(await getLocal("gameFacts")).toEqual({}); // nothing rewritten
    expect(K()._internals.canonical({ b: 1, a: [{ d: 1, c: undefined }] })).toBe('{"a":[{"d":1}],"b":1}');
    expect(K()._internals.canonical(undefined)).toBe("null");
  });

  it("never writes more than a handful of times a minute, whatever it believes has changed", async () => {
    let writes = 0;
    for (let i = 0; i < 12; i++) {
      document.body.innerHTML = gamePageHtml({ final: `${10 + i}.00` });
      globalThis.__resetChromeStores();
      await K().recordGameFacts("the_witcher_3", NOW + i * 1000);
      if (Object.keys(await getLocal("gameFacts")).length) writes++;
    }
    expect(writes).toBe(K()._internals.MAX_WRITES_PER_MINUTE);
    // a minute later it may write again
    document.body.innerHTML = gamePageHtml({ final: "99.00" });
    globalThis.__resetChromeStores();
    await K().recordGameFacts("the_witcher_3", NOW + 5 * 60 * 1000);
    expect(Object.keys(await getLocal("gameFacts"))).toEqual(["gameFacts"]);
  });

  it("stores what the page says about the game", async () => {
    document.body.innerHTML = gamePageHtml();
    await K().recordGameFacts("the_witcher_3", NOW);
    const f = state.settings.gameFacts.the_witcher_3;
    expect(f).toMatchObject({
      t: NOW,
      title: "The Witcher 3: Wild Hunt",
      rating: { score: 4.8, count: 2848 },
      criticsPct: 95,
      year: 2015,
      price: { p: 24.99, b: 49.99, l: 24.99, c: "USD" },
    });
    expect(f.langs).toEqual({ English: { a: true, t: true } });
    expect(f.hours.Main).toBe("108 h");
    expect(f.tags).toEqual(["Adventure", "Fantasy", "Story Rich"]);
    expect(f.pe).toContain("2026-10-07");
    expect((await getLocal("gameFacts")).gameFacts.the_witcher_3.title).toBe("The Witcher 3: Wild Hunt");
  });

  it("does not rewrite an unchanged record within the same visit", async () => {
    document.body.innerHTML = gamePageHtml();
    await K().recordGameFacts("the_witcher_3", NOW);
    globalThis.__resetChromeStores();
    await K().recordGameFacts("the_witcher_3", NOW + 60 * 1000);
    expect(await getLocal("gameFacts")).toEqual({});
  });

  it("moves the previous snapshot into `prev` on a new visit", async () => {
    document.body.innerHTML = gamePageHtml({ final: "24.99", reviewCount: 2800 });
    await K().recordGameFacts("the_witcher_3", NOW);
    document.body.innerHTML = gamePageHtml({ final: "19.99", reviewCount: 2810, rating: "4.7/5" });
    await K().recordGameFacts("the_witcher_3", NOW + 2 * 3600e3);
    const f = state.settings.gameFacts.the_witcher_3;
    expect(f.price.p).toBe(19.99);
    expect(f.prev).toMatchObject({ t: NOW, price: { p: 24.99 }, rating: { score: 4.8, count: 2800 } });
    expect(K().changesSince(f)).toEqual(["Price dropped from 24.99 to 19.99 USD", "Rating down 0.1 to 4.7", "10 new reviews"]);
  });

  it("keeps the earlier `prev` while changes land inside one visit", async () => {
    document.body.innerHTML = gamePageHtml({ final: "24.99" });
    await K().recordGameFacts("the_witcher_3", NOW);
    document.body.innerHTML = gamePageHtml({ final: "20.00" });
    await K().recordGameFacts("the_witcher_3", NOW + 3600e3);
    document.body.innerHTML = gamePageHtml({ final: "19.00" });
    await K().recordGameFacts("the_witcher_3", NOW + 3600e3 + 5 * 60e3);
    const f = state.settings.gameFacts.the_witcher_3;
    expect(f.price.p).toBe(19);
    expect(f.prev.price.p).toBe(24.99);
  });

  it("keeps earlier languages and tags when the page hasn't rendered them yet", async () => {
    document.body.innerHTML = gamePageHtml();
    await K().recordGameFacts("the_witcher_3", NOW);
    document.body.innerHTML = '<h1 class="productcard-basics__title">The Witcher 3: Wild Hunt</h1><span selenium-id="ProductFinalPrice">24.99</span>';
    await K().recordGameFacts("the_witcher_3", NOW + 3600e3);
    const f = state.settings.gameFacts.the_witcher_3;
    expect(f.langs.English).toEqual({ a: true, t: true });
    expect(f.tags).toHaveLength(3);
    expect(f.pe).toBeNull(); // no offer on the page now → the end date is NOT carried over
  });

  it("records nothing for an empty page or without a slug", async () => {
    document.body.innerHTML = "<p>nope</p>";
    await K().recordGameFacts("the_witcher_3", NOW);
    await K().recordGameFacts("", NOW);
    expect(state.settings.gameFacts).toEqual({});
  });

  it("caps the cache, evicting the least recently updated games", async () => {
    const big = {};
    for (let i = 0; i < K()._internals.MAX_FACTS; i++) big[`g${i}`] = { t: 1000 + i };
    state.settings.gameFacts = big;
    document.body.innerHTML = gamePageHtml();
    await K().recordGameFacts("the_witcher_3", NOW);
    const keys = Object.keys(state.settings.gameFacts);
    expect(keys).toHaveLength(K()._internals.MAX_FACTS);
    expect(keys).toContain("the_witcher_3");
    expect(keys).not.toContain("g0");
  });
});

describe("changesSince", () => {
  const prev = { t: 1, price: { p: 20, b: null, l: null, c: "USD" }, rating: { score: 4.5, count: 100 }, criticsPct: 80 };
  it("is empty without a previous visit", () => {
    expect(K().changesSince(undefined)).toEqual([]);
    expect(K().changesSince({ price: {} })).toEqual([]);
  });
  it("reports discounts starting and ending, rising prices, critics' score", () => {
    const now = { price: { p: 25, b: 40, l: null, c: "USD" }, rating: { score: 4.6, count: 101 }, criticsPct: 90 };
    expect(K().changesSince({ ...now, prev })).toEqual([
      "Price rose from 20.00 to 25.00 USD",
      "A discount started",
      "Rating up 0.1 to 4.6",
      "1 new review",
      "Critics' score up to 90%",
    ]);
    const ended = { ...now, price: { p: 20, b: null, l: null, c: "USD" }, rating: prev.rating, criticsPct: 80 };
    expect(K().changesSince({ ...ended, prev: { ...prev, price: { p: 20, b: 40, l: null, c: "USD" } } })).toEqual(["The discount ended"]);
  });
  it("ignores price changes across currencies and unchanged data", () => {
    expect(K().changesSince({ ...prev, price: { p: 5, b: null, l: null, c: "EUR" }, prev })).toEqual([]);
    expect(K().changesSince({ ...prev, prev })).toEqual([]);
  });
});

describe("setNotInterested", () => {
  beforeEach(() => resetEnv({}));
  it("hides, restores and toggles a game", async () => {
    expect(await K().setNotInterested("a", true)).toBe(true);
    expect(state.settings.notInterested.a).toMatch(/^\d{4}-/);
    expect((await getLocal("notInterested")).notInterested.a).toBeTruthy();
    expect(await K().setNotInterested("a", true)).toBe(true); // no-op
    expect(await K().setNotInterested("a")).toBe(false); // toggle off
    expect(state.settings.notInterested).toEqual({});
    expect(await K().setNotInterested("a")).toBe(true); // toggle on
  });
});
