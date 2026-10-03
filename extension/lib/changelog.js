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
    "3.0.0": [
      "🛒 Cross-store price comparison table on the game page — Steam, Epic, Humble Store, Fanatical, and GreenManGaming prices via the free CheapShark API, with a toggle in the popup (on by default), plus a 0-100 deal score next to the \"worth waiting?\" verdict",
      "Sale-calendar panel in the tag dashboard predicts GOG's next likely discount window, blending your own tracked history with a known seasonal calendar",
      "Wishlist value stat also shows the total cost if every wishlisted game were simultaneously at its own all-time low",
      "🎲 \"What to play tonight\" — a one-click random pick from your Backlog in the tag dashboard, optionally narrowed by genre, plus a \"because you like X\" recommendation strip",
      "🔒 Encrypted backup — \"Export everything\" in Advanced Options offers a password-protected (AES-256-GCM, entirely on-device) backup alongside the plain JSON one",
      "Tags CSV export/import round-trips play status (Playing/Backlog/Finished) too, not just tags and notes",
      "\"Share ↓\" button in the tag dashboard exports the currently-filtered games as a single self-contained, read-only HTML page",
      "📈 Real price-history chart in the tag dashboard — expand any tracked game's card to see its full chart, not just the game page's sparkline",
      "📊 Genre distribution chart — see which genres your tagged/tracked/status-marked games actually lean toward",
      "💰 Spending tracker — log a price alongside a purchase date on the game page's Refund window section; the dashboard totals it and can compare this month's spend against an optional budget (Advanced Options)",
      "Library year-in-review shows your \"most patient purchase\" (longest gap between first watching a game and buying it) and a multi-year snapshot trend",
      "📬 Weekly digest — a local \"This week\" panel in the popup summarizing refund windows closing soon, price-alert hits, and wishlist drops, plus a matching background job. Computed regardless of the desktop-notifications toggle",
      "🏷️ Auto-tag suggestions — untagged games in the tag dashboard show a one-click suggested tag based on GOG's own genre metadata, never applied without your click",
      "🎨 Custom theme editor — pick your own accent and background colors, plus a new high-contrast theme",
      "🔤 Optional dyslexia-friendly font stack across injected UI, no remote font downloads",
      "🏷️ Quick-add-tag from any card — hover a game card on any listing page and tag it on the spot",
      "🔍 Discoverable filter picker in the tag dashboard's search box, plus a new genre: search operator",
      "📎 Note image attachments — attach one photo per game in the tag dashboard, stored locally",
      "🏆 Achievements — local badges for tagging, tracking, and spending milestones",
      "🦊 Firefox compatibility groundwork (experimental, unverified) — see the README's browser-support section",
    ],
    "4.0.0": [
      "🧭 Adapted to gog.com's redesign — checked against the live home page, catalog and game pages. Every lookup of the site's markup now runs through one adapter that tries several strategies, so a layout change degrades gracefully instead of silently switching features off",
      "🔧 Fixes things the redesign had broken: game-page prices (which GOG now prints with CSS, so they have no currency symbol in the page text) are converted again and recorded in your price history, the game's genre is read again, and cover badges appear on the new catalog tiles",
      "🩺 New \"Check this page\" in Advanced Options — reports which of those lookups still work on the gog.com page you have open, ready to paste into a bug report",
      "🎨 New Native theme — reads gog.com's own colors and font each time a page loads, so badges and panels blend in with whatever the site currently looks like",
      "Prices written \"19,99 €\" or split across several elements are now recognized, the DRM-free banner no longer covers the site's header (it sits at the bottom edge), and everything keeps working when the site swaps its page content without a reload",
      "☁️ Sync across devices through a folder you choose (Dropbox, OneDrive, Google Drive, Syncthing…) — merges tags, notes, status, purchases, alerts and price history, optionally encrypted with a passphrase. GOG Enhancer runs no server for this",
      "🔎 Type gog in the address bar to search your own library — a game name, tag:rpg, or status:backlog",
      "⌨️ Optional keyboard navigation — J / K to move between games on a grid, T to tag; on a game page W adds to your wishlist, N opens the note, A sets a price alert (off by default)",
      "📅 Refund-deadline calendar (.ics) and 📝 Markdown export (Obsidian, Notion…) in the tag dashboard",
      "🖥️ System check on game pages — compares a game's RAM requirement with what your browser reports (RAM only; browsers can't see your CPU or GPU). Type your own OS / processor / graphics card in Advanced Options and it is compared as plain text, as an estimate",
      "💸 Smarter prices — \"is this discount real?\" (checks GOG's own lowest-in-30-days against your history), an offer countdown on the game page, cards and digest, price per hour of play, the price in several currencies at once, a per-game sale rhythm, a comparison chart for 2–3 games, \"how much I saved\" totals, and national VAT presets for DE, FR, ES, IT, NL and RU",
      "💖 Smart wishlist — sort by discount, distance from the low, converted price or date added; filter \"near the low\" and \"ending soon\"; live total; group by tag or status; export CSV, Markdown or .ics",
      "🗂️ Catalog tools — a bar above the grid: dim or hide games you own, mark games \"not interested\" (restorable), sort the page locally, compact or list density, saved filter presets, select several to tag or track at once, side-by-side comparison",
      "📚 Learns your library as you browse — reads the site's own \"IN LIBRARY\" label, fetches nothing — which powers hide-owned, real library statistics, a weighted backlog roulette (favours well-rated, short and long-waiting games), a monthly \"games to finish\" goal, and Wrapped / collector cards you can save as PNG (drawn on your device)",
      "🎮 Game-page extras — language check against the languages you care about, what changed since your last visit, review filter, similar games you own, a heads-up when a pack overlaps what you own (heuristic), \"open in\" links to Steam / IsThereAnyDeal / PCGamingWiki (plain links)",
      "📝 Note version history, an Obsidian vault export (.zip, one note per game), and CSV / line exports for Notion, Google Sheets and Trello — all files made on your device",
      "🔄 Folder sync now runs on its own — when you open the dashboard and every 30 minutes in the background (when the browser still remembers the folder permission and the file isn't passphrase-encrypted), with a list of conflicts it resolved, and optional dated backups kept in the same folder",
      "🔔 Calmer notifications — quiet hours, one summary a day instead of many, minimum drop / maximum price / only-at-the-low thresholds, alerts by tag, an optional season radar, and a weekly digest that lists offers about to end. Optionally also send them to your own webhook (an https address you type; you approve that one address in a browser prompt)",
      "🎨 Look & feel — fold the game panel (remembered), dock it beside the page, drag its sections into your order, calm mode (no glow or animation), a one-click plain look that switches the injected styling off, colour-vision palettes, text-size scaling, settings profiles, and a short tour of what's new. The Native theme now follows the site when it switches between light and dark",
      "🛡️ Every feature now runs in isolation — if gog.com changes something and one lookup breaks, only that feature switches off instead of everything after it",
    ],
  };

  // Dotted-numeric version compare (3.9.0 < 3.10.0, unlike string sort).
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
