/**
 * GOG+ DOM-safety helpers.
 *
 * Was independently implemented in both content.js and tags.js (two copies
 * to keep synchronized by hand). Single source of truth now — both files
 * destructure escapeHtml from window.GOGPlusDomSafety instead.
 *
 * escapeHtml() is the only thing standing between a tag name, a note, or any
 * other user-typed string and an innerHTML assignment (tooltips, the tag
 * dashboard, the game panel). Every call site that interpolates user data
 * into HTML MUST route it through this first — see the "No innerHTML for
 * user input" guard in CLAUDE.md.
 */
// @ts-check

(() => {
  "use strict";

  /**
   * @param {unknown} s
   * @returns {string}
   */
  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const api = { escapeHtml };
  if (typeof window !== "undefined") window.GOGPlusDomSafety = api;
  if (typeof self !== "undefined") self.GOGPlusDomSafety = api;
})();
