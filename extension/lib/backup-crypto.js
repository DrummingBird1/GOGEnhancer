/**
 * GOG+ backup encryption (Web Crypto — no dependency, no data ever leaves the
 * device). PBKDF2-derived AES-256-GCM key; salt + IV travel in plaintext
 * alongside the ciphertext in the exported file, which is normal — they are
 * not secret, only the password is. 250k PBKDF2 iterations is OWASP's 2023
 * baseline for PBKDF2-SHA256.
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
  const PBKDF2_ITERATIONS = 250000;

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
   * @returns {Promise<CryptoKey>}
   */
  async function deriveBackupKey(password, salt) {
    const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: /** @type {BufferSource} */ (salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  /**
   * @param {string} plaintext
   * @param {string} password
   * @returns {Promise<{format: string, formatVersion: number, exportedAt: string, salt: string, iv: string, ciphertext: string}>}
   */
  async function encryptBackup(plaintext, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveBackupKey(password, salt);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
    return {
      format: ENCRYPTED_BACKUP_FORMAT,
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      salt: bufToBase64(salt),
      iv: bufToBase64(iv),
      ciphertext: bufToBase64(ciphertext),
    };
  }

  /**
   * @param {{ salt: string, iv: string, ciphertext: string }} envelope
   * @param {string} password
   * @returns {Promise<string>} the decrypted plaintext
   */
  async function decryptBackup(envelope, password) {
    const salt = new Uint8Array(base64ToBuf(envelope.salt));
    const iv = new Uint8Array(base64ToBuf(envelope.iv));
    const key = await deriveBackupKey(password, salt);
    let plainBuf;
    try {
      plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, base64ToBuf(envelope.ciphertext));
    } catch (_) {
      throw new Error("Wrong password, or the file is corrupted.");
    }
    return new TextDecoder().decode(plainBuf);
  }

  const api = { ENCRYPTED_BACKUP_FORMAT, encryptBackup, decryptBackup };
  if (typeof window !== "undefined") window.GOGPlusBackupCrypto = api;
  if (typeof self !== "undefined") self.GOGPlusBackupCrypto = api;
})();
