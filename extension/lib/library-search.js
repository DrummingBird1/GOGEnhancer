/**
 * GOG+ library search — what the address-bar keyword ("gog <query>") searches.
 *
 * Pure functions over the same storage shapes the rest of the extension uses,
 * so the service worker can feed it straight from chrome.storage.local.
 *
 * Query syntax (all terms must match):
 *   witcher            substring of the game's title or any of its tags
 *   tag:rpg            has a tag containing "rpg"
 *   status:backlog     play status is exactly "backlog"
 */
// @ts-check

(() => {
  "use strict";

  /** @param {string} slug */
  function humanize(slug) {
    return slug
      .split("_")
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ");
  }

  /**
   * @typedef {Object} LibraryData
   * @property {Record<string, string[]>} [tags]
   * @property {Record<string, string>} [notes]
   * @property {Record<string, string>} [gameStatus]
   * @property {Record<string, any>} [purchaseLog]
   * @property {string[]} [wishlistSlugs]
   * @property {Record<string, any>} [priceHistory]
   */

  /**
   * @typedef {{ slug: string, title: string, tags: string[], status: string }} SearchResult
   */

  /**
   * @param {LibraryData} data
   * @param {string} query
   * @param {number} [limit]
   * @returns {SearchResult[]}
   */
  function searchLibrary(data, query, limit = 6) {
    const tags = data.tags || {};
    const status = data.gameStatus || {};
    const slugs = new Set([
      ...Object.keys(tags),
      ...Object.keys(data.notes || {}),
      ...Object.keys(status),
      ...Object.keys(data.purchaseLog || {}),
      ...(data.wishlistSlugs || []),
      ...Object.keys(data.priceHistory || {}),
    ]);

    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    /** @type {Array<SearchResult & { score: number }>} */
    const hits = [];
    for (const slug of slugs) {
      const title = humanize(slug);
      const lowerTitle = title.toLowerCase();
      const slugTags = (tags[slug] || []).map((t) => t.toLowerCase());
      let score = 0;
      let ok = true;
      for (const term of terms) {
        if (term.startsWith("tag:")) {
          const want = term.slice(4);
          if (!want || !slugTags.some((t) => t.includes(want))) ok = false;
        } else if (term.startsWith("status:")) {
          const want = term.slice(7);
          if (!want || status[slug] !== want) ok = false;
        } else if (lowerTitle.startsWith(term)) {
          score += 3;
        } else if (lowerTitle.includes(` ${term}`)) {
          score += 2;
        } else if (lowerTitle.includes(term)) {
          score += 1;
        } else if (slugTags.some((t) => t.includes(term))) {
          score += 1;
        } else {
          ok = false;
        }
        if (!ok) break;
      }
      if (ok) hits.push({ slug, title, tags: tags[slug] || [], status: status[slug] || "", score });
    }
    hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    return hits.slice(0, limit).map(({ score: _score, ...rest }) => rest);
  }

  /** Escapes text for the omnibox's XML-ish suggestion markup. @param {string} s */
  function escapeXml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * One suggestion row: the title highlighted, tags and status dimmed.
   * @param {SearchResult} r
   */
  function suggestionFor(r) {
    const extra = [...r.tags.map((t) => `#${t}`), r.status].filter(Boolean).join(" · ");
    return {
      content: `slug:${r.slug}`,
      description: `<match>${escapeXml(r.title)}</match>${extra ? ` <dim>${escapeXml(extra)}</dim>` : ""}`,
    };
  }

  /**
   * Where Enter should go: a suggestion ("slug:<slug>") opens that game's
   * page; free text runs GOG's own store search.
   * @param {string} text
   * @returns {string}
   */
  function resolveOmniboxInput(text) {
    const t = text.trim();
    const m = t.match(/^slug:([a-z0-9_]+)$/);
    if (m) return `https://www.gog.com/en/game/${m[1]}`;
    if (!t) return "https://www.gog.com/en/games";
    return `https://www.gog.com/en/games?query=${encodeURIComponent(t)}`;
  }

  const api = { humanize, searchLibrary, escapeXml, suggestionFor, resolveOmniboxInput };
  if (typeof window !== "undefined") window.GOGPlusLibrarySearch = api;
  if (typeof self !== "undefined") self.GOGPlusLibrarySearch = api;
})();
