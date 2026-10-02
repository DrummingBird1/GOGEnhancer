/**
 * GOG+ content-script utilities shared across content/features/*.js.
 * Pulled out of the former single-file content.js during the module split —
 * see CLAUDE.md's content-script load-order section.
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusContentState;

  const debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  const log = (...a) => {
    if (state.settings.debugLogging || window.GOG_PLUS_DEBUG) console.log("[GOG+]", ...a);
  };

  // Site-markup lookups live in content/gog-dom.js (the site adapter).
  const { slugFromHref, slugFromLocation, gameTitle: gameTitleFromPage } = window.GOGPlusGogDom;

  window.GOGPlusContentUtils = {
    debounce,
    log,
    slugFromHref,
    slugFromLocation,
    gameTitleFromPage,
  };
})();
