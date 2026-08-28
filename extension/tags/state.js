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
    allPurchases: {}, // { slug: "YYYY-MM-DD" }
    allStatus: {}, // { slug: "playing" | "backlog" | "finished" }
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
