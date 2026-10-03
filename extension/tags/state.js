/**
 * GOG+ tag-dashboard shared state.
 *
 * tags.js used to be one 1028-line top-level script where every function
 * shared the page's single top-level scope. Splitting it into
 * tags/features/*.js means each <script> tag gets its own top-level scope
 * again — the only thing every module shares is `window`.
 *
 * Same discipline as content/state.js: every module holds
 * `const state = window.GOGPlusTagsState;` once at load time and always
 * dereferences fresh through it (`state.allTags`, `state.activeTag`, ...)
 * rather than capturing a property into its own local variable — that's
 * what makes plain property reassignment (`state.allTags = data.tags`,
 * `state.activeTag = null`, etc.) safe and visible everywhere immediately.
 */
// @ts-check

(() => {
  "use strict";

  const state = {
    allTags: {}, // { slug: [tag, ...] }
    allNotes: {}, // { slug: text }
    allHistory: {}, // { slug: [{d, p, c}, ...] }
    allWishlistSlugs: [], // [slug, ...] — from the wishlist-report round-trip, see background.js
    allPurchases: {}, // { slug: "YYYY-MM-DD" }
    allStatus: {}, // { slug: "playing" | "backlog" | "finished" }
    allGenres: {}, // { slug: genre bucket } — confirmed from a real visit, see lib/genres.js
    monthlyBudget: null, // { amount: number, currency: string } | null, set in Advanced Options
    achievements: {}, // { achievementId: unlockedAt ISO date } — see lib/achievements.js
    allFacts: {}, // { slug: GameFacts } — what game pages said (languages, ratings, tags, offer end…), see content/features/knowledge.js
    allOwned: {}, // { slug: date first seen in the library } — learned from the site's own "IN LIBRARY" labels
    statusDates: {}, // { slug: { playing?: date, finished?: date } } — stamped by the service worker
    rates: {}, // units per USD, for converting money figures
    targetCurrency: "ILS",
    monthlyGoal: 0, // games to finish per month; 0 = no goal
    preferredLanguages: [],
    uiLanguage: "en",
    tagColors: {}, // { tagName: "#hex" }
    tagOrder: [], // explicit order of tags after drag-reorder; unordered = end
    density: "comfortable", // "comfortable" | "compact"
    activeTag: null,
    searchTerm: "",
    yearReviewYear: null, // null = current year
    sortBy: "name", // "name" | "lastVisit" | "tagCount" | "snapshots"
  };

  window.GOGPlusTagsState = state;

  window.GOGPlusTagsConstants = {
    $: (id) => document.getElementById(id),
    TAG_COLOR_SWATCHES: [
      "#c64fff", // magenta
      "#00f0ff", // cyan
      "#7fffa6", // green
      "#ff7a00", // orange
      "#ff3d8b", // pink
      "#ffd166", // yellow
      "#8a2be2", // purple
      "#b388ff", // lavender
    ],
  };
})();
