/**
 * GOG+ monthly challenges — three small, local goals a month, drawn from a
 * fixed pool and measured only from data the extension already keeps with a
 * date on it (when a game was marked Playing / Finished, the days a game's
 * price was recorded, the day streak). Nothing is fetched, nobody competes, and
 * a missed challenge costs nothing.
 *
 * Which three? `pick(monthKey)` is a pure function of the month ("2026-10"), so
 * every device (and every reload) shows the same ones, and the choice needs no
 * storage. Only completions are stored, as `challengesDone[monthKey] = [ids]`,
 * by the dashboard when it notices one.
 */
// @ts-check

(() => {
  "use strict";

  /**
   * What a challenge can look at.
   * @typedef {{
   *   statusDates?: Record<string, { playing?: string, finished?: string }>,
   *   priceHistory?: Record<string, Array<{ d: string }>>,
   *   streakNow?: number,
   *   monthlyGoal?: number
   * }} ChallengeData
   * @typedef {{ id: string, icon: string, title: string, goal: number, measure: (d: ChallengeData, month: string) => number }} Challenge
   */

  /** @param {string | undefined} date @param {string} month */
  const inMonth = (date, month) => typeof date === "string" && date.startsWith(month);

  /** @type {Challenge[]} */
  const POOL = [
    {
      id: "finish-1",
      icon: "🏁",
      title: "Finish a game",
      goal: 1,
      measure: (d, m) => Object.values(d.statusDates || {}).filter((s) => inMonth(s?.finished, m)).length,
    },
    {
      id: "finish-2",
      icon: "🏆",
      title: "Finish two games",
      goal: 2,
      measure: (d, m) => Object.values(d.statusDates || {}).filter((s) => inMonth(s?.finished, m)).length,
    },
    {
      id: "start-3",
      icon: "▶️",
      title: "Start three games from your backlog",
      goal: 3,
      measure: (d, m) => Object.values(d.statusDates || {}).filter((s) => inMonth(s?.playing, m)).length,
    },
    {
      id: "price-days-10",
      icon: "📅",
      title: "Look at prices on ten different days",
      goal: 10,
      measure: (d, m) => {
        const days = new Set();
        for (const list of Object.values(d.priceHistory || {})) for (const e of list || []) if (inMonth(e?.d, m)) days.add(e.d);
        return days.size;
      },
    },
    {
      id: "track-5",
      icon: "👀",
      title: "Start tracking five new games' prices",
      goal: 5,
      measure: (d, m) => Object.values(d.priceHistory || {}).filter((list) => list?.length && inMonth(list[0]?.d, m)).length,
    },
    {
      id: "streak-7",
      icon: "🔥",
      title: "Reach a seven-day streak",
      goal: 7,
      measure: (d) => d.streakNow || 0,
    },
  ];

  /** A small string hash (FNV-1a), for a stable choice. @param {string} s */
  function hash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  /**
   * The month's challenges: three different ones, the same for a given month
   * everywhere. "finish-1" and "finish-2" never appear together (they're the
   * same thing at two sizes).
   * @param {string} month "YYYY-MM"
   * @param {number} [n]
   * @returns {Challenge[]}
   */
  function pick(month, n = 3) {
    const order = POOL.map((c) => ({ c, k: hash(`${month}:${c.id}`) })).sort((a, b) => a.k - b.k || a.c.id.localeCompare(b.c.id));
    /** @type {Challenge[]} */
    const out = [];
    for (const { c } of order) {
      if (out.length >= n) break;
      if (c.id.startsWith("finish-") && out.some((o) => o.id.startsWith("finish-"))) continue;
      out.push(c);
    }
    return out;
  }

  /**
   * @param {string} month @param {ChallengeData} data
   * @returns {Array<{ id: string, icon: string, title: string, goal: number, progress: number, done: boolean }>}
   */
  function evaluate(month, data) {
    return pick(month).map((c) => {
      const progress = Math.max(0, Math.floor(c.measure(data || {}, month)));
      return { id: c.id, icon: c.icon, title: c.title, goal: c.goal, progress: Math.min(progress, c.goal), done: progress >= c.goal };
    });
  }

  /**
   * Ids newly completed that the record doesn't have yet.
   * @param {ReturnType<typeof evaluate>} list @param {string[]} [alreadyDone]
   */
  function newlyDone(list, alreadyDone = []) {
    return list.filter((c) => c.done && !alreadyDone.includes(c.id)).map((c) => c.id);
  }

  /** How many challenges have ever been completed. @param {Record<string, string[]> | undefined} done */
  function totalDone(done) {
    return Object.values(done || {}).reduce((n, ids) => n + (Array.isArray(ids) ? ids.length : 0), 0);
  }

  /** "YYYY-MM" for a date. @param {Date} [d] */
  function monthKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  const api = { POOL, hash, pick, evaluate, newlyDone, totalDone, monthKey };
  if (typeof window !== "undefined") /** @type {any} */ (window).GOGPlusChallenges = api;
  if (typeof self !== "undefined") /** @type {any} */ (self).GOGPlusChallenges = api;
})();
