/**
 * The extension's own text inside gog.com pages (the insights panel, the bars, the
 * dialogs, the toasts) in the interface language. The engine is the one the options
 * page and the dashboard use (lib/i18n-pages.js, rows in lib/i18n-pages-content.js);
 * what differs is the scope: the page belongs to gog.com, so ONLY the extension's
 * own elements — those whose class or id starts with `gog-plus-` — are ever touched,
 * and what users wrote (tag names, notes) or the site printed is left alone.
 *
 *   window.GOGPlusUiI18n.init()      translate what is there and what appears later
 *   window.GOGPlusUiI18n.tx(text)    one string, for text assembled in code
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusContentState;
  const OWN = '[class*="gog-plus-"], [id^="gog-plus-"]';

  const lang = () => (state && state.settings && state.settings.uiLanguage) || "en";
  const engine = () => window.GOGPlusPageI18n;

  /** The outermost extension element a node sits in (or is), or null for the site's own DOM. @param {Node} node */
  function ownRoot(node) {
    const el = node.nodeType === 1 ? /** @type {Element} */ (node) : node.parentElement;
    if (!el || !el.closest) return null;
    let root = el.closest(OWN);
    while (root && root.parentElement && root.parentElement.closest(OWN)) root = root.parentElement.closest(OWN);
    return root;
  }

  /** @type {Set<Element>} */
  let pending = new Set();
  let scheduled = false;
  /** @type {MutationObserver | null} */
  let observer = null;

  function flush() {
    scheduled = false;
    const roots = [...pending];
    pending = new Set();
    const l = lang();
    if (l === "en" || !engine()) return;
    for (const r of roots) if (r.isConnected) engine().translateTree(r, l);
  }

  /** @param {MutationRecord[]} records */
  function onMutations(records) {
    for (const rec of records) {
      const target = rec.target;
      if (rec.type === "childList") {
        // Only what the extension itself drew: a node added inside, or an own element added.
        const own = ownRoot(target);
        if (own) pending.add(own);
        else for (const n of rec.addedNodes) if (n.nodeType === 1) { const r = ownRoot(n); if (r) pending.add(r); }
      } else if (rec.type === "attributes") {
        const own = ownRoot(target);
        if (own) pending.add(own);
      }
    }
    if (pending.size && !scheduled) {
      scheduled = true;
      setTimeout(flush, 30);
    }
  }

  function init() {
    if (lang() === "en" || !engine() || observer) return;
    for (const el of document.querySelectorAll(OWN)) { const r = ownRoot(el); if (r) pending.add(r); }
    flush();
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["title", "aria-label", "placeholder"] });
  }

  /** @param {string} text */
  function tx(text) {
    const l = lang();
    return l === "en" || !engine() ? text : engine().tx(text, l);
  }

  window.GOGPlusUiI18n = { init, tx, _flush: flush };
})();
