/**
 * GOG+ endless scrolling for the catalog (opt-in).
 *
 * The catalog shows 48 games and then a page-number control. With this on,
 * scrolling to the end of the grid appends the NEXT page below it, from GOG's
 * own catalog API — the same one the site calls — rendered as our own simple
 * cards (the site's own tiles are Angular components we can't clone safely).
 *
 * Three rules keep it honest:
 *   • It only continues a list it can PROVE is the one on screen. The query
 *     is taken from the page's own request when there was one (read from the
 *     resource timeline), otherwise built from the URL and then checked: the
 *     API's version of the current page must contain most of the games shown.
 *     If not, nothing is appended and the reason shows in "Check this page".
 *   • Requests go through `GOGPlusNet` (allow-listed host, no cookies, listed
 *     in the privacy log) and the whole thing is off by default.
 *   • Our cards are our UI: they're excluded from price detection
 *     (`#gog-plus-endless` is in OWN_UI_SEL) and respect the owned / "not
 *     interested" switches of the catalog bar.
 *
 * The site's own pagination keeps working underneath; changing page or filter
 * (a URL change) starts a fresh session.
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusContentState;
  const Dom = window.GOGPlusGogDom;

  /** Pages appended automatically before the user is asked to press a button. */
  const AUTO_PAGES = 8;

  /**
   * @typedef {{ id: string, slug: string, title: string, type: string, cover: string, price: number | null,
   *   base: number | null, discountPct: number, currency: string, releaseDate: string, genres: string[],
   *   rating: number | null, reviews: number }} Item  (see GOGPlusGogApi.normalizeProduct)
   */
  /**
   * @typedef {Object} Session
   * @property {string} key  pathname+search the session belongs to
   * @property {URLSearchParams} base
   * @property {boolean} trusted the query came from the page's own request
   * @property {boolean} calibrated
   * @property {number} current the page on screen
   * @property {number} next next page to fetch
   * @property {number} appended pages appended so far
   * @property {boolean} loading
   * @property {boolean} done
   * @property {HTMLElement} box
   * @property {HTMLElement} list
   * @property {HTMLElement} status
   * @property {IntersectionObserver | null} io
   */
  /** @type {Session | null} */
  let session = null;

  /** @param {Element} node @param {string} text */
  function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }

  /** @param {string} tag @param {string} [cls] @param {string} [text] @returns {HTMLElement} */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function wanted() {
    const s = state.settings;
    return !!(s.enabled && s.catalogTools && s.endlessCatalog && Dom.pageType() === "store");
  }

  /** Removes everything this module put on the page. */
  function reset() {
    session?.io?.disconnect();
    session?.box.remove();
    session = null;
  }

  /** @param {string} message */
  function fail(message) {
    state.failures["endless scrolling"] = { count: (state.failures["endless scrolling"]?.count || 0) + 1, message, at: Date.now() };
  }

  function env() {
    const API = window.GOGPlusGogApi;
    return {
      locale: API.localeFromPath(location.pathname),
      currency: state.pageCurrency?.code,
    };
  }

  /** @param {HTMLElement} grid @param {string} key */
  function start(grid, key) {
    const API = window.GOGPlusGogApi;
    const onScreen = Dom.catalogTiles().map((t) => t.slug);

    // Where does the query for THIS list come from? In order of how sure we are:
    //  1. the page's own server-side render — its transfer state names the exact
    //     request (with the visitor's country and currency) and holds its
    //     response, so we can see it IS the list on screen without asking;
    //  2. the page's own latest catalog request (a client-side page or filter
    //     change), read from the resource timeline;
    //  3. a query built from the URL, which must then be proven against the API.
    const stateText = document.getElementById("gogcom-store-state")?.textContent || "";
    const fromState = API.catalogRequestsFromState(stateText).find((r) => API.sameList(onScreen, r.slugs));
    const fromTimeline = fromState ? null : API.queryFromResources(performance.getEntriesByType("resource"));
    const base = new URLSearchParams(fromState?.params || fromTimeline || API.queryFromLocation(location.search));
    const trusted = !!(fromState || fromTimeline);
    const current = fromState ? fromState.page : fromTimeline ? Math.max(1, parseInt(fromTimeline.get("page") || "1", 10) || 1) : API.pageFromLocation(location.search);
    base.delete("page");

    const box = el("section", "gog-plus-endless");
    box.id = "gog-plus-endless";
    box.setAttribute("aria-label", "More games");
    const list = el("div", "gog-plus-endless-grid");
    const status = el("div", "gog-plus-endless-status");
    status.setAttribute("role", "status");
    box.append(list, status);
    grid.parentElement?.insertBefore(box, grid.nextSibling);

    session = {
      key, base, trusted, calibrated: trusted, current, next: current + 1, appended: 0,
      loading: false, done: false, box, list, status, io: null,
    };
    watch();
  }

  /** (Re)arms the "bottom reached" observer on the status line. */
  function watch() {
    const s = session;
    if (!s || s.done) return;
    s.io?.disconnect();
    if (typeof IntersectionObserver === "undefined") {
      showMore(s);
      return;
    }
    s.io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadNext();
      },
      { rootMargin: "700px 0px" }
    );
    s.io.observe(s.status);
  }

  /** @param {Session} s */
  function showMore(s) {
    s.status.replaceChildren();
    const b = /** @type {HTMLButtonElement} */ (el("button", "gog-plus-bar-btn is-primary", "Load more games"));
    b.type = "button";
    b.addEventListener("click", () => void loadNext(true));
    s.status.appendChild(b);
  }

  /** @param {boolean} [byUser] pressed the button — go past the automatic limit */
  async function loadNext(byUser = false) {
    const s = session;
    if (!s || s.loading || s.done) return;
    if (!byUser && s.appended >= AUTO_PAGES && s.appended % AUTO_PAGES === 0) {
      s.io?.disconnect();
      showMore(s);
      return;
    }
    const API = window.GOGPlusGogApi;
    s.loading = true;
    s.status.replaceChildren(document.createTextNode("Loading more games…"));
    try {
      if (!s.calibrated) {
        const mine = await API.fetchCatalogPage(API.pageUrl(s.base, s.current, env()));
        const onScreen = Dom.catalogTiles().map((t) => t.slug);
        const theirs = (mine?.items || []).map((i) => i.slug);
        if (!mine || !API.sameList(onScreen, theirs)) {
          s.done = true;
          const apiSet = new Set(theirs);
          const shown = new Set(onScreen);
          const hits = [...shown].filter((x) => apiSet.has(x)).length;
          const detail = `${shown.size} tiles on screen, ${theirs.length} from the API, ${hits} in common${mine ? "" : "; no answer"}`;
          setText(s.status, `Endless scrolling couldn't confirm it is continuing this exact list (${detail}), so it stays off here. Use the page numbers.`);
          fail(`could not match the on-screen list with the API's (${detail}) — query shape may have changed`);
          s.io?.disconnect();
          return;
        }
        s.calibrated = true;
      }
      const res = await API.fetchCatalogPage(API.pageUrl(s.base, s.next, env()));
      if (!res) throw new Error("no answer from the catalog API");
      if (!res.items.length) {
        finish(s);
        return;
      }
      render(s, res.items, s.next);
      s.next++;
      s.appended++;
      if (res.pages && s.next > res.pages) {
        finish(s);
        return;
      }
      s.status.textContent = "";
      watch();
    } catch (err) {
      s.status.replaceChildren();
      s.status.appendChild(document.createTextNode("Couldn't load more games. "));
      const retry = /** @type {HTMLButtonElement} */ (el("button", "gog-plus-bar-btn", "Try again"));
      retry.type = "button";
      retry.addEventListener("click", () => void loadNext(true));
      s.status.appendChild(retry);
      s.io?.disconnect();
      fail(String(/** @type {any} */ (err)?.message || err));
    } finally {
      s.loading = false;
    }
  }

  /** @param {Session} s */
  function finish(s) {
    s.done = true;
    s.io?.disconnect();
    s.status.replaceChildren(document.createTextNode("That's everything for this list."));
  }

  /* ---------------- cards ---------------- */

  /**
   * @param {Item} it
   * @returns {HTMLElement}
   */
  function card(it) {
    const s = state.settings;
    const Fmt = window.GOGPlusCurrencyFormat;
    const lang = /^\/([a-z]{2})(?:\/|$)/.exec(location.pathname)?.[1] || "en";
    const wrap = el("div", "gog-plus-more-card");
    wrap.dataset.slug = it.slug;

    const a = /** @type {HTMLAnchorElement} */ (el("a", "gog-plus-more-link"));
    a.href = `/${lang}/game/${encodeURIComponent(it.slug)}`;
    const cover = el("span", "gog-plus-more-cover");
    if (it.cover) {
      const img = /** @type {HTMLImageElement} */ (el("img"));
      img.src = it.cover;
      img.alt = "";
      img.loading = "lazy";
      cover.appendChild(img);
    }
    if (it.discountPct) cover.appendChild(el("span", "gog-plus-more-badge", `-${it.discountPct}%`));
    a.appendChild(cover);
    a.appendChild(el("span", "gog-plus-more-title", it.title));
    const meta = [it.genres[0], it.releaseDate.slice(0, 4), it.type !== "game" ? it.type : ""].filter(Boolean).join(" · ");
    if (meta) a.appendChild(el("span", "gog-plus-more-meta", meta));
    if (it.rating) a.appendChild(el("span", "gog-plus-more-meta", `★ ${it.rating.toFixed(1)}${it.reviews ? ` (${it.reviews})` : ""}`));
    if (it.price != null && it.currency) {
      const price = el("span", "gog-plus-more-price");
      if (it.base) price.appendChild(el("s", "", Fmt.formatPrice(it.base, it.currency)));
      price.appendChild(document.createTextNode(` ${it.price === 0 ? "Free" : Fmt.formatPrice(it.price, it.currency)}`));
      if (s.currencyConverter && it.price > 0) {
        const conv = window.GOGPlusCurrencyFeature.convertedFromCurrency(it.price, it.currency);
        if (conv != null) price.appendChild(el("em", "", ` ≈ ${Fmt.formatPrice(conv, s.targetCurrency)}`));
      }
      a.appendChild(price);
    }
    wrap.appendChild(a);

    const hide = /** @type {HTMLButtonElement} */ (el("button", "gog-plus-more-hide", "✕"));
    hide.type = "button";
    hide.title = "Not interested — hide this game";
    hide.setAttribute("aria-label", `Not interested: ${it.title}`);
    hide.addEventListener("click", () => {
      void window.GOGPlusKnowledge.setNotInterested(it.slug, true).then(applyVisibility);
    });
    wrap.appendChild(hide);
    return wrap;
  }

  /**
   * @param {Session} s
   * @param {Item[]} items
   * @param {number} page
   */
  function render(s, items, page) {
    const sep = el("div", "gog-plus-endless-sep", `Page ${page}`);
    s.list.appendChild(sep);
    for (const it of items) s.list.appendChild(card(it));
    applyVisibility();
    window.GOGPlusAnnounce?.say(`${items.length} more games loaded, page ${page}`);
  }

  /** Owned / not-interested switches, on our own cards. */
  function applyVisibility() {
    if (!session) return;
    const s = state.settings;
    const Cat = window.GOGPlusCatalogTools;
    for (const c of /** @type {NodeListOf<HTMLElement>} */ (session.list.querySelectorAll(".gog-plus-more-card"))) {
      const slug = c.dataset.slug || "";
      const v = Cat.tileVisibility(
        { slug, owned: false },
        { ownedDisplay: s.ownedDisplay, hideNotInterested: s.hideNotInterested, notInterested: s.notInterested, ownedSlugs: s.ownedSlugs }
      );
      c.classList.toggle("gog-plus-tile-hidden", v.hidden);
      c.classList.toggle("gog-plus-tile-dim", v.dim);
    }
  }

  /* ---------------- entry points ---------------- */

  /** One pass, called from processAll. Cheap when nothing changed. */
  function applyEndless() {
    if (!wanted()) {
      if (session) reset();
      return;
    }
    const grid = Dom.catalogGrid();
    if (!grid || !grid.parentElement) return;
    const key = `${location.pathname}${location.search}`;
    if (session && session.key !== key) reset();
    if (!session) {
      // Needs a real list on screen to continue.
      if (Dom.catalogTiles().length < 4) return;
      start(grid, key);
    } else if (!session.box.isConnected) {
      grid.parentElement.insertBefore(session.box, grid.nextSibling);
      watch();
    } else {
      applyVisibility();
    }
  }

  document.addEventListener("gog-plus:data", (e) => {
    const key = /** @type {CustomEvent} */ (e).detail?.key;
    if (["ownedSlugs", "notInterested", "ownedDisplay", "hideNotInterested"].includes(key)) applyVisibility();
  });

  window.GOGPlusEndless = {
    applyEndless,
    reset,
    _state: {
      get session() {
        return session;
      },
    },
  };
})();
