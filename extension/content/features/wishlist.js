/**
 * GOG+ wishlist feature: quick filter chips (sale / under $10 / under $25 /
 * rated 4.5+ / by genre) with live counts, the smart tools row (sort by
 * discount / price / distance to your tracked low, "near my low" and "ending
 * soon" filters, grouping, a live total, exports), and the content-script→
 * background round-trip that reports the discounted-item count for the
 * toolbar badge (see background/background.js and CLAUDE.md's "wishlist
 * badge dance" section — the SW can't scrape /account/wishlist directly,
 * it's an Angular SPA route). Pulled out of the former single-file
 * content.js during the v2.8.0 module split.
 *
 * What counts as a wishlist row: on the live site the page is the legacy
 * AngularJS one, rows are `.product-row--wishlist` and their price is a bare
 * number with a CSS-printed symbol (see GOGPlusGogDom.readWishlistRow). The
 * site's header ALSO contains `a[href*="/game/"]` tiles (its wishlist
 * dropdown), which earlier versions mistook for rows — "All 7" for a
 * one-item wishlist. Without any real rows (an older layout, the unit-test
 * fixtures) it falls back to plain game links outside the header.
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusContentState;
  const Dom = window.GOGPlusGogDom;
  const { debounce, slugFromHref } = window.GOGPlusContentUtils;
  const { priceInUsdFromText } = window.GOGPlusCurrencyFeature;
  const { GENRE_PATTERNS, matchGenrePattern } = window.GOGPlusGenres;

  /* ============== rows ============== */

  /**
   * @typedef {{
   *   el: Element, slug: string | null, text: string, real: boolean,
   *   model: any, usd: number | null, rating: number | null, sale: boolean
   * }} WlCard
   */

  /**
   * @param {number | null} price @param {string | null} currency
   * @returns {number | null} USD equivalent
   */
  function toUsd(price, currency) {
    if (price == null) return null;
    if (!currency || currency === "USD") return price;
    const rate = state.settings.rates?.[currency];
    return rate ? price / rate : null;
  }

  /**
   * The wishlist's cards, de-duplicated by slug (a game can render as more
   * than one anchor), each with what the filters need already worked out.
   * @returns {WlCard[]}
   */
  function wishlistCards() {
    /** @type {WlCard[]} */
    const out = [];
    const seen = new Set();
    const rows = Dom.wishlistRows();
    if (rows.length) {
      for (const row of rows) {
        const m = Dom.readWishlistRow(row);
        if (m.slug && seen.has(m.slug)) continue;
        if (m.slug) seen.add(m.slug);
        const facts = m.slug ? state.settings.gameFacts?.[m.slug] : null;
        out.push({
          el: m.el,
          slug: m.slug,
          text: row.textContent || "",
          real: true,
          model: m,
          usd: toUsd(m.price, m.currency),
          rating: facts?.rating?.score ?? null,
          sale: m.discountPct > 0,
        });
      }
      return out;
    }
    const OWN = Dom.OWN_UI_SEL;
    for (const a of document.querySelectorAll('a[href*="/game/"]')) {
      if (a.closest(`header, nav, [class*="menu-v3"], ${OWN}`)) continue;
      const slug = slugFromHref(a.getAttribute("href"));
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      const txt = a.textContent || "";
      const ratingMatch = txt.match(/(\d\.\d)\s*\d+\s*reviews/);
      const disc = txt.match(/-(\d{1,2})%/);
      out.push({
        el: a,
        slug,
        text: txt,
        real: false,
        model: {
          slug,
          title: txt.trim().slice(0, 60),
          price: null,
          currency: state.pageCurrency.code,
          discountPct: disc ? parseInt(disc[1], 10) : 0,
          owned: false,
          tba: false,
          free: false,
        },
        usd: priceInUsdFromText(txt),
        rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
        sale: !!disc,
      });
    }
    return out;
  }

  /* ============== quick filters ============== */

  function ensureWishlistFilters() {
    if (!state.settings.wishlistFilters) return;
    if (!location.pathname.includes("/account/wishlist")) return;
    if (document.getElementById("gog-plus-wlfilters")) return;

    const target = Dom.wishlistRoot();
    if (!target) return;

    const bar = document.createElement("div");
    bar.id = "gog-plus-wlfilters";
    bar.className = "gog-plus-wlfilters";
    const filters = [
      { id: "all", label: "All", icon: "▦" },
      { id: "sale", label: "On sale", icon: "%" },
      { id: "under10", label: "< $10", icon: "₵" },
      { id: "under25", label: "< $25", icon: "$" },
      { id: "rated45", label: "Rated 4.5+", icon: "★" },
    ];
    bar.innerHTML = `
      <span class="gog-plus-wlfilters-label">Quick filter</span>
      ${filters
        .map(
          (f, i) => `
        <button data-f="${f.id}" class="gog-plus-wlfilter ${i === 0 ? "active" : ""}" type="button">
          <span class="gog-plus-wlfilter-icon" aria-hidden="true">${f.icon}</span>
          <span class="gog-plus-wlfilter-label">${f.label}</span>
          <span class="gog-plus-wlfilter-count" aria-hidden="true"></span>
        </button>
      `
        )
        .join("")}
      <span class="gog-plus-wlfilters-genres" id="gog-plus-wlfilters-genres"></span>
    `;
    target.prepend(bar);
    if (state.settings.wishlistSmart) bar.appendChild(buildSmartRow());

    bar.addEventListener("click", (e) => {
      const btn = /** @type {HTMLElement} */ (e.target).closest("button[data-f]");
      if (!btn) return;
      bar.querySelectorAll("button[data-f]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyWishlistFilter(/** @type {HTMLElement} */ (btn).dataset.f);
      applySmart();
    });

    // Live counts: recompute when the wishlist DOM mutates (debounced). The
    // bar lives inside the observed node, so changes this feature makes itself
    // (the bar's own chips, the group headings) are ignored — otherwise every
    // refresh would schedule the next one forever.
    const refresh = debounce(() => {
      updateWishlistFilterCounts(bar);
      applySmart();
    }, 400);
    /** @param {MutationRecord} r */
    const isOwn = (r) =>
      bar.contains(r.target) ||
      [...r.addedNodes, ...r.removedNodes].every((n) => n.nodeType === 1 && /** @type {Element} */ (n).classList.contains("gog-plus-wl-group"));
    const observer = new MutationObserver((records) => {
      if (records.every(isOwn)) return;
      refresh();
    });
    observer.observe(target, { childList: true, subtree: true });
    state.observers.push(observer);
    setTimeout(() => {
      updateWishlistFilterCounts(bar);
      applySmart();
    }, 800);

    // Report live discounted-item count to background → toolbar badge.
    reportWishlistCount();
  }

  const GENRE_ICONS = {
    rpg: "⚔",
    horror: "☠",
    strategy: "▦",
    scifi: "✦",
    indie: "♥",
  };

  function updateWishlistFilterCounts(bar) {
    const counts = { all: 0, sale: 0, under10: 0, under25: 0, rated45: 0 };
    const genreCounts = {};
    for (const c of wishlistCards()) {
      counts.all++;
      if (c.sale) counts.sale++;
      if (c.usd !== null && c.usd < 10) counts.under10++;
      if (c.usd !== null && c.usd < 25) counts.under25++;
      if (c.rating !== null && c.rating >= 4.5) counts.rated45++;
      const genre = c.slug ? state.settings.gameGenres?.[c.slug] || matchGenrePattern(c.slug) : null;
      if (genre) genreCounts[genre] = (genreCounts[genre] || 0) + 1;
    }
    bar.querySelectorAll("button[data-f]").forEach((btn) => {
      const f = btn.dataset.f;
      const span = btn.querySelector(".gog-plus-wlfilter-count");
      if (!span) return;
      const n = counts[f];
      setText(span, n > 0 ? String(n) : "");
    });

    // Rebuild the genre row from scratch — entries appear/disappear as the
    // wishlist mutates, so we don't try to diff in place. But only when its
    // content actually changed (and the active chip with it).
    const genreHost = bar.querySelector("#gog-plus-wlfilters-genres");
    if (!genreHost) return;
    const signature = `${bar.querySelector("button[data-f].active")?.dataset.f}|${JSON.stringify(genreCounts)}`;
    if (genreHost.dataset.sig === signature) return;
    genreHost.dataset.sig = signature;
    const existing = Object.fromEntries(
      [...genreHost.querySelectorAll("button[data-f]")].map((b) => [b.dataset.f, b])
    );
    const activeFilter = bar.querySelector("button[data-f].active")?.dataset.f;
    genreHost.innerHTML = "";
    for (const [genre, n] of Object.entries(genreCounts)) {
      if (n <= 0) continue;
      const id = `genre-${genre}`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.f = id;
      btn.className =
        "gog-plus-wlfilter gog-plus-wlfilter--genre" +
        (activeFilter === id ? " active" : "");
      btn.innerHTML = `
        <span class="gog-plus-wlfilter-icon" aria-hidden="true">${GENRE_ICONS[genre] || "·"}</span>
        <span class="gog-plus-wlfilter-label">${genre[0].toUpperCase() + genre.slice(1)}</span>
        <span class="gog-plus-wlfilter-count">${n}</span>
      `;
      genreHost.appendChild(btn);
      // Restore focus / aria state if user was on this button
      if (existing[id] === document.activeElement) btn.focus();
    }
  }

  let wishlistReportAttempt = 0;
  function reportWishlistCount() {
    // Angular renders wishlist cards lazily. Instead of a single fixed wait,
    // poll until two consecutive ticks see the same count — that's when the
    // list has finished rendering. Bail after ~6s to avoid spinning forever.
    wishlistReportAttempt++;
    const myAttempt = wishlistReportAttempt;
    let lastTotal = -1;
    let ticks = 0;
    const MAX_TICKS = 8;
    const INTERVAL_MS = 750;

    const tick = () => {
      if (myAttempt !== wishlistReportAttempt) return; // newer call superseded us
      ticks++;
      const cards = wishlistCards();
      const total = cards.length;
      const discounted = cards.filter((c) => c.sale).length;

      const stable = total === lastTotal && total > 0;
      if (stable || ticks >= MAX_TICKS) {
        try {
          chrome.runtime.sendMessage({
            type: "wishlist-report",
            discountedCount: discounted,
            total,
            // The slug list itself — background.js has no other way to know
            // which games are wishlisted (it can't scrape the Angular SPA
            // route directly; see CLAUDE.md's "wishlist badge dance").
            // Enables wishlist-wide price alerts (checkWishlistWideAlerts).
            slugs: cards.map((c) => c.slug).filter(Boolean),
          });
        } catch (_) {
          /* no-op: background may be asleep */
        }
        return;
      }
      lastTotal = total;
      setTimeout(tick, INTERVAL_MS);
    };
    setTimeout(tick, INTERVAL_MS);
  }

  function applyWishlistFilter(mode) {
    const genreMatch = mode.startsWith("genre-") ? mode.slice(6) : null;
    const genrePattern = genreMatch
      ? GENRE_PATTERNS.find((g) => g.genre === genreMatch)?.re
      : null;

    // Legacy anchors are not de-duplicated for filtering: every anchor of a
    // game must be shown or hidden together.
    const targets = Dom.wishlistRows().length
      ? wishlistCards().map((c) => ({ el: c.el, slug: c.slug, c }))
      : [...document.querySelectorAll('a[href*="/game/"]')]
          .filter((a) => !a.closest(`header, nav, [class*="menu-v3"], ${Dom.OWN_UI_SEL}`))
          .map((a) => {
            const slug = slugFromHref(a.getAttribute("href"));
            const txt = a.textContent || "";
            const ratingMatch = txt.match(/(\d\.\d)\s*\d+\s*reviews/);
            return {
              el: a,
              slug,
              c: {
                text: txt,
                usd: priceInUsdFromText(txt),
                rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
                sale: /-\d+%/.test(txt),
              },
            };
          });

    for (const { el, slug, c } of targets) {
      let show = true;
      if (mode === "sale") show = c.sale;
      else if (mode === "under10") show = c.usd !== null && c.usd < 10;
      else if (mode === "under25") show = c.usd !== null && c.usd < 25;
      else if (mode === "rated45") show = c.rating !== null && c.rating >= 4.5;
      else if (genreMatch) {
        const cachedGenre = slug && state.settings.gameGenres && state.settings.gameGenres[slug];
        show = cachedGenre ? cachedGenre === genreMatch : !!slug && !!genrePattern && genrePattern.test(slug);
      }

      el.classList.toggle("gog-plus-filtered-out", !show);
    }
  }

  /* ============== smart tools ============== */

  const smart = {
    /** @type {string} */
    sort: "default",
    /** @type {string} */
    group: "none",
    /** @type {Set<string>} active smart filters: near-low, ending-soon, hide-owned */
    filters: new Set(),
  };

  function smartCtx() {
    const s = state.settings;
    /** @type {Record<string, number>} */
    const offerEnds = {};
    for (const [slug, f] of Object.entries(s.gameFacts || {})) {
      const t = f?.pe ? window.GOGPlusDeals.parsePromoDate(f.pe) : null;
      if (t) offerEnds[slug] = t;
    }
    return {
      history: s.priceHistory || {},
      rates: s.rates || {},
      target: s.targetCurrency && s.targetCurrency !== "none" ? s.targetCurrency : state.pageCurrency.code,
      offerEnds,
      tags: s.tags || {},
      status: s.gameStatus || {},
      genres: s.gameGenres || {},
    };
  }

  /** @param {string} tag @param {string} [cls] @param {string} [text] @returns {HTMLElement} */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function buildSmartRow() {
    const row = el("div", "gog-plus-wlsmart");
    const field = (/** @type {string} */ label, /** @type {string} */ key, /** @type {Array<[string, string]>} */ options) => {
      const wrap = el("label", "gog-plus-bar-field");
      wrap.appendChild(el("span", "", label));
      const sel = /** @type {HTMLSelectElement} */ (el("select"));
      sel.dataset.wl = key;
      for (const [v, t] of options) {
        const o = /** @type {HTMLOptionElement} */ (el("option", "", t));
        o.value = v;
        sel.appendChild(o);
      }
      sel.value = /** @type {any} */ (smart)[key];
      sel.addEventListener("change", () => {
        /** @type {any} */ (smart)[key] = sel.value;
        applySmart();
      });
      wrap.appendChild(sel);
      return wrap;
    };
    row.appendChild(
      field("Sort", "sort", [
        ["default", "As on the site"],
        ["discount", "Biggest discount"],
        ["near-low", "Closest to my tracked low"],
        ["price-asc", "Price: low to high"],
        ["price-desc", "Price: high to low"],
        ["title", "Title A–Z"],
      ])
    );
    row.appendChild(
      field("Group by", "group", [
        ["none", "No grouping"],
        ["tag", "My first tag"],
        ["status", "Play status"],
        ["genre", "Genre"],
      ])
    );
    for (const [id, label] of /** @type {const} */ ([
      ["near-low", "Near my low"],
      ["ending-soon", "Ending soon"],
      ["hide-owned", "Hide owned"],
    ])) {
      const b = /** @type {HTMLButtonElement} */ (el("button", "gog-plus-bar-btn", label));
      b.type = "button";
      b.dataset.wlFilter = id;
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => {
        if (smart.filters.has(id)) smart.filters.delete(id);
        else smart.filters.add(id);
        b.setAttribute("aria-pressed", String(smart.filters.has(id)));
        b.classList.toggle("is-on", smart.filters.has(id));
        applySmart();
      });
      row.appendChild(b);
    }
    const total = el("span", "gog-plus-wl-total");
    total.setAttribute("role", "status");
    total.dataset.wlTotal = "";
    row.appendChild(total);

    const exp = el("span", "gog-plus-wl-export");
    exp.appendChild(el("span", "gog-plus-gp-muted", "Export:"));
    for (const [kind, label] of /** @type {const} */ ([
      ["csv", "CSV"],
      ["md", "Markdown"],
      ["ics", "Offer ends (.ics)"],
      ["cards", "Copy as cards"],
    ])) {
      const b = /** @type {HTMLButtonElement} */ (el("button", "gog-plus-bar-btn", label));
      b.type = "button";
      b.dataset.wlExport = kind;
      b.addEventListener("click", () => exportWishlist(kind));
      exp.appendChild(b);
    }
    row.appendChild(exp);
    return row;
  }

  /**
   * Sets text only when it differs — the page observer watches childList, so
   * rewriting identical text every pass would keep it firing.
   * @param {Element} node @param {string} text
   */
  function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }

  /** Re-applies sort, smart filters, grouping and the total. Idempotent. */
  function applySmart() {
    if (!state.settings.wishlistSmart) return;
    const Tools = window.GOGPlusWishlistTools;
    const cards = wishlistCards().filter((c) => c.real);
    const totalEl = document.querySelector("#gog-plus-wlfilters [data-wl-total]");
    if (!cards.length) {
      if (totalEl) setText(totalEl, "");
      return;
    }
    const ctx = smartCtx();
    /** @type {Map<any, WlCard>} */
    const byModel = new Map(cards.map((c) => [c.model, c]));
    const models = cards.map((c) => c.model);

    // Filters (AND of the active smart filters); hidden via their own class so
    // they combine with the quick filters above.
    for (const c of cards) {
      const visible = [...smart.filters].every((f) => Tools.matchesFilter(c.model, /** @type {any} */ (f), ctx));
      c.el.classList.toggle("gog-plus-wl-hidden", !visible);
    }

    // Order + grouping, via CSS `order` on the list (made a flex column while
    // it is in use) — the rows themselves are never moved in the DOM.
    const list = Dom.wishlistList();
    const ordered = smart.sort !== "default" || smart.group !== "none";
    list?.classList.toggle("gog-plus-wl-ordered", ordered);
    /** @type {Map<string, HTMLElement>} */
    const headings = new Map();
    list?.querySelectorAll(":scope > .gog-plus-wl-group").forEach((g) => headings.set(/** @type {HTMLElement} */ (g).dataset.group || "", /** @type {HTMLElement} */ (g)));
    if (!ordered) {
      for (const c of cards) /** @type {HTMLElement} */ (c.el).style.removeProperty("order");
      headings.forEach((h) => h.remove());
    } else {
      const sorted = Tools.sortRows(models, /** @type {any} */ (smart.sort), ctx);
      const groups = Tools.groupRows(sorted, /** @type {any} */ (smart.group), ctx);
      let o = 0;
      const wanted = new Set();
      for (const g of groups) {
        if (g.label && list) {
          wanted.add(g.label);
          let h = headings.get(g.label);
          if (!h) {
            h = el("div", "gog-plus-wl-group");
            h.dataset.group = g.label;
            list.appendChild(h);
          }
          setText(h, `${g.label} · ${g.rows.length}`);
          h.style.order = String(o++);
        }
        for (const m of g.rows) /** @type {HTMLElement} */ (byModel.get(m)?.el).style.order = String(o++);
      }
      headings.forEach((h, label) => {
        if (!wanted.has(label)) h.remove();
      });
    }

    // Total of what is currently shown.
    const shown = cards.filter((c) => !c.el.classList.contains("gog-plus-filtered-out") && !c.el.classList.contains("gog-plus-wl-hidden"));
    const t = Tools.totals(shown.map((c) => c.model), ctx);
    if (totalEl) {
      const sym = window.GOGPlusCurrencyFormat.symbolFor(t.currency || "USD");
      const parts = [`${shown.length} game${shown.length === 1 ? "" : "s"}`];
      if (t.priced) parts.push(`${sym}${t.total.toFixed(2)} to buy all`);
      if (t.saving > 0) parts.push(`${t.onSale} on sale, saving about ${sym}${t.saving.toFixed(2)}`);
      setText(totalEl, parts.join(" · "));
    }
  }

  /* ============== export ============== */

  /**
   * @param {string} name @param {string} mime @param {string} text
   */
  function download(name, mime, text) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** @param {"csv" | "md" | "ics" | "cards"} kind */
  async function exportWishlist(kind) {
    const Tools = window.GOGPlusWishlistTools;
    const ctx = smartCtx();
    const cards = wishlistCards().filter((c) => c.real);
    const rows = cards.map((c) => c.model);
    if (!rows.length) {
      window.GOGPlusToasts?.show("Nothing to export yet — the wishlist hasn't loaded", { variant: "muted" });
      return;
    }
    const day = new Date().toISOString().slice(0, 10);
    if (kind === "csv") download(`gog-wishlist-${day}.csv`, "text/csv", Tools.toCsv(rows, ctx));
    else if (kind === "md") download(`gog-wishlist-${day}.md`, "text/markdown", Tools.toMarkdown(rows, ctx));
    else if (kind === "ics") {
      const offers = rows
        .filter((r) => r.slug && ctx.offerEnds[r.slug])
        .map((r) => ({ slug: /** @type {string} */ (r.slug), title: state.settings.gameFacts?.[/** @type {string} */ (r.slug)]?.title || r.title, endsAt: ctx.offerEnds[/** @type {string} */ (r.slug)] }));
      const ics = window.GOGPlusIcs?.buildOfferCalendar(offers);
      if (!ics) {
        window.GOGPlusToasts?.show("No running offer end dates known — open a game's page to learn its end date", { variant: "muted" });
        return;
      }
      download(`gog-offers-ending-${day}.ics`, "text/calendar", ics);
    } else if (kind === "cards") {
      const lines = rows.map((r) => `${r.title || r.slug}${r.price != null ? ` — ${r.price.toFixed(2)} ${r.currency || ""}` : ""}${r.discountPct ? ` (-${r.discountPct}%)` : ""}`.trim());
      try {
        await navigator.clipboard.writeText(lines.join("\n"));
        window.GOGPlusToasts?.show(`Copied ${lines.length} lines — paste them into Trello's "add cards" box`);
      } catch (_) {
        window.GOGPlusToasts?.show("Couldn't reach the clipboard", { variant: "muted" });
      }
    }
  }

  window.GOGPlusWishlistFeature = {
    ensureWishlistFilters,
    updateWishlistFilterCounts,
    reportWishlistCount,
    applyWishlistFilter,
    wishlistCards,
    applySmart,
    exportWishlist,
    _smart: smart,
  };
})();
