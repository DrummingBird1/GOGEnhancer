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

function parseSearchQuery(input) {
  const f = {
    tag: null,
    lowestLt: null,
    lowestGt: null,
    snapshotsLt: null,
    snapshotsGt: null,
    since: null,
    status: null,
    plain: "",
  };
  if (!input) return f;
  const plain = [];
  for (const tok of input.split(/\s+/)) {
    const m = tok.match(/^(tag|lowest|snapshots|since|status):(.+)$/i);
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
    const statusButtons = STATUSES.map((s) => {
      const active = s.id === currentStatus;
      return `<button class="game-card-status-btn${active ? " active" : ""}" type="button"
        data-status="${s.id}" style="${active ? `--status-accent:${s.color}` : ""}"
        aria-pressed="${active}" aria-label="Mark as ${s.label}" title="${s.label}">${s.icon}</button>`;
    }).join("");
    card.innerHTML = `
      <div class="game-card-header">
        <h3 class="game-card-title">${escapeHtml(title)}</h3>
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
      ${note ? `<div class="game-card-note">${renderMarkdown(note)}</div>` : ""}
      <a class="game-card-link" href="https://www.gog.com/en/game/${encodeURIComponent(slug)}" target="_blank" rel="noopener">
        Open on GOG →
      </a>
    `;
    card.querySelector(".game-card-export").addEventListener("click", (e) => {
      e.stopPropagation();
      window.GOGPlusTagsExportImport.exportSingleGame(slug);
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
    list.appendChild(card);
  }
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
  };
})();
