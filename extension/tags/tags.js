/**
 * GOG+ tag dashboard orchestrator (v2.8.0+, post module-split).
 *
 * Was a single ~1028-line top-level script through v2.7.0; the individual
 * features are now tags/state.js and tags/features/*.js — see CLAUDE.md's
 * content-script/tag-dashboard load-order notes. This file is left with
 * only what's genuinely orchestration: loading storage into state on boot,
 * wiring up the top-level DOM event listeners, and the density toggle.
 */
// @ts-check

const state = window.GOGPlusTagsState;
const { $ } = window.GOGPlusTagsConstants;
const { renderSaleHeatmap, renderStats, renderYearReview, renderGenreDistribution } = window.GOGPlusTagsStats;
const { renderTagList } = window.GOGPlusTagsManagement;
const { renderGames } = window.GOGPlusTagsGamesList;
const { exportPack, importPackFromFile, exportCsv, exportStaticHtml } = window.GOGPlusTagsExportImport;
const { renderTonightPicker } = window.GOGPlusTagsRecommendations;
const { toggleFilterBuilder, closeFilterBuilder } = window.GOGPlusTagsFilterBuilder;
const { evaluateAndPersist, renderAchievements } = window.GOGPlusTagsAchievements;

async function init() {
  const data = await window.GOGPlusStorage.get({
    tags: {},
    notes: {},
    priceHistory: {},
    purchaseLog: {},
    tagColors: {},
    tagOrder: [],
    gameStatus: {},
    gameGenres: {},
    tagDashboardDensity: "comfortable",
    uiLanguage: "en",
    wishlistSlugs: [],
    monthlyBudget: null,
    theme: "neon",
    customThemeColors: null,
    dyslexiaFont: false,
    achievements: {},
  });
  window.GOGPlusI18n?.apply(data.uiLanguage || "en");
  state.allTags = data.tags || {};
  state.allNotes = data.notes || {};
  state.allHistory = data.priceHistory || {};
  state.allWishlistSlugs = Array.isArray(data.wishlistSlugs) ? data.wishlistSlugs : [];
  state.allPurchases = data.purchaseLog || {};
  state.tagColors = data.tagColors || {};
  state.tagOrder = Array.isArray(data.tagOrder) ? data.tagOrder : [];
  state.allStatus = data.gameStatus || {};
  state.allGenres = data.gameGenres || {};
  state.monthlyBudget = data.monthlyBudget || null;
  state.achievements = data.achievements || {};
  state.density = data.tagDashboardDensity === "compact" ? "compact" : "comfortable";
  applyDensityClass();
  applyThemeClassToHtml(data.theme, data.customThemeColors);
  document.documentElement.classList.toggle("gog-plus-dyslexia-font", !!data.dyslexiaFont);
  await renderStats();
  renderYearReview();
  renderSaleHeatmap();
  renderGenreDistribution();
  renderTagList();
  renderGames();
  renderTonightPicker();
  await evaluateAndPersist();
  renderAchievements();
  bind();
}

function applyDensityClass() {
  document.body.classList.toggle("density-compact", state.density === "compact");
}

// Bridges the dashboard into the same gog-plus-theme--* system content.js
// and options.js use — see tags.css's own "Themes" section comment for why
// this page needed it added rather than inheriting it. Small local copy
// rather than a shared helper: same call, different CSS var namespace than
// content.js's version (bare --accent-*/--bg-base here vs. --gp-* there).
function applyThemeClassToHtml(theme, customColors) {
  const html = document.documentElement;
  [...html.classList]
    .filter((c) => c.startsWith("gog-plus-theme--"))
    .forEach((c) => html.classList.remove(c));
  let resolved = theme || "neon";
  if (resolved === "auto") {
    resolved = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "neon";
  }
  html.classList.add(`gog-plus-theme--${resolved}`);
  if (resolved === "custom" && customColors) {
    html.style.setProperty("--accent-magenta", customColors.magenta);
    html.style.setProperty("--accent-cyan", customColors.cyan);
    html.style.setProperty("--bg-base", customColors.bg);
  } else {
    html.style.removeProperty("--accent-magenta");
    html.style.removeProperty("--accent-cyan");
    html.style.removeProperty("--bg-base");
  }
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
  $("exportStaticHtml").addEventListener("click", exportStaticHtml);
  $("exportPack").addEventListener("click", exportPack);
  $("importPack").addEventListener("click", () => $("importPackFile").click());
  $("importPackFile").addEventListener("change", importPackFromFile);
  $("filterBuilderBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFilterBuilder();
  });
  document.addEventListener("click", (e) => {
    const target = /** @type {Element} */ (e.target);
    const picker = document.getElementById("tagColorPicker");
    if (picker && !picker.contains(target) && !target.closest(".tag-pill-swatch")) {
      picker.remove();
    }
    const menu = document.getElementById("tagActionMenu");
    if (menu && !menu.contains(target) && !target.closest(".tag-pill-menu")) {
      menu.remove();
    }
    const filterPop = $("filterBuilderPopover");
    if (filterPop && !filterPop.hidden && !filterPop.contains(target) && target !== $("filterBuilderBtn")) {
      closeFilterBuilder();
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

// { once: true } — see the identical comment in options.js — stops a test
// harness that re-imports this module against one shared `document` from
// accumulating a duplicate init()/bind() per import.
document.addEventListener("DOMContentLoaded", init, { once: true });
