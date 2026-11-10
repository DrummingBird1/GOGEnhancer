/**
 * GOG+ validation helpers — the one place that decides what a stored or
 * imported value may look like before the rest of the extension trusts it.
 *
 * Data reaches storage from places the extension does not control: a backup
 * file, a sync file written by another device, a tag pack or share link from
 * another person. None of it may carry markup, prototype names, formulas or the
 * wrong type into code that later builds HTML, keys an object by slug or writes
 * a spreadsheet.
 */
// @ts-check

(() => {
  "use strict";

  /**
   * Keys that belong to ONE browser. They never travel in an export, a backup
   * file, or the sync file, and they are dropped on import.
   */
  const PER_BROWSER_KEYS = [
    "syncFolderName", "lastFolderSyncAt", "syncBaseMeta", "syncConflicts",
    "autoSync", "autoBackup", "lastAutoBackupAt", "webhookUrl", "webhookEnabled",
    "notifyQueue", "tourSeen", "netLog", "failureLog", "failureSeenAt",
  ];

  const PROTO_NAMES = new Set(["__proto__", "constructor", "prototype", "hasOwnProperty", "toString", "valueOf"]);
  const SLUG_RE = /^[a-z0-9_-]{1,120}$/;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const CUR_RE = /^[A-Z]{3}$/;
  const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

  /** @param {unknown} s @returns {boolean} */
  function isSlug(s) {
    return typeof s === "string" && SLUG_RE.test(s) && !PROTO_NAMES.has(s);
  }
  /** @param {unknown} v @returns {v is Record<string, any>} */
  function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }
  /** @param {unknown} s */
  const isDate = (s) => typeof s === "string" && DATE_RE.test(s);
  /** @param {unknown} s */
  const isCurrency = (s) => typeof s === "string" && CUR_RE.test(s);
  /** @param {unknown} s @returns {string | null} */
  const safeHex = (s) => (typeof s === "string" && HEX_RE.test(s) ? s : null);

  /**
   * Keeps only own, slug-keyed entries (drops "__proto__" and friends) — the
   * result has no prototype to pollute.
   * @param {unknown} obj
   * @param {(v: any, k: string) => any} [mapValue] return undefined to drop the entry
   * @returns {Record<string, any>}
   */
  function slugMap(obj, mapValue) {
    /** @type {Record<string, any>} */
    const out = {};
    if (!isPlainObject(obj)) return out;
    for (const [k, v] of Object.entries(obj)) {
      if (!isSlug(k)) continue;
      const mapped = mapValue ? mapValue(v, k) : v;
      if (mapped !== undefined) out[k] = mapped;
    }
    return out;
  }

  /** @param {unknown} v @param {number} [max] */
  const str = (v, max = 2000) => (typeof v === "string" ? v.slice(0, max) : undefined);

  /** Per-key shape cleaners for the datasets that end up in templates or keys. */
  /** @type {Record<string, (v: any) => any>} */
  const SHAPES = {
    tags: (v) => slugMap(v, (a) => (Array.isArray(a) ? a.filter((t) => typeof t === "string").map((t) => t.slice(0, 60)).slice(0, 50) : undefined)),
    notes: (v) => slugMap(v, (n) => str(n, 20000)),
    gameStatus: (v) => slugMap(v, (s) => str(s, 30)),
    gameGenres: (v) => slugMap(v, (s) => str(s, 30)),
    statusDates: (v) => slugMap(v, (o) => (isPlainObject(o) ? o : undefined)),
    tagColors: (v) => {
      /** @type {Record<string, string>} */
      const out = Object.create(null);
      if (isPlainObject(v)) for (const [k, c] of Object.entries(v)) { const h = safeHex(c); if (h && !PROTO_NAMES.has(k)) out[k] = h; }
      return { ...out };
    },
    priceHistory: (v) =>
      slugMap(v, (arr) =>
        Array.isArray(arr)
          ? arr
              .filter((e) => isPlainObject(e) && Number.isFinite(e.p) && isDate(e.d) && isCurrency(e.c))
              .map((e) => ({ ...e, p: Number(e.p), d: e.d, c: e.c }))
              .slice(-400)
          : undefined
      ),
    purchaseLog: (v) =>
      slugMap(v, (e) => {
        if (typeof e === "string") return isDate(e.slice(0, 10)) ? e.slice(0, 10) : undefined;
        if (!isPlainObject(e)) return undefined;
        const out = { ...e };
        if (out.date !== undefined && !isDate(out.date)) delete out.date;
        if (out.currency !== undefined && !isCurrency(out.currency)) delete out.currency;
        if (out.price !== undefined && !Number.isFinite(out.price)) delete out.price;
        return out;
      }),
    priceAlerts: (v) =>
      slugMap(v, (a) => (isPlainObject(a) && Number.isFinite(a.threshold) && isCurrency(a.currency) ? { ...a, threshold: Number(a.threshold) } : undefined)),
    ownedSlugs: (v) => slugMap(v),
    notInterested: (v) => slugMap(v),
    gameFacts: (v) => slugMap(v, (o) => (isPlainObject(o) ? o : undefined)),
    packInfo: (v) => slugMap(v, (o) => (isPlainObject(o) ? o : undefined)),
    noteHistory: (v) => slugMap(v, (o) => (Array.isArray(o) ? o : undefined)),
    wishlistSlugs: (v) => (Array.isArray(v) ? v.filter(isSlug) : []),
    modsList: (v) => (Array.isArray(v) ? v.filter(isSlug) : []),
    catalogPresets: (v) => {
      /** @type {Record<string, string>} */
      const out = {};
      const CT = typeof globalThis !== "undefined" ? /** @type {any} */ (globalThis).GOGPlusCatalogTools : null;
      if (!isPlainObject(v)) return out;
      for (const [name, href] of Object.entries(v)) {
        if (PROTO_NAMES.has(name) || typeof href !== "string") continue;
        const clean = CT ? CT.sanitizePresetUrl(href) : /^\/[a-z0-9/_-]*(\?[^\s"'<>]*)?$/i.test(href) ? href : null;
        if (clean) out[name.slice(0, 40)] = clean;
      }
      return out;
    },
  };

  /** @param {unknown} v @param {unknown} def */
  function typeMatches(v, def) {
    if (def === null || def === undefined) return v === null || ["string", "number", "boolean", "object"].includes(typeof v);
    if (Array.isArray(def)) return Array.isArray(v);
    if (typeof def === "object") return isPlainObject(v);
    if (typeof def === "number") return typeof v === "number" && Number.isFinite(v);
    return typeof v === typeof def;
  }

  /**
   * Cleans one backup/sync payload against the defaults: unknown keys and
   * wrong-typed values are dropped, slug-keyed datasets are re-built, and
   * per-browser keys are removed. Reports what it dropped.
   * @param {unknown} data flat `{ key: value }` object (one storage area)
   * @param {Record<string, any>} defaults GOG_PLUS_DEFAULTS
   * @returns {{ clean: Record<string, any>, skipped: string[] }}
   */
  function sanitizeStorage(data, defaults) {
    /** @type {Record<string, any>} */
    const clean = {};
    /** @type {string[]} */
    const skipped = [];
    if (!isPlainObject(data)) return { clean, skipped: ["(not an object)"] };
    for (const [k, v] of Object.entries(data)) {
      if (PROTO_NAMES.has(k) || PER_BROWSER_KEYS.includes(k)) continue;
      if (!Object.prototype.hasOwnProperty.call(defaults, k)) { skipped.push(k); continue; }
      if (!typeMatches(v, defaults[k])) { skipped.push(k); continue; }
      const shape = SHAPES[k];
      clean[k] = shape ? shape(v) : v;
    }
    return { clean, skipped };
  }

  /**
   * Neutralises a spreadsheet cell: a leading = + - @ tab or CR would be run as
   * a formula by Excel/Sheets, so it gets a leading apostrophe. Then quotes.
   * @param {unknown} v
   * @returns {string}
   */
  function csvCell(v) {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  /** UTF-8 byte-order mark so Excel reads Hebrew/Cyrillic text correctly. */
  const CSV_BOM = "﻿";

  /** A file/zip entry name: no separators, no dots at the start, bounded. @param {string} s */
  function safeFileName(s) {
    return String(s).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/^\.+/, "_").slice(0, 120) || "_";
  }

  const api = {
    PER_BROWSER_KEYS, isSlug, isPlainObject, isDate, isCurrency, safeHex, slugMap,
    sanitizeStorage, csvCell, CSV_BOM, safeFileName,
  };
  if (typeof window !== "undefined") /** @type {any} */ (window).GOGPlusValidate = api;
  if (typeof self !== "undefined") /** @type {any} */ (self).GOGPlusValidate = api;
})();
