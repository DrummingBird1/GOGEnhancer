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
 *
 * `historyMaxEntries` caps entries PER game, but nothing capped the NUMBER
 * of games tracked — a long-time user visiting hundreds of titles over the
 * years had no eviction path before storage.local's ~5MB ceiling. record()
 * now also enforces a total-size budget across the whole priceHistory
 * object, evicting the least-recently-updated game(s) — never the game
 * just recorded — when it's exceeded. See evictLeastRecentlyUpdated().
 */

(() => {
  "use strict";

  // MAX_ENTRIES per game. Default 100, user-overridable via the
  // `historyMaxEntries` setting (clamped 10..500). We cache the value and
  // refresh on storage change so we don't async-fetch on every record().
  let MAX_ENTRIES = 100;
  const clampMax = (n) => Math.min(500, Math.max(10, Math.floor(n)));

  // Total-size safety net across ALL games, independent of the per-game cap
  // above. 2 MB leaves comfortable headroom under storage.local's ~5 MB
  // quota for tags/notes/other local keys sharing the same area.
  const TOTAL_BUDGET_BYTES = 2 * 1024 * 1024;

  // Evicts whole games (never partial entries) oldest-last-updated-first,
  // until the serialized object is back under TOTAL_BUDGET_BYTES. "Last
  // updated" = the date on each game's most recent entry, so the game
  // record() was just called for — today's date — naturally sorts last and
  // is never evicted by its own write.
  function evictLeastRecentlyUpdated(history) {
    let size = JSON.stringify(history).length;
    if (size <= TOTAL_BUDGET_BYTES) return;
    const slugs = Object.keys(history).sort((a, b) => {
      const da = history[a][history[a].length - 1]?.d || "";
      const db = history[b][history[b].length - 1]?.d || "";
      return da.localeCompare(db);
    });
    for (const slug of slugs) {
      if (size <= TOTAL_BUDGET_BYTES) break;
      size -= JSON.stringify(history[slug]).length;
      delete history[slug];
    }
  }
  if (typeof window !== "undefined" && window.GOGPlusStorage) {
    window.GOGPlusStorage.get({ historyMaxEntries: 100 }).then((s) => {
      if (Number.isFinite(s.historyMaxEntries)) MAX_ENTRIES = clampMax(s.historyMaxEntries);
    });
    window.GOGPlusStorage.onChange(({ key, newValue }) => {
      if (key === "historyMaxEntries" && Number.isFinite(newValue)) {
        MAX_ENTRIES = clampMax(newValue);
      }
    });
  }

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
    evictLeastRecentlyUpdated(history);
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

  window.GOGPlusPriceHistory = {
    record,
    get,
    lowest,
    stats,
    // Test-only surface (pure, no storage I/O) — see tests/price-history.test.js.
    _internals: { evictLeastRecentlyUpdated, TOTAL_BUDGET_BYTES },
  };
})();
