/**
 * GOG+ dashboard achievements panel.
 *
 * lib/achievements.js owns the pure definitions + evaluation; this module
 * is the one place that actually has storage + toast access, so it's the
 * one that persists new unlocks and renders the grid. Stats are recomputed
 * here from the same state fields stats.js's renderStats() already reads
 * (taggedGames, notesCount, trackedGames, snapshots, wishlistPricedCount,
 * purchasesWithPrice, activeRefunds) — a small, deliberate duplication
 * rather than a shared helper, matching this codebase's existing pattern of
 * each dashboard panel computing its own small metrics locally (see e.g.
 * the three separate sparkline builders across content/tags contexts).
 *
 * Evaluated once per dashboard visit (called from tags.js's init(), right
 * after renderStats()) — no new polling or background alarm.
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusTagsState;
  const { purchaseDateOf, normalizePurchaseEntry } = window.GOGPlusPurchases;
  const { ACHIEVEMENTS, evaluateAchievements } = window.GOGPlusAchievements;

  /**
   * @typedef {Object} AchievementStats
   * @property {number} taggedGames
   * @property {number} notesCount
   * @property {number} trackedGames
   * @property {number} snapshots
   * @property {number} wishlistPricedCount
   * @property {number} purchasesWithPrice
   * @property {number} activeRefunds
   */

  /** @returns {AchievementStats} */
  function computeStats() {
    const taggedGames = Object.keys(state.allTags).filter((s) => (state.allTags[s] || []).length).length;
    const notesCount = Object.values(state.allNotes).filter(Boolean).length;
    const trackedGames = Object.keys(state.allHistory).length;
    const snapshots = Object.values(state.allHistory).reduce((a, arr) => a + (arr?.length || 0), 0);

    let wishlistPricedCount = 0;
    for (const slug of state.allWishlistSlugs || []) {
      if (state.allHistory[slug]?.length) wishlistPricedCount++;
    }

    let purchasesWithPrice = 0;
    for (const raw of Object.values(state.allPurchases)) {
      const entry = normalizePurchaseEntry(raw);
      if (entry && typeof entry.price === "number") purchasesWithPrice++;
    }

    const today = new Date().toISOString().slice(0, 10);
    const activeRefunds = Object.entries(state.allPurchases).filter(([, raw]) => {
      const d = purchaseDateOf(raw);
      if (!d) return false;
      const ms = new Date(today).getTime() - new Date(d).getTime();
      return ms >= 0 && ms <= 30 * 24 * 60 * 60 * 1000;
    }).length;

    return { taggedGames, notesCount, trackedGames, snapshots, wishlistPricedCount, purchasesWithPrice, activeRefunds };
  }

  /** @returns {Promise<string[]>} newly unlocked ids, already persisted */
  async function evaluateAndPersist() {
    const stats = computeStats();
    const newly = evaluateAchievements(stats, state.achievements || {});
    if (!newly.length) return [];
    const now = new Date().toISOString();
    const updated = { ...(state.achievements || {}) };
    for (const id of newly) updated[id] = now;
    state.achievements = updated;
    await window.GOGPlusStorage.set({ achievements: updated });
    for (const id of newly) {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (a) window.GOGPlusToasts?.show(`🏆 Achievement unlocked: ${a.title}`);
    }
    return newly;
  }

  function renderAchievements() {
    const panel = document.getElementById("achievementsPanel");
    if (!panel) return;
    const unlocked = state.achievements || {};
    const cards = ACHIEVEMENTS.map((a) => {
      const isUnlocked = !!unlocked[a.id];
      const dateStr = isUnlocked ? new Date(unlocked[a.id]).toLocaleDateString() : "";
      return `
        <div class="achievement-badge${isUnlocked ? " unlocked" : ""}" title="${a.description}">
          <span class="achievement-icon">${a.icon}</span>
          <span class="achievement-title">${a.title}</span>
          <span class="achievement-desc">${a.description}</span>
          ${isUnlocked ? `<span class="achievement-date">${dateStr}</span>` : ""}
        </div>
      `;
    }).join("");
    const unlockedCount = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
    panel.innerHTML = `
      <header class="tonight-header">
        <span class="tonight-eyebrow">Achievements</span>
        <h2>${unlockedCount} / ${ACHIEVEMENTS.length} unlocked</h2>
      </header>
      <div class="achievements-grid">${cards}</div>
    `;
  }

  window.GOGPlusTagsAchievements = { computeStats, evaluateAndPersist, renderAchievements };
})();
