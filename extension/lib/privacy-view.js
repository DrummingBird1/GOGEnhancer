/**
 * GOG+ privacy dashboard — the pure part: how stored data is grouped for the
 * "what is kept on this device" table, how bytes and times are shown, and how
 * entries of the local network log (see lib/net.js) become readable rows.
 *
 * The options page (options/privacy-section.js) does the rendering; keeping
 * this logic here means it can be tested without a DOM.
 */
// @ts-check

(() => {
  "use strict";

  /**
   * @typedef {{ id: string, label: string, keys: string[], forgettable?: boolean }} Group
   */

  /**
   * Everything that lives in `storage.local`, by what it is for. A key missing
   * from every group is reported as "Other" so nothing is hidden from the
   * table (`tests/privacy-view.test.js` also checks every LOCAL key has a home).
   * @type {Group[]}
   */
  const GROUPS = [
    { id: "tags", label: "Tags, notes and note history", keys: ["tags", "tagColors", "tagOrder", "notes", "noteHistory"] },
    { id: "prices", label: "Price history", keys: ["priceHistory"] },
    {
      id: "library",
      label: "What the extension learned about your library as you browsed",
      keys: ["ownedSlugs", "gameFacts", "packInfo", "gameGenres"],
      forgettable: true,
    },
    { id: "lists", label: "Your own lists and choices", keys: ["gameStatus", "statusDates", "purchaseLog", "notInterested", "catalogPresets", "myPc"] },
    { id: "alerts", label: "Alerts, notification queue and digest", keys: ["priceAlerts", "tagAlerts", "notifLog", "notifyQueue", "weeklyDigest", "achievements", "lastSaleSeen"] },
    { id: "sync", label: "Folder-sync and backup bookkeeping", keys: ["syncMeta", "syncConflicts", "syncBaseMeta", "lastFolderSyncAt", "syncFolderName", "syncEncrypt", "autoSync", "autoBackup", "autoBackupKeep", "lastAutoBackupAt"] },
    { id: "webhook", label: "Your webhook address (a secret — never exported)", keys: ["webhookUrl", "webhookEnabled"] },
    { id: "caches", label: "Caches (mods list, wishlist badge)", keys: ["modsList", "modsUpdatedAt", "wishlistCache", "wishlistCacheUpdatedAt", "wishlistSlugs"] },
    { id: "log", label: "The request log below", keys: ["netLog"] },
    { id: "misc", label: "Small flags", keys: ["tagDashboardDensity", "lastSeenVersion", "tourSeen"] },
  ];

  /** Keys the "forget what you learned" button removes. */
  const LEARNED_KEYS = GROUPS.find((g) => g.id === "library")?.keys || [];

  /**
   * @param {number} n bytes
   * @returns {string}
   */
  function formatBytes(n) {
    if (!Number.isFinite(n) || n <= 0) return "0 B";
    if (n < 1024) return `${Math.round(n)} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * "2 min ago", "3 h ago", "yesterday"…
   * @param {number} t epoch ms @param {number} [now]
   */
  function ago(t, now = Date.now()) {
    const s = Math.max(0, Math.round((now - t) / 1000));
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    const d = Math.round(s / 86400);
    return d === 1 ? "yesterday" : `${d} days ago`;
  }

  /**
   * What a request was for, in words.
   * @param {{ kind: string, host: string }} e
   */
  function purpose(e) {
    const hosts = /** @type {any} */ (window).GOGPlusNet?.HOSTS || {};
    if (e.kind === "webhook") return "A notification sent to your own webhook";
    return hosts[e.host]?.why || e.kind;
  }

  /**
   * Log entries as table rows, newest first.
   * @param {Array<{ t: number, kind: string, host: string, path: string, status: number | null, ok: boolean, error?: string }>} log
   * @param {number} [limit] @param {number} [now]
   */
  function recentRows(log, limit = 20, now = Date.now()) {
    return (Array.isArray(log) ? log : [])
      .slice(-limit)
      .reverse()
      .map((e) => ({
        when: ago(e.t, now),
        what: purpose(e),
        where: `${e.host}${e.path || ""}`,
        result: e.ok ? `OK${e.status ? ` (${e.status})` : ""}` : e.error ? `failed — ${e.error}` : `failed${e.status ? ` (${e.status})` : ""}`,
        ok: !!e.ok,
      }));
  }

  /**
   * Sizes per group from a per-key byte map, largest first, with the total.
   * @param {Record<string, number>} bytesByKey
   * @param {string[]} [allKeys] every key actually in storage (to catch strays)
   * @returns {{ rows: Array<{ id: string, label: string, bytes: number, forgettable: boolean }>, total: number }}
   */
  function groupSizes(bytesByKey, allKeys = Object.keys(bytesByKey)) {
    const known = new Set(GROUPS.flatMap((g) => g.keys));
    const rows = GROUPS.map((g) => ({
      id: g.id,
      label: g.label,
      bytes: g.keys.reduce((n, k) => n + (bytesByKey[k] || 0), 0),
      forgettable: !!g.forgettable,
    }));
    const strays = allKeys.filter((k) => !known.has(k));
    const other = strays.reduce((n, k) => n + (bytesByKey[k] || 0), 0);
    if (other > 0) rows.push({ id: "other", label: "Other", bytes: other, forgettable: false });
    const total = rows.reduce((n, r) => n + r.bytes, 0);
    return { rows: rows.filter((r) => r.bytes > 0).sort((a, b) => b.bytes - a.bytes), total };
  }

  const api = { GROUPS, LEARNED_KEYS, formatBytes, ago, purpose, recentRows, groupSizes };
  if (typeof window !== "undefined") /** @type {any} */ (window).GOGPlusPrivacyView = api;
  if (typeof self !== "undefined") /** @type {any} */ (self).GOGPlusPrivacyView = api;
})();
