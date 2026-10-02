/**
 * GOG+ Markdown export of the library — for Obsidian, Notion, or any notes
 * app that reads Markdown. Games are grouped by play status; tags become
 * #hashtags (sanitized, since Obsidian tags can't contain spaces); notes
 * become blockquotes under their game.
 */
// @ts-check

(() => {
  "use strict";

  /** @typedef {{ date: string, price?: number, currency?: string }} PurchaseLike */

  const STATUS_GROUPS = [
    ["playing", "Playing"],
    ["backlog", "Backlog"],
    ["finished", "Finished"],
  ];

  /**
   * "Open World" → "Open-World"; punctuation is dropped. Obsidian additionally
   * rejects tags that are only digits, so those are skipped (empty string).
   * @param {string} tag
   */
  function toHashtag(tag) {
    const clean = tag
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\p{L}\p{N}_/-]/gu, "")
      .replace(/^-+|-+$/g, "");
    return clean && /\D/.test(clean) ? `#${clean}` : "";
  }

  /** Escapes characters that would break a Markdown link label. @param {string} s */
  function escapeLabel(s) {
    return s.replace(/([\\[\]])/g, "\\$1");
  }

  /** @param {string} slug */
  function defaultTitle(slug) {
    return slug
      .split("_")
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ");
  }

  /**
   * @param {{
   *   slugs: string[],
   *   tags?: Record<string, string[]>,
   *   notes?: Record<string, string>,
   *   status?: Record<string, string>,
   *   purchases?: Record<string, PurchaseLike>,
   * }} data
   * @param {{ titleOf?: (slug: string) => string, now?: number, heading?: string }} [opts]
   * @returns {string}
   */
  function buildLibraryMarkdown(data, opts = {}) {
    const titleOf = opts.titleOf ?? defaultTitle;
    const date = new Date(opts.now ?? Date.now()).toISOString().slice(0, 10);
    const tags = data.tags || {};
    const notes = data.notes || {};
    const status = data.status || {};
    const purchases = data.purchases || {};

    /** @param {string} slug */
    const entry = (slug) => {
      const hashtags = (tags[slug] || []).map(toHashtag).filter(Boolean);
      const bought = purchases[slug];
      const meta = [];
      if (bought?.date) {
        meta.push(
          `bought ${bought.date}${bought.price != null && bought.currency ? ` (${bought.price} ${bought.currency})` : ""}`
        );
      }
      const head =
        `- [${escapeLabel(titleOf(slug))}](https://www.gog.com/en/game/${encodeURIComponent(slug)})` +
        (hashtags.length ? ` ${hashtags.join(" ")}` : "") +
        (meta.length ? ` — ${meta.join(", ")}` : "");
      const note = (notes[slug] || "").trim();
      if (!note) return head;
      const quoted = note
        .split(/\r?\n/)
        .map((l) => (l.trim() ? `  > ${l}` : "  >"))
        .join("\n");
      return `${head}\n${quoted}`;
    };

    const known = new Set(STATUS_GROUPS.map(([id]) => id));
    /** @type {Array<[string, string[]]>} */
    const groups = STATUS_GROUPS.map(([id, label]) => [
      label,
      data.slugs.filter((s) => status[s] === id),
    ]);
    groups.push(["No status", data.slugs.filter((s) => !known.has(status[s]))]);

    const lines = [
      `# ${opts.heading ?? "My GOG library"}`,
      "",
      `_Exported ${date} by GOG Enhancer · ${data.slugs.length} game${data.slugs.length === 1 ? "" : "s"}_`,
    ];
    for (const [label, slugs] of groups) {
      if (!slugs.length) continue;
      lines.push("", `## ${label}`, "", ...slugs.map(entry));
    }
    return lines.join("\n") + "\n";
  }

  const api = { toHashtag, buildLibraryMarkdown };
  if (typeof window !== "undefined") window.GOGPlusMarkdownExport = api;
  if (typeof self !== "undefined") self.GOGPlusMarkdownExport = api;
})();
