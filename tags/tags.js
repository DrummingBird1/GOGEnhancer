/**
 * GOG+ tag dashboard.
 *
 * Reads tags + notes from local storage, builds a unique tag list
 * with counts, lets the user filter by tag and search by free text.
 * Exports CSV.
 */

const $ = (id) => document.getElementById(id);

let allTags = {}; // { slug: [tag, ...] }
let allNotes = {}; // { slug: text }
let allHistory = {}; // { slug: [{d, p, c}, ...] }
let allPurchases = {}; // { slug: "YYYY-MM-DD" }
let tagColors = {}; // { tagName: "#hex" }
let tagOrder = []; // explicit order of tags after drag-reorder; unordered = end
let density = "comfortable"; // "comfortable" | "compact"
let activeTag = null;
let searchTerm = "";

const TAG_COLOR_SWATCHES = [
  "#c64fff", // magenta
  "#00f0ff", // cyan
  "#7fffa6", // green
  "#ff7a00", // orange
  "#ff3d8b", // pink
  "#ffd166", // yellow
  "#8a2be2", // purple
  "#b388ff", // lavender
];

async function init() {
  const data = await window.GOGPlusStorage.get({
    tags: {},
    notes: {},
    priceHistory: {},
    purchaseLog: {},
    tagColors: {},
    tagOrder: [],
    tagDashboardDensity: "comfortable",
    uiLanguage: "en",
  });
  window.GOGPlusI18n?.apply(data.uiLanguage || "en");
  allTags = data.tags || {};
  allNotes = data.notes || {};
  allHistory = data.priceHistory || {};
  allPurchases = data.purchaseLog || {};
  tagColors = data.tagColors || {};
  tagOrder = Array.isArray(data.tagOrder) ? data.tagOrder : [];
  density = data.tagDashboardDensity === "compact" ? "compact" : "comfortable";
  applyDensityClass();
  renderStats();
  renderYearReview();
  renderSaleHeatmap();
  renderTagList();
  renderGames();
  bind();
}

function renderSaleHeatmap() {
  const panel = document.getElementById("saleHeatmap");
  if (!panel) return;

  // Count price-drop events per calendar month across all tracked games.
  // A "drop" = price strictly lower than the previous entry for the same slug.
  const monthCounts = new Array(12).fill(0);
  let totalDrops = 0;
  for (const arr of Object.values(allHistory)) {
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

function applyDensityClass() {
  document.body.classList.toggle("density-compact", density === "compact");
}

function sortedTags() {
  const tags = buildUniqueTags();
  return tags.sort((a, b) => {
    const ai = tagOrder.indexOf(a[0]);
    const bi = tagOrder.indexOf(b[0]);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return b[1] - a[1] || a[0].localeCompare(b[0]);
  });
}

async function reorderTagBefore(fromTag, beforeTag) {
  if (fromTag === beforeTag) return;
  const allTagNames = buildUniqueTags().map(([t]) => t);
  let order = tagOrder.length ? [...tagOrder] : [...allTagNames];
  for (const t of allTagNames) {
    if (!order.includes(t)) order.push(t);
  }
  order = order.filter((t) => t !== fromTag);
  const idx = order.indexOf(beforeTag);
  if (idx < 0) return;
  order.splice(idx, 0, fromTag);
  tagOrder = order;
  await window.GOGPlusStorage.set({ tagOrder });
  renderTagList();
}

let yearReviewYear = null; // null = current year

function availableReviewYears() {
  const years = new Set();
  for (const arr of Object.values(allHistory)) {
    for (const e of arr || []) {
      const y = (e.d || "").slice(0, 4);
      if (/^\d{4}$/.test(y)) years.add(y);
    }
  }
  for (const d of Object.values(allPurchases)) {
    const y = (d || "").slice(0, 4);
    if (/^\d{4}$/.test(y)) years.add(y);
  }
  return [...years].sort().reverse(); // newest first
}

function renderYearReview() {
  const panel = document.getElementById("yearReview");
  if (!panel) return;
  const year = parseInt(yearReviewYear || String(new Date().getFullYear()), 10);
  const yearPrefix = String(year);

  let snapshotsThisYear = 0;
  let gamesTrackedThisYear = 0;
  let biggestDrop = null; // { slug, pct, from, to, when, currency }
  let mostTracked = null; // { slug, count }
  const savingsByCur = {};

  for (const [slug, arr] of Object.entries(allHistory)) {
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

  const purchasesThisYear = Object.values(allPurchases).filter((d) =>
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
    .map(([cur, v]) => `${currencySymbol(cur)}${v.toFixed(2)}`)
    .join(" + ");

  const dropLine = biggestDrop
    ? `<strong>-${biggestDrop.pct}%</strong> on <em>${escapeHtml(slugToTitle(biggestDrop.slug))}</em> on ${biggestDrop.when}
       <span class="yr-detail">${currencySymbol(biggestDrop.currency)}${biggestDrop.from.toFixed(2)} → ${currencySymbol(biggestDrop.currency)}${biggestDrop.to.toFixed(2)}</span>`
    : `<span class="yr-empty">No significant drops captured yet</span>`;

  const mostLine = mostTracked
    ? `<strong>${escapeHtml(slugToTitle(mostTracked.slug))}</strong> <span class="yr-detail">${mostTracked.count} snapshots</span>`
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

  const yrSel = document.getElementById("yrYearSelect");
  if (yrSel) {
    yrSel.addEventListener("change", () => {
      yearReviewYear = yrSel.value;
      renderYearReview();
    });
  }
}

function renderStats() {
  const panel = $("statsPanel");
  if (!panel) return;

  const taggedGames = Object.keys(allTags).filter((s) => (allTags[s] || []).length).length;
  const totalTagsSpent = Object.values(allTags).reduce((a, arr) => a + (arr?.length || 0), 0);
  const uniqueTags = new Set();
  for (const arr of Object.values(allTags)) for (const t of arr || []) uniqueTags.add(t);
  const notesCount = Object.values(allNotes).filter(Boolean).length;
  const trackedGames = Object.keys(allHistory).length;
  const snapshots = Object.values(allHistory).reduce((a, arr) => a + (arr?.length || 0), 0);

  // Oldest snapshot across the whole library
  let oldest = null;
  for (const arr of Object.values(allHistory)) {
    for (const e of arr || []) {
      if (!oldest || e.d < oldest) oldest = e.d;
    }
  }

  // "Watching paid off": for each tracked game, max - latest in the latest entry's currency.
  // Mixed-currency totals are awkward, so group by currency.
  const savingsByCur = {};
  for (const arr of Object.values(allHistory)) {
    if (!arr || arr.length < 2) continue;
    const latest = arr[arr.length - 1];
    const peak = arr.reduce((a, e) => (e.p > a.p ? e : a), arr[0]);
    if (peak.p <= latest.p) continue;
    const cur = latest.c || "USD";
    savingsByCur[cur] = (savingsByCur[cur] || 0) + (peak.p - latest.p);
  }
  const savingsParts = Object.entries(savingsByCur)
    .filter(([, v]) => v > 0)
    .map(([cur, v]) => `${currencySymbol(cur)}${v.toFixed(2)}`)
    .join(" + ");

  // Active refund timers
  const today = new Date().toISOString().slice(0, 10);
  const activeRefunds = Object.entries(allPurchases).filter(([, d]) => {
    if (!d) return false;
    const ms = new Date(today) - new Date(d);
    return ms >= 0 && ms <= 30 * 24 * 60 * 60 * 1000;
  }).length;

  // Storage usage estimate — sum stringified sizes of the local-side blobs.
  // chrome.storage.local quota is 5 MB so we render usage / quota.
  const localBytes = JSON.stringify({
    tags: allTags,
    tagColors,
    tagOrder,
    notes: allNotes,
    priceHistory: allHistory,
    purchaseLog: allPurchases,
  }).length;
  const localKb = (localBytes / 1024).toFixed(1);
  const quotaPct = Math.min(100, (localBytes / (5 * 1024 * 1024)) * 100);
  const storageSub = `${quotaPct < 1 ? "<1" : quotaPct.toFixed(1)}% of 5 MB local quota`;

  const cards = [
    { label: "Tagged games", value: taggedGames, sub: `${uniqueTags.size} unique tag${uniqueTags.size === 1 ? "" : "s"} · ${totalTagsSpent} total` },
    { label: "Notes written", value: notesCount, sub: notesCount === 1 ? "across 1 game" : `across ${notesCount} game${notesCount === 1 ? "" : "s"}` },
    { label: "Games tracked", value: trackedGames, sub: `${snapshots} price snapshot${snapshots === 1 ? "" : "s"}` },
    { label: "Tracking since", value: oldest || "—", sub: oldest ? daysSince(oldest) : "no snapshots yet" },
    { label: "Watch advantage", value: savingsParts || "—", sub: "current vs. peak across tracked games" },
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

function currencySymbol(c) {
  return ({ USD: "$", EUR: "€", GBP: "£", ILS: "₪", RUB: "₽", PLN: "zł" })[c] || `${c} `;
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

function buildUniqueTags() {
  const counts = {};
  for (const slug of Object.keys(allTags)) {
    for (const t of allTags[slug] || []) {
      counts[t] = (counts[t] || 0) + 1;
    }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function renderTagList() {
  const list = $("tagList");
  list.innerHTML = "";
  const tags = sortedTags();
  if (!tags.length) {
    list.innerHTML = `<p class="empty-msg">No tags yet. Visit a game on GOG and add some.</p>`;
    return;
  }
  for (const [tag, count] of tags) {
    const pill = document.createElement("div");
    pill.className = "tag-pill";
    pill.draggable = true;
    pill.dataset.tag = tag;
    if (activeTag === tag) pill.classList.add("active");
    const color = tagColors[tag];
    if (color) pill.style.setProperty("--tag-accent", color);
    pill.innerHTML = `
      <span class="tag-pill-grip" aria-hidden="true">⋮⋮</span>
      <button class="tag-pill-swatch" type="button" aria-label="Pick color for ${escapeHtml(tag)}"></button>
      <span class="tag-pill-name">${escapeHtml(tag)}</span>
      <span class="tag-pill-count">${count}</span>
      <button class="tag-pill-menu" type="button" aria-label="Tag actions">⋯</button>
    `;
    pill.addEventListener("click", (e) => {
      if (e.target.closest(".tag-pill-swatch, .tag-pill-menu")) return;
      activeTag = activeTag === tag ? null : tag;
      renderTagList();
      renderGames();
    });
    pill.querySelector(".tag-pill-swatch").addEventListener("click", (e) => {
      e.stopPropagation();
      openColorPicker(tag, e.currentTarget);
    });
    pill.querySelector(".tag-pill-menu").addEventListener("click", (e) => {
      e.stopPropagation();
      openTagMenu(tag, e.currentTarget);
    });
    pill.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", tag);
      e.dataTransfer.effectAllowed = "move";
      pill.classList.add("dragging");
    });
    pill.addEventListener("dragend", () => pill.classList.remove("dragging"));
    pill.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      pill.classList.add("drag-over");
    });
    pill.addEventListener("dragleave", () => pill.classList.remove("drag-over"));
    pill.addEventListener("drop", async (e) => {
      e.preventDefault();
      pill.classList.remove("drag-over");
      const fromTag = e.dataTransfer.getData("text/plain");
      if (fromTag && fromTag !== tag) await reorderTagBefore(fromTag, tag);
    });
    list.appendChild(pill);
  }
  if (activeTag) {
    const clear = document.createElement("div");
    clear.className = "tag-clear";
    clear.textContent = "× Clear filter";
    clear.addEventListener("click", () => {
      activeTag = null;
      renderTagList();
      renderGames();
    });
    list.appendChild(clear);
  }
}

let sortBy = "name"; // "name" | "lastVisit" | "tagCount" | "snapshots"

// Parse the search box for advanced `key:value` filters. Recognised:
//   tag:rpg           exact tag match (case-insensitive)
//   lowest:<10        all-time-low price less than N (in entry's currency)
//   lowest:>5         all-time-low greater than N
//   snapshots:>3      more than N price snapshots recorded
//   snapshots:<10     fewer than N snapshots
//   since:2026        at least one snapshot dated in YYYY
// Everything else is concatenated and matched as a substring against
// (slug + tags + note) the same way the old search worked.
function parseSearchQuery(input) {
  const f = {
    tag: null,
    lowestLt: null,
    lowestGt: null,
    snapshotsLt: null,
    snapshotsGt: null,
    since: null,
    plain: "",
  };
  if (!input) return f;
  const plain = [];
  for (const tok of input.split(/\s+/)) {
    const m = tok.match(/^(tag|lowest|snapshots|since):(.+)$/i);
    if (!m) {
      plain.push(tok);
      continue;
    }
    const key = m[1].toLowerCase();
    const val = m[2];
    if (key === "tag") f.tag = val.toLowerCase();
    else if (key === "since" && /^\d{4}$/.test(val)) f.since = val;
    else if (key === "lowest" || key === "snapshots") {
      const cmp = val[0];
      const num = parseFloat(val.slice(1));
      if (!Number.isFinite(num)) continue;
      if (cmp === "<") f[key === "lowest" ? "lowestLt" : "snapshotsLt"] = num;
      else if (cmp === ">") f[key === "lowest" ? "lowestGt" : "snapshotsGt"] = num;
    }
  }
  f.plain = plain.join(" ").toLowerCase();
  return f;
}

function matchingSlugs() {
  const f = parseSearchQuery(searchTerm);
  // Union of every known slug — tags, notes, AND history (so users can find
  // tracked-but-untagged games via advanced filters like lowest:<10).
  const slugs = new Set([
    ...Object.keys(allTags),
    ...Object.keys(allNotes),
    ...Object.keys(allHistory),
  ]);
  const out = [];
  for (const slug of slugs) {
    const tags = allTags[slug] || [];
    const note = allNotes[slug] || "";
    const hist = allHistory[slug] || [];

    if (activeTag && !tags.includes(activeTag)) continue;

    // Advanced filters
    if (f.tag && !tags.map((t) => t.toLowerCase()).includes(f.tag)) continue;
    if (f.since && !hist.some((e) => (e.d || "").startsWith(f.since))) continue;
    if (f.lowestLt !== null || f.lowestGt !== null) {
      if (!hist.length) continue;
      const minP = Math.min(...hist.map((e) => e.p));
      if (f.lowestLt !== null && minP >= f.lowestLt) continue;
      if (f.lowestGt !== null && minP <= f.lowestGt) continue;
    }
    if (f.snapshotsLt !== null && hist.length >= f.snapshotsLt) continue;
    if (f.snapshotsGt !== null && hist.length <= f.snapshotsGt) continue;

    if (f.plain) {
      const hay = (slug + " " + tags.join(" ") + " " + note).toLowerCase();
      if (!hay.includes(f.plain)) continue;
    }

    // Even with no plain term, require SOMETHING — tags or note or history.
    // (Otherwise the "show every slug we've ever seen" set is overwhelming.)
    if (!tags.length && !note && !hist.length) continue;
    out.push(slug);
  }
  return applySort(out);
}

function applySort(slugs) {
  const lastVisit = (slug) => {
    const arr = allHistory[slug];
    return arr?.length ? arr[arr.length - 1].d : "";
  };
  const tagCount = (slug) => (allTags[slug]?.length) || 0;
  const snapshots = (slug) => (allHistory[slug]?.length) || 0;

  switch (sortBy) {
    case "lastVisit":
      return slugs.sort((a, b) => lastVisit(b).localeCompare(lastVisit(a)));
    case "tagCount":
      return slugs.sort((a, b) => tagCount(b) - tagCount(a) || a.localeCompare(b));
    case "snapshots":
      return slugs.sort((a, b) => snapshots(b) - snapshots(a) || a.localeCompare(b));
    case "name":
    default:
      return slugs.sort();
  }
}

function renderGames() {
  const list = $("gameList");
  const slugs = matchingSlugs();

  $("counts").textContent = `${slugs.length} game${slugs.length === 1 ? "" : "s"}${
    activeTag ? ` · filter: ${activeTag}` : ""
  }`;

  list.innerHTML = "";
  if (!slugs.length) {
    list.innerHTML = `<p class="empty-msg">No games match your current filter.</p>`;
    return;
  }
  for (const slug of slugs) {
    const card = document.createElement("article");
    card.className = "game-card";
    const tags = allTags[slug] || [];
    const note = allNotes[slug] || "";
    const title = slugToTitle(slug);
    card.innerHTML = `
      <div class="game-card-header">
        <h3 class="game-card-title">${escapeHtml(title)}</h3>
        <button class="game-card-export" type="button" data-slug="${escapeHtml(slug)}" title="Export this game's data as JSON" aria-label="Export ${escapeHtml(title)}">↓</button>
      </div>
      <span class="game-card-slug">${escapeHtml(slug)}</span>
      <div class="game-card-tags">
        ${tags
          .map((t) => {
            const c = tagColors[t];
            const style = c ? ` style="--tag-accent:${c}"` : "";
            return `<span class="game-card-chip ${t === activeTag ? "highlight" : ""}"${style}>${escapeHtml(t)}</span>`;
          })
          .join("")}
      </div>
      ${note ? `<div class="game-card-note">${renderMarkdown(note)}</div>` : ""}
      <a class="game-card-link" href="https://www.gog.com/en/game/${encodeURIComponent(slug)}" target="_blank" rel="noopener">
        Open on GOG →
      </a>
    `;
    card.querySelector(".game-card-export").addEventListener("click", (e) => {
      e.stopPropagation();
      exportSingleGame(slug);
    });
    list.appendChild(card);
  }
}

// Exports the games currently visible (respecting active filter + search)
// as a "tag pack" — a shareable JSON blob. Excludes the heavy priceHistory
// blob to keep packs small and shareable.
function exportPack() {
  const slugs = matchingSlugs();
  if (!slugs.length) {
    alert("No games match the current filter — nothing to export.");
    return;
  }
  const packName =
    prompt(
      `Name this pack (e.g. "RPG backlog 2026").\n\n` +
        `Will include ${slugs.length} game${slugs.length === 1 ? "" : "s"}.`,
      activeTag ? `${activeTag} pack` : `My GOG pack`
    );
  if (packName === null) return; // user cancelled
  const usedTagSet = new Set();
  const games = slugs.map((slug) => {
    const tags = allTags[slug] || [];
    tags.forEach((t) => usedTagSet.add(t));
    return {
      slug,
      tags,
      note: allNotes[slug] || "",
      purchaseDate: allPurchases[slug] || null,
    };
  });
  const usedColors = {};
  for (const t of usedTagSet) {
    if (tagColors[t]) usedColors[t] = tagColors[t];
  }
  const pack = {
    format: "gog-enhancer-tag-pack",
    formatVersion: 1,
    name: packName.trim() || "Untitled pack",
    exportedAt: new Date().toISOString(),
    gameCount: games.length,
    games,
    tagColors: usedColors,
  };
  const blob = new Blob([JSON.stringify(pack, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = pack.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  a.download = `gog-plus-pack-${safeName || "untitled"}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importPackFromFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const pack = JSON.parse(text);
    if (pack?.format !== "gog-enhancer-tag-pack") {
      throw new Error("Not a recognised tag pack (wrong format field).");
    }
    if (!Array.isArray(pack.games)) {
      throw new Error("Pack has no games array.");
    }
    const summary =
      `Import "${pack.name || "untitled"}"?\n\n` +
      `Pack contains ${pack.games.length} game${pack.games.length === 1 ? "" : "s"}.\n` +
      `Exported at ${pack.exportedAt || "unknown date"}.\n\n` +
      `Merge mode:\n` +
      `• Tags are added to your existing tags (no duplicates)\n` +
      `• Notes are only set if you don't already have one\n` +
      `• Purchase dates are only set if you don't already have one\n` +
      `• Tag colors are only set if you don't already have one\n\n` +
      `Nothing is overwritten.`;
    if (!confirm(summary)) return;

    let tagsAdded = 0;
    let notesAdded = 0;
    let purchasesAdded = 0;
    let colorsAdded = 0;
    for (const g of pack.games) {
      if (!g?.slug) continue;
      if (Array.isArray(g.tags) && g.tags.length) {
        const existing = new Set(allTags[g.slug] || []);
        const before = existing.size;
        for (const t of g.tags) existing.add(t);
        if (existing.size > before) {
          allTags[g.slug] = [...existing];
          tagsAdded += existing.size - before;
        }
      }
      if (g.note && !allNotes[g.slug]) {
        allNotes[g.slug] = g.note;
        notesAdded++;
      }
      if (g.purchaseDate && !allPurchases[g.slug]) {
        allPurchases[g.slug] = g.purchaseDate;
        purchasesAdded++;
      }
    }
    if (pack.tagColors && typeof pack.tagColors === "object") {
      for (const [t, c] of Object.entries(pack.tagColors)) {
        if (!tagColors[t] && typeof c === "string" && /^#[0-9a-f]{3,8}$/i.test(c)) {
          tagColors[t] = c;
          colorsAdded++;
        }
      }
    }
    await window.GOGPlusStorage.set({
      tags: allTags,
      notes: allNotes,
      purchaseLog: allPurchases,
      tagColors,
    });
    renderStats();
    renderYearReview();
    renderSaleHeatmap();
    renderTagList();
    renderGames();
    alert(
      `Pack "${pack.name}" imported:\n` +
        `• ${tagsAdded} tag${tagsAdded === 1 ? "" : "s"} added\n` +
        `• ${notesAdded} note${notesAdded === 1 ? "" : "s"} added\n` +
        `• ${purchasesAdded} purchase date${purchasesAdded === 1 ? "" : "s"} added\n` +
        `• ${colorsAdded} tag color${colorsAdded === 1 ? "" : "s"} added`
    );
  } catch (err) {
    alert("Pack import failed: " + err.message);
  } finally {
    e.target.value = "";
  }
}

function exportSingleGame(slug) {
  const payload = {
    slug,
    exportedAt: new Date().toISOString(),
    tags: allTags[slug] || [],
    note: allNotes[slug] || "",
    purchaseDate: allPurchases[slug] || null,
    priceHistory: allHistory[slug] || [],
    tagColors: Object.fromEntries(
      (allTags[slug] || []).filter((t) => tagColors[t]).map((t) => [t, tagColors[t]])
    ),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gog-plus-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slugToTitle(slug) {
  return slug
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Minimal markdown renderer for notes. Operates on already-escaped text, so
// the only "<" tags in the output come from our intentional substitutions.
// Supports: **bold**, *italic*, [text](https-url), `code`, - lists, paragraphs.
function renderMarkdown(text) {
  if (!text) return "";
  let html = escapeHtml(text);

  // Inline code first (so we don't process * inside `code`)
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bold then italic
  html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");

  // Links: only allow http(s) — javascript:, data:, etc. are dropped (text kept).
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, url) => {
    if (!/^https?:\/\//i.test(url)) return match;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  // Group consecutive "- " lines into <ul>
  html = html.replace(/(?:^|\n)((?:- [^\n]+(?:\n|$))+)/g, (block) => {
    const items = block
      .trim()
      .split("\n")
      .map((line) => line.replace(/^- /, ""))
      .map((line) => `<li>${line}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  });

  // Remaining line breaks → <br>, but not adjacent to block tags
  html = html.replace(/\n/g, "<br>");
  html = html.replace(/(<\/?(ul|li)>)<br>/g, "$1");
  html = html.replace(/<br>(<\/?(ul|li)>)/g, "$1");

  return html;
}

function bind() {
  $("search").addEventListener("input", (e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    renderGames();
  });
  $("exportCsv").addEventListener("click", exportCsv);
  $("densityToggle").addEventListener("click", async () => {
    density = density === "compact" ? "comfortable" : "compact";
    applyDensityClass();
    await window.GOGPlusStorage.set({ tagDashboardDensity: density });
  });
  $("sortBy").addEventListener("change", (e) => {
    sortBy = e.target.value;
    renderGames();
  });
  $("exportPack").addEventListener("click", exportPack);
  $("importPack").addEventListener("click", () => $("importPackFile").click());
  $("importPackFile").addEventListener("change", importPackFromFile);
  document.addEventListener("click", (e) => {
    const picker = document.getElementById("tagColorPicker");
    if (picker && !picker.contains(e.target) && !e.target.closest(".tag-pill-swatch")) {
      picker.remove();
    }
    const menu = document.getElementById("tagActionMenu");
    if (menu && !menu.contains(e.target) && !e.target.closest(".tag-pill-menu")) {
      menu.remove();
    }
  });
}

function openTagMenu(tag, anchor) {
  document.getElementById("tagActionMenu")?.remove();
  document.getElementById("tagColorPicker")?.remove();
  const menu = document.createElement("div");
  menu.id = "tagActionMenu";
  menu.className = "tag-action-menu";
  menu.innerHTML = `
    <button data-act="rename" type="button">Rename…</button>
    <button data-act="merge"  type="button">Merge into…</button>
    <button data-act="delete" type="button" class="danger">Delete from all games</button>
  `;
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.left = `${Math.round(r.right + window.scrollX - menu.offsetWidth)}px`;
  menu.style.top = `${Math.round(r.bottom + window.scrollY + 6)}px`;

  menu.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    menu.remove();
    if (btn.dataset.act === "rename") await renameTag(tag);
    else if (btn.dataset.act === "merge") await mergeTag(tag);
    else if (btn.dataset.act === "delete") await deleteTag(tag);
  });
}

async function renameTag(oldName) {
  const newName = prompt(`Rename "${oldName}" to:`, oldName);
  if (!newName || newName === oldName) return;
  const trimmed = newName.trim();
  if (!trimmed) return;
  for (const slug of Object.keys(allTags)) {
    allTags[slug] = (allTags[slug] || []).map((t) => (t === oldName ? trimmed : t));
    // De-dup in case the new name already existed on the same slug
    allTags[slug] = Array.from(new Set(allTags[slug]));
  }
  if (tagColors[oldName] && !tagColors[trimmed]) {
    tagColors[trimmed] = tagColors[oldName];
  }
  delete tagColors[oldName];
  if (activeTag === oldName) activeTag = trimmed;
  await window.GOGPlusStorage.set({ tags: allTags, tagColors });
  renderTagList();
  renderGames();
  renderStats();
}

async function mergeTag(fromName) {
  const all = Object.keys(buildUniqueTags().reduce((a, [t]) => ((a[t] = 1), a), {}))
    .filter((t) => t !== fromName);
  if (!all.length) {
    alert("No other tags to merge into.");
    return;
  }
  const toName = prompt(
    `Merge "${fromName}" into which tag?\n\nExisting: ${all.join(", ")}`,
    all[0]
  );
  if (!toName || toName === fromName) return;
  const trimmed = toName.trim();
  if (!trimmed) return;
  for (const slug of Object.keys(allTags)) {
    allTags[slug] = (allTags[slug] || []).map((t) => (t === fromName ? trimmed : t));
    allTags[slug] = Array.from(new Set(allTags[slug]));
  }
  // tagColors: keep the merge-target's color if it exists, otherwise inherit
  if (!tagColors[trimmed] && tagColors[fromName]) {
    tagColors[trimmed] = tagColors[fromName];
  }
  delete tagColors[fromName];
  if (activeTag === fromName) activeTag = trimmed;
  await window.GOGPlusStorage.set({ tags: allTags, tagColors });
  renderTagList();
  renderGames();
  renderStats();
}

async function deleteTag(name) {
  if (!confirm(`Delete "${name}" from every game? This cannot be undone.`)) return;
  for (const slug of Object.keys(allTags)) {
    allTags[slug] = (allTags[slug] || []).filter((t) => t !== name);
    if (!allTags[slug].length) delete allTags[slug];
  }
  delete tagColors[name];
  if (activeTag === name) activeTag = null;
  await window.GOGPlusStorage.set({ tags: allTags, tagColors });
  renderTagList();
  renderGames();
  renderStats();
}

function openColorPicker(tag, anchor) {
  document.getElementById("tagColorPicker")?.remove();
  const picker = document.createElement("div");
  picker.id = "tagColorPicker";
  picker.className = "tag-color-picker";
  const swatchesHtml = TAG_COLOR_SWATCHES.map(
    (c) =>
      `<button class="tag-color-swatch ${tagColors[tag] === c ? "active" : ""}"
        data-color="${c}" style="background:${c}" type="button"
        aria-label="Use ${c}"></button>`
  ).join("");
  const currentColor = tagColors[tag] || "#c64fff";
  picker.innerHTML = `
    ${swatchesHtml}
    <label class="tag-color-custom" title="Pick any color">
      <input type="color" id="tagColorCustom" value="${currentColor}" />
      <span class="tag-color-custom-label">Custom</span>
    </label>
    <button class="tag-color-clear" data-clear="1" type="button">Default</button>
  `;
  document.body.appendChild(picker);

  const r = anchor.getBoundingClientRect();
  picker.style.left = `${Math.round(r.left + window.scrollX)}px`;
  picker.style.top = `${Math.round(r.bottom + window.scrollY + 6)}px`;

  const saveColor = async (color) => {
    if (color === null) delete tagColors[tag];
    else tagColors[tag] = color;
    await window.GOGPlusStorage.set({ tagColors });
    picker.remove();
    renderTagList();
    renderGames();
  };

  picker.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-color], [data-clear]");
    if (!btn) return;
    saveColor(btn.dataset.clear ? null : btn.dataset.color);
  });
  // The native color input doesn't fire "click" usefully — use "change".
  // We don't dismiss on input — let the user open the OS picker freely.
  picker.querySelector("#tagColorCustom").addEventListener("change", (e) => {
    saveColor(e.target.value);
  });
}

function exportCsv() {
  const rows = [["slug", "tags", "note"]];
  const slugs = new Set([...Object.keys(allTags), ...Object.keys(allNotes)]);
  for (const slug of slugs) {
    const t = (allTags[slug] || []).join("; ");
    const n = (allNotes[slug] || "").replace(/"/g, '""').replace(/\r?\n/g, " ");
    rows.push([slug, `"${t.replace(/"/g, '""')}"`, `"${n}"`]);
  }
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gog-plus-tags-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.addEventListener("DOMContentLoaded", init);
