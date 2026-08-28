import { describe, it, expect, beforeEach, vi } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/i18n.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/changelog.js");

const BOOLEAN_IDS = [
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

function fixtureHtml() {
  const toggles = BOOLEAN_IDS.map((id) => `<input type="checkbox" id="${id}">`).join("\n");
  return `
    <input type="checkbox" id="masterEnabled">
    <div id="whatsNew" hidden>
      <span id="whatsNewVersion"></span>
      <ul id="whatsNewList"></ul>
      <button id="whatsNewDismiss"></button>
    </div>
    <div id="rateStrip"></div>
    <select id="targetCurrency">
      <option value="none">Off</option>
      <option value="ILS">ILS</option>
      <option value="EUR">EUR</option>
      <option value="GBP">GBP</option>
      <option value="RUB">RUB</option>
      <option value="PLN">PLN</option>
    </select>
    <input type="number" id="vatPercent">
    <button id="refreshRates">refresh</button>
    ${toggles}
    <button id="openTags"></button>
    <button id="openOptions"></button>
    <button id="reload"></button>
  `;
}

async function bootPopup() {
  document.body.innerHTML = fixtureHtml();
  await import("../extension/popup/popup.js");
  document.dispatchEvent(new Event("DOMContentLoaded"));
  // load() is async (storage.get) — flush microtasks before asserting.
  await new Promise((r) => setTimeout(r, 0));
}

const ORIGINAL_GET_MANIFEST = chrome.runtime.getManifest;

beforeEach(() => {
  globalThis.__resetChromeStores();
  vi.resetModules();
  chrome.runtime.getManifest = ORIGINAL_GET_MANIFEST;
});

describe("popup load()", () => {
  it("reflects stored settings into the master toggle, currency, and VAT fields", async () => {
    await new Promise((r) =>
      chrome.storage.sync.set({ enabled: false, targetCurrency: "EUR", vatPercent: 21 }, r)
    );
    await bootPopup();
    expect(document.getElementById("masterEnabled").checked).toBe(false);
    expect(document.getElementById("targetCurrency").value).toBe("EUR");
    expect(document.getElementById("vatPercent").value).toBe("21");
    expect(document.body.classList.contains("disabled")).toBe(true);
  });

  it("checks every boolean toggle from its stored value", async () => {
    await new Promise((r) =>
      chrome.storage.sync.set({ hebrewTranslations: true, rtlLayout: true }, r)
    );
    await bootPopup();
    expect(document.getElementById("hebrewTranslations").checked).toBe(true);
    expect(document.getElementById("rtlLayout").checked).toBe(true);
    expect(document.getElementById("customTags").checked).toBe(true); // default is true
  });

  it("falls back to bundled-rates copy when no rate has ever been fetched", async () => {
    await bootPopup();
    expect(document.getElementById("rateStrip").textContent).toContain("bundled rates");
  });

  it("shows the fresh rate and age once rates have been fetched", async () => {
    await new Promise((r) =>
      chrome.storage.sync.set(
        { targetCurrency: "ILS", rates: { ILS: 3.7 }, ratesUpdatedAt: Date.now() - 2 * 3600000 },
        r
      )
    );
    await bootPopup();
    const text = document.getElementById("rateStrip").textContent;
    expect(text).toContain("1 USD = 3.700 ILS");
    expect(text).toContain("2h ago");
  });

  it("flags a stale-fetch error on the rate strip", async () => {
    await new Promise((r) =>
      chrome.storage.sync.set({ ratesUpdatedAt: Date.now(), lastFxError: "network down" }, r)
    );
    await bootPopup();
    const el = document.getElementById("rateStrip");
    expect(el.classList.contains("has-error")).toBe(true);
    expect(el.textContent).toContain("refresh failed");
  });
});

describe("What's new panel", () => {
  it("stays hidden once lastSeenVersion matches the installed version", async () => {
    await new Promise((r) => chrome.storage.local.set({ lastSeenVersion: "2.9.0" }, r));
    await bootPopup();
    expect(document.getElementById("whatsNew").hidden).toBe(true);
  });

  it("shows bullets for a version newer than lastSeenVersion", async () => {
    // Pin "current version" to a real CHANGELOG key so this doesn't depend
    // on a changelog entry existing yet for whatever this shim's default
    // getManifest() version is.
    const known = Object.keys(window.GOGPlusChangelog.CHANGELOG).sort(
      window.GOGPlusChangelog.compareVersions
    );
    const target = known[known.length - 1];
    chrome.runtime.getManifest = () => ({ version: target });
    await new Promise((r) => chrome.storage.local.set({ lastSeenVersion: "" }, r));
    await bootPopup();
    const panel = document.getElementById("whatsNew");
    expect(panel.hidden).toBe(false);
    expect(document.getElementById("whatsNewList").children.length).toBeGreaterThan(0);
  });

  it("dismiss button hides the panel and persists lastSeenVersion", async () => {
    const known = Object.keys(window.GOGPlusChangelog.CHANGELOG).sort(
      window.GOGPlusChangelog.compareVersions
    );
    const target = known[known.length - 1];
    chrome.runtime.getManifest = () => ({ version: target });
    await new Promise((r) => chrome.storage.local.set({ lastSeenVersion: "" }, r));
    await bootPopup();
    document.getElementById("whatsNewDismiss").click();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.getElementById("whatsNew").hidden).toBe(true);
    const s = await new Promise((r) => chrome.storage.local.get(["lastSeenVersion"], r));
    expect(s.lastSeenVersion).toBe(target);
  });
});

describe("binding — writes back to storage on change", () => {
  it("persists a boolean toggle flip", async () => {
    await bootPopup();
    const el = document.getElementById("skeletonLoaders");
    el.checked = false;
    el.dispatchEvent(new Event("change"));
    const s = await new Promise((r) => chrome.storage.sync.get(["skeletonLoaders"], r));
    expect(s.skeletonLoaders).toBe(false);
  });

  it("toggling masterEnabled updates the disabled class immediately", async () => {
    await bootPopup();
    const el = document.getElementById("masterEnabled");
    el.checked = false;
    el.dispatchEvent(new Event("change"));
    expect(document.body.classList.contains("disabled")).toBe(true);
  });

  it("changing currency also flips currencyConverter off for 'none'", async () => {
    await bootPopup();
    const sel = document.getElementById("targetCurrency");
    sel.value = "none";
    sel.dispatchEvent(new Event("change"));
    const s = await new Promise((r) =>
      chrome.storage.sync.get(["targetCurrency", "currencyConverter"], r)
    );
    expect(s.targetCurrency).toBe("none");
    expect(s.currencyConverter).toBe(false);
  });

  it("clamps VAT input into [0, 40]", async () => {
    await bootPopup();
    const input = document.getElementById("vatPercent");
    input.value = "999";
    input.dispatchEvent(new Event("change"));
    expect(input.value).toBe("40");
    const s = await new Promise((r) => chrome.storage.sync.get(["vatPercent"], r));
    expect(s.vatPercent).toBe(40);
  });

  it("treats a negative or NaN VAT input as 0", async () => {
    await bootPopup();
    const input = document.getElementById("vatPercent");
    input.value = "not-a-number";
    input.dispatchEvent(new Event("change"));
    expect(input.value).toBe("0");
  });
});

describe("footer buttons", () => {
  it("openOptions opens the options page", async () => {
    await bootPopup();
    document.getElementById("openOptions").click();
    expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
  });

  it("openTags opens the tag dashboard in a new tab", async () => {
    await bootPopup();
    document.getElementById("openTags").click();
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: expect.stringContaining("tags/tags.html"),
    });
  });

  it("reload queries the active tab and reloads it", async () => {
    await bootPopup();
    document.getElementById("reload").click();
    expect(chrome.tabs.query).toHaveBeenCalled();
  });
});
