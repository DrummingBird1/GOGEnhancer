/**
 * GOG+ cross-store price comparison via CheapShark
 * (https://apidocs.cheapshark.com) — a free, keyless deal-aggregation API.
 * Used to show "how much is this on Steam/Epic/etc. right now" on the game
 * page, alongside GOG's own price.
 *
 * CheapShark now rejects requests with a missing/generic User-Agent header.
 * fetch() can never set a custom User-Agent (it's a forbidden header per the
 * Fetch spec), so this always sends the browser's own real UA — verified
 * live against the API before wiring this up, a real Chrome/Edge UA passes.
 *
 * All CheapShark prices are USD; callers convert with the existing FX rate
 * matrix (settings.rates) the same way the rest of the extension does.
 */
// @ts-check

(() => {
  "use strict";

  const DEALS_URL = "https://www.cheapshark.com/api/1.0/deals";
  const REDIRECT_URL = "https://www.cheapshark.com/redirect";

  // CheapShark storeIDs worth surfacing on a GOG game page (verified against
  // the live /api/1.0/stores endpoint). storeID 7 (GOG itself) is
  // deliberately excluded — the page already shows GOG's own price.
  /** @type {Record<number, string>} */
  const STORE_NAMES = {
    1: "Steam",
    3: "GreenManGaming",
    11: "Humble Store",
    15: "Fanatical",
    25: "Epic Games Store",
  };

  /**
   * @param {string} t
   * @returns {string}
   */
  function normalizeTitle(t) {
    return (t || "")
      .toLowerCase()
      .replace(/[™®©:]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  /**
   * @param {string} a
   * @param {string} b
   * @returns {boolean}
   */
  function titlesMatch(a, b) {
    const na = normalizeTitle(a);
    const nb = normalizeTitle(b);
    if (!na || !nb) return false;
    return na === nb || na.includes(nb) || nb.includes(na);
  }

  /**
   * @typedef {Object} CompareDeal
   * @property {number} storeId
   * @property {string} storeName
   * @property {number} price
   * @property {number} normalPrice
   * @property {boolean} isOnSale
   * @property {number} savingsPct
   * @property {string} url
   */

  // Fetches CheapShark deals matching `title`, keeps only the recognized
  // stores, de-dupes to the cheapest listing per store, and sorts ascending
  // by price. Fails soft (empty array) on any network/parse error — this is
  // a nice-to-have comparison table, never a blocker for the rest of the panel.
  /**
   * @param {string} title
   * @returns {Promise<CompareDeal[]>}
   */
  async function fetchDeals(title) {
    if (!title) return [];
    const url = `${DEALS_URL}?title=${encodeURIComponent(title)}&limit=30`;
    let res;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    } catch (_) {
      return [];
    }
    if (!res || !res.ok) return [];
    let data;
    try {
      data = await res.json();
    } catch (_) {
      return [];
    }
    if (!Array.isArray(data)) return [];

    /** @type {Map<number, CompareDeal>} */
    const byStore = new Map();
    for (const d of data) {
      const storeId = parseInt(d?.storeID, 10);
      const storeName = STORE_NAMES[storeId];
      if (!storeName) continue;
      if (!titlesMatch(d.title, title)) continue;
      const price = parseFloat(d.salePrice);
      if (!Number.isFinite(price)) continue;
      const existing = byStore.get(storeId);
      if (existing && existing.price <= price) continue;
      byStore.set(storeId, {
        storeId,
        storeName,
        price,
        normalPrice: parseFloat(d.normalPrice) || price,
        isOnSale: d.isOnSale === "1",
        savingsPct: Math.max(0, Math.round(parseFloat(d.savings) || 0)),
        url: `${REDIRECT_URL}?dealID=${encodeURIComponent(d.dealID)}`,
      });
    }
    return [...byStore.values()].sort((a, b) => a.price - b.price);
  }

  const Api = { fetchDeals, normalizeTitle, titlesMatch, STORE_NAMES };
  if (typeof window !== "undefined") window.GOGPlusPriceCompare = Api;
  if (typeof self !== "undefined") self.GOGPlusPriceCompare = Api;
})();
