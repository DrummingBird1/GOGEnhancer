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
const { exportPack, importPackFromFile, exportCsv, exportStaticHtml, exportIcs, exportMarkdown } =
  window.GOGPlusTagsExportImport;
const { renderTonightPicker } = window.GOGPlusTagsRecommendations;
const { toggleFilterBuilder, closeFilterBuilder } = window.GOGPlusTagsFilterBuilder;
const { evaluateAndPersist, renderAchievements } = window.GOGPlusTagsAchievements;

/** Reads everything the dashboard shows from storage into the shared state. */
async function loadData() {
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
    gameFacts: {},
    ownedSlugs: {},
    statusDates: {},
    rates: {},
    targetCurrency: "ILS",
    monthlyGoal: 0,
    preferredLanguages: [],
    syncFolderName: "",
    priceAlerts: {},
    streak: { last: "", current: 0, best: 0 },
    challengesDone: {},
    notInterested: {},
    lastAutoBackupAt: 0,
    calmMode: false,
    palette: "default",
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
  state.allFacts = data.gameFacts || {};
  state.allOwned = data.ownedSlugs || {};
  state.statusDates = data.statusDates || {};
  state.rates = data.rates || {};
  state.targetCurrency = data.targetCurrency || "ILS";
  state.monthlyGoal = Number(data.monthlyGoal) || 0;
  state.preferredLanguages = Array.isArray(data.preferredLanguages) ? data.preferredLanguages : [];
  state.uiLanguage = data.uiLanguage || "en";
  state.syncFolderName = data.syncFolderName || "";
  state.alerts = data.priceAlerts || {};
  state.streak = data.streak || { last: "", current: 0, best: 0 };
  state.challengesDone = data.challengesDone || {};
  state.notInterested = data.notInterested || {};
  state.lastAutoBackupAt = Number(data.lastAutoBackupAt) || 0;
  state.density = data.tagDashboardDensity === "compact" ? "compact" : "comfortable";
  applyDensityClass();
  applyThemeClassToHtml(data.theme, data.customThemeColors);
  document.documentElement.classList.toggle("gog-plus-dyslexia-font", !!data.dyslexiaFont);
  document.documentElement.classList.toggle("gog-plus-calm", !!data.calmMode);
  [...document.documentElement.classList]
    .filter((c) => c.startsWith("gog-plus-palette--"))
    .forEach((c) => document.documentElement.classList.remove(c));
  if (data.palette && data.palette !== "default") document.documentElement.classList.add(`gog-plus-palette--${data.palette}`);
}

async function renderAll() {
  await renderStats();
  renderYearReview();
  renderSaleHeatmap();
  renderGenreDistribution();
  renderTagList();
  renderGames();
  renderTonightPicker();
  await evaluateAndPersist();
  renderAchievements();
  window.GOGPlusTagsLibraryHub?.renderHub();
}

async function init() {
  await loadData();
  await renderAll();
  bind();
  // Syncs / backs up by itself when the browser allows it without asking
  // (see lib/folder-sync-core.js); redraws the hub with what happened.
  window.GOGPlusTagsLibraryHub?.runAutoSync().catch((err) => console.warn("[GOG+] auto-sync failed:", err));
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
  // "native" (match gog.com's own look) only exists on gog.com; here it follows the system.
  if (resolved === "auto" || resolved === "native") {
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
  $("exportIcs").addEventListener("click", exportIcs);
  $("exportMarkdown").addEventListener("click", exportMarkdown);
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

// Lets the Library hub reload the dashboard after a sync pulled newer data.
window.GOGPlusTagsBoot = { refresh: async () => { await loadData(); await renderAll(); } };

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
