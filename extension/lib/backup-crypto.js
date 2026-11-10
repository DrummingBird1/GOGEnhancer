/**
 * GOG+ backup encryption (Web Crypto — no dependency, no data ever leaves the
 * device). PBKDF2-derived AES-256-GCM key; salt + IV travel in plaintext
 * alongside the ciphertext in the exported file, which is normal — they are
 * not secret, only the password is. New files use 600k PBKDF2-SHA256
 * iterations (OWASP's current baseline); the count is written into the file, so
 * older 250k files still open.
 *
 * Shared by the options page (encrypted backup export/import), the folder sync
 * (an encrypted sync file) and the automatic dated backups. It used to live
 * inside options.js; it moved here so pages and workers other than the options
 * page can use the same envelope.
 */
// @ts-check

(() => {
  "use strict";

  const ENCRYPTED_BACKUP_FORMAT = "gog-enhancer-encrypted-backup";
  const PBKDF2_ITERATIONS = 600000;
  const LEGACY_ITERATIONS = 250000;
  const FORMAT_VERSION = 2;

  /** @param {ArrayBuffer | Uint8Array} buf */
  function bufToBase64(buf) {
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  /** @param {string} b64 */
  function base64ToBuf(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < bytes.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  /**
   * @param {string} password
   * @param {Uint8Array} salt
   * @param {number} [iterations]
   * @param {boolean} [normalize]
   * @returns {Promise<CryptoKey>}
   */
  async function deriveBackupKey(password, salt, iterations = PBKDF2_ITERATIONS, normalize = true) {
    // NFKC so the same word typed on two keyboards/OSes derives the same key.
    const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(normalize ? String(password).normalize("NFKC") : String(password)), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: /** @type {BufferSource} */ (salt), iterations, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  /**
   * @param {string} plaintext
   * @param {string} password
   * @returns {Promise<{format: string, formatVersion: number, kdf: string, iterations: number, exportedAt: string, salt: string, iv: string, ciphertext: string}>}
   */
  async function encryptBackup(plaintext, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveBackupKey(password, salt);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
    return {
      format: ENCRYPTED_BACKUP_FORMAT,
      formatVersion: FORMAT_VERSION,
      kdf: "PBKDF2-SHA256",
      iterations: PBKDF2_ITERATIONS,
      exportedAt: new Date().toISOString(),
      salt: bufToBase64(salt),
      iv: bufToBase64(iv),
      ciphertext: bufToBase64(ciphertext),
    };
  }

  /**
   * @param {{ salt: string, iv: string, ciphertext: string, formatVersion?: number, iterations?: number }} envelope
   * @param {string} password
   * @returns {Promise<string>} the decrypted plaintext
   */
  async function decryptBackup(envelope, password) {
    if ((envelope.formatVersion || 1) > FORMAT_VERSION) {
      throw new Error("This backup was made by a newer version of GOG Enhancer. Update the extension to open it.");
    }
    const salt = new Uint8Array(base64ToBuf(envelope.salt));
    const iv = new Uint8Array(base64ToBuf(envelope.iv));
    // Version-1 files carry no count: they were written with 250k iterations.
    const iterations = envelope.formatVersion && envelope.iterations ? envelope.iterations : LEGACY_ITERATIONS;
    if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 5000000) throw new Error("Unsupported backup settings.");
    const cipher = base64ToBuf(envelope.ciphertext);
    const key = await deriveBackupKey(password, salt, iterations);
    try {
      return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher));
    } catch (_) {
      // Files from before the password was normalised used it as typed.
      if (String(password).normalize("NFKC") !== password) {
        try {
          const raw = await deriveBackupKey(password, salt, iterations, false);
          return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, raw, cipher));
        } catch (_2) {
          /* fall through */
        }
      }
      throw new Error("Wrong password, or the file is corrupted.");
    }
  }

  const api = { ENCRYPTED_BACKUP_FORMAT, encryptBackup, decryptBackup };
  if (typeof window !== "undefined") window.GOGPlusBackupCrypto = api;
  if (typeof self !== "undefined") self.GOGPlusBackupCrypto = api;
})();
