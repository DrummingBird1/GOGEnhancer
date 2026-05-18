/**
 * GOG+ Storage abstraction.
 *
 * sync (~100KB total, 8KB per item, syncs across devices)
 *   → preferences only: feature toggles, target currency, rates,
 *     ratesUpdatedAt, lastFxError, VAT, region preset, theme,
 *     settingsVersion, onboardingComplete, debugLogging
 *
 * local (~5MB, per-device)
 *   → user data + caches: tags, tagColors, tagOrder, notes, priceHistory,
 *     purchaseLog, notifLog, modsList, modsUpdatedAt, wishlistCache,
 *     wishlistCacheUpdatedAt
 *
 * Exposed as window.GOGPlusStorage with promise-based API.
 */

(() => {
  "use strict";

  const SYNC_KEYS = new Set([
    "settingsVersion",
    "enabled",
    "currencyConverter",
    "taxEstimator",
    "refundBadge",
    "drmFreeBanner",
    "hideExpiredSales",
    "hebrewTranslations",
    "rtlLayout",
    "customTags",
    "wishlistFilters",
    "modIndicator",
    "cleanLayout",
    "designInjection",
    "priceHistoryTracking",
    "itadCompare",
    "richTooltips",
    "skeletonLoaders",
    "wishlistAlerts",
    "refundTimer",
    "desktopNotifications",
    "debugLogging",
    "targetCurrency",
    "rates",
    "ratesUpdatedAt",
    "lastFxError",
    "vatPercent",
    "vatLabel",
    "onboardingComplete",
    "regionPreset",
    "theme",
  ]);

  const LOCAL_KEYS = new Set([
    "tags",
    "tagColors",
    "tagOrder",
    "notes",
    "priceHistory",
    "modsList",
    "modsUpdatedAt",
    "wishlistCache",
    "wishlistCacheUpdatedAt",
    "purchaseLog",
    "notifLog",
  ]);

  function pickArea(key) {
    if (SYNC_KEYS.has(key)) return chrome.storage.sync;
    if (LOCAL_KEYS.has(key)) return chrome.storage.local;
    // Default unknown keys to local — safer for size
    return chrome.storage.local;
  }

  function partition(keys) {
    const sync = [];
    const local = [];
    for (const k of keys) {
      if (SYNC_KEYS.has(k)) sync.push(k);
      else local.push(k);
    }
    return { sync, local };
  }

  const Storage = {
    /**
     * get(keysOrDefaults) → object. Accepts string | string[] | {key: default}.
     * String and array forms fall back to GOG_PLUS_DEFAULTS values (if loaded)
     * when a key is missing from storage — same semantics as the object form.
     */
    get(keysOrDefaults) {
      const builtins =
        (typeof globalThis !== "undefined" && globalThis.GOG_PLUS_DEFAULTS) || {};
      return new Promise((resolve) => {
        if (typeof keysOrDefaults === "string") {
          const k = keysOrDefaults;
          const def = builtins[k];
          const query = def !== undefined ? { [k]: def } : [k];
          pickArea(k).get(query, resolve);
          return;
        }
        if (Array.isArray(keysOrDefaults)) {
          const { sync, local } = partition(keysOrDefaults);
          // For each requested key with a known default, pass the object form
          // so missing-from-storage values come back populated.
          const objOrArray = (arr) => {
            const withDefs = {};
            const withoutDefs = [];
            for (const k of arr) {
              if (builtins[k] !== undefined) withDefs[k] = builtins[k];
              else withoutDefs.push(k);
            }
            return { withDefs, withoutDefs };
          };
          const fetch = (area, arr) => {
            if (!arr.length) return Promise.resolve({});
            const { withDefs, withoutDefs } = objOrArray(arr);
            return Promise.all([
              Object.keys(withDefs).length
                ? new Promise((r) => area.get(withDefs, r))
                : Promise.resolve({}),
              withoutDefs.length
                ? new Promise((r) => area.get(withoutDefs, r))
                : Promise.resolve({}),
            ]).then(([a, b]) => ({ ...a, ...b }));
          };
          Promise.all([
            fetch(chrome.storage.sync, sync),
            fetch(chrome.storage.local, local),
          ]).then(([s, l]) => resolve({ ...s, ...l }));
          return;
        }
        // Object form: defaults
        const syncDefaults = {};
        const localDefaults = {};
        for (const [k, v] of Object.entries(keysOrDefaults || {})) {
          if (SYNC_KEYS.has(k)) syncDefaults[k] = v;
          else localDefaults[k] = v;
        }
        Promise.all([
          new Promise((r) =>
            Object.keys(syncDefaults).length
              ? chrome.storage.sync.get(syncDefaults, r)
              : r({})
          ),
          new Promise((r) =>
            Object.keys(localDefaults).length
              ? chrome.storage.local.get(localDefaults, r)
              : r({})
          ),
        ]).then(([s, l]) => resolve({ ...s, ...l }));
      });
    },

    /** set({key: value, ...}) — auto-routes by key */
    set(items) {
      return new Promise((resolve) => {
        const syncItems = {};
        const localItems = {};
        for (const [k, v] of Object.entries(items)) {
          if (SYNC_KEYS.has(k)) syncItems[k] = v;
          else localItems[k] = v;
        }
        Promise.all([
          new Promise((r) =>
            Object.keys(syncItems).length
              ? chrome.storage.sync.set(syncItems, r)
              : r()
          ),
          new Promise((r) =>
            Object.keys(localItems).length
              ? chrome.storage.local.set(localItems, r)
              : r()
          ),
        ]).then(resolve);
      });
    },

    remove(keys) {
      const arr = Array.isArray(keys) ? keys : [keys];
      const { sync, local } = partition(arr);
      return Promise.all([
        new Promise((r) => (sync.length ? chrome.storage.sync.remove(sync, r) : r())),
        new Promise((r) => (local.length ? chrome.storage.local.remove(local, r) : r())),
      ]);
    },

    /** Subscribe to storage changes across both areas. callback({key, area, oldValue, newValue}) */
    onChange(callback) {
      const handler = (changes, area) => {
        for (const [k, c] of Object.entries(changes)) {
          callback({ key: k, area, oldValue: c.oldValue, newValue: c.newValue });
        }
      };
      chrome.storage.onChanged.addListener(handler);
      return () => chrome.storage.onChanged.removeListener(handler);
    },
  };

  // Expose globally for content scripts
  if (typeof window !== "undefined") {
    window.GOGPlusStorage = Storage;
    window.GOGPlusStorageKeys = { SYNC_KEYS, LOCAL_KEYS };
  }

  // Also expose for service worker via globalThis
  if (typeof self !== "undefined") {
    self.GOGPlusStorage = Storage;
    self.GOGPlusStorageKeys = { SYNC_KEYS, LOCAL_KEYS };
  }
})();
