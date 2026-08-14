/**
 * GOG+ currency display helpers.
 *
 * symbolFor() was independently implemented twice — content.js's
 * `symbolFor` and tags.js's `currencySymbol` — with two different unknown-
 * currency fallbacks (`|| cur` vs `` `${c} ` ``). Standardized here on
 * content.js's simpler fallback; both currently-supported currency lists
 * (popup's target-currency select, and every `c` this ever actually
 * receives) are covered by the map below, so the fallback path is
 * effectively unreached either way.
 *
 * formatPrice() previously only existed in content.js — tags.js formatted
 * every currency to 2 decimals inline instead of rounding RUB/ILS to whole
 * units, so the same price could render as "₪15" on-page and "₪15.00" in
 * the tag dashboard. Sharing this module fixes that inconsistency too.
 */
// @ts-check

(() => {
  "use strict";

  /** @type {Record<string, string>} */
  const SYMBOLS = {
    ILS: "₪",
    EUR: "€",
    GBP: "£",
    RUB: "₽",
    PLN: "zł",
    USD: "$",
  };

  /**
   * @param {string} cur ISO-ish currency code (USD, ILS, ...)
   * @returns {string} the currency's symbol, or the code itself if unknown
   */
  function symbolFor(cur) {
    return SYMBOLS[cur] || cur;
  }

  /**
   * @param {number} value
   * @param {string} cur
   * @returns {string} e.g. "$15.00" or "₪16" (ILS/RUB round to whole units)
   */
  function formatPrice(value, cur) {
    if (cur === "RUB" || cur === "ILS") {
      return `${symbolFor(cur)}${Math.round(value)}`;
    }
    return `${symbolFor(cur)}${value.toFixed(2)}`;
  }

  const api = { symbolFor, formatPrice };
  if (typeof window !== "undefined") window.GOGPlusCurrencyFormat = api;
  if (typeof self !== "undefined") self.GOGPlusCurrencyFormat = api;
})();
