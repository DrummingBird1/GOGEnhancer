/**
 * GOG+ folder sync (options page).
 *
 * The user picks a folder their own cloud client already syncs (Dropbox,
 * OneDrive, Google Drive, Syncthing…). This script reads and writes ONE file
 * in it, gog-enhancer-sync.json, merging with whatever other browsers have put
 * there (merge rules live in lib/sync-core.js). The extension itself makes no
 * network request for this — the folder is the whole transport.
 *
 * Needs the File System Access API (Chrome / Edge / Brave); on browsers
 * without it the UI says so rather than offering a button that can't work.
 * Folder access can only be (re)granted from a user gesture on an
 * extension page, which is why syncing is a button here rather than a
 * background job.
 */

(() => {
  "use strict";

  const FILE_NAME = "gog-enhancer-sync.json";
  const DB_NAME = "gog-plus-sync";
  const STORE = "handles";
  const KEY = "folder";

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
  const store = {
    get: () => withStore("readonly", (s) => s.get(KEY)),
    set: (h) => withStore("readwrite", (s) => s.put(h, KEY)),
    clear: () => withStore("readwrite", (s) => s.delete(KEY)),
  };

  const isSupported = () => typeof window.showDirectoryPicker === "function";

  /* ---------- user-facing steps ---------- */

  /** Overridable so tests (and a future nicer dialog) don't need window.prompt. */
  const ui = {
    /** @param {string} message @returns {string | null} */
    askPassphrase: (message) => window.prompt(message),
  };

  /** @returns {Promise<string>} the chosen folder's name */
  async function chooseFolder() {
    if (!isSupported()) throw new Error("This browser can't pick a folder for sync.");
    const handle = await window.showDirectoryPicker({ mode: "readwrite", id: "gog-enhancer-sync" });
    await store.set(handle);
    await window.GOGPlusStorage.set({ syncFolderName: handle.name, lastFolderSyncAt: 0 });
    return handle.name;
  }

  async function forget() {
    await store.clear();
    await window.GOGPlusStorage.set({ syncFolderName: "", lastFolderSyncAt: 0 });
  }

  /** @param {any} handle */
  async function ensurePermission(handle) {
    const opts = { mode: "readwrite" };
    if ((await handle.queryPermission(opts)) === "granted") return;
    if ((await handle.requestPermission(opts)) !== "granted") {
      throw new Error("Permission to use the sync folder was not granted.");
    }
  }

  /**
   * Reads the remote snapshot, or null when the file doesn't exist yet. When
   * the file is encrypted, also returns the passphrase that opened it so the
   * write-back doesn't ask a second time.
   * @param {any} dir
   * @returns {Promise<{ snapshot: { data: any, meta: any } | null, encrypted: boolean, passphrase: string }>}
   */
  async function readRemote(dir) {
    let file;
    try {
      file = await (await dir.getFileHandle(FILE_NAME)).getFile();
    } catch (err) {
      if (err && err.name === "NotFoundError") return { snapshot: null, encrypted: false, passphrase: "" };
      throw err;
    }
    let text = await file.text();
    const crypto = window.GOGPlusBackupCrypto;

    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Not JSON at all — parseSnapshotFile below reports that clearly.
    }
    let passphrase = "";
    const encrypted = !!parsed && parsed.format === crypto.ENCRYPTED_BACKUP_FORMAT;
    if (encrypted) {
      passphrase = ui.askPassphrase("The sync file is encrypted. Enter its passphrase.") || "";
      if (!passphrase) throw new Error("Sync cancelled — the sync file is encrypted and no passphrase was given.");
      text = await crypto.decryptBackup(parsed, passphrase);
    }
    return { snapshot: window.GOGPlusSyncCore.parseSnapshotFile(text), encrypted, passphrase };
  }

  /**
   * One full sync: read the folder's file, merge, write back whichever side
   * changed. Throws an Error with a user-presentable message on any failure,
   * having changed nothing it couldn't finish.
   * @returns {Promise<{ pulled: boolean, pushed: boolean, created: boolean }>}
   */
  async function syncNow() {
    const handle = await store.get();
    if (!handle) throw new Error("Choose a sync folder first.");
    await ensurePermission(handle);

    const Core = window.GOGPlusSyncCore;
    const Storage = window.GOGPlusStorage;
    const { snapshot: remote, encrypted: remoteEncrypted, passphrase: openedWith } = await readRemote(handle);

    const stored = await Storage.get([...Core.SYNCED_KEYS, "syncMeta", "historyMaxEntries", "syncEncrypt"]);
    const local = { data: stored, meta: stored.syncMeta || {} };
    const merged = Core.mergeSnapshots(local, remote || { data: {}, meta: {} }, {
      historyMax: stored.historyMaxEntries,
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
      passphrase =
        ui.askPassphrase(
          "Choose a passphrase for the encrypted sync file.\nThere is no way to recover it if lost."
        ) || "";
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
        body = JSON.stringify(await window.GOGPlusBackupCrypto.encryptBackup(body, passphrase), null, 2);
      }
      const writable = await (await handle.getFileHandle(FILE_NAME, { create: true })).createWritable();
      await writable.write(body);
      await writable.close();
    }

    await Storage.set({ lastFolderSyncAt: Date.now() });
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

  /* ---------- page wiring ---------- */

  const $ = (id) => document.getElementById(id);

  function formatAgo(ts) {
    if (!ts) return "Never";
    const min = Math.round((Date.now() - ts) / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min} min ago`;
    const h = Math.round(min / 60);
    return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
  }

  async function refreshStatus() {
    const s = await window.GOGPlusStorage.get(["syncFolderName", "lastFolderSyncAt", "syncEncrypt"]);
    $("syncFolderName").textContent = s.syncFolderName || "None chosen";
    $("syncLast").textContent = formatAgo(s.lastFolderSyncAt);
    $("syncEncrypt").checked = !!s.syncEncrypt;
    const has = !!s.syncFolderName;
    $("syncNow").disabled = !has;
    $("syncForget").disabled = !has;
  }

  /** @param {string} msg @param {boolean} [isError] */
  function say(msg, isError = false) {
    const el = $("syncResult");
    el.textContent = msg;
    el.classList.toggle("has-error", isError);
  }

  async function init() {
    if (!$("syncCard")) return;
    if (!isSupported()) {
      $("syncUnsupported").hidden = false;
      $("syncChoose").disabled = true;
    }
    await refreshStatus();

    /** @param {() => Promise<string | void>} work */
    const run = async (work) => {
      const buttons = [$("syncChoose"), $("syncNow"), $("syncForget")];
      buttons.forEach((b) => (b.disabled = true));
      try {
        const msg = await work();
        if (msg) say(msg);
      } catch (err) {
        // The picker rejects with AbortError when the user just closes it.
        if (err && err.name === "AbortError") say("");
        else say(err instanceof Error ? err.message : String(err), true);
      } finally {
        await refreshStatus();
        if (!isSupported()) $("syncChoose").disabled = true;
      }
    };

    $("syncChoose").addEventListener("click", () =>
      run(async () => {
        const name = await chooseFolder();
        return `Folder "${name}" chosen. Press "Sync now" to merge your library with it.`;
      })
    );
    $("syncNow").addEventListener("click", () => run(async () => describeResult(await syncNow())));
    $("syncForget").addEventListener("click", () =>
      run(async () => {
        if (!confirm("Stop syncing with this folder? The file in the folder is left untouched.")) return;
        await forget();
        return "Stopped syncing.";
      })
    );
    $("syncEncrypt").addEventListener("change", () =>
      window.GOGPlusStorage.set({ syncEncrypt: $("syncEncrypt").checked })
    );
    window.GOGPlusStorage.onChange(({ key }) => {
      if (key === "syncFolderName" || key === "lastFolderSyncAt") refreshStatus();
    });
  }

  window.GOGPlusFolderSync = {
    FILE_NAME,
    ui,
    isSupported,
    store,
    chooseFolder,
    forget,
    syncNow,
    describeResult,
    formatAgo,
    init,
  };

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
