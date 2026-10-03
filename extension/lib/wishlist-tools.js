/**
 * GOG+ wishlist tools — sorting, filtering, totals, grouping and export for the
 * wishlist page. Pure functions over a row model; the DOM side lives in
 * content/features/wishlist.js and reads rows via GOGPlusGogDom.readWishlistRow.
 *
 * Row model:
 *   { slug, title, price, currency, discountPct, owned, tba, free, inCart }
 * `price` is the price being asked now in `currency` (null when the row has
 * none — owned, TBA or free). Everything that needs history takes
 * `ctx.history[slug]` (the user's own price-history snapshots).
 */
// @ts-check

(() => {
  "use strict";

  /**
   * @typedef {{
   *   slug: string | null, title: string, price: number | null, currency: string | null,
   *   discountPct: number, owned: boolean, tba: boolean, free: boolean, inCart?: boolean
   * }} WishRow
   * @typedef {{
   *   history?: Record<string, Array<{ d: string, p: number, c: string }>>,
   *   rates?: Record<string, number>,
   *   target?: string,
   *   offerEnds?: Record<string, number>,
   *   now?: number,
   *   tags?: Record<string, string[]>,
   *   status?: Record<string, string>,
   *   genres?: Record<string, string>,
   * }} Ctx
   */

  const HOUR_MS = 60 * 60 * 1000;

  /**
   * Amount converted to `ctx.target` through the USD rate map, or null when impossible.
   * @param {number} amt @param {string | null} cur @param {Ctx} ctx
   */
  function toTarget(amt, cur, ctx) {
    const target = ctx.target;
    if (!target || !cur || cur === target) return amt;
    const rates = ctx.rates || {};
    const s = cur === "USD" ? 1 : rates[cur];
    const t = target === "USD" ? 1 : rates[target];
    return s > 0 && t > 0 ? (amt / s) * t : null;
  }

  /**
   * How far above this game's tracked low the current price is, in percent
   * (0 = at the low). Null without history in the row's currency.
   * @param {WishRow} row @param {Ctx} ctx
   */
  function pctAboveLow(row, ctx) {
    if (row.price == null || !row.slug) return null;
    const hist = (ctx.history?.[row.slug] || []).filter((e) => e.c === row.currency && e.p > 0);
    if (!hist.length) return null;
    const low = Math.min(row.price, ...hist.map((e) => e.p));
    return low > 0 ? ((row.price - low) / low) * 100 : 0;
  }

  /** @param {WishRow} row @param {Ctx} ctx */
  function nearLow(row, ctx) {
    const p = pctAboveLow(row, ctx);
    return p !== null && p <= 10;
  }

  /** @param {WishRow} row @param {Ctx} ctx */
  function endingSoon(row, ctx) {
    const end = row.slug ? ctx.offerEnds?.[row.slug] : undefined;
    if (!end) return false;
    const left = end - (ctx.now ?? Date.now());
    return left > 0 && left <= 48 * HOUR_MS;
  }

  /** @typedef {"default" | "discount" | "near-low" | "price-asc" | "price-desc" | "title"} SortMode */
  /** @type {SortMode[]} */
  const SORT_MODES = ["default", "discount", "near-low", "price-asc", "price-desc", "title"];

  /**
   * Sorted copy of `rows`. Rows without the sort key sink to the bottom
   * rather than float to the top; ties keep page order (stable).
   * @param {WishRow[]} rows @param {SortMode} mode @param {Ctx} [ctx]
   * @returns {WishRow[]}
   */
  function sortRows(rows, mode, ctx = {}) {
    const indexed = rows.map((r, i) => ({ r, i }));
    /** @type {(r: WishRow) => number | null} */
    let key;
    let dir = 1;
    if (mode === "discount") {
      key = (r) => (r.price == null ? null : r.discountPct);
      dir = -1;
    } else if (mode === "price-asc" || mode === "price-desc") {
      key = (r) => (r.price == null ? null : toTarget(r.price, r.currency, ctx));
      dir = mode === "price-asc" ? 1 : -1;
    } else if (mode === "near-low") {
      key = (r) => pctAboveLow(r, ctx);
    } else if (mode === "title") {
      return indexed.sort((a, b) => a.r.title.localeCompare(b.r.title) || a.i - b.i).map((x) => x.r);
    } else {
      return rows.slice();
    }
    return indexed
      .sort((a, b) => {
        const ka = key(a.r);
        const kb = key(b.r);
        if (ka === null && kb === null) return a.i - b.i;
        if (ka === null) return 1;
        if (kb === null) return -1;
        return (ka - kb) * dir || a.i - b.i;
      })
      .map((x) => x.r);
  }

  /** @typedef {"all" | "sale" | "near-low" | "ending-soon" | "hide-owned"} FilterMode */

  /**
   * @param {WishRow} row @param {FilterMode} filter @param {Ctx} [ctx]
   */
  function matchesFilter(row, filter, ctx = {}) {
    switch (filter) {
      case "sale":
        return row.discountPct > 0;
      case "near-low":
        return nearLow(row, ctx);
      case "ending-soon":
        return endingSoon(row, ctx);
      case "hide-owned":
        return !row.owned;
      default:
        return true;
    }
  }

  /**
   * Totals over the rows that have a price, in `ctx.target` when set.
   * "Saving" only counts rows that show a discount.
   * @param {WishRow[]} rows @param {Ctx} [ctx]
   * @returns {{ count: number, priced: number, onSale: number, owned: number, total: number, saving: number, currency: string | null }}
   */
  function totals(rows, ctx = {}) {
    let total = 0;
    let saving = 0;
    let priced = 0;
    let onSale = 0;
    let owned = 0;
    for (const r of rows) {
      if (r.owned) owned++;
      if (r.price == null || r.owned) continue;
      const v = toTarget(r.price, r.currency, ctx);
      if (v == null) continue;
      priced++;
      total += v;
      if (r.discountPct > 0 && r.discountPct < 100) {
        onSale++;
        saving += (v / (1 - r.discountPct / 100)) - v;
      }
    }
    const currency = ctx.target || rows.find((r) => r.currency)?.currency || null;
    return { count: rows.length, priced, onSale, owned, total, saving, currency };
  }

  /** @typedef {"none" | "tag" | "status" | "genre"} GroupBy */

  /**
   * Splits rows into labelled groups. A game with several tags appears under
   * its first tag only (a wishlist row can't be in two places at once);
   * rows without a value land in "Other", always last.
   * @param {WishRow[]} rows @param {GroupBy} by @param {Ctx} [ctx]
   * @returns {Array<{ label: string, rows: WishRow[] }>}
   */
  function groupRows(rows, by, ctx = {}) {
    if (by === "none") return [{ label: "", rows: rows.slice() }];
    /** @type {Map<string, WishRow[]>} */
    const map = new Map();
    const other = [];
    for (const r of rows) {
      let label = "";
      if (r.slug) {
        if (by === "tag") label = ctx.tags?.[r.slug]?.[0] || "";
        else if (by === "status") label = ctx.status?.[r.slug] || "";
        else if (by === "genre") label = ctx.genres?.[r.slug] || "";
      }
      if (!label) other.push(r);
      else map.set(label, [...(map.get(label) || []), r]);
    }
    const groups = [...map.entries()]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .map(([label, rs]) => ({ label, rows: rs }));
    if (other.length) groups.push({ label: "Other", rows: other });
    return groups;
  }

  /** @param {string} s */
  const csvCell = (s) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

  /**
   * @param {WishRow[]} rows @param {Ctx} [ctx]
   * @returns {string} CSV (RFC 4180, CRLF) — opens in Sheets/Excel/Notion as is
   */
  function toCsv(rows, ctx = {}) {
    const head = ["Title", "Slug", "Price", "Currency", "Discount %", "Owned", "Tracked low", "Tags"];
    const lines = [head.join(",")];
    for (const r of rows) {
      const hist = (r.slug && ctx.history?.[r.slug]) || [];
      const lows = hist.filter((e) => e.c === r.currency).map((e) => e.p);
      lines.push(
        [
          csvCell(r.title),
          csvCell(r.slug || ""),
          r.price == null ? "" : r.price.toFixed(2),
          csvCell(r.currency || ""),
          String(r.discountPct || 0),
          r.owned ? "yes" : "",
          lows.length ? Math.min(...lows).toFixed(2) : "",
          csvCell((r.slug && ctx.tags?.[r.slug]?.join("; ")) || ""),
        ].join(",")
      );
    }
    return lines.join("\r\n") + "\r\n";
  }

  /**
   * @param {WishRow[]} rows @param {Ctx} [ctx]
   * @returns {string} Markdown checklist, one line per game
   */
  function toMarkdown(rows, ctx = {}) {
    const t = totals(rows, ctx);
    const out = ["# GOG wishlist", ""];
    for (const r of rows) {
      const price = r.price == null ? (r.free ? "free" : r.tba ? "TBA" : r.owned ? "owned" : "—") : `${r.price.toFixed(2)} ${r.currency || ""}`.trim();
      const off = r.discountPct > 0 ? ` (-${r.discountPct}%)` : "";
      const url = r.slug ? `https://www.gog.com/en/game/${r.slug}` : "";
      out.push(`- [ ] ${url ? `[${r.title || r.slug}](${url})` : r.title} — ${price}${off}`);
    }
    out.push("", `${t.count} games, ${t.onSale} on sale, total ${t.total.toFixed(2)} ${t.currency || ""}`.trim());
    return out.join("\n") + "\n";
  }

  const api = { SORT_MODES, pctAboveLow, nearLow, endingSoon, sortRows, matchesFilter, totals, groupRows, toCsv, toMarkdown, toTarget };
  if (typeof window !== "undefined") window.GOGPlusWishlistTools = api;
  if (typeof self !== "undefined") self.GOGPlusWishlistTools = api;
})();
