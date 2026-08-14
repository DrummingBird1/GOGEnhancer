/**
 * GOG+ canonical settings defaults.
 *
 * Single source of truth across the service worker, content scripts,
 * popup, options, onboarding, and tag dashboard. Consumers grab the
 * whole object or just the keys they need:
 *
 *   const { enabled, targetCurrency } = window.GOG_PLUS_DEFAULTS;
 *
 * If you add a new persisted key here, also register it in the
 * SYNC_KEYS / LOCAL_KEYS partition in lib/storage.js so reads/writes
 * route to the right storage area.
 */
// @ts-check

(() => {
  "use strict";

  const SETTINGS_VERSION = 2;

  /**
   * @typedef {Object} Settings
   * @property {number} settingsVersion
   * @property {boolean} onboardingComplete
   * @property {boolean} enabled
   * @property {boolean} currencyConverter
   * @property {boolean} taxEstimator
   * @property {boolean} refundBadge
   * @property {boolean} drmFreeBanner
   * @property {boolean} hideExpiredSales
   * @property {boolean} hebrewTranslations
   * @property {boolean} rtlLayout
   * @property {boolean} customTags
   * @property {boolean} wishlistFilters
   * @property {boolean} modIndicator
   * @property {boolean} cleanLayout
   * @property {boolean} designInjection
   * @property {boolean} priceHistoryTracking
   * @property {boolean} lowestPriceBadge
   * @property {boolean} itadCompare
   * @property {boolean} richTooltips
   * @property {boolean} skeletonLoaders
   * @property {boolean} wishlistAlerts
   * @property {boolean} refundTimer
   * @property {boolean} desktopNotifications
   * @property {boolean} debugLogging
   * @property {number} historyMaxEntries
   * @property {string} targetCurrency
   * @property {Record<string, number>} rates units-per-USD, e.g. { ILS: 3.65 }
   * @property {number} ratesUpdatedAt epoch ms, 0 = never fetched
   * @property {string | null} lastFxError
   * @property {number} vatPercent
   * @property {string} vatLabel
   * @property {string} regionPreset
   * @property {string} theme
   * @property {string} uiLanguage
   * @property {string[]} modsList
   * @property {number} modsUpdatedAt
   * @property {{ discountedCount: number, total: number }} wishlistCache
   * @property {number} wishlistCacheUpdatedAt
   * @property {Record<string, string[]>} tags slug -> tag names
   * @property {Record<string, string>} tagColors tag name -> #hex
   * @property {string[]} tagOrder
   * @property {Record<string, string>} notes slug -> free text
   * @property {Record<string, Array<{d: string, p: number, c: string}>>} priceHistory slug -> snapshots
   * @property {Record<string, string>} purchaseLog slug -> "YYYY-MM-DD"
   * @property {Record<string, number>} notifLog dedupe keys -> epoch ms
   * @property {Record<string, {threshold: number, currency: string, createdAt: number}>} priceAlerts
   * @property {"comfortable" | "compact"} tagDashboardDensity
   * @property {string} lastSeenVersion last changelog version acknowledged in the popup
   * @property {Record<string, string>} gameGenres slug -> genre bucket, cached on visit
   */

  /** @type {Settings} */
  const DEFAULTS = {
    // version + onboarding
    settingsVersion: SETTINGS_VERSION,
    onboardingComplete: false,

    // feature toggles
    enabled: true,
    currencyConverter: true,
    taxEstimator: true,
    refundBadge: true,
    drmFreeBanner: true,
    hideExpiredSales: true,
    hebrewTranslations: false,
    rtlLayout: false,
    customTags: true,
    wishlistFilters: true,
    modIndicator: true,
    cleanLayout: true,
    designInjection: true,
    priceHistoryTracking: true,
    lowestPriceBadge: true,
    itadCompare: true,
    richTooltips: true,
    skeletonLoaders: true,
    wishlistAlerts: true,
    refundTimer: true,
    desktopNotifications: false,
    debugLogging: false,
    historyMaxEntries: 100,

    // currency + region
    targetCurrency: "ILS",
    rates: { ILS: 3.65, EUR: 0.92, GBP: 0.79, RUB: 92.0, PLN: 4.0 },
    ratesUpdatedAt: 0,
    lastFxError: null,
    vatPercent: 18,
    vatLabel: "כולל מע״מ",
    regionPreset: "il",
    theme: "neon",
    uiLanguage: "en",

    // local data (caches + user data)
    modsList: [],
    modsUpdatedAt: 0,
    wishlistCache: { discountedCount: 0, total: 0 },
    wishlistCacheUpdatedAt: 0,
    tags: {},
    tagColors: {},
    tagOrder: [],
    notes: {},
    priceHistory: {},
    purchaseLog: {},
    notifLog: {},
    priceAlerts: {},
    tagDashboardDensity: "comfortable",
    lastSeenVersion: "",
    gameGenres: {},
  };

  if (typeof window !== "undefined") {
    window.GOG_PLUS_DEFAULTS = DEFAULTS;
    window.GOG_PLUS_SETTINGS_VERSION = SETTINGS_VERSION;
  }
  if (typeof self !== "undefined") {
    self.GOG_PLUS_DEFAULTS = DEFAULTS;
    self.GOG_PLUS_SETTINGS_VERSION = SETTINGS_VERSION;
  }
})();
