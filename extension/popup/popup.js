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
  "hebrewTranslations",
  "rtlLayout",
];

const ID_OVERRIDES = {
  enabled: "masterEnabled",
};

const DEFAULTS = window.GOG_PLUS_DEFAULTS;

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

  renderWhatsNew(s);
  renderRateStrip(s);
  renderDeals(s);
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

// Shows changelog bullets for every version since the user last dismissed one
// (see lib/changelog.js#versionsSince). Stays hidden once storage.lastSeenVersion
// catches up to the installed manifest version.
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
    (window.GOGPlusChangelog.CHANGELOG[v] || []).forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      list.appendChild(li);
    });
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

document.addEventListener("DOMContentLoaded", () => {
  load();
  bind();
  // Refresh strip every minute while popup is open
  setInterval(load, 60000);
});
