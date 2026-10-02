import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

await import("../extension/content/gog-dom.js");

const Dom = window.GOGPlusGogDom;

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.title = "";
});

describe("slugFromHref / pageType", () => {
  it("reads the slug from locale-prefixed and bare game URLs", () => {
    expect(Dom.slugFromHref("/en/game/the_witcher_3_wild_hunt")).toBe("the_witcher_3_wild_hunt");
    expect(Dom.slugFromHref("https://www.gog.com/de/game/cyberpunk_2077?pp=1")).toBe("cyberpunk_2077");
    expect(Dom.slugFromHref("/game/x1")).toBe("x1");
  });

  it("returns null for non-game links and empty input", () => {
    expect(Dom.slugFromHref("/en/games")).toBeNull();
    expect(Dom.slugFromHref("")).toBeNull();
    expect(Dom.slugFromHref(null)).toBeNull();
  });

  it("classifies pages from the path alone, ignoring the locale prefix", () => {
    expect(Dom.pageType("/en")).toBe("home");
    expect(Dom.pageType("/")).toBe("home");
    expect(Dom.pageType("/en/games")).toBe("store");
    expect(Dom.pageType("/de/games?genre=rpg")).toBe("store");
    expect(Dom.pageType("/en/game/some_game")).toBe("game");
    expect(Dom.pageType("/en/account/wishlist")).toBe("wishlist");
    expect(Dom.pageType("/en/account/settings")).toBe("account");
    expect(Dom.pageType("/en/checkout")).toBe("cart");
    expect(Dom.pageType("/pt-br/promo/summer_sale_2026")).toBe("promo");
    expect(Dom.pageType("/en/something-else")).toBe("other");
  });

  it("does not mistake /games for a game page", () => {
    expect(Dom.pageType("/en/games")).not.toBe("game");
  });
});

describe("findCards", () => {
  it("finds game links and skips already-processed ones unless asked", () => {
    document.body.innerHTML = `
      <a href="/en/game/a"><img src="a.png"></a>
      <a href="/en/game/b" class="gog-plus-card-done"><img src="b.png"></a>
      <a href="/en/games">not a card</a>`;
    expect(Dom.findCards().map((a) => a.getAttribute("href"))).toEqual(["/en/game/a"]);
    expect(Dom.findCards(document, { includeProcessed: true })).toHaveLength(2);
  });
});

describe("cardCoverHost", () => {
  const rect = (w, h) => () => ({ width: w, height: h, top: 0, left: 0, right: w, bottom: h });

  it("returns the smallest cover-sized wrapper, never the card itself", () => {
    document.body.innerHTML = `
      <a href="/en/game/a" id="card"><div id="outer"><div id="cover"><img id="img" src="a.png"></div></div></a>`;
    const card = document.getElementById("card");
    card.getBoundingClientRect = rect(200, 300);
    document.getElementById("outer").getBoundingClientRect = rect(190, 295);
    document.getElementById("cover").getBoundingClientRect = rect(120, 160);
    expect(Dom.cardCoverHost(card).id).toBe("cover");
  });

  it("climbs past wrappers as big as the card", () => {
    document.body.innerHTML = `
      <a href="/en/game/a" id="card"><div id="mid"><div id="wrap"><img src="a.png"></div></div></a>`;
    const card = document.getElementById("card");
    card.getBoundingClientRect = rect(200, 300);
    document.getElementById("wrap").getBoundingClientRect = rect(200, 300);
    document.getElementById("mid").getBoundingClientRect = rect(100, 100);
    expect(Dom.cardCoverHost(card).id).toBe("mid");
  });

  it("accepts a cover that spans the card's full width but only part of its height (vertical tile)", () => {
    document.body.innerHTML = `
      <a href="/en/game/a" id="card"><div id="cover"><img src="a.png"></div><div id="info">title</div></a>`;
    const card = document.getElementById("card");
    card.getBoundingClientRect = rect(220, 175);
    document.getElementById("cover").getBoundingClientRect = rect(220, 124);
    expect(Dom.cardCoverHost(card).id).toBe("cover");
  });

  it("still rejects a wrapper that is nearly the whole card", () => {
    document.body.innerHTML = `
      <a href="/en/game/a" id="card"><div id="all"><img src="a.png"></div></a>`;
    const card = document.getElementById("card");
    card.getBoundingClientRect = rect(220, 175);
    document.getElementById("all").getBoundingClientRect = rect(220, 170); // ~97% of the card
    expect(Dom.cardCoverHost(card)).toBeNull();
  });

  it("returns null when the image is a direct child of the card or absent", () => {
    document.body.innerHTML = `<a href="/en/game/a" id="card"><img src="a.png"></a>`;
    expect(Dom.cardCoverHost(document.getElementById("card"))).toBeNull();
    document.body.innerHTML = `<a href="/en/game/b" id="card"><span>no image</span></a>`;
    expect(Dom.cardCoverHost(document.getElementById("card"))).toBeNull();
  });

  it("returns null when every ancestor up to the card is card-sized", () => {
    document.body.innerHTML = `<a href="/en/game/a" id="card"><div id="w"><img src="a.png"></div></a>`;
    const card = document.getElementById("card");
    card.getBoundingClientRect = rect(200, 300);
    document.getElementById("w").getBoundingClientRect = rect(200, 300);
    expect(Dom.cardCoverHost(card)).toBeNull();
  });
});

describe("findPriceNodes", () => {
  it("prefers class-name matches", () => {
    document.body.innerHTML = `<span class="product-price">$9.99</span>`;
    const r = Dom.findPriceNodes();
    expect(r.strategy).toBe("class");
    expect(r.nodes).toHaveLength(1);
  });

  it("falls back to data attributes when class names don't say 'price'", () => {
    document.body.innerHTML = `<span class="x1" data-testid="product-price">$9.99</span>`;
    const r = Dom.findPriceNodes();
    expect(r.strategy).toBe("attribute");
    expect(r.nodes).toHaveLength(1);
  });

  it("last resort: elements whose entire text is one price, symbol first or last", () => {
    document.body.innerHTML = `
      <div><span class="a">$19.99</span><span class="b">19,99 €</span><span class="c">£5</span>
      <p>from $5 to $60</p><p>3 kr of something much longer than a price</p></div>`;
    const r = Dom.findPriceNodes();
    expect(r.strategy).toBe("text-shape");
    expect(r.nodes.map((n) => n.textContent)).toEqual(["$19.99", "19,99 €", "£5"]);
  });

  it("finds a price split across child elements by its wrapper", () => {
    document.body.innerHTML = `<div><span class="wrap"><i>$</i><b>19.99</b></span></div>`;
    const r = Dom.findPriceNodes();
    expect(r.strategy).toBe("text-shape");
    expect(r.nodes.map((n) => n.className)).toEqual(["wrap"]);
  });

  it("still finds a text-shape price after the converter has appended its note to it", () => {
    document.body.innerHTML = `<div><span class="w"><i>$</i><b>19.99</b><span class="gog-plus-conv-note"> ≈ ₪80</span></span></div>`;
    const r = Dom.findPriceNodes();
    expect(r.strategy).toBe("text-shape");
    expect(r.nodes.map((n) => n.className)).toEqual(["w"]);
    // …and doesn't mutate the page while looking.
    expect(document.querySelector(".gog-plus-conv-note")).not.toBeNull();
  });

  it("never reports the extension's own injected UI as the site's prices", () => {
    document.body.innerHTML = `
      <aside id="gog-plus-gamepanel"><span class="gog-plus-compare-price">$9.99</span><b>$5.00</b></aside>
      <div id="gog-plus-banner"><span class="x-price">$1.00</span></div>`;
    expect(Dom.findPriceNodes()).toEqual({ nodes: [], strategy: "none" });

    // …while a real price next to them is still found.
    document.body.insertAdjacentHTML("beforeend", `<span class="real-price">$24.99</span>`);
    const r = Dom.findPriceNodes();
    expect(r.strategy).toBe("class");
    expect(r.nodes.map((n) => n.className)).toEqual(["real-price"]);
  });

  it("reports none when nothing looks like a price", () => {
    document.body.innerHTML = `<p>Hello world</p>`;
    expect(Dom.findPriceNodes()).toEqual({ nodes: [], strategy: "none" });
  });
});

describe("resolveGameTitle / gamePageAnchor", () => {
  it("uses the legacy title class when present", () => {
    document.body.innerHTML = `<h1>Site name</h1><h1 class="productcard-basics__title"> Real Game </h1>`;
    expect(Dom.resolveGameTitle()).toEqual({ value: "Real Game", strategy: "legacy-class" });
  });

  it("picks the h1 matching og:title when a header h1 comes first", () => {
    document.head.innerHTML = `<meta property="og:title" content="Cool Game on GOG.com">`;
    document.body.innerHTML = `<h1>GOG.COM</h1><h1>Cool Game</h1>`;
    expect(Dom.resolveGameTitle()).toEqual({ value: "Cool Game", strategy: "h1-matches-og" });
    expect(Dom.gamePageAnchor().el.textContent).toBe("Cool Game");
  });

  it("falls back to the first h1 when no og:title disambiguates", () => {
    document.body.innerHTML = `<h1>Only Heading</h1>`;
    expect(Dom.resolveGameTitle()).toEqual({ value: "Only Heading", strategy: "first-h1" });
  });

  it("falls back to og:title, then JSON-LD, then document.title when there is no h1", () => {
    document.head.innerHTML = `<meta property="og:title" content="From OG on GOG.com">`;
    expect(Dom.resolveGameTitle()).toEqual({ value: "From OG", strategy: "og:title" });

    document.head.innerHTML = `
      <script type="application/ld+json">{"@type":"Organization","name":"GOG.com"}</script>
      <script type="application/ld+json">not json</script>
      <script type="application/ld+json">[{"@type":["Thing","VideoGame"],"name":"From LD"}]</script>`;
    expect(Dom.resolveGameTitle()).toEqual({ value: "From LD", strategy: "json-ld" });

    document.head.innerHTML = "";
    document.title = "Doc Title - GOG.com";
    expect(Dom.resolveGameTitle()).toEqual({ value: "Doc Title", strategy: "document.title" });
  });

  it("reports none when there is nothing to read", () => {
    expect(Dom.resolveGameTitle()).toEqual({ value: null, strategy: "none" });
    expect(Dom.gameTitle()).toBeNull();
    expect(Dom.gamePageAnchor()).toBeNull();
  });

  it("anchors on <main> when there is no heading", () => {
    document.body.innerHTML = `<main>content</main>`;
    expect(Dom.gamePageAnchor().strategy).toBe("main");
  });

  it("hasProductContent is true once a heading, product class or main exists", () => {
    expect(Dom.hasProductContent()).toBe(false);
    document.body.innerHTML = `<main></main>`;
    expect(Dom.hasProductContent()).toBe(true);
  });
});

describe("app shell lookups", () => {
  it("spaRoot prefers main, then ng-view, then body", () => {
    expect(Dom.spaRoot()).toBe(document.body);
    document.body.innerHTML = `<div ng-view id="v"></div>`;
    expect(Dom.spaRoot().id).toBe("v");
    document.body.innerHTML = `<div ng-view></div><main id="m"></main>`;
    expect(Dom.spaRoot().id).toBe("m");
    document.body.innerHTML = `<div role="main" id="r"></div>`;
    expect(Dom.spaRoot().id).toBe("r");
  });

  it("wishlistRoot finds main or a wishlist-classed container", () => {
    expect(Dom.wishlistRoot()).toBeNull();
    document.body.innerHTML = `<div class="my-wishlist" id="w"></div>`;
    expect(Dom.wishlistRoot().id).toBe("w");
  });
});

describe("watchRoute", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState({}, "", "/");
  });

  it("fires when the URL changes without a reload, and stops when unsubscribed", () => {
    window.history.replaceState({}, "", "/en/games");
    const cb = vi.fn();
    const stop = Dom.watchRoute(cb, 500);

    vi.advanceTimersByTime(1000);
    expect(cb).not.toHaveBeenCalled();

    window.history.pushState({}, "", "/en/game/some_game");
    vi.advanceTimersByTime(600);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]).toContain("/en/game/some_game");
    expect(cb.mock.calls[0][1]).toContain("/en/games");

    window.history.pushState({}, "", "/en/games");
    stop();
    vi.advanceTimersByTime(2000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("also reacts to the Navigation API when the browser has one", () => {
    const listeners = {};
    window.navigation = {
      addEventListener: (type, fn) => (listeners[type] = fn),
      removeEventListener: vi.fn(),
    };
    const cb = vi.fn();
    const stop = Dom.watchRoute(cb, 60000);
    window.history.pushState({}, "", "/en/wishlist-ish");
    listeners.navigatesuccess();
    expect(cb).toHaveBeenCalledTimes(1);
    stop();
    expect(window.navigation.removeEventListener).toHaveBeenCalled();
    delete window.navigation;
  });
});

describe("diagnose", () => {
  afterEach(() => window.history.replaceState({}, "", "/"));

  it("reports what each lookup found on a healthy game page", () => {
    window.history.replaceState({}, "", "/en/game/cool_game?secret=1#frag");
    document.body.innerHTML = `
      <main><h1 class="productcard-basics__title">Cool Game</h1>
      <span class="product-price">$9.99</span></main>`;
    const d = Dom.diagnose();
    expect(d.pageType).toBe("game");
    expect(d.path).toBe("/en/game/cool_game");
    expect(JSON.stringify(d)).not.toContain("secret");
    expect(d.title).toEqual({ found: true, strategy: "legacy-class" });
    expect(d.prices.strategy).toBe("class");
    expect(d.prices.sample).toEqual(["$9.99"]);
    expect(d.observedRoot).toBe("main");
    expect(d.warnings).toEqual([]);
  });

  it("warns about missing cards on a store page and about text-shape-only prices", () => {
    window.history.replaceState({}, "", "/en/games");
    document.body.innerHTML = `<div><span>$9.99</span></div>`;
    const d = Dom.diagnose();
    expect(d.cards).toEqual({ total: 0, withImage: 0 });
    expect(d.warnings.join(" ")).toMatch(/No game cards/);
    expect(d.warnings.join(" ")).toMatch(/text shape/);
  });

  it("warns about each missing piece on a broken game page", () => {
    window.history.replaceState({}, "", "/en/game/cool_game");
    document.body.innerHTML = `<p>nothing useful</p>`;
    const w = Dom.diagnose().warnings.join(" ");
    expect(w).toMatch(/title could not be read/);
    expect(w).toMatch(/No place to mount/);
    expect(w).toMatch(/No price elements/);
  });

  it("includes framework hints and what the extension already applied", () => {
    window.history.replaceState({}, "", "/en/games");
    document.body.innerHTML = `
      <main ng-app id="app"><a href="/en/game/a" class="gog-plus-card-done"><img src="a.png"></a>
      <span class="gog-plus-converted"></span><aside id="gog-plus-gamepanel"></aside></main>`;
    const d = Dom.diagnose();
    expect(d.framework.angularJs).toBe(true);
    expect(d.framework.angular).toBe(false);
    expect(d.cards).toEqual({ total: 1, withImage: 1 });
    expect(d.applied).toEqual({ cards: 1, convertedPrices: 1, gamePanel: true });
  });
});
