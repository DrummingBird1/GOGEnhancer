/**
 * GOG+ local failure log and "something's not working" report.
 *
 * The content script runs each feature in isolation and notes when one throws
 * (`state.failures`, see content.js). That lives only as long as the page, so
 * a feature that quietly broke after gog.com changed would be invisible. This
 * keeps a short, local, de-duplicated record of those failures — no telemetry,
 * nothing leaves the device — so the popup can say so, and so the user can
 * send a bug report if they choose to.
 *
 * The report is plain text built from that log: the extension version, the
 * feature names, the error messages and the TYPE of page (game / store /
 * wishlist …), never a URL, a game, or anything from the user's library. The
 * popup offers it as text to copy and as a GitHub "new issue" link with the
 * text filled in; nothing is submitted unless the user does it themselves.
 */
// @ts-check

(() => {
  "use strict";

  const KEY = "failureLog";
  const MAX_ENTRIES = 40;
  /** A failure counts as "current" for this long after it last happened. */
  const CURRENT_MS = 24 * 60 * 60 * 1000;
  /** The same failure is merged into one entry within this window. */
  const MERGE_MS = 6 * 60 * 60 * 1000;
  /** …and not written to storage more often than this. */
  const WRITE_GAP_MS = 10 * 60 * 1000;
  const REPO = "https://github.com/DrummingBird1/GOGEnhancer";

  /**
   * @typedef {{ feature: string, message: string, page: string, count: number, first: number, last: number }} Entry
   */

  /** @param {string} s @param {number} n */
  const cut = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);

  /**
   * Adds an occurrence, merging it into an existing entry for the same feature
   * and message when that one is recent.
   * @param {Entry[]} list
   * @param {{ feature: string, message: string, page?: string }} f
   * @param {number} [now]
   * @returns {Entry[]} a new list, newest last, capped
   */
  function add(list, f, now = Date.now()) {
    const out = (Array.isArray(list) ? list : []).map((e) => ({ ...e }));
    const feature = cut(f.feature, 60);
    const message = cut(f.message, 200);
    const hit = out.find((e) => e.feature === feature && e.message === message && now - e.last < MERGE_MS);
    if (hit) {
      hit.count++;
      hit.last = now;
      hit.page = cut(f.page || hit.page, 20);
    } else {
      out.push({ feature, message, page: cut(f.page || "", 20), count: 1, first: now, last: now });
    }
    return out.slice(-MAX_ENTRIES);
  }

  /**
   * What is currently broken: entries that happened in the last day, and after
   * the user last dismissed the notice.
   * @param {Entry[]} list @param {number} [dismissedAt] @param {number} [now]
   */
  function current(list, dismissedAt = 0, now = Date.now()) {
    return (Array.isArray(list) ? list : []).filter((e) => e.last > dismissedAt && now - e.last < CURRENT_MS);
  }

  /**
   * "Currency conversion (3×), Game panel"
   * @param {Entry[]} entries
   */
  function summarize(entries) {
    /** @type {Map<string, number>} */
    const by = new Map();
    for (const e of entries) by.set(e.feature, (by.get(e.feature) || 0) + e.count);
    return [...by.entries()].map(([f, n]) => (n > 1 ? `${f} (${n}×)` : f)).join(", ");
  }

  /**
   * @param {string} ua navigator.userAgent
   * @returns {string} e.g. "Chrome 142" — the browser and its major version only
   */
  function browserOf(ua) {
    const m = /(Edg|OPR|Firefox|Chrome)\/(\d+)/.exec(ua || "");
    if (!m) return "unknown browser";
    return `${m[1] === "Edg" ? "Edge" : m[1] === "OPR" ? "Opera" : m[1]} ${m[2]}`;
  }

  /**
   * @param {Entry[]} entries
   * @param {{ version: string, userAgent?: string }} ctx
   * @returns {string}
   */
  function buildReport(entries, ctx) {
    const lines = [
      `GOG Enhancer v${ctx.version} — something isn't working on gog.com`,
      `Browser: ${browserOf(ctx.userAgent || "")}`,
      "",
      "What failed (each feature runs on its own, so the rest of the extension keeps working):",
    ];
    for (const e of entries) {
      lines.push(`- ${e.feature}: ${e.message || "(no message)"}${e.page ? ` — on a ${e.page} page` : ""}${e.count > 1 ? `, ${e.count} times` : ""}`);
    }
    lines.push("", "Please also run Advanced Options → Check this page on the gog.com page that misbehaves and paste its result here.");
    lines.push("", "(This report contains no web addresses, game names or personal data.)");
    return lines.join("\n");
  }

  /**
   * A GitHub "new issue" page with the report filled in. Opening it sends
   * nothing; the user reviews the text and presses the button on GitHub.
   * @param {string} report @param {string} version
   */
  function issueUrl(report, version) {
    const q = new URLSearchParams({ title: `Something stopped working (v${version})`, body: report.slice(0, 5500) });
    return `${REPO}/issues/new?${q.toString()}`;
  }

  /** @type {Map<string, number>} */
  const lastWrite = new Map();

  /**
   * Records a failure from the content script. Cheap when it has already
   * written this one recently (a broken feature fails on every page pass).
   * Never throws.
   * @param {string} feature @param {unknown} err @param {string} [page]
   */
  async function persist(feature, err, page = "") {
    try {
      const now = Date.now();
      const message = cut(/** @type {any} */ (err)?.message || err, 200);
      const k = `${feature}|${message}`;
      if (now - (lastWrite.get(k) || 0) < WRITE_GAP_MS) return;
      lastWrite.set(k, now);
      const S = window.GOGPlusStorage;
      const cur = (await S.get({ [KEY]: [] }))[KEY];
      await S.set({ [KEY]: add(cur, { feature, message, page }, now) });
    } catch (_) {
      /* a failure log must never become a failure */
    }
  }

  const api = { KEY, MAX_ENTRIES, CURRENT_MS, MERGE_MS, WRITE_GAP_MS, add, current, summarize, browserOf, buildReport, issueUrl, persist, _lastWrite: lastWrite };
  if (typeof window !== "undefined") /** @type {any} */ (window).GOGPlusFailureLog = api;
  if (typeof self !== "undefined") /** @type {any} */ (self).GOGPlusFailureLog = api;
})();
