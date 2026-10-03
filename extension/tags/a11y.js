/**
 * GOG+ dashboard accessibility helpers — the keyboard and screen-reader side
 * of the popovers the tag dashboard opens.
 *
 *   trapFocus(container, { onEscape })   keep Tab inside a dialog; Escape closes it
 *   menu(menuEl, opener)                 make a list of buttons a real menu: roles,
 *                                        arrow keys, Home/End, Escape, focus handed
 *                                        back to the button that opened it
 *   announce(text)                       tell a screen reader something changed
 *
 * Every function is optional for the code that uses it (`window.GOGPlusTagsA11y?.`)
 * so a page or test that doesn't load this file simply behaves as before.
 */
// @ts-check

(() => {
  "use strict";

  const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

  /**
   * What Tab can reach inside `container` right now.
   * @param {Element} container
   * @returns {HTMLElement[]}
   */
  function focusables(container) {
    return /** @type {HTMLElement[]} */ ([...container.querySelectorAll(FOCUSABLE)]).filter(
      (el) => !el.closest("[hidden]") && !(/** @type {any} */ (el).disabled) && el.getAttribute("type") !== "hidden" && el.tabIndex !== -1
    );
  }

  /**
   * @param {HTMLElement} container
   * @param {{ onEscape?: () => void }} [opts]
   * @returns {() => void} release
   */
  function trapFocus(container, opts = {}) {
    /** @param {KeyboardEvent} e */
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        opts.onEscape?.();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables(container);
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !container.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !container.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    container.addEventListener("keydown", onKey);
    return () => container.removeEventListener("keydown", onKey);
  }

  /**
   * Turns a popover of buttons into a menu. Returns `close(restoreFocus)`.
   * @param {HTMLElement} menuEl @param {HTMLElement | null} opener
   * @param {{ onClose?: () => void }} [opts]
   * @returns {(restoreFocus?: boolean) => void}
   */
  function menu(menuEl, opener, opts = {}) {
    menuEl.setAttribute("role", "menu");
    const items = /** @type {HTMLElement[]} */ ([...menuEl.querySelectorAll("button")]);
    for (const b of items) {
      b.setAttribute("role", "menuitem");
      b.tabIndex = -1;
    }
    opener?.setAttribute("aria-haspopup", "menu");
    opener?.setAttribute("aria-expanded", "true");

    /** @param {boolean} [restoreFocus] */
    const close = (restoreFocus = true) => {
      menuEl.removeEventListener("keydown", onKey);
      menuEl.remove();
      opener?.setAttribute("aria-expanded", "false");
      if (restoreFocus) opener?.focus();
      opts.onClose?.();
    };

    /** @param {number} delta */
    const move = (delta) => {
      const i = items.indexOf(/** @type {HTMLElement} */ (document.activeElement));
      const next = i < 0 ? (delta > 0 ? 0 : items.length - 1) : (i + delta + items.length) % items.length;
      items[next]?.focus();
    };

    /** @param {KeyboardEvent} e */
    function onKey(e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        move(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "Home") {
        e.preventDefault();
        items[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        items[items.length - 1]?.focus();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close(true);
      } else if (e.key === "Tab") {
        close(false); // Tab leaves a menu, and carries on from where the user was
      }
    }
    menuEl.addEventListener("keydown", onKey);
    items[0]?.focus();
    return close;
  }

  /** @param {string} text */
  function announce(text) {
    /** @type {any} */ (window).GOGPlusAnnounce?.say(text);
  }

  /** @type {any} */ (window).GOGPlusTagsA11y = { focusables, trapFocus, menu, announce };
})();
