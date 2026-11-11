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

  // The table lives in lib/defaults.js; this small copy keeps formatting working in a page that
  // loaded this file without it.
  const FALLBACK = [
    { code: "USD", symbol: "$", places: 2 },
    { code: "EUR", symbol: "€", places: 2 },
    { code: "GBP", symbol: "£", places: 2 },
    { code: "PLN", symbol: "zł", places: 2 },
    { code: "ILS", symbol: "₪", places: 0 },
    { code: "RUB", symbol: "₽", places: 0 },
  ];
  const TABLE = () => (typeof globalThis !== "undefined" && globalThis.GOG_PLUS_CURRENCIES?.TABLE) || FALLBACK;

  /**
   * @param {string} cur ISO-ish currency code (USD, ILS, ...)
   * @returns {string} the currency's symbol, or the code itself if unknown
   */
  function symbolFor(cur) {
    const known = TABLE().find((c) => c.code === cur);
    if (known) return known.symbol;
    // Stored values (a backup, a sync file) can name any "currency": keep only
    // letters so the result is always safe to place inside markup.
    return String(cur ?? "").replace(/[^A-Za-z]/g, "").slice(0, 5).toUpperCase();
  }

  /**
   * @param {number} value
   * @param {string} cur
   * @returns {string} e.g. "$15.00" or "₪16" (ILS, RUB, JPY, HUF, CZK and IDR round to whole units)
   */
  function formatPrice(value, cur) {
    const known = TABLE().find((c) => c.code === cur);
    const places = known ? known.places : 2;
    // Thousands are grouped ("Rp18,101", "₪1,098") so a large figure stays readable.
    const text = value.toLocaleString("en-US", { minimumFractionDigits: places, maximumFractionDigits: places });
    return `${symbolFor(cur)}${text}`;
  }

  const api = { symbolFor, formatPrice };
  if (typeof window !== "undefined") window.GOGPlusCurrencyFormat = api;
  if (typeof self !== "undefined") self.GOGPlusCurrencyFormat = api;
})();
