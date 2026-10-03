/**
 * GOG+ weekly digest as a page you can keep or send — one self-contained HTML
 * file built on this device from the same `weeklyDigest` record the popup's
 * "This week" panel shows.
 *
 * The file has no script, no external stylesheet, font or image, and makes no
 * request when opened; every string that came from stored data goes through
 * `esc` first. Links go to the game's page on gog.com and open in a new tab
 * with `rel="noopener noreferrer"`.
 */
// @ts-check

(() => {
  "use strict";

  /** @param {unknown} s */
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  /** @param {string} slug */
  const defaultTitle = (slug) =>
    slug
      .split("_")
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ");

  /** @type {Record<string, string>} */
  const SYMBOLS = { USD: "$", EUR: "€", GBP: "£", ILS: "₪", PLN: "zł", RUB: "₽" };

  /**
   * @typedef {{
   *   generatedAt: number,
   *   dropsThisWeek?: number,
   *   refundClosing?: Array<{ slug: string, daysLeft: number }>,
   *   priceAlertHits?: Array<{ slug: string, price: number, currency: string, threshold?: number }>,
   *   wishlistDrops?: Array<{ slug: string, price?: number, currency?: string, dropPct: number }>,
   *   endingSoon?: Array<{ slug: string, endsAt: number }>
   * }} Digest
   */

  /**
   * How many things in the digest need attention (the drop count alone is trivia).
   * @param {Digest | null | undefined} d
   */
  function highlightCount(d) {
    return d ? (d.refundClosing?.length || 0) + (d.priceAlertHits?.length || 0) + (d.wishlistDrops?.length || 0) + (d.endingSoon?.length || 0) : 0;
  }

  /**
   * @param {Digest} digest
   * @param {{ titleOf?: (slug: string) => string }} [opts]
   * @returns {string} a complete HTML document
   */
  function build(digest, opts = {}) {
    const titleOf = opts.titleOf || defaultTitle;
    const now = digest.generatedAt || Date.now();
    const when = new Date(now).toISOString().slice(0, 10);

    /** @param {string} slug @param {string} meta */
    const item = (slug, meta) =>
      `<li><a href="https://www.gog.com/en/game/${encodeURIComponent(slug)}" target="_blank" rel="noopener noreferrer">${esc(titleOf(slug))}</a><span>${esc(meta)}</span></li>`;
    /** @param {string} title @param {string[]} items */
    const section = (title, items) => (items.length ? `<section><h2>${esc(title)}</h2><ul>${items.join("")}</ul></section>` : "");

    const parts = [
      section(
        "Refund windows closing",
        (digest.refundClosing || []).map((r) => item(r.slug, `closes in ${r.daysLeft} day${r.daysLeft === 1 ? "" : "s"}`))
      ),
      section(
        "Price alerts that hit",
        (digest.priceAlertHits || []).map((p) => item(p.slug, `${SYMBOLS[p.currency] || p.currency + " "}${Number(p.price).toFixed(2)}${p.threshold != null ? ` (alert at ${Number(p.threshold).toFixed(2)})` : ""}`))
      ),
      section(
        "Wishlist drops",
        (digest.wishlistDrops || []).map((w) => item(w.slug, `${w.dropPct}% below its peak${w.price != null ? ` · ${SYMBOLS[w.currency || ""] || (w.currency || "") + " "}${Number(w.price).toFixed(2)}` : ""}`))
      ),
      section(
        "Offers ending soon",
        (digest.endingSoon || []).map((e) => {
          const days = Math.max(0, Math.ceil((e.endsAt - now) / 86400000));
          return item(e.slug, days <= 1 ? "ends within a day" : `ends in ${days} days`);
        })
      ),
    ].filter(Boolean);

    const body = parts.length ? parts.join("") : "<p>Nothing needs your attention this week.</p>";
    const drops = digest.dropsThisWeek ? `<p class="muted">${esc(digest.dropsThisWeek)} price drop${digest.dropsThisWeek === 1 ? "" : "s"} across the games you track this week.</p>` : "";

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>GOG Enhancer — this week (${esc(when)})</title>
<style>
  :root { --bg: #fafafa; --fg: #1b1b24; --muted: #6a6a78; --card: #fff; --line: #e3e3ea; --accent: #7a2fc8; }
  @media (prefers-color-scheme: dark) { :root { --bg: #14101f; --fg: #f1eafc; --muted: #a99fc0; --card: #1d1830; --line: #34294f; --accent: #b98cff; } }
  body { margin: 0; padding: 24px 16px; background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, "Segoe UI", sans-serif; }
  main { max-width: 640px; margin: 0 auto; }
  h1 { margin: 0 0 4px; font-size: 24px; }
  h2 { margin: 24px 0 8px; font-size: 14px; letter-spacing: .06em; text-transform: uppercase; color: var(--accent); }
  section { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 4px 16px 12px; margin-top: 16px; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid var(--line); }
  li:first-child { border-top: 0; }
  li span, .muted { color: var(--muted); font-size: 14px; }
  a { color: inherit; font-weight: 600; text-decoration-color: var(--accent); }
  footer { margin-top: 28px; color: var(--muted); font-size: 12px; }
</style>
</head>
<body>
<main>
<h1>This week on GOG</h1>
<p class="muted">Generated ${esc(when)} from the games and wishlist GOG Enhancer tracks for you.</p>
${body}
${drops}
<footer>Made locally in your browser by GOG Enhancer — nothing was uploaded. This page has no scripts and loads nothing from the internet.</footer>
</main>
</body>
</html>
`;
  }

  /** @param {number} now */
  const fileName = (now) => `gog-enhancer-digest-${new Date(now).toISOString().slice(0, 10)}.html`;

  const api = { esc, build, fileName, highlightCount };
  if (typeof window !== "undefined") /** @type {any} */ (window).GOGPlusDigestHtml = api;
  if (typeof self !== "undefined") /** @type {any} */ (self).GOGPlusDigestHtml = api;
})();
