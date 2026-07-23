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

(() => {
  "use strict";

  const CHANGELOG = {
    "2.5.0": [
      "💎 Lowest-price badge on cards at their tracked all-time low",
      "Stale-rate warning + exact rate shown on converted prices",
      "Tag-colour dot on cards you've tagged",
    ],
    "2.5.1": [
      "✨ This panel — a short changelog now shows here after every update",
    ],
  };

  // Dotted-numeric version compare (2.9.0 < 2.10.0, unlike string sort).
  // Returns -1 / 0 / 1 like a standard sort comparator.
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
