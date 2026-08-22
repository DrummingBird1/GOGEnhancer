/**
 * GOG+ content script orchestrator (v2.8.0+, post module-split).
 *
 * Was a single ~1560-line file through v2.7.0; the individual features are
 * now content/state.js, content/utils.js, and content/features/*.js — see
 * CLAUDE.md's content-script load-order section for the full list and why
 * the split needed a shared `state` module instead of one big closure.
 * This file is left with only what's genuinely orchestration: running every
 * feature once, deciding when to re-run (the Angular SPA's DOM mutates
 * constantly), loading/watching settings, and boot.
 */

(() => {
  "use strict";

  const DEFAULTS = window.GOG_PLUS_DEFAULTS;
  const state = window.GOGPlusContentState;
  const { debounce, log, slugFromHref } = window.GOGPlusContentUtils;
  const { applyCurrencyConversion, convertedFromCurrency, fxFreshness } =
    window.GOGPlusCurrencyFeature;
  const { applyCardBadges, buildMiniSparkline } = window.GOGPlusCardBadges;
  const { hideExpiredSales, ensureDrmFreeBanner, applyHebrewTranslations, applyRtlLayout } =
    window.GOGPlusMiscFeatures;
  const { ensureWishlistFilters } = window.GOGPlusWishlistFeature;
  const { enhanceGamePage } = window.GOGPlusGamePage;

  /* ============== orchestration ============== */

  function processAll() {
    if (!state.settings.enabled) {
      document.documentElement.classList.add("gog-plus-disabled");
      // Also remove visual classes so the disabled state is truly inert.
      document.documentElement.classList.remove(
        "gog-plus-design",
        "gog-plus-clean",
        "gog-plus-skeletons",
        "gog-plus-rtl"
      );
      return;
    }
    document.documentElement.classList.remove("gog-plus-disabled");

    document.documentElement.classList.toggle("gog-plus-design", !!state.settings.designInjection);
    document.documentElement.classList.toggle("gog-plus-clean", !!state.settings.cleanLayout);
    document.documentElement.classList.toggle(
      "gog-plus-skeletons",
      !!state.settings.skeletonLoaders
    );

    // Theme: strip prior theme- class then add the current one. "neon" is the
    // CSS default so applying it is a no-op but kept for explicitness.
    [...document.documentElement.classList]
      .filter((c) => c.startsWith("gog-plus-theme--"))
      .forEach((c) => document.documentElement.classList.remove(c));
    const theme = state.settings.theme || "neon";
    document.documentElement.classList.add(`gog-plus-theme--${theme}`);

    try {
      state.pageCurrency = window.GOGPlusCurrency.detect();
      ensureDrmFreeBanner();
      applyRtlLayout();
      applyCurrencyConversion();
      applyCardBadges();
      hideExpiredSales();
      applyHebrewTranslations();
      ensureWishlistFilters();
      enhanceGamePage();
    } catch (e) {
      log("processAll error", e);
    }
  }

  const scheduleProcess = debounce(processAll, 250);

  function startObserving() {
    state.observers.forEach((o) => o.disconnect());
    state.observers = [];

    // Targeted observation: main content area only
    const targets = [
      document.querySelector("main"),
      document.querySelector("[ng-view]"),
      document.body,
    ].filter(Boolean);

    const root = targets[0];
    const obs = new MutationObserver(() => scheduleProcess());
    obs.observe(root, { childList: true, subtree: true });
    state.observers.push(obs);
  }

  /* ============== settings load + change handling ============== */

  async function loadSettings() {
    const saved = await window.GOGPlusStorage.get(DEFAULTS);
    state.settings = {
      ...DEFAULTS,
      ...saved,
      rates: { ...DEFAULTS.rates, ...(saved.rates || {}) },
    };
  }

  window.GOGPlusStorage.onChange(async ({ key, newValue }) => {
    state.settings[key] = newValue;

    // Clear "done" markers so re-processing re-applies on existing nodes
    document
      .querySelectorAll(
        ".gog-plus-card-done, .gog-plus-promo-done, .gog-plus-converted, .gog-plus-translated"
      )
      .forEach((el) => {
        el.classList.remove(
          "gog-plus-card-done",
          "gog-plus-promo-done",
          "gog-plus-converted",
          "gog-plus-translated"
        );
      });
    document
      .querySelectorAll(".gog-plus-conv-note, .gog-plus-badges, .gog-plus-tag-dot")
      .forEach((el) => el.remove());
    // Strip era-aware cover classes so toggling designInjection off doesn't
    // leave classic-CRT or neon-glow effects stuck on existing cards.
    document
      .querySelectorAll(".gog-plus-cover--classic, .gog-plus-cover--neon, [class*='gog-plus-cover--genre-']")
      .forEach((el) => {
        [...el.classList]
          .filter((c) => c === "gog-plus-cover--classic" || c === "gog-plus-cover--neon" || c.startsWith("gog-plus-cover--genre-"))
          .forEach((c) => el.classList.remove(c));
      });
    document.getElementById("gog-plus-gamepanel")?.remove();
    document.getElementById("gog-plus-wlfilters")?.remove();

    processAll();

    // Toast
    const friendlyNames = {
      enabled: "GOG Enhancer",
      hebrewTranslations: "Hebrew translations",
      rtlLayout: "RTL layout",
      drmFreeBanner: "DRM-free banner",
      refundBadge: "Refund badge",
      modIndicator: "Mod indicator",
      hideExpiredSales: "Expired sales filter",
      cleanLayout: "Clean layout",
      designInjection: "Design upgrades",
      priceHistoryTracking: "Price history",
      itadCompare: "ITAD compare",
      currencyConverter: "Currency converter",
      taxEstimator: "VAT estimator",
      customTags: "Custom tags",
      wishlistFilters: "Wishlist filters",
    };
    if (key in friendlyNames && typeof newValue === "boolean") {
      window.GOGPlusToasts?.show(
        `${friendlyNames[key]} ${newValue ? "enabled" : "disabled"}`,
        { variant: newValue ? "default" : "muted" }
      );
    }
  });

  // Test-only surface. Individual functions live in content/features/*.js
  // now (see the split above) — this re-assembles the same external shape
  // tests/content-internals.test.js and tests/apply-card-badges.test.js
  // already depend on, so those test files needed no changes for the split.
  if (typeof window !== "undefined") {
    window.GOGPlusContentInternals = {
      slugFromHref,
      buildMiniSparkline,
      convertedFromCurrency,
      fxFreshness,
      applyCardBadges,
      __setSettingsForTest: (s) => {
        state.settings = { ...DEFAULTS, ...s };
      },
    };
  }

  /* ============== boot ============== */

  loadSettings().then(() => {
    processAll();
    startObserving();
    log("ready", state.settings);
  });
})();
