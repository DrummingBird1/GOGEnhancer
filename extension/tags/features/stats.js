/**
 * GOG+ tag-dashboard stats: the sale-calendar heatmap, the year-in-review
 * panel, and the top stat cards (tagged games, storage used, etc). Pulled
 * out of the former single-file tags.js during the v2.8.0 module split.
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusTagsState;
  const { escapeHtml } = window.GOGPlusDomSafety;
  const { formatPrice } = window.GOGPlusCurrencyFormat;
  const { $ } = window.GOGPlusTagsConstants;
  const { purchaseDateOf, normalizePurchaseEntry } = window.GOGPlusPurchases;
  const { matchGenrePattern } = window.GOGPlusGenres;

// Approximate historical GOG sale windows (month/day of year, GOG's actual
// dates shift by up to a couple weeks year to year — this is a rough
// planning aid, not a guarantee). Blended with the user's own observed
// price-drop heatmap in nextSaleWindow() below when there's enough data to
// have an opinion; falls back to this fixed calendar otherwise.
const KNOWN_SALE_WINDOWS = [
  { month: 1, day: 2, name: "New Year Sale" },
  { month: 3, day: 10, name: "Spring Sale" },
  { month: 6, day: 25, name: "Summer Sale" },
  { month: 10, day: 25, name: "Halloween Sale" },
  { month: 11, day: 25, name: "Black Friday" },
  { month: 12, day: 20, name: "Winter Sale" },
];

// Finds the soonest upcoming sale window. When `observedPeakMonth` (1-12) is
// given, prefers windows in that month first (the user's own tracked data
// says that's when GOG discounts their wishlist most) before falling back to
// the full known calendar.
/**
 * @param {number | null} observedPeakMonth
 * @param {Date} [now]
 * @returns {{ month: number, day: number, name: string, daysAway: number, date: Date }}
 */
function nextSaleWindow(observedPeakMonth, now = new Date()) {
  const candidates = observedPeakMonth
    ? KNOWN_SALE_WINDOWS.filter((w) => w.month === observedPeakMonth)
    : [];
  const pool = candidates.length ? candidates : KNOWN_SALE_WINDOWS;
  let best = null;
  for (const w of pool) {
    let target = new Date(now.getFullYear(), w.month - 1, w.day);
    if (target < now) target = new Date(now.getFullYear() + 1, w.month - 1, w.day);
    const daysAway = Math.round((target.getTime() - now.getTime()) / 86400000);
    if (!best || daysAway < best.daysAway) best = { ...w, daysAway, date: target };
  }
  return best;
}

function renderSaleHeatmap() {
  const panel = document.getElementById("saleHeatmap");
  if (!panel) return;

  // Count price-drop events per calendar month across all tracked games.
  // A "drop" = price strictly lower than the previous entry for the same slug.
  const monthCounts = new Array(12).fill(0);
  let totalDrops = 0;
  for (const arr of Object.values(state.allHistory)) {
    if (!arr || arr.length < 2) continue;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].p >= arr[i - 1].p) continue;
      const m = parseInt((arr[i].d || "").slice(5, 7), 10);
      if (m >= 1 && m <= 12) {
        monthCounts[m - 1]++;
        totalDrops++;
      }
    }
  }

  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  if (!totalDrops) {
    const next = nextSaleWindow(null);
    panel.innerHTML = `
      <header class="heatmap-header">
        <span class="heatmap-eyebrow">Sale calendar</span>
        <h2>When does GOG drop prices?</h2>
        <p class="heatmap-sub">
          Not enough tracked history yet to build your own heatmap. Historically,
          GOG runs a <strong>${next.name}</strong> around this time of year — the next
          one is roughly <strong>${next.daysAway}</strong> day${next.daysAway === 1 ? "" : "s"} away.
        </p>
      </header>
    `;
    return;
  }

  const max = Math.max(...monthCounts) || 1;
  const peakIdx = monthCounts.indexOf(max);
  const peakName = monthNames[peakIdx];
  const next = nextSaleWindow(peakIdx + 1);

  const cells = monthCounts
    .map((c, i) => {
      const intensity = c / max;
      return `<div class="heatmap-cell" style="--intensity:${intensity.toFixed(3)}" title="${monthNames[i]}: ${c} price drop${c === 1 ? "" : "s"}">
        <span class="heatmap-month">${monthNames[i]}</span>
        <span class="heatmap-count">${c || ""}</span>
      </div>`;
    })
    .join("");

  panel.innerHTML = `
    <header class="heatmap-header">
      <span class="heatmap-eyebrow">Sale calendar</span>
      <h2>When does GOG drop prices?</h2>
      <p class="heatmap-sub">
        Across <strong>${totalDrops}</strong> price drop${totalDrops === 1 ? "" : "s"} we've observed —
        ${peakName} leads with <strong>${max}</strong>. Next likely window:
        <strong>${next.name}</strong>, ~${next.daysAway} day${next.daysAway === 1 ? "" : "s"} away.
      </p>
    </header>
    <div class="heatmap-grid">${cells}</div>
  `;
}

// Horizontal bar chart of genre buckets across every game the user has any
// data for (tagged, tracked, or status-marked) — same resolution order as
// tags/features/recommendations.js's genreFor: the confirmed per-slug cache
// from a real visit first, falling back to the slug-pattern heuristic.
// Duplicated in miniature here rather than importing recommendations.js,
// since that module loads after this one in tags.html (see its own
// script-order comment) — consistent with the rest of this codebase's
// "each context builds its own small chart/lookup" convention.
function renderGenreDistribution() {
  const panel = document.getElementById("genreDistribution");
  if (!panel) return;

  const slugs = new Set([
    ...Object.keys(state.allTags),
    ...Object.keys(state.allHistory),
    ...Object.keys(state.allStatus),
  ]);
  const counts = {};
  for (const slug of slugs) {
    const genre = state.allGenres[slug] || matchGenrePattern(slug);
    if (!genre) continue;
    counts[genre] = (counts[genre] || 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    panel.innerHTML = "";
    return;
  }
  const max = entries[0][1];
  const totalWithGenre = entries.reduce((a, [, c]) => a + c, 0);

  const bars = entries
    .map(([genre, count]) => {
      const pct = (count / max) * 100;
      return `
      <div class="genre-bar-row">
        <span class="genre-bar-label">${escapeHtml(genre)}</span>
        <div class="genre-bar-track">
          <div class="genre-bar-fill" style="--pct:${pct.toFixed(1)}%"></div>
        </div>
        <span class="genre-bar-count">${count}</span>
      </div>`;
    })
    .join("");

  panel.innerHTML = `
    <header class="heatmap-header">
      <span class="heatmap-eyebrow">Your taste</span>
      <h2>Genre distribution</h2>
      <p class="heatmap-sub">
        Across <strong>${totalWithGenre}</strong> tracked game${totalWithGenre === 1 ? "" : "s"} with a recognized genre.
      </p>
    </header>
    <div class="genre-bars">${bars}</div>
  `;
}

function availableReviewYears() {
  const years = new Set();
  for (const arr of Object.values(state.allHistory)) {
    for (const e of arr || []) {
      const y = (e.d || "").slice(0, 4);
      if (/^\d{4}$/.test(y)) years.add(y);
    }
  }
  for (const raw of Object.values(state.allPurchases)) {
    const y = purchaseDateOf(raw).slice(0, 4);
    if (/^\d{4}$/.test(y)) years.add(y);
  }
  return [...years].sort().reverse(); // newest first
}

// A compact per-year snapshot-count strip shown below the main year-review
// grid, only when there's more than one year of data to compare — a single
// year has nothing to trend against.
/**
 * @param {string[]} years descending, from availableReviewYears()
 * @returns {string}
 */
function buildMultiYearTrend(years) {
  const chronological = [...years].reverse();
  const perYear = chronological.map((y) => {
    let count = 0;
    for (const arr of Object.values(state.allHistory)) {
      count += (arr || []).filter((e) => (e.d || "").startsWith(y)).length;
    }
    return { year: y, count };
  });
  const MAX_BAR_PX = 50;
  const max = Math.max(...perYear.map((p) => p.count), 1);
  const bars = perYear
    .map((p) => {
      const px = Math.max(2, Math.round((p.count / max) * MAX_BAR_PX));
      return `
      <div class="yr-trend-bar" title="${p.year}: ${p.count} snapshot${p.count === 1 ? "" : "s"}">
        <div class="yr-trend-fill" style="height:${px}px"></div>
        <span class="yr-trend-year">${p.year}</span>
      </div>`;
    })
    .join("");
  return `
    <div class="yr-trend">
      <span class="yr-trend-label">Snapshots per year</span>
      <div class="yr-trend-bars">${bars}</div>
    </div>
  `;
}

function renderYearReview() {
  const panel = document.getElementById("yearReview");
  if (!panel) return;
  const year = parseInt(state.yearReviewYear || String(new Date().getFullYear()), 10);
  const yearPrefix = String(year);

  let snapshotsThisYear = 0;
  let gamesTrackedThisYear = 0;
  let biggestDrop = null; // { slug, pct, from, to, when, currency }
  let mostTracked = null; // { slug, count }
  const savingsByCur = {};

  for (const [slug, arr] of Object.entries(state.allHistory)) {
    if (!arr || !arr.length) continue;
    const thisYearEntries = arr.filter((e) => (e.d || "").startsWith(yearPrefix));
    if (!thisYearEntries.length) continue;
    snapshotsThisYear += thisYearEntries.length;
    gamesTrackedThisYear++;

    if (!mostTracked || thisYearEntries.length > mostTracked.count) {
      mostTracked = { slug, count: thisYearEntries.length };
    }

    // Biggest drop within this year (compare each entry to the prior one)
    for (let i = 1; i < arr.length; i++) {
      const prev = arr[i - 1];
      const curr = arr[i];
      if (!curr.d?.startsWith(yearPrefix)) continue;
      if (prev.p <= 0) continue;
      const pct = ((prev.p - curr.p) / prev.p) * 100;
      if (pct > (biggestDrop?.pct || 0)) {
        biggestDrop = {
          slug,
          pct: Math.round(pct),
          from: prev.p,
          to: curr.p,
          when: curr.d,
          currency: curr.c || "USD",
        };
      }
    }

    // Watch advantage in target currency — peak vs latest within the year
    const latest = thisYearEntries[thisYearEntries.length - 1];
    const peak = thisYearEntries.reduce((a, e) => (e.p > a.p ? e : a), thisYearEntries[0]);
    if (peak.p > latest.p) {
      const cur = latest.c || "USD";
      savingsByCur[cur] = (savingsByCur[cur] || 0) + (peak.p - latest.p);
    }
  }

  const purchasesThisYear = Object.values(state.allPurchases).filter((raw) =>
    purchaseDateOf(raw).startsWith(yearPrefix)
  ).length;

  // "Most patient purchase" — the biggest gap, in days, between the user's
  // FIRST tracked snapshot of a game and the day they actually bought it
  // (only for purchases logged this year, with tracked history to compare
  // against). A proxy for "waited the longest before buying," built
  // entirely from data already tracked — no new storage.
  let mostPatient = null; // { slug, days }
  for (const [slug, raw] of Object.entries(state.allPurchases)) {
    const entry = normalizePurchaseEntry(raw);
    if (!entry?.date || !entry.date.startsWith(yearPrefix)) continue;
    const hist = state.allHistory[slug];
    if (!hist || !hist.length) continue;
    const firstSnapshot = hist.reduce((a, e) => (e.d < a ? e.d : a), hist[0].d);
    const days = Math.round(
      (new Date(entry.date).getTime() - new Date(firstSnapshot).getTime()) / (24 * 60 * 60 * 1000)
    );
    if (days > 0 && (!mostPatient || days > mostPatient.days)) {
      mostPatient = { slug, days };
    }
  }

  if (
    !snapshotsThisYear &&
    !purchasesThisYear &&
    !gamesTrackedThisYear
  ) {
    panel.innerHTML = "";
    return;
  }

  const savingsParts = Object.entries(savingsByCur)
    .filter(([, v]) => v > 0)
    .map(([cur, v]) => formatPrice(v, cur))
    .join(" + ");

  const dropLine = biggestDrop
    ? `<strong>-${biggestDrop.pct}%</strong> on <em>${escapeHtml(window.GOGPlusTagsGamesList.slugToTitle(biggestDrop.slug))}</em> on ${biggestDrop.when}
       <span class="yr-detail">${formatPrice(biggestDrop.from, biggestDrop.currency)} → ${formatPrice(biggestDrop.to, biggestDrop.currency)}</span>`
    : `<span class="yr-empty">No significant drops captured yet</span>`;

  const mostLine = mostTracked
    ? `<strong>${escapeHtml(window.GOGPlusTagsGamesList.slugToTitle(mostTracked.slug))}</strong> <span class="yr-detail">${mostTracked.count} snapshots</span>`
    : `<span class="yr-empty">—</span>`;

  const patientLine = mostPatient
    ? `<strong>${escapeHtml(window.GOGPlusTagsGamesList.slugToTitle(mostPatient.slug))}</strong> <span class="yr-detail">${mostPatient.days} day${mostPatient.days === 1 ? "" : "s"} of watching first</span>`
    : `<span class="yr-empty">No priced purchase with tracked history yet</span>`;

  const years = availableReviewYears();
  const yearOptions = years
    .map(
      (y) =>
        `<option value="${y}"${parseInt(y, 10) === year ? " selected" : ""}>${y}</option>`
    )
    .join("");
  const trendHtml = years.length > 1 ? buildMultiYearTrend(years) : "";

  panel.innerHTML = `
    <header class="yr-header">
      <span class="yr-eyebrow">Your ${year} in GOG</span>
      <div class="yr-title-row">
        <h2>Library year-in-review</h2>
        ${years.length > 1 ? `<select class="yr-year-select" id="yrYearSelect" aria-label="Select year">${yearOptions}</select>` : ""}
      </div>
    </header>
    <div class="yr-grid">
      <div class="yr-card">
        <div class="yr-label">Games tracked</div>
        <div class="yr-value">${gamesTrackedThisYear}</div>
        <div class="yr-sub">with ${snapshotsThisYear} snapshot${snapshotsThisYear === 1 ? "" : "s"}</div>
      </div>
      <div class="yr-card">
        <div class="yr-label">Biggest price drop</div>
        <div class="yr-value yr-value--small">${dropLine}</div>
      </div>
      <div class="yr-card">
        <div class="yr-label">Most-watched game</div>
        <div class="yr-value yr-value--small">${mostLine}</div>
      </div>
      <div class="yr-card">
        <div class="yr-label">Watch advantage</div>
        <div class="yr-value">${savingsParts || "—"}</div>
        <div class="yr-sub">current vs. peak this year</div>
      </div>
      <div class="yr-card">
        <div class="yr-label">Purchases logged</div>
        <div class="yr-value">${purchasesThisYear}</div>
        <div class="yr-sub">refund-window entries this year</div>
      </div>
      <div class="yr-card">
        <div class="yr-label">Most patient purchase</div>
        <div class="yr-value yr-value--small">${patientLine}</div>
      </div>
    </div>
    ${trendHtml}
  `;

  const yrSel = /** @type {HTMLSelectElement} */ (document.getElementById("yrYearSelect"));
  if (yrSel) {
    yrSel.addEventListener("change", () => {
      state.yearReviewYear = yrSel.value;
      renderYearReview();
    });
  }
}

async function renderStats() {
  const panel = $("statsPanel");
  if (!panel) return;

  const taggedGames = Object.keys(state.allTags).filter((s) => (state.allTags[s] || []).length).length;
  const totalTagsSpent = Object.values(state.allTags).reduce((a, arr) => a + (arr?.length || 0), 0);
  const uniqueTags = new Set();
  for (const arr of Object.values(state.allTags)) for (const t of arr || []) uniqueTags.add(t);
  const notesCount = Object.values(state.allNotes).filter(Boolean).length;
  const trackedGames = Object.keys(state.allHistory).length;
  const snapshots = Object.values(state.allHistory).reduce((a, arr) => a + (arr?.length || 0), 0);

  // Oldest snapshot across the whole library
  let oldest = null;
  for (const arr of Object.values(state.allHistory)) {
    for (const e of arr || []) {
      if (!oldest || e.d < oldest) oldest = e.d;
    }
  }

  // "Watching paid off": for each tracked game, max - latest in the latest entry's currency.
  // Mixed-currency totals are awkward, so group by currency.
  const savingsByCur = {};
  for (const arr of Object.values(state.allHistory)) {
    if (!arr || arr.length < 2) continue;
    const latest = arr[arr.length - 1];
    const peak = arr.reduce((a, e) => (e.p > a.p ? e : a), arr[0]);
    if (peak.p <= latest.p) continue;
    const cur = latest.c || "USD";
    savingsByCur[cur] = (savingsByCur[cur] || 0) + (peak.p - latest.p);
  }
  const savingsParts = Object.entries(savingsByCur)
    .filter(([, v]) => v > 0)
    .map(([cur, v]) => formatPrice(v, cur))
    .join(" + ");

  // Wishlist value + potential savings: current total price of every
  // wishlisted game that has price history, plus how much more it'd cost
  // to close the gap to each game's own tracked all-time low. Scoped to
  // allWishlistSlugs (not the whole tracked library) — a wishlist item
  // never visited on its own page has no price data to sum.
  const wishlistValueByCur = {};
  const wishlistSavingsByCur = {};
  // Cost to buy the whole tracked wishlist if every game happened to be at
  // its own historical all-time low simultaneously — not a real achievable
  // total (games rarely all bottom out at once), but a useful "best case"
  // anchor next to the "buy it all today" figure above it.
  const wishlistLowByCur = {};
  let wishlistPricedCount = 0;
  for (const slug of state.allWishlistSlugs || []) {
    const arr = state.allHistory[slug];
    if (!arr || !arr.length) continue;
    wishlistPricedCount++;
    const latest = arr[arr.length - 1];
    const low = arr.reduce((a, e) => (e.p < a.p ? e : a), arr[0]);
    const cur = latest.c || "USD";
    wishlistValueByCur[cur] = (wishlistValueByCur[cur] || 0) + latest.p;
    wishlistLowByCur[low.c || "USD"] = (wishlistLowByCur[low.c || "USD"] || 0) + low.p;
    if (low.c === cur) {
      wishlistSavingsByCur[cur] = (wishlistSavingsByCur[cur] || 0) + Math.max(0, latest.p - low.p);
    }
  }
  const wishlistValueParts = Object.entries(wishlistValueByCur)
    .map(([cur, v]) => formatPrice(v, cur))
    .join(" + ");
  const wishlistLowParts = Object.entries(wishlistLowByCur)
    .map(([cur, v]) => formatPrice(v, cur))
    .join(" + ");
  const wishlistSavingsParts = Object.entries(wishlistSavingsByCur)
    .filter(([, v]) => v > 0)
    .map(([cur, v]) => formatPrice(v, cur))
    .join(" + ");
  const wishlistSub = !wishlistPricedCount
    ? "visit wishlisted games to track"
    : wishlistSavingsParts
      ? `${wishlistSavingsParts} away from all-time lows · ${wishlistPricedCount} priced`
      : `already at tracked lows · ${wishlistPricedCount} priced`;

  // Active refund timers
  const today = new Date().toISOString().slice(0, 10);
  const activeRefunds = Object.entries(state.allPurchases).filter(([, raw]) => {
    const d = purchaseDateOf(raw);
    if (!d) return false;
    const ms = new Date(today).getTime() - new Date(d).getTime();
    return ms >= 0 && ms <= 30 * 24 * 60 * 60 * 1000;
  }).length;

  // Spending tracker: sums logged purchase prices, grouped by currency (same
  // multi-currency-totals pattern as savingsByCur above). "This month" is
  // scoped to the current calendar month for the budget comparison — budget
  // is a single number in a single currency, and this dashboard has no live
  // FX rates to convert other currencies into it, so purchases in a
  // different currency count toward the "Spending" headline total but are
  // left out of the budget check specifically.
  const spendByCur = {};
  const spendThisMonthByCur = {};
  const thisMonthPrefix = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  let purchasesWithPrice = 0;
  for (const raw of Object.values(state.allPurchases)) {
    const entry = normalizePurchaseEntry(raw);
    if (!entry || typeof entry.price !== "number") continue;
    const cur = entry.currency || "USD";
    spendByCur[cur] = (spendByCur[cur] || 0) + entry.price;
    purchasesWithPrice++;
    if (entry.date && entry.date.startsWith(thisMonthPrefix)) {
      spendThisMonthByCur[cur] = (spendThisMonthByCur[cur] || 0) + entry.price;
    }
  }
  const spendParts = Object.entries(spendByCur)
    .map(([cur, v]) => formatPrice(v, cur))
    .join(" + ");
  const budget = state.monthlyBudget;
  const thisMonthInBudgetCur = budget ? spendThisMonthByCur[budget.currency] || 0 : 0;
  const overBudget = !!budget && budget.amount > 0 && thisMonthInBudgetCur > budget.amount;
  let spendingSub;
  if (!purchasesWithPrice) {
    spendingSub = "log a price on a purchase date to track";
  } else if (budget && budget.amount > 0) {
    spendingSub = `${formatPrice(thisMonthInBudgetCur, budget.currency)} of ${formatPrice(budget.amount, budget.currency)} budget this month`;
  } else {
    spendingSub = `${purchasesWithPrice} purchase${purchasesWithPrice === 1 ? "" : "s"} with price logged`;
  }

  // Real storage usage via the native API — covers every key actually in
  // storage.local (not a hand-picked subset that drifts as keys get added;
  // this used to be a JSON.stringify-of-six-keys estimate that had already
  // fallen behind modsList/wishlistCache/notifLog/priceAlerts/gameGenres/
  // lastSeenVersion). chrome.storage.local quota is 5 MB so we render usage
  // as a percentage of that.
  const localBytes = await new Promise((resolve) => {
    chrome.storage.local.getBytesInUse(null, (bytes) => {
      if (chrome.runtime.lastError) {
        console.error("[GOG+] getBytesInUse failed:", chrome.runtime.lastError.message);
        resolve(0);
      } else {
        resolve(bytes);
      }
    });
  });
  const localKb = (localBytes / 1024).toFixed(1);
  const quotaPct = Math.min(100, (localBytes / (5 * 1024 * 1024)) * 100);
  const storageSub = `${quotaPct < 1 ? "<1" : quotaPct.toFixed(1)}% of 5 MB local quota`;

  const cards = [
    { label: "Tagged games", value: taggedGames, sub: `${uniqueTags.size} unique tag${uniqueTags.size === 1 ? "" : "s"} · ${totalTagsSpent} total` },
    { label: "Notes written", value: notesCount, sub: notesCount === 1 ? "across 1 game" : `across ${notesCount} game${notesCount === 1 ? "" : "s"}` },
    { label: "Games tracked", value: trackedGames, sub: `${snapshots} price snapshot${snapshots === 1 ? "" : "s"}` },
    { label: "Tracking since", value: oldest || "—", sub: oldest ? daysSince(oldest) : "no snapshots yet" },
    { label: "Watch advantage", value: savingsParts || "—", sub: "current vs. peak across tracked games" },
    { label: "Wishlist value", value: wishlistValueParts || "—", sub: wishlistSub, id: "wishlistValueCard" },
    { label: "Spending", value: spendParts || "—", sub: spendingSub, id: "spendingCard" },
    { label: "Refunds open", value: activeRefunds, sub: activeRefunds ? "within 30-day window" : "no purchases logged" },
    { label: "Storage used", value: `${localKb} KB`, sub: storageSub },
  ];

  panel.innerHTML = cards
    .map((c) => `
      <div class="stat-card"${c.id ? ` id="${c.id}"` : ""}>
        <div class="stat-label">${escapeHtml(c.label)}</div>
        <div class="stat-value">${escapeHtml(String(c.value))}</div>
        <div class="stat-sub">${escapeHtml(c.sub)}</div>
      </div>
    `)
    .join("");

  if (overBudget) {
    document.getElementById("spendingCard")?.classList.add("stat-card--over-budget");
  }

  if (wishlistPricedCount) {
    const wlCard = document.getElementById("wishlistValueCard");
    if (wishlistLowParts) {
      const lowLine = document.createElement("div");
      lowLine.className = "stat-sub stat-sub-secondary";
      lowLine.textContent = `At all-time lows: ${wishlistLowParts}`;
      wlCard?.appendChild(lowLine);
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "stat-card-action";
    btn.textContent = "↓ CSV";
    btn.title = "Export wishlisted games with tracked prices as CSV";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.GOGPlusTagsExportImport.exportWishlistCsv();
    });
    wlCard?.appendChild(btn);
  }
}


function daysSince(dateStr) {
  const ms = Date.now() - new Date(dateStr + "T00:00:00").getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days < 1) return "today";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `~${Math.floor(days / 30)} month${days < 60 ? "" : "s"} ago`;
  const years = (days / 365).toFixed(1);
  return `${years} year${years === "1.0" ? "" : "s"} ago`;
}

  window.GOGPlusTagsStats = {
    renderSaleHeatmap,
    nextSaleWindow,
    renderGenreDistribution,
    availableReviewYears,
    renderYearReview,
    renderStats,
    daysSince,
  };
})();
