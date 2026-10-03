/**
 * GOG+ site adapter, part 2 — readers for the facts v4 features need: what a
 * game page says beyond its price (languages, ratings, offer end, time to
 * beat, ownership), what a catalog tile or wishlist row means, and where the
 * review list lives.
 *
 * Same rule as content/gog-dom.js (which this extends — it MUST load after it):
 * nothing outside the adapter hard-codes a gog.com selector. Everything here
 * is shaped by what the live site looked like on 2026-10-02:
 *
 *   • Game page: `selenium-id` hooks (`DetailsLanguages`, `ProductTags`,
 *     `LowestPriceBeforeDiscount`, `PromoEndDate`, `CriticsReviews`,
 *     `HowLongToBeatSection`), an `.owned-status` label when the game is in
 *     the user's library, and `timer="2026-10-07 09:59:59.000000+03:00"` on
 *     the promo end (the visible text is a locale-formatted, ambiguous date).
 *   • Catalog: `product-tile` custom elements in a CSS grid; an owned game
 *     carries `.product-label--owned` ("IN LIBRARY") inside the tile.
 *   • Wishlist (still the legacy AngularJS page): `.product-row--wishlist`
 *     rows whose state flags (`.product-state__is-owned` / `-is-tba` /
 *     `-is-free`) are ALWAYS in the DOM and shown or hidden with CSS, and
 *     whose price is a bare number with a CSS-printed currency symbol.
 *     The site's header also contains wishlist-looking `a[href*="/game/"]`
 *     tiles (`.menu-v3__games-tile`) that must never be counted as rows.
 *
 * Nothing here touches storage or the network — it only reads the page.
 */
// @ts-check

(() => {
  "use strict";

  const G = window.GOGPlusGogDom;

  /** @param {Element | null | undefined} el */
  const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();

  /** True when `el` exists, is a site element and is actually on screen. */
  const shown = (/** @type {Element | null | undefined} */ el) => !!el && G.isSiteElement(el) && G.isRendered(el);

  /* ---------------- numbers ---------------- */

  /**
   * A number out of text that may or may not carry a currency symbol.
   * @param {string} s
   * @param {string | null} [code]
   * @returns {number | null}
   */
  function numberFromText(s, code = null) {
    if (!s) return null;
    const Cur = window.GOGPlusCurrency;
    const withSymbol = Cur?.parsePrice(s, code && Cur.CODE_TO_SYMBOL[code] ? code : null);
    if (withSymbol != null) return withSymbol;
    const m = s.match(/\d[\d.,]*/);
    if (!m) return null;
    let raw = m[0];
    if (raw.includes(",") && !raw.includes(".") && /,\d{1,2}$/.test(raw)) raw = raw.replace(",", ".");
    else raw = raw.replace(/,/g, "");
    const v = parseFloat(raw);
    return Number.isFinite(v) ? v : null;
  }

  /**
   * The price of a price element AS DISPLAYED (see displayText) plus its
   * currency, taken from the symbol when there is one.
   * @param {Element | null | undefined} el
   * @param {string | null} fallbackCode
   * @returns {{ value: number, currency: string | null } | null}
   */
  function priceOf(el, fallbackCode) {
    if (!el) return null;
    const t = G.displayText(el);
    const Cur = window.GOGPlusCurrency;
    let currency = fallbackCode;
    if (Cur?.SYMBOL_TO_CODE) {
      // Longest symbol first so "R$" is not read as "$".
      const sym = Object.keys(Cur.SYMBOL_TO_CODE)
        .sort((a, b) => b.length - a.length)
        .find((s) => t.includes(s));
      if (sym) currency = Cur.SYMBOL_TO_CODE[sym];
    }
    const value = numberFromText(t, currency);
    return value == null ? null : { value, currency };
  }

  function pageCurrencyCode() {
    return G.currencyHint() || window.GOGPlusContentState?.pageCurrency?.code || null;
  }

  /* ---------------- login / ownership ---------------- */

  /** The game page puts `user-logged-in` on <body>; other pages don't. */
  function isLoggedIn() {
    return document.body?.classList.contains("user-logged-in") || false;
  }

  /**
   * Is the game on this page in the user's library? `true`/`false` only when
   * the page proves it (logged in); `null` when we can't tell (logged out).
   * @returns {boolean | null}
   */
  function isGameOwned() {
    const label = document.querySelector(".owned-status");
    if (label && shown(label) && /library/i.test(text(label))) return true;
    const goTo = document.querySelector(".go-to-library-button");
    if (goTo && shown(goTo)) return true;
    return isLoggedIn() ? false : null;
  }

  /* ---------------- game page ---------------- */

  /**
   * The three prices on a game page, in one currency: what's asked now, the
   * struck-through list price (only when discounted), and GOG's own "lowest
   * price in the last 30 days before the discount".
   * @returns {{ final: number | null, base: number | null, lowest30: number | null, currency: string | null }}
   */
  function readGamePrices() {
    const code = pageCurrencyCode();
    const final = priceOf(G.findFinalPrice(), code);
    const baseEl = document.querySelector('[selenium-id="ProductBasePrice"]');
    const base = baseEl && shown(baseEl) ? priceOf(baseEl, code) : null;
    const lowestHost = document.querySelector('[selenium-id="LowestPriceBeforeDiscount"]');
    /** @type {{ value: number, currency: string | null } | null} */
    let lowest = null;
    if (lowestHost && G.isSiteElement(lowestHost)) {
      lowest = priceOf(lowestHost.querySelector("._price"), code);
      if (!lowest) {
        const n = numberFromText(text(lowestHost).replace(/^.*?:/, ""), code);
        if (n != null) lowest = { value: n, currency: code };
      }
    }
    return {
      final: final ? final.value : null,
      base: base ? base.value : null,
      lowest30: lowest ? lowest.value : null,
      currency: final?.currency || code,
    };
  }

  /**
   * The offer's end as the page's machine-readable `timer` attribute (an ISO
   * date-time with an offset), or null. The visible text is ambiguous
   * ("07/10/2026 09:59 EEST") and is deliberately not parsed.
   * @returns {string | null}
   */
  function promoEndRaw() {
    const el = document.querySelector('[selenium-id="PromoEndDate"]');
    if (!el || !G.isSiteElement(el)) return null;
    return el.getAttribute("timer") || null;
  }

  /**
   * Languages from the details table: { English: { audio: true, text: true } }.
   * @returns {Record<string, { audio: boolean, text: boolean }> | null}
   */
  function readLanguages() {
    const host = document.querySelector('[selenium-id="DetailsLanguages"]');
    if (!host || !G.isSiteElement(host)) return null;
    /** @type {Record<string, { audio: boolean, text: boolean }>} */
    const out = {};
    for (const nameEl of host.querySelectorAll(".details__languages-row--language-name")) {
      const name = text(nameEl);
      if (!name) continue;
      // The audio / text cells are the siblings that follow the name cell, up to
      // the next language's name cell — correct whether each language sits in
      // its own row container or all share one.
      let audio = false;
      let hasText = false;
      for (let n = nameEl.nextElementSibling; n && !n.classList.contains("details__languages-row--language-name"); n = n.nextElementSibling) {
        const ticked = !!n.querySelector('[class*="tick"]');
        if (n.classList.contains("details__languages-row--audio-support")) audio = ticked;
        else if (n.classList.contains("details__languages-row--text-support")) hasText = ticked;
      }
      out[name] = { audio, text: hasText };
    }
    return Object.keys(out).length ? out : null;
  }

  /** @returns {{ score: number, count: number } | null} */
  function readRating() {
    const root = document.querySelector(".productcard-rating") || document;
    const scoreEl = root.querySelector(".productcard-rating__score--version-a, .productcard-rating__score");
    const detailsEl = root.querySelector(".productcard-rating__details");
    const score = scoreEl ? text(scoreEl).match(/(\d(?:[.,]\d+)?)\s*\/\s*5/) : null;
    const count = detailsEl ? text(detailsEl).match(/(\d[\d,.]*)\s*review/i) : null;
    if (!score) return null;
    return {
      score: parseFloat(score[1].replace(",", ".")),
      count: count ? parseInt(count[1].replace(/[,.]/g, ""), 10) : 0,
    };
  }

  /** The critics' "% recommend" figure, or null. */
  function readCriticsPct() {
    const host = document.querySelector('[selenium-id="CriticsReviews"]');
    const m = host ? text(host.querySelector(".circle-score__text")).match(/(\d{1,3})/) : null;
    return m ? Math.min(100, parseInt(m[1], 10)) : null;
  }

  /**
   * GOG's own HowLongToBeat figures: { Main: "108 h", "Main + Sides": "154.5 h", … }.
   * @returns {Record<string, string> | null}
   */
  function readTimeToBeat() {
    const host = document.querySelector('[selenium-id="HowLongToBeatSection"], #HowLongToBeatSection');
    if (!host || !G.isSiteElement(host)) return null;
    /** @type {Record<string, string>} */
    const out = {};
    for (const box of host.querySelectorAll(".howlongtobeat-box")) {
      const name = text(box.querySelector(".howlongtobeat-box__name"));
      const time = text(box.querySelector(".howlongtobeat-box__time"));
      if (name && time) out[name] = time;
    }
    return Object.keys(out).length ? out : null;
  }

  /** The game's own GOG tags, in page order. */
  function readProductTags() {
    const host = document.querySelector('[selenium-id="ProductTags"]');
    if (!host || !G.isSiteElement(host)) return [];
    const seen = new Set();
    for (const a of host.querySelectorAll("a.details__link--tag, a[href*='/games/']")) {
      // The anchor also holds the ", " separator after the name.
      const t = text(a.querySelector(".details__link-text") || a);
      if (t) seen.add(t);
    }
    return [...seen];
  }

  /**
   * The page's schema.org Product (JSON-LD), or null. It carries the product id
   * (`sku`) and the release date, both far more stable than any class name.
   * @returns {any | null}
   */
  function ldProduct() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(s.textContent || "");
        for (const item of Array.isArray(data) ? data : [data]) {
          if (item && (item.sku || item.releaseDate)) return item;
        }
      } catch {
        // Malformed JSON-LD is the page's problem.
      }
    }
    return null;
  }

  /** Release year from the page's JSON-LD, or null. */
  function readReleaseYear() {
    const d = ldProduct()?.releaseDate;
    const m = typeof d === "string" ? d.match(/^(\d{4})/) : null;
    return m ? parseInt(m[1], 10) : null;
  }

  /**
   * The release date GOG's store page gives ("2011-11-15"), or "". For a game
   * not out yet this is the planned date. It is the date on GOG, which for an
   * old game can be later than the original release.
   * @returns {string}
   */
  function readReleaseDate() {
    const d = ldProduct()?.releaseDate;
    const m = typeof d === "string" ? d.match(/^(\d{4}-\d{2}-\d{2})/) : null;
    return m ? m[1] : "";
  }

  /**
   * GOG's numeric product id for this page — the `card-product` attribute the
   * page puts on its product card, or the JSON-LD `sku`. null when neither is
   * there (which is also what a non-game page gives).
   * @returns {string | null}
   */
  function readProductId() {
    const attr = document.querySelector("[card-product]")?.getAttribute("card-product")?.trim();
    if (attr && /^\d{3,12}$/.test(attr)) return attr;
    const sku = String(ldProduct()?.sku ?? "").trim();
    return /^\d{3,12}$/.test(sku) ? sku : null;
  }

  /** Everything a game page says about the game, for the facts cache and the panel. */
  function readGameFacts() {
    return {
      title: G.gameTitle(),
      languages: readLanguages(),
      rating: readRating(),
      criticsPct: readCriticsPct(),
      timeToBeat: readTimeToBeat(),
      tags: readProductTags(),
      releaseYear: readReleaseYear(),
      releaseDate: readReleaseDate(),
      promoEnd: promoEndRaw(),
      owned: isGameOwned(),
    };
  }

  /* ---------------- bundles ---------------- */

  /**
   * The games a BUNDLE page shows as its covers, from the site's own hook:
   * `<a selenium-id="BundleCoverItem" href="/en/game/<slug>" title="<title>">`
   * (inspected on the live Prince of Persia Bundle page, 2026-10-03). This is a
   * stable hook and costs no request; other kinds of pack have no such block
   * (they are asked of GOG's product API instead — see knowledge.ensurePackInfo).
   * @param {string} [currentSlug] left out of the result
   * @returns {Array<{ slug: string, title: string }>}
   */
  function readBundleItems(currentSlug = "") {
    const out = [];
    const seen = new Set();
    for (const a of document.querySelectorAll('[selenium-id="BundleCoverItem"]')) {
      if (!G.isSiteElement(a)) continue;
      const slug = G.slugFromHref(a.getAttribute("href"));
      if (!slug || slug === currentSlug || seen.has(slug)) continue;
      seen.add(slug);
      out.push({ slug, title: (a.getAttribute("title") || "").trim().slice(0, 140) || slug.replace(/_/g, " ") });
    }
    return out;
  }

  const INCLUDES_RE = /^(?:this (?:pack|bundle|collection) )?(?:includes|contains)\b|^(?:pack|bundle|collection) contents?\b/i;

  /**
   * The games a pack / bundle page says it contains, by slug (never the
   * current game). Heuristic — found by the heading ("Includes", "Contains…")
   * rather than a stable hook, because the pack layout has not been
   * inspected on the live site. Returns [] when no such section is found.
   * @param {string} [currentSlug]
   * @returns {string[]}
   */
  function bundleSlugs(currentSlug = "") {
    const covers = readBundleItems(currentSlug);
    if (covers.length) return covers.map((c) => c.slug);
    for (const h of document.querySelectorAll("h2, h3, h4, .title__underline-text, [class*='title']")) {
      if (h.children.length || !G.isSiteElement(h)) continue;
      const t = text(h);
      if (t.length > 60 || !INCLUDES_RE.test(t)) continue;
      const box = h.closest("section, [class*='layout-container'], [class*='content-summary-item']") || h.parentElement?.parentElement;
      if (!box) continue;
      const slugs = new Set();
      for (const a of box.querySelectorAll('a[href*="/game/"]')) {
        const slug = G.slugFromHref(a.getAttribute("href"));
        if (slug && slug !== currentSlug) slugs.add(slug);
      }
      if (slugs.size) return [...slugs];
    }
    return [];
  }

  /* ---------------- reviews ---------------- */

  /** @returns {Array<{ el: Element, stars: number, verified: boolean }>} */
  function readReviews() {
    return Array.from(document.querySelectorAll('[selenium-id="ReviewsList"] article.review__item'))
      .filter(G.isSiteElement)
      .map((el) => ({
        el,
        stars: el.querySelectorAll(".review__stars .rati__star.is-full").length,
        verified: !!el.querySelector(".review__profile-verified-owner"),
      }));
  }

  /** Where the review filter bar goes: just above the first review. */
  function reviewsMount() {
    const first = document.querySelector('[selenium-id="ReviewsList"] article.review__item');
    return first?.parentElement || null;
  }

  /* ---------------- catalog ---------------- */

  /**
   * Catalog / home tiles. `el` is the grid item (the <product-tile> element
   * when there is one) — the thing CSS `order`/`display` should act on.
   * @param {ParentNode} [root]
   * @returns {Array<{ el: HTMLElement, anchor: HTMLAnchorElement, slug: string }>}
   */
  function catalogTiles(root = document) {
    /** @type {Array<{ el: HTMLElement, anchor: HTMLAnchorElement, slug: string }>} */
    const out = [];
    const seen = new Set();
    for (const a of root.querySelectorAll('a.product-tile[href*="/game/"], product-tile a[href*="/game/"]')) {
      if (!G.isSiteElement(a) || a.closest(".menu-v3, header")) continue;
      const slug = G.slugFromHref(a.getAttribute("href"));
      if (!slug || seen.has(a)) continue;
      seen.add(a);
      out.push({
        el: /** @type {HTMLElement} */ (a.closest("product-tile") || a),
        anchor: /** @type {HTMLAnchorElement} */ (a),
        slug,
      });
    }
    return out;
  }

  /** The grid that holds the catalog tiles, or null. */
  function catalogGrid() {
    const sel = document.querySelector(".paginated-products-grid");
    if (sel) return /** @type {HTMLElement} */ (sel);
    const first = catalogTiles()[0];
    return first?.el.parentElement || null;
  }

  /**
   * @param {{ el: Element, anchor: Element, slug: string }} tile
   * @returns {{ slug: string, title: string, discountPct: number, price: number | null, basePrice: number | null, currency: string | null, owned: boolean }}
   */
  function readTile(tile) {
    const code = pageCurrencyCode();
    const t = tile.el;
    const discount = text(t.querySelector("price-discount")).match(/(\d{1,2})\s*%/);
    const final = priceOf(t.querySelector("price-value .final-value, .final-value"), code);
    const base = priceOf(t.querySelector("price-value .base-value, .base-value"), code);
    // <product-title> first: the #productTileGameTitle wrapper around it also holds
    // the tile's labels ("IN LIBRARY", "NEW"), which are not part of the name.
    const titleEl = t.querySelector("product-title") || t.querySelector("#productTileGameTitle, [selenium-id='productTileGameTitle']");
    return {
      slug: tile.slug,
      title: text(titleEl),
      discountPct: discount ? parseInt(discount[1], 10) : 0,
      price: final ? final.value : null,
      basePrice: base ? base.value : null,
      currency: final?.currency || code,
      owned: !!t.querySelector(".product-label--owned"),
    };
  }

  /* ---------------- wishlist ---------------- */

  /** Real wishlist rows only (never the header menu's tiles). */
  function wishlistRows() {
    return Array.from(document.querySelectorAll(".product-row--wishlist")).filter(G.isSiteElement);
  }

  /** The list container the rows live in, or null. */
  function wishlistList() {
    const first = wishlistRows()[0];
    return (first?.closest(".list-inner") || document.querySelector(".account__products .list-inner")) ?? null;
  }

  /**
   * @param {Element} row
   * @returns {{
   *   slug: string | null, title: string, price: number | null, currency: string | null,
   *   discountPct: number, owned: boolean, tba: boolean, free: boolean, inCart: boolean,
   *   release: string, el: Element
   * }}
   */
  function readWishlistRow(row) {
    const code = pageCurrencyCode();
    const link = row.querySelector("a.product-row__link");
    const priceEl = row.querySelector(".product-state__price");
    const price = priceEl && shown(priceEl) ? priceOf(priceEl, code) : null;
    const discEl = row.querySelector(".product-state__discount");
    const disc = discEl && shown(discEl) ? text(discEl).match(/(\d{1,2})/) : null;
    return {
      el: row.closest(".product-row-wrapper") || row,
      slug: G.slugFromHref(link?.getAttribute("href")),
      title: text(row.querySelector(".product-row__title")),
      price: price ? price.value : null,
      currency: price?.currency || code,
      discountPct: disc ? parseInt(disc[1], 10) : 0,
      owned: shown(row.querySelector(".product-state__is-owned")),
      tba: shown(row.querySelector(".product-state__is-tba")),
      free: shown(row.querySelector(".product-state__is-free")),
      inCart: shown(row.querySelector(".product-status__in-cart")),
      release: text(row.querySelector(".product-row__date")),
    };
  }

  /* ---------------- home: big-sale banner ---------------- */

  const SALE_RE =
    /\b(?:(?:spring|summer|autumn|fall|winter|halloween|black friday|publisher|mega|lunar new year|christmas)\s+sale|festival)\b|\bdeals up to\s*-?\d+%/i;

  /**
   * Headline text of a store-wide sale, if the home page is advertising one
   * ("8000+ deals up to -95%", "Autumn Sale"). A heuristic — GOG has no
   * machine-readable "a sale is on" flag we know of.
   * @returns {string | null}
   */
  function homeSaleBanner() {
    for (const el of document.querySelectorAll("h1, h2, h3, [class*='hero'] *, [class*='banner'] *")) {
      if (el.children.length || !G.isSiteElement(el)) continue;
      const t = text(el);
      if (t.length >= 4 && t.length <= 80 && SALE_RE.test(t)) return t;
    }
    return null;
  }

  Object.assign(G, {
    numberFromText,
    priceOf,
    isLoggedIn,
    isGameOwned,
    readGamePrices,
    promoEndRaw,
    readLanguages,
    readRating,
    readCriticsPct,
    readTimeToBeat,
    readProductTags,
    readReleaseYear,
    readReleaseDate,
    readProductId,
    readGameFacts,
    bundleSlugs,
    readBundleItems,
    readReviews,
    reviewsMount,
    catalogTiles,
    catalogGrid,
    readTile,
    wishlistRows,
    wishlistList,
    readWishlistRow,
    homeSaleBanner,
  });
})();
