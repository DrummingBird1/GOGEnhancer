/**
 * GOG+ tag CRUD + presentation: the sorted/orderable tag-pill list, the
 * colour picker, and the rename/merge/delete action menu. Pulled out of
 * the former single-file tags.js during the v2.8.0 module split.
 */

(() => {
  "use strict";

  const state = window.GOGPlusTagsState;
  const { $, TAG_COLOR_SWATCHES } = window.GOGPlusTagsConstants;
  const { escapeHtml } = window.GOGPlusDomSafety;

function sortedTags() {
  const tags = buildUniqueTags();
  return tags.sort((a, b) => {
    const ai = state.tagOrder.indexOf(a[0]);
    const bi = state.tagOrder.indexOf(b[0]);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return b[1] - a[1] || a[0].localeCompare(b[0]);
  });
}

async function reorderTagBefore(fromTag, beforeTag) {
  if (fromTag === beforeTag) return;
  const allTagNames = buildUniqueTags().map(([t]) => t);
  let order = state.tagOrder.length ? [...state.tagOrder] : [...allTagNames];
  for (const t of allTagNames) {
    if (!order.includes(t)) order.push(t);
  }
  order = order.filter((t) => t !== fromTag);
  const idx = order.indexOf(beforeTag);
  if (idx < 0) return;
  order.splice(idx, 0, fromTag);
  state.tagOrder = order;
  await window.GOGPlusStorage.set({ tagOrder: state.tagOrder });
  renderTagList();
}


function buildUniqueTags() {
  const counts = {};
  for (const slug of Object.keys(state.allTags)) {
    for (const t of state.allTags[slug] || []) {
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
    if (state.activeTag === tag) pill.classList.add("active");
    const color = state.tagColors[tag];
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
      state.activeTag = state.activeTag === tag ? null : tag;
      renderTagList();
      window.GOGPlusTagsGamesList.renderGames();
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
  if (state.activeTag) {
    const clear = document.createElement("div");
    clear.className = "tag-clear";
    clear.textContent = "× Clear filter";
    clear.addEventListener("click", () => {
      state.activeTag = null;
      renderTagList();
      window.GOGPlusTagsGamesList.renderGames();
    });
    list.appendChild(clear);
  }
}


// guard so a tag color interpolated into an HTML style attribute can never
// be a CSS-injection vector, independent of write-time validation.
function safeHexColor(c) {
  return typeof c === "string" && /^#[0-9a-f]{3,8}$/i.test(c) ? c : "";
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
  for (const slug of Object.keys(state.allTags)) {
    state.allTags[slug] = (state.allTags[slug] || []).map((t) => (t === oldName ? trimmed : t));
    // De-dup in case the new name already existed on the same slug
    state.allTags[slug] = Array.from(new Set(state.allTags[slug]));
  }
  if (state.tagColors[oldName] && !state.tagColors[trimmed]) {
    state.tagColors[trimmed] = state.tagColors[oldName];
  }
  delete state.tagColors[oldName];
  if (state.activeTag === oldName) state.activeTag = trimmed;
  await window.GOGPlusStorage.set({ tags: state.allTags, tagColors: state.tagColors });
  renderTagList();
  window.GOGPlusTagsGamesList.renderGames();
  await window.GOGPlusTagsStats.renderStats();
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
  for (const slug of Object.keys(state.allTags)) {
    state.allTags[slug] = (state.allTags[slug] || []).map((t) => (t === fromName ? trimmed : t));
    state.allTags[slug] = Array.from(new Set(state.allTags[slug]));
  }
  // Keep the merge-target's color if it exists, otherwise inherit the source's
  if (!state.tagColors[trimmed] && state.tagColors[fromName]) {
    state.tagColors[trimmed] = state.tagColors[fromName];
  }
  delete state.tagColors[fromName];
  if (state.activeTag === fromName) state.activeTag = trimmed;
  await window.GOGPlusStorage.set({ tags: state.allTags, tagColors: state.tagColors });
  renderTagList();
  window.GOGPlusTagsGamesList.renderGames();
  await window.GOGPlusTagsStats.renderStats();
}

// Deletes a tag from every game it's on. Replaces the old blocking
// confirm() dialog with a reversible "Deleted · Undo" toast instead — the
// snapshot below is a real restore (not a deferred commit), so the
// deletion is already safely persisted even if the tab closes before the
// undo window elapses.
async function deleteTag(name) {
  const affectedSlugs = Object.keys(state.allTags).filter((slug) =>
    (state.allTags[slug] || []).includes(name)
  );
  const snapshot = {
    tagsBySlug: Object.fromEntries(
      affectedSlugs.map((slug) => [slug, [...state.allTags[slug]]])
    ),
    color: state.tagColors[name],
    wasActive: state.activeTag === name,
  };

  const commitDeletion = async () => {
    for (const slug of Object.keys(state.allTags)) {
      state.allTags[slug] = (state.allTags[slug] || []).filter((t) => t !== name);
      if (!state.allTags[slug].length) delete state.allTags[slug];
    }
    delete state.tagColors[name];
    if (state.activeTag === name) state.activeTag = null;
    await window.GOGPlusStorage.set({ tags: state.allTags, tagColors: state.tagColors });
    renderTagList();
    window.GOGPlusTagsGamesList.renderGames();
    await window.GOGPlusTagsStats.renderStats();
  };

  await commitDeletion();

  window.GOGPlusToasts?.show(`Deleted "${name}"`, {
    variant: "muted",
    duration: 5000,
    action: {
      label: "Undo",
      onClick: async () => {
        for (const [slug, tags] of Object.entries(snapshot.tagsBySlug)) {
          state.allTags[slug] = tags;
        }
        if (snapshot.color) state.tagColors[name] = snapshot.color;
        if (snapshot.wasActive) state.activeTag = name;
        await window.GOGPlusStorage.set({ tags: state.allTags, tagColors: state.tagColors });
        renderTagList();
        window.GOGPlusTagsGamesList.renderGames();
        await window.GOGPlusTagsStats.renderStats();
      },
    },
  });
}

function openColorPicker(tag, anchor) {
  document.getElementById("tagColorPicker")?.remove();
  const picker = document.createElement("div");
  picker.id = "tagColorPicker";
  picker.className = "tag-color-picker";
  const swatchesHtml = TAG_COLOR_SWATCHES.map(
    (c) =>
      `<button class="tag-color-swatch ${state.tagColors[tag] === c ? "active" : ""}"
        data-color="${c}" style="background:${c}" type="button"
        aria-label="Use ${c}"></button>`
  ).join("");
  const currentColor = state.tagColors[tag] || "#c64fff";
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
    if (color === null) delete state.tagColors[tag];
    else state.tagColors[tag] = color;
    await window.GOGPlusStorage.set({ tagColors: state.tagColors });
    picker.remove();
    renderTagList();
    window.GOGPlusTagsGamesList.renderGames();
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

  window.GOGPlusTagsManagement = {
    sortedTags,
    reorderTagBefore,
    buildUniqueTags,
    renderTagList,
    safeHexColor,
    openTagMenu,
    renameTag,
    mergeTag,
    deleteTag,
    openColorPicker,
  };
})();
