/**
 * GOG+ tag-dashboard games list: search/filter (including advanced
 * `tag:`/`lowest:`/`snapshots:`/`since:` query syntax), sorting, and the
 * per-game card grid with its per-game export button. Pulled out of the
 * former single-file tags.js during the v2.8.0 module split.
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusTagsState;
  const { $ } = window.GOGPlusTagsConstants;
  const { escapeHtml } = window.GOGPlusDomSafety;
  const { safeHexColor } = window.GOGPlusTagsManagement;
  const { STATUSES } = window.GOGPlusGameStatus;
  const { symbolFor } = window.GOGPlusCurrencyFormat;
  const { matchGenrePattern } = window.GOGPlusGenres;

  // Display names for lib/genres.js's bucket ids — a couple don't
  // capitalize cleanly on their own ("scifi", "rpg").
  const GENRE_DISPLAY_NAMES = {
    horror: "Horror",
    strategy: "Strategy",
    scifi: "Sci-Fi",
    rpg: "RPG",
    indie: "Indie",
  };

  // Auto-tag suggestion: only for a game with NO tags yet, and only when a
  // genre can be resolved (the confirmed per-visit cache first, falling
  // back to the slug-pattern heuristic — same resolution order as
  // recommendations.js's genreFor and stats.js's renderGenreDistribution).
  // Suggestion only — never applied without the user clicking it.
  /**
   * @param {string} slug
   * @returns {string | null}
   */
  function genreSuggestionFor(slug) {
    if ((state.allTags[slug] || []).length) return null;
    const bucket = state.allGenres[slug] || matchGenrePattern(slug);
    if (!bucket) return null;
    return GENRE_DISPLAY_NAMES[bucket] || bucket;
  }

function parseSearchQuery(input) {
  const f = {
    tag: null,
    lowestLt: null,
    lowestGt: null,
    snapshotsLt: null,
    snapshotsGt: null,
    since: null,
    status: null,
    genre: null,
    plain: "",
  };
  if (!input) return f;
  const plain = [];
  for (const tok of input.split(/\s+/)) {
    const m = tok.match(/^(tag|lowest|snapshots|since|status|genre):(.+)$/i);
    if (!m) {
      plain.push(tok);
      continue;
    }
    const key = m[1].toLowerCase();
    const val = m[2];
    if (key === "tag") f.tag = val.toLowerCase();
    else if (key === "since" && /^\d{4}$/.test(val)) f.since = val;
    else if (key === "status" && STATUSES.some((s) => s.id === val.toLowerCase())) {
      f.status = val.toLowerCase();
    } else if (key === "genre") {
      f.genre = val.toLowerCase();
    } else if (key === "lowest" || key === "snapshots") {
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
  const f = parseSearchQuery(state.searchTerm);
  // Union of every known slug — tags, notes, AND history (so users can find
  // tracked-but-untagged games via advanced filters like lowest:<10).
  const slugs = new Set([
    ...Object.keys(state.allTags),
    ...Object.keys(state.allNotes),
    ...Object.keys(state.allHistory),
    ...Object.keys(state.allStatus),
  ]);
  const out = [];
  for (const slug of slugs) {
    const tags = state.allTags[slug] || [];
    const note = state.allNotes[slug] || "";
    const hist = state.allHistory[slug] || [];
    const status = state.allStatus[slug] || null;

    if (state.activeTag && !tags.includes(state.activeTag)) continue;

    // Advanced filters
    if (f.tag && !tags.map((t) => t.toLowerCase()).includes(f.tag)) continue;
    if (f.status && status !== f.status) continue;
    if (f.genre) {
      const bucket = state.allGenres[slug] || matchGenrePattern(slug);
      if ((bucket || "").toLowerCase() !== f.genre) continue;
    }
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

    // Even with no plain term, require SOMETHING — tags, note, history, or a
    // set status. (Otherwise the "show every slug we've ever seen" set is
    // overwhelming.)
    if (!tags.length && !note && !hist.length && !status) continue;
    out.push(slug);
  }
  return applySort(out);
}

function applySort(slugs) {
  const lastVisit = (slug) => {
    const arr = state.allHistory[slug];
    return arr?.length ? arr[arr.length - 1].d : "";
  };
  const tagCount = (slug) => (state.allTags[slug]?.length) || 0;
  const snapshots = (slug) => (state.allHistory[slug]?.length) || 0;

  switch (state.sortBy) {
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
    state.activeTag ? ` · filter: ${state.activeTag}` : ""
  }`;

  list.innerHTML = "";
  if (!slugs.length) {
    list.innerHTML = `<p class="empty-msg">No games match your current filter.</p>`;
    return;
  }
  for (const slug of slugs) {
    const card = document.createElement("article");
    card.className = "game-card";
    const tags = state.allTags[slug] || [];
    const note = state.allNotes[slug] || "";
    const title = slugToTitle(slug);
    const currentStatus = state.allStatus[slug] || null;
    const history = state.allHistory[slug];
    const hasChart = history && history.length >= 2;
    const suggestion = genreSuggestionFor(slug);
    const statusButtons = STATUSES.map((s) => {
      const active = s.id === currentStatus;
      return `<button class="game-card-status-btn${active ? " active" : ""}" type="button"
        data-status="${s.id}" style="${active ? `--status-accent:${s.color}` : ""}"
        aria-pressed="${active}" aria-label="Mark as ${s.label}" title="${s.label}">${s.icon}</button>`;
    }).join("");
    card.innerHTML = `
      <div class="game-card-header">
        <h3 class="game-card-title">${escapeHtml(title)}</h3>
        ${hasChart ? `<button class="game-card-chart-toggle" type="button" title="Show price-history chart" aria-label="Show price-history chart for ${escapeHtml(title)}" aria-expanded="false">📈</button>` : ""}
        <button class="game-card-export" type="button" data-slug="${escapeHtml(slug)}" title="Export this game's data as JSON" aria-label="Export ${escapeHtml(title)}">↓</button>
      </div>
      <div class="game-card-status" role="group" aria-label="Play status">${statusButtons}</div>
      <span class="game-card-slug">${escapeHtml(slug)}</span>
      <div class="game-card-tags">
        ${tags
          .map((t) => {
            const c = safeHexColor(state.tagColors[t]);
            const style = c ? ` style="--tag-accent:${c}"` : "";
            return `<span class="game-card-chip ${t === state.activeTag ? "highlight" : ""}"${style}>${escapeHtml(t)}</span>`;
          })
          .join("")}
      </div>
      ${suggestion ? `<button class="game-card-tag-suggestion" type="button" data-suggest="${escapeHtml(suggestion)}">+ Suggested tag: ${escapeHtml(suggestion)}</button>` : ""}
      <div class="game-card-attachment-slot"></div>
      ${note ? `<div class="game-card-note">${renderMarkdown(note)}</div>` : ""}
      ${hasChart ? `<div class="game-card-chart" hidden></div>` : ""}
      <a class="game-card-link" href="https://www.gog.com/en/game/${encodeURIComponent(slug)}" target="_blank" rel="noopener">
        Open on GOG →
      </a>
    `;
    card.querySelector(".game-card-export").addEventListener("click", (e) => {
      e.stopPropagation();
      window.GOGPlusTagsExportImport.exportSingleGame(slug);
    });
    card.querySelector(".game-card-tag-suggestion")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      const btn = /** @type {HTMLButtonElement} */ (e.currentTarget);
      const tag = btn.dataset.suggest;
      const cur = { ...state.allTags, [slug]: [tag] };
      state.allTags = cur;
      await window.GOGPlusStorage.set({ tags: cur });
      window.GOGPlusTagsManagement.renderTagList();
      renderGames();
    });
    card.querySelectorAll(".game-card-status-btn").forEach((btnEl) => {
      const btn = /** @type {HTMLElement} */ (btnEl);
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.status;
        // Clicking the already-active status clears it back to "none".
        if (state.allStatus[slug] === id) {
          delete state.allStatus[slug];
        } else {
          state.allStatus[slug] = id;
        }
        await window.GOGPlusStorage.set({ gameStatus: state.allStatus });
        renderGames();
      });
    });
    hydrateAttachmentSlot(card.querySelector(".game-card-attachment-slot"), slug);
    if (hasChart) {
      const toggleBtn = card.querySelector(".game-card-chart-toggle");
      const chartPanel = /** @type {HTMLElement} */ (card.querySelector(".game-card-chart"));
      let built = false;
      toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const willShow = !!chartPanel.hidden;
        if (willShow && !built) {
          chartPanel.innerHTML = buildDashboardChart(history);
          built = true;
        }
        chartPanel.hidden = !willShow;
        toggleBtn.setAttribute("aria-expanded", String(willShow));
        toggleBtn.classList.toggle("is-active", willShow);
      });
    }
    list.appendChild(card);
  }
}

// A compact inline-SVG line chart for one game's price history, shown when
// a card's chart toggle is expanded. Same hand-built-SVG approach as
// content/features/game-page.js's renderSparkline and card-badges.js's
// buildMiniSparkline — each context builds its own, sized for its own use;
// see CLAUDE.md's content-script load-order notes on why there's no shared
// abstraction across the content-script/dashboard boundary.
/**
 * @param {Array<{d: string, p: number, c: string}>} entries
 * @returns {string}
 */
function buildDashboardChart(entries) {
  const W = 400, H = 90, PAD_X = 8, PAD_Y = 10;
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
  const sym = symbolFor(entries[lastIdx].c || "USD");
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-label="Price history chart">
      <defs>
        <linearGradient id="dashChartFill-${entries.length}-${minIdx}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="var(--accent-magenta)" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="var(--accent-magenta)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#dashChartFill-${entries.length}-${minIdx})"/>
      <path d="${linePath}" fill="none" stroke="var(--accent-cyan)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${points[minIdx][0].toFixed(1)}" cy="${points[minIdx][1].toFixed(1)}" r="3" fill="#7fffa6" stroke="var(--bg-base)" stroke-width="1.5"/>
      <circle cx="${points[lastIdx][0].toFixed(1)}" cy="${points[lastIdx][1].toFixed(1)}" r="3" fill="var(--accent-magenta)" stroke="var(--bg-base)" stroke-width="1.5"/>
    </svg>
    <div class="game-card-chart-legend">
      <span>Low: ${sym}${minP.toFixed(2)}</span>
      <span>Avg: ${sym}${avg.toFixed(2)}</span>
      <span>Latest: ${sym}${entries[lastIdx].p.toFixed(2)}</span>
    </div>
  `;
}

// One downscaled image per game, stored in IndexedDB via lib/attachments.js
// (never chrome.storage.local — see that module's own doc comment on why).
// Rendered as its own async hydration step per card rather than inline in
// renderGames()'s synchronous loop, since IndexedDB reads are promise-based.
/**
 * @param {Element | null} slot
 * @param {string} slug
 */
async function hydrateAttachmentSlot(slot, slug) {
  if (!slot) return;
  let record;
  try {
    record = await window.GOGPlusAttachments.getAttachment(slug);
  } catch (_) {
    record = undefined;
  }
  if (!record) {
    renderAttachButton(slot, slug);
    return;
  }
  const url = URL.createObjectURL(record.blob);
  slot.innerHTML = `
    <div class="game-card-attachment">
      <img src="${url}" alt="Attached image for ${escapeHtml(slug)}" />
      <div class="game-card-attachment-actions">
        <button type="button" class="game-card-attachment-remove">Remove image</button>
      </div>
    </div>
  `;
  slot.querySelector(".game-card-attachment-remove")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    URL.revokeObjectURL(url);
    await window.GOGPlusAttachments.deleteAttachment(slug);
    renderAttachButton(slot, slug);
  });
}

/**
 * @param {Element} slot
 * @param {string} slug
 */
function renderAttachButton(slot, slug) {
  slot.innerHTML = `<button type="button" class="game-card-attach-btn">📎 Attach image</button>`;
  slot.querySelector(".game-card-attach-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      await window.GOGPlusAttachments.saveAttachmentDownscaled(slug, file);
      hydrateAttachmentSlot(slot, slug);
    });
    input.click();
  });
}

function slugToTitle(slug) {
  return slug
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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

  window.GOGPlusTagsGamesList = {
    parseSearchQuery,
    matchingSlugs,
    applySort,
    renderGames,
    slugToTitle,
    renderMarkdown,
    buildDashboardChart,
    genreSuggestionFor,
    GENRE_DISPLAY_NAMES,
    hydrateAttachmentSlot,
  };
})();
