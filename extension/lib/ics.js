/**
 * GOG+ iCalendar (.ics) export of refund-window deadlines.
 *
 * Built entirely on-device: one all-day event per purchase on the day its
 * 30-day refund window closes, with a reminder the morning before. Importing
 * the file into any calendar app puts the deadlines where you'll actually see
 * them — no server, no account, nothing leaves the browser.
 */
// @ts-check

(() => {
  "use strict";

  const DAY_MS = 24 * 60 * 60 * 1000;
  const REFUND_DAYS = 30;

  /** RFC 5545 §3.3.11 TEXT escaping. @param {string} s */
  function escapeText(s) {
    return s
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  /**
   * RFC 5545 §3.1 line folding: content lines are limited to 75 OCTETS (not
   * characters), continuation lines start with one space.
   * @param {string} line
   */
  function fold(line) {
    const enc = new TextEncoder();
    if (enc.encode(line).length <= 75) return line;
    /** @type {string[]} */
    const parts = [];
    let cur = "";
    let bytes = 0;
    for (const ch of line) {
      const b = enc.encode(ch).length;
      const limit = parts.length === 0 ? 75 : 74; // continuation lines spend 1 octet on the leading space
      if (bytes + b > limit) {
        parts.push(cur);
        cur = ch;
        bytes = b;
      } else {
        cur += ch;
        bytes += b;
      }
    }
    parts.push(cur);
    return parts.join("\r\n ");
  }

  /** @param {Date} d @returns {string} YYYYMMDD */
  const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");

  /** @param {number} ms @returns {string} YYYYMMDDTHHMMSSZ */
  const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  /** @param {string} slug */
  function defaultTitle(slug) {
    return slug
      .split("_")
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ");
  }

  /**
   * @param {Record<string, string | { date: string }>} purchaseLog slug -> entry (either stored shape)
   * @param {{ now?: number, titleOf?: (slug: string) => string, refundDays?: number }} [opts]
   * @returns {string | null} the .ics text, or null when no refund window is still open
   */
  function buildRefundCalendar(purchaseLog, opts = {}) {
    const now = opts.now ?? Date.now();
    const titleOf = opts.titleOf ?? defaultTitle;
    const refundDays = opts.refundDays ?? REFUND_DAYS;
    const today = Date.parse(new Date(now).toISOString().slice(0, 10));

    /** @type {string[]} */
    const events = [];
    for (const [slug, raw] of Object.entries(purchaseLog || {})) {
      const date = typeof raw === "string" ? raw : raw?.date;
      const bought = typeof date === "string" ? Date.parse(date) : NaN;
      if (!Number.isFinite(bought)) continue;
      const deadline = bought + refundDays * DAY_MS;
      if (deadline < today) continue;

      const title = titleOf(slug);
      const url = `https://www.gog.com/en/game/${encodeURIComponent(slug)}`;
      events.push(
        [
          "BEGIN:VEVENT",
          `UID:refund-${slug}@gog-enhancer`,
          `DTSTAMP:${stamp(now)}`,
          `DTSTART;VALUE=DATE:${ymd(new Date(deadline))}`,
          `DTEND;VALUE=DATE:${ymd(new Date(deadline + DAY_MS))}`,
          `SUMMARY:${escapeText(`GOG refund window closes: ${title}`)}`,
          `DESCRIPTION:${escapeText(
            `Bought ${date}. GOG's ${refundDays}-day refund window closes today.\n${url}`
          )}`,
          `URL:${url}`,
          "TRANSP:TRANSPARENT",
          "BEGIN:VALARM",
          "ACTION:DISPLAY",
          `DESCRIPTION:${escapeText(`Refund window for ${title} closes tomorrow`)}`,
          "TRIGGER:-PT15H",
          "END:VALARM",
          "END:VEVENT",
        ]
          .map(fold)
          .join("\r\n")
      );
    }
    if (!events.length) return null;

    return (
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//GOG Enhancer//Refund deadlines//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:GOG refund deadlines",
        ...events,
        "END:VCALENDAR",
      ].join("\r\n") + "\r\n"
    );
  }

  const api = { escapeText, fold, buildRefundCalendar };
  if (typeof window !== "undefined") window.GOGPlusIcs = api;
  if (typeof self !== "undefined") self.GOGPlusIcs = api;
})();
