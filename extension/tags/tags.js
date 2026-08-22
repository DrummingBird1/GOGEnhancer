/**
 * GOG+ tag dashboard orchestrator (v2.8.0+, post module-split).
 *
 * Was a single ~1028-line top-level script through v2.7.0; the individual
 * features are now tags/state.js and tags/features/*.js — see CLAUDE.md's
 * content-script/tag-dashboard load-order notes. This file is left with
 * only what's genuinely orchestration: loading storage into state on boot,
 * wiring up the top-level DOM event listeners, and the density toggle.
 */

const state = window.GOGPlusTagsState;
const { $ } = window.GOGPlusTagsConstants;
const { renderSaleHeatmap, renderStats, renderYearReview } = window.GOGPlusTagsStats;
const { renderTagList } = window.GOGPlusTagsManagement;
const { renderGames } = window.GOGPlusTagsGamesList;
const { exportPack, importPackFromFile, exportCsv } = window.GOGPlusTagsExportImport;

async function init() {
  const data = await window.GOGPlusStorage.get({
    tags: {},
    notes: {},
    priceHistory: {},
    purchaseLog: {},
    tagColors: {},
    tagOrder: [],
    gameStatus: {},
    tagDashboardDensity: "comfortable",
    uiLanguage: "en",
  });
  window.GOGPlusI18n?.apply(data.uiLanguage || "en");
  state.allTags = data.tags || {};
  state.allNotes = data.notes || {};
  state.allHistory = data.priceHistory || {};
  state.allPurchases = data.purchaseLog || {};
  state.tagColors = data.tagColors || {};
  state.tagOrder = Array.isArray(data.tagOrder) ? data.tagOrder : [];
  state.allStatus = data.gameStatus || {};
  state.density = data.tagDashboardDensity === "compact" ? "compact" : "comfortable";
  applyDensityClass();
  await renderStats();
  renderYearReview();
  renderSaleHeatmap();
  renderTagList();
  renderGames();
  bind();
}

function applyDensityClass() {
  document.body.classList.toggle("density-compact", state.density === "compact");
}

function bind() {
  $("search").addEventListener("input", (e) => {
    state.searchTerm = e.target.value.trim().toLowerCase();
    renderGames();
  });
  $("exportCsv").addEventListener("click", exportCsv);
  $("densityToggle").addEventListener("click", async () => {
    state.density = state.density === "compact" ? "comfortable" : "compact";
    applyDensityClass();
    await window.GOGPlusStorage.set({ tagDashboardDensity: state.density });
  });
  $("sortBy").addEventListener("change", (e) => {
    state.sortBy = e.target.value;
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

// Test-only surface — see tests/tags-internals.test.js. Individual functions
// now live in tags/features/*.js (see the split above); this re-assembles
// the same external shape that test file already depends on, so it needed
// no changes for the split.
if (typeof window !== "undefined") {
  window.GOGPlusTagsInternals = {
    parseSearchQuery: window.GOGPlusTagsGamesList.parseSearchQuery,
    slugToTitle: window.GOGPlusTagsGamesList.slugToTitle,
    safeHexColor: window.GOGPlusTagsManagement.safeHexColor,
    renderMarkdown: window.GOGPlusTagsGamesList.renderMarkdown,
  };
}

document.addEventListener("DOMContentLoaded", init);
