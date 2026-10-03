/**
 * GOG+ screen-reader announcements.
 *
 * Most of what the extension adds is plain text in the page, which a screen
 * reader reads in place. What it can't know is that something CHANGED — a page
 * of prices converted, more games loaded below the fold. This is one visually
 * hidden polite live region for those moments (toasts have their own, see
 * toasts.js). Messages are short and rare by design: one per event, and
 * `once` keeps a message from repeating on every re-render of the same page.
 */
// @ts-check

(() => {
  "use strict";

  const ID = "gog-plus-announcer";
  /** @type {Set<string>} */
  const said = new Set();
  /** @type {number | undefined} */
  let clearTimer;

  function region() {
    let r = document.getElementById(ID);
    if (!r || !r.isConnected) {
      r = document.createElement("div");
      r.id = ID;
      r.className = "gog-plus-sr-only";
      r.setAttribute("role", "status");
      r.setAttribute("aria-live", "polite");
      r.setAttribute("aria-atomic", "true");
      document.body.appendChild(r);
    }
    return r;
  }

  /** @param {string} text */
  function say(text) {
    if (!text) return;
    const r = region();
    // Clearing first makes a repeated message announce again.
    r.textContent = "";
    window.setTimeout(() => {
      r.textContent = text;
    }, 50);
    window.clearTimeout(clearTimer);
    clearTimer = window.setTimeout(() => {
      r.textContent = "";
    }, 8000);
  }

  /**
   * Says `text` the first time `key` is seen.
   * @param {string} key @param {string} text
   */
  function once(key, text) {
    if (said.has(key)) return;
    said.add(key);
    say(text);
  }

  /** Forgets what was said (tests, and a fresh page after navigation). */
  function reset() {
    said.clear();
  }

  window.GOGPlusAnnounce = { say, once, reset };
})();
