/**
 * GOG+ catalog tools — the pure rules behind the catalog bar: which tiles to
 * dim or hide, saved searches, and the side-by-side comparison table.
 *
 * Sorting reuses GOGPlusWishlistTools.sortRows (a catalog tile and a wishlist
 * row share the same model); this module only adds what is catalog-specific.
 * No DOM, no storage.
 *
 * Tile model: { slug, title, price, currency, discountPct, owned }.
 */
// @ts-check

(() => {
  "use strict";

  /** @typedef {"show" | "dim" | "hide"} OwnedDisplay */

  /**
   * Decides what to do with one tile. Hiding wins over dimming; a game the
   * user marked "not interested" is hidden regardless of ownership.
   * @param {{ slug: string, owned: boolean }} tile
   * @param {{
   *   ownedDisplay?: OwnedDisplay,
   *   hideNotInterested?: boolean,
   *   notInterested?: Record<string, unknown>,
   *   ownedSlugs?: Record<string, unknown>,
   *   historyOnly?: boolean,
   *   history?: Record<string, unknown[]>,
   * }} opts
   * @returns {{ hidden: boolean, dim: boolean, reason: "" | "owned" | "not-interested" | "no-history" }}
   */
  function tileVisibility(tile, opts) {
    const { ownedDisplay = "show", hideNotInterested = true, notInterested = {}, ownedSlugs = {}, historyOnly = false, history = {} } = opts;
    if (hideNotInterested && notInterested[tile.slug]) return { hidden: true, dim: false, reason: "not-interested" };
    // The page's own "IN LIBRARY" label is authoritative; the learned set covers
    // tiles that don't show one (a list view, a bundle row).
    const owned = tile.owned || !!ownedSlugs[tile.slug];
    if (owned && ownedDisplay === "hide") return { hidden: true, dim: false, reason: "owned" };
    if (historyOnly && !(history[tile.slug] && history[tile.slug].length)) return { hidden: true, dim: false, reason: "no-history" };
    if (owned && ownedDisplay === "dim") return { hidden: false, dim: true, reason: "owned" };
    return { hidden: false, dim: false, reason: "" };
  }

  /* ---------------- saved searches ---------------- */

  const PRESET_PATH_RE = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:games|catalog)(?:\/[a-z0-9_-]+)*$/i;

  /**
   * Reduces a link to a same-site catalog path + query (what a saved search
   * needs), or null if it isn't one. Anything else — another host, another
   * page type — is refused so a preset can never be a redirect.
   * @param {string} href absolute or site-relative
   * @returns {string | null}
   */
  function sanitizePresetUrl(href) {
    let u;
    try {
      u = new URL(href, "https://www.gog.com");
    } catch {
      return null;
    }
    if (u.hostname !== "www.gog.com" || !PRESET_PATH_RE.test(u.pathname)) return null;
    return `${u.pathname}${u.search}`;
  }

  /**
   * @param {Record<string, string>} presets
   * @param {string} name
   * @param {string} href
   * @returns {Record<string, string>} a new map, or the same one if refused
   */
  function addPreset(presets, name, href) {
    const clean = name.trim().slice(0, 40);
    const url = sanitizePresetUrl(href);
    if (!clean || !url) return presets;
    return { ...presets, [clean]: url };
  }

  /**
   * A readable default name for a search URL: its filters, or "All games".
   * @param {string} path
   */
  function suggestPresetName(path) {
    const q = new URL(path, "https://www.gog.com").searchParams;
    const parts = [];
    for (const [k, v] of q) {
      if (k === "page") continue;
      parts.push(k === "order" ? `sorted ${v.replace(/^(?:asc|desc):/, "")}` : `${k}: ${v}`);
    }
    return (parts.join(", ") || "All games").slice(0, 40);
  }

  /* ---------------- comparison ---------------- */

  /**
   * @param {Array<{ slug: string, title: string, price: number | null, currency: string | null, discountPct: number, owned: boolean }>} items
   * @param {{
   *   history?: Record<string, Array<{ d: string, p: number, c: string }>>,
   *   facts?: Record<string, any>,
   *   genres?: Record<string, string>,
   *   tags?: Record<string, string[]>,
   *   preferred?: string[],
   * }} [ctx]
   * @returns {{ columns: Array<{ slug: string, title: string }>, rows: Array<{ label: string, cells: string[] }> }}
   */
  function buildComparison(items, ctx = {}) {
    const { history = {}, facts = {}, genres = {}, tags = {}, preferred = [] } = ctx;
    const dash = "—";
    /** @param {number | null} n @param {string | null} cur */
    const money = (n, cur) => (n == null ? dash : `${n.toFixed(2)}${cur ? ` ${cur}` : ""}`);

    const stat = (/** @type {typeof items[number]} */ it) => {
      const h = (history[it.slug] || []).filter((e) => e.c === it.currency);
      if (!h.length) return null;
      const ps = h.map((e) => e.p);
      return { low: Math.min(...ps), avg: ps.reduce((a, b) => a + b, 0) / ps.length, n: ps.length };
    };

    /** @type {Array<{ label: string, cells: string[] }>} */
    const rows = [
      { label: "Price now", cells: items.map((it) => (it.owned ? "In library" : money(it.price, it.currency))) },
      { label: "Discount", cells: items.map((it) => (it.discountPct > 0 ? `-${it.discountPct}%` : dash)) },
      { label: "Tracked low", cells: items.map((it) => { const s = stat(it); return s ? money(s.low, it.currency) : dash; }) },
      { label: "Tracked average", cells: items.map((it) => { const s = stat(it); return s ? money(s.avg, it.currency) : dash; }) },
      { label: "Rating", cells: items.map((it) => { const r = facts[it.slug]?.rating; return r ? `${r.score}/5 (${r.count})` : dash; }) },
      { label: "Critics", cells: items.map((it) => { const c = facts[it.slug]?.criticsPct; return c != null ? `${c}%` : dash; }) },
      {
        label: "Your language",
        cells: items.map((it) => {
          const langs = facts[it.slug]?.langs;
          if (!langs) return dash;
          if (!preferred.length) return dash;
          const hit = preferred.filter((p) => langs[p]);
          return hit.length ? hit.map((p) => `${p}${langs[p].a ? " (audio)" : ""}`).join(", ") : "none";
        }),
      },
      { label: "Time to beat", cells: items.map((it) => facts[it.slug]?.hours?.Main || dash) },
      { label: "Genre", cells: items.map((it) => genres[it.slug] || dash) },
      { label: "Your tags", cells: items.map((it) => (tags[it.slug]?.length ? tags[it.slug].join(", ") : dash)) },
    ];
    return { columns: items.map((it) => ({ slug: it.slug, title: it.title || it.slug })), rows };
  }

  /**
   * Price-history lines for a comparison chart: every game's snapshots converted
   * to ONE currency (so the lines are comparable), plus the shared extents.
   * Snapshots that can't be converted are left out rather than guessed.
   * @param {Array<{ slug: string, title: string }>} items
   * @param {{ history?: Record<string, Array<{ d: string, p: number, c: string }>>, rates?: Record<string, number>, target: string }} ctx
   * @returns {{ series: Array<{ slug: string, title: string, points: Array<{ t: number, p: number }> }>, minT: number, maxT: number, minP: number, maxP: number } | null}
   */
  function buildChartSeries(items, ctx) {
    const rates = ctx.rates || {};
    const to = ctx.target === "USD" ? 1 : rates[ctx.target];
    if (!(to > 0)) return null;
    const series = items
      .map((it) => {
        const points = [];
        for (const e of ctx.history?.[it.slug] || []) {
          const from = e.c === "USD" ? 1 : rates[e.c];
          const t = Date.parse(`${e.d}T00:00:00Z`);
          if (!(from > 0) || !Number.isFinite(t) || !(e.p > 0)) continue;
          points.push({ t, p: (e.p / from) * to });
        }
        points.sort((a, b) => a.t - b.t);
        return { slug: it.slug, title: it.title || it.slug, points };
      })
      .filter((s) => s.points.length >= 2);
    if (series.length < 1) return null;
    const all = series.flatMap((s) => s.points);
    return {
      series,
      minT: Math.min(...all.map((p) => p.t)),
      maxT: Math.max(...all.map((p) => p.t)),
      minP: Math.min(...all.map((p) => p.p)),
      maxP: Math.max(...all.map((p) => p.p)),
    };
  }

  const api = { tileVisibility, sanitizePresetUrl, addPreset, suggestPresetName, buildComparison, buildChartSeries };
  if (typeof window !== "undefined") window.GOGPlusCatalogTools = api;
  if (typeof self !== "undefined") self.GOGPlusCatalogTools = api;
})();
