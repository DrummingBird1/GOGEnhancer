/**
 * GOG+ purchase-log entry helpers.
 *
 * `purchaseLog` (chrome.storage.local, slug -> value) used to store a plain
 * "YYYY-MM-DD" string; the settingsVersion 2→3 migration widens it to an
 * object — { date: string, price?: number, currency?: string } — so the optional
 * price paid can power the spending-tracker stat without a separate
 * parallel storage key. lib/migrations.js upgrades stored data on
 * install/import (see its v2→v3 branch), but every reader here ALSO
 * tolerates the old bare-string shape directly, as defense in depth: a
 * reader can legitimately run before migration has (e.g. mid-onInstalled,
 * or a race with an in-flight import), and this is cheap to make safe.
 */
// @ts-check

(() => {
  "use strict";

  /** @typedef {{ date: string, price?: number, currency?: string }} PurchaseEntry */

  // Normalizes either the legacy string shape or the current object shape
  // into a PurchaseEntry. Returns null for anything unusable.
  /**
   * @param {string | PurchaseEntry | null | undefined} raw
   * @returns {PurchaseEntry | null}
   */
  function normalizePurchaseEntry(raw) {
    if (!raw) return null;
    if (typeof raw === "string") return { date: raw };
    if (typeof raw === "object" && typeof raw.date === "string" && raw.date) return raw;
    return null;
  }

  /**
   * @param {string | PurchaseEntry | null | undefined} raw
   * @returns {string}
   */
  function purchaseDateOf(raw) {
    return normalizePurchaseEntry(raw)?.date || "";
  }

  const api = { normalizePurchaseEntry, purchaseDateOf };
  if (typeof window !== "undefined") window.GOGPlusPurchases = api;
  if (typeof self !== "undefined") self.GOGPlusPurchases = api;
})();
