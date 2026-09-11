/**
 * GOG+ changelog data + "what's new" version-range helper.
 *
 * GOG_PLUS_CHANGELOG is keyed by version string; each value is a short list
 * of user-facing bullets (same substance as the README changelog, trimmed
 * for the popup's width). Add an entry here whenever manifest.json's
 * `version` bumps for a change worth surfacing to the user.
 *
 * Not a content-script module — loaded only where it's shown (popup.html),
 * same pattern as lib/i18n.js.
 */
// @ts-check

(() => {
  "use strict";

  /** @type {Record<string, string[]>} */
  const CHANGELOG = {
    "2.5.0": [
      "💎 Lowest-price badge on cards at their tracked all-time low",
      "Stale-rate warning + exact rate shown on converted prices",
      "Tag-colour dot on cards you've tagged",
    ],
    "2.5.1": [
      "✨ This panel — a short changelog now shows here after every update",
    ],
    "2.6.0": [
      "Genre-aware card styling now reads the real genre off each game's own page (Horror, Role-playing, Strategy) instead of only a hand-picked franchise list — covers far more titles the more you visit",
    ],
    "2.7.0": [
      "Importing a settings backup is now safer — it runs the same upgrade check a normal update would, so an old export can't silently load outdated data",
      "Storage-used % in the tag dashboard is now exact (was an estimate that had drifted out of sync)",
      "A big pass of under-the-hood reliability, security, and testing work — nothing to click, just a sturdier foundation",
    ],
    "2.8.0": [
      "⌘K / Ctrl+K command palette — quick access to settings, the tag dashboard, and force-refreshes without hunting through menus",
      "Wishlist-wide price alerts — get notified when any wishlisted game drops off its tracked peak price, no per-game setup needed (Advanced Options)",
      "New Playing / Backlog / Finished status per game, separate from tags — set it on the game page or in the tag dashboard, filter with status:playing",
      "New Auto theme that follows your system's light/dark preference",
      "Interface language selector — 7 languages available in Advanced Options (English, Hebrew, Russian, Polish, German, French, Spanish)",
      "Search box in Advanced Options — the page has a lot of settings now",
      "Deleting a tag now shows an undoable toast instead of a blocking confirmation",
      "Small chart & animation polish, plus a reduced-motion pass for anyone who prefers less movement",
      "A full internal rewrite of how the extension's code is organized, to make future updates faster and safer. Every feature was re-tested end to end before shipping.",
    ],
    "2.9.0": [
      "🔥 Wishlist deals — the popup now shows your top 3 wishlisted price drops with a link straight to each game",
      "\"Worth waiting?\" verdict on the game-page price panel — tells you at a glance whether now's a good time to buy or worth holding out for a sale",
      "New Wishlist value stat in the tag dashboard, with a one-click CSV export of every wishlisted game's tracked price",
      "Replaced the single Patreon link with three: Ko-fi, Buy Me a Coffee, and Patreon — pick whichever you already use",
      "Two more stale \"v2.4\" version badges fixed (onboarding wizard, options page footer)",
      "A large pass of under-the-hood testing and type-checking work — extension-wide test coverage roughly doubled and now covers every top-level page script, closing real gaps that had zero tests before",
    ],
    "2.10.0": [
      "🛒 Cross-store price comparison table on the game page — Steam, Epic, Humble Store, Fanatical, and GreenManGaming prices via the free CheapShark API, with a toggle in the popup (on by default)",
      "New 0-100 deal score next to the existing \"worth waiting?\" verdict",
      "Sale-calendar panel in the tag dashboard now predicts GOG's next likely discount window, blending your own tracked history with a known seasonal calendar",
      "Wishlist value stat now also shows the total cost if every wishlisted game were simultaneously at its own all-time low",
    ],
    "2.11.0": [
      "🎲 \"What to play tonight\" — a one-click random pick from your Backlog in the tag dashboard, optionally narrowed by genre, plus a \"because you like X\" recommendation strip",
      "🔒 Encrypted backup — \"Export everything\" in Advanced Options now offers a password-protected (AES-256-GCM, entirely on-device) backup alongside the existing plain JSON one",
      "Tags CSV export/import now round-trips play status (Playing/Backlog/Finished) too, not just tags and notes",
      "New \"Share ↓\" button in the tag dashboard exports the currently-filtered games as a single self-contained, read-only HTML page",
    ],
    "2.12.0": [
      "📈 Real price-history chart in the tag dashboard — expand any tracked game's card to see its full chart, not just the game page's sparkline",
      "📊 Genre distribution chart — see which genres your tagged/tracked/status-marked games actually lean toward",
      "💰 Spending tracker — log a price alongside a purchase date on the game page's Refund window section; the dashboard totals it and can compare this month's spend against an optional budget (Advanced Options)",
      "Library year-in-review now shows your \"most patient purchase\" (longest gap between first watching a game and buying it) and a multi-year snapshot trend when you have more than one year of history",
    ],
    "2.13.0": [
      "📬 Weekly digest — a new local \"This week\" panel in the popup summarizing refund windows closing soon, price-alert hits, and wishlist drops, plus a matching background job (Advanced Options → Background sync). Computed regardless of the desktop-notifications toggle, so it's useful even with notifications off",
      "🏷️ Auto-tag suggestions — untagged games in the tag dashboard now show a one-click suggested tag based on GOG's own genre metadata, never applied without your click",
    ],
  };

  // Dotted-numeric version compare (2.9.0 < 2.10.0, unlike string sort).
  // Returns -1 / 0 / 1 like a standard sort comparator.
  /**
   * @param {string} a
   * @param {string} b
   * @returns {-1 | 0 | 1}
   */
  function compareVersions(a, b) {
    const pa = String(a || "0").split(".").map(Number);
    const pb = String(b || "0").split(".").map(Number);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na !== nb) return na < nb ? -1 : 1;
    }
    return 0;
  }

  // Every changelog-having version strictly newer than `lastSeen`, up to and
  // including `current`, ascending. An empty `lastSeen` means "never shown
  // anything before" (fresh install or pre-feature user) — in that case we
  // only surface `current`, not the whole history, so the popup doesn't dump
  // every past release on someone who just hasn't dismissed one yet.
  /**
   * @param {string} lastSeen
   * @param {string} current
   * @param {Record<string, string[]>} [changelog]
   * @returns {string[]}
   */
  function versionsSince(lastSeen, current, changelog = CHANGELOG) {
    const known = Object.keys(changelog).sort(compareVersions);
    if (!lastSeen) {
      return known.includes(current) ? [current] : [];
    }
    return known.filter(
      (v) => compareVersions(v, lastSeen) > 0 && compareVersions(v, current) <= 0
    );
  }

  const api = { CHANGELOG, compareVersions, versionsSince };
  if (typeof window !== "undefined") window.GOGPlusChangelog = api;
  if (typeof self !== "undefined") self.GOGPlusChangelog = api;
})();
