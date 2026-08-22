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
      "No visible changes — a full internal rewrite of how the extension's code is organized, to make future updates faster and safer. Every feature was re-tested end to end before shipping.",
    ],
    "2.9.0": [
      "⌘K / Ctrl+K command palette — quick access to settings, the tag dashboard, and force-refreshes without hunting through menus",
      "Wishlist-wide price alerts — get notified when any wishlisted game drops off its tracked peak price, no per-game setup needed (Advanced Options)",
      "New Playing / Backlog / Finished status per game, separate from tags — set it on the game page or in the tag dashboard, filter with status:playing",
      "New Auto theme that follows your system's light/dark preference",
      "Search box in Advanced Options — the page has a lot of settings now",
      "Deleting a tag now shows an undoable toast instead of a blocking confirmation",
      "Small chart & animation polish, plus a reduced-motion pass for anyone who prefers less movement",
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
