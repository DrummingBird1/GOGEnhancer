/**
 * GOG+ sync core — the pure merge logic behind "sync via a folder".
 *
 * The idea: the user picks a folder that Dropbox / OneDrive / Google Drive /
 * Syncthing already keeps in sync, and each browser reads and writes one JSON
 * file in it. No server of ours, no account, no new network permission —
 * the extension only ever touches a file the user explicitly pointed it at.
 *
 * That makes merging the interesting part: two browsers will edit the same
 * library while apart. This module resolves that deterministically, with no
 * I/O so it can be tested exhaustively:
 *
 *   • "Record" datasets (tags, notes, status, purchases, alerts, tag colours)
 *     are keyed by slug/tag. Each key is last-writer-wins, using a per-key
 *     timestamp from `syncMeta` ("<dataset>:<key>" -> { t, del? }). A delete
 *     is a tombstone ({ t, del: true }) so it propagates instead of being
 *     "healed" by the other side's stale copy. Tombstones expire after 90 days.
 *   • `tagOrder` is one value, last-writer-wins as a unit.
 *   • `priceHistory` is append-only: snapshots are unioned and de-duplicated.
 *   • `achievements` are unioned; the earliest unlock date wins.
 *
 * Ties (equal timestamps, different values) break on the serialized value, so
 * both sides pick the same winner and converge instead of ping-ponging.
 *
 * Timestamps are stamped by the service worker (see stampChanges) from
 * chrome.storage.onChanged — the many write sites across the extension never
 * had to learn about syncing.
 */
// @ts-check

(() => {
  "use strict";

  const SCHEMA = 1;
  const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

  const RECORD_KEYS = ["tags", "notes", "gameStatus", "purchaseLog", "priceAlerts", "tagColors"];
  const WHOLE_KEYS = ["tagOrder"];
  const HISTORY_KEY = "priceHistory";
  const EARLIEST_KEY = "achievements";
  const SYNCED_KEYS = [...RECORD_KEYS, ...WHOLE_KEYS, HISTORY_KEY, EARLIEST_KEY];

  /** @typedef {{ t: number, del?: boolean }} MetaEntry */
  /** @typedef {Record<string, MetaEntry>} SyncMeta */
  /** @typedef {{ data: Record<string, any>, meta: SyncMeta }} Snapshot */

  /** @param {string} key @param {string} id */
  const metaId = (key, id) => `${key}:${id}`;

  // JSON with object keys sorted (arrays keep their order, which is
  // meaningful for tag lists). Two devices build the same object with keys in
  // different insertion orders; plain JSON.stringify would call those
  // "different" and make every sync rewrite the file for nothing — or worse,
  // tie-break differently on each device and never converge.
  /** @param {any} v @returns {string} */
  function canonical(v) {
    if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
    if (v && typeof v === "object") {
      return `{${Object.keys(v)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
        .join(",")}}`;
    }
    return JSON.stringify(v) ?? "null";
  }
  /** @param {any} a @param {any} b */
  const same = (a, b) => canonical(a) === canonical(b);

  /**
   * Called for every storage change to a synced key. Returns the updated
   * meta, or null when nothing a sync cares about changed. Never mutates.
   * @param {string} key
   * @param {any} oldValue
   * @param {any} newValue
   * @param {SyncMeta} meta
   * @param {number} now
   * @returns {SyncMeta | null}
   */
  function stampChanges(key, oldValue, newValue, meta, now) {
    if (WHOLE_KEYS.includes(key)) {
      return same(oldValue, newValue) ? null : { ...meta, [metaId(key, "_")]: { t: now } };
    }
    if (!RECORD_KEYS.includes(key)) return null;

    const o = oldValue || {};
    const n = newValue || {};
    /** @type {SyncMeta | null} */
    let next = null;
    for (const id of new Set([...Object.keys(o), ...Object.keys(n)])) {
      const inOld = id in o;
      const inNew = id in n;
      if (inNew && (!inOld || !same(o[id], n[id]))) {
        next = next || { ...meta };
        next[metaId(key, id)] = { t: now };
      } else if (inOld && !inNew) {
        next = next || { ...meta };
        next[metaId(key, id)] = { t: now, del: true };
      }
    }
    return next;
  }

  /**
   * @typedef {{ kind: "value", t: number, v: any } | { kind: "del", t: number } | { kind: "none" }} Side
   */

  /**
   * One side's view of one key. A key that's absent with no tombstone is
   * "none" — it carries no information, so the other side's value survives
   * (a freshly-installed browser must not delete a library it has never seen).
   * @param {boolean} present @param {any} value @param {MetaEntry | undefined} m
   * @returns {Side}
   */
  function sideOf(present, value, m) {
    if (present) return { kind: "value", t: m && !m.del ? m.t : 0, v: value };
    if (m?.del) return { kind: "del", t: m.t };
    return { kind: "none" };
  }

  /**
   * Picks the winner of two sides. Higher timestamp wins; on a tie a value
   * beats a delete (don't lose data), and two different values break on their
   * serialized form so every device chooses the same one.
   * @param {Side} l @param {Side} r
   * @returns {Side}
   */
  function resolve(l, r) {
    if (l.kind === "none") return r;
    if (r.kind === "none") return l;
    if (l.t !== r.t) return l.t > r.t ? l : r;
    if (l.kind !== r.kind) return l.kind === "value" ? l : r;
    if (l.kind === "value" && r.kind === "value") {
      return canonical(l.v) >= canonical(r.v) ? l : r;
    }
    return l;
  }

  /** @param {SyncMeta} meta @param {string} key @returns {string[]} */
  function idsInMeta(meta, key) {
    const prefix = `${key}:`;
    return Object.keys(meta)
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length));
  }

  /**
   * @param {Snapshot} local
   * @param {Snapshot} remote
   * @param {{ now?: number, historyMax?: number }} [opts]
   * @returns {{ data: Record<string, any>, meta: SyncMeta, localChanged: boolean, remoteChanged: boolean }}
   */
  function mergeSnapshots(local, remote, opts = {}) {
    const now = opts.now ?? Date.now();
    const historyMax = opts.historyMax ?? 100;
    /** @type {Record<string, any>} */
    const data = {};
    /** @type {SyncMeta} */
    const meta = {};

    /** @param {string} mid @param {Side} w */
    const record = (mid, w) => {
      if (w.kind === "del") {
        if (now - w.t <= TOMBSTONE_TTL_MS) meta[mid] = { t: w.t, del: true };
      } else if (w.kind === "value" && w.t > 0) {
        meta[mid] = { t: w.t };
      }
    };

    for (const key of RECORD_KEYS) {
      const lv = local.data[key] || {};
      const rv = remote.data[key] || {};
      /** @type {Record<string, any>} */
      const out = {};
      const ids = new Set([
        ...Object.keys(lv),
        ...Object.keys(rv),
        ...idsInMeta(local.meta, key),
        ...idsInMeta(remote.meta, key),
      ]);
      for (const id of ids) {
        const mid = metaId(key, id);
        const w = resolve(
          sideOf(id in lv, lv[id], local.meta[mid]),
          sideOf(id in rv, rv[id], remote.meta[mid])
        );
        if (w.kind === "value") out[id] = w.v;
        record(mid, w);
      }
      data[key] = out;
    }

    for (const key of WHOLE_KEYS) {
      const mid = metaId(key, "_");
      /** @param {Snapshot} s */
      const side = (s) => {
        const v = s.data[key];
        const m = s.meta[mid];
        const nonEmpty = Array.isArray(v) ? v.length > 0 : v != null;
        return sideOf(!!m || nonEmpty, v ?? [], m);
      };
      const w = resolve(side(local), side(remote));
      data[key] = w.kind === "value" ? w.v : [];
      record(mid, w);
    }

    // priceHistory: union by (date, currency, price), oldest first, newest kept.
    {
      const lh = local.data[HISTORY_KEY] || {};
      const rh = remote.data[HISTORY_KEY] || {};
      /** @type {Record<string, any[]>} */
      const out = {};
      for (const slug of new Set([...Object.keys(lh), ...Object.keys(rh)])) {
        const seen = new Map();
        for (const e of [...(lh[slug] || []), ...(rh[slug] || [])]) {
          if (!e || typeof e !== "object") continue;
          seen.set(`${e.d}|${e.c}|${e.p}`, e);
        }
        out[slug] = [...seen.values()].sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0)).slice(-historyMax);
      }
      data[HISTORY_KEY] = out;
    }

    // achievements: union, earliest unlock date wins.
    {
      const la = local.data[EARLIEST_KEY] || {};
      const ra = remote.data[EARLIEST_KEY] || {};
      /** @type {Record<string, string>} */
      const out = {};
      for (const id of new Set([...Object.keys(la), ...Object.keys(ra)])) {
        const a = la[id];
        const b = ra[id];
        out[id] = a && b ? (a <= b ? a : b) : a || b;
      }
      data[EARLIEST_KEY] = out;
    }

    /** @param {Snapshot} s */
    const differs = (s) =>
      !same(meta, s.meta) || SYNCED_KEYS.some((k) => !same(data[k], s.data[k] ?? (WHOLE_KEYS.includes(k) ? [] : {})));

    return { data, meta, localChanged: differs(local), remoteChanged: differs(remote) };
  }

  /**
   * @param {Record<string, any>} stored values read from storage (any extra keys are ignored)
   * @param {SyncMeta} meta
   * @param {{ now?: number, device?: string }} [opts]
   */
  function toSnapshotFile(stored, meta, opts = {}) {
    /** @type {Record<string, any>} */
    const data = {};
    for (const k of SYNCED_KEYS) data[k] = stored[k] ?? (WHOLE_KEYS.includes(k) ? [] : {});
    return { format: "gog-enhancer-sync", schema: SCHEMA, exportedAt: opts.now ?? Date.now(), device: opts.device || "", data, meta };
  }

  /**
   * @param {string} text file contents
   * @returns {Snapshot}
   */
  function parseSnapshotFile(text) {
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error("The sync file isn't valid JSON.");
    }
    if (!raw || raw.format !== "gog-enhancer-sync" || typeof raw.data !== "object" || !raw.data) {
      throw new Error("This doesn't look like a GOG Enhancer sync file.");
    }
    if (typeof raw.schema !== "number" || raw.schema > SCHEMA) {
      throw new Error("This sync file was written by a newer version of GOG Enhancer — update the extension first.");
    }
    return { data: raw.data, meta: raw.meta && typeof raw.meta === "object" ? raw.meta : {} };
  }

  const api = {
    SCHEMA,
    SYNCED_KEYS,
    TOMBSTONE_TTL_MS,
    stampChanges,
    mergeSnapshots,
    toSnapshotFile,
    parseSnapshotFile,
  };
  if (typeof window !== "undefined") window.GOGPlusSyncCore = api;
  if (typeof self !== "undefined") self.GOGPlusSyncCore = api;
})();
