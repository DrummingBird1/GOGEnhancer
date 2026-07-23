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

(() => {
  "use strict";

  const SETTINGS_VERSION = 2;

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
