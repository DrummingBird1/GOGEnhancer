/**
 * GOG+ note image attachments — one downscaled image per game, stored in
 * IndexedDB rather than chrome.storage.local (5 MB total quota shared with
 * everything else; a handful of photos would blow through that fast).
 *
 * IMPORTANT scope note: this module is only ever loaded/called from
 * extension-origin pages (currently just tags.html) — never from a content
 * script. A content script's `indexedDB` resolves against the PAGE's origin
 * (https://www.gog.com), a completely separate database from the one
 * chrome-extension:// pages open, so a content script could write here and
 * no extension page would ever see it. If a future phase wants to attach an
 * image from the game page itself, that has to round-trip through the
 * background service worker (also chrome-extension:// origin) via
 * chrome.runtime messaging — it can't call this module directly.
 *
 * One image per slug (matches the plan: "one image per note"), downscaled
 * client-side to keep storage bounded regardless of what the user picks.
 */
// @ts-check

(() => {
  "use strict";

  const DB_NAME = "gog-plus-attachments";
  const DB_VERSION = 1;
  const STORE = "noteImages";
  const MAX_DIMENSION = 480;
  const JPEG_QUALITY = 0.75;

  /** @type {Promise<IDBDatabase> | null} */
  let dbPromise = null;

  /** @returns {Promise<IDBDatabase>} */
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      // No prior version to migrate from yet (DB_VERSION has always been 1),
      // so onupgradeneeded only ever fires on first creation — the store
      // can't already exist.
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "slug" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  /**
   * Downscales an image file/blob to at most MAX_DIMENSION on its longest
   * side and re-encodes as JPEG, so a phone-camera photo doesn't land in
   * storage at multiple megabytes.
   * @param {Blob} fileOrBlob
   * @returns {Promise<Blob>}
   */
  function downscaleImage(fileOrBlob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(fileOrBlob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("2d context unavailable"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
          "image/jpeg",
          JPEG_QUALITY
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Not a readable image"));
      };
      img.src = url;
    });
  }

  /**
   * Stores a blob exactly as given — no downscaling. Split out from
   * saveAttachmentDownscaled() so the IndexedDB read/write path can be unit
   * tested with a plain Blob, independent of the Image+canvas pipeline
   * (canvas 2D / image decoding aren't available under the happy-dom test
   * environment this repo's Vitest suite runs in).
   * @param {string} slug
   * @param {Blob} blob
   * @returns {Promise<{slug: string, sizeBytes: number}>}
   */
  async function saveAttachment(slug, blob) {
    const db = await openDb();
    const record = { slug, blob, type: blob.type, sizeBytes: blob.size, addedAt: Date.now() };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
    });
    return { slug, sizeBytes: record.sizeBytes };
  }

  /**
   * The real entry point for the UI: downscale whatever the user picked,
   * then store it. Kept separate from saveAttachment() — see that
   * function's doc comment.
   * @param {string} slug
   * @param {Blob} fileOrBlob
   * @returns {Promise<{slug: string, sizeBytes: number}>}
   */
  async function saveAttachmentDownscaled(slug, fileOrBlob) {
    const blob = await downscaleImage(fileOrBlob);
    return saveAttachment(slug, blob);
  }

  /**
   * @param {string} slug
   * @returns {Promise<{slug: string, blob: Blob, type: string, sizeBytes: number, addedAt: number} | undefined>}
   */
  async function getAttachment(slug) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(slug);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * @param {string} slug
   * @returns {Promise<void>}
   */
  async function deleteAttachment(slug) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(slug);
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Sum of every stored attachment's size, for the dashboard's storage-quota
   * stat card (chrome.storage.local's own getBytesInUse doesn't see this
   * IndexedDB database at all).
   * @returns {Promise<number>}
   */
  async function getTotalBytes() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        const rows = /** @type {Array<{sizeBytes: number}>} */ (req.result || []);
        resolve(rows.reduce((sum, r) => sum + (r.sizeBytes || 0), 0));
      };
      req.onerror = () => reject(req.error);
    });
  }

  const api = {
    saveAttachment,
    saveAttachmentDownscaled,
    getAttachment,
    deleteAttachment,
    getTotalBytes,
    downscaleImage,
  };
  if (typeof window !== "undefined") window.GOGPlusAttachments = api;
  if (typeof self !== "undefined") self.GOGPlusAttachments = api;
})();
