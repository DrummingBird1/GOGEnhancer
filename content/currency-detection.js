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

  function detect() {
    if (cached) return cached;

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
    return cached;
  }

  /**
   * Robust price parser. If `knownCurrency` is provided, only matches that one.
   * Otherwise tries any of the known symbols.
   */
  function parsePrice(text, knownCurrency = null) {
    if (!text) return null;

    if (knownCurrency) {
      const sym = CODE_TO_SYMBOL[knownCurrency];
      if (!sym) return null;
      // Escape regex chars; "$" is special
      const escSym = sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`${escSym}\\s?([\\d,]+(?:\\.\\d{2})?|\\d+)`);
      const m = text.match(re);
      if (!m) return null;
      return parseFloat(m[1].replace(/,/g, ""));
    }

    // Try every known symbol
    for (const [sym] of Object.entries(SYMBOL_TO_CODE)) {
      const escSym = sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`${escSym}\\s?([\\d,]+(?:\\.\\d{2})?|\\d+)`);
      const m = text.match(re);
      if (m) return parseFloat(m[1].replace(/,/g, ""));
    }
    return null;
  }

  // Re-detect after a delay (some prices load lazily)
  setTimeout(() => {
    cached = null;
    detect();
  }, 3000);

  window.GOGPlusCurrency = {
    detect,
    parsePrice,
    SYMBOL_TO_CODE,
    CODE_TO_SYMBOL,
  };
})();
