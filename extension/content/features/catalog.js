/**
 * GOG+ catalog tools — a small bar above the catalog grid, plus per-tile
 * controls, that make a page of 48 games easier to work through:
 *
 *   • sort the tiles on this page by discount, converted price, distance to
 *     your tracked low, or title (GOG's own sort covers the whole catalog;
 *     this one re-orders what is already on the page, and says so)
 *   • compact grid
 *   • dim or hide games already in your library (from the site's own
 *     "IN LIBRARY" label — see content/features/knowledge.js)
 *   • "not interested" — hide a game, with a count and a one-click restore
 *   • only games you have price history for
 *   • select several tiles to tag them or hide them together
 *   • side-by-side comparison of 2–4 games, from data the extension already has
 *   • saved searches (a catalog URL with its filters)
 *
 * Nothing here changes the site's own DOM structure: sorting uses CSS `order`
 * on the grid items (the grid is a CSS grid), hiding is a class, and the
 * controls live in the cover host the badge feature already established — the
 * card anchor itself is never given `position: relative` (see CLAUDE.md).
 * The site re-renders tiles when the page changes, so every pass is
 * idempotent and cheap.
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusContentState;
  const Dom = window.GOGPlusGogDom;

  /** @type {string} one of GOGPlusWishlistTools.SORT_MODES */
  let sortMode = "default";
  let historyOnly = false;
  let selectMode = false;
  /** @type {Set<string>} */
  const selected = new Set();
  /** @type {Map<string, any>} slug -> tile model, kept across SPA page changes so a comparison can span pages */
  const compare = new Map();

  /**
   * Sets text only when it differs. The page observer watches for childList
   * changes, and every pass re-applies state — rewriting identical text would
   * be a mutation each time and keep the observer firing forever.
   * @param {Element} node @param {string} text
   */
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

  const MAX_COMPARE = 4;

  function ctx() {
    const s = state.settings;
    return {
      history: s.priceHistory || {},
      rates: s.rates || {},
      target: s.targetCurrency && s.targetCurrency !== "none" ? s.targetCurrency : undefined,
    };
  }

  /** The tiles on this page with their models. */
  function pageTiles() {
    return Dom.catalogTiles().map((t) => ({ tile: t, model: Dom.readTile(t) }));
  }

  /* ---------------- applying state to tiles ---------------- */

  function applyTiles() {
    const s = state.settings;
    const grid = Dom.catalogGrid();
    if (grid) {
      grid.classList.toggle("gog-plus-grid--compact", s.catalogDensity === "compact");
    }
    const tiles = pageTiles();
    const Cat = window.GOGPlusCatalogTools;
    let hiddenByInterest = 0;
    let shown = 0;

    for (const { tile, model } of tiles) {
      const v = Cat.tileVisibility(model, {
        ownedDisplay: s.ownedDisplay,
        hideNotInterested: s.hideNotInterested,
        notInterested: s.notInterested,
        ownedSlugs: s.ownedSlugs,
        historyOnly,
        history: s.priceHistory,
      });
      tile.el.classList.toggle("gog-plus-tile-hidden", v.hidden);
      tile.el.classList.toggle("gog-plus-tile-dim", v.dim);
      tile.el.classList.toggle("gog-plus-tile-selected", selected.has(tile.slug));
      if (v.reason === "not-interested") hiddenByInterest++;
      if (!v.hidden) shown++;
      ensureTileControls(tile, model);
    }

    // Local sort: CSS `order` on the grid items, original order restored by clearing it.
    if (sortMode === "default") {
      for (const { tile } of tiles) tile.el.style.removeProperty("order");
    } else {
      const sorted = window.GOGPlusWishlistTools.sortRows(
        tiles.map((t) => /** @type {any} */ (t.model)),
        sortMode,
        ctx()
      );
      /** @type {Map<string, number>} */
      const rank = new Map(sorted.map((m, i) => [m.slug, i]));
      for (const { tile } of tiles) tile.el.style.order = String(rank.get(tile.slug) ?? 0);
    }

    updateBar({ total: tiles.length, shown, hiddenByInterest });
    updateTray();
  }

  /* ---------------- per-tile controls ---------------- */

  /**
   * @param {{ el: HTMLElement, anchor: HTMLAnchorElement, slug: string }} tile
   * @param {any} model
   */
  function ensureTileControls(tile, model) {
    const host = tile.anchor.querySelector(".gog-plus-cover-host");
    if (!host) return;
    let box = host.querySelector(":scope > .gog-plus-tilectl");
    if (!box) {
      box = el("div", "gog-plus-tilectl");
      host.appendChild(box);

      const mk = (/** @type {string} */ cls, /** @type {string} */ label, /** @type {string} */ glyph, /** @type {() => void} */ fn) => {
        const b = /** @type {HTMLButtonElement} */ (el("button", `gog-plus-tilectl-btn ${cls}`, glyph));
        b.type = "button";
        b.title = label;
        b.setAttribute("aria-label", label);
        b.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          fn();
        });
        box?.appendChild(b);
        return b;
      };
      mk("gog-plus-tilectl-hide", "Not interested — hide this game", "✕", () => hideGame(tile.slug, model.title));
      mk("gog-plus-tilectl-compare", "Add to comparison", "⇄", () => toggleCompare(tile.slug, readModel(tile)));
      const pick = mk("gog-plus-tilectl-select", "Select this game", "☐", () => toggleSelected(tile.slug));
      pick.hidden = !selectMode;
    }
    const pick = /** @type {HTMLElement | null} */ (box.querySelector(".gog-plus-tilectl-select"));
    if (pick) {
      pick.hidden = !selectMode;
      setText(pick, selected.has(tile.slug) ? "☑" : "☐");
    }
    const cmp = box.querySelector(".gog-plus-tilectl-compare");
    cmp?.classList.toggle("is-on", compare.has(tile.slug));
  }

  /** @param {{ el: HTMLElement, anchor: HTMLAnchorElement, slug: string }} tile */
  const readModel = (tile) => Dom.readTile(tile);

  /** @param {string} slug @param {string} title */
  async function hideGame(slug, title) {
    await window.GOGPlusKnowledge.setNotInterested(slug, true);
    applyTiles();
    window.GOGPlusToasts?.show(`Hidden: ${title || slug}`, {
      action: {
        label: "Undo",
        onClick: async () => {
          await window.GOGPlusKnowledge.setNotInterested(slug, false);
          applyTiles();
        },
      },
    });
  }

  /** @param {string} slug */
  function toggleSelected(slug) {
    if (selected.has(slug)) selected.delete(slug);
    else selected.add(slug);
    applyTiles();
  }

  /** @param {string} slug @param {any} model */
  function toggleCompare(slug, model) {
    if (compare.has(slug)) compare.delete(slug);
    else if (compare.size >= MAX_COMPARE) {
      window.GOGPlusToasts?.show(`You can compare up to ${MAX_COMPARE} games`, { variant: "muted" });
      return;
    } else compare.set(slug, model);
    applyTiles();
  }

  /* ---------------- comparison tray + overlay ---------------- */

  function updateTray() {
    let tray = document.getElementById("gog-plus-compare-tray");
    if (!compare.size) {
      tray?.remove();
      return;
    }
    if (!tray) {
      tray = el("div", "gog-plus-compare-tray");
      tray.id = "gog-plus-compare-tray";
      document.body.appendChild(tray);
    }
    const signature = [...compare.keys()].join("|");
    if (tray.dataset.sig === signature) return;
    tray.dataset.sig = signature;
    tray.replaceChildren();
    tray.appendChild(el("span", "", `Comparing ${compare.size}/${MAX_COMPARE}`));
    const open = /** @type {HTMLButtonElement} */ (el("button", "gog-plus-bar-btn is-primary", "Compare"));
    open.type = "button";
    open.disabled = compare.size < 2;
    open.title = compare.size < 2 ? "Pick at least two games" : "";
    open.addEventListener("click", openComparison);
    const clear = /** @type {HTMLButtonElement} */ (el("button", "gog-plus-bar-btn", "Clear"));
    clear.type = "button";
    clear.addEventListener("click", () => {
      compare.clear();
      applyTiles();
    });
    tray.append(open, clear);
  }

  function openComparison() {
    const s = state.settings;
    const items = [...compare.values()].map((m) => ({ ...m, owned: m.owned || !!s.ownedSlugs?.[m.slug] }));
    const table = window.GOGPlusCatalogTools.buildComparison(items, {
      history: s.priceHistory,
      facts: s.gameFacts,
      genres: s.gameGenres,
      tags: s.tags,
      preferred: window.GOGPlusLangNames.preferredNames(s.preferredLanguages, s.uiLanguage),
    });
    document.querySelector(".gog-plus-modal-overlay")?.remove();
    const overlay = el("div", "gog-plus-modal-overlay");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Compare games");
    const card = el("div", "gog-plus-modal");
    const head = el("div", "gog-plus-modal-head");
    head.appendChild(el("strong", "", "Side-by-side comparison"));
    const close = /** @type {HTMLButtonElement} */ (el("button", "gog-plus-bar-btn", "Close"));
    close.type = "button";
    const dismiss = () => {
      overlay.remove();
      document.removeEventListener("keydown", onKey, true);
    };
    /** @param {KeyboardEvent} e */
    const onKey = (e) => {
      if (e.key === "Escape") dismiss();
    };
    close.addEventListener("click", dismiss);
    document.addEventListener("keydown", onKey, true);
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) dismiss();
    });
    head.appendChild(close);
    card.appendChild(head);

    const t = el("table", "gog-plus-compare-table");
    const hr = el("tr");
    hr.appendChild(el("th"));
    for (const c of table.columns) {
      const th = el("th");
      const a = /** @type {HTMLAnchorElement} */ (el("a", "", c.title));
      a.href = `/en/game/${encodeURIComponent(c.slug)}`;
      th.appendChild(a);
      hr.appendChild(th);
    }
    t.appendChild(hr);
    for (const r of table.rows) {
      const tr = el("tr");
      tr.appendChild(el("th", "", r.label));
      for (const cell of r.cells) tr.appendChild(el("td", "", cell));
      t.appendChild(tr);
    }
    card.appendChild(t);
    const chart = priceChart(items);
    if (chart) card.appendChild(chart);
    card.appendChild(el("p", "gog-plus-gp-muted", "Prices are what each tile showed when you picked it; history, ratings and languages come from game pages you have opened."));
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    close.focus();
  }

  const CHART_COLORS = ["#00f0ff", "#c64fff", "#7fffa6", "#ffbf47"];

  /**
   * An inline-SVG chart of the compared games' price history, all in the
   * user's target currency (null when nobody has two recorded snapshots).
   * @param {Array<{ slug: string, title: string }>} items
   */
  function priceChart(items) {
    const target = state.settings.targetCurrency && state.settings.targetCurrency !== "none" ? state.settings.targetCurrency : "USD";
    const data = window.GOGPlusCatalogTools.buildChartSeries(items, { history: state.settings.priceHistory, rates: state.settings.rates, target });
    if (!data) return null;
    const NS = "http://www.w3.org/2000/svg";
    const W = 560;
    const H = 150;
    const pad = 8;
    const x = (/** @type {number} */ t) => pad + (data.maxT === data.minT ? 0 : ((t - data.minT) / (data.maxT - data.minT)) * (W - pad * 2));
    const y = (/** @type {number} */ p) => H - pad - (data.maxP === data.minP ? 0.5 : (p - data.minP) / (data.maxP - data.minP)) * (H - pad * 2);
    const wrap = el("div", "gog-plus-compare-chart");
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `Price history of the compared games in ${target}`);
    data.series.forEach((s, i) => {
      const line = document.createElementNS(NS, "polyline");
      line.setAttribute("points", s.points.map((p) => `${x(p.t).toFixed(1)},${y(p.p).toFixed(1)}`).join(" "));
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", CHART_COLORS[i % CHART_COLORS.length]);
      line.setAttribute("stroke-width", "2");
      svg.appendChild(line);
    });
    wrap.appendChild(svg);
    const legend = el("div", "gog-plus-compare-legend");
    data.series.forEach((s, i) => {
      const item = el("span", "", s.title);
      item.style.setProperty("--swatch", CHART_COLORS[i % CHART_COLORS.length]);
      legend.appendChild(item);
    });
    legend.appendChild(el("span", "gog-plus-gp-muted", `${data.minP.toFixed(0)}–${data.maxP.toFixed(0)} ${target}`));
    wrap.appendChild(legend);
    return wrap;
  }

  /* ---------------- bulk actions ---------------- */

  /** @param {string} tag */
  async function tagSelected(tag) {
    const name = tag.trim();
    if (!name || !selected.size) return;
    const { tags: cur = {} } = await window.GOGPlusStorage.get({ tags: {} });
    for (const slug of selected) {
      cur[slug] = cur[slug] || [];
      if (!cur[slug].includes(name)) cur[slug].push(name);
    }
    state.settings.tags = cur;
    await window.GOGPlusStorage.set({ tags: cur });
    window.GOGPlusToasts?.show(`Tagged ${selected.size} game${selected.size === 1 ? "" : "s"}: ${name}`);
  }

  async function hideSelected() {
    const cur = { ...(state.settings.notInterested || {}) };
    const day = new Date().toISOString().slice(0, 10);
    for (const slug of selected) cur[slug] = day;
    state.settings.notInterested = cur;
    await window.GOGPlusStorage.set({ notInterested: cur });
    const n = selected.size;
    selected.clear();
    applyTiles();
    window.GOGPlusToasts?.show(`Hidden ${n} game${n === 1 ? "" : "s"}`);
  }

  /* ---------------- the bar ---------------- */

  /**
   * @param {string} label @param {string} id @param {Array<[string, string]>} options @param {string} value
   * @param {(v: string) => void} onChange
   */
  function selectField(label, id, options, value, onChange) {
    const wrap = el("label", "gog-plus-bar-field");
    wrap.appendChild(el("span", "", label));
    const sel = /** @type {HTMLSelectElement} */ (el("select"));
    sel.id = id;
    for (const [v, text] of options) {
      const o = /** @type {HTMLOptionElement} */ (el("option", "", text));
      o.value = v;
      sel.appendChild(o);
    }
    sel.value = value;
    sel.addEventListener("change", () => onChange(sel.value));
    wrap.appendChild(sel);
    return wrap;
  }

  /** @param {string} label @param {() => void} fn @param {string} [cls] */
  function button(label, fn, cls = "") {
    const b = /** @type {HTMLButtonElement} */ (el("button", `gog-plus-bar-btn ${cls}`.trim(), label));
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }

  function buildBar() {
    const s = state.settings;
    const Cat = window.GOGPlusCatalogTools;
    const bar = el("div", "gog-plus-catbar");
    bar.id = "gog-plus-catbar";
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "GOG Enhancer catalog tools");

    bar.appendChild(
      selectField(
        "Sort this page",
        "gog-plus-cat-sort",
        [
          ["default", "As the site ordered them"],
          ["discount", "Biggest discount"],
          ["price-asc", "Price: low to high"],
          ["price-desc", "Price: high to low"],
          ["near-low", "Closest to my tracked low"],
          ["title", "Title A–Z"],
        ],
        sortMode,
        (v) => {
          sortMode = /** @type {any} */ (v);
          applyTiles();
        }
      )
    );
    bar.appendChild(
      selectField(
        "Owned games",
        "gog-plus-cat-owned",
        [
          ["show", "Show"],
          ["dim", "Dim"],
          ["hide", "Hide"],
        ],
        s.ownedDisplay,
        (v) => window.GOGPlusStorage.set({ ownedDisplay: v })
      )
    );
    bar.appendChild(
      selectField(
        "Grid",
        "gog-plus-cat-density",
        [
          ["normal", "Normal"],
          ["compact", "Compact"],
        ],
        s.catalogDensity,
        (v) => window.GOGPlusStorage.set({ catalogDensity: v })
      )
    );

    const hist = /** @type {HTMLLabelElement} */ (el("label", "gog-plus-bar-check"));
    const histBox = /** @type {HTMLInputElement} */ (el("input"));
    histBox.type = "checkbox";
    histBox.checked = historyOnly;
    histBox.addEventListener("change", () => {
      historyOnly = histBox.checked;
      applyTiles();
    });
    hist.append(histBox, " Only games I've tracked");
    bar.appendChild(hist);

    const endless = /** @type {HTMLLabelElement} */ (el("label", "gog-plus-bar-check"));
    endless.title = "Add the next page when you reach the end (asks GOG's catalog API; see Advanced Options)";
    const endlessBox = /** @type {HTMLInputElement} */ (el("input"));
    endlessBox.type = "checkbox";
    endlessBox.id = "gog-plus-cat-endless";
    endlessBox.checked = !!s.endlessCatalog;
    endlessBox.addEventListener("change", () => window.GOGPlusStorage.set({ endlessCatalog: endlessBox.checked }));
    endless.append(endlessBox, " Endless scrolling");
    bar.appendChild(endless);

    const selectBtn = button(selectMode ? "Done selecting" : "Select games", () => {
      selectMode = !selectMode;
      if (!selectMode) selected.clear();
      rebuildBar();
      applyTiles();
    });
    selectBtn.id = "gog-plus-cat-select";
    bar.appendChild(selectBtn);

    // Saved searches
    const presets = s.catalogPresets || {};
    const names = Object.keys(presets).sort((a, b) => a.localeCompare(b));
    const here = `${location.pathname}${location.search}`;
    const presetWrap = el("span", "gog-plus-bar-presets");
    if (names.length) {
      presetWrap.appendChild(
        selectField(
          "Saved searches",
          "gog-plus-cat-presets",
          [["", "Choose…"], ...names.map(/** @returns {[string, string]} */ (n) => [presets[n], n])],
          presets[names.find((n) => presets[n] === here) || ""] || "",
          (v) => {
            if (v) location.assign(v);
          }
        )
      );
    }
    const matching = names.find((n) => presets[n] === here);
    if (matching) {
      presetWrap.appendChild(
        button("Remove this search", async () => {
          const next = { ...presets };
          delete next[matching];
          state.settings.catalogPresets = next;
          await window.GOGPlusStorage.set({ catalogPresets: next });
          rebuildBar();
        })
      );
    } else if (Cat.sanitizePresetUrl(here)) {
      presetWrap.appendChild(
        button("Save this search", async () => {
          const name = window.prompt("Name for this search:", Cat.suggestPresetName(here));
          if (!name) return;
          const next = Cat.addPreset(presets, name, here);
          state.settings.catalogPresets = next;
          await window.GOGPlusStorage.set({ catalogPresets: next });
          rebuildBar();
        })
      );
    }
    bar.appendChild(presetWrap);

    const status = el("span", "gog-plus-bar-status");
    status.id = "gog-plus-cat-status";
    status.setAttribute("role", "status");
    bar.appendChild(status);

    if (selectMode) {
      const sel = el("div", "gog-plus-bar-selection");
      sel.id = "gog-plus-cat-selection";
      const count = el("span", "", "");
      count.id = "gog-plus-cat-selcount";
      const tagInput = /** @type {HTMLInputElement} */ (el("input"));
      tagInput.type = "text";
      tagInput.placeholder = "Tag for selected…";
      tagInput.maxLength = 40;
      tagInput.id = "gog-plus-cat-tag";
      sel.append(
        count,
        tagInput,
        button("Tag", async () => {
          await tagSelected(tagInput.value);
          tagInput.value = "";
          applyTiles();
        }),
        button("Not interested", hideSelected),
        button("Compare", () => {
          for (const slug of selected) {
            const t = pageTiles().find((x) => x.tile.slug === slug);
            if (t && compare.size < MAX_COMPARE) compare.set(slug, t.model);
          }
          selected.clear();
          applyTiles();
          openComparison();
        }),
        button("Clear", () => {
          selected.clear();
          applyTiles();
        })
      );
      bar.appendChild(sel);
    }
    return bar;
  }

  /** @param {{ total: number, shown: number, hiddenByInterest: number }} info */
  function updateBar(info) {
    const status = document.getElementById("gog-plus-cat-status");
    if (status) {
      const parts = [`Showing ${info.shown} of ${info.total}`];
      if (info.hiddenByInterest) parts.push(`${info.hiddenByInterest} hidden as not interested`);
      setText(status, parts.join(" · "));
    }
    let toggle = document.getElementById("gog-plus-cat-hidden");
    const bar = document.getElementById("gog-plus-catbar");
    const totalHidden = Object.keys(state.settings.notInterested || {}).length;
    if (bar && totalHidden && !toggle) {
      toggle = button("", () => {
        window.GOGPlusStorage.set({ hideNotInterested: !state.settings.hideNotInterested });
      });
      toggle.id = "gog-plus-cat-hidden";
      bar.insertBefore(toggle, document.getElementById("gog-plus-cat-status"));
    }
    if (toggle) {
      setText(toggle, state.settings.hideNotInterested ? `Show ${totalHidden} hidden` : "Hide not-interested again");
      toggle.hidden = !totalHidden;
    }
    const sc = document.getElementById("gog-plus-cat-selcount");
    if (sc) setText(sc, `${selected.size} selected`);
  }

  function rebuildBar() {
    document.getElementById("gog-plus-catbar")?.remove();
    ensureCatalogBar();
  }

  /** Mounts (or re-mounts) the bar above the grid. */
  function ensureCatalogBar() {
    if (!state.settings.catalogTools || Dom.pageType() !== "store") {
      document.getElementById("gog-plus-catbar")?.remove();
      return;
    }
    const grid = Dom.catalogGrid();
    if (!grid || !grid.parentElement) return;
    const existing = document.getElementById("gog-plus-catbar");
    if (existing && existing.nextElementSibling === grid) return;
    existing?.remove();
    grid.parentElement.insertBefore(buildBar(), grid);
  }

  /**
   * One pass, called from processAll. On store pages it mounts the bar and
   * applies sort/density/visibility; elsewhere (home, promo pages) it only
   * applies the owned / not-interested visibility, so a game you have hidden
   * stays hidden in the carousels too.
   */
  function applyCatalog() {
    if (!state.settings.catalogTools) {
      clearCatalog();
      return;
    }
    const type = Dom.pageType();
    if (type === "store") {
      ensureCatalogBar();
      applyTiles();
    } else {
      // Not a catalog page: the bar must not outlive its page.
      document.getElementById("gog-plus-catbar")?.remove();
      if (type === "home" || type === "promo") applyTilesVisibilityOnly();
    }
  }

  function applyTilesVisibilityOnly() {
    const s = state.settings;
    const Cat = window.GOGPlusCatalogTools;
    for (const { tile, model } of pageTiles()) {
      const v = Cat.tileVisibility(model, {
        ownedDisplay: s.ownedDisplay,
        hideNotInterested: s.hideNotInterested,
        notInterested: s.notInterested,
        ownedSlugs: s.ownedSlugs,
      });
      tile.el.classList.toggle("gog-plus-tile-hidden", v.hidden);
      tile.el.classList.toggle("gog-plus-tile-dim", v.dim);
    }
  }

  /** Undoes everything this module did to the page (feature switched off). */
  function clearCatalog() {
    document.getElementById("gog-plus-catbar")?.remove();
    document.getElementById("gog-plus-compare-tray")?.remove();
    document.querySelectorAll(".gog-plus-tile-hidden, .gog-plus-tile-dim, .gog-plus-tile-selected").forEach((e) => {
      e.classList.remove("gog-plus-tile-hidden", "gog-plus-tile-dim", "gog-plus-tile-selected");
    });
    document.querySelectorAll(".gog-plus-tilectl").forEach((e) => e.remove());
    document.querySelectorAll(".gog-plus-grid--compact").forEach((e) => e.classList.remove("gog-plus-grid--compact"));
    for (const { tile } of pageTiles()) tile.el.style.removeProperty("order");
  }

  // Data written elsewhere (another tab, the dashboard, a sync) — re-apply.
  document.addEventListener("gog-plus:data", (e) => {
    const key = /** @type {CustomEvent} */ (e).detail?.key;
    if (["ownedSlugs", "notInterested", "catalogPresets", "ownedDisplay", "hideNotInterested", "catalogDensity"].includes(key)) {
      if (key === "catalogPresets") rebuildBar();
      applyCatalog();
    }
  });

  window.GOGPlusCatalog = {
    applyCatalog,
    clearCatalog,
    ensureCatalogBar,
    // Test hooks
    _state: {
      get sortMode() {
        return sortMode;
      },
      selected,
      compare,
      reset() {
        sortMode = "default";
        historyOnly = false;
        selectMode = false;
        selected.clear();
        compare.clear();
      },
    },
  };
})();
