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

  const DEFAULTS = {
    enabled: true,
    currencyConverter: true,
    taxEstimator: true,
    refundBadge: true,
    drmFreeBanner: true,
    hideExpiredSales: true,
    hebrewTranslations: false,
    rtlLayout: false,
    customTags: true,
    wishlistFilters: true,
    modIndicator: true,
    cleanLayout: true,
    designInjection: true,
    priceHistoryTracking: true,
    itadCompare: true,
    richTooltips: true,
    skeletonLoaders: true,
    targetCurrency: "ILS",
    rates: { ILS: 3.65, EUR: 0.92, GBP: 0.79, RUB: 92.0, PLN: 4.0 },
    vatPercent: 18,
    vatLabel: "כולל מע״מ",
    modsList: [],
  };

  let settings = { ...DEFAULTS };
  let pageCurrency = { code: "USD", symbol: "$" };
  let observers = [];
  let scheduled = null;

  /* ============== utils ============== */

  const debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  const log = (...a) => {
    if (window.GOG_PLUS_DEBUG) console.log("[GOG+]", ...a);
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

  /* ============== currency conversion ============== */

  function convertedFromUsd(usd) {
    const cur = settings.targetCurrency;
    if (!cur || cur === "none") return null;
    const rate = settings.rates[cur];
    if (!rate) return null;
    let v = usd * rate;
    if (settings.taxEstimator && settings.vatPercent > 0) {
      v *= 1 + settings.vatPercent / 100;
    }
    return v;
  }

  function applyCurrencyConversion(root = document) {
    if (!settings.currencyConverter || settings.targetCurrency === "none") return;
    if (pageCurrency.code !== "USD") {
      // Future: implement non-USD conversion. For now, skip silently if GOG
      // is already showing the user a non-USD currency (e.g. EUR locale).
      return;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.length > 80) return NodeFilter.FILTER_REJECT;
        if (!/\$\s?\d/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
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
      const usd = window.GOGPlusCurrency.parsePrice(node.nodeValue, "USD");
      if (!usd) continue;
      const value = convertedFromUsd(usd);
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
          $${usd.toFixed(2)} USD × ${settings.rates[settings.targetCurrency]} = ${formatPrice(
            value,
            settings.targetCurrency
          )}${taxLine}
        `;
      } else {
        note.title = `1 USD = ${settings.rates[settings.targetCurrency]} ${settings.targetCurrency}`;
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
      const txt = (el.textContent || "").toLowerCase();
      const href = (el.getAttribute("href") || "").toLowerCase();
      const yearMatch = href.match(/(\d{4})/) || txt.match(/(20\d{2})/);
      if (yearMatch) {
        const y = parseInt(yearMatch[1], 10);
        if (y > 2010 && y < currentYear) {
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
    if (sessionStorage.getItem("gog-plus-banner-dismissed") === "1") return;

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
      sessionStorage.setItem("gog-plus-banner-dismissed", "1");
      banner.remove();
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
    bar.innerHTML = `
      <span class="gog-plus-wlfilters-label">Quick filter</span>
      <button data-f="all" class="active">All</button>
      <button data-f="sale">On sale</button>
      <button data-f="under10">Under $10</button>
      <button data-f="under25">Under $25</button>
      <button data-f="rated45">Rated 4.5+</button>
    `;
    target.prepend(bar);

    bar.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      bar.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyWishlistFilter(btn.dataset.f);
    });

    // Report live discounted-item count to background → toolbar badge.
    // Wait a beat for Angular to render the cards, then count.
    reportWishlistCount();
  }

  let wishlistReportTimer = null;
  function reportWishlistCount() {
    clearTimeout(wishlistReportTimer);
    wishlistReportTimer = setTimeout(() => {
      // Count cards with a visible discount marker. We try a couple of
      // common GOG patterns and fall back to text scan within game tiles.
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
        // GOG renders discounts as "-XX%". Tile-scoped text only.
        if (/-\d{1,2}%/.test(txt)) discounted++;
      }
      try {
        chrome.runtime.sendMessage({
          type: "wishlist-report",
          discountedCount: discounted,
          total,
        });
      } catch (_) {
        /* no-op: background may be asleep */
      }
    }, 1500);
  }

  function applyWishlistFilter(mode) {
    const cards = document.querySelectorAll('a[href*="/game/"]');
    cards.forEach((c) => {
      const txt = c.textContent || "";
      const usdMatches = txt.match(/\$\s?\d+\.\d{2}/g) || [];
      const finalUsd = usdMatches.length
        ? window.GOGPlusCurrency.parsePrice(
            usdMatches[usdMatches.length - 1],
            "USD"
          )
        : null;
      const ratingMatch = txt.match(/(\d\.\d)\s*\d+\s*reviews/);
      const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

      let show = true;
      if (mode === "sale") show = /-\d+%/.test(txt);
      if (mode === "under10") show = finalUsd !== null && finalUsd < 10;
      if (mode === "under25") show = finalUsd !== null && finalUsd < 25;
      if (mode === "rated45") show = rating !== null && rating >= 4.5;

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
    if (document.getElementById("gog-plus-gamepanel")) return;

    const anchor =
      document.querySelector("h1") ||
      document.querySelector("[class*='product'] h1") ||
      document.querySelector("main");
    if (!anchor) return;

    const panel = document.createElement("aside");
    panel.id = "gog-plus-gamepanel";
    panel.className = "gog-plus-gamepanel";
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
    wrap.innerHTML = `
      <h3>Price history <span class="gog-plus-gp-since">since ${since}</span></h3>
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
      ${renderSparkline(entries, stats)}
    `;
    return wrap;
  }

  function renderSparkline(entries, stats) {
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
    const minPt = points[minIdx];
    const lastPt = points[lastIdx];
    const sym = symbolFor(stats.currency);
    return `
      <div class="gog-plus-spark">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-label="Price history sparkline">
          <defs>
            <linearGradient id="gpSparkFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#c64fff" stop-opacity="0.5"/>
              <stop offset="100%" stop-color="#c64fff" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path d="${areaPath}" fill="url(#gpSparkFill)"/>
          <path d="${linePath}" fill="none" stroke="#00f0ff" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
          <circle cx="${minPt[0].toFixed(1)}" cy="${minPt[1].toFixed(1)}" r="3" fill="#5cff9d" stroke="#0a0612" stroke-width="1.5">
            <title>All-time low: ${sym}${minP.toFixed(2)} on ${entries[minIdx].d}</title>
          </circle>
          <circle cx="${lastPt[0].toFixed(1)}" cy="${lastPt[1].toFixed(1)}" r="3" fill="#c64fff" stroke="#0a0612" stroke-width="1.5">
            <title>Latest: ${sym}${entries[lastIdx].p.toFixed(2)} on ${entries[lastIdx].d}</title>
          </circle>
        </svg>
        <div class="gog-plus-spark-legend">
          <span><i class="dot dot-low"></i>All-time low</span>
          <span><i class="dot dot-now"></i>Latest</span>
        </div>
      </div>
    `;
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
    const { tags = {}, notes = {} } = await window.GOGPlusStorage.get({
      tags: {},
      notes: {},
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
