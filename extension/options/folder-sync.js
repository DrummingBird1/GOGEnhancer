/**
 * GOG+ folder sync (options page).
 *
 * The user picks a folder their own cloud client already syncs (Dropbox,
 * OneDrive, Google Drive, Syncthing…). The work of reading and writing the
 * ONE file in it, gog-enhancer-sync.json, and merging with other browsers
 * lives in lib/folder-sync-core.js (merge rules in lib/sync-core.js); this
 * script is the options-page face of it: choosing the folder, the buttons,
 * the conflict list, auto-sync and dated backups. The extension itself makes no
 * network request for any of this — the folder is the whole transport.
 *
 * Needs the File System Access API (Chrome / Edge / Brave); on browsers
 * without it the UI says so rather than offering a button that can't work.
 * Folder access can only be (re)granted from a user gesture on an
 * extension page, which is why the first sync is a button here; once the
 * browser remembers the grant, the dashboard and the service worker can keep
 * it in sync on their own (see "Sync automatically").
 */

(() => {
  "use strict";

  const core = window.GOGPlusFolderSyncCore;
  const FILE_NAME = core.FILE_NAME;

  // An object (not three bare functions) so a test can swap in an in-memory
  // store: a stand-in directory handle isn't structured-cloneable the way a
  // real FileSystemDirectoryHandle is.
  const store = { ...core.defaultStore };

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
    await window.GOGPlusStorage.set({ syncFolderName: handle.name, lastFolderSyncAt: 0, syncBaseMeta: {}, syncConflicts: [] });
    return handle.name;
  }

  async function forget() {
    await store.clear();
    await window.GOGPlusStorage.set({ syncFolderName: "", lastFolderSyncAt: 0, syncBaseMeta: {}, syncConflicts: [], autoSync: false, autoBackup: false });
  }

  /**
   * One full sync (see core.syncNow). Throws an Error with a user-presentable
   * message on any failure, having changed nothing it couldn't finish.
   * @returns {Promise<{ pulled: boolean, pushed: boolean, created: boolean }>}
   */
  const syncNow = () => core.syncNow({ store, askPassphrase: (m) => ui.askPassphrase(m), interactive: true });

  /** @returns {Promise<{ file: string, removed: string[] }>} */
  const backupNow = () => core.writeBackup({ store, askPassphrase: (m) => ui.askPassphrase(m), interactive: true });

  const describeResult = core.describeResult;

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

  /** What a conflicting value looks like, in one short line. @param {any} v */
  function brief(v) {
    if (v === undefined) return "(deleted)";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return s.length > 60 ? `${s.slice(0, 57)}…` : s;
  }

  async function renderConflicts() {
    const host = $("syncConflicts");
    if (!host) return;
    const { syncConflicts = [] } = await window.GOGPlusStorage.get(["syncConflicts"]);
    host.replaceChildren();
    host.hidden = !syncConflicts.length;
    if (!syncConflicts.length) return;
    const intro = document.createElement("p");
    intro.className = "hint";
    intro.textContent = `${syncConflicts.length} record${syncConflicts.length === 1 ? " was" : "s were"} changed in two places since the last sync. The newest edit won; overrule it here if you prefer the other.`;
    host.appendChild(intro);
    for (const c of syncConflicts) {
      const row = document.createElement("div");
      row.className = "sync-conflict";
      const name = document.createElement("strong");
      name.textContent = `${c.key} · ${c.id}`;
      const detail = document.createElement("span");
      detail.className = "hint";
      detail.textContent = `This browser: ${brief(c.local)}  |  Other browser: ${brief(c.remote)}  — kept: ${c.kept === "local" ? "this browser's" : "the other's"}`;
      row.append(name, detail);
      for (const side of /** @type {const} */ (["local", "remote"])) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn";
        b.dataset.use = side;
        b.textContent = side === "local" ? "Use this browser's" : "Use the other's";
        b.addEventListener("click", async () => {
          await core.resolveConflict(c, side);
          await renderConflicts();
        });
        row.appendChild(b);
      }
      host.appendChild(row);
    }
  }

  async function refreshStatus() {
    const s = await window.GOGPlusStorage.get(["syncFolderName", "lastFolderSyncAt", "syncEncrypt", "autoSync", "autoBackup", "autoBackupKeep", "lastAutoBackupAt"]);
    $("syncFolderName").textContent = s.syncFolderName || "None chosen";
    $("syncLast").textContent = formatAgo(s.lastFolderSyncAt);
    $("syncEncrypt").checked = !!s.syncEncrypt;
    const has = !!s.syncFolderName;
    $("syncNow").disabled = !has;
    $("syncForget").disabled = !has;
    if ($("syncAuto")) {
      $("syncAuto").checked = !!s.autoSync;
      $("syncAuto").disabled = !has;
    }
    if ($("backupAuto")) {
      $("backupAuto").checked = !!s.autoBackup;
      $("backupAuto").disabled = !has;
      $("backupKeep").value = String(s.autoBackupKeep || 7);
      $("backupKeep").disabled = !has;
      $("backupNow").disabled = !has;
      $("backupLast").textContent = formatAgo(s.lastAutoBackupAt);
    }
    await renderConflicts();
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
      const buttons = [$("syncChoose"), $("syncNow"), $("syncForget"), $("backupNow")].filter(Boolean);
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
    $("syncAuto")?.addEventListener("change", () => window.GOGPlusStorage.set({ autoSync: $("syncAuto").checked }));
    $("backupAuto")?.addEventListener("change", () => window.GOGPlusStorage.set({ autoBackup: $("backupAuto").checked }));
    $("backupKeep")?.addEventListener("change", () => {
      const n = Math.max(1, Math.min(60, parseInt($("backupKeep").value, 10) || 7));
      $("backupKeep").value = String(n);
      window.GOGPlusStorage.set({ autoBackupKeep: n });
    });
    $("backupNow")?.addEventListener("click", () =>
      run(async () => {
        const r = await backupNow();
        return `Wrote ${r.file}${r.removed.length ? ` and removed ${r.removed.length} older backup${r.removed.length === 1 ? "" : "s"}` : ""}.`;
      })
    );
    window.GOGPlusStorage.onChange(({ key }) => {
      if (["syncFolderName", "lastFolderSyncAt", "syncConflicts", "lastAutoBackupAt"].includes(key)) refreshStatus();
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
    backupNow,
    describeResult,
    formatAgo,
    init,
  };

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
