/**
 * GOG+ content-script utilities shared across content/features/*.js.
 * Pulled out of the former single-file content.js during the v2.8.0 module
 * split — see CLAUDE.md's content-script load-order section.
 */

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

  const slugFromHref = (href) => {
    const m = (href || "").match(/\/game\/([a-z0-9_]+)/);
    return m ? m[1] : null;
  };

  const slugFromLocation = () => slugFromHref(location.pathname);

  const gameTitleFromPage = () => {
    const h1 =
      document.querySelector("h1.productcard-basics__title") ||
      document.querySelector("h1[class*='product'][class*='title']") ||
      document.querySelector("h1");
    if (h1) return (h1.textContent || "").trim();
    const og = document.querySelector("meta[property='og:title']");
    if (og) return (og.getAttribute("content") || "").replace(/\s*on GOG\.com\s*$/, "");
    return null;
  };

  window.GOGPlusContentUtils = {
    debounce,
    log,
    slugFromHref,
    slugFromLocation,
    gameTitleFromPage,
  };
})();
