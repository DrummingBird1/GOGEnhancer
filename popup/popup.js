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
  "itadCompare",
  "hebrewTranslations",
  "rtlLayout",
];

const ID_OVERRIDES = {
  enabled: "masterEnabled",
};

const DEFAULTS = {
  enabled: true,
  taxEstimator: true,
  refundBadge: true,
  drmFreeBanner: true,
  modIndicator: true,
  hideExpiredSales: true,
  cleanLayout: true,
  skeletonLoaders: true,
  designInjection: true,
  richTooltips: true,
  customTags: true,
  wishlistFilters: true,
  wishlistAlerts: true,
  priceHistoryTracking: true,
  itadCompare: true,
  hebrewTranslations: false,
  rtlLayout: false,
  targetCurrency: "ILS",
  vatPercent: 18,
  ratesUpdatedAt: 0,
  rates: { ILS: 3.65, EUR: 0.92, GBP: 0.79, RUB: 92.0, PLN: 4.0 },
};

function $(id) { return document.getElementById(id); }

function load() {
  // Storage abstraction lives in lib/storage.js but isn't injected into the
  // popup. We can use chrome.storage.sync directly here for prefs.
  chrome.storage.sync.get(DEFAULTS, (s) => {
    $("masterEnabled").checked = !!s.enabled;
    document.body.classList.toggle("disabled", !s.enabled);

    $("targetCurrency").value = s.targetCurrency || "ILS";
    $("vatPercent").value = s.vatPercent ?? 18;

    ALL_BOOLEAN_KEYS.forEach((k) => {
      const id = ID_OVERRIDES[k] || k;
      const el = $(id);
      if (el) el.checked = !!s[k];
    });

    renderRateStrip(s);
  });
}

function renderRateStrip(s) {
  const el = $("rateStrip");
  if (!el) return;
  if (!s.ratesUpdatedAt) {
    el.textContent = "Using bundled rates · click ↻ to refresh";
    el.classList.remove("fresh");
    return;
  }
  const ageH = Math.round((Date.now() - s.ratesUpdatedAt) / 3600000);
  const cur = s.targetCurrency;
  const rate = s.rates && s.rates[cur];
  let parts = [];
  if (cur && cur !== "none" && rate) {
    parts.push(`1 USD = ${rate.toFixed(3)} ${cur}`);
  }
  if (ageH < 1) {
    parts.push("just updated");
    el.classList.add("fresh");
  } else if (ageH < 24) {
    parts.push(`${ageH}h ago`);
    el.classList.remove("fresh");
  } else {
    parts.push(`${Math.round(ageH / 24)}d ago`);
    el.classList.remove("fresh");
  }
  el.textContent = parts.join(" · ");
}

function bind() {
  ALL_BOOLEAN_KEYS.forEach((k) => {
    const id = ID_OVERRIDES[k] || k;
    const el = $(id);
    if (!el) return;
    el.addEventListener("change", () => {
      chrome.storage.sync.set({ [k]: el.checked });
      if (k === "enabled") {
        document.body.classList.toggle("disabled", !el.checked);
      }
    });
  });

  $("targetCurrency").addEventListener("change", () => {
    chrome.storage.sync.set({
      targetCurrency: $("targetCurrency").value,
      currencyConverter: $("targetCurrency").value !== "none",
    });
  });

  $("vatPercent").addEventListener("change", () => {
    let v = parseFloat($("vatPercent").value);
    if (Number.isNaN(v) || v < 0) v = 0;
    if (v > 40) v = 40;
    $("vatPercent").value = v;
    chrome.storage.sync.set({ vatPercent: v });
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
