/**
 * GOG+ notification policy — the pure rules for WHEN and HOW a notification is
 * delivered: quiet hours, "one a day" batching, thresholds (minimum discount,
 * maximum price, only at the tracked low), per-tag price alerts, and the text
 * sent to an optional user-owned webhook.
 *
 * The service worker (background.js) does the I/O — firing
 * chrome.notifications, storing the queue, posting the webhook — and asks
 * this module what to do. No DOM, no storage, no network; every function takes
 * its clock as an argument so the rules can be tested exhaustively.
 *
 * A NotifyItem is `{ id, kind, title, message, t, slug?, dropPct?, price?,
 * currency?, atLow? }`. `id` de-duplicates (the same alert never queues twice).
 */
// @ts-check

(() => {
  "use strict";

  /**
   * @typedef {{
   *   id: string, kind: string, title: string, message: string, t: number,
   *   slug?: string, dropPct?: number, price?: number, currency?: string, atLow?: boolean
   * }} NotifyItem
   * @typedef {{ enabled: boolean, from: string, to: string }} QuietHours
   */

  /** @param {string} hhmm @returns {number | null} minutes since midnight */
  function parseClock(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    return h < 24 && min < 60 ? h * 60 + min : null;
  }

  /**
   * Is `now` inside the quiet window? The window may wrap midnight
   * ("22:00"–"08:00"); an invalid or empty window (from == to) is never quiet.
   * @param {Date} now local time
   * @param {QuietHours | null | undefined} q
   */
  function inQuietHours(now, q) {
    if (!q?.enabled) return false;
    const from = parseClock(q.from);
    const to = parseClock(q.to);
    if (from === null || to === null || from === to) return false;
    const cur = now.getHours() * 60 + now.getMinutes();
    return from < to ? cur >= from && cur < to : cur >= from || cur < to;
  }

  /**
   * Does an item clear the user's thresholds? Items that carry no price or
   * discount (a refund reminder, a sale announcement) are never filtered out —
   * the thresholds are about deals.
   * @param {NotifyItem} item
   * @param {{ notifyMinDiscount?: number, notifyMaxPrice?: number, notifyOnlyAtLow?: boolean }} s
   */
  function passesThresholds(item, s) {
    if (s.notifyMinDiscount && item.dropPct !== undefined && item.dropPct < s.notifyMinDiscount) return false;
    if (s.notifyMaxPrice && item.price !== undefined && item.price > s.notifyMaxPrice) return false;
    if (s.notifyOnlyAtLow && item.atLow === false) return false;
    return true;
  }

  /**
   * What to do with an item right now.
   * @param {Date} now
   * @param {{ notifyMode?: "instant" | "daily", quietHours?: QuietHours }} s
   * @returns {"send" | "queue"}
   */
  function deliveryFor(now, s) {
    if (s.notifyMode === "daily") return "queue";
    return inQuietHours(now, s.quietHours) ? "queue" : "send";
  }

  /**
   * Adds an item to the queue unless one with the same id is already there.
   * Keeps at most `max` items, dropping the oldest.
   * @param {NotifyItem[]} queue @param {NotifyItem} item @param {number} [max]
   * @returns {NotifyItem[]} a new array
   */
  function enqueue(queue, item, max = 100) {
    if (queue.some((q) => q.id === item.id)) return queue;
    return [...queue, item].slice(-max);
  }

  /**
   * Folds a queue into ONE notification. A single item is delivered as itself;
   * several become "N alerts" with the first few headlines.
   * @param {NotifyItem[]} queue
   * @returns {{ title: string, message: string, count: number } | null}
   */
  function summarize(queue) {
    if (!queue.length) return null;
    if (queue.length === 1) return { title: queue[0].title, message: queue[0].message, count: 1 };
    const shown = queue.slice(0, 4).map((q) => q.title.replace(/^[^—]*—\s*/, "").trim() || q.title);
    const more = queue.length > shown.length ? ` +${queue.length - shown.length} more` : "";
    return { title: `${queue.length} GOG alerts`, message: `${shown.join(" · ")}${more}`, count: queue.length };
  }

  /**
   * Should a queued batch go out now? In "daily" mode it goes once the quiet
   * window (if any) is over; in "instant" mode it is whatever quiet hours held
   * back, released when they end.
   * @param {Date} now @param {{ quietHours?: QuietHours }} s @param {number} queued
   */
  function shouldFlush(now, s, queued) {
    return queued > 0 && !inQuietHours(now, s.quietHours);
  }

  /* ---------------- per-tag alerts ---------------- */

  /**
   * Games that carry a tag with an alert and whose latest recorded price has
   * reached that tag's threshold. Prices are converted to the alert's currency
   * through the USD rate map; anything that can't be converted is skipped
   * rather than misreported.
   * @param {Record<string, { threshold: number, currency: string }>} tagAlerts
   * @param {Record<string, string[]>} tags slug -> tags
   * @param {Record<string, Array<{ d: string, p: number, c: string }>>} history
   * @param {Record<string, number>} rates units per USD
   * @returns {Array<{ slug: string, tag: string, price: number, threshold: number, currency: string }>}
   */
  function tagAlertHits(tagAlerts, tags, history, rates) {
    /** @type {Array<{ slug: string, tag: string, price: number, threshold: number, currency: string }>} */
    const hits = [];
    for (const [slug, list] of Object.entries(tags || {})) {
      const hist = history?.[slug];
      if (!hist?.length) continue;
      const latest = hist[hist.length - 1];
      for (const tag of list || []) {
        const alert = tagAlerts?.[tag];
        if (!alert || !(alert.threshold > 0)) continue;
        let price = latest.p;
        if (latest.c !== alert.currency) {
          const s = latest.c === "USD" ? 1 : rates?.[latest.c];
          const t = alert.currency === "USD" ? 1 : rates?.[alert.currency];
          if (!(s > 0) || !(t > 0)) continue;
          price = (latest.p / s) * t;
        }
        if (price <= alert.threshold) {
          hits.push({ slug, tag, price, threshold: alert.threshold, currency: alert.currency });
          break; // one alert per game, whichever tag matched first
        }
      }
    }
    return hits;
  }

  /* ---------------- webhook ---------------- */

  /**
   * Accepts only an https URL — never http (the message would travel in the
   * clear) and never a non-URL. Returns the URL or null.
   * @param {string} raw
   */
  function sanitizeWebhookUrl(raw) {
    let u;
    try {
      u = new URL(String(raw).trim());
    } catch {
      return null;
    }
    return u.protocol === "https:" && u.hostname ? u.toString() : null;
  }

  /** The origin pattern to ask `chrome.permissions` for. @param {string} url */
  function webhookOrigin(url) {
    const u = new URL(url);
    return `${u.origin}/*`;
  }

  /**
   * The request body for a webhook: Discord's `{ content }` shape for Discord
   * URLs, otherwise a small generic JSON. Only the text of the notification
   * the user would have seen is sent — never storage, tags or history.
   * @param {string} url @param {{ title: string, message: string }} n
   */
  function webhookPayload(url, n) {
    const text = `**${n.title}**\n${n.message}`.slice(0, 1900);
    const host = new URL(url).hostname;
    if (/(^|\.)discord(app)?\.com$/.test(host)) return { content: text };
    return { source: "gog-enhancer", title: n.title, message: n.message, text };
  }

  const api = {
    parseClock,
    inQuietHours,
    passesThresholds,
    deliveryFor,
    enqueue,
    summarize,
    shouldFlush,
    tagAlertHits,
    sanitizeWebhookUrl,
    webhookOrigin,
    webhookPayload,
  };
  if (typeof window !== "undefined") window.GOGPlusNotifyPolicy = api;
  if (typeof self !== "undefined") self.GOGPlusNotifyPolicy = api;
})();
