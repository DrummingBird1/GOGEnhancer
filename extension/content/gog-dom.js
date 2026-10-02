/**
 * GOG+ site adapter — the single place that knows what gog.com's markup
 * looks like.
 *
 * Before this module existed, ~60 querySelector calls were scattered across
 * content/*.js, each hard-wiring one guess about gog.com's class names. When
 * the site changes design, every one of them is a separate thing that can
 * silently stop matching. Everything that has to find "a game card", "a price",
 * "the game title", "where to mount the panel" now goes through here instead,
 * and each lookup tries several independent strategies, most stable first:
 *
 *   1. URL shape (/game/<slug>)         — survives any restyle
 *   2. Document metadata (og:title, JSON-LD) — survives any restyle
 *   3. Semantic hooks (h1, main, [role=main], itemprop) — survives most
 *   4. Class-name substrings ([class*="price"]) — the legacy guess
 *   5. Text shape ("$19.99" and nothing else) — last resort, whole-text match
 *
 * Every lookup that has more than one strategy reports WHICH one matched, so
 * diagnose() can tell the user (and a bug report) exactly what stopped working
 * after the next redesign instead of "the extension does nothing".
 */
// @ts-check

(() => {
  "use strict";

  const GAME_PATH_RE = /\/game\/([a-z0-9_]+)/;
  const LOCALE_PREFIX_RE = /^\/[a-z]{2}(?:-[a-z]{2})?(?=\/|$)/i;

  /** @param {string | null | undefined} href */
  function slugFromHref(href) {
    const m = (href || "").match(GAME_PATH_RE);
    return m ? m[1] : null;
  }

  function slugFromLocation() {
    return slugFromHref(location.pathname);
  }

  /**
   * Coarse page classification from the URL alone (locale prefix stripped).
   * @param {string} [pathname]
   * @returns {"home" | "store" | "game" | "wishlist" | "account" | "cart" | "promo" | "other"}
   */
  function pageType(pathname = location.pathname) {
    const p = pathname.split(/[?#]/)[0].replace(LOCALE_PREFIX_RE, "") || "/";
    if (/^\/game\//.test(p)) return "game";
    if (/^\/account\/wishlist/.test(p)) return "wishlist";
    if (/^\/account/.test(p)) return "account";
    if (/^\/(games|catalog)(\/|$)/.test(p)) return "store";
    if (/^\/(checkout|cart)/.test(p)) return "cart";
    if (/^\/promo\//.test(p)) return "promo";
    if (p === "/") return "home";
    return "other";
  }

  /* ============== cards ============== */

  /**
   * Candidate game-card anchors. A card is any link to /game/<slug>; the
   * caller still decides (image present, slug de-dup) which ones to stamp.
   * @param {ParentNode} [root]
   * @param {{ includeProcessed?: boolean }} [opts]
   * @returns {HTMLAnchorElement[]}
   */
  function findCards(root = document, opts = {}) {
    const sel = opts.includeProcessed
      ? 'a[href*="/game/"]'
      : 'a[href*="/game/"]:not(.gog-plus-card-done)';
    return /** @type {HTMLAnchorElement[]} */ (Array.from(root.querySelectorAll(sel)));
  }

  /**
   * The element badges should be anchored to: the smallest ancestor of the
   * cover image that is NOT the card itself. GOG's carousel/preview overlays
   * already use positioned ancestors, so modifying the card root explodes
   * their layout (see CLAUDE.md "Card badge placement"). Walks up at most
   * 3 levels until it finds a wrapper clearly smaller than the card.
   * @param {Element} card
   * @param {Element} [img]
   * @returns {HTMLElement | null}
   */
  function cardCoverHost(card, img) {
    const cover = img || card.querySelector("img, picture");
    if (!cover) return null;
    let host = cover.parentElement;
    if (!host || host === card) return null;

    const cardRect = card.getBoundingClientRect();
    const cardArea = cardRect.width * cardRect.height;
    let hops = 0;
    while (host && host !== card && hops < 3) {
      const r = host.getBoundingClientRect();
      // "Clearly smaller than the card" is judged by AREA. An earlier version
      // required BOTH width ≤ 75% and height ≤ 95% of the card — which rejects
      // the most common modern layout, a vertical tile whose cover spans the
      // full card width but only the top part of its height, so every badge
      // silently disappeared. A wrapper that is nearly the whole card still
      // fails (that's the carousel/overlay container this guards against).
      const isCoverSized = r.width > 0 && r.height > 0 && r.width * r.height <= cardArea * 0.9;
      if (isCoverSized) break;
      host = host.parentElement;
      hops++;
    }
    if (!host || host === card) return null;
    return host;
  }

  /* ============== prices ============== */

  const PRICE_CLASS_SEL =
    '[class*="price"], [class*="Price"], .product-tile__price, .price-text, .product-row-price';
  const PRICE_ATTR_SEL =
    '[itemprop="price"], [data-price], [data-testid*="price"], [data-testid*="Price"], [data-test*="price"], [data-qa*="price"]';
  const CURRENCY_SYM = "[$€£₪₽]|zł|Kč|kr|R\\$|C\\$|A\\$";
  // The WHOLE trimmed text must be one price ("$19.99" / "19,99 €") — a
  // substring test would flag "from $5 to $60" sliders and "3 kr" in prose.
  const PRICE_FULL_RE = new RegExp(
    `^\\s*(?:(?:${CURRENCY_SYM})\\s?\\d[\\d.,]*|\\d[\\d.,]*\\s?(?:${CURRENCY_SYM}))\\s*$`
  );

  // Everything this extension injects into the page. Our own panel has
  // elements with "price" in their class names ("Current ₪99.96" in the price
  // history, the comparison table…), which a class-substring search would
  // happily report as the SITE's prices — hiding a real redesign from
  // diagnose() and, worse, letting price-history recording read our own UI.
  const OWN_UI_SEL = [
    "#gog-plus-gamepanel",
    "#gog-plus-banner",
    "#gog-plus-wlfilters",
    ".gog-plus-tooltip",
    ".gog-plus-toasts",
    ".gog-plus-palette-overlay",
    ".gog-plus-quickadd-popover",
    ".gog-plus-badges",
    ".gog-plus-conv-note",
  ].join(", ");

  /** @param {Element} el */
  function isSiteElement(el) {
    return !el.closest(OWN_UI_SEL);
  }

  /**
   * An element's text without the "≈ ₪80" conversion notes this extension
   * appends to prices. Without this, a price is findable by its text shape
   * only until the converter has run — after that the element's text is
   * "$24.99 ≈ ₪100", no longer "just a price", and everything that looks for
   * prices afterwards (price-history recording, diagnostics) goes blind.
   * @param {Element} el
   */
  function textWithoutOurNotes(el) {
    if (!el.querySelector(".gog-plus-conv-note")) return el.textContent || "";
    const clone = /** @type {Element} */ (el.cloneNode(true));
    clone.querySelectorAll(".gog-plus-conv-note").forEach((n) => n.remove());
    return clone.textContent || "";
  }

  /**
   * Elements that display a price, with the strategy that found them.
   * @param {ParentNode} [root]
   * @returns {{ nodes: Element[], strategy: "class" | "attribute" | "text-shape" | "none" }}
   */
  function findPriceNodes(root = document) {
    let nodes = Array.from(root.querySelectorAll(PRICE_CLASS_SEL)).filter(isSiteElement);
    if (nodes.length) return { nodes, strategy: "class" };

    nodes = Array.from(root.querySelectorAll(PRICE_ATTR_SEL)).filter(isSiteElement);
    if (nodes.length) return { nodes, strategy: "attribute" };

    /** @type {Element[]} */
    const found = [];
    const els = root.querySelectorAll("span, div, p, strong, b, ins, del, s, em");
    const limit = Math.min(els.length, 3000);
    for (let i = 0; i < limit && found.length < 60; i++) {
      const el = els[i];
      if (el.children.length > 4 || !isSiteElement(el)) continue;
      const t = textWithoutOurNotes(el);
      if (t.length > 24) continue;
      if (PRICE_FULL_RE.test(t)) found.push(el);
    }
    // A wrapper around a price element has the same text as the price itself;
    // keep only the innermost, most specific element of each nest.
    const innermost = found.filter((el) => !found.some((o) => o !== el && el.contains(o)));
    return { nodes: innermost, strategy: innermost.length ? "text-shape" : "none" };
  }

  /* ============== game page ============== */

  function titleFromOg() {
    const v = document.querySelector("meta[property='og:title']")?.getAttribute("content");
    return v ? v.replace(/\s*on GOG\.com\s*$/i, "").trim() || null : null;
  }

  const PRODUCT_TYPES = new Set(["Product", "VideoGame", "SoftwareApplication", "Game"]);

  function titleFromJsonLd() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(s.textContent || "");
        for (const item of Array.isArray(data) ? data : [data]) {
          const types = [].concat(item?.["@type"] || []);
          if (typeof item?.name === "string" && types.some((t) => PRODUCT_TYPES.has(t))) {
            return item.name.trim() || null;
          }
        }
      } catch {
        // Malformed JSON-LD is the page's problem, not ours — try the next block.
      }
    }
    return null;
  }

  /**
   * The heading that holds the game's title. When a page has several h1s
   * (a redesign may well put a site-name h1 in the header), prefer the one
   * whose text matches the document's og:title over simply "the first".
   * @returns {{ el: Element, strategy: string } | null}
   */
  function findTitleHeading() {
    const legacy = document.querySelector("h1.productcard-basics__title");
    if (legacy) return { el: legacy, strategy: "legacy-class" };
    const classed = document.querySelector("h1[class*='product'][class*='title']");
    if (classed) return { el: classed, strategy: "product-title-class" };

    const h1s = Array.from(document.querySelectorAll("h1"));
    const og = titleFromOg();
    if (og && h1s.length > 1) {
      const norm = (/** @type {string} */ s) => s.replace(/\s+/g, " ").trim().toLowerCase();
      const want = norm(og);
      const match = h1s.find((h) => {
        const t = norm(h.textContent || "");
        return t && (t === want || want.includes(t) || t.includes(want));
      });
      if (match) return { el: match, strategy: "h1-matches-og" };
    }
    if (h1s[0]) return { el: h1s[0], strategy: "first-h1" };
    return null;
  }

  /** @returns {{ value: string | null, strategy: string }} */
  function resolveGameTitle() {
    const h = findTitleHeading();
    const hText = h ? (h.el.textContent || "").trim() : "";
    if (h && hText) return { value: hText, strategy: h.strategy };

    const og = titleFromOg();
    if (og) return { value: og, strategy: "og:title" };

    const ld = titleFromJsonLd();
    if (ld) return { value: ld, strategy: "json-ld" };

    const dt = document.title.replace(/\s*[-–|]?\s*(on )?GOG\.com\s*$/i, "").trim();
    if (dt) return { value: dt, strategy: "document.title" };
    return { value: null, strategy: "none" };
  }

  function gameTitle() {
    return resolveGameTitle().value;
  }

  /**
   * Where the "GOG Enhancer insights" panel mounts: right after the title
   * heading, or after <main> as a last resort.
   * @returns {{ el: Element, strategy: string } | null}
   */
  function gamePageAnchor() {
    const h = findTitleHeading();
    if (h) return h;
    const main = document.querySelector("main, [role='main']");
    return main ? { el: main, strategy: "main" } : null;
  }

  /** Cheap "has the game page rendered yet" probe. */
  function hasProductContent() {
    return !!document.querySelector("h1, [class*='product'], main, [role='main']");
  }

  /* ============== app shell ============== */

  function wishlistRoot() {
    return document.querySelector("main, [role='main'], [class*='wishlist']");
  }

  /** The node the MutationObserver watches. Falls back to <body>. */
  function spaRoot() {
    return (
      document.querySelector("main, [role='main']") ||
      document.querySelector("[ng-view]") ||
      document.body
    );
  }

  /**
   * Calls `cb(newHref, oldHref)` whenever the URL changes without a page load.
   * A content script lives in an isolated world, so it never sees the page's
   * own history.pushState() calls — there is no event to hook. The Navigation
   * API (where available), popstate and hashchange cover most routers; a slow
   * poll covers the rest.
   * @param {(href: string, from: string) => void} cb
   * @param {number} [intervalMs]
   * @returns {() => void} stop
   */
  function watchRoute(cb, intervalMs = 1000) {
    let last = location.href;
    const check = () => {
      if (location.href === last) return;
      const from = last;
      last = location.href;
      cb(last, from);
    };
    window.addEventListener("popstate", check);
    window.addEventListener("hashchange", check);
    /** @type {any} */
    const nav = /** @type {any} */ (window).navigation;
    nav?.addEventListener?.("navigatesuccess", check);
    const timer = setInterval(check, intervalMs);
    return () => {
      clearInterval(timer);
      window.removeEventListener("popstate", check);
      window.removeEventListener("hashchange", check);
      nav?.removeEventListener?.("navigatesuccess", check);
    };
  }

  /* ============== diagnostics ============== */

  /**
   * A snapshot of what each lookup found on the current page — "selector
   * health". Contains only the URL path (no query string / fragment) and
   * public store text; nothing personal.
   */
  function diagnose() {
    const type = pageType();
    const allCards = findCards(document, { includeProcessed: true });
    const cardsWithImage = allCards.filter((a) => a.querySelector("img, picture")).length;
    const prices = findPriceNodes();
    const title = resolveGameTitle();
    const anchor = gamePageAnchor();
    const root = spaRoot();

    /** @type {string[]} */
    const warnings = [];
    if ((type === "store" || type === "home" || type === "wishlist") && !cardsWithImage) {
      warnings.push("No game cards with cover images were found on this page.");
    }
    if (type === "game") {
      if (!title.value) warnings.push("The game title could not be read.");
      if (!anchor) warnings.push("No place to mount the insights panel was found.");
      if (!prices.nodes.length) warnings.push("No price elements were found.");
    }
    if (prices.strategy === "text-shape") {
      warnings.push("Prices were only found by text shape — the site's class names have likely changed.");
    }

    return {
      extensionVersion: chrome.runtime.getManifest().version,
      path: location.pathname,
      pageType: type,
      framework: {
        angularJs: !!document.querySelector("[ng-app], [ng-view], [ng-controller]"),
        angular: !!document.querySelector("[ng-version]"),
        reactLike: !!document.querySelector("[data-reactroot], #__next, #root"),
        vueLike: !!document.querySelector("[data-v-app], [data-server-rendered]"),
      },
      observedRoot: root ? root.tagName.toLowerCase() + (root.id ? `#${root.id}` : "") : null,
      cards: { total: allCards.length, withImage: cardsWithImage },
      prices: {
        count: prices.nodes.length,
        strategy: prices.strategy,
        sample: prices.nodes.slice(0, 3).map((n) => textWithoutOurNotes(n).trim().slice(0, 24)),
      },
      title: { found: !!title.value, strategy: title.strategy },
      panelAnchor: anchor ? anchor.strategy : null,
      applied: {
        cards: document.querySelectorAll(".gog-plus-card-done").length,
        convertedPrices: document.querySelectorAll(".gog-plus-converted").length,
        gamePanel: !!document.getElementById("gog-plus-gamepanel"),
      },
      warnings,
    };
  }

  const api = {
    slugFromHref,
    slugFromLocation,
    pageType,
    findCards,
    cardCoverHost,
    findPriceNodes,
    resolveGameTitle,
    gameTitle,
    gamePageAnchor,
    hasProductContent,
    wishlistRoot,
    spaRoot,
    watchRoute,
    diagnose,
  };
  window.GOGPlusGogDom = api;
})();
