import { describe, it, expect, beforeEach, vi } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/i18n.js");
await import("../extension/lib/storage.js");

function fixtureHtml() {
  const currencies = ["ILS", "EUR", "GBP", "PLN", "RUB", "none"]
    .map((c) => `<button class="currency-card" data-cur="${c}"></button>`)
    .join("\n");
  const regions = ["il", "eu", "uk", "pl", "us", "none"]
    .map((p) => `<button class="region-card" data-preset="${p}"></button>`)
    .join("\n");
  const themes = ["neon", "classic", "crt", "sunset", "light"]
    .map((t) => `<button class="theme-card" data-theme="${t}"></button>`)
    .join("\n");
  const featureIds = [
    "f-design", "f-banner", "f-refund", "f-mods", "f-history",
    "f-itad", "f-wlAlerts", "f-tags", "f-hebrew", "f-rtl",
  ];
  const features = featureIds.map((id) => `<input type="checkbox" id="${id}" checked>`).join("\n");

  return `
    <span id="onboardingVersion">v2.4</span>
    <span class="step-dot active" data-step="1">1</span>
    <span class="step-dot" data-step="2">2</span>
    <span class="step-dot" data-step="3">3</span>
    <span class="step-dot" data-step="4">4</span>

    <section class="step active" data-step="1">
      <div id="currencyGrid">${currencies}</div>
      <button data-action="next" disabled id="next1">Continue</button>
    </section>

    <section class="step" data-step="2">
      <div id="regionGrid">${regions}</div>
      <button data-action="back">Back</button>
      <button data-action="next" id="next2">Continue</button>
    </section>

    <section class="step" data-step="3">
      ${features}
      <button data-action="back">Back</button>
      <button id="next3">Continue</button>
    </section>

    <section class="step" data-step="4">
      <div id="onboardingThemes">${themes}</div>
      <button data-action="back">Back</button>
      <button id="finish">Finish setup</button>
    </section>

    <section class="step" data-step="5">
      <button id="closeBtn">Close window</button>
    </section>
  `;
}

async function bootOnboarding() {
  document.body.innerHTML = fixtureHtml();
  await import("../extension/onboarding/onboarding.js");
  await new Promise((r) => setTimeout(r, 0));
}

const ORIGINAL_GET_MANIFEST = chrome.runtime.getManifest;

beforeEach(() => {
  globalThis.__resetChromeStores();
  vi.resetModules();
  chrome.runtime.getManifest = ORIGINAL_GET_MANIFEST;
  window.scrollTo = vi.fn();
  window.close = vi.fn();
});

describe("boot", () => {
  it("starts on step 1 and sets the version badge", async () => {
    chrome.runtime.getManifest = () => ({ version: "9.9.9" });
    await bootOnboarding();
    expect(document.querySelector('.step[data-step="1"]').classList.contains("active")).toBe(true);
    expect(document.getElementById("onboardingVersion").textContent).toBe("v9.9.9");
  });

  it("applies the stored UI language on load", async () => {
    await new Promise((r) => chrome.storage.sync.set({ uiLanguage: "he" }, r));
    await bootOnboarding();
    expect(document.documentElement.getAttribute("lang")).toBe("he");
  });
});

describe("step 1 — currency", () => {
  it("enables Continue only after a currency is picked", async () => {
    await bootOnboarding();
    expect(document.getElementById("next1").disabled).toBe(true);
    document.querySelector('.currency-card[data-cur="ILS"]').click();
    expect(document.getElementById("next1").disabled).toBe(false);
    expect(document.querySelector('.currency-card[data-cur="ILS"]').classList.contains("selected")).toBe(true);
  });

  it("persists the chosen currency and advances to step 2 pre-selecting the mapped region", async () => {
    await bootOnboarding();
    document.querySelector('.currency-card[data-cur="EUR"]').click();
    document.getElementById("next1").click();
    await new Promise((r) => setTimeout(r, 0));
    const s = await new Promise((r) => chrome.storage.sync.get(["targetCurrency", "currencyConverter"], r));
    expect(s.targetCurrency).toBe("EUR");
    expect(s.currencyConverter).toBe(true);
    expect(document.querySelector('.step[data-step="2"]').classList.contains("active")).toBe(true);
    expect(document.querySelector('.region-card[data-preset="eu"]').classList.contains("selected")).toBe(true);
  });

  it("sets currencyConverter to false when 'none' is chosen", async () => {
    await bootOnboarding();
    document.querySelector('.currency-card[data-cur="none"]').click();
    document.getElementById("next1").click();
    await new Promise((r) => setTimeout(r, 0));
    const s = await new Promise((r) => chrome.storage.sync.get(["currencyConverter"], r));
    expect(s.currencyConverter).toBe(false);
  });
});

describe("step 2 — region preset", () => {
  it("applies the selected preset's currency/VAT and enables the tax estimator when VAT > 0", async () => {
    await bootOnboarding();
    document.querySelector('.currency-card[data-cur="RUB"]').click(); // no auto-region mapping for RUB
    document.getElementById("next1").click();
    document.querySelector('.region-card[data-preset="uk"]').click();
    document.getElementById("next2").click();
    await new Promise((r) => setTimeout(r, 0));
    const s = await new Promise((r) =>
      chrome.storage.sync.get(["targetCurrency", "vatPercent", "regionPreset", "taxEstimator"], r)
    );
    expect(s.targetCurrency).toBe("GBP");
    expect(s.vatPercent).toBe(20);
    expect(s.regionPreset).toBe("uk");
    expect(s.taxEstimator).toBe(true);
  });

  it("leaves taxEstimator off for the zero-VAT 'us' preset", async () => {
    await bootOnboarding();
    document.querySelector('.region-card[data-preset="us"]').click();
    document.getElementById("next2").click();
    await new Promise((r) => setTimeout(r, 0));
    const s = await new Promise((r) => chrome.storage.sync.get(["taxEstimator"], r));
    expect(s.taxEstimator).toBe(false);
  });

  it("advances to step 3 even with no region selected", async () => {
    await bootOnboarding();
    document.getElementById("next2").click();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.step[data-step="3"]').classList.contains("active")).toBe(true);
  });
});

describe("step 3 — features", () => {
  it("persists every feature checkbox and forces enabled=true", async () => {
    await bootOnboarding();
    document.getElementById("f-hebrew").checked = true;
    document.getElementById("f-mods").checked = false;
    document.getElementById("next3").click();
    await new Promise((r) => setTimeout(r, 0));
    const s = await new Promise((r) =>
      chrome.storage.sync.get(["hebrewTranslations", "modIndicator", "enabled"], r)
    );
    expect(s.hebrewTranslations).toBe(true);
    expect(s.modIndicator).toBe(false);
    expect(s.enabled).toBe(true);
  });

  it("pre-selects the neon theme entering step 4", async () => {
    await bootOnboarding();
    document.getElementById("next3").click();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.theme-card[data-theme="neon"]').classList.contains("selected")).toBe(true);
    expect(document.querySelector('.step[data-step="4"]').classList.contains("active")).toBe(true);
  });
});

describe("step 4 — theme + finish", () => {
  it("switches the selected theme card on click", async () => {
    await bootOnboarding();
    document.querySelector('.theme-card[data-theme="crt"]').click();
    expect(document.querySelector('.theme-card[data-theme="crt"]').classList.contains("selected")).toBe(true);
    expect(document.querySelector('.theme-card[data-theme="neon"]').classList.contains("selected")).toBe(false);
  });

  it("finish persists the chosen theme, marks onboarding complete, and shows step 5", async () => {
    await bootOnboarding();
    document.querySelector('.theme-card[data-theme="sunset"]').click();
    document.getElementById("finish").click();
    await new Promise((r) => setTimeout(r, 0));
    const s = await new Promise((r) => chrome.storage.sync.get(["theme", "onboardingComplete"], r));
    expect(s.theme).toBe("sunset");
    expect(s.onboardingComplete).toBe(true);
    expect(document.querySelector('.step[data-step="5"]').classList.contains("active")).toBe(true);
  });

  it("defaults to the neon theme if the user never picks one", async () => {
    await bootOnboarding();
    document.getElementById("next3").click(); // pre-selects neon per step-3 handler
    await new Promise((r) => setTimeout(r, 0));
    document.getElementById("finish").click();
    await new Promise((r) => setTimeout(r, 0));
    const s = await new Promise((r) => chrome.storage.sync.get(["theme"], r));
    expect(s.theme).toBe("neon");
  });
});

describe("navigation", () => {
  it("back buttons step backward but never below step 1", async () => {
    await bootOnboarding();
    document.getElementById("next1").disabled = false;
    document.getElementById("next1").click();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.step[data-step="2"]').classList.contains("active")).toBe(true);
    document.querySelector('[data-action="back"]').click();
    expect(document.querySelector('.step[data-step="1"]').classList.contains("active")).toBe(true);
  });

  it("closeBtn closes the window", async () => {
    await bootOnboarding();
    document.getElementById("closeBtn").click();
    expect(window.close).toHaveBeenCalled();
  });
});
