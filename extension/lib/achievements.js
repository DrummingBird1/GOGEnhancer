/**
 * GOG+ achievements — a small, entirely local, entirely optional badge
 * system. Every condition is evaluated off numbers the tag dashboard's
 * stats.js already computes on every visit (tagged-game count, notes
 * written, games tracked, snapshots, wishlist/spending/refund counts) —
 * there's no new background polling or storage scan added for this.
 *
 * `unlocked` (the `achievements` local-storage key, id -> ISO date string)
 * is the durable record. evaluateAchievements() is pure — given the current
 * stats and what's already unlocked, it returns which ids newly qualify;
 * the caller (tags/features/achievements.js) is the one that persists them
 * and shows a toast, since only that context has storage + toast access.
 */
// @ts-check

(() => {
  "use strict";

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

  /**
   * @typedef {Object} Achievement
   * @property {string} id
   * @property {string} icon
   * @property {string} title
   * @property {string} description
   * @property {(s: AchievementStats) => boolean} check
   */

  /** @type {Achievement[]} */
  const ACHIEVEMENTS = [
    {
      id: "first-tag",
      icon: "🏷️",
      title: "Getting Started",
      description: "Tag your first game.",
      check: (s) => s.taggedGames >= 1,
    },
    {
      id: "curator",
      icon: "🗂️",
      title: "Curator",
      description: "Tag 10 games.",
      check: (s) => s.taggedGames >= 10,
    },
    {
      id: "archivist",
      icon: "📚",
      title: "Archivist",
      description: "Tag 25 games.",
      check: (s) => s.taggedGames >= 25,
    },
    {
      id: "note-taker",
      icon: "📝",
      title: "Note Taker",
      description: "Write your first note.",
      check: (s) => s.notesCount >= 1,
    },
    {
      id: "storyteller",
      icon: "✍️",
      title: "Storyteller",
      description: "Write notes on 5 games.",
      check: (s) => s.notesCount >= 5,
    },
    {
      id: "price-watcher",
      icon: "👀",
      title: "Price Watcher",
      description: "Track price history on 5 games.",
      check: (s) => s.trackedGames >= 5,
    },
    {
      id: "market-analyst",
      icon: "📈",
      title: "Market Analyst",
      description: "Track price history on 25 games.",
      check: (s) => s.trackedGames >= 25,
    },
    {
      id: "snapshot-streak",
      icon: "📸",
      title: "Snapshot Streak",
      description: "Rack up 50 price snapshots across your tracked games.",
      check: (s) => s.snapshots >= 50,
    },
    {
      id: "wishlist-curator",
      icon: "⭐",
      title: "Wishlist Curator",
      description: "Have price history on 10 wishlisted games.",
      check: (s) => s.wishlistPricedCount >= 10,
    },
    {
      id: "budget-tracker",
      icon: "💰",
      title: "Budget Tracker",
      description: "Log a price on a purchase.",
      check: (s) => s.purchasesWithPrice >= 1,
    },
    {
      id: "refund-guardian",
      icon: "🛡️",
      title: "Refund Guardian",
      description: "Have an active 30-day refund window tracked.",
      check: (s) => s.activeRefunds >= 1,
    },
  ];

  /**
   * @param {AchievementStats} stats
   * @param {Record<string, string>} unlocked id -> ISO date already unlocked
   * @returns {string[]} ids that newly qualify and aren't in `unlocked` yet
   */
  function evaluateAchievements(stats, unlocked) {
    const newly = [];
    for (const a of ACHIEVEMENTS) {
      if (unlocked[a.id]) continue;
      try {
        if (a.check(stats)) newly.push(a.id);
      } catch (_) {
        // A malformed stats object shouldn't crash the dashboard render.
      }
    }
    return newly;
  }

  const api = { ACHIEVEMENTS, evaluateAchievements };
  if (typeof window !== "undefined") window.GOGPlusAchievements = api;
  if (typeof self !== "undefined") self.GOGPlusAchievements = api;
})();
