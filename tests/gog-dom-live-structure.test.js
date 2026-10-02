import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Unit coverage for the lookups added after inspecting the real gog.com on
// 2026-10-02 (see the header comment in content/gog-dom.js for what was found).

await import("../extension/content/gog-dom.js");
await import("../extension/content/currency-detection.js");

const Dom = window.GOGPlusGogDom;

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.body.className = "";
  document.documentElement.className = "";
});

// happy-dom has no layout engine, so "is it on screen" has to be stated.
function stubLayout(el, { visible }) {
  el.checkVisibility = () => visible;
  el.getBoundingClientRect = () => ({ width: visible ? 100 : 0, height: visible ? 50 : 0, top: 0, left: 0, right: 0, bottom: 0 });
}

describe("isRendered", () => {
  it("can't tell without a layout engine, so everything counts as rendered", () => {
    document.body.innerHTML = `<main id="m"></main>`;
    expect(Dom.isRendered(document.getElementById("m"))).toBe(true);
  });

  it("is false for display:none (checkVisibility) and for zero-sized boxes", () => {
    document.body.innerHTML = `<main id="a"></main><main id="b"></main><main id="c"></main>`;
    const [a, b, c] = ["a", "b", "c"].map((id) => document.getElementById(id));
    stubLayout(a, { visible: false });
    stubLayout(b, { visible: true });
    c.checkVisibility = () => true;
    c.getBoundingClientRect = () => ({ width: 0, height: 0 });
    expect([Dom.isRendered(a), Dom.isRendered(b), Dom.isRendered(c)]).toEqual([false, true, false]);
  });
});

describe("spaRoot / wishlistRoot on a site with unreliable <main>s", () => {
  it("ignores a hidden <main> (the game page's patrons modal) and falls back to the body", () => {
    document.body.innerHTML = `<div style="display:none"><main id="modal"></main></div>`;
    stubLayout(document.getElementById("modal"), { visible: false });
    expect(Dom.spaRoot()).toBe(document.body);
  });

  it("with many visible <main>s (the home page's heroes) uses the app shell instead", () => {
    document.body.innerHTML = `<app-root id="shell"><main id="h1"></main><main id="h2"></main><main id="h3"></main></app-root>`;
    for (const id of ["h1", "h2", "h3"]) stubLayout(document.getElementById(id), { visible: true });
    expect(Dom.spaRoot().id).toBe("shell");
  });

  it("with exactly one visible <main> trusts it, even beside hidden ones", () => {
    document.body.innerHTML = `<app-root><main id="real"></main><main id="hidden"></main></app-root>`;
    stubLayout(document.getElementById("real"), { visible: true });
    stubLayout(document.getElementById("hidden"), { visible: false });
    expect(Dom.spaRoot().id).toBe("real");
  });

  it("uses <app-root> when there is no <main> at all (the catalog)", () => {
    document.body.innerHTML = `<app-root id="shell"><app-page></app-page></app-root>`;
    expect(Dom.spaRoot().id).toBe("shell");
  });

  it("wishlistRoot skips a hidden <main>", () => {
    document.body.innerHTML = `<main id="modal"></main><div class="account-wishlist" id="w"></div>`;
    stubLayout(document.getElementById("modal"), { visible: false });
    expect(Dom.wishlistRoot().id).toBe("w");
  });

  it("gamePageAnchor ignores a hidden <main> when there is no heading", () => {
    document.body.innerHTML = `<main id="modal"></main>`;
    stubLayout(document.getElementById("modal"), { visible: false });
    expect(Dom.gamePageAnchor()).toBeNull();
  });

  it("hasProductContent recognises the new app shell", () => {
    expect(Dom.hasProductContent()).toBe(false);
    document.body.innerHTML = `<app-root></app-root>`;
    expect(Dom.hasProductContent()).toBe(true);
  });
});

describe("findPriceNodes — the site's own hooks come first", () => {
  it("finds leaf price spans inside the new <price-value> component", () => {
    document.body.innerHTML = `<product-price><price-value><span class="base-value">$14.99</span><span class="final-value">$2.99</span></price-value></product-price>`;
    const r = Dom.findPriceNodes();
    expect(r.strategy).toBe("site-hooks");
    expect(r.nodes.map((n) => n.className)).toEqual(["base-value", "final-value"]);
  });

  it("finds the legacy game page's selenium hooks and amount classes", () => {
    document.body.innerHTML = `
      <span class="product-actions-price__base-amount _price" selenium-id="ProductBasePrice">14.99</span>
      <span class="product-actions-price__final-amount _price" selenium-id="ProductFinalPrice">2.99</span>`;
    const r = Dom.findPriceNodes();
    expect(r.strategy).toBe("site-hooks");
    expect(r.nodes).toHaveLength(2);
  });

  it("excludes the extension's own UI here too", () => {
    document.body.innerHTML = `<aside id="gog-plus-gamepanel"><span class="x__final-amount">$1</span></aside>`;
    expect(Dom.findPriceNodes().nodes).toEqual([]);
  });
});

describe("findFinalPrice / genreLabels", () => {
  it("returns the discounted price, not the struck-through base", () => {
    document.body.innerHTML = `
      <span class="product-actions-price__base-amount" selenium-id="ProductBasePrice">14.99</span>
      <span class="product-actions-price__final-amount" selenium-id="ProductFinalPrice">2.99</span>`;
    expect(Dom.findFinalPrice().textContent).toBe("2.99");
  });

  it("falls back to the amount class when the hook is missing, and to null", () => {
    document.body.innerHTML = `<span class="product-actions-price__final-amount">9.99</span>`;
    expect(Dom.findFinalPrice().textContent).toBe("9.99");
    document.body.innerHTML = "";
    expect(Dom.findFinalPrice()).toBeNull();
  });

  it("reads genre links from the site's genre hook, or null without it", () => {
    document.body.innerHTML = `<div selenium-id="ProductGenres"><span>Genre:</span><a href="/x">Role-playing</a> <a href="/y"> Adventure </a></div>`;
    expect(Dom.genreLabels()).toEqual(["Role-playing", "Adventure"]);
    document.body.innerHTML = "";
    expect(Dom.genreLabels()).toBeNull();
  });
});

describe("currencyHint", () => {
  it("reads the currency from the classes the site puts on <body> and <html>", () => {
    document.body.className = "productcard _prices-in-usd _price-currency-symbol-before";
    expect(Dom.currencyHint()).toBe("USD");
    document.body.className = "";
    document.documentElement.className = "native-mode prices-in-eur";
    expect(Dom.currencyHint()).toBe("EUR");
  });

  it("is null when the page doesn't say", () => {
    expect(Dom.currencyHint()).toBeNull();
    document.body.className = "prices-in-xyzzy";
    expect(Dom.currencyHint()).toBeNull();
  });
});

describe("displayText — putting back a symbol the site prints with CSS", () => {
  const priceEl = () => document.getElementById("p");
  let realGetComputedStyle;
  beforeEach(() => {
    realGetComputedStyle = window.getComputedStyle;
    delete window.GOGPlusCurrency?.__stub;
  });
  afterEach(() => {
    window.getComputedStyle = realGetComputedStyle;
  });

  function printWith({ before = "none", beforeDisplay = "inline", after = "none", afterDisplay = "none" }) {
    window.getComputedStyle = (el, pseudo) => {
      if (pseudo === "::before") return { content: before, display: beforeDisplay };
      if (pseudo === "::after") return { content: after, display: afterDisplay };
      return realGetComputedStyle.call(window, el);
    };
  }

  it("returns text that already carries a symbol untouched", () => {
    document.body.innerHTML = `<span id="p">$ 2.99</span>`;
    expect(Dom.displayText(priceEl())).toBe("$ 2.99");
  });

  it("prepends the ::before content (symbol-before layouts)", () => {
    document.body.innerHTML = `<span id="p">2.99</span>`;
    printWith({ before: '"$ "', after: '" $"', afterDisplay: "none" });
    expect(Dom.displayText(priceEl())).toBe("$ 2.99");
  });

  it("appends ::after instead when that is the one displayed (symbol-after layouts)", () => {
    document.body.innerHTML = `<span id="p">2,99</span>`;
    printWith({ before: '"€ "', beforeDisplay: "none", after: '" €"', afterDisplay: "inline" });
    expect(Dom.displayText(priceEl())).toBe("2,99 €");
  });

  it("ignores pseudo content of none/normal", () => {
    document.body.innerHTML = `<span id="p">2.99</span>`;
    printWith({ before: "none", after: "normal", afterDisplay: "inline" });
    expect(Dom.displayText(priceEl())).toBe("2.99");
  });

  it("falls back to the page's currency hint when CSS gave nothing", () => {
    document.body.className = "_prices-in-eur";
    document.body.insertAdjacentHTML("beforeend", `<span id="p">2.99</span>`);
    printWith({});
    expect(Dom.displayText(priceEl())).toBe("€2.99");
  });

  it("has nothing to add without CSS content or a hint", () => {
    document.body.innerHTML = `<span id="p">2.99</span>`;
    printWith({});
    expect(Dom.displayText(priceEl())).toBe("2.99");
  });

  it("does not count the extension's own conversion note as part of the price", () => {
    document.body.className = "_prices-in-usd";
    document.body.insertAdjacentHTML("beforeend", `<span id="p">2.99<span class="gog-plus-conv-note"> ≈ ₪12</span></span>`);
    printWith({});
    expect(Dom.displayText(priceEl())).toBe("$2.99");
  });

  it("leaves non-numeric text alone", () => {
    document.body.innerHTML = `<span id="p">Free</span>`;
    expect(Dom.displayText(priceEl())).toBe("Free");
  });
});

describe("readSystemRequirements", () => {
  const table = (rows, extra = "") => `
    <div class="system-requirements table ${extra}">
      ${rows
        .map(
          ([label, min, rec]) => `<div class="table__row">
            <div class="table__row-label system-requirements__label">${label}</div>
            <div class="system-requirements__minimum">${min}</div>
            ${rec ? `<div class="system-requirements__recommended">${rec}</div>` : ""}
          </div>`
        )
        .join("")}
    </div>`;

  it("reads both tiers, label → cell", () => {
    document.body.innerHTML = table([["System:", "Windows 7", "Windows 10"], ["Memory:", "4 GB RAM", "8 GB RAM"]]);
    expect(Dom.readSystemRequirements()).toEqual({
      minimum: { "System:": "Windows 7", "Memory:": "4 GB RAM" },
      recommended: { "System:": "Windows 10", "Memory:": "8 GB RAM" },
    });
  });

  it("handles a game with a minimum tier only", () => {
    document.body.innerHTML = table([["Memory:", "2 GB RAM"]]);
    expect(Dom.readSystemRequirements()).toEqual({ minimum: { "Memory:": "2 GB RAM" }, recommended: {} });
  });

  it("prefers the table that is actually shown over the hidden small-screen copy", () => {
    document.body.innerHTML =
      table([["Memory:", "99 GB RAM"]], "show-on-small-screens ng-hide") + table([["Memory:", "4 GB RAM"]]);
    const [hidden, shown] = document.querySelectorAll(".system-requirements");
    stubLayout(hidden, { visible: false });
    stubLayout(shown, { visible: true });
    expect(Dom.readSystemRequirements().minimum["Memory:"]).toBe("4 GB RAM");
  });

  it("skips rows without a label or any value, and is null when nothing is there", () => {
    document.body.innerHTML = `<div class="system-requirements"><div class="table__row"><div class="system-requirements__label"></div><div class="system-requirements__minimum">x</div></div></div>`;
    expect(Dom.readSystemRequirements()).toBeNull();
    document.body.innerHTML = "";
    expect(Dom.readSystemRequirements()).toBeNull();
    document.body.innerHTML = `<div class="system-requirements"><div class="table__row"><div class="system-requirements__label">Memory:</div></div></div>`;
    expect(Dom.readSystemRequirements()).toBeNull();
  });
});

describe("currency detection from the page's own declaration", () => {
  const { detect } = window.GOGPlusCurrency;
  let n = 0;
  const freshPath = () => window.history.replaceState({}, "", `/en/game/detect_${++n}`);

  it("uses the body class on a page whose prices carry no symbol at all", () => {
    freshPath();
    document.body.className = "productcard _prices-in-eur";
    document.body.innerHTML = `<span class="product-actions-price__final-amount">2,99</span>`;
    expect(detect()).toEqual({ code: "EUR", symbol: "€" });
  });

  it("prefers the declaration over symbols that happen to be on the page", () => {
    freshPath();
    document.body.className = "_prices-in-gbp";
    document.body.innerHTML = `<span class="price-text">$9.99</span>`;
    expect(detect().code).toBe("GBP");
  });

  it("falls back to counting symbols when nothing is declared", () => {
    freshPath();
    document.body.className = "";
    document.body.innerHTML = `<span class="price-text">€5</span><span class="price-text">€7</span>`;
    expect(detect().code).toBe("EUR");
  });

  it("ignores a declared currency it has no symbol for", () => {
    freshPath();
    document.body.className = "_prices-in-xyz";
    document.body.innerHTML = `<span class="price-text">£5</span>`;
    expect(detect().code).toBe("GBP");
  });
});
