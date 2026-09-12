/**
 * GOG+ discoverable filter-chip builder.
 *
 * games-list.js's parseSearchQuery already understands tag:/status:/genre:/
 * lowest:/snapshots:/since: query syntax, but nothing in the UI told anyone
 * it existed beyond the search box's placeholder text. This adds a small
 * popover, opened from a toolbar button, listing clickable chips for each
 * operator — clicking one inserts the matching `key:value` snippet into the
 * search box and re-triggers the existing input listener in tags.js, so
 * this module never needs to call renderGames() itself.
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusTagsState;
  const { $ } = window.GOGPlusTagsConstants;
  const { escapeHtml } = window.GOGPlusDomSafety;
  const { STATUSES } = window.GOGPlusGameStatus;
  const { GENRE_DISPLAY_NAMES } = window.GOGPlusTagsGamesList;

  /**
   * @param {string} token
   */
  function insertFilterToken(token) {
    const input = /** @type {HTMLInputElement} */ ($("search"));
    if (!input) return;
    const cur = input.value.trim();
    // Skip re-adding a token that's already present verbatim — clicking the
    // same chip twice shouldn't pile up duplicate "genre:rpg genre:rpg".
    if (cur && cur.split(/\s+/).includes(token)) {
      closeFilterBuilder();
      return;
    }
    input.value = cur ? `${cur} ${token}` : token;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    closeFilterBuilder();
  }

  function buildGroup(label, chips) {
    if (!chips.length) return "";
    return `
      <div class="filter-builder-group">
        <span class="filter-builder-group-label">${label}</span>
        <div class="filter-builder-chips">${chips.join("")}</div>
      </div>
    `;
  }

  function renderFilterBuilderContent() {
    const pop = $("filterBuilderPopover");
    if (!pop) return;

    const tagChips = (state.tagOrder.length
      ? state.tagOrder
      : Object.keys(
          Object.values(state.allTags).reduce((acc, arr) => {
            (arr || []).forEach((t) => (acc[t] = true));
            return acc;
          }, {})
        )
    )
      .slice(0, 20)
      .map(
        (t) =>
          // HTML-escaped, not URI-encoded — a tag containing a space or
          // punctuation must survive round-tripping through the search box
          // as plain text (parseSearchQuery never URI-decodes), and tag
          // names are user-entered text that lands straight in innerHTML.
          `<button type="button" class="filter-builder-chip" data-token="tag:${escapeHtml(t)}">tag:${escapeHtml(t)}</button>`
      );

    const statusChips = STATUSES.map(
      (s) => `<button type="button" class="filter-builder-chip" data-token="status:${s.id}">status:${s.id}</button>`
    );

    const genreChips = Object.keys(GENRE_DISPLAY_NAMES).map(
      (g) => `<button type="button" class="filter-builder-chip" data-token="genre:${g}">genre:${g}</button>`
    );

    const miscChips = [
      `<button type="button" class="filter-builder-chip" data-token="lowest:&lt;10">lowest:&lt;10</button>`,
      `<button type="button" class="filter-builder-chip" data-token="snapshots:&gt;5">snapshots:&gt;5</button>`,
      `<button type="button" class="filter-builder-chip" data-token="since:${new Date().getFullYear()}">since:${new Date().getFullYear()}</button>`,
    ];

    pop.innerHTML =
      buildGroup("Tags", tagChips) +
      buildGroup("Play status", statusChips) +
      buildGroup("Genre", genreChips) +
      buildGroup("Other", miscChips) ||
      `<p class="filter-builder-empty">No tags yet — tag a game to see tag filters here.</p>`;

    pop.querySelectorAll(".filter-builder-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const token = /** @type {HTMLElement} */ (btn).dataset.token;
        if (token) insertFilterToken(token);
      });
    });
  }

  function closeFilterBuilder() {
    const pop = $("filterBuilderPopover");
    if (pop) pop.hidden = true;
  }

  function toggleFilterBuilder() {
    const pop = $("filterBuilderPopover");
    if (!pop) return;
    if (!pop.hidden) {
      closeFilterBuilder();
      return;
    }
    renderFilterBuilderContent();
    pop.hidden = false;
  }

  window.GOGPlusTagsFilterBuilder = { toggleFilterBuilder, closeFilterBuilder, insertFilterToken };
})();
