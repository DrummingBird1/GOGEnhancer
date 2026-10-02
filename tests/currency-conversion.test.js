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

  it("does nothing when the page is already in the target currency", () => {
    setup("ILS", "₪");
    document.body.innerHTML = `<span class="price">₪40</span>`;
    applyCurrencyConversion();
    expect(notes()).toHaveLength(0);
  });
});
