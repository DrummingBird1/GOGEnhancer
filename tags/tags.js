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
let activeTag = null;
let searchTerm = "";

async function init() {
  const data = await window.GOGPlusStorage.get({ tags: {}, notes: {} });
  allTags = data.tags || {};
  allNotes = data.notes || {};
  renderTagList();
  renderGames();
  bind();
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
  const tags = buildUniqueTags();
  if (!tags.length) {
    list.innerHTML = `<p class="empty-msg">No tags yet. Visit a game on GOG and add some.</p>`;
    return;
  }
  for (const [tag, count] of tags) {
    const pill = document.createElement("div");
    pill.className = "tag-pill";
    if (activeTag === tag) pill.classList.add("active");
    pill.innerHTML = `
      <span class="tag-pill-name">${escapeHtml(tag)}</span>
      <span class="tag-pill-count">${count}</span>
    `;
    pill.addEventListener("click", () => {
      activeTag = activeTag === tag ? null : tag;
      renderTagList();
      renderGames();
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

function matchingSlugs() {
  const slugs = new Set([...Object.keys(allTags), ...Object.keys(allNotes)]);
  const out = [];
  for (const slug of slugs) {
    const tags = allTags[slug] || [];
    const note = allNotes[slug] || "";
    if (activeTag && !tags.includes(activeTag)) continue;
    if (searchTerm) {
      const hay = (slug + " " + tags.join(" ") + " " + note).toLowerCase();
      if (!hay.includes(searchTerm)) continue;
    }
    if (!tags.length && !note) continue;
    out.push(slug);
  }
  return out.sort();
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
      <h3 class="game-card-title">${escapeHtml(title)}</h3>
      <span class="game-card-slug">${escapeHtml(slug)}</span>
      <div class="game-card-tags">
        ${tags
          .map(
            (t) =>
              `<span class="game-card-chip ${t === activeTag ? "highlight" : ""}">${escapeHtml(t)}</span>`
          )
          .join("")}
      </div>
      ${note ? `<div class="game-card-note">${escapeHtml(note)}</div>` : ""}
      <a class="game-card-link" href="https://www.gog.com/en/game/${encodeURIComponent(slug)}" target="_blank" rel="noopener">
        Open on GOG →
      </a>
    `;
    list.appendChild(card);
  }
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

function bind() {
  $("search").addEventListener("input", (e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    renderGames();
  });
  $("exportCsv").addEventListener("click", exportCsv);
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
