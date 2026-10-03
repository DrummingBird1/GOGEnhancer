import { describe, it, expect, beforeEach } from "vitest";
import { resetEnv } from "./helpers/content-env.js";
import { gamePageHtml, gridHtml, wishlistPageHtml, tileHtml } from "./helpers/fixtures.js";

const G = () => window.GOGPlusGogDom;

describe("numbers and prices", () => {
  beforeEach(() => resetEnv({ path: "/en/game/x", bodyClass: "productcard _prices-in-usd user-logged-in" }));

  it("reads a number out of text with or without a symbol", () => {
    expect(G().numberFromText("$24.99", "USD")).toBe(24.99);
    expect(G().numberFromText("19,99 €", "EUR")).toBe(19.99);
    expect(G().numberFromText("2.99")).toBe(2.99);
    expect(G().numberFromText("2,99")).toBe(2.99);
    expect(G().numberFromText("1,299")).toBe(1299);
    expect(G().numberFromText("n/a")).toBeNull();
    expect(G().numberFromText("")).toBeNull();
  });

  it("reads a price element as displayed, taking the currency from its symbol", () => {
    document.body.innerHTML = '<span id="p">€4.99</span><span id="q">2.99</span><span id="r">R$ 20,00</span>';
    expect(G().priceOf(document.getElementById("p"), "USD")).toEqual({ value: 4.99, currency: "EUR" });
    // a bare number has no symbol in the text → the page hint (set below) decides
    expect(G().priceOf(document.getElementById("q"), "USD")).toEqual({ value: 2.99, currency: "USD" });
    expect(G().priceOf(document.getElementById("r"), "USD").currency).toBe("BRL");
    expect(G().priceOf(null, "USD")).toBeNull();
    document.body.innerHTML = "<span id='z'>free</span>";
    expect(G().priceOf(document.getElementById("z"), "USD")).toBeNull();
  });
});

describe("game page", () => {
  beforeEach(() => resetEnv({ path: "/en/game/the_witcher_3", bodyClass: "productcard _prices-in-usd user-logged-in" }));

  it("reads the three prices in the page's currency", () => {
    document.body.innerHTML = gamePageHtml();
    expect(G().readGamePrices()).toEqual({ final: 24.99, base: 49.99, lowest30: 24.99, currency: "USD" });
  });

  it("has no base price when nothing is discounted and no 30-day figure when the page lacks it", () => {
    document.body.innerHTML = gamePageHtml({ base: null, lowest: null });
    expect(G().readGamePrices()).toMatchObject({ final: 24.99, base: null, lowest30: null });
  });

  it("reads the 30-day low from its text when the inner price element is missing", () => {
    document.body.innerHTML = gamePageHtml({ lowest: null }) + '<div selenium-id="LowestPriceBeforeDiscount">Lowest price in the last 30 days before discount: 19.99</div>';
    expect(G().readGamePrices().lowest30).toBe(19.99);
  });

  it("reports the offer end from the machine-readable timer attribute only", () => {
    document.body.innerHTML = gamePageHtml();
    expect(G().promoEndRaw()).toBe("2026-10-07 09:59:59.000000+03:00");
    document.body.innerHTML = gamePageHtml({ promo: null });
    expect(G().promoEndRaw()).toBeNull();
  });

  it("reads languages with audio / text support", () => {
    document.body.innerHTML = gamePageHtml({ languages: [["English", true, true], ["Hebrew", false, true], ["Polish", false, false]] });
    expect(G().readLanguages()).toEqual({
      English: { audio: true, text: true },
      Hebrew: { audio: false, text: true },
      Polish: { audio: false, text: false },
    });
    document.body.innerHTML = "<p>nothing</p>";
    expect(G().readLanguages()).toBeNull();
  });

  it("reads the rating, critics' score, time to beat, tags and release year", () => {
    document.body.innerHTML = gamePageHtml();
    expect(G().readRating()).toEqual({ score: 4.8, count: 2848 });
    expect(G().readCriticsPct()).toBe(95);
    expect(G().readTimeToBeat()).toEqual({ Main: "108 h", "Main + Sides": "154.5 h", Completionist: "213.5 h" });
    expect(G().readProductTags()).toEqual(["Adventure", "Fantasy", "Story Rich"]);
    expect(G().readReleaseYear()).toBe(2015);
  });

  it("returns nulls and empties for what the page lacks", () => {
    document.body.innerHTML = "<h1>x</h1>";
    expect(G().readRating()).toBeNull();
    expect(G().readCriticsPct()).toBeNull();
    expect(G().readTimeToBeat()).toBeNull();
    expect(G().readProductTags()).toEqual([]);
    expect(G().readReleaseYear()).toBeNull();
  });

  it("ignores malformed JSON-LD", () => {
    document.body.innerHTML = '<script type="application/ld+json">{nope</script><script type="application/ld+json">[{"releaseDate":"1998-11-01"}]</script>';
    expect(G().readReleaseYear()).toBe(1998);
  });

  it("detects ownership from the library label, and 'not owned' only when logged in", () => {
    document.body.innerHTML = gamePageHtml({ owned: true });
    expect(G().isGameOwned()).toBe(true);
    document.body.innerHTML = gamePageHtml();
    expect(G().isGameOwned()).toBe(false);
    document.body.className = "productcard";
    expect(G().isGameOwned()).toBeNull();
    document.body.innerHTML = '<button class="go-to-library-button">Go to my library</button>';
    expect(G().isGameOwned()).toBe(true);
  });

  it("gathers everything for the facts cache", () => {
    document.body.innerHTML = gamePageHtml({ owned: true });
    const f = G().readGameFacts();
    expect(f).toMatchObject({ title: "The Witcher 3: Wild Hunt", owned: true, releaseYear: 2015, criticsPct: 95 });
    expect(f.languages.English).toEqual({ audio: true, text: true });
    expect(f.promoEnd).toContain("2026-10-07");
  });
});

describe("bundles", () => {
  beforeEach(() => resetEnv({ path: "/en/game/pack" }));
  it("finds the games a pack says it includes, never the current one", () => {
    document.body.innerHTML = `<section><h3>This pack includes</h3><a href="/en/game/one">One</a><a href="/en/game/two">Two</a><a href="/en/game/pack">Pack</a></section>
      <section><h3>You may also like</h3><a href="/en/game/other">Other</a></section>`;
    expect(G().bundleSlugs("pack")).toEqual(["one", "two"]);
  });
  it("returns nothing without an 'includes' section or with no links in it", () => {
    document.body.innerHTML = '<section><h3>Reviews</h3><a href="/en/game/x">x</a></section>';
    expect(G().bundleSlugs()).toEqual([]);
    document.body.innerHTML = "<section><h3>Includes</h3><p>nothing</p></section>";
    expect(G().bundleSlugs()).toEqual([]);
  });
});

describe("reviews", () => {
  beforeEach(() => resetEnv({ path: "/en/game/x" }));
  it("reads star counts and verified-owner flags, and where to mount a filter", () => {
    document.body.innerHTML = gamePageHtml({ reviews: [{ stars: 5, verified: true }, { stars: 2, verified: false }] });
    const r = G().readReviews();
    expect(r.map((x) => [x.stars, x.verified])).toEqual([[5, true], [2, false]]);
    expect(G().reviewsMount()).toBe(document.querySelector(".reviews__main-col"));
  });
  it("is empty without reviews", () => {
    document.body.innerHTML = gamePageHtml();
    expect(G().readReviews()).toEqual([]);
    expect(G().reviewsMount()).toBeNull();
  });
});

describe("catalog tiles", () => {
  beforeEach(() => resetEnv({ path: "/en/games" }));

  it("finds tiles, their grid items and the grid", () => {
    document.body.innerHTML = gridHtml([{ slug: "a" }, { slug: "b", owned: true }]);
    const tiles = G().catalogTiles();
    expect(tiles.map((t) => t.slug)).toEqual(["a", "b"]);
    expect(tiles[0].el.tagName).toBe("PRODUCT-TILE");
    expect(G().catalogGrid()).toBe(document.querySelector(".paginated-products-grid"));
  });

  it("falls back to the tiles' parent when the grid class is absent, and to null without tiles", () => {
    document.body.innerHTML = `<div id="g">${tileHtml({ slug: "a" })}</div>`;
    expect(G().catalogGrid()).toBe(document.getElementById("g"));
    document.body.innerHTML = "";
    expect(G().catalogGrid()).toBeNull();
  });

  it("never mistakes the header menu's tiles for catalog tiles", () => {
    document.body.innerHTML = `<header><product-tile><a class="product-tile" href="/en/game/menu">m</a></product-tile></header>${gridHtml([{ slug: "a" }])}`;
    expect(G().catalogTiles().map((t) => t.slug)).toEqual(["a"]);
  });

  it("reads a tile's title, discount, prices and ownership", () => {
    document.body.innerHTML = gridHtml([{ slug: "a", title: "Alpha", discount: 75, price: "$5.00", base: "$20.00", owned: true }]);
    const t = G().catalogTiles()[0];
    expect(G().readTile(t)).toEqual({ slug: "a", title: "Alpha", discountPct: 75, price: 5, basePrice: 20, currency: "USD", owned: true });
  });

  it("reads a tile with no discount or price", () => {
    document.body.innerHTML = `<product-tile><a class="product-tile" href="/en/game/z"><img src="x"></a></product-tile>`;
    expect(G().readTile(G().catalogTiles()[0])).toMatchObject({ slug: "z", discountPct: 0, price: null, basePrice: null, owned: false });
  });
});

describe("wishlist rows", () => {
  beforeEach(() => resetEnv({ path: "/en/account/wishlist" }));

  it("finds only real rows, never the header menu's wishlist tiles", () => {
    document.body.innerHTML = wishlistPageHtml([{ slug: "a", price: "14.99" }, { slug: "b", owned: true }]);
    expect(G().wishlistRows()).toHaveLength(2);
    expect(G().wishlistList()).toBe(document.querySelector(".list-inner"));
  });

  it("reads price, discount and state flags", () => {
    document.body.innerHTML = wishlistPageHtml([
      { slug: "a", title: "Alpha", price: "14.99", discount: 25 },
      { slug: "b", owned: true },
      { slug: "c", tba: true },
      { slug: "d", free: true },
    ]);
    const rows = G().wishlistRows().map((r) => G().readWishlistRow(r));
    expect(rows[0]).toMatchObject({ slug: "a", title: "Alpha", price: 14.99, discountPct: 25, owned: false, tba: false, free: false, currency: "USD", release: "2026" });
    expect(rows[1]).toMatchObject({ slug: "b", price: null, owned: true });
    expect(rows[2]).toMatchObject({ tba: true, price: null });
    expect(rows[3]).toMatchObject({ free: true });
    expect(rows[0].el.classList.contains("product-row-wrapper")).toBe(true);
  });

  it("has no list without rows", () => {
    document.body.innerHTML = "<p>empty</p>";
    expect(G().wishlistRows()).toEqual([]);
    expect(G().wishlistList()).toBeNull();
  });
});

describe("home sale banner", () => {
  beforeEach(() => resetEnv({ path: "/en" }));
  it("recognises store-wide sale headlines", () => {
    document.body.innerHTML = "<h2>8000+ deals up to -95%</h2>";
    expect(G().homeSaleBanner()).toBe("8000+ deals up to -95%");
    document.body.innerHTML = '<div class="hero"><span>Autumn Sale</span></div>';
    expect(G().homeSaleBanner()).toBe("Autumn Sale");
  });
  it("ignores ordinary headings and over-long text", () => {
    document.body.innerHTML = `<h2>New releases</h2><h2>${"Summer sale ".repeat(20)}</h2>`;
    expect(G().homeSaleBanner()).toBeNull();
  });
});

describe("login", () => {
  it("reads the logged-in class from <body>", () => {
    resetEnv({ bodyClass: "user-logged-in" });
    expect(G().isLoggedIn()).toBe(true);
    resetEnv({});
    expect(G().isLoggedIn()).toBe(false);
  });
});

describe("tile titles", () => {
  beforeEach(() => resetEnv({ path: "/en/games" }));
  it("do not include the labels that share the title wrapper (found on the live catalog)", () => {
    document.body.innerHTML = `<product-tile><a class="product-tile" href="/en/game/hom3">
      <div class="product-tile__title" id="productTileGameTitle"><product-label class="product-tile__release-label--list"><div class="product-label product-label--owned"><span class="product-label__text">IN LIBRARY</span></div></product-label>
      <product-title><span>Heroes of Might and Magic 3</span></product-title></div></a></product-tile>`;
    expect(G().readTile(G().catalogTiles()[0]).title).toBe("Heroes of Might and Magic 3");
  });
  it("fall back to the wrapper when there is no <product-title>", () => {
    document.body.innerHTML = `<product-tile><a class="product-tile" href="/en/game/x"><div id="productTileGameTitle">Plain Title</div></a></product-tile>`;
    expect(G().readTile(G().catalogTiles()[0]).title).toBe("Plain Title");
  });
});
