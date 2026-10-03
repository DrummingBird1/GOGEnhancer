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
      "🧭 Rebuilt for gog.com's redesign — every lookup of the site's markup now goes through one adapter that tries several strategies, each feature runs in isolation, and prices GOG prints with CSS are converted and recorded again",
      "💸 Smarter prices — “is this discount real?”, an offer countdown, price per hour of play, the price in several currencies, a smart wishlist and catalog tools (dim or hide games you own, local sorting, side-by-side comparison)",
      "📚 Learns your library as you browse (only from pages you open) and shows what a pack really contains — with a warning when it overlaps games you own",
      "🌍 The tag dashboard, Advanced Options, popup and first-run wizard are now available in all seven interface languages, with Hebrew laid out right-to-left",
      "🔒 A privacy dashboard in Advanced Options lists every address the extension contacted and everything it keeps on your device — and a test now fails the build if that ever stops being true",
      "☁️ Sync across devices through a folder you choose (Dropbox, OneDrive, Google Drive, Syncthing…), with automatic backups, conflict reporting and optional passphrase encryption — no server involved",
      "🔔 Calmer notifications — quiet hours, one summary a day, thresholds, alerts by tag, a season radar, a weekly digest you can save as a web page, and an optional webhook to an address you own",
      "♾️ Optional endless scrolling in catalogs (off by default) — asks GOG's own catalog API for the next page of the list you're already looking at",
      "📅 Calendar files (.ics) for refund deadlines and for wishlisted games' release dates, Markdown / Obsidian / CSV exports, and a wishlist card you can save as a PNG — all made on your device",
      "🏆 36 achievements in three tiers (some hidden), monthly challenges and a streak",
      "🔎 Type gog in the address bar to search your own library; optional J / K / T keyboard navigation on game grids",
      "🎮 Game-page extras — language check, what changed since your last visit, review filter, similar games you own, a RAM check, “open in” links",
      "🎨 Look & feel — a Native theme that follows the site, calm mode, a plain look, colour-vision palettes, text size, settings profiles, a foldable / dockable / reorderable game panel, and a short tour",
      "♿ The dashboard works from the keyboard — a skip link, tags reordered with Alt + ↑ / ↓, menus and dialogs that hold focus and announce changes to screen readers",
      "🩺 “Check this page” reports which lookups still work on the page you have open, and the popup offers a one-click, address-free report when a feature stops working after a site change",
      "🦊 An experimental Firefox build is attached to the release (clean under web-ext lint, but not yet tried in a real Firefox)",
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
