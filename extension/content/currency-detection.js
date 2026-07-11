/**
 * GOG+ currency detection.
 *
 * GOG shows different currencies depending on the user's account/region.
 * Naively assuming USD leads to wrong conversions for EU/UK/IL users.
 *
 * Strategy:
 *   1. Look for explicit currency symbols in price text on the page.
 *   2. Fall back to URL locale if needed (/de/, /fr/, /pl/).
 *   3. Default to USD only as last resort.
 *
 * Exposes:
 *   window.GOGPlusCurrency.detect() → { code, symbol }
 *   window.GOGPlusCurrency.parsePrice(text, knownCurrency?) → number | null
 */

(() => {
  "use strict";

  const SYMBOL_TO_CODE = {
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
    "₪": "ILS",
    "₽": "RUB",
    "zł": "PLN",
    "Kč": "CZK",
    "kr": "SEK",
    "R$": "BRL",
    "C$": "CAD",
    "A$": "AUD",
  };

  const CODE_TO_SYMBOL = Object.entries(SYMBOL_TO_CODE).reduce((acc, [s, c]) => {
    acc[c] = s;
    return acc;
  }, {});

  let cached = null;
  let cachedFor = null;

  function detect() {
    if (cached && cachedFor === location.pathname) return cached;
    cached = null;

    // Probe: scan a few visible price-like nodes
    const candidates = document.querySelectorAll(
      '[class*="price"], [class*="Price"], .product-tile__price, .price-text, .product-row-price'
    );

    const counts = {};
    for (let i = 0; i < Math.min(candidates.length, 30); i++) {
      const t = candidates[i].textContent || "";
      for (const [sym, code] of Object.entries(SYMBOL_TO_CODE)) {
        if (t.includes(sym)) {
          counts[code] = (counts[code] || 0) + 1;
        }
      }
    }

    let topCode = null;
    let topCount = 0;
    for (const [code, n] of Object.entries(counts)) {
      if (n > topCount) {
        topCount = n;
        topCode = code;
      }
    }

    if (!topCode) {
      // URL locale fallback
      const path = location.pathname;
      if (/^\/de(\/|$)/.test(path)) topCode = "EUR";
      else if (/^\/fr(\/|$)/.test(path)) topCode = "EUR";
      else if (/^\/pl(\/|$)/.test(path)) topCode = "PLN";
      else if (/^\/ru(\/|$)/.test(path)) topCode = "RUB";
      else topCode = "USD";
    }

    cached = { code: topCode, symbol: CODE_TO_SYMBOL[topCode] || "$" };
    cachedFor = location.pathname;
    return cached;
  }

  // Currencies where comma is conventionally the decimal mark.
  // We disambiguate per-number by looking at the digits after the separator;
  // 2 digits → decimal, 3 digits → thousands.
  const COMMA_DECIMAL_LOCALES = new Set(["EUR", "PLN", "RUB", "CZK", "SEK", "BRL"]);

  function normalizeNumber(raw, currency) {
    // raw is a token like "1,234.56" / "1.234,56" / "19,99" / "1234"
    const commaDecimal = COMMA_DECIMAL_LOCALES.has(currency);
    const hasDot = raw.includes(".");
    const hasComma = raw.includes(",");

    if (hasDot && hasComma) {
      // Both present — the LAST one is the decimal separator.
      const lastDot = raw.lastIndexOf(".");
      const lastComma = raw.lastIndexOf(",");
      if (lastDot > lastComma) {
        return parseFloat(raw.replace(/,/g, ""));
      }
      return parseFloat(raw.replace(/\./g, "").replace(",", "."));
    }
    if (hasComma && !hasDot) {
      // Ambiguous: 2 digits after → decimal; 3 digits → thousands group.
      const parts = raw.split(",");
      const tail = parts[parts.length - 1];
      if (commaDecimal && tail.length === 2) {
        return parseFloat(raw.replace(",", "."));
      }
      if (!commaDecimal && tail.length === 3) {
        return parseFloat(raw.replace(/,/g, ""));
      }
      // Fall back to locale default
      return commaDecimal
        ? parseFloat(raw.replace(/,/g, "."))
        : parseFloat(raw.replace(/,/g, ""));
    }
    return parseFloat(raw);
  }

  /**
   * Robust price parser. If `knownCurrency` is provided, only matches that one.
   * Otherwise tries any of the known symbols.
   */
  function parsePrice(text, knownCurrency = null) {
    if (!text) return null;

    const grab = (sym, currency) => {
      const escSym = sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`${escSym}\\s?([\\d.,]+)`);
      const m = text.match(re);
      if (!m) return null;
      const v = normalizeNumber(m[1], currency);
      return Number.isFinite(v) ? v : null;
    };

    if (knownCurrency) {
      const sym = CODE_TO_SYMBOL[knownCurrency];
      if (!sym) return null;
      return grab(sym, knownCurrency);
    }
    for (const [sym, code] of Object.entries(SYMBOL_TO_CODE)) {
      const v = grab(sym, code);
      if (v !== null) return v;
    }
    return null;
  }

  // Re-detect after a delay (some prices load lazily)
  setTimeout(() => {
    cached = null;
    cachedFor = null;
    detect();
  }, 3000);

  window.GOGPlusCurrency = {
    detect,
    parsePrice,
    SYMBOL_TO_CODE,
    CODE_TO_SYMBOL,
  };
})();
