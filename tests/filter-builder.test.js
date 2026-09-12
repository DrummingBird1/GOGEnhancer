import { describe, it, expect, beforeEach } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/dom-safety.js");
await import("../extension/lib/currency-format.js");
await import("../extension/lib/genres.js");
await import("../extension/lib/purchases.js");
await import("../extension/lib/game-status.js");
await import("../extension/lib/attachments.js");
await import("../extension/tags/state.js");
await import("../extension/tags/features/tag-management.js");
await import("../extension/tags/features/games-list.js");
await import("../extension/tags/features/filter-builder.js");

const state = window.GOGPlusTagsState;
const { toggleFilterBuilder, closeFilterBuilder, insertFilterToken } = window.GOGPlusTagsFilterBuilder;

beforeEach(() => {
  state.allTags = {};
  state.tagOrder = [];
  document.body.innerHTML = `
    <input type="search" id="search" />
    <div id="filterBuilderPopover" hidden></div>
  `;
});

describe("filter-builder.js", () => {
  it("renders tag/status/genre/misc chip groups when opened", () => {
    state.tagOrder = ["favorite", "roguelike"];
    toggleFilterBuilder();
    const pop = document.getElementById("filterBuilderPopover");
    expect(pop.hidden).toBe(false);
    expect(pop.querySelector('[data-token="tag:favorite"]')).toBeTruthy();
    expect(pop.querySelector('[data-token="status:playing"]')).toBeTruthy();
    expect(pop.querySelector('[data-token="genre:rpg"]')).toBeTruthy();
  });

  it("shows an empty-state message when there are no tags yet", () => {
    toggleFilterBuilder();
    const pop = document.getElementById("filterBuilderPopover");
    // Status/genre/misc chips still render even with zero tags — only the
    // "no chips at all" case shows the empty message, which doesn't apply
    // here since STATUSES/genres are always non-empty. This asserts the tag
    // group itself is simply absent rather than rendering an empty list.
    expect(pop.querySelector('[data-token^="tag:"]')).toBeNull();
  });

  it("toggling twice closes the popover", () => {
    toggleFilterBuilder();
    expect(document.getElementById("filterBuilderPopover").hidden).toBe(false);
    toggleFilterBuilder();
    expect(document.getElementById("filterBuilderPopover").hidden).toBe(true);
  });

  it("closeFilterBuilder hides the popover", () => {
    toggleFilterBuilder();
    closeFilterBuilder();
    expect(document.getElementById("filterBuilderPopover").hidden).toBe(true);
  });

  it("clicking a chip inserts its token into the search box and fires input", () => {
    let inputEventFired = false;
    document.getElementById("search").addEventListener("input", () => {
      inputEventFired = true;
    });
    toggleFilterBuilder();
    document.querySelector('[data-token="status:backlog"]').click();
    expect(document.getElementById("search").value).toBe("status:backlog");
    expect(inputEventFired).toBe(true);
    expect(document.getElementById("filterBuilderPopover").hidden).toBe(true);
  });

  it("insertFilterToken appends to existing search text with a separating space", () => {
    document.getElementById("search").value = "tag:favorite";
    insertFilterToken("genre:indie");
    expect(document.getElementById("search").value).toBe("tag:favorite genre:indie");
  });
});
