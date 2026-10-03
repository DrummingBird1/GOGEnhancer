/**
 * GOG+ achievements — a small, entirely local, entirely optional badge
 * system. Every condition is evaluated off numbers the tag dashboard already
 * has (tagged-game count, notes written, games tracked, snapshots, library
 * size, finished games, your day streak, …) — there's no new background
 * polling or storage scan added for this.
 *
 * Each achievement has a tier (bronze / silver / gold — how much effort it
 * takes, only for the colour of its badge) and a few are hidden: their
 * description stays "???" until they unlock, so there's something left to find.
 * Ids never change once shipped — `unlocked` (the `achievements` local-storage
 * key, id -> ISO date string) is the durable record.
 *
 * evaluateAchievements() is pure — given the current stats and what's already
 * unlocked, it returns which ids newly qualify; the caller
 * (tags/features/achievements.js) is the one that persists them and shows a
 * toast, since only that context has storage + toast access.
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
   * @property {number} [owned] games the site has shown you as in your library
   * @property {number} [finished] games marked Finished
   * @property {number} [backlog] games marked Backlog
   * @property {number} [genresTracked] distinct genres among your tagged / tracked games
   * @property {number} [retroOwned] owned games first released before 2005
   * @property {number} [alertsSet] price alerts you've set
   * @property {number} [streakBest] your longest day streak
   * @property {number} [wishlistSize] wishlisted games the extension knows of
   * @property {number} [notInterested] games you've hidden
   * @property {boolean} [syncUsed] a sync folder has been chosen
   * @property {boolean} [backedUp] an automatic backup has been written
   * @property {number} [challengesDone] monthly challenges ever completed
   */

  /**
   * @typedef {"bronze" | "silver" | "gold"} Tier
   * @typedef {Object} Achievement
   * @property {string} id
   * @property {string} icon
   * @property {string} title
   * @property {string} description
   * @property {Tier} tier
   * @property {boolean} [hidden] description is "???" until unlocked
   * @property {(s: AchievementStats, unlocked: Record<string, string>) => boolean} check
   */

  /** @param {number | undefined} n */
  const n0 = (n) => n || 0;

  /** @type {Achievement[]} */
  const ACHIEVEMENTS = [
    // ---- tags & notes
    { id: "first-tag", icon: "🏷️", title: "Getting Started", description: "Tag your first game.", tier: "bronze", check: (s) => s.taggedGames >= 1 },
    { id: "curator", icon: "🗂️", title: "Curator", description: "Tag 10 games.", tier: "bronze", check: (s) => s.taggedGames >= 10 },
    { id: "archivist", icon: "📚", title: "Archivist", description: "Tag 25 games.", tier: "silver", check: (s) => s.taggedGames >= 25 },
    { id: "librarian", icon: "🏛️", title: "Librarian", description: "Tag 50 games.", tier: "gold", check: (s) => s.taggedGames >= 50 },
    { id: "note-taker", icon: "📝", title: "Note Taker", description: "Write your first note.", tier: "bronze", check: (s) => s.notesCount >= 1 },
    { id: "storyteller", icon: "✍️", title: "Storyteller", description: "Write notes on 5 games.", tier: "silver", check: (s) => s.notesCount >= 5 },
    { id: "chronicler", icon: "📖", title: "Chronicler", description: "Write notes on 25 games.", tier: "gold", check: (s) => s.notesCount >= 25 },
    { id: "explorer", icon: "🧭", title: "Genre Explorer", description: "Have tagged or tracked games in 5 different genres.", tier: "silver", check: (s) => n0(s.genresTracked) >= 5 },

    // ---- prices & deals
    { id: "price-watcher", icon: "👀", title: "Price Watcher", description: "Track price history on 5 games.", tier: "bronze", check: (s) => s.trackedGames >= 5 },
    { id: "market-analyst", icon: "📈", title: "Market Analyst", description: "Track price history on 25 games.", tier: "silver", check: (s) => s.trackedGames >= 25 },
    { id: "price-oracle", icon: "🔮", title: "Price Oracle", description: "Track price history on 100 games.", tier: "gold", check: (s) => s.trackedGames >= 100 },
    { id: "snapshot-streak", icon: "📸", title: "Snapshot Streak", description: "Rack up 50 price snapshots across your tracked games.", tier: "bronze", check: (s) => s.snapshots >= 50 },
    { id: "snapshot-500", icon: "🗃️", title: "Ledger Keeper", description: "Record 500 price snapshots.", tier: "gold", check: (s) => s.snapshots >= 500 },
    { id: "wishlist-curator", icon: "⭐", title: "Wishlist Curator", description: "Have price history on 10 wishlisted games.", tier: "silver", check: (s) => s.wishlistPricedCount >= 10 },
    { id: "wishlist-50", icon: "💫", title: "Dreamer", description: "Have 50 games on your wishlist.", tier: "silver", check: (s) => n0(s.wishlistSize) >= 50 },
    { id: "tripwire", icon: "🪤", title: "Tripwire", description: "Set your first price alert.", tier: "bronze", check: (s) => n0(s.alertsSet) >= 1 },
    { id: "alert-master", icon: "🚨", title: "Alert Master", description: "Have 5 price alerts set at once.", tier: "silver", check: (s) => n0(s.alertsSet) >= 5 },
    { id: "budget-tracker", icon: "💰", title: "Budget Tracker", description: "Log a price on a purchase.", tier: "bronze", check: (s) => s.purchasesWithPrice >= 1 },
    { id: "refund-guardian", icon: "🛡️", title: "Refund Guardian", description: "Have an active 30-day refund window tracked.", tier: "bronze", check: (s) => s.activeRefunds >= 1 },

    // ---- your library
    { id: "shelf-started", icon: "🎮", title: "Shelf Started", description: "Have 10 games in your library.", tier: "bronze", check: (s) => n0(s.owned) >= 10 },
    { id: "collector", icon: "🧰", title: "Collector", description: "Have 50 games in your library.", tier: "silver", check: (s) => n0(s.owned) >= 50 },
    { id: "hoard", icon: "🐉", title: "Dragon's Hoard", description: "Have 150 games in your library.", tier: "gold", check: (s) => n0(s.owned) >= 150 },
    { id: "finisher", icon: "🏁", title: "Finisher", description: "Finish your first game.", tier: "bronze", check: (s) => n0(s.finished) >= 1 },
    { id: "closer", icon: "🥈", title: "Closer", description: "Finish 5 games.", tier: "silver", check: (s) => n0(s.finished) >= 5 },
    { id: "completionist-games", icon: "🥇", title: "Roll the Credits", description: "Finish 25 games.", tier: "gold", check: (s) => n0(s.finished) >= 25 },
    { id: "retro-heart", icon: "🕹️", title: "Retro Heart", description: "Own 10 games first released before 2005.", tier: "silver", check: (s) => n0(s.retroOwned) >= 10 },
    { id: "picky", icon: "🙅", title: "Picky", description: "Hide 20 games you're not interested in.", tier: "bronze", hidden: true, check: (s) => n0(s.notInterested) >= 20 },
    { id: "backlog-zero", icon: "🧹", title: "Backlog Zero", description: "Finish at least 5 games and leave nothing in your backlog.", tier: "gold", hidden: true, check: (s) => n0(s.finished) >= 5 && n0(s.backlog) === 0 },

    // ---- habits
    { id: "streak-3", icon: "🔥", title: "Regular", description: "Look at gog.com 3 days in a row.", tier: "bronze", check: (s) => n0(s.streakBest) >= 3 },
    { id: "streak-7", icon: "📆", title: "Weekly Habit", description: "Look at gog.com 7 days in a row.", tier: "silver", check: (s) => n0(s.streakBest) >= 7 },
    { id: "streak-30", icon: "🌋", title: "Devoted", description: "Look at gog.com 30 days in a row.", tier: "gold", check: (s) => n0(s.streakBest) >= 30 },
    { id: "everywhere", icon: "☁️", title: "Everywhere", description: "Set up folder sync between your browsers.", tier: "silver", check: (s) => !!s.syncUsed },
    { id: "safety-net", icon: "🪂", title: "Safety Net", description: "Have an automatic backup written.", tier: "silver", check: (s) => !!s.backedUp },
    { id: "challenger", icon: "🎯", title: "Challenger", description: "Complete a monthly challenge.", tier: "bronze", check: (s) => n0(s.challengesDone) >= 1 },
    { id: "challenge-12", icon: "🏅", title: "Year of Challenges", description: "Complete 12 monthly challenges.", tier: "gold", hidden: true, check: (s) => n0(s.challengesDone) >= 12 },
    {
      id: "completionist",
      icon: "👑",
      title: "Completionist",
      description: "Unlock every other achievement.",
      tier: "gold",
      hidden: true,
      check: (_s, unlocked) => ACHIEVEMENTS.filter((a) => a.id !== "completionist").every((a) => !!unlocked[a.id]),
    },
  ];

  /**
   * @param {AchievementStats} stats
   * @param {Record<string, string>} unlocked id -> ISO date already unlocked
   * @returns {string[]} ids that newly qualify and aren't in `unlocked` yet
   */
  function evaluateAchievements(stats, unlocked) {
    /** @type {string[]} */
    const newly = [];
    const have = { ...unlocked };
    // A second pass lets "Completionist" notice the ones this pass just unlocked.
    for (let pass = 0; pass < 2; pass++) {
      for (const a of ACHIEVEMENTS) {
        if (have[a.id]) continue;
        try {
          if (a.check(stats, have)) {
            newly.push(a.id);
            have[a.id] = "now";
          }
        } catch (_) {
          // A malformed stats object shouldn't crash the dashboard render.
        }
      }
    }
    return newly;
  }

  /**
   * How the unlocked achievements split by tier.
   * @param {Record<string, string>} unlocked
   * @returns {Record<Tier, { have: number, total: number }>}
   */
  function tierCounts(unlocked) {
    /** @type {Record<Tier, { have: number, total: number }>} */
    const out = { bronze: { have: 0, total: 0 }, silver: { have: 0, total: 0 }, gold: { have: 0, total: 0 } };
    for (const a of ACHIEVEMENTS) {
      out[a.tier].total++;
      if (unlocked[a.id]) out[a.tier].have++;
    }
    return out;
  }

  const api = { ACHIEVEMENTS, evaluateAchievements, tierCounts };
  if (typeof window !== "undefined") window.GOGPlusAchievements = api;
  if (typeof self !== "undefined") self.GOGPlusAchievements = api;
})();
