/**
 * GOG+ storage migrations.
 *
 * Shared between the background service worker (runs on every
 * onInstalled) and the Advanced Options import flow (runs after writing
 * imported data into storage) — so a settings export from an old version
 * gets the exact same shape-fixing pass a normal upgrade would have given
 * it, instead of silently loading with the pre-migration shape.
 *
 * Operates directly on chrome.storage (not an in-memory object) since
 * that's what both call sites actually have: background.js reads whatever
 * onInstalled found already committed, and the import flow has already
 * written the imported blob into storage by the time this runs.
 *
 * To add a new migration: bump GOG_PLUS_SETTINGS_VERSION in defaults.js and
 * add another `if (settingsVersion < N)` branch below, modeled on v1→v2.
 */
// @ts-check

(() => {
  "use strict";

  /** @returns {Promise<void>} */
  async function run() {
    const CURRENT_SETTINGS_VERSION = globalThis.GOG_PLUS_SETTINGS_VERSION;
    const Storage = globalThis.GOGPlusStorage;
    const { settingsVersion } = await Storage.get({ settingsVersion: 1 });

    if (settingsVersion < 2) {
      const syncAll = await new Promise((r) => chrome.storage.sync.get(null, r));
      const toLocal = {};
      if (syncAll.tags) toLocal.tags = syncAll.tags;
      if (syncAll.notes) toLocal.notes = syncAll.notes;

      if (Object.keys(toLocal).length) {
        // Step 1: write to local. If this fails, abort migration entirely —
        // settingsVersion stays put so the next run retries.
        try {
          await /** @type {Promise<void>} */ (
            new Promise((resolve, reject) => {
              chrome.storage.local.set(toLocal, () => {
                if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                else resolve();
              });
            })
          );
        } catch (err) {
          console.error("[GOG+] migration v1→v2 local.set failed, aborting:", err);
          return;
        }

        // Step 2: remove the now-duplicate sync keys. If this fails, the data
        // is still safely in local — we just leave stale sync entries behind
        // and continue. They'll be wiped if the user ever runs Reset Everything.
        try {
          await /** @type {Promise<void>} */ (
            new Promise((resolve, reject) => {
              chrome.storage.sync.remove(["tags", "notes"], () => {
                if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                else resolve();
              });
            })
          );
        } catch (err) {
          console.warn(
            "[GOG+] migration v1→v2 sync cleanup failed (data preserved in local, sync may have stale tags/notes):",
            err
          );
        }
      }
    }

    await Storage.set({ settingsVersion: CURRENT_SETTINGS_VERSION });
  }

  const api = { run };
  if (typeof window !== "undefined") window.GOGPlusMigrations = api;
  if (typeof self !== "undefined") self.GOGPlusMigrations = api;
})();
