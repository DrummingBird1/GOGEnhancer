/**
 * GOG+ price history.
 *
 * Records (slug, date, price, currency) tuples in chrome.storage.local
 * each time the user visits a game page.
 *
 * Exposes:
 *   await window.GOGPlusPriceHistory.record(slug, price, currency)
 *   await window.GOGPlusPriceHistory.get(slug) → [{date, price, currency}, ...]
 *   await window.GOGPlusPriceHistory.lowest(slug) → {price, date} | null
 *
 * Storage key: priceHistory  (object: { slug: [{d, p, c}, ...] })
 *   Trimmed to last 30 entries per game to keep storage small.
 */

(() => {
  "use strict";

  const MAX_ENTRIES = 30;

  async function load() {
    const { priceHistory = {} } = await window.GOGPlusStorage.get({
      priceHistory: {},
    });
    return priceHistory;
  }

  async function save(history) {
    await window.GOGPlusStorage.set({ priceHistory: history });
  }

  async function record(slug, price, currency) {
    if (!slug || typeof price !== "number" || price <= 0) return;
    const history = await load();
    history[slug] = history[slug] || [];

    const last = history[slug][history[slug].length - 1];
    const today = new Date().toISOString().slice(0, 10);

    // Skip if we already recorded the same price today
    if (last && last.d === today && last.p === price && last.c === currency) {
      return;
    }
    // Skip if same price as last entry, just update timestamp
    if (last && last.p === price && last.c === currency) {
      last.d = today;
    } else {
      history[slug].push({ d: today, p: price, c: currency });
    }
    if (history[slug].length > MAX_ENTRIES) {
      history[slug].splice(0, history[slug].length - MAX_ENTRIES);
    }
    await save(history);
  }

  async function get(slug) {
    const history = await load();
    return history[slug] || [];
  }

  async function lowest(slug) {
    const entries = await get(slug);
    if (!entries.length) return null;
    let min = entries[0];
    for (const e of entries) if (e.p < min.p) min = e;
    return { price: min.p, date: min.d, currency: min.c };
  }

  async function stats(slug) {
    const entries = await get(slug);
    if (!entries.length) return null;
    let min = entries[0],
      max = entries[0];
    let sum = 0;
    for (const e of entries) {
      if (e.p < min.p) min = e;
      if (e.p > max.p) max = e;
      sum += e.p;
    }
    return {
      count: entries.length,
      min: { price: min.p, date: min.d },
      max: { price: max.p, date: max.d },
      avg: sum / entries.length,
      first: entries[0],
      latest: entries[entries.length - 1],
      currency: entries[entries.length - 1].c,
    };
  }

  window.GOGPlusPriceHistory = { record, get, lowest, stats };
})();
