/**
 * GOG+ game-page feature: the "GOG Enhancer insights" panel on a game's own
 * page — price history + sparkline, refund-window timer, price alerts,
 * ITAD compare, tags/notes — plus the two things that only ever run on a
 * game page: recording a price-history snapshot and detecting the real
 * genre from the page's own "Genre:" field (see lib/genres.js's doc
 * comment for why only Horror/Role-playing/Strategy are trusted from it).
 * Pulled out of the former single-file content.js during the v2.8.0
 * module split.
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusContentState;
  const { escapeHtml } = window.GOGPlusDomSafety;
  const { symbolFor } = window.GOGPlusCurrencyFormat;
  const { mapGenreLabel } = window.GOGPlusGenres;
  const { debounce, gameTitleFromPage, slugFromLocation } = window.GOGPlusContentUtils;

  // Sample the dominant color from a cover image (downscaled for speed).
  // Returns null on CORS rejection or load failure — caller should fall back
  // to the theme accent. Pulls the AVERAGE of opaque pixels which works well
  // for game covers with unified palettes.
  function sampleDominantColor(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const W = 40, H = 40;
          const canvas = document.createElement("canvas");
          canvas.width = W;
          canvas.height = H;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, W, H);
          const data = ctx.getImageData(0, 0, W, H).data;
          let r = 0, g = 0, b = 0, count = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue;
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
          if (!count) return resolve(null);
          resolve({
            r: Math.round(r / count),
            g: Math.round(g / count),
            b: Math.round(b / count),
          });
        } catch (_) {
          // Tainted canvas (CORS blocked) — bail silently.
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  // Session-scoped memoization keyed by cover URL (effectively per-slug,
  // since a game's og:image is stable) — avoids re-decoding + re-sampling
  // the same cover into a canvas every time its game panel is rebuilt (e.g.
  // navigating away and back to a game already visited this session).
  const dominantColorCache = new Map(); // url -> Promise<{r,g,b} | null>
  function sampleDominantColorCached(url) {
    if (!dominantColorCache.has(url)) {
      dominantColorCache.set(url, sampleDominantColor(url));
    }
    return dominantColorCache.get(url);
  }


  // Reads the real genre(s) for the CURRENT game page's "Genre:" row and maps
  // the first recognized one to a card-theming bucket via mapGenreLabel().
  // Class-name agnostic on purpose: GOG is an Angular SPA and its markup
  // shifts between releases, so instead of a specific selector we hunt for
  // the literal "Genre:" text label and read the anchors in its row. Returns
  // null if no label or no mappable genre is found — callers should fall
  // back to GENRE_PATTERNS (matchGenrePattern()).
  function detectGameGenreBucket() {
    const root = document.querySelector("main") || document.body;
    if (!root) return null;
    const labelRe = /^genres?:?$/i;
    const candidates = root.querySelectorAll("dt, dd, span, div, td, th, strong, b, p, li");
    let labelEl = null;
    for (const el of candidates) {
      if (el.children.length > 0) continue; // leaf nodes only — the label itself has no nested links
      if (labelRe.test((el.textContent || "").trim())) {
        labelEl = el;
        break;
      }
    }
    if (!labelEl) return null;

    // Walk up a few levels to the row containing the label, then read every
    // anchor's TEXT in that row (not its href — GOG's genre-link URL scheme
    // isn't consistent enough across pages to match on reliably). Stop at
    // the first ancestor that has any links, so we don't spill into an
    // unrelated section further up the tree.
    let row = labelEl.parentElement;
    for (let hops = 0; row && hops < 3; hops++, row = row.parentElement) {
      const links = row.querySelectorAll("a");
      if (!links.length) continue;
      for (const a of links) {
        const bucket = mapGenreLabel(a.textContent);
        if (bucket) return bucket;
      }
      break;
    }
    return null;
  }

  // Caches the detected genre bucket for `slug` the first time we see it —
  // cheap no-op on subsequent processAll() passes for the same game (the
  // DOM scan only runs once per slug, not once per mutation tick).
  async function maybeRecordGameGenre(slug) {
    if (state.settings.gameGenres && state.settings.gameGenres[slug]) return;
    const bucket = detectGameGenreBucket();
    if (!bucket) return;
    const cur = { ...(state.settings.gameGenres || {}), [slug]: bucket };
    state.settings.gameGenres = cur;
    await window.GOGPlusStorage.set({ gameGenres: cur });
  }

  /* ============== game page enhancements ============== */

  async function enhanceGamePage() {
    const slug = slugFromLocation();
    if (!slug) return;
    if (!document.querySelector("h1, [class*='product']")) return;

    await Promise.all([
      maybeRecordPriceHistory(slug),
      maybeRecordGameGenre(slug),
      ensureGamePagePanel(slug),
    ]);
  }

  async function maybeRecordPriceHistory(slug) {
    if (!state.settings.priceHistoryTracking) return;
    // Find current price text on the page
    const priceContainers = document.querySelectorAll(
      '[class*="product-actions-price"], [class*="ProductActionsPrice"], [class*="price-text"], [class*="product-price"]'
    );
    let price = null;
    for (const el of priceContainers) {
      const txt = el.textContent || "";
      const p = window.GOGPlusCurrency.parsePrice(txt, state.pageCurrency.code);
      if (p && (price === null || p < price)) price = p;
    }
    if (price !== null) {
      await window.GOGPlusPriceHistory.record(slug, price, state.pageCurrency.code);
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
      // Spotify-style accent: sample the dominant color from the cover and
      // use it to tint the panel border + header pill. Async, best-effort —
      // CORS-blocked images quietly fail and we just keep the theme accent.
      sampleDominantColorCached(heroUrl).then((color) => {
        if (!color) return;
        panel.style.setProperty(
          "--gp-hero-accent",
          `rgb(${color.r}, ${color.g}, ${color.b})`
        );
        panel.classList.add("gog-plus-gamepanel--has-hero-accent");
      });
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

    if (state.settings.priceHistoryTracking) {
      body.appendChild(await renderPriceHistorySection(slug));
    }
    if (state.settings.refundTimer) {
      body.appendChild(await renderRefundSection(slug));
    }
    body.appendChild(await renderPriceAlertSection(slug));
    if (state.settings.itadCompare) {
      body.appendChild(renderItadSection(slug));
    }
    if (state.settings.customTags) {
      body.appendChild(await renderTagsSection(slug));
    }
  }

  // Convert one history entry to a target currency via the USD rate matrix.
  // Returns the original entry if either rate is missing (best-effort).
  function normalizeEntryToCurrency(e, targetCur) {
    if (!e || !targetCur || e.c === targetCur) return e;
    const srcRate = e.c === "USD" ? 1 : state.settings.rates[e.c];
    const tgtRate = targetCur === "USD" ? 1 : state.settings.rates[targetCur];
    if (!srcRate || !tgtRate) return e;
    return { ...e, p: (e.p / srcRate) * tgtRate, c: targetCur, _origP: e.p, _origC: e.c };
  }

  async function renderPriceHistorySection(slug) {
    const wrap = document.createElement("section");
    wrap.className = "gog-plus-gp-section";
    const rawStats = await window.GOGPlusPriceHistory.stats(slug);
    if (!rawStats) {
      wrap.innerHTML = `
        <h3>Price history</h3>
        <p class="gog-plus-gp-muted">No history yet — we'll start tracking from this visit.</p>`;
      return wrap;
    }
    const rawEntries = await window.GOGPlusPriceHistory.get(slug);

    // Normalize every snapshot to the user's target currency (falling back to
    // the latest snapshot's currency if no target is set). Stops mixed-currency
    // sparklines when the user has changed targetCurrency mid-tracking.
    const displayCur =
      state.settings.targetCurrency && state.settings.targetCurrency !== "none"
        ? state.settings.targetCurrency
        : rawStats.currency;
    const entries = rawEntries.map((e) => normalizeEntryToCurrency(e, displayCur));
    const prices = entries.map((e) => e.p);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const stats = {
      count: entries.length,
      min: { price: minP, date: entries[prices.indexOf(minP)].d },
      max: { price: maxP, date: entries[prices.indexOf(maxP)].d },
      avg: prices.reduce((a, b) => a + b, 0) / entries.length,
      first: entries[0],
      latest: entries[entries.length - 1],
      currency: displayCur,
    };
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
      const input = /** @type {HTMLInputElement} */ (wrap.querySelector("#gog-plus-purchase-date"));
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

  async function renderPriceAlertSection(slug) {
    const { priceAlerts = {} } = await window.GOGPlusStorage.get({ priceAlerts: {} });
    const alert = priceAlerts[slug];
    const alertCur =
      state.settings.targetCurrency && state.settings.targetCurrency !== "none"
        ? state.settings.targetCurrency
        : state.pageCurrency.code || "USD";
    const sym = symbolFor(alertCur);

    const wrap = document.createElement("section");
    wrap.className = "gog-plus-gp-section";
    wrap.innerHTML = `
      <h3>Price alert <span aria-hidden="true">🔔</span></h3>
      <p class="gog-plus-gp-muted">
        Notify me when this game's recorded price drops below my threshold.
        Checked once a day; requires "Desktop notifications" enabled in Advanced Options.
      </p>
      <div class="gog-plus-alert-row">
        <span class="gog-plus-alert-sym">${sym}</span>
        <input type="number" id="gog-plus-alert-threshold" step="0.01" min="0"
          value="${alert ? alert.threshold : ""}" placeholder="9.99" />
        <button id="gog-plus-alert-save" type="button">Save</button>
        ${alert ? `<button id="gog-plus-alert-clear" type="button" class="gog-plus-alert-clear" title="Remove alert">×</button>` : ""}
      </div>
      <div class="gog-plus-alert-status${alert ? " is-active" : ""}">
        ${alert
          ? `Alert active: notify when price &lt; ${symbolFor(alert.currency)}${alert.threshold.toFixed(2)} ${alert.currency}`
          : "No alert set."}
      </div>
    `;

    setTimeout(() => {
      const input = /** @type {HTMLInputElement} */ (wrap.querySelector("#gog-plus-alert-threshold"));
      const saveBtn = /** @type {HTMLElement} */ (wrap.querySelector("#gog-plus-alert-save"));
      const clearBtn = wrap.querySelector("#gog-plus-alert-clear");

      const refresh = () => {
        const panel = document.getElementById("gog-plus-gamepanel");
        panel?.remove();
        ensureGamePagePanel(slug);
      };

      saveBtn.addEventListener("click", async () => {
        const v = parseFloat(input.value);
        if (!Number.isFinite(v) || v <= 0) {
          input.focus();
          return;
        }
        const { priceAlerts: cur = {} } = await window.GOGPlusStorage.get({ priceAlerts: {} });
        cur[slug] = { threshold: v, currency: alertCur, createdAt: Date.now() };
        await window.GOGPlusStorage.set({ priceAlerts: cur });
        refresh();
      });
      input.addEventListener("keydown", (/** @type {KeyboardEvent} */ e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          saveBtn.click();
        }
      });
      clearBtn?.addEventListener("click", async () => {
        const { priceAlerts: cur = {} } = await window.GOGPlusStorage.get({ priceAlerts: {} });
        delete cur[slug];
        await window.GOGPlusStorage.set({ priceAlerts: cur });
        refresh();
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
    const { tags = {}, notes = {}, tagColors = {}, gameStatus = {} } = await window.GOGPlusStorage.get({
      tags: {},
      notes: {},
      tagColors: {},
      gameStatus: {},
    });
    const existing = tags[slug] || [];
    const note = notes[slug] || "";
    const { STATUSES } = window.GOGPlusGameStatus;
    const currentStatus = gameStatus[slug] || null;

    // Build autocomplete candidate list from all existing tags
    const allTags = new Set();
    for (const arr of Object.values(tags)) {
      for (const t of arr || []) allTags.add(t);
    }

    const wrap = document.createElement("section");
    wrap.className = "gog-plus-gp-section";
    const statusButtons = STATUSES.map((s) => {
      const active = s.id === currentStatus;
      return `<button class="gog-plus-status-btn${active ? " active" : ""}" type="button"
        data-status="${s.id}" style="${active ? `--status-accent:${s.color}` : ""}"
        aria-pressed="${active}" aria-label="Mark as ${s.label}" title="${s.label}">${s.icon} ${s.label}</button>`;
    }).join("");

    wrap.innerHTML = `
      <h3>Your tags & notes</h3>
      <div class="gog-plus-status-row" role="group" aria-label="Play status">${statusButtons}</div>
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
      wrap.querySelectorAll(".gog-plus-status-btn").forEach((btnEl) => {
        const btn = /** @type {HTMLElement} */ (btnEl);
        btn.addEventListener("click", async () => {
          const id = btn.dataset.status;
          const { gameStatus: cur = {} } = await window.GOGPlusStorage.get({ gameStatus: {} });
          // Clicking the already-active status clears it back to "none".
          if (cur[slug] === id) delete cur[slug];
          else cur[slug] = id;
          await window.GOGPlusStorage.set({ gameStatus: cur });
          const panel = document.getElementById("gog-plus-gamepanel");
          panel?.remove();
          ensureGamePagePanel(slug);
        });
      });

      const renderTags = () => {
        const list = wrap.querySelector("#gog-plus-tag-list");
        list.innerHTML = "";
        (state.settings._tagsCache?.[slug] || existing).forEach((t) => {
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

      const input = /** @type {HTMLInputElement} */ (wrap.querySelector("#gog-plus-tag-input"));
      const addBtn = /** @type {HTMLElement} */ (wrap.querySelector("#gog-plus-tag-add"));

      const addTag = async () => {
        const val = input.value.trim();
        if (!val) return;
        const { tags: cur = {} } = await window.GOGPlusStorage.get({ tags: {} });
        cur[slug] = cur[slug] || [];
        if (!cur[slug].includes(val)) cur[slug].push(val);
        await window.GOGPlusStorage.set({ tags: cur });
        state.settings._tagsCache = cur;
        input.value = "";
        renderTags();
      };

      addBtn.addEventListener("click", addTag);
      input.addEventListener("keydown", (/** @type {KeyboardEvent} */ e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          addTag();
        }
      });

      wrap.querySelector("#gog-plus-tag-list").addEventListener("click", async (e) => {
        const btn = /** @type {Element} */ (e.target).closest("button[data-remove]");
        if (!btn) return;
        const t = btn.getAttribute("data-remove");
        const { tags: cur = {} } = await window.GOGPlusStorage.get({ tags: {} });
        cur[slug] = (cur[slug] || []).filter((x) => x !== t);
        await window.GOGPlusStorage.set({ tags: cur });
        state.settings._tagsCache = cur;
        renderTags();
      });

      const noteEl = /** @type {HTMLTextAreaElement} */ (wrap.querySelector("#gog-plus-note"));
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

  window.GOGPlusGamePage = {
    enhanceGamePage,
    maybeRecordPriceHistory,
    maybeRecordGameGenre,
    ensureGamePagePanel,
  };
})();
