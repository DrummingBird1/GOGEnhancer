/**
 * GOG+ note history — earlier versions of a game's note, so an accidental
 * delete or a bad paste can be undone.
 *
 * The note box saves as you type, so "every change" would fill the history with
 * one-letter versions. The rule instead: when a note is about to be replaced,
 * its OLD text is kept as a version — unless the newest saved version is under
 * ten minutes old (a burst of typing is one edit session) or the old text is
 * empty or identical to what is already the newest version. At most five
 * versions per game are kept, newest first. Pure; the service worker applies it
 * from storage.onChanged (see background.js) so every place that writes notes
 * is covered without knowing about it.
 */
// @ts-check

(() => {
  "use strict";

  const MAX_VERSIONS = 5;
  const SESSION_MS = 10 * 60 * 1000;

  /** @typedef {Record<string, Array<{ t: number, text: string }>>} NoteHistory */

  /**
   * @param {NoteHistory} history
   * @param {string} slug
   * @param {string | undefined} oldText the note being replaced
   * @param {number} now
   * @returns {NoteHistory} the same object when nothing changes, else a new one
   */
  function pushVersion(history, slug, oldText, now) {
    const text = typeof oldText === "string" ? oldText : "";
    if (!text.trim()) return history;
    const versions = history[slug] || [];
    const newest = versions[0];
    if (newest && (newest.text === text || now - newest.t < SESSION_MS)) return history;
    return { ...history, [slug]: [{ t: now, text }, ...versions].slice(0, MAX_VERSIONS) };
  }

  /**
   * Applies a change to the whole `notes` map: every slug whose note changed
   * keeps its previous text as a version.
   * @param {NoteHistory} history
   * @param {Record<string, string> | undefined} before
   * @param {Record<string, string> | undefined} after
   * @param {number} now
   */
  function recordChanges(history, before, after, now) {
    const o = before || {};
    const n = after || {};
    let next = history;
    for (const slug of Object.keys(o)) {
      if (o[slug] !== n[slug]) next = pushVersion(next, slug, o[slug], now);
    }
    return next;
  }

  /** @param {number} t @param {number} [now] */
  function ago(t, now = Date.now()) {
    const min = Math.round((now - t) / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min} min ago`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  }

  const api = { MAX_VERSIONS, SESSION_MS, pushVersion, recordChanges, ago };
  if (typeof window !== "undefined") window.GOGPlusNoteHistory = api;
  if (typeof self !== "undefined") self.GOGPlusNoteHistory = api;
})();
