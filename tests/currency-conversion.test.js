import { describe, it, expect, beforeEach } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/dom-safety.js");
await import("../extension/lib/currency-format.js");
await import("../extension/content/gog-dom.js");
await import("../extension/content/currency-detection.js");
await import("../extension/content/state.js");
await import("../extension/content/utils.js");
await import("../extension/content/features/currency.js");

const state = window.GOGPlusContentState;
const { applyCurrencyConversion } = window.GOGPlusCurrencyFeature;
const { parsePrice } = window.GOGPlusCurrency;

function setup(code, symbol) {
  state.settings = {
    ...window.GOG_PLUS_DEFAULTS,
    currencyConverter: true,
    taxEstimator: false,
    richTooltips: false,
    targetCurrency: "ILS",
    rates: { ILS: 4, EUR: 0.5, GBP: 0.8, PLN: 4 },
  };
  state.pageCurrency = { code, symbol };
}

const notes = () => document.querySelectorAll(".gog-plus-conv-note");

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("parsePrice — symbol position", () => {
  it("still reads symbol-first prices", () => {
    expect(parsePrice("$19.99", "USD")).toBe(19.99);
    expect(parsePrice("€ 5,50", "EUR")).toBe(5.5);
  });

  it("reads symbol-last prices (19,99 €)", () => {
    expect(parsePrice("19,99 €", "EUR")).toBe(19.99);
    expect(parsePrice("19,99€", "EUR")).toBe(19.99);
    expect(parsePrice("19.99$", "USD")).toBe(19.99);
    expect(parsePrice("49,90 zł", "PLN")).toBe(49.9);
  });

  it("tries every known symbol when no currency is given", () => {
    expect(parsePrice("12,50 €")).toBe(12.5);
  });

  it("returns null when there is no price", () => {
    expect(parsePrice("free")).toBeNull();
    expect(parsePrice("")).toBeNull();
  });
});

describe("applyCurrencyConversion", () => {
  it("converts a symbol-first price in one text node", () => {
    setup("USD", "$");
    document.body.innerHTML = `<span class="price">$10.00</span>`;
    applyCurrencyConversion();
    expect(notes()).toHaveLength(1);
    expect(notes()[0].textContent).toContain("40");
  });

  it("converts a symbol-last price (European format)", () => {
    setup("EUR", "€");
    document.body.innerHTML = `<span class="price">10,00€</span>`;
    applyCurrencyConversion();
    expect(notes()).toHaveLength(1);
    expect(notes()[0].textContent).toContain("80");
  });

  it("converts a price split across child elements, exactly once even on re-runs", () => {
    setup("USD", "$");
    document.body.innerHTML = `<span class="price"><i>$</i><b>10.00</b></span>`;
    applyCurrencyConversion();
    applyCurrencyConversion();
    expect(notes()).toHaveLength(1);
    expect(document.querySelector(".price").classList.contains("gog-plus-converted")).toBe(true);
  });

  it("converts a split price found only by its text shape (no price-ish class)", () => {
    setup("USD", "$");
    document.body.innerHTML = `<div><span class="w"><i>$</i><b>10.00</b></span></div>`;
    applyCurrencyConversion();
    expect(notes()).toHaveLength(1);
    expect(document.querySelector(".w .gog-plus-conv-note")).not.toBeNull();
  });

  it("does not convert a nested price twice", () => {
    setup("USD", "$");
    document.body.innerHTML = `<div class="price"><span>$10.00</span></div>`;
    applyCurrencyConversion();
    expect(notes()).toHaveLength(1);
  });

  it("does not treat a price range as one price in the whole-element pass", () => {
    setup("USD", "$");
    // The text-node pass reads the first number ($0 → free → skipped); the
    // whole-element pass must not then convert "$0 – $60" as a single price.
    document.body.innerHTML = `<div class="price-filter">$0 – $60</div>`;
    applyCurrencyConversion();
    expect(notes()).toHaveLength(0);
  });

  it("converts a bare-number price (symbol printed by CSS) using the page's currency declaration", () => {
    setup("USD", "$");
    document.body.className = "productcard _prices-in-usd";
    document.body.innerHTML = `<span class="product-actions-price__final-amount _price" selenium-id="ProductFinalPrice">2.99</span>`;
    applyCurrencyConversion();
    expect(notes()).toHaveLength(1);
    expect(notes()[0].textContent).toContain("12"); // 2.99 USD x 4
    expect(document.querySelector(".product-actions-price__final-amount").classList.contains("gog-plus-converted")).toBe(true);
    document.body.className = "";
  });

  it("converts base and final bare prices once each, and not twice on a re-run", () => {
    setup("USD", "$");
    document.body.className = "_prices-in-usd";
    document.body.innerHTML = `
      <span class="product-actions-price__base-amount" selenium-id="ProductBasePrice">14.99</span>
      <span class="product-actions-price__final-amount" selenium-id="ProductFinalPrice">2.99</span>`;
    applyCurrencyConversion();
    applyCurrencyConversion();
    expect(notes()).toHaveLength(2);
    document.body.className = "";
  });

  it("leaves a bare number alone when the page never says which currency it is", () => {
    setup("USD", "$");
    document.body.className = "";
    document.body.innerHTML = `<span class="product-actions-price__final-amount">2.99</span>`;
    applyCurrencyConversion();
    expect(notes()).toHaveLength(0);
  });

  it("does nothing when the page is already in the target currency", () => {
    setup("ILS", "₪");
    document.body.innerHTML = `<span class="price">₪40</span>`;
    applyCurrencyConversion();
    expect(notes()).toHaveLength(0);
  });
});

describe("a price the site changes in place", () => {
  it("gets a new note for the new price instead of keeping the old one", () => {
    setup("USD", "$");
    document.body.innerHTML = '<span id="p">$10.00</span>';
    applyCurrencyConversion(document.body);
    expect(document.querySelector("#p .gog-plus-conv-note").textContent).toContain("40");
    // the site rewrites the price text in place
    document.getElementById("p").firstChild.nodeValue = "$5.00";
    applyCurrencyConversion(document.body);
    const all = document.querySelectorAll("#p .gog-plus-conv-note");
    expect(all).toHaveLength(1);
    expect(all[0].textContent).toContain("20");
  });

  it("leaves a price that has not changed alone", () => {
    setup("USD", "$");
    document.body.innerHTML = '<span id="p">$10.00</span>';
    applyCurrencyConversion(document.body);
    const first = document.querySelector("#p .gog-plus-conv-note");
    applyCurrencyConversion(document.body);
    expect(document.querySelector("#p .gog-plus-conv-note")).toBe(first);
  });
});

describe("the newer store currencies", () => {
  it("have symbols and default rates, and are formatted with two decimals", () => {
    const F = window.GOGPlusCurrencyFormat;
    expect(F.symbolFor("BRL")).toBe("R$");
    expect(F.symbolFor("AUD")).toBe("A$");
    expect(F.symbolFor("CAD")).toBe("C$");
    expect(F.formatPrice(12.5, "BRL")).toBe("R$12.50");
    for (const c of ["BRL", "AUD", "CAD"]) expect(window.GOG_PLUS_DEFAULTS.rates[c]).toBeGreaterThan(0);
  });

  it("convert a Brazilian-real page to the target currency", () => {
    setup("BRL", "R$");
    state.settings.rates = { ...state.settings.rates, BRL: 5 };
    document.body.innerHTML = '<span id="p">R$ 129,90</span>';
    applyCurrencyConversion(document.body);
    expect(document.querySelector("#p .gog-plus-conv-note").textContent).toContain("104");
  });
});

describe("the currency table and the stores GOG prints", () => {
  const C = window.GOG_PLUS_CURRENCIES;

  it("is one consistent table: unique codes, a default rate for each, the rest derived from it", () => {
    const codes = C.TABLE.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain("USD");
    expect(C.RATE_CODES).toEqual(codes.filter((c) => c !== "USD"));
    for (const c of C.RATE_CODES) expect(window.GOG_PLUS_DEFAULTS.rates[c], c).toBeGreaterThan(0);
    for (const c of C.TABLE) expect(c.symbol.length).toBeGreaterThan(0);
  });

  it("reads the forms GOG really prints, per currency", () => {
    const P = window.GOGPlusCurrency.parsePrice;
    expect(P("CHF 7.19", "CHF")).toBe(7.19);
    expect(P("Fr. 3.35", "CHF")).toBe(3.35);
    expect(P("85,50 kr", "SEK")).toBe(85.5);
    expect(P("kr 95,50", "NOK")).toBe(95.5);
    expect(P("56,00 kr.", "DKK")).toBe(56);
    expect(P("164 Kč", "CZK")).toBe(164);
    expect(P("1 990 Ft", "HUF")).toBe(1990);
    expect(P("229,19 TL", "TRY")).toBe(229.19);
    expect(P("¥33", "CNY")).toBe(33);
    expect(P("R 86", "ZAR")).toBe(86);
    expect(P("$11.50", "AUD")).toBe(11.5);
    expect(P("MX$ 35.99", "MXN")).toBe(35.99);
    expect(P("Rp 142.000", "IDR")).toBe(142000); // a dot groups thousands where there are no minor units
    expect(P("฿265", "THB")).toBe(265);
  });

  it("never reads a letter symbol that is part of a word as a price", () => {
    const P = window.GOGPlusCurrency.parsePrice;
    expect(P("3 Reviews", "ZAR")).toBeNull();
    expect(P("Version 4 Rated", "ZAR")).toBeNull();
    expect(P("the leisure 5", "RON")).toBeNull();
  });

  it("only infers a currency from text when the symbol is distinctive", () => {
    const S = window.GOGPlusCurrency.SYMBOL_TO_CODE;
    expect(S["zł"]).toBe("PLN");
    expect(S["Kč"]).toBe("CZK");
    expect(S["kr"]).toBeUndefined(); // Swedish, Norwegian or Danish: only the page's own hint can say
    expect(S["¥"]).toBeUndefined();
  });

  it("a stored rates object from an older version still answers for newer currencies", async () => {
    await new Promise((r) => chrome.storage.sync.set({ rates: { ILS: 3.7 } }, r));
    const { rates } = await window.GOGPlusStorage.get({ rates: window.GOG_PLUS_DEFAULTS.rates });
    expect(rates.ILS).toBe(3.7); // the stored one wins
    expect(rates.CHF).toBeGreaterThan(0); // the built-in one fills the gap
    expect(rates.IDR).toBeGreaterThan(0);
  });

  it("formats whole-unit currencies without decimals and groups thousands", () => {
    const F = window.GOGPlusCurrencyFormat;
    expect(F.formatPrice(18101.4, "IDR")).toBe("Rp18,101");
    expect(F.formatPrice(158.2, "JPY")).toBe("¥158");
    expect(F.formatPrice(1097.99, "PLN")).toBe("zł1,097.99");
    expect(F.formatPrice(1097.99, "ILS")).toBe("₪1,098");
  });

  it("converts a Swedish catalog price once the page says it is Swedish", () => {
    setup("SEK", "kr");
    state.settings.rates = { ...state.settings.rates, SEK: 10 };
    document.body.innerHTML = '<span id="p">85,50 kr</span>';
    applyCurrencyConversion(document.body);
    expect(document.querySelector("#p .gog-plus-conv-note").textContent).toContain("34"); // 85.5 / 10 x 4
  });
});
