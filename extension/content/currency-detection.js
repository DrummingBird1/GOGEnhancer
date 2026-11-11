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
// @ts-check

(() => {
  "use strict";

  // The table is shared with everything else (lib/defaults.js). A symbol many
  // currencies print ("kr", "¥", "R") never names a currency by itself: those are
  // known only from the page's own `prices-in-xxx` class.
  const TABLE = (window.GOG_PLUS_CURRENCIES && window.GOG_PLUS_CURRENCIES.TABLE) || [
    { code: "USD", symbol: "$", guess: true },
    { code: "EUR", symbol: "€", guess: true },
    { code: "GBP", symbol: "£", guess: true },
    { code: "ILS", symbol: "₪", guess: true },
    { code: "RUB", symbol: "₽", guess: true },
    { code: "PLN", symbol: "zł", guess: true },
  ];

  /** @type {Record<string, string>} */
  const SYMBOL_TO_CODE = {};
  /** @type {Record<string, string>} */
  const CODE_TO_SYMBOL = {};
  /** @type {Record<string, string[]>} every form GOG prints for a code, the main symbol first */
  const FORMS = {};
  for (const c of TABLE) {
    FORMS[c.code] = [c.symbol, ...((/** @type {any} */ (c)).alts || [])];
    CODE_TO_SYMBOL[c.code] = c.symbol;
    if (c.guess && !(c.symbol in SYMBOL_TO_CODE)) SYMBOL_TO_CODE[c.symbol] = c.code;
  }
  // Symbols we still recognise by text although the table has no rate for them.
  if (!("kr" in SYMBOL_TO_CODE) && !CODE_TO_SYMBOL.SEK) CODE_TO_SYMBOL.SEK = "kr";

  // Longest first, so "R$" / "A$" / "C$" are tried before a bare "$".
  const SYMBOLS_LONGEST_FIRST = Object.keys(SYMBOL_TO_CODE).sort((a, b) => b.length - a.length);

  /**
   * Regex pieces for "the symbol next to a number". A symbol made of letters ("R",
   * "kr", "Ft") must not be part of a word: "3 Reviews" is not "3 R".
   * @param {string} sym
   */
  function symbolPattern(sym) {
    const esc = sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const lead = /^[\p{L}$]/u.test(sym) ? "(?<![\\p{L}])" : "";
    const trail = /[\p{L}]$/u.test(sym) ? "(?![\\p{L}])" : "";
    return { lead, trail, esc };
  }

  /**
   * Which currencies are named in a price text. A symbol that is part of a
   * longer one ("$" inside "R$") is consumed with it, so it is not counted twice.
   * @param {string} text
   * @returns {string[]}
   */
  /**
   * One regex source that matches any form GOG prints for `code` — each form with
   * its own word boundaries — to put on either side of a number.
   * @param {string} code
   */
  function symbolGroup(code) {
    const forms = FORMS[code] || [CODE_TO_SYMBOL[code]].filter(Boolean);
    const parts = forms.map((f) => {
      const { lead, trail, esc } = symbolPattern(f);
      return `${lead}${esc}${trail}`;
    });
    return `(?:${parts.join("|")})`;
  }

  function codesIn(text) {
    const found = [];
    let rest = String(text || "");
    for (const sym of SYMBOLS_LONGEST_FIRST) {
      if (!rest.includes(sym)) continue;
      const { lead, trail, esc } = symbolPattern(sym);
      if (/^[\p{L}]|[\p{L}]$/u.test(sym)) {
        // letters: only when it sits against a number
        const re = new RegExp(`${lead}${esc}${trail}[\\s\\u00a0]?\\d|\\d[\\s\\u00a0]?${lead}${esc}${trail}`, "u");
        if (!re.test(rest)) continue;
      }
      found.push(SYMBOL_TO_CODE[sym]);
      rest = rest.split(sym).join(" ");
    }
    return found;
  }

  let cached = null;
  let cachedFor = null;
  let cachedAt = 0;
  // A result that came from no evidence at all (no price on the page yet: a
  // catalog that renders late) must not be remembered for the whole page.
  let cachedIsGuess = false;
  const GUESS_TTL_MS = 1500;

  function detect() {
    if (cached && cachedFor === location.pathname && (!cachedIsGuess || Date.now() - cachedAt < GUESS_TTL_MS)) return cached;
    cached = null;
    cachedIsGuess = false;

    // The page's own declaration wins: game pages print prices as bare
    // numbers (the symbol is CSS-injected) and name the currency only in a
    // body/html class, so there is nothing else to count there.
    const hint = window.GOGPlusGogDom.currencyHint();
    if (hint && CODE_TO_SYMBOL[hint]) {
      cached = { code: hint, symbol: CODE_TO_SYMBOL[hint] };
      cachedFor = location.pathname;
      cachedAt = Date.now();
      return cached;
    }

    // Probe: scan a few visible price-like nodes
    const candidates = window.GOGPlusGogDom.findPriceNodes().nodes;

    const counts = {};
    for (let i = 0; i < Math.min(candidates.length, 30); i++) {
      const t = window.GOGPlusGogDom.displayText(candidates[i]);
      for (const code of codesIn(t)) counts[code] = (counts[code] || 0) + 1;
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
      cachedIsGuess = true;
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
    cachedAt = Date.now();
    return cached;
  }

  // Currencies where comma is conventionally the decimal mark.
  // We disambiguate per-number by looking at the digits after the separator;
  // 2 digits → decimal, 3 digits → thousands.
  const WHOLE_UNIT = new Set(["IDR", "JPY", "KRW", "HUF"]);
  const COMMA_DECIMAL_LOCALES = new Set(["EUR", "PLN", "RUB", "CZK", "SEK", "NOK", "DKK", "HUF", "RON", "TRY", "BRL"]);

  function normalizeNumber(raw, currency) {
    // raw is a token like "1,234.56" / "1.234,56" / "19,99" / "1234"
    const commaDecimal = COMMA_DECIMAL_LOCALES.has(currency);
    const hasDot = raw.includes(".");
    const hasComma = raw.includes(",");
    // Currencies without minor units write "Rp 142.000" / "¥1.500": the dot groups thousands.
    if (WHOLE_UNIT.has(currency) && /^\d{1,3}(\.\d{3})+$/.test(raw)) return parseFloat(raw.replace(/\./g, ""));

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

    // Symbol-first ("$19.99") or symbol-last ("19,99 €") — which side the
    // symbol sits on varies by locale and by how GOG's markup is built.
    const grab = (sym, currency) => {
      const group = currency && FORMS[currency] ? symbolGroup(currency) : (() => { const q = symbolPattern(sym); return `(?:${q.lead}${q.esc}${q.trail})`; })();
      // "1 097,99" and "26 069" (space, NBSP or narrow NBSP between groups of
      // three) are one number, not two. A bare "$" is not the tail of "R$".
      const NUM = "(?:\\d{1,3}(?:[\\s\\u00a0\\u202f]\\d{3})+(?:[.,]\\d+)?|[\\d.,]+)";
      const re = new RegExp(`${group}[\\s\\u00a0]?(${NUM})|(${NUM})[\\s\\u00a0]?${group}`, "u");
      const m = text.match(re);
      if (!m) return null;
      const raw = (m[1] ?? m[2]).replace(/[\s  ]/g, "");
      const v = normalizeNumber(raw, currency);
      return Number.isFinite(v) ? v : null;
    };

    if (knownCurrency) {
      const sym = CODE_TO_SYMBOL[knownCurrency];
      if (!sym) return null;
      return grab(sym, knownCurrency);
    }
    for (const sym of SYMBOLS_LONGEST_FIRST) {
      const v = grab(sym, SYMBOL_TO_CODE[sym]);
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
    symbolPattern,
    symbolGroup,
  };
})();
