/**
 * GOG+ library exports for other tools — a CSV that opens in Google Sheets,
 * Excel or Notion (database import) with one row per game, and plain lines for
 * Trello's "add multiple cards" box. Local files / clipboard text only; no
 * integration talks to any service, so nothing about the library leaves the
 * device unless the user themselves pastes or uploads the result.
 */
// @ts-check

(() => {
  "use strict";

  /** @param {string} s */
  const cell = (s) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

  /** @param {string} slug */
  const titleFromSlug = (slug) => slug.split("_").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");

  /** @param {Record<string, any>} data @returns {string[]} every game the library knows something about */
  function knownSlugs(data) {
    const set = new Set([
      ...Object.keys(data.tags || {}).filter((s) => (data.tags[s] || []).length),
      ...Object.keys(data.notes || {}).filter((s) => data.notes[s]),
      ...Object.keys(data.gameStatus || {}),
      ...Object.keys(data.purchaseLog || {}),
      ...Object.keys(data.ownedSlugs || {}),
      ...Object.keys(data.priceHistory || {}),
    ]);
    return [...set].sort();
  }

  const COLUMNS = [
    "Title", "Slug", "URL", "Status", "Owned", "Tags", "Note", "Purchased", "Paid", "Currency",
    "Rating", "Released", "Genre", "Latest price", "Tracked low",
  ];

  /**
   * One row per known game. Tags are comma-separated in a single column, which
   * Notion imports as a multi-select and Sheets shows as text.
   * @param {Record<string, any>} data
   * @returns {string} RFC 4180 CSV (CRLF)
   */
  function libraryCsv(data) {
    const lines = [COLUMNS.join(",")];
    for (const slug of knownSlugs(data)) {
      const raw = data.purchaseLog?.[slug];
      const purchase = typeof raw === "string" ? { date: raw } : raw || {};
      const hist = data.priceHistory?.[slug] || [];
      const latest = hist[hist.length - 1];
      const same = latest ? hist.filter((/** @type {any} */ e) => e.c === latest.c).map((/** @type {any} */ e) => e.p) : [];
      const facts = data.gameFacts?.[slug];
      lines.push(
        [
          cell(facts?.title || titleFromSlug(slug)),
          cell(slug),
          cell(`https://www.gog.com/en/game/${slug}`),
          cell(data.gameStatus?.[slug] || ""),
          data.ownedSlugs?.[slug] ? "yes" : "",
          cell((data.tags?.[slug] || []).join(", ")),
          cell(String(data.notes?.[slug] || "").replace(/\r?\n/g, " ").slice(0, 500)),
          purchase.date || "",
          typeof purchase.price === "number" ? purchase.price.toFixed(2) : "",
          cell(purchase.currency || ""),
          facts?.rating ? String(facts.rating.score) : "",
          facts?.year ? String(facts.year) : "",
          cell(data.gameGenres?.[slug] || ""),
          latest ? latest.p.toFixed(2) : "",
          same.length ? Math.min(...same).toFixed(2) : "",
        ].join(",")
      );
    }
    return lines.join("\r\n") + "\r\n";
  }

  /**
   * One line per game, ready to paste into Trello's "add multiple cards" box
   * (each line becomes a card).
   * @param {Record<string, any>} data
   * @param {{ status?: string, onlyWishlist?: boolean }} [opts]
   * @returns {string}
   */
  function trelloLines(data, opts = {}) {
    const wish = new Set(data.wishlistSlugs || []);
    const slugs = knownSlugs(data).concat([...wish].filter((s) => !knownSlugs(data).includes(s)));
    const out = [];
    for (const slug of slugs.sort()) {
      if (opts.status && data.gameStatus?.[slug] !== opts.status) continue;
      if (opts.onlyWishlist && !wish.has(slug)) continue;
      const parts = [data.gameFacts?.[slug]?.title || titleFromSlug(slug)];
      if (data.gameStatus?.[slug]) parts.push(data.gameStatus[slug]);
      const hist = data.priceHistory?.[slug] || [];
      const latest = hist[hist.length - 1];
      if (latest) parts.push(`${latest.p.toFixed(2)} ${latest.c}`);
      out.push(parts.join(" — "));
    }
    return out.join("\n");
  }

  const api = { COLUMNS, knownSlugs, libraryCsv, trelloLines };
  if (typeof window !== "undefined") window.GOGPlusExportFormats = api;
  if (typeof self !== "undefined") self.GOGPlusExportFormats = api;
})();
