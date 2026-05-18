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
