/**
 * GOG+ background service worker v2.
 *
 * Responsibilities:
 *   - Run settings migration on install/update
 *   - Periodically fetch live FX rates from frankfurter.app
 *   - Periodically scrape /mods page for the list of moddable games
 *   - Periodically check wishlist for items on sale → toolbar badge
 *   - Handle keyboard commands
 */

import "../lib/defaults.js";
import "../lib/storage.js";

const CURRENT_SETTINGS_VERSION = self.GOG_PLUS_SETTINGS_VERSION;
const DEFAULTS = self.GOG_PLUS_DEFAULTS;

/* ---------------- migration ---------------- */

async function runMigrations() {
  const { settingsVersion } = await self.GOGPlusStorage.get({ settingsVersion: 1 });

  if (settingsVersion < 2) {
    const syncAll = await new Promise((r) => chrome.storage.sync.get(null, r));
    const toLocal = {};
    if (syncAll.tags) toLocal.tags = syncAll.tags;
    if (syncAll.notes) toLocal.notes = syncAll.notes;
    if (Object.keys(toLocal).length) {
      await new Promise((r) => chrome.storage.local.set(toLocal, r));
      await new Promise((r) => chrome.storage.sync.remove(["tags", "notes"], r));
    }
  }
  await self.GOGPlusStorage.set({ settingsVersion: CURRENT_SETTINGS_VERSION });
}

async function ensureDefaults() {
  const existing = await self.GOGPlusStorage.get(Object.keys(DEFAULTS));
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

async function refreshWishlistBadge() {
  try {
    const { wishlistAlerts, wishlistCache, wishlistCacheUpdatedAt } =
      await self.GOGPlusStorage.get({
        wishlistAlerts: true,
        wishlistCache: { discountedCount: 0 },
        wishlistCacheUpdatedAt: 0,
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
      chrome.action.setBadgeBackgroundColor({ color: "#c64fff" });
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

function slugToTitle(slug) {
  return slug
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function checkRefundWindowExpirations() {
  const { desktopNotifications, purchaseLog = {}, notifLog = {} } =
    await self.GOGPlusStorage.get({
      desktopNotifications: false,
      purchaseLog: {},
      notifLog: {},
    });
  if (!desktopNotifications) return;

  const now = Date.now();
  let touched = false;
  for (const [slug, dateStr] of Object.entries(purchaseLog)) {
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
      await fireNotification(
        key,
        `Refund window closing — ${slugToTitle(slug)}`,
        `${daysLeft} ${word} left on GOG's 30-day refund guarantee.`,
        "Tracked via your manual purchase date"
      );
      notifLog[key] = now;
      touched = true;
    }
  }
  if (touched) await self.GOGPlusStorage.set({ notifLog });
}

async function maybeNotifyWishlistJump(prevCount, newCount) {
  if (newCount <= prevCount) return;
  const { desktopNotifications, notifLog = {} } = await self.GOGPlusStorage.get({
    desktopNotifications: false,
    notifLog: {},
  });
  if (!desktopNotifications) return;
  const added = newCount - prevCount;
  // Throttle: only one wishlist notification per hour.
  const last = notifLog.__wishlistJump || 0;
  if (Date.now() - last < 60 * 60 * 1000) return;
  await fireNotification(
    `wishlist-jump:${Date.now()}`,
    `Wishlist deals updated`,
    added === 1
      ? `1 new wishlist item is on sale.`
      : `${added} new wishlist items are on sale.`,
    "Click the toolbar icon to visit your wishlist"
  );
  notifLog.__wishlistJump = Date.now();
  await self.GOGPlusStorage.set({ notifLog });
}

/* ---------------- lifecycle ---------------- */

chrome.runtime.onInstalled.addListener(async (details) => {
  await runMigrations();
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

  if (details.reason === "install") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("onboarding/onboarding.html"),
    });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDefaults();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FX_ALARM) fetchLiveRates();
  if (alarm.name === MODS_ALARM) refreshModsList();
  if (alarm.name === WL_ALARM) refreshWishlistBadge();
  if (alarm.name === DAILY_ALARM) checkRefundWindowExpirations();
});

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
      }).then(() => {
        maybeNotifyWishlistJump(prevCount, count);
        refreshWishlistBadge().then(() => sendResponse({ ok: true }));
      });
    });
    return true;
  }
  if (msg?.type === "open-tag-dashboard") {
    chrome.tabs.create({ url: chrome.runtime.getURL("tags/tags.html") });
    sendResponse({ ok: true });
    return false;
  }
});
