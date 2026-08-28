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

  if (!totalDrops) {
    panel.innerHTML = "";
    return;
  }

  const max = Math.max(...monthCounts) || 1;
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const peakIdx = monthCounts.indexOf(max);
  const peakName = monthNames[peakIdx];

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
        ${peakName} leads with <strong>${max}</strong>. Plan your shopping around the hot months.
      </p>
    </header>
    <div class="heatmap-grid">${cells}</div>
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
  for (const d of Object.values(state.allPurchases)) {
    const y = (d || "").slice(0, 4);
    if (/^\d{4}$/.test(y)) years.add(y);
  }
  return [...years].sort().reverse(); // newest first
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

  const purchasesThisYear = Object.values(state.allPurchases).filter((d) =>
    (d || "").startsWith(yearPrefix)
  ).length;

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

  const years = availableReviewYears();
  const yearOptions = years
    .map(
      (y) =>
        `<option value="${y}"${parseInt(y, 10) === year ? " selected" : ""}>${y}</option>`
    )
    .join("");

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
    </div>
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
  let wishlistPricedCount = 0;
  for (const slug of state.allWishlistSlugs || []) {
    const arr = state.allHistory[slug];
    if (!arr || !arr.length) continue;
    wishlistPricedCount++;
    const latest = arr[arr.length - 1];
    const low = arr.reduce((a, e) => (e.p < a.p ? e : a), arr[0]);
    const cur = latest.c || "USD";
    wishlistValueByCur[cur] = (wishlistValueByCur[cur] || 0) + latest.p;
    if (low.c === cur) {
      wishlistSavingsByCur[cur] = (wishlistSavingsByCur[cur] || 0) + Math.max(0, latest.p - low.p);
    }
  }
  const wishlistValueParts = Object.entries(wishlistValueByCur)
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
  const activeRefunds = Object.entries(state.allPurchases).filter(([, d]) => {
    if (!d) return false;
    const ms = new Date(today).getTime() - new Date(d).getTime();
    return ms >= 0 && ms <= 30 * 24 * 60 * 60 * 1000;
  }).length;

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
    { label: "Wishlist value", value: wishlistValueParts || "—", sub: wishlistSub },
    { label: "Refunds open", value: activeRefunds, sub: activeRefunds ? "within 30-day window" : "no purchases logged" },
    { label: "Storage used", value: `${localKb} KB`, sub: storageSub },
  ];

  panel.innerHTML = cards
    .map((c) => `
      <div class="stat-card">
        <div class="stat-label">${escapeHtml(c.label)}</div>
        <div class="stat-value">${escapeHtml(String(c.value))}</div>
        <div class="stat-sub">${escapeHtml(c.sub)}</div>
      </div>
    `)
    .join("");
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
    availableReviewYears,
    renderYearReview,
    renderStats,
    daysSince,
  };
})();
