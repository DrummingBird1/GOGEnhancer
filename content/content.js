/**
 * GOG+ content script v2.
 *
 * Orchestrates every on-page enhancement:
 *   - Currency conversion (auto-detects page currency)
 *   - VAT estimation
 *   - 30-day refund + DRM-free badges
 *   - Era-aware card styling (retro for "Good Old Game", neon for cyberpunk)
 *   - Mod indicators (from dynamic mods list cache)
 *   - Hide expired sales
 *   - Hebrew translations + RTL
 *   - Custom tags & notes panel with autocomplete
 *   - Wishlist quick filters
 *   - Price history mini-chart on game pages
 *   - IsThereAnyDeal compare button
 *   - Refund window timer for owned games
 *   - Toast feedback on settings changes
 *
 * The page is an Angular SPA, so we observe targeted containers
 * with debounced re-runs.
 */

(() => {
  "use strict";

  /* ============== state & defaults ============== */

  const DEFAULTS = window.GOG_PLUS_DEFAULTS;

  let settings = { ...DEFAULTS };
  let pageCurrency = { code: "USD", symbol: "$" };
  let observers = [];

  /* ============== utils ============== */

  const debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  const log = (...a) => {
    if (settings.debugLogging || window.GOG_PLUS_DEBUG) console.log("[GOG+]", ...a);
  };

  const symbolFor = (cur) =>
    ({
      ILS: "₪",
      EUR: "€",
      GBP: "£",
      RUB: "₽",
      PLN: "zł",
      USD: "$",
    }[cur] || cur);

  const formatPrice = (value, cur) => {
    if (cur === "RUB" || cur === "ILS") {
      return `${symbolFor(cur)}${Math.round(value)}`;
    }
    return `${symbolFor(cur)}${value.toFixed(2)}`;
  };

  const slugFromHref = (href) => {
    const m = (href || "").match(/\/game\/([a-z0-9_]+)/);
    return m ? m[1] : null;
  };

  const escapeHtml = (s) => {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const slugFromLocation = () =>
    slugFromHref(location.pathname);

  const gameTitleFromPage = () => {
    const h1 =
      document.querySelector("h1.productcard-basics__title") ||
      document.querySelector("h1[class*='product'][class*='title']") ||
      document.querySelector("h1");
    if (h1) return (h1.textContent || "").trim();
    const og = document.querySelector("meta[property='og:title']");
    if (og) return (og.getAttribute("content") || "").replace(/\s*on GOG\.com\s*$/, "");
    return null;
  };

  // Pulls the last price token from `txt` (assumed to be in pageCurrency),
  // converts it to USD via the rate matrix so filters like "Under $10" work
  // regardless of which locale GOG is showing the user.
  function priceInUsdFromText(txt) {
    const sym = pageCurrency.symbol;
    if (!sym || !txt) return null;
    const escSym = sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = txt.match(new RegExp(escSym + "\\s?[\\d.,]+", "g"));
    if (!matches?.length) return null;
    const native = window.GOGPlusCurrency.parsePrice(
      matches[matches.length - 1],
      pageCurrency.code
    );
    if (native == null) return null;
    if (pageCurrency.code === "USD") return native;
    const rate = settings.rates[pageCurrency.code];
    return rate ? native / rate : null;
  }

  // Genre-aware card detection. Cyberpunk + Witcher have their own neon
  // class so they're intentionally excluded here. First match wins per slug.
  const GENRE_PATTERNS = [
    {
      genre: "horror",
      re: /silent_hill|resident_evil|amnesia|outlast|alien_isolation|dead_space|the_evil_within|dying_light|layers_of_fear|^soma$|scorn|callisto/i,
    },
    {
      genre: "strategy",
      re: /civilization|stellaris|crusader_kings|hearts_of_iron|europa_universalis|total_war|age_of_empires|starcraft|^anno|tropico|company_of_heroes|frostpunk/i,
    },
    {
      genre: "scifi",
      re: /mass_effect|deus_ex|system_shock|^prey|subnautica|no_mans_sky|star_wars|halo|^doom|outer_wilds|outer_worlds|^stray$|disco_elysium/i,
    },
    {
      genre: "rpg",
      re: /baldurs_gate|divinity|pillars_of_eternity|pathfinder|neverwinter|planescape|dragon_age|kingdom_come|^gothic|^risen|dark_souls|elden_ring|skyrim|morrowind|oblivion|fallout|wasteland|tyranny/i,
    },
    {
      genre: "indie",
      re: /stardew|hollow_knight|cuphead|^hades|celeste|undertale|dead_cells|terraria|factorio|rimworld|^inside|^limbo|owlboy|tunic|cocoon/i,
    },
  ];

  /* ============== currency conversion ============== */

  // Convert from any source currency to settings.targetCurrency via the USD
  // rate matrix. `rates` is { CUR: <units per USD> } so `amount / srcRate`
  // gives USD, then `* tgtRate` gives the target currency.
  function convertedFromCurrency(amount, srcCur) {
    const targetCur = settings.targetCurrency;
    if (!targetCur || targetCur === "none") return null;
    if (srcCur === targetCur) return null;
    const srcRate = srcCur === "USD" ? 1 : settings.rates[srcCur];
    const tgtRate = targetCur === "USD" ? 1 : settings.rates[targetCur];
    if (!srcRate || !tgtRate) return null;
    let v = (amount / srcRate) * tgtRate;
    if (settings.taxEstimator && settings.vatPercent > 0) {
      v *= 1 + settings.vatPercent / 100;
    }
    return v;
  }

  function applyCurrencyConversion(root = document) {
    if (!settings.currencyConverter || settings.targetCurrency === "none") return;
    if (pageCurrency.code === settings.targetCurrency) return; // already in target

    const srcSym = pageCurrency.symbol;
    if (!srcSym) return;
    const escSym = srcSym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const symRe = new RegExp(escSym + "\\s?\\d");

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.length > 80) return NodeFilter.FILTER_REJECT;
        if (!symRe.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.classList.contains("gog-plus-converted")) return NodeFilter.FILTER_REJECT;
        if (parent.closest(".gog-plus-banner, .gog-plus-tooltip, .gog-plus-toasts"))
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const targets = [];
    let n;
    while ((n = walker.nextNode())) targets.push(n);

    for (const node of targets) {
      const price = window.GOGPlusCurrency.parsePrice(node.nodeValue, pageCurrency.code);
      if (!price) continue;
      const value = convertedFromCurrency(price, pageCurrency.code);
      if (value === null) continue;

      const note = document.createElement("span");
      note.className = "gog-plus-conv-note";
      note.textContent = ` ≈ ${formatPrice(value, settings.targetCurrency)}`;
      if (settings.taxEstimator && settings.vatPercent > 0) {
        note.classList.add("gog-plus-with-tax");
      }
      if (settings.richTooltips) {
        const taxLine =
          settings.taxEstimator && settings.vatPercent > 0
            ? `<br>+${settings.vatPercent}% VAT included`
            : "";
        note.dataset.gogPlusTip = `
          <strong>Conversion details</strong><br>
          ${formatPrice(price, pageCurrency.code)} ${pageCurrency.code} → ${formatPrice(
            value,
            settings.targetCurrency
          )}${taxLine}
        `;
      } else {
        note.title = `${formatPrice(price, pageCurrency.code)} → ${formatPrice(value, settings.targetCurrency)}`;
      }
      node.parentElement.classList.add("gog-plus-converted");
      node.parentElement.appendChild(note);
    }
  }

  /* ============== card badges (refund / mod / era) ============== */

  function applyCardBadges(root = document) {
    // Tighter selector: skip cards we already processed, and only consider
    // anchors that have an image AND aren't tiny carousel previews.
    const cards = root.querySelectorAll('a[href*="/game/"]:not(.gog-plus-card-done)');
    const seenSlugs = new Set();
    cards.forEach((card) => {
      const img = card.querySelector("img, picture");
      if (!img) return;

      // Many GOG cards are duplicate anchors (cover-link + body-link wrap the
      // same product). De-dupe per slug so we don't stamp twice.
      const slug = slugFromHref(card.getAttribute("href"));
      if (!slug) return;
      if (seenSlugs.has(slug)) return;

      // Find a SAFE host for the absolute-positioned strip: the smallest
      // ancestor of the cover image that is NOT the card itself.
      // GOG's carousel/preview overlays already use positioned ancestors,
      // so modifying the card root explodes their layout.
      let host = img.parentElement;
      if (!host || host === card) return;

      // Walk up at most 2 levels until we find a wrapper that is clearly
      // a cover wrapper (smaller than the card). Stop before reaching the card.
      const cardRect = card.getBoundingClientRect();
      let hops = 0;
      while (host && host !== card && hops < 3) {
        const r = host.getBoundingClientRect();
        const isCoverSized =
          r.width > 0 && r.height > 0 &&
          r.width <= cardRect.width * 0.75 &&
          r.height <= cardRect.height * 0.95;
        if (isCoverSized) break;
        host = host.parentElement;
        hops++;
      }
      if (!host || host === card) return;

      seenSlugs.add(slug);
      card.classList.add("gog-plus-card-done");
      card.classList.add("gog-plus-card");

      // Mark the chosen cover host so CSS scopes badges to it.
      host.classList.add("gog-plus-cover-host");
      // Ensure positioning context exists WITHOUT !important.
      const computedPos = getComputedStyle(host).position;
      if (computedPos === "static") {
        host.style.position = "relative";
      }

      // Era-aware styling — applied to the cover host, not the whole card.
      const isClassic = !!card.querySelector(
        '[class*="good-old-game"], [class*="goodOldGame"]'
      ) || /good old game/i.test(card.textContent || "");
      if (isClassic && settings.designInjection) {
        host.classList.add("gog-plus-cover--classic");
      }
      if (/cyberpunk|witcher/i.test(slug) && settings.designInjection) {
        host.classList.add("gog-plus-cover--neon");
      }
      if (settings.designInjection) {
        for (const { genre, re } of GENRE_PATTERNS) {
          if (re.test(slug)) {
            host.classList.add(`gog-plus-cover--genre-${genre}`);
            break;
          }
        }
      }

      const strip = document.createElement("div");
      strip.className = "gog-plus-badges";

      if (settings.refundBadge) {
        const b = document.createElement("span");
        b.className = "gog-plus-badge gog-plus-badge-refund";
        b.innerHTML = `<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
          <path d="M6 1L1 4v3c0 2.5 2 4.5 5 5 3-.5 5-2.5 5-5V4L6 1z"
            fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
          <path d="M4 6l1.5 1.5L8 5" fill="none" stroke="currentColor" stroke-width="1.4"
            stroke-linecap="round" stroke-linejoin="round"/>
        </svg>30-day refund`;
        if (settings.richTooltips) {
          b.dataset.gogPlusTip =
            "<strong>30-day refund</strong><br>GOG offers a money-back guarantee within 30 days, no questions asked.";
        } else {
          b.title = "30-day money-back guarantee";
        }
        strip.appendChild(b);
      }

      if (
        settings.modIndicator &&
        Array.isArray(settings.modsList) &&
        settings.modsList.includes(slug)
      ) {
        const m = document.createElement("span");
        m.className = "gog-plus-badge gog-plus-badge-mod";
        m.textContent = "★ MOD";
        if (settings.richTooltips) {
          m.dataset.gogPlusTip =
            "<strong>★ One-click Mods</strong><br>This game has GOG-curated mods that install with a single click.";
        } else {
          m.title = "One-click Mods available";
        }
        strip.appendChild(m);
      }

      if (strip.childNodes.length) {
        host.appendChild(strip);
        host.classList.add("gog-plus-cover-host--has-badges");
      }
    });
  }

  /* ============== hide expired sales ============== */

  function hideExpiredSales(root = document) {
    if (!settings.hideExpiredSales) return;
    const candidates = root.querySelectorAll(
      'a[href*="/promo/"]:not(.gog-plus-promo-done)'
    );
    const currentYear = new Date().getFullYear();
    candidates.forEach((el) => {
      el.classList.add("gog-plus-promo-done");
      // Match year only when it sits inside the URL slug — between separators
      // or at a path boundary. Card text often mentions years for unrelated
      // reasons ("top games of 2024") and would false-flag live promos.
      const href = (el.getAttribute("href") || "").toLowerCase();
      const yearMatch = href.match(/(?:^|[-_/])(20\d{2})(?:[-_/]|$)/);
      if (yearMatch) {
        const y = parseInt(yearMatch[1], 10);
        if (y < currentYear) {
          el.classList.add("gog-plus-expired");
          el.title = "This sale appears to have ended.";
        }
      }
    });
  }

  /* ============== DRM-free banner ============== */

  function ensureDrmFreeBanner() {
    if (!settings.drmFreeBanner) {
      document.getElementById("gog-plus-banner")?.remove();
      return;
    }
    if (document.getElementById("gog-plus-banner")) return;

    const banner = document.createElement("div");
    banner.id = "gog-plus-banner";
    banner.className = "gog-plus-banner";
    banner.innerHTML = `
      <div class="gog-plus-banner-inner">
        <span class="gog-plus-banner-shield" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path d="M12 2L4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5l-8-3z"
              fill="none" stroke="currentColor" stroke-width="1.6"
              stroke-linejoin="round"/>
            <path d="M8 12l3 3 5-6" fill="none" stroke="currentColor"
              stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="gog-plus-banner-text">
          <strong>You own what you buy.</strong>
          DRM-free installers · 30-day refund · Offline-capable · No platform lock-in
        </span>
        <span class="gog-plus-banner-pill">GOG Enhancer</span>
        <button class="gog-plus-banner-close" aria-label="Dismiss">×</button>
      </div>`;
    banner.querySelector(".gog-plus-banner-close").addEventListener("click", () => {
      window.GOGPlusStorage.set({ drmFreeBanner: false });
    });
    document.body.prepend(banner);
  }

  /* ============== Hebrew + RTL ============== */

  function applyHebrewTranslations(root = document) {
    if (!settings.hebrewTranslations) return;
    const dict = (window.GOG_PLUS_TRANSLATIONS || {}).exact || {};
    const patterns = (window.GOG_PLUS_TRANSLATIONS || {}).patterns || [];
    if (!Object.keys(dict).length && !patterns.length) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("script,style,code,pre,textarea,input"))
          return NodeFilter.FILTER_REJECT;
        if (parent.closest(".gog-plus-tooltip, .gog-plus-toasts"))
          return NodeFilter.FILTER_REJECT;
        if (parent.classList.contains("gog-plus-translated")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const targets = [];
    let n;
    while ((n = walker.nextNode())) targets.push(n);

    for (const node of targets) {
      const trimmed = node.nodeValue.trim();
      if (dict[trimmed]) {
        node.nodeValue = node.nodeValue.replace(trimmed, dict[trimmed]);
        node.parentElement?.classList.add("gog-plus-translated");
        continue;
      }
      for (const { re, fmt } of patterns) {
        const m = trimmed.match(re);
        if (m) {
          let out = fmt;
          for (let i = 1; i < m.length; i++) out = out.replace(`$${i}`, m[i]);
          node.nodeValue = node.nodeValue.replace(trimmed, out);
          node.parentElement?.classList.add("gog-plus-translated");
          break;
        }
      }
    }
  }

  function applyRtlLayout() {
    document.documentElement.classList.toggle("gog-plus-rtl", !!settings.rtlLayout);
  }

  /* ============== wishlist filters ============== */

  function ensureWishlistFilters() {
    if (!settings.wishlistFilters) return;
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
      const btn = e.target.closest("button");
      if (!btn) return;
      bar.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyWishlistFilter(btn.dataset.f);
    });

    // Live counts: recompute when the wishlist DOM mutates (debounced).
    const observer = new MutationObserver(debounce(() => updateWishlistFilterCounts(bar), 400));
    observer.observe(target, { childList: true, subtree: true });
    observers.push(observer);
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
      for (const { genre, re } of GENRE_PATTERNS) {
        if (re.test(slug)) {
          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
          break;
        }
      }
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
      else if (genrePattern) show = !!slug && genrePattern.test(slug);

      c.classList.toggle("gog-plus-filtered-out", !show);
    });
  }

  /* ============== game page enhancements ============== */

  async function enhanceGamePage() {
    const slug = slugFromLocation();
    if (!slug) return;
    if (!document.querySelector("h1, [class*='product']")) return;

    await Promise.all([
      maybeRecordPriceHistory(slug),
      ensureGamePagePanel(slug),
    ]);
  }

  async function maybeRecordPriceHistory(slug) {
    if (!settings.priceHistoryTracking) return;
    // Find current price text on the page
    const priceContainers = document.querySelectorAll(
      '[class*="product-actions-price"], [class*="ProductActionsPrice"], [class*="price-text"], [class*="product-price"]'
    );
    let price = null;
    for (const el of priceContainers) {
      const txt = el.textContent || "";
      const p = window.GOGPlusCurrency.parsePrice(txt, pageCurrency.code);
      if (p && (price === null || p < price)) price = p;
    }
    if (price !== null) {
      await window.GOGPlusPriceHistory.record(slug, price, pageCurrency.code);
    }
  }

  async function ensureGamePagePanel(slug) {
    const existing = document.getElementById("gog-plus-gamepanel");
    if (existing?.dataset.slug === slug) return;
    existing?.remove();

    const anchor =
      document.querySelector("h1") ||
      document.querySelector("[class*='product'] h1") ||
      document.querySelector("main");
    if (!anchor) return;

    const panel = document.createElement("aside");
    panel.id = "gog-plus-gamepanel";
    panel.className = "gog-plus-gamepanel";
    panel.dataset.slug = slug;
    // Hero blur: use the page's og:image (the cover art) as a heavily-blurred
    // backdrop on the panel. Only http(s) URLs to avoid mixed-content issues.
    const heroUrl = document
      .querySelector('meta[property="og:image"]')
      ?.getAttribute("content");
    if (heroUrl && /^https?:\/\//.test(heroUrl)) {
      panel.style.setProperty("--gp-hero-url", `url("${heroUrl.replace(/"/g, "")}")`);
      panel.classList.add("gog-plus-gamepanel--has-hero");
    }
    panel.innerHTML = `
      <header class="gog-plus-gp-header">
        <span class="gog-plus-gp-title">GOG Enhancer insights</span>
        <span class="gog-plus-gp-pill">★</span>
      </header>
      <div class="gog-plus-gp-body" id="gog-plus-gp-body"></div>
    `;
    anchor.parentElement?.insertBefore(panel, anchor.nextSibling);

    const body = panel.querySelector("#gog-plus-gp-body");

    if (settings.priceHistoryTracking) {
      body.appendChild(await renderPriceHistorySection(slug));
    }
    if (settings.refundTimer) {
      body.appendChild(await renderRefundSection(slug));
    }
    if (settings.itadCompare) {
      body.appendChild(renderItadSection(slug));
    }
    if (settings.customTags) {
      body.appendChild(await renderTagsSection(slug));
    }
  }

  async function renderPriceHistorySection(slug) {
    const wrap = document.createElement("section");
    wrap.className = "gog-plus-gp-section";
    const stats = await window.GOGPlusPriceHistory.stats(slug);
    if (!stats) {
      wrap.innerHTML = `
        <h3>Price history</h3>
        <p class="gog-plus-gp-muted">No history yet — we'll start tracking from this visit.</p>`;
      return wrap;
    }
    const entries = await window.GOGPlusPriceHistory.get(slug);
    const sym = symbolFor(stats.currency);
    const lowest = `${sym}${stats.min.price.toFixed(2)}`;
    const current = `${sym}${stats.latest.p.toFixed(2)}`;
    const since = stats.first.d;
    const isAtLow = stats.latest.p === stats.min.price;
    const cheer = isAtLow && stats.count >= 3
      ? `<div class="gog-plus-allmtl-cheer" role="status">
           <span class="gog-plus-allmtl-dot"></span>
           At all-time low — best price since ${since}
         </div>`
      : "";
    wrap.innerHTML = `
      <h3>Price history <span class="gog-plus-gp-since">since ${since}</span></h3>
      ${cheer}
      <div class="gog-plus-pricestat-grid">
        <div class="gog-plus-pricestat">
          <span class="gog-plus-pricestat-label">Current</span>
          <span class="gog-plus-pricestat-value ${isAtLow ? "is-low" : ""}">${current}</span>
        </div>
        <div class="gog-plus-pricestat">
          <span class="gog-plus-pricestat-label">All-time low</span>
          <span class="gog-plus-pricestat-value">${lowest}</span>
        </div>
        <div class="gog-plus-pricestat">
          <span class="gog-plus-pricestat-label">Average</span>
          <span class="gog-plus-pricestat-value">${sym}${stats.avg.toFixed(2)}</span>
        </div>
        <div class="gog-plus-pricestat">
          <span class="gog-plus-pricestat-label">Snapshots</span>
          <span class="gog-plus-pricestat-value">${stats.count}</span>
        </div>
      </div>
      ${renderSparkline(entries, stats, slug)}
    `;
    return wrap;
  }

  function renderSparkline(entries, stats, slug) {
    if (!entries || entries.length < 2) {
      return `<p class="gog-plus-gp-muted gog-plus-spark-empty">Need at least 2 snapshots for a chart — keep visiting!</p>`;
    }
    const W = 320;
    const H = 80;
    const PAD_X = 6;
    const PAD_Y = 10;
    const prices = entries.map((e) => e.p);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const rangeP = maxP - minP || 1;
    const innerW = W - PAD_X * 2;
    const innerH = H - PAD_Y * 2;
    const points = entries.map((e, i) => {
      const x = PAD_X + (i / (entries.length - 1)) * innerW;
      const y = PAD_Y + innerH - ((e.p - minP) / rangeP) * innerH;
      return [x, y];
    });
    const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${(H - PAD_Y).toFixed(1)} L${points[0][0].toFixed(1)},${(H - PAD_Y).toFixed(1)} Z`;
    const minIdx = prices.indexOf(minP);
    const lastIdx = points.length - 1;
    const sym = symbolFor(stats.currency);
    const gradId = `gpSparkFill-${slug}`;

    // Detect ≥30% drops between consecutive snapshots — these are likely sale events
    const saleMarkers = [];
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1].p;
      const curr = entries[i].p;
      if (prev > 0 && (prev - curr) / prev >= 0.3) {
        const dropPct = Math.round(((prev - curr) / prev) * 100);
        saleMarkers.push({
          x: points[i][0],
          tip: `<strong>-${dropPct}% drop</strong><br>${sym}${prev.toFixed(2)} → ${sym}${curr.toFixed(2)}<br>${entries[i].d}`,
        });
      }
    }
    const saleLines = saleMarkers.map((m) => `
      <line x1="${m.x.toFixed(1)}" y1="${PAD_Y}" x2="${m.x.toFixed(1)}" y2="${H - PAD_Y}"
        stroke="#5cff9d" stroke-width="1" stroke-dasharray="2,2" opacity="0.55"/>
      <circle cx="${m.x.toFixed(1)}" cy="4" r="3" fill="#5cff9d" stroke="#0a0612" stroke-width="1"
        data-gog-plus-tip="${m.tip}" style="cursor: help;"/>
    `).join("");

    // Invisible larger hover targets on every data point — must render BEFORE the
    // colored marker circles so the named circles win the hit test at their position.
    const hoverDots = entries.map((e, i) => {
      const [x, y] = points[i];
      const tip = `<strong>${sym}${e.p.toFixed(2)}</strong><br>${e.d}`;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="transparent" data-gog-plus-tip="${tip}" style="cursor: crosshair;"/>`;
    }).join("");

    return `
      <div class="gog-plus-spark">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-label="Price history sparkline">
          <defs>
            <linearGradient id="${gradId}" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#c64fff" stop-opacity="0.5"/>
              <stop offset="100%" stop-color="#c64fff" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path d="${areaPath}" fill="url(#${gradId})"/>
          <path d="${linePath}" fill="none" stroke="#00f0ff" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
          ${saleLines}
          ${hoverDots}
          <circle cx="${points[minIdx][0].toFixed(1)}" cy="${points[minIdx][1].toFixed(1)}" r="3.5" fill="#5cff9d" stroke="#0a0612" stroke-width="1.5"
            data-gog-plus-tip="<strong>All-time low</strong><br>${sym}${minP.toFixed(2)} on ${entries[minIdx].d}" style="cursor: help;"/>
          <circle cx="${points[lastIdx][0].toFixed(1)}" cy="${points[lastIdx][1].toFixed(1)}" r="3.5" fill="#c64fff" stroke="#0a0612" stroke-width="1.5"
            data-gog-plus-tip="<strong>Latest</strong><br>${sym}${entries[lastIdx].p.toFixed(2)} on ${entries[lastIdx].d}" style="cursor: help;"/>
        </svg>
        <div class="gog-plus-spark-legend">
          <span><i class="dot dot-low"></i>All-time low</span>
          <span><i class="dot dot-now"></i>Latest</span>
          ${saleMarkers.length ? `<span><i class="dot dot-sale"></i>Sale (-30%+)</span>` : ""}
        </div>
      </div>
    `;
  }

  async function renderRefundSection(slug) {
    const { purchaseLog = {} } = await window.GOGPlusStorage.get({ purchaseLog: {} });
    const purchased = purchaseLog[slug] || "";
    const today = new Date().toISOString().slice(0, 10);
    const wrap = document.createElement("section");
    wrap.className = "gog-plus-gp-section";
    wrap.innerHTML = `
      <h3>Refund window</h3>
      <p class="gog-plus-gp-muted">
        Mark when you bought this and we'll count down GOG's 30-day refund window.
      </p>
      <div class="gog-plus-refund-row">
        <label for="gog-plus-purchase-date">Purchased on</label>
        <input type="date" id="gog-plus-purchase-date" max="${today}" value="${escapeHtml(purchased)}" />
        <button type="button" class="gog-plus-refund-clear" id="gog-plus-refund-clear" title="Clear date">×</button>
      </div>
      <div id="gog-plus-refund-status" class="gog-plus-refund-status" role="status"></div>
    `;

    setTimeout(() => {
      const input = wrap.querySelector("#gog-plus-purchase-date");
      const status = wrap.querySelector("#gog-plus-refund-status");
      const clearBtn = wrap.querySelector("#gog-plus-refund-clear");

      const renderStatus = (d) => {
        status.className = "gog-plus-refund-status";
        if (!d) {
          status.textContent = "";
          return;
        }
        const purchaseDate = new Date(d + "T00:00:00");
        if (Number.isNaN(purchaseDate.getTime())) {
          status.textContent = "";
          return;
        }
        const expiresAt = purchaseDate.getTime() + 30 * 24 * 60 * 60 * 1000;
        const msLeft = expiresAt - Date.now();
        const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
        if (daysLeft > 7) {
          status.textContent = `${daysLeft} days left in your refund window`;
          status.classList.add("is-safe");
        } else if (daysLeft > 0) {
          const word = daysLeft === 1 ? "day" : "days";
          status.textContent = `Only ${daysLeft} ${word} left — refund window closing`;
          status.classList.add("is-warn");
        } else {
          const ago = Math.abs(daysLeft);
          const word = ago === 1 ? "day" : "days";
          status.textContent = `Refund window expired ${ago} ${word} ago`;
          status.classList.add("is-expired");
        }
      };

      renderStatus(purchased);

      const save = async (val) => {
        const { purchaseLog: cur = {} } = await window.GOGPlusStorage.get({ purchaseLog: {} });
        if (val) cur[slug] = val;
        else delete cur[slug];
        await window.GOGPlusStorage.set({ purchaseLog: cur });
        renderStatus(val);
      };

      input.addEventListener("change", () => save(input.value));
      clearBtn.addEventListener("click", () => {
        input.value = "";
        save("");
      });
    }, 0);

    return wrap;
  }

  function renderItadSection(slug) {
    const wrap = document.createElement("section");
    wrap.className = "gog-plus-gp-section";
    const title = gameTitleFromPage() || slug.replace(/_/g, " ");
    const itadUrl = `https://isthereanydeal.com/search/?q=${encodeURIComponent(title)}`;
    wrap.innerHTML = `
      <h3>Compare across stores</h3>
      <p class="gog-plus-gp-muted">See if Steam, Epic, Humble, or Fanatical has it cheaper right now.</p>
      <a class="gog-plus-itad-btn" href="${itadUrl}" target="_blank" rel="noopener">
        Open on IsThereAnyDeal →
      </a>
    `;
    return wrap;
  }

  async function renderTagsSection(slug) {
    const { tags = {}, notes = {}, tagColors = {} } = await window.GOGPlusStorage.get({
      tags: {},
      notes: {},
      tagColors: {},
    });
    const existing = tags[slug] || [];
    const note = notes[slug] || "";

    // Build autocomplete candidate list from all existing tags
    const allTags = new Set();
    for (const arr of Object.values(tags)) {
      for (const t of arr || []) allTags.add(t);
    }

    const wrap = document.createElement("section");
    wrap.className = "gog-plus-gp-section";
    wrap.innerHTML = `
      <h3>Your tags & notes</h3>
      <div class="gog-plus-tag-input-row">
        <input type="text" id="gog-plus-tag-input" list="gog-plus-tag-suggestions"
               placeholder="Add tag (e.g. 'co-op weekend')…" autocomplete="off"/>
        <datalist id="gog-plus-tag-suggestions">
          ${Array.from(allTags).map((t) => `<option value="${escapeHtml(t)}">`).join("")}
        </datalist>
        <button id="gog-plus-tag-add" type="button">Add</button>
      </div>
      <div id="gog-plus-tag-list" class="gog-plus-tag-list"></div>
      <textarea id="gog-plus-note" placeholder="Personal note…">${escapeHtml(note)}</textarea>
      <button type="button" class="gog-plus-tag-dashboard-link" id="gog-plus-open-dashboard">
        Open tag dashboard →
      </button>
    `;

    setTimeout(() => {
      const renderTags = () => {
        const list = wrap.querySelector("#gog-plus-tag-list");
        list.innerHTML = "";
        (settings._tagsCache?.[slug] || existing).forEach((t) => {
          const chip = document.createElement("span");
          chip.className = "gog-plus-tag-chip";
          if (tagColors[t]) chip.style.setProperty("--tag-accent", tagColors[t]);
          // Build safely — t is user input, must NOT go through innerHTML raw.
          const tNode = document.createTextNode(t + " ");
          const rmBtn = document.createElement("button");
          rmBtn.setAttribute("data-remove", t);
          rmBtn.setAttribute("aria-label", "Remove tag");
          rmBtn.textContent = "×";
          chip.appendChild(tNode);
          chip.appendChild(rmBtn);
          list.appendChild(chip);
        });
      };
      renderTags();

      const input = wrap.querySelector("#gog-plus-tag-input");
      const addBtn = wrap.querySelector("#gog-plus-tag-add");

      const addTag = async () => {
        const val = input.value.trim();
        if (!val) return;
        const { tags: cur = {} } = await window.GOGPlusStorage.get({ tags: {} });
        cur[slug] = cur[slug] || [];
        if (!cur[slug].includes(val)) cur[slug].push(val);
        await window.GOGPlusStorage.set({ tags: cur });
        settings._tagsCache = cur;
        input.value = "";
        renderTags();
      };

      addBtn.addEventListener("click", addTag);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          addTag();
        }
      });

      wrap.querySelector("#gog-plus-tag-list").addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-remove]");
        if (!btn) return;
        const t = btn.getAttribute("data-remove");
        const { tags: cur = {} } = await window.GOGPlusStorage.get({ tags: {} });
        cur[slug] = (cur[slug] || []).filter((x) => x !== t);
        await window.GOGPlusStorage.set({ tags: cur });
        settings._tagsCache = cur;
        renderTags();
      });

      const noteEl = wrap.querySelector("#gog-plus-note");
      noteEl.addEventListener(
        "input",
        debounce(async () => {
          const { notes: cur = {} } = await window.GOGPlusStorage.get({ notes: {} });
          cur[slug] = noteEl.value;
          await window.GOGPlusStorage.set({ notes: cur });
        }, 400)
      );

      // Open tag dashboard via background — avoids needing the page in
      // web_accessible_resources (which would let any gog.com page iframe it).
      wrap.querySelector("#gog-plus-open-dashboard")?.addEventListener("click", () => {
        try {
          chrome.runtime.sendMessage({ type: "open-tag-dashboard" });
        } catch (_) {
          /* extension reloaded mid-session */
        }
      });
    }, 0);

    return wrap;
  }

  /* ============== orchestration ============== */

  function processAll() {
    if (!settings.enabled) {
      document.documentElement.classList.add("gog-plus-disabled");
      // Also remove visual classes so the disabled state is truly inert.
      document.documentElement.classList.remove(
        "gog-plus-design",
        "gog-plus-clean",
        "gog-plus-skeletons",
        "gog-plus-rtl"
      );
      return;
    }
    document.documentElement.classList.remove("gog-plus-disabled");

    document.documentElement.classList.toggle("gog-plus-design", !!settings.designInjection);
    document.documentElement.classList.toggle("gog-plus-clean", !!settings.cleanLayout);
    document.documentElement.classList.toggle(
      "gog-plus-skeletons",
      !!settings.skeletonLoaders
    );

    // Theme: strip prior theme- class then add the current one. "neon" is the
    // CSS default so applying it is a no-op but kept for explicitness.
    [...document.documentElement.classList]
      .filter((c) => c.startsWith("gog-plus-theme--"))
      .forEach((c) => document.documentElement.classList.remove(c));
    const theme = settings.theme || "neon";
    document.documentElement.classList.add(`gog-plus-theme--${theme}`);

    try {
      pageCurrency = window.GOGPlusCurrency.detect();
      ensureDrmFreeBanner();
      applyRtlLayout();
      applyCurrencyConversion();
      applyCardBadges();
      hideExpiredSales();
      applyHebrewTranslations();
      ensureWishlistFilters();
      enhanceGamePage();
    } catch (e) {
      log("processAll error", e);
    }
  }

  const scheduleProcess = debounce(processAll, 250);

  function startObserving() {
    observers.forEach((o) => o.disconnect());
    observers = [];

    // Targeted observation: main content area only
    const targets = [
      document.querySelector("main"),
      document.querySelector("[ng-view]"),
      document.body,
    ].filter(Boolean);

    const root = targets[0];
    const obs = new MutationObserver(() => scheduleProcess());
    obs.observe(root, { childList: true, subtree: true });
    observers.push(obs);
  }

  /* ============== settings load + change handling ============== */

  async function loadSettings() {
    const saved = await window.GOGPlusStorage.get(DEFAULTS);
    settings = {
      ...DEFAULTS,
      ...saved,
      rates: { ...DEFAULTS.rates, ...(saved.rates || {}) },
    };
  }

  window.GOGPlusStorage.onChange(async ({ key, newValue }) => {
    settings[key] = newValue;

    // Clear "done" markers so re-processing re-applies on existing nodes
    document
      .querySelectorAll(
        ".gog-plus-card-done, .gog-plus-promo-done, .gog-plus-converted, .gog-plus-translated"
      )
      .forEach((el) => {
        el.classList.remove(
          "gog-plus-card-done",
          "gog-plus-promo-done",
          "gog-plus-converted",
          "gog-plus-translated"
        );
      });
    document.querySelectorAll(".gog-plus-conv-note, .gog-plus-badges").forEach((el) =>
      el.remove()
    );
    // Strip era-aware cover classes so toggling designInjection off doesn't
    // leave classic-CRT or neon-glow effects stuck on existing cards.
    document
      .querySelectorAll(".gog-plus-cover--classic, .gog-plus-cover--neon, [class*='gog-plus-cover--genre-']")
      .forEach((el) => {
        [...el.classList]
          .filter((c) => c === "gog-plus-cover--classic" || c === "gog-plus-cover--neon" || c.startsWith("gog-plus-cover--genre-"))
          .forEach((c) => el.classList.remove(c));
      });
    document.getElementById("gog-plus-gamepanel")?.remove();
    document.getElementById("gog-plus-wlfilters")?.remove();

    processAll();

    // Toast
    const friendlyNames = {
      enabled: "GOG Enhancer",
      hebrewTranslations: "Hebrew translations",
      rtlLayout: "RTL layout",
      drmFreeBanner: "DRM-free banner",
      refundBadge: "Refund badge",
      modIndicator: "Mod indicator",
      hideExpiredSales: "Expired sales filter",
      cleanLayout: "Clean layout",
      designInjection: "Design upgrades",
      priceHistoryTracking: "Price history",
      itadCompare: "ITAD compare",
      currencyConverter: "Currency converter",
      taxEstimator: "VAT estimator",
      customTags: "Custom tags",
      wishlistFilters: "Wishlist filters",
    };
    if (key in friendlyNames && typeof newValue === "boolean") {
      window.GOGPlusToasts?.show(
        `${friendlyNames[key]} ${newValue ? "enabled" : "disabled"}`,
        { variant: newValue ? "default" : "muted" }
      );
    }
  });

  /* ============== boot ============== */

  loadSettings().then(() => {
    processAll();
    startObserving();
    log("ready", settings);
  });
})();
