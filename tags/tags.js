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
  });
  allTags = data.tags || {};
  allNotes = data.notes || {};
  allHistory = data.priceHistory || {};
  allPurchases = data.purchaseLog || {};
  tagColors = data.tagColors || {};
  tagOrder = Array.isArray(data.tagOrder) ? data.tagOrder : [];
  renderStats();
  renderYearReview();
  renderTagList();
  renderGames();
  bind();
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

function renderYearReview() {
  const panel = document.getElementById("yearReview");
  if (!panel) return;
  const year = new Date().getFullYear();
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

  panel.innerHTML = `
    <header class="yr-header">
      <span class="yr-eyebrow">Your ${year} in GOG</span>
      <h2>Library year-in-review</h2>
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

  const cards = [
    { label: "Tagged games", value: taggedGames, sub: `${uniqueTags.size} unique tag${uniqueTags.size === 1 ? "" : "s"} · ${totalTagsSpent} total` },
    { label: "Notes written", value: notesCount, sub: notesCount === 1 ? "across 1 game" : `across ${notesCount} game${notesCount === 1 ? "" : "s"}` },
    { label: "Games tracked", value: trackedGames, sub: `${snapshots} price snapshot${snapshots === 1 ? "" : "s"}` },
    { label: "Tracking since", value: oldest || "—", sub: oldest ? daysSince(oldest) : "no snapshots yet" },
    { label: "Watch advantage", value: savingsParts || "—", sub: "current vs. peak across tracked games" },
    { label: "Refunds open", value: activeRefunds, sub: activeRefunds ? "within 30-day window" : "no purchases logged" },
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
  picker.innerHTML = `
    ${swatchesHtml}
    <button class="tag-color-clear" data-clear="1" type="button">Default</button>
  `;
  document.body.appendChild(picker);

  const r = anchor.getBoundingClientRect();
  picker.style.left = `${Math.round(r.left + window.scrollX)}px`;
  picker.style.top = `${Math.round(r.bottom + window.scrollY + 6)}px`;

  picker.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-color], [data-clear]");
    if (!btn) return;
    if (btn.dataset.clear) {
      delete tagColors[tag];
    } else {
      tagColors[tag] = btn.dataset.color;
    }
    await window.GOGPlusStorage.set({ tagColors });
    picker.remove();
    renderTagList();
    renderGames();
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
