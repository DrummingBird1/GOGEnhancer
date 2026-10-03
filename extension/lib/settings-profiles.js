/**
 * GOG+ settings profiles — three one-click starting points for the many
 * switches: "Minimal" (the essentials, nothing decorative), "Full" (everything
 * the extension offers) and "Accessible" (calm, large, high-contrast, keyboard
 * friendly). A profile only sets the keys it names; it never touches data
 * (tags, notes, history), the currency / region settings or the notification
 * and sync setup — those are about the user, not about how busy the UI is.
 *
 * Pure: `applyProfile` returns the changes, the caller stores them.
 */
// @ts-check

(() => {
  "use strict";

  /** Everything a profile may set. Anything else is ignored. */
  const PROFILE_KEYS = [
    "designInjection", "cleanLayout", "skeletonLoaders", "richTooltips", "theme", "palette", "uiScale",
    "calmMode", "plainLook", "dyslexiaFont", "keyboardNav", "panelSticky",
    "refundBadge", "modIndicator", "lowestPriceBadge", "itadCompare", "priceCompareTable",
    "realDiscountCheck", "offerTimer", "pricePerHour", "currencyTable", "saleForecast",
    "languageMeter", "changesSinceVisit", "reviewTools", "similarOwned", "openInLinks",
    "catalogTools", "wishlistSmart", "sysReqCheck", "wishlistFilters",
  ];

  /** @type {Record<string, { label: string, description: string, settings: Record<string, any> }>} */
  const PROFILES = {
    minimal: {
      label: "Minimal",
      description: "Currency conversion, price history, the deal check and tags — no decoration, no extra bars.",
      settings: {
        designInjection: false, cleanLayout: false, skeletonLoaders: false, richTooltips: false,
        theme: "native", calmMode: true, plainLook: false, panelSticky: false,
        refundBadge: false, modIndicator: false, lowestPriceBadge: true, itadCompare: false, priceCompareTable: false,
        realDiscountCheck: true, offerTimer: true, pricePerHour: false, currencyTable: false, saleForecast: false,
        languageMeter: false, changesSinceVisit: false, reviewTools: false, similarOwned: false, openInLinks: false,
        catalogTools: false, wishlistSmart: false, sysReqCheck: false, wishlistFilters: false,
      },
    },
    full: {
      label: "Full",
      description: "Everything on, including keyboard shortcuts.",
      settings: {
        designInjection: true, cleanLayout: true, skeletonLoaders: true, richTooltips: true, calmMode: false,
        plainLook: false, keyboardNav: true,
        refundBadge: true, modIndicator: true, lowestPriceBadge: true, itadCompare: true, priceCompareTable: true,
        realDiscountCheck: true, offerTimer: true, pricePerHour: true, currencyTable: true, saleForecast: true,
        languageMeter: true, changesSinceVisit: true, reviewTools: true, similarOwned: true, openInLinks: true,
        catalogTools: true, wishlistSmart: true, sysReqCheck: true, wishlistFilters: true,
      },
    },
    accessible: {
      label: "Accessible",
      description: "High contrast, calm (no glow or motion), larger text, dyslexia-friendly font and keyboard shortcuts.",
      settings: {
        designInjection: false, skeletonLoaders: false, richTooltips: false, theme: "highcontrast", palette: "high-contrast",
        uiScale: 1.25, calmMode: true, plainLook: false, dyslexiaFont: true, keyboardNav: true, panelSticky: false,
      },
    },
  };

  /**
   * @param {string} id
   * @returns {Record<string, any> | null} the settings to store, or null for an unknown profile
   */
  function applyProfile(id) {
    const p = PROFILES[id];
    if (!p) return null;
    /** @type {Record<string, any>} */
    const out = {};
    for (const k of PROFILE_KEYS) if (k in p.settings) out[k] = p.settings[k];
    return out;
  }

  /**
   * Which profile the current settings match exactly (on the keys that profile
   * names), or null.
   * @param {Record<string, any>} current
   * @returns {string | null}
   */
  function matchingProfile(current) {
    for (const [id, p] of Object.entries(PROFILES)) {
      const keys = Object.keys(p.settings).filter((k) => PROFILE_KEYS.includes(k));
      if (keys.every((k) => current[k] === p.settings[k])) return id;
    }
    return null;
  }

  const api = { PROFILE_KEYS, PROFILES, applyProfile, matchingProfile };
  if (typeof window !== "undefined") window.GOGPlusSettingsProfiles = api;
  if (typeof self !== "undefined") self.GOGPlusSettingsProfiles = api;
})();
