/**
 * GOG+ dashboard achievements panel.
 *
 * lib/achievements.js owns the pure definitions + evaluation; this module
 * is the one place that actually has storage + toast access, so it's the
 * one that persists new unlocks and renders the grid. Stats are recomputed
 * here from the same state fields stats.js's renderStats() already reads — a
 * small, deliberate duplication rather than a shared helper, matching this
 * codebase's existing pattern of each dashboard panel computing its own small
 * metrics locally.
 *
 * The panel also shows this month's three challenges (lib/challenges.js) and
 * the day streak (lib/streak.js). Completions are noticed and stored here, when
 * the dashboard is opened.
 *
 * Evaluated once per dashboard visit (called from tags.js's renderAll()) — no
 * new polling or background alarm.
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusTagsState;
  const { purchaseDateOf, normalizePurchaseEntry } = window.GOGPlusPurchases;
  const { ACHIEVEMENTS, evaluateAchievements, tierCounts } = window.GOGPlusAchievements;

  /**
   * @typedef {Object} AchievementStats
   * @property {number} taggedGames
   * @property {number} notesCount
   * @property {number} trackedGames
   * @property {number} snapshots
   * @property {number} wishlistPricedCount
   * @property {number} purchasesWithPrice
   * @property {number} activeRefunds
   * @property {number} owned
   * @property {number} finished
   * @property {number} backlog
   * @property {number} genresTracked
   * @property {number} retroOwned
   * @property {number} alertsSet
   * @property {number} streakBest
   * @property {number} wishlistSize
   * @property {number} notInterested
   * @property {boolean} syncUsed
   * @property {boolean} backedUp
   * @property {number} challengesDone
   */

  /** @returns {AchievementStats} */
  function computeStats() {
    const taggedSlugs = Object.keys(state.allTags).filter((s) => (state.allTags[s] || []).length);
    const taggedGames = taggedSlugs.length;
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

    const statuses = Object.values(state.allStatus || {});
    const touched = new Set([...taggedSlugs, ...Object.keys(state.allHistory), ...Object.keys(state.allStatus || {})]);
    const genres = new Set();
    for (const slug of touched) if (state.allGenres?.[slug]) genres.add(state.allGenres[slug]);

    let retroOwned = 0;
    for (const slug of Object.keys(state.allOwned || {})) {
      const year = state.allFacts?.[slug]?.year;
      if (typeof year === "number" && year > 0 && year < 2005) retroOwned++;
    }

    return {
      taggedGames,
      notesCount,
      trackedGames,
      snapshots,
      wishlistPricedCount,
      purchasesWithPrice,
      activeRefunds,
      owned: Object.keys(state.allOwned || {}).length,
      finished: statuses.filter((s) => s === "finished").length,
      backlog: statuses.filter((s) => s === "backlog").length,
      genresTracked: genres.size,
      retroOwned,
      alertsSet: Object.keys(state.alerts || {}).length,
      streakBest: state.streak?.best || 0,
      wishlistSize: (state.allWishlistSlugs || []).length,
      notInterested: Object.keys(state.notInterested || {}).length,
      syncUsed: !!state.syncFolderName,
      backedUp: (state.lastAutoBackupAt || 0) > 0,
      challengesDone: window.GOGPlusChallenges.totalDone(state.challengesDone),
    };
  }

  /* ---------------- monthly challenges ---------------- */

  function thisMonth() {
    return window.GOGPlusChallenges.monthKey(new Date());
  }

  function challengeData() {
    return {
      statusDates: state.statusDates || {},
      priceHistory: state.allHistory || {},
      streakNow: window.GOGPlusStreak.running(state.streak, window.GOGPlusStreak.dayOf(new Date())),
    };
  }

  /** Stores challenges completed since the last visit; returns their titles. */
  async function evaluateChallenges() {
    const C = window.GOGPlusChallenges;
    const month = thisMonth();
    const list = C.evaluate(month, challengeData());
    const done = state.challengesDone[month] || [];
    const fresh = C.newlyDone(list, done);
    if (!fresh.length) return [];
    const next = { ...state.challengesDone, [month]: [...done, ...fresh] };
    state.challengesDone = next;
    await window.GOGPlusStorage.set({ challengesDone: next });
    const titles = list.filter((c) => fresh.includes(c.id)).map((c) => c.title);
    for (const t of titles) window.GOGPlusToasts?.show(`🎯 Challenge complete: ${t}`);
    return titles;
  }

  /** @returns {Promise<string[]>} newly unlocked ids, already persisted */
  async function evaluateAndPersist() {
    await evaluateChallenges(); // first, so "Challenger" can unlock on the same visit
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

  /* ---------------- rendering ---------------- */

  /** @param {string} tag @param {string} [cls] @param {string} [text] @returns {HTMLElement} */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function renderChallenges() {
    const C = window.GOGPlusChallenges;
    const month = thisMonth();
    const list = C.evaluate(month, challengeData());
    const wrap = el("section", "challenges");
    wrap.setAttribute("aria-label", "This month's challenges");
    const head = el("div", "challenges-head");
    head.appendChild(el("strong", "", "This month's challenges"));
    const streakNow = window.GOGPlusStreak.running(state.streak, window.GOGPlusStreak.dayOf(new Date()));
    head.appendChild(el("span", "streak-chip", streakNow ? `🔥 ${streakNow}-day streak · best ${state.streak?.best || streakNow}` : `Best streak ${state.streak?.best || 0} days`));
    wrap.appendChild(head);
    for (const c of list) {
      const row = el("div", `challenge${c.done ? " is-done" : ""}`);
      row.appendChild(el("span", "challenge-icon", c.done ? "✅" : c.icon));
      row.appendChild(el("span", "challenge-title", c.title));
      const bar = el("span", "challenge-bar");
      bar.setAttribute("role", "progressbar");
      bar.setAttribute("aria-valuemin", "0");
      bar.setAttribute("aria-valuemax", String(c.goal));
      bar.setAttribute("aria-valuenow", String(c.progress));
      bar.setAttribute("aria-label", c.title);
      const fill = el("span", "challenge-fill");
      fill.style.width = `${Math.round((c.progress / c.goal) * 100)}%`;
      bar.appendChild(fill);
      row.appendChild(bar);
      row.appendChild(el("span", "challenge-count", `${c.progress} / ${c.goal}`));
      wrap.appendChild(row);
    }
    return wrap;
  }

  function renderAchievements() {
    const panel = document.getElementById("achievementsPanel");
    if (!panel) return;
    const unlocked = state.achievements || {};
    const tiers = tierCounts(unlocked);

    panel.replaceChildren();
    const header = el("header", "tonight-header");
    header.appendChild(el("span", "tonight-eyebrow", "Achievements"));
    const unlockedCount = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
    header.appendChild(el("h2", "", `${unlockedCount} / ${ACHIEVEMENTS.length} unlocked`));
    const tierLine = el("p", "achievement-tiers");
    for (const t of /** @type {const} */ (["bronze", "silver", "gold"])) {
      tierLine.appendChild(el("span", `tier-chip tier-${t}`, `${t} ${tiers[t].have}/${tiers[t].total}`));
    }
    header.appendChild(tierLine);
    panel.appendChild(header);

    panel.appendChild(renderChallenges());

    const grid = el("div", "achievements-grid");
    for (const a of ACHIEVEMENTS) {
      const isUnlocked = !!unlocked[a.id];
      const hiddenNow = !!a.hidden && !isUnlocked;
      const card = el("div", `achievement-badge tier-${a.tier}${isUnlocked ? " unlocked" : ""}${hiddenNow ? " is-hidden" : ""}`);
      card.title = hiddenNow ? "A hidden achievement" : a.description;
      card.appendChild(el("span", "achievement-icon", hiddenNow ? "❔" : a.icon));
      card.appendChild(el("span", "achievement-title", hiddenNow ? "Hidden" : a.title));
      card.appendChild(el("span", "achievement-desc", hiddenNow ? "???" : a.description));
      if (isUnlocked) card.appendChild(el("span", "achievement-date", new Date(unlocked[a.id]).toLocaleDateString()));
      grid.appendChild(card);
    }
    panel.appendChild(grid);
  }

  window.GOGPlusTagsAchievements = { computeStats, evaluateAndPersist, evaluateChallenges, renderAchievements };
})();
