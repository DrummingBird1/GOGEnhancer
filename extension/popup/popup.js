/**
 * GOG+ popup logic v2.
 * Two-way binding for all toggles + currency + VAT.
 * Live rate timestamp display + force-refresh.
 */

const ALL_BOOLEAN_KEYS = [
  "enabled",
  "taxEstimator",
  "refundBadge",
  "drmFreeBanner",
  "modIndicator",
  "hideExpiredSales",
  "cleanLayout",
  "skeletonLoaders",
  "designInjection",
  "richTooltips",
  "customTags",
  "wishlistFilters",
  "wishlistAlerts",
  "priceHistoryTracking",
  "lowestPriceBadge",
  "refundTimer",
  "itadCompare",
  "priceCompareTable",
  "hebrewTranslations",
  "rtlLayout",
  "plainLook",
  "calmMode",
  "catalogTools",
  "wishlistSmart",
];

const ID_OVERRIDES = {
  enabled: "masterEnabled",
};

const DEFAULTS = window.GOG_PLUS_DEFAULTS;

/** @param {string} id @returns {any} the page's controls are used as inputs, buttons, … */
function $(id) { return document.getElementById(id); }

async function load() {
  const s = await window.GOGPlusStorage.get(DEFAULTS);
  window.GOGPlusI18n?.apply(s.uiLanguage || "en");
  $("masterEnabled").checked = !!s.enabled;
  document.body.classList.toggle("disabled", !s.enabled);

  $("targetCurrency").value = s.targetCurrency || "ILS";
  $("vatPercent").value = s.vatPercent ?? 18;

  ALL_BOOLEAN_KEYS.forEach((k) => {
    const id = ID_OVERRIDES[k] || k;
    const el = $(id);
    if (el) el.checked = !!s[k];
  });

  // The popup's own look follows the same accessibility switches as the site UI.
  document.documentElement.classList.toggle("gog-plus-calm", !!s.calmMode);
  [...document.documentElement.classList]
    .filter((c) => c.startsWith("gog-plus-palette--"))
    .forEach((c) => document.documentElement.classList.remove(c));
  if (s.palette && s.palette !== "default") document.documentElement.classList.add(`gog-plus-palette--${s.palette}`);

  renderBroken(s);
  renderWhatsNew(s);
  renderRateStrip(s);
  renderDeals(s);
  renderDigest(s);
}

// "Something on gog.com isn't working" — features that failed on a gog.com page
// recently (lib/failure-log.js). Each feature runs in isolation, so this says
// which one stopped, and offers a report the user can copy or send themselves.
function renderBroken(s) {
  const box = $("brokenBanner");
  const Log = window.GOGPlusFailureLog;
  if (!box || !Log) return;
  const entries = Log.current(s.failureLog, s.failureSeenAt);
  if (!entries.length) {
    box.hidden = true;
    return;
  }
  $("brokenText").textContent = `${Log.summarize(entries)} stopped working on a gog.com page. The rest of the extension still works.`;
  box.dataset.report = Log.buildReport(entries, { version: chrome.runtime.getManifest().version, userAgent: navigator.userAgent });
  box.hidden = false;
}

const CUR_SYMBOLS = { USD: "$", EUR: "€", ILS: "₪", GBP: "£", PLN: "zł", RUB: "₽" };

function slugToTitle(slug) {
  return slug
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Top wishlist price drops, computed entirely from data already tracked —
// wishlistSlugs (reported by the wishlist page visit) and priceHistory
// (recorded on every game-page visit). No new fetches. Reuses the
// wishlistAlerts toggle rather than adding a dedicated setting, since it's
// the same "wishlist deals" surface the toolbar badge already represents.
const MIN_DEAL_DROP_PCT = 10;
const MAX_DEALS_SHOWN = 3;

function computeTopWishlistDeals(s) {
  const slugs = Array.isArray(s.wishlistSlugs) ? s.wishlistSlugs : [];
  const history = s.priceHistory || {};
  const deals = [];
  for (const slug of slugs) {
    const hist = history[slug];
    if (!hist || hist.length < 2) continue;
    let peak = hist[0];
    for (const e of hist) if (e.p > peak.p) peak = e;
    const latest = hist[hist.length - 1];
    if (peak.p <= 0 || latest.c !== peak.c) continue;
    const dropPct = ((peak.p - latest.p) / peak.p) * 100;
    if (dropPct < MIN_DEAL_DROP_PCT) continue;
    deals.push({ slug, price: latest.p, currency: latest.c, dropPct: Math.round(dropPct) });
  }
  deals.sort((a, b) => b.dropPct - a.dropPct);
  return deals.slice(0, MAX_DEALS_SHOWN);
}

function renderDeals(s) {
  const section = $("dealsSection");
  if (!section) return;
  const deals = s.wishlistAlerts ? computeTopWishlistDeals(s) : [];
  if (!deals.length) {
    section.hidden = true;
    return;
  }
  const list = $("dealsList");
  list.innerHTML = "";
  deals.forEach((d) => {
    const li = document.createElement("li");
    li.className = "deals-item";
    const link = document.createElement("a");
    link.href = `https://www.gog.com/en/game/${encodeURIComponent(d.slug)}`;
    link.target = "_blank";
    link.rel = "noopener";
    const sym = CUR_SYMBOLS[d.currency] || d.currency;
    const name = document.createElement("span");
    name.className = "deals-item-name";
    name.textContent = slugToTitle(d.slug);
    const meta = document.createElement("span");
    meta.className = "deals-item-meta";
    meta.textContent = `${sym}${d.price.toFixed(2)} · -${d.dropPct}%`;
    link.appendChild(name);
    link.appendChild(meta);
    li.appendChild(link);
    list.appendChild(li);
  });
  section.hidden = false;
}

// "This week" — the background service worker's weekly digest job
// (background.js#buildWeeklyDigest, gog-plus-digest alarm) computes this
// independently of the desktopNotifications toggle specifically so it's
// still useful here even for users who leave notifications off (the
// default). Hidden when there's nothing actionable to show — dropsThisWeek
// alone (a trivia count, not something to act on) doesn't unhide it.
function renderDigest(s) {
  const section = $("digestSection");
  if (!section) return;
  const digest = s.weeklyDigest;
  const highlightCount = digest
    ? digest.refundClosing.length + digest.priceAlertHits.length + digest.wishlistDrops.length + (digest.endingSoon?.length || 0)
    : 0;
  if (!highlightCount) {
    section.hidden = true;
    return;
  }
  const list = $("digestList");
  list.innerHTML = "";

  const addItem = (slug, metaText) => {
    const li = document.createElement("li");
    li.className = "digest-item";
    const link = document.createElement("a");
    link.href = `https://www.gog.com/en/game/${encodeURIComponent(slug)}`;
    link.target = "_blank";
    link.rel = "noopener";
    const name = document.createElement("span");
    name.className = "digest-item-name";
    name.textContent = slugToTitle(slug);
    const meta = document.createElement("span");
    meta.className = "digest-item-meta";
    meta.textContent = metaText;
    link.appendChild(name);
    link.appendChild(meta);
    li.appendChild(link);
    list.appendChild(li);
  };

  digest.refundClosing.forEach((r) => {
    addItem(r.slug, `⏰ refund closes in ${r.daysLeft}d`);
  });
  digest.priceAlertHits.forEach((p) => {
    const sym = CUR_SYMBOLS[p.currency] || p.currency;
    addItem(p.slug, `🔔 ${sym}${p.price.toFixed(2)} — alert hit`);
  });
  digest.wishlistDrops.forEach((w) => {
    addItem(w.slug, `📉 -${w.dropPct}% off peak`);
  });
  (digest.endingSoon || []).forEach((e) => {
    const days = Math.max(0, Math.ceil((e.endsAt - Date.now()) / 86400000));
    addItem(e.slug, `⏳ offer ends in ${days <= 1 ? "under a day" : `${days}d`}`);
  });

  section.hidden = false;
}

// Shows changelog bullets for every version since the user last dismissed one
// (see lib/changelog.js#versionsSince). Stays hidden once storage.lastSeenVersion
// catches up to the installed manifest version.
const WHATS_NEW_MAX = 6;

function renderWhatsNew(s) {
  const panel = $("whatsNew");
  if (!panel || !window.GOGPlusChangelog) return;

  const currentVersion = chrome.runtime.getManifest().version;
  const versions = window.GOGPlusChangelog.versionsSince(
    s.lastSeenVersion,
    currentVersion
  );
  if (!versions.length) {
    panel.hidden = true;
    return;
  }

  const list = $("whatsNewList");
  list.innerHTML = "";
  versions.forEach((v) => {
    if (versions.length > 1) {
      const head = document.createElement("li");
      head.className = "whatsnew-version-head";
      head.textContent = `v${v}`;
      list.appendChild(head);
    }
    // The popup is small: the headline changes are listed (the changelog puts
    // them first) and the rest is one link away.
    const bullets = window.GOGPlusChangelog.CHANGELOG[v] || [];
    bullets.slice(0, WHATS_NEW_MAX).forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      list.appendChild(li);
    });
    if (bullets.length > WHATS_NEW_MAX) {
      const li = document.createElement("li");
      li.className = "whatsnew-more";
      const a = document.createElement("a");
      a.href = "https://drummingbird1.github.io/GOGEnhancer/changelog.html";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = `…and ${bullets.length - WHATS_NEW_MAX} more change${bullets.length - WHATS_NEW_MAX === 1 ? "" : "s"} — see the full changelog`;
      li.appendChild(a);
      list.appendChild(li);
    }
  });
  $("whatsNewVersion").textContent = `v${currentVersion}`;
  panel.hidden = false;
}

function renderRateStrip(s) {
  const el = $("rateStrip");
  if (!el) return;
  el.classList.remove("fresh", "has-error");

  if (!s.ratesUpdatedAt && !s.lastFxError) {
    el.textContent = "Using bundled rates · click ↻ to refresh";
    return;
  }

  const cur = s.targetCurrency;
  const rate = s.rates && s.rates[cur];
  const parts = [];
  if (cur && cur !== "none" && rate) {
    parts.push(`1 USD = ${rate.toFixed(3)} ${cur}`);
  }

  if (s.ratesUpdatedAt) {
    const ageH = Math.round((Date.now() - s.ratesUpdatedAt) / 3600000);
    if (ageH < 1) {
      parts.push("just updated");
      if (!s.lastFxError) el.classList.add("fresh");
    } else if (ageH < 24) {
      parts.push(`${ageH}h ago`);
    } else {
      parts.push(`${Math.round(ageH / 24)}d ago`);
    }
  }

  if (s.lastFxError) {
    parts.push("⚠ refresh failed");
    el.classList.add("has-error");
  }

  el.textContent = parts.join(" · ");
}

function bind() {
  ALL_BOOLEAN_KEYS.forEach((k) => {
    const id = ID_OVERRIDES[k] || k;
    const el = $(id);
    if (!el) return;
    el.addEventListener("change", () => {
      window.GOGPlusStorage.set({ [k]: el.checked });
      if (k === "enabled") {
        document.body.classList.toggle("disabled", !el.checked);
      }
    });
  });

  $("targetCurrency").addEventListener("change", () => {
    window.GOGPlusStorage.set({
      targetCurrency: $("targetCurrency").value,
      currencyConverter: $("targetCurrency").value !== "none",
    });
  });

  $("vatPercent").addEventListener("change", () => {
    let v = parseFloat($("vatPercent").value);
    if (Number.isNaN(v) || v < 0) v = 0;
    if (v > 40) v = 40;
    $("vatPercent").value = v;
    window.GOGPlusStorage.set({ vatPercent: v });
  });

  $("whatsNewDismiss").addEventListener("click", async () => {
    const currentVersion = chrome.runtime.getManifest().version;
    await window.GOGPlusStorage.set({ lastSeenVersion: currentVersion });
    $("whatsNew").hidden = true;
  });

  $("refreshRates").addEventListener("click", (e) => {
    e.preventDefault();
    e.target.textContent = "↻ …";
    chrome.runtime.sendMessage({ type: "force-fx-refresh" }, () => {
      setTimeout(load, 300);
      setTimeout(() => (e.target.textContent = "↻ rates"), 1200);
    });
  });

  $("digestDownload")?.addEventListener("click", async () => {
    const { weeklyDigest } = await window.GOGPlusStorage.get({ weeklyDigest: null });
    if (!weeklyDigest) return;
    const Digest = window.GOGPlusDigestHtml;
    const html = Digest.build(weeklyDigest, { titleOf: slugToTitle });
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = Digest.fileName(weeklyDigest.generatedAt || Date.now());
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $("brokenCopy")?.addEventListener("click", async (e) => {
    const report = $("brokenBanner").dataset.report || "";
    try {
      await navigator.clipboard.writeText(report);
      e.target.textContent = "Copied ✓";
    } catch (_) {
      e.target.textContent = "Couldn't copy";
    }
  });
  $("brokenIssue")?.addEventListener("click", () => {
    const report = $("brokenBanner").dataset.report || "";
    chrome.tabs.create({ url: window.GOGPlusFailureLog.issueUrl(report, chrome.runtime.getManifest().version) });
  });
  $("brokenDismiss")?.addEventListener("click", async () => {
    await window.GOGPlusStorage.set({ failureSeenAt: Date.now() });
    $("brokenBanner").hidden = true;
  });

  $("openOptions").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  $("openTags").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL("tags/tags.html") });
  });

  $("reload").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) chrome.tabs.reload(tabs[0].id);
      window.close();
    });
  });
}

document.addEventListener(
  "DOMContentLoaded",
  () => {
    load();
    bind();
    // Refresh strip every minute while popup is open
    setInterval(load, 60000);
  },
  // See the identical comment in options.js — { once: true } stops a test
  // harness that re-imports this module against one shared `document` from
  // accumulating a duplicate bind() per import.
  { once: true }
);
