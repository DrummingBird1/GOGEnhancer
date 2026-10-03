/**
 * GOG+ folder sync core — reads and writes ONE file, gog-enhancer-sync.json, in
 * a folder the user picked (one their own cloud client — Dropbox, OneDrive,
 * Google Drive, Syncthing… — already keeps in sync), merging with whatever
 * other browsers put there. The merge rules live in lib/sync-core.js; this
 * module is the I/O around them. The extension itself makes no network request
 * for any of it: the folder is the whole transport.
 *
 * It runs in three places, and each can do a different amount without the user:
 *   • the options page — interactive: it can ask for folder permission (needs a
 *     click) and for the passphrase of an encrypted file;
 *   • the tag dashboard — the same, plus it syncs by itself when opened;
 *   • the service worker — non-interactive: it can only sync when the browser
 *     already remembers the folder permission ("Allow on every visit"), and
 *     skips quietly (SyncNeedsInteraction) when it would have to ask.
 *
 * Also here: the list of records both sides changed since the last sync
 * (`syncConflicts`) and the dated automatic backups.
 */
// @ts-check

(() => {
  "use strict";

  const FILE_NAME = "gog-enhancer-sync.json";
  const BACKUP_PREFIX = "gog-enhancer-backup-";
  const DB_NAME = "gog-plus-sync";
  const STORE = "handles";
  const KEY = "folder";

  /** Something only a person at a keyboard can supply. `code` says what. */
  class SyncNeedsInteraction extends Error {
    /** @param {"no-folder" | "permission" | "passphrase"} code @param {string} message */
    constructor(code, message) {
      super(message);
      this.name = "SyncNeedsInteraction";
      this.code = code;
    }
  }

  /* ---------- persisted directory handle (IndexedDB) ---------- */

  /** @returns {Promise<IDBDatabase>} */
  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * @template T
   * @param {"readonly" | "readwrite"} mode
   * @param {(store: IDBObjectStore) => IDBRequest<T>} fn
   * @returns {Promise<T>}
   */
  async function withStore(mode, fn) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }

  // An object (not three bare functions) so a test can swap in an in-memory
  // store: a stand-in directory handle isn't structured-cloneable the way a
  // real FileSystemDirectoryHandle is.
  const defaultStore = {
    get: () => withStore("readonly", (s) => s.get(KEY)),
    set: (/** @type {any} */ h) => withStore("readwrite", (s) => s.put(h, KEY)),
    clear: () => withStore("readwrite", (s) => s.delete(KEY)),
  };

  /* ---------- permission ---------- */

  /**
   * @param {any} handle
   * @param {boolean} interactive may this call ask the user?
   */
  async function ensurePermission(handle, interactive) {
    const opts = { mode: "readwrite" };
    if ((await handle.queryPermission(opts)) === "granted") return;
    if (!interactive) {
      throw new SyncNeedsInteraction("permission", "The sync folder needs its permission re-granted — open the options page and press Sync now.");
    }
    if ((await handle.requestPermission(opts)) !== "granted") {
      throw new Error("Permission to use the sync folder was not granted.");
    }
  }

  /** @param {() => Promise<unknown>} fn */
  const quiet = async (fn) => {
    try {
      await fn();
    } catch {
      /* best effort */
    }
  };

  /* ---------- the sync file ---------- */

  /** @typedef {(message: string) => string | null | Promise<string | null>} AskPassphrase */

  /**
   * Reads the remote snapshot, or null when the file doesn't exist yet. When the
   * file is encrypted, also returns the passphrase that opened it so the
   * write-back doesn't ask a second time.
   * @param {any} dir
   * @param {AskPassphrase | undefined} askPassphrase
   * @returns {Promise<{ snapshot: { data: any, meta: any } | null, encrypted: boolean, passphrase: string }>}
   */
  async function readRemote(dir, askPassphrase) {
    let file;
    try {
      file = await (await dir.getFileHandle(FILE_NAME)).getFile();
    } catch (err) {
      if (err && /** @type {any} */ (err).name === "NotFoundError") return { snapshot: null, encrypted: false, passphrase: "" };
      throw err;
    }
    let text = await file.text();
    const crypto = globalThis.GOGPlusBackupCrypto;

    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Not JSON at all — parseSnapshotFile below reports that clearly.
    }
    let passphrase = "";
    const encrypted = !!parsed && parsed.format === crypto.ENCRYPTED_BACKUP_FORMAT;
    if (encrypted) {
      if (!askPassphrase) throw new SyncNeedsInteraction("passphrase", "The sync file is encrypted — sync from the options page, which can ask for its passphrase.");
      passphrase = (await askPassphrase("The sync file is encrypted. Enter its passphrase.")) || "";
      if (!passphrase) throw new Error("Sync cancelled — the sync file is encrypted and no passphrase was given.");
      text = await crypto.decryptBackup(parsed, passphrase);
    }
    return { snapshot: globalThis.GOGPlusSyncCore.parseSnapshotFile(text), encrypted, passphrase };
  }

  /**
   * One full sync: read the folder's file, merge, write back whichever side
   * changed. Throws an Error with a user-presentable message on any failure,
   * having changed nothing it couldn't finish.
   * @param {{ store?: typeof defaultStore, askPassphrase?: AskPassphrase, interactive?: boolean, now?: number }} [opts]
   * @returns {Promise<{ pulled: boolean, pushed: boolean, created: boolean }>}
   */
  async function syncNow(opts = {}) {
    const store = opts.store || defaultStore;
    const interactive = opts.interactive ?? true;
    const handle = await store.get();
    if (!handle) throw new SyncNeedsInteraction("no-folder", "Choose a sync folder first.");
    await ensurePermission(handle, interactive);

    const Core = globalThis.GOGPlusSyncCore;
    const Storage = globalThis.GOGPlusStorage;
    const { snapshot: remote, encrypted: remoteEncrypted, passphrase: openedWith } = await readRemote(handle, opts.askPassphrase);

    const stored = await Storage.get([...Core.SYNCED_KEYS, "syncMeta", "syncBaseMeta", "historyMaxEntries", "syncEncrypt"]);
    const local = { data: stored, meta: stored.syncMeta || {} };
    const hadBase = !!stored.syncBaseMeta && Object.keys(stored.syncBaseMeta).length > 0;
    const merged = Core.mergeSnapshots(local, remote || { data: {}, meta: {} }, {
      historyMax: stored.historyMaxEntries,
      // No base on the first sync, so nothing can be called a conflict yet.
      baseMeta: hadBase ? stored.syncBaseMeta : undefined,
      now: opts.now,
    });

    // Once a file is encrypted it stays encrypted, whatever this browser's
    // setting says — otherwise a second browser that never ticked the box
    // would quietly rewrite the shared file as plaintext. Turning the setting
    // ON for a plaintext file forces a rewrite so it's encrypted right away.
    const encryptOut = remoteEncrypted || !!stored.syncEncrypt;
    const pushed = merged.remoteChanged || !remote || (encryptOut && !remoteEncrypted);

    // Passphrase BEFORE touching anything, so cancelling leaves both sides as they were.
    let passphrase = openedWith;
    if (pushed && encryptOut && !passphrase) {
      if (!opts.askPassphrase) throw new SyncNeedsInteraction("passphrase", "This sync needs a passphrase — sync from the options page.");
      passphrase =
        (await opts.askPassphrase("Choose a passphrase for the encrypted sync file.\nThere is no way to recover it if lost.")) || "";
      if (!passphrase) throw new Error("Sync cancelled — no passphrase given.");
    }

    if (merged.localChanged) {
      // ONE write containing the data and its timestamps: the service worker
      // reads "syncMeta arrived with it" as "a sync is being applied" and does
      // not re-stamp the records as fresh local edits (see background.js).
      await Storage.set({ ...merged.data, syncMeta: merged.meta });
    }

    if (pushed) {
      let body = JSON.stringify(Core.toSnapshotFile(merged.data, merged.meta), null, 2);
      if (encryptOut) {
        body = JSON.stringify(await globalThis.GOGPlusBackupCrypto.encryptBackup(body, passphrase), null, 2);
      }
      const writable = await (await handle.getFileHandle(FILE_NAME, { create: true })).createWritable();
      await writable.write(body);
      await writable.close();
    }

    const at = Date.now();
    // What this sync leaves behind for the next one: the timestamps it ended
    // on (the "last seen together" point) and any records both sides changed.
    await Storage.set({
      lastFolderSyncAt: at,
      syncBaseMeta: merged.meta,
      ...(merged.conflicts.length ? { syncConflicts: [...merged.conflicts.map((c) => ({ ...c, t: at })), ...((await Storage.get(["syncConflicts"])).syncConflicts || [])].slice(0, 50) } : {}),
    });
    return { pulled: merged.localChanged, pushed, created: !remote };
  }

  /** @param {{ pulled: boolean, pushed: boolean, created: boolean }} r */
  function describeResult(r) {
    if (r.created) return "Created the sync file and uploaded this browser's library to it.";
    if (r.pulled && r.pushed) return "Merged: this browser and the sync file were both updated.";
    if (r.pulled) return "Updated this browser from the sync file.";
    if (r.pushed) return "Updated the sync file with this browser's changes.";
    return "Already in sync.";
  }

  /* ---------- conflicts ---------- */

  /**
   * Overrules the newest-wins decision for one conflicting record: writes the
   * other side's value into this browser as a fresh edit (so the service
   * worker stamps it newest and the next sync carries it to the other side),
   * then removes the conflict from the list. Choosing the side that already
   * won only dismisses the entry.
   * @param {{ key: string, id: string, local: any, remote: any, kept: "local" | "remote", t?: number }} conflict
   * @param {"local" | "remote"} use
   */
  async function resolveConflict(conflict, use) {
    const Storage = globalThis.GOGPlusStorage;
    if (use !== conflict.kept) {
      const value = use === "local" ? conflict.local : conflict.remote;
      const cur = (await Storage.get([conflict.key]))[conflict.key] || {};
      const next = { ...cur };
      if (value === undefined) delete next[conflict.id];
      else next[conflict.id] = value;
      await Storage.set({ [conflict.key]: next });
    }
    const { syncConflicts = [] } = await Storage.get(["syncConflicts"]);
    await Storage.set({
      syncConflicts: syncConflicts.filter(
        (c) => !(c.key === conflict.key && c.id === conflict.id && c.t === conflict.t)
      ),
    });
  }

  /* ---------- automatic sync + backups ---------- */

  /**
   * Whether an automatic sync is due and possible, and runs it. Never throws:
   * returns what happened so a caller can say so (or stay silent).
   * @param {{ store?: typeof defaultStore, askPassphrase?: AskPassphrase, interactive?: boolean, minGapMs?: number, now?: number }} [opts]
   * @returns {Promise<{ ran: boolean, reason?: string, result?: { pulled: boolean, pushed: boolean, created: boolean } }>}
   */
  async function autoSync(opts = {}) {
    const Storage = globalThis.GOGPlusStorage;
    const { autoSync: on, syncFolderName, lastFolderSyncAt } = await Storage.get(["autoSync", "syncFolderName", "lastFolderSyncAt"]);
    if (!on || !syncFolderName) return { ran: false, reason: "off" };
    const now = opts.now ?? Date.now();
    if (now - (lastFolderSyncAt || 0) < (opts.minGapMs ?? 5 * 60 * 1000)) return { ran: false, reason: "recent" };
    try {
      return { ran: true, result: await syncNow({ ...opts, now }) };
    } catch (err) {
      return { ran: false, reason: err instanceof SyncNeedsInteraction ? err.code : String(/** @type {any} */ (err)?.message || err) };
    }
  }

  /** @param {Date} d */
  const backupName = (d, encrypted) => `${BACKUP_PREFIX}${d.toISOString().slice(0, 10)}.json${encrypted ? ".enc" : ""}`;

  /**
   * Writes a dated backup of the WHOLE library (every stored key, minus
   * per-browser settings that mean nothing elsewhere) into the sync folder and
   * prunes older ones beyond `keep`. One per day: calling it again the same day
   * replaces that day's file.
   * @param {{ store?: typeof defaultStore, askPassphrase?: AskPassphrase, interactive?: boolean, keep?: number, now?: number }} [opts]
   * @returns {Promise<{ file: string, removed: string[] }>}
   */
  async function writeBackup(opts = {}) {
    const store = opts.store || defaultStore;
    const handle = await store.get();
    if (!handle) throw new SyncNeedsInteraction("no-folder", "Choose a sync folder first.");
    await ensurePermission(handle, opts.interactive ?? true);

    const Storage = globalThis.GOGPlusStorage;
    const { syncEncrypt, autoBackupKeep } = await Storage.get(["syncEncrypt", "autoBackupKeep"]);
    const keep = Math.max(1, Math.min(60, opts.keep ?? autoBackupKeep ?? 7));
    const everything = await new Promise((r) => chrome.storage.local.get(null, r));
    const syncPrefs = await new Promise((r) => chrome.storage.sync.get(null, r));
    // Per-browser state and secrets never go into a file that lives in a cloud folder.
    const PER_BROWSER = ["syncFolderName", "lastFolderSyncAt", "syncBaseMeta", "syncConflicts", "webhookUrl", "webhookEnabled", "lastAutoBackupAt", "autoSync", "autoBackup", "notifyQueue"];
    const payload = { ...syncPrefs, ...everything };
    for (const k of PER_BROWSER) delete payload[k];
    let body = JSON.stringify({ format: "gog-enhancer-backup", exportedAt: new Date(opts.now ?? Date.now()).toISOString(), data: payload }, null, 2);

    const encrypt = !!syncEncrypt;
    if (encrypt) {
      if (!opts.askPassphrase) throw new SyncNeedsInteraction("passphrase", "This backup is encrypted — make it from a page that can ask for the passphrase.");
      const pass = (await opts.askPassphrase("Passphrase for the encrypted backup file.")) || "";
      if (!pass) throw new Error("Backup cancelled — no passphrase given.");
      body = JSON.stringify(await globalThis.GOGPlusBackupCrypto.encryptBackup(body, pass), null, 2);
    }

    const date = new Date(opts.now ?? Date.now());
    const file = backupName(date, encrypt);
    const writable = await (await handle.getFileHandle(file, { create: true })).createWritable();
    await writable.write(body);
    await writable.close();

    // Prune: newest `keep` dated backups stay (both plain and .enc), the rest go.
    /** @type {string[]} */
    const names = [];
    for await (const [name] of handle.entries()) {
      if (typeof name === "string" && name.startsWith(BACKUP_PREFIX)) names.push(name);
    }
    names.sort().reverse();
    /** @type {string[]} */
    const removed = [];
    for (const old of names.slice(keep)) {
      await quiet(async () => {
        await handle.removeEntry(old);
        removed.push(old);
      });
    }
    await Storage.set({ lastAutoBackupAt: date.getTime() });
    return { file, removed };
  }

  /**
   * Makes a backup if auto-backup is on and the last one is over `everyMs` old.
   * Never throws; says what happened.
   * @param {{ store?: typeof defaultStore, askPassphrase?: AskPassphrase, interactive?: boolean, everyMs?: number, now?: number }} [opts]
   */
  async function autoBackup(opts = {}) {
    const Storage = globalThis.GOGPlusStorage;
    const { autoBackup: on, syncFolderName, lastAutoBackupAt } = await Storage.get(["autoBackup", "syncFolderName", "lastAutoBackupAt"]);
    if (!on || !syncFolderName) return { ran: false, reason: "off" };
    const now = opts.now ?? Date.now();
    if (now - (lastAutoBackupAt || 0) < (opts.everyMs ?? 24 * 60 * 60 * 1000)) return { ran: false, reason: "recent" };
    try {
      return { ran: true, result: await writeBackup({ ...opts, now }) };
    } catch (err) {
      return { ran: false, reason: err instanceof SyncNeedsInteraction ? err.code : String(/** @type {any} */ (err)?.message || err) };
    }
  }

  const api = {
    FILE_NAME,
    BACKUP_PREFIX,
    SyncNeedsInteraction,
    defaultStore,
    readRemote,
    syncNow,
    describeResult,
    resolveConflict,
    autoSync,
    writeBackup,
    autoBackup,
  };
  if (typeof window !== "undefined") window.GOGPlusFolderSyncCore = api;
  if (typeof self !== "undefined") self.GOGPlusFolderSyncCore = api;
})();
