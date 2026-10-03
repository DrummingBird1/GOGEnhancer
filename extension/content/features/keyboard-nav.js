/**
 * GOG+ keyboard navigation for game grids (opt-in, off by default).
 *
 *   J / K  focus the next / previous game card
 *   T      open the quick-add-tag popover for the focused card
 *   ?      show these shortcuts
 *
 * On a game page the same opt-in adds one-key actions for the page itself:
 *   W      press the site's own "Wishlist" button
 *   T      jump to the tag box in the insights panel
 *   N      jump to the note box
 *   A      jump to the price-alert box
 *
 * Focusing a card's own <a> (rather than faking a highlight) means Enter
 * opens it natively and screen readers announce it. Bare letter keys are only
 * handled when nothing editable has focus, no modifier is held, and the
 * command palette isn't open — so it can't steal typing from any input.
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusContentState;
  const { slugFromHref } = window.GOGPlusContentUtils;
  const FOCUS_CLASS = "gog-plus-kbd-focus";

  /** @param {EventTarget | null} t */
  function isTypingTarget(t) {
    if (!(t instanceof HTMLElement)) return false;
    return (
      t.tagName === "INPUT" ||
      t.tagName === "TEXTAREA" ||
      t.tagName === "SELECT" ||
      t.isContentEditable
    );
  }

  /**
   * One entry per game, in document order. Duplicate anchors for the same
   * game (cover-link + body-link) collapse to the first.
   * @returns {Array<{ card: HTMLAnchorElement, slug: string }>}
   */
  function navigableCards() {
    const seen = new Set();
    /** @type {Array<{ card: HTMLAnchorElement, slug: string }>} */
    const out = [];
    for (const card of window.GOGPlusGogDom.findCards(document, { includeProcessed: true })) {
      if (!card.querySelector("img, picture")) continue;
      const slug = slugFromHref(card.getAttribute("href"));
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      out.push({ card, slug });
    }
    return out;
  }

  function clearMark() {
    document.querySelectorAll(`.${FOCUS_CLASS}`).forEach((el) => el.classList.remove(FOCUS_CLASS));
  }

  /** @param {1 | -1} dir */
  function step(dir) {
    const list = navigableCards();
    if (!list.length) return;
    const active = document.activeElement;
    const idx = list.findIndex((x) => x.card === active || x.card.contains(active));
    let next = idx === -1 ? (dir > 0 ? 0 : list.length - 1) : idx + dir;
    // A card that exists in the DOM but is display:none can't take focus —
    // skip over it rather than leaving the user stuck on an invisible stop.
    while (next >= 0 && next < list.length) {
      const { card } = list[next];
      card.focus({ preventScroll: true });
      if (document.activeElement === card) {
        clearMark();
        card.classList.add(FOCUS_CLASS);
        const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        card.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
        return;
      }
      next += dir;
    }
  }

  function tagFocused() {
    if (!state.settings.customTags) return;
    const active = document.activeElement;
    const entry = navigableCards().find((x) => x.card === active || x.card.contains(active));
    if (!entry) return;
    const host =
      entry.card.querySelector(".gog-plus-cover-host") || entry.card.closest(".gog-plus-cover-host");
    if (host) window.GOGPlusCardBadges.openQuickAddTag(host, entry.slug);
  }

  /**
   * One-key actions on a game page. Focusing the panel's own inputs (rather
   * than writing anything) means a key press can never change data by itself;
   * W presses the site's wishlist button, exactly as a click on it would.
   * @param {string} key
   * @returns {boolean} whether the key was one of ours
   */
  function gamePageKey(key) {
    const focusId = (/** @type {string} */ id) => {
      const el = /** @type {HTMLElement | null} */ (document.getElementById(id));
      if (!el) return false;
      el.scrollIntoView({ block: "center", behavior: "auto" });
      el.focus();
      return true;
    };
    if (key === "w") {
      const btn = /** @type {HTMLElement | null} */ (
        document.querySelector('[selenium-id="WishlistButton"]')?.closest("button") || null
      );
      if (btn && window.GOGPlusGogDom.isRendered(btn)) btn.click();
      return true;
    }
    if (key === "t") return focusId("gog-plus-tag-input");
    if (key === "n") return focusId("gog-plus-note");
    if (key === "a") return focusId("gog-plus-alert-threshold");
    return false;
  }

  /** @param {KeyboardEvent} e */
  function handleKey(e) {
    if (!state.settings.enabled || !state.settings.keyboardNav) return;
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;
    if (document.querySelector(".gog-plus-palette-overlay")) return;

    if (window.GOGPlusGogDom.pageType() === "game" && gamePageKey(e.key)) {
      e.preventDefault();
      return;
    }

    if (e.key === "j") {
      e.preventDefault();
      step(1);
    } else if (e.key === "k") {
      e.preventDefault();
      step(-1);
    } else if (e.key === "t") {
      e.preventDefault();
      tagFocused();
    } else if (e.key === "?") {
      const onGame = window.GOGPlusGogDom.pageType() === "game";
      window.GOGPlusToasts?.show(
        onGame
          ? "Keyboard: W wishlist · T tag · N note · A price alert"
          : "Keyboard: J / K move between games · T tags the focused game",
        { variant: "default" }
      );
    }
  }

  let installed = false;
  function init() {
    if (installed) return;
    installed = true;
    document.addEventListener("keydown", handleKey);
  }

  window.GOGPlusKeyboardNav = { init, step, navigableCards, handleKey };
})();
