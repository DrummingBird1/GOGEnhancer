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

  const SETTINGS_VERSION = 3;

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
   * @property {boolean} wishlistPriceAlerts arm a price-drop check across the whole wishlist, not just per-game
   * @property {number} wishlistAlertPercent % drop from a tracked game's peak price that counts as a hit
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
   * @property {boolean} priceCompareTable show a cross-store price comparison table (CheapShark) on the game page
   * @property {{amount: number, currency: string} | null} monthlyBudget optional monthly spending target, compared against purchaseLog entries in the same currency for the tag dashboard's spending stat card
   * @property {string[]} modsList
   * @property {number} modsUpdatedAt
   * @property {{ discountedCount: number, total: number }} wishlistCache
   * @property {number} wishlistCacheUpdatedAt
   * @property {string[]} wishlistSlugs slugs on the wishlist, from the content-script round-trip
   * @property {Record<string, string[]>} tags slug -> tag names
   * @property {Record<string, string>} tagColors tag name -> #hex
   * @property {string[]} tagOrder
   * @property {Record<string, "playing" | "backlog" | "finished">} gameStatus slug -> fixed-vocabulary play status, distinct from free-form tags
   * @property {Record<string, string>} notes slug -> free text
   * @property {Record<string, Array<{d: string, p: number, c: string}>>} priceHistory slug -> snapshots
   * @property {Record<string, {date: string, price?: number, currency?: string}>} purchaseLog slug -> purchase entry (a bare "YYYY-MM-DD" string before the settingsVersion 2->3 migration, upgraded by that migration; readers should still go through lib/purchases.js's normalizePurchaseEntry rather than assume the object shape)
   * @property {Record<string, number>} notifLog dedupe keys -> epoch ms
   * @property {Record<string, {threshold: number, currency: string, createdAt: number}>} priceAlerts
   * @property {"comfortable" | "compact"} tagDashboardDensity
   * @property {string} lastSeenVersion last changelog version acknowledged in the popup
   * @property {Record<string, string>} gameGenres slug -> genre bucket, cached on visit
   * @property {WeeklyDigest | null} weeklyDigest last computed weekly summary, shown in the popup's "This week" panel
   * @property {CustomThemeColors | null} customThemeColors user-picked colors for the "custom" theme slot; null = fall back to the neon palette baked into :root
   * @property {boolean} dyslexiaFont swap injected UI to a more dyslexia-friendly font stack + wider letter/line spacing
   * @property {Record<string, string>} achievements achievement id -> unlocked-at ISO date, see lib/achievements.js
   * @property {boolean} keyboardNav J/K/T shortcuts on game grids (opt-in — bare letter keys are never grabbed unless the user asks)
   * @property {boolean} sysReqCheck show the RAM-only system-requirements check on game pages
   * @property {Record<string, {t: number, del?: boolean}>} syncMeta "<dataset>:<slug>" -> last-modified epoch ms (+ tombstone flag), stamped by the service worker so folder sync can resolve conflicts per record, see lib/sync-core.js
   * @property {number} lastFolderSyncAt epoch ms of the last successful sync-folder run, 0 = never
   * @property {string} syncFolderName display name of the chosen sync folder ("" = none chosen)
   * @property {boolean} syncEncrypt encrypt the folder-sync file with a passphrase (asked for on every sync, never stored)
   * @property {boolean} realDiscountCheck game page: compare the advertised discount with GOG's own 30-day-lowest figure and the tracked history
   * @property {boolean} offerTimer game page + cards: countdown to the end of the current offer
   * @property {boolean} pricePerHour game page: price per hour of play, from GOG's own time-to-beat figures
   * @property {boolean} currencyTable game page: the price in several currencies at once
   * @property {boolean} saleForecast game page: how often this game goes on sale and when it may next
   * @property {boolean} languageMeter game page: which of the user's languages the game supports
   * @property {string[]} preferredLanguages language names to look for ([] = derive from uiLanguage)
   * @property {boolean} changesSinceVisit game page: what changed since the last visit
   * @property {boolean} reviewTools game page: star / verified-owner filter above the review list
   * @property {boolean} similarOwned game page: games you own with similar tags
   * @property {boolean} openInLinks game page: link-only "open in Steam / PCGamingWiki / …" buttons
   * @property {boolean} ownershipLearning learn which games are in the library from the "IN LIBRARY" labels the site shows
   * @property {boolean} catalogTools sort / density / owned / not-interested bar on catalog pages
   * @property {"normal" | "compact" | "list"} catalogDensity
   * @property {"show" | "dim" | "hide"} ownedDisplay what to do with games already in the library on catalog pages
   * @property {boolean} hideNotInterested hide games marked "not interested"
   * @property {boolean} wishlistSmart smart sort / filters / totals / export on the wishlist page
   * @property {boolean} endlessCatalog append the next catalog page when you reach the end (uses GOG's catalog API; off by default)
   * @property {boolean} packContents look up which games a pack contains (GOG's product API) to warn about games you already own
   * @property {boolean} panelSticky keep the game-page panel pinned beside the page on wide screens
   * @property {boolean} calmMode no glow, motion or animation in the injected UI
   * @property {boolean} plainLook drop all injected styling and let the site look like itself (features keep working)
   * @property {number} uiScale text size of the injected UI (1 = normal)
   * @property {"default" | "deuteranopia" | "protanopia" | "tritanopia" | "high-contrast"} palette colour-vision friendly status colours
   * @property {Record<string, boolean>} panelCollapsed section id -> collapsed
   * @property {string[]} panelOrder section ids in the user's drag order
   * @property {"instant" | "daily"} notifyMode send notifications as they happen, or batch them into one a day
   * @property {{ enabled: boolean, from: string, to: string }} quietHours "HH:MM" window with no notifications (they queue instead)
   * @property {number} notifyMinDiscount ignore alerts for drops smaller than this percent (0 = off)
   * @property {number} notifyMaxPrice only alert for prices at or under this amount in the target currency (0 = off)
   * @property {boolean} notifyOnlyAtLow only alert when the price is at its tracked low
   * @property {boolean} seasonRadar notify when the store advertises a big sale
   * @property {number} monthlyGoal games to finish per month (0 = no goal)
   * @property {Record<string, true | string>} ownedSlugs slug -> date first seen in the library (learned from the site's own labels)
   * @property {Record<string, true | string>} notInterested slug -> date hidden from catalogs
   * @property {Record<string, GameFacts>} gameFacts per-game facts read from game pages (languages, ratings, last price…)
   * @property {Record<string, string>} catalogPresets name -> saved catalog path + query
   * @property {Record<string, {threshold: number, currency: string}>} tagAlerts tag name -> alert for every game with that tag
   * @property {Record<string, {playing?: string, finished?: string}>} statusDates slug -> dates the status was set (stamped by the service worker)
   * @property {MyPc | null} myPc the user's own machine for the requirements check
   * @property {NotifyItem[]} notifyQueue notifications held back by quiet hours / daily mode
   * @property {SyncConflict[]} syncConflicts records both sides changed at the last folder sync
   * @property {Record<string, {t: number, del?: boolean}>} syncBaseMeta syncMeta as of the last folder sync (to spot conflicts)
   * @property {boolean} autoSync sync with the folder automatically (per browser)
   * @property {boolean} autoBackup write dated backups into the sync folder (per browser)
   * @property {number} autoBackupKeep how many dated backups to keep
   * @property {number} lastAutoBackupAt epoch ms
   * @property {boolean} webhookEnabled also post notifications to the user's own webhook
   * @property {string} webhookUrl the user's own webhook (Discord / generic JSON); stays on this device
   * @property {string} tourSeen version whose intro tour was shown
   * @property {string} lastSaleSeen headline of the last store-wide sale already announced
   * @property {Array<{t: number, kind: string, host: string, path: string, status: number | null, ok: boolean, error?: string}>} netLog the extension's own recent network requests (host + path, never a query), for the privacy dashboard
   * @property {Record<string, {t: number, children: Array<{id: string, slug: string, title: string}>}>} packInfo slug -> what a pack contains ([] = not a pack), cached
   * @property {Record<string, Array<{t: number, text: string}>>} noteHistory slug -> earlier versions of the note, newest first (see lib/note-history.js)
   */

  /**
   * @typedef {Object} GameFacts
   * @property {number} t epoch ms last updated
   * @property {string} [title]
   * @property {{score: number, count: number} | null} [rating]
   * @property {number | null} [criticsPct]
   * @property {Record<string, {a: boolean, t: boolean}>} [langs] language -> audio / text support
   * @property {Record<string, string>} [hours] time-to-beat label -> "108 h"
   * @property {string[]} [tags] GOG's own tags
   * @property {number | null} [year] release year
   * @property {string} [rd] release date on GOG ("YYYY-MM-DD"; the planned date for a game not out yet)
   * @property {string | null} [pe] promo end as the page's timer attribute
   * @property {{p: number | null, b: number | null, l: number | null, c: string | null} | null} [price] last seen price / list price / 30-day low / currency
   * @property {{t: number, price: {p: number | null, b: number | null, l: number | null, c: string | null} | null, rating: {score: number, count: number} | null, criticsPct: number | null} | null} [prev] snapshot from the previous visit (for "what changed")
   */

  /**
   * @typedef {Object} MyPc
   * @property {number} ramGB
   * @property {number} vramGB
   * @property {number} storageGB free disk space
   * @property {string} os
   * @property {string} cpu free text, shown beside the requirements (never compared)
   * @property {string} gpu free text, shown beside the requirements (never compared)
   */

  /**
   * @typedef {Object} NotifyItem
   * @property {string} id
   * @property {string} kind price-alert | wishlist-drop | refund | tag-alert | sale
   * @property {string} title
   * @property {string} message
   * @property {number} t epoch ms
   */

  /**
   * @typedef {Object} SyncConflict
   * @property {string} key dataset (tags, notes…)
   * @property {string} id record id (slug / tag)
   * @property {any} local
   * @property {any} remote
   * @property {"local" | "remote"} kept which side the newest-wins rule picked
   * @property {number} t epoch ms of the sync that found it
   */

  /**
   * @typedef {Object} CustomThemeColors
   * @property {string} magenta #hex
   * @property {string} cyan #hex
   * @property {string} bg #hex
   */

  /**
   * @typedef {Object} WeeklyDigest
   * @property {number} generatedAt epoch ms
   * @property {number} dropsThisWeek total price-drop snapshots across all tracked games in the last 7 days
   * @property {Array<{slug: string, daysLeft: number}>} refundClosing purchases whose 30-day refund window closes within 7 days
   * @property {Array<{slug: string, price: number, currency: string, threshold: number}>} priceAlertHits per-game price alerts currently past their threshold
   * @property {Array<{slug: string, price: number, currency: string, dropPct: number}>} wishlistDrops wishlisted games currently past the wishlist-wide drop threshold
   * @property {Array<{slug: string, endsAt: number}>} [endingSoon] wishlisted games whose offer ends within 7 days (the end date comes from a game page the user opened)
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
    wishlistPriceAlerts: false,
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
    wishlistAlertPercent: 20,
    priceCompareTable: true,
    monthlyBudget: null,
    customThemeColors: null,
    dyslexiaFont: false,
    keyboardNav: false,
    sysReqCheck: true,

    // local data (caches + user data)
    modsList: [],
    modsUpdatedAt: 0,
    wishlistCache: { discountedCount: 0, total: 0 },
    wishlistCacheUpdatedAt: 0,
    wishlistSlugs: [],
    tags: {},
    tagColors: {},
    tagOrder: [],
    gameStatus: {},
    notes: {},
    priceHistory: {},
    purchaseLog: {},
    notifLog: {},
    priceAlerts: {},
    tagDashboardDensity: "comfortable",
    lastSeenVersion: "",
    gameGenres: {},
    weeklyDigest: null,
    achievements: {},
    syncMeta: {},
    lastFolderSyncAt: 0,
    syncFolderName: "",
    syncEncrypt: false,

    // v4 expansion: deal analysis, library knowledge, catalog / wishlist tools
    realDiscountCheck: true,
    offerTimer: true,
    pricePerHour: true,
    currencyTable: true,
    saleForecast: true,
    languageMeter: true,
    preferredLanguages: [],
    changesSinceVisit: true,
    reviewTools: true,
    similarOwned: true,
    openInLinks: true,
    ownershipLearning: true,
    catalogTools: true,
    catalogDensity: "normal",
    ownedDisplay: "show",
    hideNotInterested: true,
    wishlistSmart: true,
    endlessCatalog: false,
    packContents: true,

    // v4 expansion: look and feel
    panelSticky: false,
    calmMode: false,
    plainLook: false,
    uiScale: 1,
    palette: "default",
    panelCollapsed: {},
    panelOrder: [],

    // v4 expansion: notifications + sync + automation
    notifyMode: "instant",
    quietHours: { enabled: false, from: "22:00", to: "08:00" },
    notifyMinDiscount: 0,
    notifyMaxPrice: 0,
    notifyOnlyAtLow: false,
    seasonRadar: false,
    monthlyGoal: 0,
    ownedSlugs: {},
    notInterested: {},
    gameFacts: {},
    catalogPresets: {},
    tagAlerts: {},
    statusDates: {},
    myPc: null,
    notifyQueue: [],
    syncConflicts: [],
    syncBaseMeta: {},
    autoSync: false,
    autoBackup: false,
    autoBackupKeep: 7,
    lastAutoBackupAt: 0,
    webhookEnabled: false,
    webhookUrl: "",
    tourSeen: "",
    lastSaleSeen: "",
    noteHistory: {},
    netLog: [],
    packInfo: {},
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
