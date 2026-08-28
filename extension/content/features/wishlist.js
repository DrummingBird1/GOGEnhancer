/**
 * GOG+ wishlist feature: quick filter chips (sale / under $10 / under $25 /
 * rated 4.5+ / by genre) with live counts, and the content-script→
 * background round-trip that reports the discounted-item count for the
 * toolbar badge (see background/background.js and CLAUDE.md's "wishlist
 * badge dance" section — the SW can't scrape /account/wishlist directly,
 * it's an Angular SPA route). Pulled out of the former single-file
 * content.js during the v2.8.0 module split.
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusContentState;
  const { debounce, slugFromHref } = window.GOGPlusContentUtils;
  const { priceInUsdFromText } = window.GOGPlusCurrencyFeature;
  const { GENRE_PATTERNS, matchGenrePattern } = window.GOGPlusGenres;

  /* ============== wishlist filters ============== */

  function ensureWishlistFilters() {
    if (!state.settings.wishlistFilters) return;
    if (!location.pathname.includes("/account/wishlist")) return;
    if (document.getElementById("gog-plus-wlfilters")) return;

    const target = document.querySelector("main, [class*='wishlist']");
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

    bar.addEventListener("click", (e) => {
      const btn = /** @type {HTMLElement} */ (e.target).closest("button");
      if (!btn) return;
      bar.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyWishlistFilter(/** @type {HTMLElement} */ (btn).dataset.f);
    });

    // Live counts: recompute when the wishlist DOM mutates (debounced).
    const observer = new MutationObserver(debounce(() => updateWishlistFilterCounts(bar), 400));
    observer.observe(target, { childList: true, subtree: true });
    state.observers.push(observer);
    setTimeout(() => updateWishlistFilterCounts(bar), 800);

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
    const cards = Array.from(document.querySelectorAll('a[href*="/game/"]'));
    const counts = { all: 0, sale: 0, under10: 0, under25: 0, rated45: 0 };
    const genreCounts = {};
    const seen = new Set();
    for (const c of cards) {
      const slug = slugFromHref(c.getAttribute("href"));
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      counts.all++;
      const txt = c.textContent || "";
      if (/-\d{1,2}%/.test(txt)) counts.sale++;
      const usdEq = priceInUsdFromText(txt);
      if (usdEq !== null && usdEq < 10) counts.under10++;
      if (usdEq !== null && usdEq < 25) counts.under25++;
      const ratingMatch = txt.match(/(\d\.\d)\s*\d+\s*reviews/);
      if (ratingMatch && parseFloat(ratingMatch[1]) >= 4.5) counts.rated45++;
      const genre = matchGenrePattern(slug);
      if (genre) genreCounts[genre] = (genreCounts[genre] || 0) + 1;
    }
    bar.querySelectorAll("button[data-f]").forEach((btn) => {
      const f = btn.dataset.f;
      const span = btn.querySelector(".gog-plus-wlfilter-count");
      if (!span) return;
      const n = counts[f];
      span.textContent = n > 0 ? String(n) : "";
    });

    // Rebuild the genre row from scratch — entries appear/disappear as the
    // wishlist mutates, so we don't try to diff in place.
    const genreHost = bar.querySelector("#gog-plus-wlfilters-genres");
    if (!genreHost) return;
    const existing = Object.fromEntries(
      [...genreHost.querySelectorAll("button[data-f]")].map((b) => [b.dataset.f, b])
    );
    const activeFilter = bar.querySelector("button.active")?.dataset.f;
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
      const cards = Array.from(document.querySelectorAll('a[href*="/game/"]'));
      let total = 0;
      let discounted = 0;
      const seen = new Set();
      for (const c of cards) {
        const slug = slugFromHref(c.getAttribute("href"));
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        total++;
        const txt = c.textContent || "";
        if (/-\d{1,2}%/.test(txt)) discounted++;
      }

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
            slugs: [...seen],
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
    const cards = document.querySelectorAll('a[href*="/game/"]');
    const genreMatch = mode.startsWith("genre-") ? mode.slice(6) : null;
    const genrePattern = genreMatch
      ? GENRE_PATTERNS.find((g) => g.genre === genreMatch)?.re
      : null;

    cards.forEach((c) => {
      const slug = slugFromHref(c.getAttribute("href"));
      const txt = c.textContent || "";
      const usdEq = priceInUsdFromText(txt);
      const ratingMatch = txt.match(/(\d\.\d)\s*\d+\s*reviews/);
      const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

      let show = true;
      if (mode === "sale") show = /-\d+%/.test(txt);
      else if (mode === "under10") show = usdEq !== null && usdEq < 10;
      else if (mode === "under25") show = usdEq !== null && usdEq < 25;
      else if (mode === "rated45") show = rating !== null && rating >= 4.5;
      else if (genreMatch) {
        const cachedGenre = slug && state.settings.gameGenres && state.settings.gameGenres[slug];
        show = cachedGenre ? cachedGenre === genreMatch : !!slug && !!genrePattern && genrePattern.test(slug);
      }

      c.classList.toggle("gog-plus-filtered-out", !show);
    });
  }

  window.GOGPlusWishlistFeature = {
    ensureWishlistFilters,
    updateWishlistFilterCounts,
    reportWishlistCount,
    applyWishlistFilter,
  };
})();
