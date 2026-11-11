/**
 * GOG+ currency conversion feature (page-side price conversion, VAT
 * estimation, FX freshness). Pulled out of the former single-file
 * content.js during the module split.
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusContentState;
  const { formatPrice } = window.GOGPlusCurrencyFormat;

  function priceInUsdFromText(txt) {
    const sym = state.pageCurrency.symbol;
    if (!sym || !txt) return null;
    const group = window.GOGPlusCurrency.symbolGroup(state.pageCurrency.code);
    const matches = txt.match(new RegExp(`${group}\\s?[\\d.,]+|\\d[\\d.,]*\\s?${group}`, "gu"));
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

  /** What a converted element shows, without the note the extension added to it. */
  function plainText(/** @type {Element} */ host) {
    const clone = /** @type {Element} */ (host.cloneNode(true));
    clone.querySelectorAll(".gog-plus-conv-note").forEach((n) => n.remove());
    return (clone.textContent || "").replace(/\s+/g, " ").trim();
  }

  /**
   * The site can change a price in place (a discount applied, another region):
   * a note computed from the old text would stay next to the new one. Drop it
   * so the pass below converts the new text.
   */
  function dropStaleNotes(/** @type {ParentNode} */ root) {
    for (const host of /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll(".gog-plus-converted"))) {
      if (host.dataset.gpSrc === undefined || host.dataset.gpSrc === plainText(host)) continue;
      host.querySelectorAll(":scope > .gog-plus-conv-note").forEach((n) => n.remove());
      host.classList.remove("gog-plus-converted");
      delete host.dataset.gpSrc;
    }
  }

  function applyCurrencyConversion(root = document) {
    if (!state.settings.currencyConverter || state.settings.targetCurrency === "none") return;
    if (state.pageCurrency.code === state.settings.targetCurrency) return; // already in target
    dropStaleNotes(root);

    const srcSym = state.pageCurrency.symbol;
    if (!srcSym) return;
    const group = window.GOGPlusCurrency.symbolGroup(state.pageCurrency.code);
    const symRe = new RegExp(`${group}[\\s\\u00a0]?\\d|\\d[\\s\\u00a0]?${group}`, "u");
    // "1 097,99": groups of three separated by a space / non-breaking space are one number.
    const NUM = "\\d[\\d.,]*(?:[\\s\\u00a0\\u202f]\\d{3}(?:[.,]\\d+)?)*";
    const priceOnlyRe = new RegExp(
      `^\\s*(?:${group}[\\s\\u00a0]?${NUM}|${NUM}[\\s\\u00a0]?${group})\\s*$`,
      "u"
    );

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.length > 80) return NodeFilter.FILTER_REJECT;
        if (!symRe.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.classList.contains("gog-plus-converted")) return NodeFilter.FILTER_REJECT;
        if (parent.closest(".gog-plus-banner, .gog-plus-tooltip, .gog-plus-toasts"))
          return NodeFilter.FILTER_REJECT;
        // Everything else the extension injects (the filter bars, the insights
        // panel, dialogs) already shows what it means to show — converting its
        // text again would put a "≈ ₪36" next to the "< $10" filter label.
        if (window.GOGPlusGogDom.isSiteElement && !window.GOGPlusGogDom.isSiteElement(parent))
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

    let converted = 0;
    const convertInto = (/** @type {Element} */ host, /** @type {string} */ text) => {
      const price = window.GOGPlusCurrency.parsePrice(text, state.pageCurrency.code);
      if (!price) return;
      const value = convertedFromCurrency(price, state.pageCurrency.code);
      if (value === null) return;

      const note = document.createElement("span");
      note.className = "gog-plus-conv-note";
      note.textContent = ` ≈ ${formatPrice(value, state.settings.targetCurrency)}`;
      // Click the converted amount to copy it (e.g. for a spreadsheet). The click
      // is swallowed so it doesn't also open the game tile it sits inside.
      const copyText = formatPrice(value, state.settings.targetCurrency);
      note.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard?.writeText(copyText).then(
          () => window.GOGPlusToasts?.show(`Copied ${copyText}`),
          () => window.GOGPlusToasts?.show("Couldn't reach the clipboard", { variant: "muted" })
        );
      });
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
          <strong>Conversion details</strong> <small>· click to copy</small><br>
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
      host.classList.add("gog-plus-converted");
      /** @type {HTMLElement} */ (host).dataset.gpSrc = plainText(host);
      host.appendChild(note);
      converted++;
    };

    for (const node of targets) {
      convertInto(/** @type {Element} */ (node.parentElement), node.nodeValue || "");
    }

    // Second pass: prices split across child elements (<i>$</i>19.99) never
    // match symRe inside a single text node, so the walker above can't see
    // them. Look at whole price-like elements instead — but only ones whose
    // ENTIRE text is one price, and never one that already holds (or sits
    // inside) a converted node, so nothing is converted twice.
    for (const el of window.GOGPlusGogDom.findPriceNodes(root).nodes) {
      if (el.closest(".gog-plus-converted, .gog-plus-banner, .gog-plus-tooltip, .gog-plus-toasts")) continue;
      if (el.querySelector(".gog-plus-converted, .gog-plus-conv-note")) continue;
      // displayText() puts back a symbol the site prints with CSS (game-page
      // prices are a bare "2.99" in the DOM), which the text-node pass can
      // never see.
      const text = window.GOGPlusGogDom.displayText(el);
      if (text.length > 24 || !priceOnlyRe.test(text)) continue;
      convertInto(el, text);
    }

    if (converted > 0) {
      window.GOGPlusAnnounce?.once(
        `converted:${location.pathname}`,
        `Prices on this page are also shown in ${state.settings.targetCurrency}, as approximate conversions.`
      );
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
