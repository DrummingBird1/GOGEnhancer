/**
 * GOG+ day streak — how many days in a row you've looked at gog.com with the
 * extension on. Pure date arithmetic on a tiny record, `{ last, current, best }`
 * (`last` is "YYYY-MM-DD" in the user's own local calendar), stored locally.
 *
 * It exists only for the achievements and monthly challenges; it isn't shown
 * anywhere that nags, and it never sends anything.
 */
// @ts-check

(() => {
  "use strict";

  /** @typedef {{ last: string, current: number, best: number }} Streak */

  /** @type {Streak} */
  const EMPTY = { last: "", current: 0, best: 0 };

  /** A local calendar day as "YYYY-MM-DD". @param {Date} [d] */
  function dayOf(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  /** Whole days from `a` to `b` ("YYYY-MM-DD"). @param {string} a @param {string} b */
  function daysBetween(a, b) {
    const pa = a.split("-").map(Number);
    const pb = b.split("-").map(Number);
    return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
  }

  /**
   * The record after a visit on `day`.
   * @param {Streak | undefined} streak @param {string} day
   * @returns {Streak}
   */
  function touch(streak, day) {
    const s = { ...EMPTY, ...(streak || {}) };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return s;
    if (!s.last) return { last: day, current: 1, best: Math.max(1, s.best) };
    const gap = daysBetween(s.last, day);
    if (gap <= 0) return s; // same day (or a clock that went backwards): nothing to add
    const current = gap === 1 ? s.current + 1 : 1;
    return { last: day, current, best: Math.max(s.best, current) };
  }

  /**
   * The streak as it stands today: still running if the last visit was today
   * or yesterday, otherwise over.
   * @param {Streak | undefined} streak @param {string} today
   */
  function running(streak, today) {
    const s = { ...EMPTY, ...(streak || {}) };
    if (!s.last) return 0;
    const gap = daysBetween(s.last, today);
    return gap === 0 || gap === 1 ? s.current : 0;
  }

  /**
   * Records a visit now, writing only when the day changed. Never throws.
   * @param {{ get: Function, set: Function }} storage
   * @param {Date} [now]
   * @returns {Promise<Streak | null>} the new record, or null if nothing was written
   */
  async function recordVisit(storage, now = new Date()) {
    try {
      const { streak } = await storage.get({ streak: EMPTY });
      const day = dayOf(now);
      if (streak && streak.last === day) return null;
      const next = touch(streak, day);
      await storage.set({ streak: next });
      return next;
    } catch (_) {
      return null;
    }
  }

  const api = { EMPTY, dayOf, daysBetween, touch, running, recordVisit };
  if (typeof window !== "undefined") /** @type {any} */ (window).GOGPlusStreak = api;
  if (typeof self !== "undefined") /** @type {any} */ (self).GOGPlusStreak = api;
})();
