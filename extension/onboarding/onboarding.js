/**
 * GOG+ onboarding wizard logic.
 *
 * Steps:
 *   1 — pick currency
 *   2 — pick region preset (sets VAT)
 *   3 — toggle features
 *   4 — done
 */

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
  document.querySelectorAll(".step").forEach((el) => {
    el.classList.toggle("active", parseInt(el.dataset.step, 10) === n);
  });
  document.querySelectorAll(".step-dot").forEach((dot) => {
    const i = parseInt(dot.dataset.step, 10);
    dot.classList.toggle("active", i === n);
    dot.classList.toggle("done", i < n);
  });
  state.currentStep = n;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---- step 1: currency ---- */

document.querySelectorAll(".currency-card").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".currency-card").forEach((b) =>
      b.classList.remove("selected")
    );
    btn.classList.add("selected");
    state.selectedCurrency = btn.dataset.cur;
    document.getElementById("next1").disabled = false;

    // Auto-pick a sensible region for the chosen currency
    const map = { ILS: "il", EUR: "eu", GBP: "uk", PLN: "pl", USD: "us" };
    if (map[state.selectedCurrency]) {
      state.selectedPreset = map[state.selectedCurrency];
    }
  });
});

document.getElementById("next1").addEventListener("click", async () => {
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

document.querySelectorAll(".region-card").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".region-card").forEach((b) =>
      b.classList.remove("selected")
    );
    btn.classList.add("selected");
    state.selectedPreset = btn.dataset.preset;
  });
});

document.getElementById("next2").addEventListener("click", async () => {
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

document.getElementById("next3").addEventListener("click", async () => {
  const features = {
    designInjection: document.getElementById("f-design").checked,
    drmFreeBanner: document.getElementById("f-banner").checked,
    refundBadge: document.getElementById("f-refund").checked,
    modIndicator: document.getElementById("f-mods").checked,
    priceHistoryTracking: document.getElementById("f-history").checked,
    itadCompare: document.getElementById("f-itad").checked,
    wishlistAlerts: document.getElementById("f-wlAlerts").checked,
    customTags: document.getElementById("f-tags").checked,
    hebrewTranslations: document.getElementById("f-hebrew").checked,
    rtlLayout: document.getElementById("f-rtl").checked,
    enabled: true,
  };
  await window.GOGPlusStorage.set(features);
  // Pre-select default theme on entry
  document.querySelector('.theme-card[data-theme="neon"]')?.classList.add("selected");
  state.selectedTheme = "neon";
  showStep(4);
});

/* ---- step 4: theme ---- */

document.querySelectorAll(".theme-card").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".theme-card").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    state.selectedTheme = btn.dataset.theme;
  });
});

document.getElementById("finish").addEventListener("click", async () => {
  await window.GOGPlusStorage.set({
    theme: state.selectedTheme || "neon",
    onboardingComplete: true,
  });
  showStep(5);
});

/* ---- back buttons ---- */

document.querySelectorAll('[data-action="back"]').forEach((btn) => {
  btn.addEventListener("click", () => {
    if (state.currentStep > 1) showStep(state.currentStep - 1);
  });
});

// Init
window.GOGPlusStorage.get({ uiLanguage: "en" }).then((s) => {
  window.GOGPlusI18n?.apply(s.uiLanguage || "en");
});
showStep(1);

document.getElementById("closeBtn")?.addEventListener("click", () => {
  window.close();
});
