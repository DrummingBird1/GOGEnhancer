// @ts-check
/**
 * GOG+ onboarding wizard logic.
 *
 * Steps:
 *   1 — pick currency
 *   2 — pick region preset (sets VAT)
 *   3 — toggle features
 *   4 — done
 */

/** The wizard's controls are looked up by id / selector and used as inputs, buttons, … — typed loosely. */
/** @type {(id: string) => any} */
const $ = (id) => document.getElementById(id);
/** @type {(selector: string) => NodeListOf<HTMLElement>} */
const $$ = (selector) => document.querySelectorAll(selector);

const PRESETS = {
  il: { targetCurrency: "ILS", vatPercent: 18, vatLabel: "כולל מע״מ" },
  eu: { targetCurrency: "EUR", vatPercent: 20, vatLabel: "incl. VAT" },
  uk: { targetCurrency: "GBP", vatPercent: 20, vatLabel: "incl. VAT" },
  pl: { targetCurrency: "PLN", vatPercent: 23, vatLabel: "z VAT" },
  us: { targetCurrency: "USD", vatPercent: 0, vatLabel: "" },
  none: { vatPercent: 0, vatLabel: "" },
};

const state = {
  currentStep: 1,
  selectedCurrency: null,
  selectedPreset: null,
};

function showStep(n) {
  $$(".step").forEach((el) => {
    el.classList.toggle("active", parseInt(el.dataset.step, 10) === n);
  });
  $$(".step-dot").forEach((dot) => {
    const i = parseInt(dot.dataset.step, 10);
    dot.classList.toggle("active", i === n);
    dot.classList.toggle("done", i < n);
  });
  state.currentStep = n;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---- step 1: currency ---- */

$$(".currency-card").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".currency-card").forEach((b) =>
      b.classList.remove("selected")
    );
    btn.classList.add("selected");
    state.selectedCurrency = btn.dataset.cur;
    $("next1").disabled = false;

    // Auto-pick a sensible region for the chosen currency
    const map = { ILS: "il", EUR: "eu", GBP: "uk", PLN: "pl", USD: "us" };
    if (map[state.selectedCurrency]) {
      state.selectedPreset = map[state.selectedCurrency];
    }
  });
});

$("next1").addEventListener("click", async () => {
  await window.GOGPlusStorage.set({
    targetCurrency: state.selectedCurrency,
    currencyConverter: state.selectedCurrency !== "none",
  });
  // Pre-select region based on currency
  if (state.selectedPreset) {
    document
      .querySelector(`.region-card[data-preset="${state.selectedPreset}"]`)
      ?.classList.add("selected");
  }
  showStep(2);
});

/* ---- step 2: region preset ---- */

$$(".region-card").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".region-card").forEach((b) =>
      b.classList.remove("selected")
    );
    btn.classList.add("selected");
    state.selectedPreset = btn.dataset.preset;
  });
});

$("next2").addEventListener("click", async () => {
  if (state.selectedPreset && PRESETS[state.selectedPreset]) {
    await window.GOGPlusStorage.set({
      ...PRESETS[state.selectedPreset],
      regionPreset: state.selectedPreset,
      taxEstimator:
        state.selectedPreset !== "none" && PRESETS[state.selectedPreset].vatPercent > 0,
    });
  }
  showStep(3);
});

/* ---- step 3: features ---- */

$("next3").addEventListener("click", async () => {
  const features = {
    designInjection: $("f-design").checked,
    drmFreeBanner: $("f-banner").checked,
    refundBadge: $("f-refund").checked,
    modIndicator: $("f-mods").checked,
    priceHistoryTracking: $("f-history").checked,
    itadCompare: $("f-itad").checked,
    wishlistAlerts: $("f-wlAlerts").checked,
    customTags: $("f-tags").checked,
    hebrewTranslations: $("f-hebrew").checked,
    rtlLayout: $("f-rtl").checked,
    enabled: true,
  };
  await window.GOGPlusStorage.set(features);
  // Pre-select default theme on entry
  document.querySelector('.theme-card[data-theme="neon"]')?.classList.add("selected");
  state.selectedTheme = "neon";
  showStep(4);
});

/* ---- step 4: theme ---- */

$$(".theme-card").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".theme-card").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    state.selectedTheme = btn.dataset.theme;
  });
});

$("finish").addEventListener("click", async () => {
  await window.GOGPlusStorage.set({
    theme: state.selectedTheme || "neon",
    onboardingComplete: true,
  });
  showStep(5);
});

/* ---- back buttons ---- */

$$('[data-action="back"]').forEach((btn) => {
  btn.addEventListener("click", () => {
    if (state.currentStep > 1) showStep(state.currentStep - 1);
  });
});

// Init
window.GOGPlusStorage.get({ uiLanguage: "en" }).then((s) => {
  window.GOGPlusI18n?.apply(s.uiLanguage || "en");
});
const versionEl = $("onboardingVersion");
if (versionEl) versionEl.textContent = `v${chrome.runtime.getManifest().version}`;
showStep(1);

$("closeBtn")?.addEventListener("click", () => {
  window.close();
});
