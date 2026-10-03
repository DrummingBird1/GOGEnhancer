/**
 * GOG+ network layer — the ONE place the extension talks to the network.
 *
 * Every request the extension makes goes through `GOGPlusNet.request`, which
 *   • refuses any URL that isn't https and on the short allow-list below
 *     (a user-chosen webhook is the one declared exception, see `webhook`),
 *   • never sends cookies or a referrer,
 *   • applies a timeout, and
 *   • records what happened — host, path WITHOUT its query string, status —
 *     in the local `netLog`, which the options page shows as the "what did the
 *     extension contact?" list (the privacy dashboard).
 *
 * Nothing is sent anywhere by logging; the log lives in `storage.local`, is
 * capped, and is cleared by "Reset everything".
 *
 * The allow-list is also what `tests/privacy-audit.test.js` compares with
 * `manifest.json` and `PRIVACY.md`, so adding a host here without documenting
 * it fails the build.
 */
// @ts-check

(() => {
  "use strict";

  /**
   * host → what it is for. Keep in step with PRIVACY.md §3.
   * @type {Record<string, { kind: string, why: string }>}
   */
  const HOSTS = {
    "api.frankfurter.app": { kind: "fx", why: "Currency exchange rates" },
    "www.gog.com": { kind: "mods", why: "The public GOG mods page" },
    "www.cheapshark.com": { kind: "compare", why: "Cross-store price comparison" },
    "catalog.gog.com": { kind: "catalog", why: "GOG's own catalog API — endless scrolling" },
    "api.gog.com": { kind: "product", why: "GOG's own product API — pack contents" },
  };

  const LOG_KEY = "netLog";
  const LOG_MAX = 120;

  /** @param {string} url */
  function describe(url) {
    try {
      const u = new URL(url);
      return { host: u.hostname, path: u.pathname };
    } catch (_) {
      return { host: "", path: "" };
    }
  }

  /** @param {string} url @returns {boolean} */
  function allowed(url) {
    try {
      const u = new URL(url);
      return u.protocol === "https:" && Object.prototype.hasOwnProperty.call(HOSTS, u.hostname);
    } catch (_) {
      return false;
    }
  }

  /** @type {Promise<void>} */
  let logWrite = Promise.resolve();

  /**
   * Appends one entry to the local request log. Never throws.
   * @param {{ kind: string, host: string, path: string, status: number | null, ok: boolean, error?: string }} e
   */
  function record(e) {
    const S = typeof window !== "undefined" ? window.GOGPlusStorage : self.GOGPlusStorage;
    if (!S) return Promise.resolve();
    logWrite = logWrite
      .then(async () => {
        const cur = (await S.get({ [LOG_KEY]: [] }))[LOG_KEY];
        const list = Array.isArray(cur) ? cur : [];
        list.push({ t: Date.now(), ...e });
        await S.set({ [LOG_KEY]: list.slice(-LOG_MAX) });
      })
      .catch(() => {});
    return logWrite;
  }

  /**
   * @param {string} kind a short label for the log ("fx", "catalog", …)
   * @param {string} url
   * @param {RequestInit & { timeoutMs?: number, credentials?: RequestCredentials }} [init]
   * @returns {Promise<Response>} rejects when the URL isn't allowed or the request fails
   */
  async function request(kind, url, init = {}) {
    const { host, path } = describe(url);
    if (!allowed(url)) {
      await record({ kind, host, path, status: null, ok: false, error: "blocked: not an allowed destination" });
      throw new Error(`GOGPlusNet: ${host || "that address"} is not an allowed destination`);
    }
    const { timeoutMs = 10000, ...rest } = init;
    try {
      const res = await fetch(url, {
        credentials: "omit",
        referrerPolicy: "no-referrer",
        ...rest,
        signal: rest.signal || AbortSignal.timeout(timeoutMs),
      });
      record({ kind, host, path, status: res.status, ok: res.ok });
      return res;
    } catch (err) {
      record({ kind, host, path, status: null, ok: false, error: String(/** @type {any} */ (err)?.message || err).slice(0, 80) });
      throw err;
    }
  }

  /**
   * GET + parse JSON; null on any failure (callers degrade quietly).
   * @param {string} kind @param {string} url @param {RequestInit & { timeoutMs?: number }} [init]
   * @returns {Promise<any | null>}
   */
  async function getJson(kind, url, init) {
    try {
      const res = await request(kind, url, init);
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  /**
   * Logs a request made to the user's OWN webhook. Only the host is stored —
   * the path of a webhook address is a secret token.
   * @param {string} host @param {number | null} status @param {boolean} ok @param {string} [error]
   */
  function recordWebhook(host, status, ok, error) {
    return record({ kind: "webhook", host, path: "", status, ok, ...(error ? { error } : {}) });
  }

  /**
   * Groups the log for display: per host, how many requests, how many failed,
   * when last.
   * @param {Array<{ t: number, kind: string, host: string, ok: boolean }>} log
   */
  function summarize(log) {
    /** @type {Map<string, { host: string, kind: string, count: number, failed: number, last: number }>} */
    const m = new Map();
    for (const e of Array.isArray(log) ? log : []) {
      const row = m.get(e.host) || { host: e.host, kind: e.kind, count: 0, failed: 0, last: 0 };
      row.count++;
      if (!e.ok) row.failed++;
      row.last = Math.max(row.last, e.t || 0);
      m.set(e.host, row);
    }
    return [...m.values()].sort((a, b) => b.last - a.last);
  }

  const Api = { HOSTS, LOG_KEY, LOG_MAX, allowed, describe, request, getJson, record, recordWebhook, summarize };
  if (typeof window !== "undefined") /** @type {any} */ (window).GOGPlusNet = Api;
  if (typeof self !== "undefined") /** @type {any} */ (self).GOGPlusNet = Api;
})();
