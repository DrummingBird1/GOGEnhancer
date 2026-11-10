/**
 * GOG+ rich tooltips.
 *
 * Listen for hover on any element with [data-gog-plus-tip] and show a
 * styled tooltip. Content is HTML; supports multiline.
 *
 * Usage:
 *   element.dataset.gogPlusTip = "<strong>Title</strong><br>Some detail";
 *
 * One global tooltip element is reused.
 */
// @ts-check

(() => {
  "use strict";

  let tip = null;
  let target = null;
  let showTimer = null;
  let hideTimer = null;

  function ensureEl() {
    if (tip) return tip;
    tip = document.createElement("div");
    tip.className = "gog-plus-tooltip";
    tip.setAttribute("role", "tooltip");
    tip.style.opacity = "0";
    tip.style.pointerEvents = "none";
    document.body.appendChild(tip);
    return tip;
  }

  function position(el) {
    if (!tip) return;
    const r = el.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();

    let left = r.left + r.width / 2 - tr.width / 2;
    let top = r.bottom + 8;
    if (left < 8) left = 8;
    if (left + tr.width > window.innerWidth - 8) {
      left = window.innerWidth - tr.width - 8;
    }
    if (top + tr.height > window.innerHeight - 8) {
      top = r.top - tr.height - 8;
      tip.classList.add("gog-plus-tooltip--above");
    } else {
      tip.classList.remove("gog-plus-tooltip--above");
    }
    tip.style.left = `${left + window.scrollX}px`;
    tip.style.top = `${top + window.scrollY}px`;
  }

  // The tooltip text sits in a DOM attribute, which the page (or anything that
  // got markup into it) can also write — so it is never handed to innerHTML as
  // is. It is parsed into an inert template and rebuilt from a short list of
  // formatting tags; every attribute, script, image and link is dropped.
  const ALLOWED = new Set(["STRONG", "B", "EM", "I", "BR", "SMALL", "SPAN", "DIV"]);
  const CLASS_OK = /^gog-plus-[a-z0-9 _-]{0,80}$/;

  /**
   * @param {Node} from
   * @param {Node} into
   */
  function copySafe(from, into) {
    for (const node of Array.from(from.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        into.appendChild(document.createTextNode(node.textContent || ""));
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = /** @type {Element} */ (node);
        if (ALLOWED.has(el.tagName)) {
          const clean = document.createElement(el.tagName.toLowerCase());
          // The one attribute that survives: the extension's own style classes.
          const cls = el.getAttribute("class");
          if (cls && CLASS_OK.test(cls)) clean.setAttribute("class", cls);
          copySafe(el, clean);
          into.appendChild(clean);
        } else {
          // Unknown element: keep its text, lose the element.
          copySafe(el, into);
        }
      }
    }
  }

  /** @param {string} html @returns {DocumentFragment} */
  function safeFragment(html) {
    const tpl = document.createElement("template");
    tpl.innerHTML = html;
    const out = document.createDocumentFragment();
    copySafe(tpl.content, out);
    return out;
  }

  function show(el) {
    const content = el.dataset.gogPlusTip;
    if (!content) return;
    ensureEl();
    tip.replaceChildren(safeFragment(content));
    tip.style.opacity = "1";
    tip.style.transform = "translateY(0)";
    target = el;
    position(el);
  }

  function hide() {
    if (!tip) return;
    tip.style.opacity = "0";
    tip.style.transform = "translateY(4px)";
    target = null;
  }

  document.addEventListener("mouseover", (e) => {
    const el = /** @type {Element} */ (e.target).closest("[data-gog-plus-tip]");
    if (!el || el === target) return;
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    showTimer = setTimeout(() => show(el), 250);
  });

  document.addEventListener("mouseout", (e) => {
    const el = /** @type {Element} */ (e.target).closest("[data-gog-plus-tip]");
    if (!el) return;
    clearTimeout(showTimer);
    hideTimer = setTimeout(hide, 100);
  });

  document.addEventListener("scroll", hide, { passive: true });
  window.addEventListener("blur", hide);

  window.GOGPlusTooltips = { show, hide, safeFragment };
})();
