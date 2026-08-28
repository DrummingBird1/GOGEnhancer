/**
 * GOG+ small independent content-script features: hide expired sales,
 * the DRM-free banner, Hebrew translations, and RTL layout. Pulled out of
 * the former single-file content.js during the v2.8.0 module split.
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusContentState;

  /* ============== hide expired sales ============== */

  function hideExpiredSales(root = document) {
    if (!state.settings.hideExpiredSales) return;
    const candidates = root.querySelectorAll(
      'a[href*="/promo/"]:not(.gog-plus-promo-done)'
    );
    const currentYear = new Date().getFullYear();
    candidates.forEach((el) => {
      el.classList.add("gog-plus-promo-done");
      // Match year only when it sits inside the URL slug — between separators
      // or at a path boundary. Card text often mentions years for unrelated
      // reasons ("top games of 2024") and would false-flag live promos.
      const href = (el.getAttribute("href") || "").toLowerCase();
      const yearMatch = href.match(/(?:^|[-_/])(20\d{2})(?:[-_/]|$)/);
      if (yearMatch) {
        const y = parseInt(yearMatch[1], 10);
        if (y < currentYear) {
          el.classList.add("gog-plus-expired");
          /** @type {HTMLElement} */ (el).title = "This sale appears to have ended.";
        }
      }
    });
  }

  /* ============== DRM-free banner ============== */

  function ensureDrmFreeBanner() {
    if (!state.settings.drmFreeBanner) {
      document.getElementById("gog-plus-banner")?.remove();
      return;
    }
    if (document.getElementById("gog-plus-banner")) return;

    const banner = document.createElement("div");
    banner.id = "gog-plus-banner";
    banner.className = "gog-plus-banner";
    banner.innerHTML = `
      <div class="gog-plus-banner-inner">
        <span class="gog-plus-banner-shield" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path d="M12 2L4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5l-8-3z"
              fill="none" stroke="currentColor" stroke-width="1.6"
              stroke-linejoin="round"/>
            <path d="M8 12l3 3 5-6" fill="none" stroke="currentColor"
              stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="gog-plus-banner-text">
          <strong>You own what you buy.</strong>
          DRM-free installers · 30-day refund · Offline-capable · No platform lock-in
        </span>
        <span class="gog-plus-banner-pill">GOG Enhancer</span>
        <button class="gog-plus-banner-close" aria-label="Dismiss">×</button>
      </div>`;
    banner.querySelector(".gog-plus-banner-close").addEventListener("click", () => {
      window.GOGPlusStorage.set({ drmFreeBanner: false });
    });
    document.body.prepend(banner);
  }

  /* ============== Hebrew + RTL ============== */

  function applyHebrewTranslations(root = document) {
    if (!state.settings.hebrewTranslations) return;
    const dict = (window.GOG_PLUS_TRANSLATIONS || {}).exact || {};
    const patterns = (window.GOG_PLUS_TRANSLATIONS || {}).patterns || [];
    if (!Object.keys(dict).length && !patterns.length) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("script,style,code,pre,textarea,input"))
          return NodeFilter.FILTER_REJECT;
        if (parent.closest(".gog-plus-tooltip, .gog-plus-toasts"))
          return NodeFilter.FILTER_REJECT;
        if (parent.classList.contains("gog-plus-translated")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const targets = [];
    let n;
    while ((n = walker.nextNode())) targets.push(n);

    for (const node of targets) {
      const trimmed = node.nodeValue.trim();
      if (dict[trimmed]) {
        node.nodeValue = node.nodeValue.replace(trimmed, dict[trimmed]);
        node.parentElement?.classList.add("gog-plus-translated");
        continue;
      }
      for (const { re, fmt } of patterns) {
        const m = trimmed.match(re);
        if (m) {
          let out = fmt;
          for (let i = 1; i < m.length; i++) out = out.replace(`$${i}`, m[i]);
          node.nodeValue = node.nodeValue.replace(trimmed, out);
          node.parentElement?.classList.add("gog-plus-translated");
          break;
        }
      }
    }
  }

  function applyRtlLayout() {
    document.documentElement.classList.toggle("gog-plus-rtl", !!state.settings.rtlLayout);
  }

  window.GOGPlusMiscFeatures = {
    hideExpiredSales,
    ensureDrmFreeBanner,
    applyHebrewTranslations,
    applyRtlLayout,
  };
})();
