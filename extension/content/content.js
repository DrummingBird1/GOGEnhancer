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
// @ts-check

(() => {
  "use strict";

  const DEFAULTS = window.GOG_PLUS_DEFAULTS;
  const state = window.GOGPlusContentState;
  const { debounce, log, slugFromHref, slugFromLocation } = window.GOGPlusContentUtils;
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
    // "auto" isn't a real CSS variant — it resolves to "light" or "neon"
    // (the dark default) from the OS preference at apply time.
    [...document.documentElement.classList]
      .filter((c) => c.startsWith("gog-plus-theme--"))
      .forEach((c) => document.documentElement.classList.remove(c));
    let theme = state.settings.theme || "neon";
    if (theme === "auto") {
      theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "neon";
    }
    // "native" has no palette of its own: it samples the live page and writes
    // the --gp-* vars inline (see content/native-theme.js). The class it adds
    // is the dark/light base for the colours it doesn't override — and if the
    // page can't be sampled it quietly behaves like the default theme.
    // Cleared first so a previous theme's inline vars never leak into the next.
    window.GOGPlusNativeTheme.clear();
    if (theme === "native") {
      const native = window.GOGPlusNativeTheme.apply();
      document.documentElement.classList.add("gog-plus-theme--native");
      if (native && !native.isDark) document.documentElement.classList.add("gog-plus-theme--light");
    } else {
      document.documentElement.classList.add(`gog-plus-theme--${theme}`);
    }
    // Custom theme colors are applied as inline vars, not a CSS class — see
    // the identical comment in options.js's applyThemeClassToHtml. Must be
    // explicitly cleared on every other theme or they'd keep overriding it
    // (the clear() above already removed them for every non-custom theme).
    const customColors = state.settings.customThemeColors;
    if (theme === "custom" && customColors) {
      document.documentElement.style.setProperty("--gp-magenta", customColors.magenta);
      document.documentElement.style.setProperty("--gp-cyan", customColors.cyan);
      document.documentElement.style.setProperty("--gp-bg", customColors.bg);
    }
    document.documentElement.classList.toggle(
      "gog-plus-dyslexia-font",
      !!state.settings.dyslexiaFont
    );

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

  /** @type {MutationObserver | null} */
  let rootObserver = null;

  function startObserving() {
    // Only this observer is replaced — state.observers also holds the
    // wishlist bar's own live-count observer, which must survive a re-bind.
    rootObserver?.disconnect();
    state.observers = state.observers.filter((o) => o !== rootObserver);

    // Watch <body>, not <main>: an SPA can swap <main> out wholesale on
    // navigation, and an observer bound to the old node would be left
    // watching a detached tree — the extension would silently stop reacting,
    // with no event anywhere to tell it so. But header/footer churn (a ticking
    // countdown, a cart badge) doesn't need a full pass, so records are
    // filtered down to ones inside the content root, or on an ancestor of it
    // (which is where a swapped <main> shows up).
    rootObserver = new MutationObserver((records) => {
      const root = window.GOGPlusGogDom.spaRoot();
      if (root === document.body || records.some((r) => root.contains(r.target) || r.target.contains(root))) {
        scheduleProcess();
      }
    });
    rootObserver.observe(document.body, { childList: true, subtree: true });
    state.observers.push(rootObserver);
  }

  // Per-page UI must not outlive its page: a client-side navigation doesn't
  // reload the content script, so nothing else would ever remove it.
  function onRouteChange() {
    const panel = document.getElementById("gog-plus-gamepanel");
    if (panel && panel.dataset.slug !== slugFromLocation()) panel.remove();
    if (!location.pathname.includes("/account/wishlist")) {
      document.getElementById("gog-plus-wlfilters")?.remove();
    }
    scheduleProcess();
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

  // Re-resolve the "auto" theme immediately when the OS preference flips —
  // otherwise it would only update on the next unrelated re-process.
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (state.settings.theme === "auto") processAll();
  });

  /* ============== boot ============== */

  // The options page's "Check this page" button asks the active gog.com tab
  // what each lookup found (see GOGPlusGogDom.diagnose).
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "gog-plus-diagnose") sendResponse(window.GOGPlusGogDom.diagnose());
  });

  loadSettings().then(() => {
    processAll();
    startObserving();
    window.GOGPlusGogDom.watchRoute(onRouteChange);
    window.GOGPlusKeyboardNav.init();
    log("ready", state.settings);
  });
})();
