/**
 * GOG+ deal analysis — the pure maths behind the game-page "Deal check":
 * is the advertised discount real, how long is the offer, what does a game
 * cost per hour, roughly when will it next be on sale, what have I saved.
 *
 * No DOM, no storage: everything takes plain numbers/objects so it can be
 * tested exhaustively and reused by the dashboard, popup and service worker.
 *
 * Prices are always in ONE currency per call. History entries are
 * `{ d: "YYYY-MM-DD", p: price, c: currency, b?: basePrice }` (see
 * content/price-history.js); `b` is the struck-through list price when the
 * page showed one, and is what lets us tell a real sale from a permanently
 * "discounted" price.
 */
// @ts-check

(() => {
  "use strict";

  const DAY_MS = 24 * 60 * 60 * 1000;
  const HOUR_MS = 60 * 60 * 1000;
  const MINUTE_MS = 60 * 1000;

  /** @param {number} n @param {number} [digits] */
  const round = (n, digits = 0) => {
    const f = 10 ** digits;
    return Math.round(n * f) / f;
  };

  /* ---------------- offer end time ---------------- */

  /**
   * GOG prints the end of an offer as `2026-10-07 09:59:59.000000+03:00` in a
   * `timer` attribute — a space instead of a "T" and six fractional digits,
   * neither of which `Date.parse` accepts everywhere. Normalise, then parse.
   * @param {string | number | null | undefined} raw
   * @returns {number | null} epoch ms
   */
  function parsePromoDate(raw) {
    if (raw == null || raw === "") return null;
    if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
    const s = String(raw)
      .trim()
      .replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T")
      .replace(/(\.\d{3})\d+/, "$1");
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : null;
  }

  /** @param {number} ms */
  function formatDuration(ms) {
    const abs = Math.max(0, ms);
    const d = Math.floor(abs / DAY_MS);
    const h = Math.floor((abs % DAY_MS) / HOUR_MS);
    const m = Math.floor((abs % HOUR_MS) / MINUTE_MS);
    if (d >= 1) return h ? `${d}d ${h}h` : `${d}d`;
    if (h >= 1) return m ? `${h}h ${m}m` : `${h}h`;
    return `${Math.max(1, m)}m`;
  }

  /**
   * @param {string | number | null | undefined} raw a promo end date as the site prints it
   * @param {number} [now]
   * @returns {{ endsAt: number, msLeft: number, expired: boolean, label: string, urgent: boolean, soon: boolean } | null}
   *   `urgent` = under 24 h, `soon` = under 72 h
   */
  function offerEndsIn(raw, now = Date.now()) {
    const endsAt = parsePromoDate(raw);
    if (endsAt === null) return null;
    const msLeft = endsAt - now;
    const expired = msLeft <= 0;
    return {
      endsAt,
      msLeft,
      expired,
      label: expired ? "ended" : formatDuration(msLeft),
      urgent: !expired && msLeft < DAY_MS,
      soon: !expired && msLeft < 3 * DAY_MS,
    };
  }

  /* ---------------- is the discount real? ---------------- */

  /**
   * Compares the advertised discount with GOG's own "lowest price in the last
   * 30 days before the discount" figure (the EU Omnibus reference price).
   * A "-50%" whose reference price was already half of the list price is not
   * a 50% saving, and a price that is no lower than it was last month is not
   * a deal at all.
   *
   * @param {{ base: number, final: number, lowest30?: number | null }} p
   * @returns {{
   *   advertisedPct: number,
   *   effectivePct: number | null,
   *   inflationPts: number,
   *   vs30: "better" | "same" | "worse" | "unknown",
   *   lowest30: number | null,
   * } | null}
   */
  function realDiscount({ base, final, lowest30 }) {
    if (!(base > 0) || !(final >= 0) || final > base) return null;
    const advertisedPct = round(((base - final) / base) * 100);
    if (!(lowest30 != null && lowest30 > 0)) {
      return { advertisedPct, effectivePct: null, inflationPts: 0, vs30: "unknown", lowest30: null };
    }
    const rel = (final - lowest30) / lowest30;
    /** @type {"better" | "same" | "worse"} */
    const vs30 = rel < -0.01 ? "better" : rel <= 0.01 ? "same" : "worse";
    const effectivePct = Math.max(0, round(((lowest30 - final) / lowest30) * 100));
    // The reference only inflates the claim when it sits clearly below the list price.
    const inflationPts = lowest30 < base * 0.97 ? Math.max(0, advertisedPct - effectivePct) : 0;
    return { advertisedPct, effectivePct, inflationPts, vs30, lowest30 };
  }

  /**
   * Where `price` sits against the history the user's own browser recorded.
   * Only entries in `currency` count (mixed-currency history can't be compared
   * honestly).
   * @param {number} price
   * @param {Array<{ d: string, p: number, c: string }>} history
   * @param {string} currency
   * @returns {{ low: number, high: number, avg: number, count: number, pctAboveLow: number, atLow: boolean } | null}
   */
  function trackedPosition(price, history, currency) {
    const same = (history || []).filter((e) => e && e.c === currency && e.p > 0);
    if (!same.length) return null;
    const prices = same.map((e) => e.p);
    const low = Math.min(...prices, price);
    const high = Math.max(...prices, price);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    return {
      low,
      high,
      avg,
      count: same.length,
      pctAboveLow: low > 0 ? round(((price - low) / low) * 100, 1) : 0,
      atLow: price <= low,
    };
  }

  /* ---------------- sale rhythm ---------------- */

  /**
   * Sale episodes in a sparse, visit-driven history: a run of snapshots priced
   * clearly below the game's usual price. The "usual price" is the struck-through
   * list price (`b`) when the snapshot has one, otherwise the highest price
   * seen so far.
   *
   * @param {Array<{ d: string, p: number, c: string, b?: number }>} history
   * @returns {{
   *   count: number,
   *   episodes: Array<{ start: string, end: string, minPrice: number, depthPct: number }>,
   *   medianGapDays: number | null,
   *   avgDepthPct: number | null,
   *   nextExpected: string | null,
   * }}
   */
  function saleStats(history) {
    const empty = { count: 0, episodes: [], medianGapDays: null, avgDepthPct: null, nextExpected: null };
    const cur = (history || []).filter((e) => e && e.p > 0);
    if (cur.length < 2) return empty;
    const currency = cur[cur.length - 1].c;
    const entries = cur.filter((e) => e.c === currency).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));

    /** @type {Array<{ start: string, end: string, minPrice: number, depthPct: number }>} */
    const episodes = [];
    let usual = 0;
    /** @type {{ start: string, end: string, minPrice: number, depthPct: number } | null} */
    let run = null;
    for (const e of entries) {
      usual = Math.max(usual, e.b || 0, e.p);
      // A snapshot that recorded its own list price is judged against that
      // (a permanent price cut isn't a sale); older ones against the highest
      // price seen so far.
      const ref = e.b && e.b > 0 ? e.b : usual;
      const onSale = e.p <= ref * 0.85;
      if (onSale) {
        const depth = round(((ref - e.p) / ref) * 100);
        if (!run) run = { start: e.d, end: e.d, minPrice: e.p, depthPct: depth };
        else {
          run.end = e.d;
          run.minPrice = Math.min(run.minPrice, e.p);
          run.depthPct = Math.max(run.depthPct, depth);
        }
      } else if (run) {
        episodes.push(run);
        run = null;
      }
    }
    if (run) episodes.push(run);
    if (!episodes.length) return empty;

    const starts = episodes.map((e) => Date.parse(`${e.start}T00:00:00Z`));
    const gaps = [];
    for (let i = 1; i < starts.length; i++) gaps.push(Math.round((starts[i] - starts[i - 1]) / DAY_MS));
    gaps.sort((a, b) => a - b);
    const medianGapDays = gaps.length ? gaps[Math.floor((gaps.length - 1) / 2)] : null;
    const avgDepthPct = round(episodes.reduce((s, e) => s + e.depthPct, 0) / episodes.length);

    let nextExpected = null;
    if (medianGapDays && gaps.length >= 2) {
      nextExpected = new Date(starts[starts.length - 1] + medianGapDays * DAY_MS).toISOString().slice(0, 10);
    }
    return { count: episodes.length, episodes, medianGapDays, avgDepthPct, nextExpected };
  }

  /* ---------------- value ---------------- */

  /**
   * "154.5 h" / "1,200 hours" / "45½ Hours" → 154.5 / 1200 / 45.5. Null if no number.
   * @param {string | null | undefined} text
   */
  function parseHours(text) {
    if (!text) return null;
    const m = String(text).replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(½)?/);
    if (!m) return null;
    const v = parseFloat(m[1]) + (m[2] ? 0.5 : 0);
    return Number.isFinite(v) && v > 0 ? v : null;
  }

  /**
   * @param {number} price
   * @param {number | null | undefined} hours
   * @returns {number | null} price per hour, 2 decimals
   */
  function pricePerHour(price, hours) {
    if (!(price >= 0) || !(hours && hours > 0)) return null;
    return round(price / hours, 2);
  }

  /* ---------------- currencies ---------------- */

  /**
   * Converts one amount to several currencies through the USD-based rate map
   * (`rates` is units-per-USD; USD itself is implicit 1).
   * @param {number} amount
   * @param {string} from
   * @param {Record<string, number>} rates
   * @param {string[]} targets
   * @param {{ taxEstimator?: boolean, vatPercent?: number, vatCurrencies?: string[] }} [opts]
   *   VAT is only added to the currencies in `vatCurrencies` (the user's own region)
   * @returns {Array<{ code: string, value: number }>}
   */
  function convertAll(amount, from, rates, targets, opts = {}) {
    const src = from === "USD" ? 1 : rates[from];
    if (!(src > 0) || !(amount >= 0)) return [];
    /** @type {Array<{ code: string, value: number }>} */
    const out = [];
    for (const code of targets) {
      if (code === from) continue;
      const tgt = code === "USD" ? 1 : rates[code];
      if (!(tgt > 0)) continue;
      let value = (amount / src) * tgt;
      if (opts.taxEstimator && opts.vatPercent && opts.vatCurrencies?.includes(code)) {
        value *= 1 + opts.vatPercent / 100;
      }
      out.push({ code, value });
    }
    return out;
  }

  /**
   * Rough "how much did the sales save me" from the purchase log: for each
   * purchase that has a price paid, the reference is the highest list price
   * (`b`, else the highest price) the history ever showed in that currency.
   * An estimate, labelled as one — the extension can't see what GOG charged.
   *
   * @param {{
   *   purchaseLog: Record<string, any>,
   *   priceHistory: Record<string, Array<{ d: string, p: number, c: string, b?: number }>>,
   *   rates: Record<string, number>,
   *   target: string,
   * }} p
   * @returns {{ total: number, byYear: Record<string, number>, rows: Array<{ slug: string, paid: number, list: number, saved: number, year: string }> }}
   */
  function savingsSummary({ purchaseLog, priceHistory, rates, target }) {
    /** @param {number} amt @param {string} cur */
    const toTarget = (amt, cur) => {
      if (cur === target) return amt;
      const s = cur === "USD" ? 1 : rates[cur];
      const t = target === "USD" ? 1 : rates[target];
      return s > 0 && t > 0 ? (amt / s) * t : null;
    };
    let total = 0;
    /** @type {Record<string, number>} */
    const byYear = {};
    /** @type {Array<{ slug: string, paid: number, list: number, saved: number, year: string }>} */
    const rows = [];
    for (const [slug, raw] of Object.entries(purchaseLog || {})) {
      const entry = typeof raw === "string" ? { date: raw } : raw;
      if (!entry || typeof entry.price !== "number" || !entry.currency || !entry.date) continue;
      const hist = (priceHistory?.[slug] || []).filter((e) => e.c === entry.currency);
      if (!hist.length) continue;
      const list = Math.max(...hist.map((e) => Math.max(e.b || 0, e.p)));
      if (!(list > entry.price)) continue;
      const saved = toTarget(list - entry.price, entry.currency);
      const paid = toTarget(entry.price, entry.currency);
      const listT = toTarget(list, entry.currency);
      if (saved === null || paid === null || listT === null) continue;
      const year = entry.date.slice(0, 4);
      total += saved;
      byYear[year] = (byYear[year] || 0) + saved;
      rows.push({ slug, paid, list: listT, saved, year });
    }
    rows.sort((a, b) => b.saved - a.saved);
    return { total, byYear, rows };
  }

  const api = {
    parsePromoDate,
    formatDuration,
    offerEndsIn,
    realDiscount,
    trackedPosition,
    saleStats,
    parseHours,
    pricePerHour,
    convertAll,
    savingsSummary,
  };
  if (typeof window !== "undefined") window.GOGPlusDeals = api;
  if (typeof self !== "undefined") self.GOGPlusDeals = api;
})();
