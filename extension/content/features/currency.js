/**
 * GOG+ currency conversion feature (page-side price conversion, VAT
 * estimation, FX freshness). Pulled out of the former single-file
 * content.js during the v2.8.0 module split.
 */

(() => {
  "use strict";

  const state = window.GOGPlusContentState;
  const { formatPrice } = window.GOGPlusCurrencyFormat;

  function priceInUsdFromText(txt) {
    const sym = state.pageCurrency.symbol;
    if (!sym || !txt) return null;
    const escSym = sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = txt.match(new RegExp(escSym + "\\s?[\\d.,]+", "g"));
    if (!matches?.length) return null;
    const native = window.GOGPlusCurrency.parsePrice(
      matches[matches.length - 1],
      state.pageCurrency.code
    );
    if (native == null) return null;
    if (state.pageCurrency.code === "USD") return native;
    const rate = state.settings.rates[state.pageCurrency.code];
    return rate ? native / rate : null;
  }

  function convertedFromCurrency(amount, srcCur, s = state.settings) {
    const targetCur = s.targetCurrency;
    if (!targetCur || targetCur === "none") return null;
    if (srcCur === targetCur) return null;
    const srcRate = srcCur === "USD" ? 1 : s.rates[srcCur];
    const tgtRate = targetCur === "USD" ? 1 : s.rates[targetCur];
    if (!srcRate || !tgtRate) return null;
    let v = (amount / srcRate) * tgtRate;
    if (s.taxEstimator && s.vatPercent > 0) {
      v *= 1 + s.vatPercent / 100;
    }
    return v;
  }

  function applyCurrencyConversion(root = document) {
    if (!state.settings.currencyConverter || state.settings.targetCurrency === "none") return;
    if (state.pageCurrency.code === state.settings.targetCurrency) return; // already in target

    const srcSym = state.pageCurrency.symbol;
    if (!srcSym) return;
    const escSym = srcSym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const symRe = new RegExp(escSym + "\\s?\\d");

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.length > 80) return NodeFilter.FILTER_REJECT;
        if (!symRe.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.classList.contains("gog-plus-converted")) return NodeFilter.FILTER_REJECT;
        if (parent.closest(".gog-plus-banner, .gog-plus-tooltip, .gog-plus-toasts"))
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const targets = [];
    let n;
    while ((n = walker.nextNode())) targets.push(n);

    // FX freshness — computed once per pass. Drives the "stale rate" tint (#01)
    // and the rate-provenance line in the tooltip (#02). Rates older than 48h,
    // never-fetched (bundled), or whose last refresh errored are flagged stale.
    const info = fxFreshness();
    const tgtCur = state.settings.targetCurrency;
    const tgtRate = tgtCur === "USD" ? 1 : state.settings.rates[tgtCur];

    for (const node of targets) {
      const price = window.GOGPlusCurrency.parsePrice(node.nodeValue, state.pageCurrency.code);
      if (!price) continue;
      const value = convertedFromCurrency(price, state.pageCurrency.code);
      if (value === null) continue;

      const note = document.createElement("span");
      note.className = "gog-plus-conv-note";
      note.textContent = ` ≈ ${formatPrice(value, state.settings.targetCurrency)}`;
      if (state.settings.taxEstimator && state.settings.vatPercent > 0) {
        note.classList.add("gog-plus-with-tax");
      }
      if (info.stale) note.classList.add("gog-plus-conv-note--stale");
      if (state.settings.richTooltips) {
        const taxLine =
          state.settings.taxEstimator && state.settings.vatPercent > 0
            ? `<br>+${state.settings.vatPercent}% VAT included`
            : "";
        const rateLine = tgtRate
          ? `<br><span class="gog-plus-tip-rate">Rate: 1 USD = ${tgtRate} ${tgtCur} · updated ${info.label}</span>`
          : "";
        const staleLine = info.stale
          ? `<br><span class="gog-plus-tip-warn">⚠ ${
              state.settings.lastFxError
                ? "Last rate update failed — value may be off."
                : "Rate may be out of date."
            }</span>`
          : "";
        note.dataset.gogPlusTip = `
          <strong>Conversion details</strong><br>
          ${formatPrice(price, state.pageCurrency.code)} ${state.pageCurrency.code} → ${formatPrice(
            value,
            state.settings.targetCurrency
          )}${taxLine}${rateLine}${staleLine}
        `;
      } else {
        note.title = `${formatPrice(price, state.pageCurrency.code)} → ${formatPrice(
          value,
          state.settings.targetCurrency
        )} (rate ${info.label}${info.stale ? ", may be stale" : ""})`;
      }
      node.parentElement.classList.add("gog-plus-converted");
      node.parentElement.appendChild(note);
    }
  }

  function fxFreshness(s = state.settings, now = Date.now()) {
    const FX_STALE_MS = 48 * 60 * 60 * 1000;
    const age = s.ratesUpdatedAt ? now - s.ratesUpdatedAt : null;
    const stale = !!s.lastFxError || age === null || age > FX_STALE_MS;
    let label;
    if (age === null) label = "bundled rates";
    else if (age < 3600e3) label = `${Math.max(1, Math.round(age / 60e3))} min ago`;
    else if (age < 86400e3) label = `${Math.round(age / 3600e3)}h ago`;
    else label = `${Math.round(age / 86400e3)}d ago`;
    return { stale, label };
  }

  window.GOGPlusCurrencyFeature = {
    priceInUsdFromText,
    convertedFromCurrency,
    applyCurrencyConversion,
    fxFreshness,
  };
})();
