/**
 * GOG+ background service worker v2.
 *
 * Responsibilities:
 *   - Run settings migration on install/update
 *   - Periodically fetch live FX rates from frankfurter.app
 *   - Periodically scrape /mods page for the list of moddable games
 *   - Periodically check wishlist for items on sale → toolbar badge
 *   - Deliver notifications under the user's rules (quiet hours, one-a-day
 *     batching, thresholds, per-tag alerts, an optional user-owned webhook)
 *   - Keep the sync folder up to date when the browser lets it (no prompts)
 *   - Handle keyboard commands
 */

import "../lib/browser-compat.js";
import "../lib/defaults.js";
import "../lib/storage.js";
import "../lib/migrations.js";
import "../lib/purchases.js";
import "../lib/sync-core.js";
import "../lib/backup-crypto.js";
import "../lib/folder-sync-core.js";
import "../lib/notify-policy.js";
import "../lib/library-search.js";

const DEFAULTS = self.GOG_PLUS_DEFAULTS;

/* ---------------- migration ----------------
 * Shared with the Advanced Options import flow — see lib/migrations.js. */

async function ensureDefaults() {
  // Raw reads, not GOGPlusStorage.get() — that wrapper back-fills missing
  // keys with GOG_PLUS_DEFAULTS on every read (by design, see storage.js),
  // which would make every key here look "present" and this function a
  // no-op. Querying storage directly is the only way to see what's
  // genuinely missing and needs to actually be written.
  const [syncExisting, localExisting] = await Promise.all([
    new Promise((r) => chrome.storage.sync.get(null, r)),
    new Promise((r) => chrome.storage.local.get(null, r)),
  ]);
  const existing = { ...syncExisting, ...localExisting };
  const toSet = {};
  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (existing[k] === undefined) toSet[k] = v;
  }
  if (Object.keys(toSet).length) await self.GOGPlusStorage.set(toSet);
}

/* ---------------- live FX rates ---------------- */

const FX_ALARM = "gog-plus-fx";
const FX_INTERVAL_MIN = 12 * 60;

async function fetchLiveRates() {
  try {
    const url = "https://api.frankfurter.app/latest?from=USD&to=ILS,EUR,GBP,PLN";
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    if (!data || !data.rates) throw new Error("no rates");

    const next = {};
    ["ILS", "EUR", "GBP", "PLN", "RUB"].forEach((c) => {
      if (typeof data.rates[c] === "number") next[c] = data.rates[c];
    });

    const { rates: prior } = await self.GOGPlusStorage.get({ rates: DEFAULTS.rates });
    const merged = { ...prior, ...next };
    await self.GOGPlusStorage.set({
      rates: merged,
      ratesUpdatedAt: Date.now(),
      lastFxError: null,
    });
    console.log("[GOG+ bg] FX updated", merged);
  } catch (err) {
    console.warn("[GOG+ bg] FX fetch failed", err);
    await self.GOGPlusStorage.set({
      lastFxError: String(err?.message || err).slice(0, 200),
    });
  }
}

/* ---------------- mods list ---------------- */

const MODS_ALARM = "gog-plus-mods";
const MODS_INTERVAL_MIN = 24 * 60;

async function refreshModsList() {
  try {
    const res = await fetch("https://www.gog.com/en/mods", {
      method: "GET",
      credentials: "omit",
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const html = await res.text();
    const slugs = new Set();
    const re = /\/(?:en\/)?game\/([a-z0-9_]+)/g;
    let m;
    while ((m = re.exec(html))) slugs.add(m[1]);
    if (slugs.size > 0) {
      await self.GOGPlusStorage.set({
        modsList: Array.from(slugs),
        modsUpdatedAt: Date.now(),
      });
      console.log(`[GOG+ bg] mods: ${slugs.size}`);
    }
  } catch (err) {
    console.warn("[GOG+ bg] mods refresh failed", err);
  }
}

/* ---------------- wishlist badge ---------------- */
/*
 * NOTE: gog.com is an Angular SPA — fetching /account/wishlist via
 * fetch() returns the SSR shell without the actual list. So we don't
 * scrape the HTML here. Instead the content script reports the live
 * DOM count back via runtime messaging when the user visits their
 * wishlist, and we cache it with a TTL.
 */

const WL_ALARM = "gog-plus-wishlist";
const WL_INTERVAL_MIN = 6 * 60;
const WL_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const THEME_BADGE_COLORS = {
  neon: "#c64fff",
  classic: "#8a2be2",
  crt: "#00ff66",
  sunset: "#ff7a00",
  light: "#8a2be2",
};

async function refreshWishlistBadge() {
  try {
    const { wishlistAlerts, wishlistCache, wishlistCacheUpdatedAt, theme } =
      await self.GOGPlusStorage.get({
        wishlistAlerts: true,
        wishlistCache: { discountedCount: 0 },
        wishlistCacheUpdatedAt: 0,
        theme: "neon",
      });

    if (!wishlistAlerts) {
      chrome.action.setBadgeText({ text: "" });
      chrome.action.setTitle({ title: "GOG Enhancer Settings" });
      return;
    }

    const fresh = wishlistCacheUpdatedAt && Date.now() - wishlistCacheUpdatedAt < WL_TTL_MS;
    const count = fresh ? wishlistCache?.discountedCount || 0 : 0;

    if (count > 0) {
      chrome.action.setBadgeText({ text: String(Math.min(count, 99)) });
      chrome.action.setBadgeBackgroundColor({
        color: THEME_BADGE_COLORS[theme] || THEME_BADGE_COLORS.neon,
      });
      chrome.action.setTitle({
        title: `GOG Enhancer — ${count} wishlist item${count === 1 ? "" : "s"} on sale`,
      });
    } else {
      chrome.action.setBadgeText({ text: "" });
      chrome.action.setTitle({
        title: fresh
          ? "GOG Enhancer — no wishlist deals right now"
          : "GOG Enhancer — visit your wishlist to refresh deal alerts",
      });
    }
  } catch (err) {
    console.warn("[GOG+ bg] wishlist check failed", err);
    chrome.action.setBadgeText({ text: "" });
  }
}

/* ---------------- desktop notifications (opt-in) ---------------- */

const DAILY_ALARM = "gog-plus-daily";
const DAILY_INTERVAL_MIN = 24 * 60;
const REFUND_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const NOTIF_ICON = "icons/icon128.png";
const NOTIFLOG_TTL_MS = 90 * 24 * 60 * 60 * 1000; // drop dedup entries older than 90d

// notifLog accumulates one timestamped key per fired notification
// (refund:slug:days, priceAlert:slug:threshold) plus the __wishlistJump
// throttle. Without pruning it grows forever. Drop entries whose timestamp
// is older than the TTL — re-arming an old alert is harmless. Returns the
// pruned object and whether anything changed.
function pruneNotifLog(notifLog) {
  const cutoff = Date.now() - NOTIFLOG_TTL_MS;
  let changed = false;
  for (const [key, ts] of Object.entries(notifLog)) {
    if (key === "__wishlistJump") continue; // single rolling throttle, keep
    if (typeof ts === "number" && ts < cutoff) {
      delete notifLog[key];
      changed = true;
    }
  }
  return changed;
}

async function fireNotification(id, title, message, contextMessage) {
  try {
    chrome.notifications.create(id, {
      type: "basic",
      iconUrl: NOTIF_ICON,
      title,
      message,
      contextMessage: contextMessage || "GOG Enhancer",
      priority: 1,
    });
  } catch (err) {
    console.warn("[GOG+ bg] notification failed", err);
  }
}

/* ---------------- notification rules ----------------
 * Every notification goes through emit(): thresholds first (a drop smaller
 * than the user's minimum is simply not worth saying), then WHEN — now, or
 * held in `notifyQueue` during quiet hours / in "one a day" mode and released
 * as one summary (flushQueue). The rules themselves live in
 * lib/notify-policy.js; this file only does the I/O. The user's own webhook,
 * if they enabled one, gets the same text the desktop notification shows. */

const NOTIFY_KEYS = [
  "desktopNotifications",
  "webhookEnabled",
  "webhookUrl",
  "notifyMode",
  "quietHours",
  "notifyMinDiscount",
  "notifyMaxPrice",
  "notifyOnlyAtLow",
  "notifyQueue",
];

/** Is any notification channel switched on? */
function wantsNotifications(s) {
  return !!(s.desktopNotifications || (s.webhookEnabled && s.webhookUrl));
}

/**
 * POSTs a notification's text to the user's own webhook. Needs both the URL
 * and the browser's permission for its origin (granted on the options page);
 * returns { ok, error? } and never throws.
 */
async function postWebhook(url, n) {
  const Policy = self.GOGPlusNotifyPolicy;
  const clean = Policy.sanitizeWebhookUrl(url);
  if (!clean) return { ok: false, error: "the address isn't an https URL" };
  try {
    if (!(await chrome.permissions.contains({ origins: [Policy.webhookOrigin(clean)] }))) {
      return { ok: false, error: "the browser hasn't granted access to that address — save it again on the options page" };
    }
    const res = await fetch(clean, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Policy.webhookPayload(clean, n)),
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: String(err?.message || err).slice(0, 120) };
  }
}

/** Sends one notification on every enabled channel. */
async function deliver(s, id, title, message, context) {
  if (s.desktopNotifications) await fireNotification(id, title, message, context);
  if (s.webhookEnabled && s.webhookUrl) {
    const r = await postWebhook(s.webhookUrl, { title, message });
    if (!r.ok) console.warn("[GOG+ bg] webhook failed:", r.error);
  }
}

/**
 * Routes a notification through the user's rules.
 * @param {{ id: string, kind: string, title: string, message: string, context?: string,
 *   dropPct?: number, price?: number, currency?: string, atLow?: boolean }} item
 * @returns {Promise<"sent" | "queued" | false>} false = nothing wanted / below the thresholds
 */
async function emit(item) {
  const Policy = self.GOGPlusNotifyPolicy;
  const s = await self.GOGPlusStorage.get(NOTIFY_KEYS);
  if (!wantsNotifications(s)) return false;
  if (!Policy.passesThresholds(item, s)) return false;
  if (Policy.deliveryFor(new Date(), s) === "queue") {
    await self.GOGPlusStorage.set({
      notifyQueue: Policy.enqueue(s.notifyQueue || [], { ...item, t: Date.now() }),
    });
    return "queued";
  }
  await deliver(s, item.id, item.title, item.message, item.context);
  return "sent";
}

/**
 * Releases what quiet hours or "one a day" mode held back, as ONE summary.
 * Never during quiet hours. In "one a day" mode only the daily job passes
 * `force`, so the hourly check doesn't break the batch up.
 */
async function flushQueue({ force = false } = {}) {
  const Policy = self.GOGPlusNotifyPolicy;
  const s = await self.GOGPlusStorage.get(NOTIFY_KEYS);
  const queue = s.notifyQueue || [];
  if (!queue.length) return;
  if (!wantsNotifications(s)) {
    await self.GOGPlusStorage.set({ notifyQueue: [] });
    return;
  }
  if (!force && s.notifyMode === "daily") return;
  if (!Policy.shouldFlush(new Date(), s, queue.length)) return;
  const sum = Policy.summarize(queue);
  if (!sum) return;
  await self.GOGPlusStorage.set({ notifyQueue: [] });
  await deliver(s, `batch:${Date.now()}`, sum.title, sum.message, sum.count > 1 ? `${sum.count} alerts held back` : undefined);
}

function slugToTitle(slug) {
  return slug
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function checkRefundWindowExpirations() {
  const { purchaseLog = {}, notifLog = {}, ...channels } = await self.GOGPlusStorage.get({
    desktopNotifications: false,
    webhookEnabled: false,
    webhookUrl: "",
    purchaseLog: {},
    notifLog: {},
  });
  if (!wantsNotifications(channels)) return;

  const now = Date.now();
  let touched = false;
  for (const [slug, rawEntry] of Object.entries(purchaseLog)) {
    const dateStr = self.GOGPlusPurchases.purchaseDateOf(rawEntry);
    if (!dateStr) continue;
    const purchasedAt = new Date(dateStr + "T00:00:00").getTime();
    if (!Number.isFinite(purchasedAt)) continue;
    const expiresAt = purchasedAt + REFUND_WINDOW_MS;
    const msLeft = expiresAt - now;
    const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
    // Notify when 1 or 2 days remain — but only once per slug+remaining bucket.
    if (daysLeft === 2 || daysLeft === 1) {
      const key = `refund:${slug}:${daysLeft}`;
      if (notifLog[key]) continue;
      const word = daysLeft === 1 ? "day" : "days";
      const outcome = await emit({
        id: key,
        kind: "refund",
        title: `Refund window closing — ${slugToTitle(slug)}`,
        message: `${daysLeft} ${word} left on GOG's 30-day refund guarantee.`,
        context: "Tracked via your manual purchase date",
      });
      if (outcome) {
        notifLog[key] = now;
        touched = true;
      }
    }
  }
  if (touched) await self.GOGPlusStorage.set({ notifLog });
}

async function checkPriceAlerts() {
  const {
    priceAlerts = {},
    priceHistory = {},
    notifLog = {},
    rates = {},
    ...channels
  } = await self.GOGPlusStorage.get({
    desktopNotifications: false,
    webhookEnabled: false,
    webhookUrl: "",
    priceAlerts: {},
    priceHistory: {},
    notifLog: {},
    rates: {},
  });
  if (!wantsNotifications(channels)) return;
  if (!Object.keys(priceAlerts).length) return;

  let touched = false;
  for (const [slug, alert] of Object.entries(priceAlerts)) {
    if (!alert || !Number.isFinite(alert.threshold)) continue;
    const hist = priceHistory[slug];
    if (!hist?.length) continue;
    const latest = hist[hist.length - 1];

    // Normalize the latest recorded price to the alert's currency via USD.
    let priceInAlertCur = latest.p;
    if (latest.c !== alert.currency) {
      const srcRate = latest.c === "USD" ? 1 : rates[latest.c];
      const tgtRate = alert.currency === "USD" ? 1 : rates[alert.currency];
      if (!srcRate || !tgtRate) continue;
      priceInAlertCur = (latest.p / srcRate) * tgtRate;
    }
    if (priceInAlertCur > alert.threshold) continue;

    // Dedupe per slug + threshold tier so resetting the threshold re-arms.
    const key = `priceAlert:${slug}:${alert.threshold}`;
    if (notifLog[key]) continue;

    const sym =
      ({ USD: "$", EUR: "€", ILS: "₪", GBP: "£", PLN: "zł", RUB: "₽" })[alert.currency] ||
      alert.currency;
    const sameCur = hist.filter((e) => e.c === latest.c).map((e) => e.p);
    const peak = Math.max(...sameCur);
    const outcome = await emit({
      id: key,
      kind: "price-alert",
      title: `Price alert — ${slugToTitle(slug)}`,
      message: `Now ${sym}${priceInAlertCur.toFixed(2)} — below your ${sym}${alert.threshold.toFixed(2)} threshold.`,
      context: "Visit the GOG page to confirm and buy",
      price: priceInAlertCur,
      currency: alert.currency,
      dropPct: peak > 0 ? Math.round(((peak - latest.p) / peak) * 100) : 0,
      atLow: latest.p <= Math.min(...sameCur),
    });
    if (outcome) {
      notifLog[key] = Date.now();
      touched = true;
    }
  }
  if (touched) await self.GOGPlusStorage.set({ notifLog });
}

// Extends the per-game price-alert system (checkPriceAlerts, which needs a
// manually-set threshold on each game's own page) to the whole wishlist at
// once: any wishlisted game whose latest recorded price has dropped by at
// least `wishlistAlertPercent` off its own tracked peak fires a
// notification — no per-game setup required. Only covers wishlist items
// that already have price history (i.e. the user visited that game's page
// at least once — see priceHistory.js); there's no price data for slugs
// never visited, wishlisted or not.
async function checkWishlistWideAlerts() {
  const {
    wishlistPriceAlerts,
    wishlistAlertPercent,
    wishlistSlugs = [],
    priceHistory = {},
    notifLog = {},
    ...channels
  } = await self.GOGPlusStorage.get({
    desktopNotifications: false,
    webhookEnabled: false,
    webhookUrl: "",
    wishlistPriceAlerts: false,
    wishlistAlertPercent: 20,
    wishlistSlugs: [],
    priceHistory: {},
    notifLog: {},
  });
  if (!wantsNotifications(channels) || !wishlistPriceAlerts) return;
  if (!wishlistSlugs.length) return;

  const pct = Math.min(90, Math.max(1, Number(wishlistAlertPercent) || 20));
  let touched = false;

  for (const slug of wishlistSlugs) {
    const hist = priceHistory[slug];
    if (!hist || hist.length < 2) continue; // nothing to compare a "drop" against

    let peak = hist[0];
    for (const e of hist) if (e.p > peak.p) peak = e;
    const latest = hist[hist.length - 1];
    if (peak.p <= 0 || latest.c !== peak.c) continue; // mixed-currency history — skip rather than misreport

    const dropPct = ((peak.p - latest.p) / peak.p) * 100;
    if (dropPct < pct) continue;

    // Dedupe by slug + exact current price — re-arms automatically if the
    // price moves again (up then back down, or drops further).
    const key = `wishlistPriceAlert:${slug}:${latest.p}`;
    if (notifLog[key]) continue;

    const sym =
      ({ USD: "$", EUR: "€", ILS: "₪", GBP: "£", PLN: "zł", RUB: "₽" })[latest.c] || latest.c;
    const low = Math.min(...hist.filter((e) => e.c === latest.c).map((e) => e.p));
    const outcome = await emit({
      id: key,
      kind: "wishlist-drop",
      title: `Wishlist price drop — ${slugToTitle(slug)}`,
      message: `Now ${sym}${latest.p.toFixed(2)} — ${Math.round(dropPct)}% below its tracked peak of ${sym}${peak.p.toFixed(2)}.`,
      context: "Visit the GOG page to confirm and buy",
      price: latest.p,
      currency: latest.c,
      dropPct: Math.round(dropPct),
      atLow: latest.p <= low,
    });
    if (outcome) {
      notifLog[key] = Date.now();
      touched = true;
    }
  }
  if (touched) await self.GOGPlusStorage.set({ notifLog });
}

/* ---------------- alerts by tag ----------------
 * "Any game tagged co-op under 10" — one threshold for a whole tag, checked
 * daily against the prices the user's own visits recorded (lib/notify-policy.js
 * tagAlertHits does the matching and the currency conversion). */

async function checkTagAlerts() {
  const {
    tagAlerts = {},
    tags = {},
    priceHistory = {},
    rates = {},
    notifLog = {},
    ...channels
  } = await self.GOGPlusStorage.get({
    desktopNotifications: false,
    webhookEnabled: false,
    webhookUrl: "",
    tagAlerts: {},
    tags: {},
    priceHistory: {},
    rates: {},
    notifLog: {},
  });
  if (!wantsNotifications(channels) || !Object.keys(tagAlerts).length) return;

  let touched = false;
  for (const hit of self.GOGPlusNotifyPolicy.tagAlertHits(tagAlerts, tags, priceHistory, rates)) {
    const key = `tagAlert:${hit.slug}:${hit.tag}:${hit.threshold}`;
    if (notifLog[key]) continue;
    const sym =
      ({ USD: "$", EUR: "€", ILS: "₪", GBP: "£", PLN: "zł", RUB: "₽" })[hit.currency] || hit.currency;
    const hist = priceHistory[hit.slug] || [];
    const latest = hist[hist.length - 1];
    const low = Math.min(...hist.filter((e) => e.c === latest?.c).map((e) => e.p));
    const outcome = await emit({
      id: key,
      kind: "tag-alert",
      title: `Tag alert — ${slugToTitle(hit.slug)}`,
      message: `Now ${sym}${hit.price.toFixed(2)} — under your ${sym}${hit.threshold.toFixed(2)} for “${hit.tag}” games.`,
      context: "Visit the GOG page to confirm and buy",
      price: hit.price,
      currency: hit.currency,
      atLow: latest ? latest.p <= low : undefined,
    });
    if (outcome) {
      notifLog[key] = Date.now();
      touched = true;
    }
  }
  if (touched) await self.GOGPlusStorage.set({ notifLog });
}

/* ---------------- store-wide sale radar ----------------
 * The content script reports the headline of a store-wide sale it sees on the
 * home page (opt-in "Season radar"). The announcement is made once per
 * distinct headline. */

async function handleSaleRadar(text) {
  const clean = String(text || "").trim().slice(0, 120);
  if (!clean) return;
  const { seasonRadar, lastSaleSeen } = await self.GOGPlusStorage.get({ seasonRadar: false, lastSaleSeen: "" });
  if (!seasonRadar || clean === lastSaleSeen) return;
  await self.GOGPlusStorage.set({ lastSaleSeen: clean });
  await emit({
    id: `sale:${clean}`,
    kind: "sale",
    title: "A GOG sale is on",
    message: clean,
    context: "Spotted on gog.com's home page",
  });
}

/* ---------------- weekly digest ---------------- */

const DIGEST_ALARM = "gog-plus-digest";
const DIGEST_INTERVAL_MIN = 7 * 24 * 60;
const FLUSH_ALARM = "gog-plus-flush";
const FLUSH_INTERVAL_MIN = 60;
const AUTOSYNC_ALARM = "gog-plus-autosync";
const AUTOSYNC_INTERVAL_MIN = 30;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Computes a local-only weekly summary — refund windows closing soon,
// price-alert hits, wishlist-wide drops, and total price-drop snapshots
// observed in the last 7 days — and stores it for the popup's "This week"
// panel. Deliberately independent of the desktopNotifications toggle
// (unlike checkRefundWindowExpirations/checkPriceAlerts/
// checkWishlistWideAlerts above): its whole point is surfacing this to
// users who leave notifications off (the default), not just duplicating
// what opted-in users already get. It still fires one consolidated
// notification when the toggle IS on and there's something non-empty to
// report, using a fixed id so it replaces last week's rather than piling up.
async function buildWeeklyDigest() {
  const {
    purchaseLog = {},
    priceAlerts = {},
    priceHistory = {},
    wishlistPriceAlerts,
    wishlistAlertPercent,
    wishlistSlugs = [],
    rates = {},
    desktopNotifications,
  } = await self.GOGPlusStorage.get({
    purchaseLog: {},
    priceAlerts: {},
    priceHistory: {},
    wishlistPriceAlerts: false,
    wishlistAlertPercent: 20,
    wishlistSlugs: [],
    rates: {},
    desktopNotifications: false,
  });

  const now = Date.now();
  const weekAgo = now - WEEK_MS;

  // Refund windows closing within the next 7 days.
  const refundClosing = [];
  for (const [slug, raw] of Object.entries(purchaseLog)) {
    const dateStr = self.GOGPlusPurchases.purchaseDateOf(raw);
    if (!dateStr) continue;
    const purchasedAt = new Date(dateStr + "T00:00:00").getTime();
    if (!Number.isFinite(purchasedAt)) continue;
    const daysLeft = Math.ceil((purchasedAt + REFUND_WINDOW_MS - now) / (24 * 60 * 60 * 1000));
    if (daysLeft > 0 && daysLeft <= 7) refundClosing.push({ slug, daysLeft });
  }
  refundClosing.sort((a, b) => a.daysLeft - b.daysLeft);

  // Price-alert hits currently past their threshold — same matching logic
  // as checkPriceAlerts, but a read-only snapshot: doesn't touch notifLog.
  const priceAlertHits = [];
  for (const [slug, alert] of Object.entries(priceAlerts)) {
    if (!alert || !Number.isFinite(alert.threshold)) continue;
    const hist = priceHistory[slug];
    if (!hist?.length) continue;
    const latest = hist[hist.length - 1];
    let priceInAlertCur = latest.p;
    if (latest.c !== alert.currency) {
      const srcRate = latest.c === "USD" ? 1 : rates[latest.c];
      const tgtRate = alert.currency === "USD" ? 1 : rates[alert.currency];
      if (!srcRate || !tgtRate) continue;
      priceInAlertCur = (latest.p / srcRate) * tgtRate;
    }
    if (priceInAlertCur > alert.threshold) continue;
    priceAlertHits.push({ slug, price: priceInAlertCur, currency: alert.currency, threshold: alert.threshold });
  }

  // Wishlist-wide drops currently past the configured threshold — same
  // matching logic as checkWishlistWideAlerts, read-only.
  const wishlistDrops = [];
  if (wishlistPriceAlerts && wishlistSlugs.length) {
    const pct = Math.min(90, Math.max(1, Number(wishlistAlertPercent) || 20));
    for (const slug of wishlistSlugs) {
      const hist = priceHistory[slug];
      if (!hist || hist.length < 2) continue;
      let peak = hist[0];
      for (const e of hist) if (e.p > peak.p) peak = e;
      const latest = hist[hist.length - 1];
      if (peak.p <= 0 || latest.c !== peak.c) continue;
      const dropPct = ((peak.p - latest.p) / peak.p) * 100;
      if (dropPct < pct) continue;
      wishlistDrops.push({ slug, price: latest.p, currency: latest.c, dropPct: Math.round(dropPct) });
    }
    wishlistDrops.sort((a, b) => b.dropPct - a.dropPct);
  }

  // Total price-drop snapshots across every tracked game in the last 7 days.
  let dropsThisWeek = 0;
  for (const hist of Object.values(priceHistory)) {
    if (!hist || hist.length < 2) continue;
    for (let i = 1; i < hist.length; i++) {
      const ts = new Date(`${hist[i].d}T00:00:00`).getTime();
      if (!Number.isFinite(ts) || ts < weekAgo) continue;
      if (hist[i].p < hist[i - 1].p) dropsThisWeek++;
    }
  }

  const digest = {
    generatedAt: now,
    dropsThisWeek,
    refundClosing: refundClosing.slice(0, 10),
    priceAlertHits: priceAlertHits.slice(0, 10),
    wishlistDrops: wishlistDrops.slice(0, 10),
  };
  await self.GOGPlusStorage.set({ weeklyDigest: digest });

  const totalHighlights = refundClosing.length + priceAlertHits.length + wishlistDrops.length;
  if ((desktopNotifications || (await self.GOGPlusStorage.get(["webhookEnabled"])).webhookEnabled) && totalHighlights > 0) {
    const parts = [];
    if (refundClosing.length) {
      parts.push(`${refundClosing.length} refund window${refundClosing.length === 1 ? "" : "s"} closing`);
    }
    if (priceAlertHits.length) {
      parts.push(`${priceAlertHits.length} price alert${priceAlertHits.length === 1 ? "" : "s"} hit`);
    }
    if (wishlistDrops.length) {
      parts.push(`${wishlistDrops.length} wishlist drop${wishlistDrops.length === 1 ? "" : "s"}`);
    }
    await emit({
      id: "weekly-digest",
      kind: "digest",
      title: "Your weekly GOG Enhancer digest",
      message: parts.join(" · "),
      context: "Click the toolbar icon for details",
    });
  }
}

async function maybeNotifyWishlistJump(prevCount, newCount) {
  if (newCount <= prevCount) return;
  const { notifLog = {}, ...channels } = await self.GOGPlusStorage.get({
    desktopNotifications: false,
    webhookEnabled: false,
    webhookUrl: "",
    notifLog: {},
  });
  if (!wantsNotifications(channels)) return;
  const added = newCount - prevCount;
  // Throttle: only one wishlist notification per hour.
  const last = notifLog.__wishlistJump || 0;
  if (Date.now() - last < 60 * 60 * 1000) return;
  const outcome = await emit({
    id: `wishlist-jump:${Date.now()}`,
    kind: "wishlist",
    title: `Wishlist deals updated`,
    message: added === 1 ? `1 new wishlist item is on sale.` : `${added} new wishlist items are on sale.`,
    context: "Click the toolbar icon to visit your wishlist",
  });
  if (outcome) {
    notifLog.__wishlistJump = Date.now();
    await self.GOGPlusStorage.set({ notifLog });
  }
}

/* ---------------- lifecycle ---------------- */

chrome.runtime.onInstalled.addListener(async (details) => {
  await self.GOGPlusMigrations.run();
  await ensureDefaults();

  chrome.alarms.create(FX_ALARM, {
    periodInMinutes: FX_INTERVAL_MIN,
    when: Date.now() + 5000,
  });
  chrome.alarms.create(MODS_ALARM, {
    periodInMinutes: MODS_INTERVAL_MIN,
    when: Date.now() + 30000,
  });
  chrome.alarms.create(WL_ALARM, {
    periodInMinutes: WL_INTERVAL_MIN,
    when: Date.now() + 60000,
  });
  chrome.alarms.create(DAILY_ALARM, {
    periodInMinutes: DAILY_INTERVAL_MIN,
    when: Date.now() + 90000,
  });
  chrome.alarms.create(DIGEST_ALARM, {
    periodInMinutes: DIGEST_INTERVAL_MIN,
    when: Date.now() + 120000,
  });
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: FLUSH_INTERVAL_MIN, when: Date.now() + 150000 });
  chrome.alarms.create(AUTOSYNC_ALARM, { periodInMinutes: AUTOSYNC_INTERVAL_MIN, when: Date.now() + 180000 });

  if (details.reason === "install") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("onboarding/onboarding.html"),
    });
  } else if (details.reason === "update") {
    // A short "what's new" tour, once, for people coming from before v4.
    const major = parseInt(String(details.previousVersion || "0").split(".")[0], 10);
    const { tourSeen } = await self.GOGPlusStorage.get({ tourSeen: "" });
    if (major < 4 && tourSeen !== "4") {
      await self.GOGPlusStorage.set({ tourSeen: "4" });
      chrome.tabs.create({ url: chrome.runtime.getURL("tour/tour.html") });
    }
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDefaults();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FX_ALARM) fetchLiveRates();
  if (alarm.name === MODS_ALARM) refreshModsList();
  if (alarm.name === WL_ALARM) refreshWishlistBadge();
  if (alarm.name === DAILY_ALARM) {
    runDailyJobs();
  }
  if (alarm.name === DIGEST_ALARM) buildWeeklyDigest();
  if (alarm.name === FLUSH_ALARM) flushQueue().catch((e) => console.warn("[GOG+ bg] flush failed", e));
  if (alarm.name === AUTOSYNC_ALARM) {
    // Non-interactive: syncs only if the browser already remembers the folder
    // permission and the file isn't encrypted; otherwise it waits for a click.
    self.GOGPlusFolderSyncCore.autoSync({ interactive: false }).catch(() => {});
  }
});

async function runDailyJobs() {
  await checkRefundWindowExpirations();
  await checkPriceAlerts();
  await checkWishlistWideAlerts();
  await checkTagAlerts();
  // "One a day" mode: everything queued since yesterday goes out now, as one.
  await flushQueue({ force: true });
  // Housekeeping: keep notifLog from growing without bound.
  const { notifLog = {} } = await self.GOGPlusStorage.get({ notifLog: {} });
  if (pruneNotifLog(notifLog)) {
    await self.GOGPlusStorage.set({ notifLog });
  }
}

/* ---------------- commands ---------------- */

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-master") {
    const { enabled } = await self.GOGPlusStorage.get({ enabled: true });
    await self.GOGPlusStorage.set({ enabled: !enabled });
  }
  if (command === "toggle-hebrew") {
    const { hebrewTranslations } = await self.GOGPlusStorage.get({
      hebrewTranslations: false,
    });
    await self.GOGPlusStorage.set({ hebrewTranslations: !hebrewTranslations });
  }
});

/* ---------------- sync timestamps ----------------
 * Folder sync (lib/sync-core.js) resolves conflicts per record from `syncMeta`
 * timestamps. Stamping them here, from storage.onChanged, means none of the
 * many places that write tags/notes/status/etc. need to know sync exists.
 * Two guards matter: a change that arrives WITH a syncMeta change is a sync
 * being applied (the merge already carries the right timestamps — stamping
 * it "now" would let a stale value out-vote a genuinely newer edit on another
 * device), and our own syncMeta write must not re-trigger stamping. Updates
 * are chained so two quick changes can't read-modify-write over each other. */

let syncStampQueue = Promise.resolve();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || changes.syncMeta) return;
  const { SYNCED_KEYS, stampChanges } = self.GOGPlusSyncCore;
  const touched = Object.keys(changes).filter((k) => SYNCED_KEYS.includes(k));
  if (!touched.length) return;
  const now = Date.now();
  syncStampQueue = syncStampQueue
    .then(async () => {
      const { syncMeta } = await self.GOGPlusStorage.get({ syncMeta: {} });
      let meta = syncMeta;
      let changed = false;
      for (const key of touched) {
        const next = stampChanges(key, changes[key].oldValue, changes[key].newValue, meta, now);
        if (next) {
          meta = next;
          changed = true;
        }
      }
      if (changed) await self.GOGPlusStorage.set({ syncMeta: meta });
    })
    .catch((err) => console.error("[GOG+] sync timestamping failed:", err));
});

/* ---------------- status dates ----------------
 * "When did I start / finish this?" needs a date the play status never had.
 * Like the sync timestamps, it's stamped here from storage.onChanged so none
 * of the places that set a status (the game page, the dashboard, a CSV import)
 * had to learn about it. A status that arrives WITH a syncMeta change is a sync
 * being applied: its date came with it (statusDates syncs too), so it isn't
 * re-dated "today". */

let statusStampQueue = Promise.resolve();

async function stampStatusDates(oldValue, newValue) {
  const o = oldValue || {};
  const n = newValue || {};
  const today = new Date().toISOString().slice(0, 10);
  const { statusDates = {} } = await self.GOGPlusStorage.get({ statusDates: {} });
  const next = { ...statusDates };
  let changed = false;
  for (const [slug, status] of Object.entries(n)) {
    if (o[slug] === status) continue;
    if (status === "playing" || status === "finished") {
      next[slug] = { ...(next[slug] || {}), [status]: today };
      changed = true;
    }
  }
  if (changed) await self.GOGPlusStorage.set({ statusDates: next });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.gameStatus || changes.syncMeta) return;
  statusStampQueue = statusStampQueue
    .then(() => stampStatusDates(changes.gameStatus.oldValue, changes.gameStatus.newValue))
    .catch((err) => console.error("[GOG+] status dating failed:", err));
});

/* ---------------- omnibox ----------------
 * "gog <text>" in the address bar searches the user's own library (tags,
 * notes, status, purchases, wishlist) — all from local storage, no network.
 * Enter on a suggestion opens that game; Enter on free text runs GOG's own
 * store search. */

if (chrome.omnibox) {
  chrome.omnibox.setDefaultSuggestion({
    description: "Search your GOG Enhancer library — a game name, tag:rpg or status:backlog",
  });

  chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
    const data = await self.GOGPlusStorage.get([
      "tags",
      "notes",
      "gameStatus",
      "purchaseLog",
      "wishlistSlugs",
      "priceHistory",
    ]);
    const { searchLibrary, suggestionFor } = self.GOGPlusLibrarySearch;
    suggest(searchLibrary(data, text).map(suggestionFor));
  });

  chrome.omnibox.onInputEntered.addListener((text, disposition) => {
    const url = self.GOGPlusLibrarySearch.resolveOmniboxInput(text);
    if (disposition === "currentTab") chrome.tabs.update({ url });
    else chrome.tabs.create({ url, active: disposition === "newForegroundTab" });
  });
}

/* ---------------- messages ---------------- */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "force-fx-refresh") {
    fetchLiveRates().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === "force-wishlist-refresh") {
    refreshWishlistBadge().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === "force-mods-refresh") {
    refreshModsList().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === "force-digest-refresh") {
    buildWeeklyDigest().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === "wishlist-report") {
    // Content script saw the user's wishlist and counted discounted items live.
    const count = Math.max(0, Math.min(99, msg.discountedCount | 0));
    self.GOGPlusStorage.get({
      wishlistCache: { discountedCount: 0 },
    }).then((prev) => {
      const prevCount = prev.wishlistCache?.discountedCount | 0;
      self.GOGPlusStorage.set({
        wishlistCache: { discountedCount: count, total: msg.total | 0 },
        wishlistCacheUpdatedAt: Date.now(),
        // Powers checkWishlistWideAlerts() — background has no other way to
        // know which slugs are wishlisted (can't scrape the SPA route).
        wishlistSlugs: Array.isArray(msg.slugs) ? msg.slugs.slice(0, 500) : [],
      }).then(async () => {
        // Awaited so the notification (and anything it queues) is settled
        // before the content script is told the report was handled.
        await maybeNotifyWishlistJump(prevCount, count);
        await refreshWishlistBadge();
        sendResponse({ ok: true });
      });
    });
    return true;
  }
  if (msg?.type === "sale-radar") {
    handleSaleRadar(msg.text).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === "webhook-test") {
    self.GOGPlusStorage.get({ webhookUrl: "" }).then(async ({ webhookUrl }) => {
      if (!webhookUrl) return sendResponse({ ok: false, error: "no webhook address saved" });
      sendResponse(await postWebhook(webhookUrl, { title: "GOG Enhancer test", message: "If you can read this, your webhook works." }));
    });
    return true;
  }
  if (msg?.type === "force-flush") {
    flushQueue({ force: true }).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === "open-tag-dashboard") {
    chrome.tabs.create({ url: chrome.runtime.getURL("tags/tags.html") });
    sendResponse({ ok: true });
    return false;
  }
});
