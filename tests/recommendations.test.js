import { describe, it, expect, beforeEach } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/dom-safety.js");
await import("../extension/lib/currency-format.js");
await import("../extension/lib/genres.js");
await import("../extension/lib/purchases.js");
await import("../extension/lib/game-status.js");
await import("../extension/tags/state.js");
await import("../extension/tags/features/tag-management.js");
await import("../extension/tags/features/games-list.js");
await import("../extension/tags/features/stats.js");
await import("../extension/tags/features/export-import.js");
await import("../extension/tags/features/recommendations.js");
await import("../extension/tags/tags.js");

const state = window.GOGPlusTagsState;
const {
  genreFor,
  backlogSlugs,
  pickTonight,
  ownedGenreCounts,
  recommendFromBacklog,
  renderTonightPicker,
} = window.GOGPlusTagsRecommendations;

function resetState() {
  state.allTags = {};
  state.allNotes = {};
  state.allHistory = {};
  state.allWishlistSlugs = [];
  state.allPurchases = {};
  state.allStatus = {};
  state.allGenres = {};
}

beforeEach(() => {
  resetState();
  document.body.innerHTML = `<section id="tonightPicker" hidden></section>`;
});

describe("genreFor", () => {
  it("prefers the confirmed genre cached from a real visit over the slug heuristic", () => {
    state.allGenres = { hades: "horror" }; // deliberately wrong, to prove precedence
    expect(genreFor("hades")).toBe("horror");
  });

  it("falls back to the slug-pattern heuristic when nothing is cached", () => {
    expect(genreFor("hades")).toBe("indie"); // matches GENRE_PATTERNS' indie bucket
  });

  it("returns null for an unrecognized slug", () => {
    expect(genreFor("some_totally_unknown_game")).toBeNull();
  });
});

describe("backlogSlugs / pickTonight", () => {
  it("only returns games explicitly marked backlog", () => {
    state.allStatus = { hades: "backlog", stardew_valley: "playing", celeste: "backlog" };
    expect(backlogSlugs().sort()).toEqual(["celeste", "hades"]);
  });

  it("returns null when the backlog is empty", () => {
    state.allStatus = {};
    expect(pickTonight()).toBeNull();
  });

  it("only picks from the backlog", () => {
    state.allStatus = { hades: "backlog", stardew_valley: "playing" };
    const pick = pickTonight();
    expect(pick).toBe("hades");
  });

  it("narrows to the requested genre when given one", () => {
    state.allStatus = { hades: "backlog", stardew_valley: "backlog" };
    // hades -> indie, stardew_valley -> indie too (both in GENRE_PATTERNS' indie bucket)
    expect(pickTonight("indie")).toMatch(/hades|stardew_valley/);
    expect(pickTonight("horror")).toBeNull();
  });
});

describe("ownedGenreCounts / recommendFromBacklog", () => {
  it("counts genres only across tagged or finished/playing games", () => {
    state.allTags = { hades: ["favorite"] }; // indie
    state.allStatus = { stardew_valley: "finished", celeste: "backlog" }; // indie, indie (celeste excluded — backlog, not engaged)
    const counts = ownedGenreCounts();
    expect(counts.indie).toBe(2); // hades + stardew_valley, not celeste
  });

  it("recommends backlog games matching the user's most common owned genre", () => {
    state.allTags = { hades: ["favorite"] }; // indie, engaged
    state.allStatus = { celeste: "backlog", civilization: "backlog" }; // indie, strategy
    const recs = recommendFromBacklog();
    expect(recs).toHaveLength(1);
    expect(recs[0]).toEqual({ slug: "celeste", genre: "indie" });
  });

  it("returns [] when the user has no genre signal at all", () => {
    state.allTags = {};
    state.allStatus = { celeste: "backlog" };
    expect(recommendFromBacklog()).toEqual([]);
  });
});

describe("renderTonightPicker", () => {
  it("hides the panel entirely when the backlog is empty", () => {
    state.allStatus = {};
    renderTonightPicker();
    const panel = document.getElementById("tonightPicker");
    expect(panel.hidden).toBe(true);
    expect(panel.innerHTML).toBe("");
  });

  it("shows the panel with a genre dropdown and pick button when the backlog has games", () => {
    state.allStatus = { hades: "backlog" };
    renderTonightPicker();
    const panel = document.getElementById("tonightPicker");
    expect(panel.hidden).toBe(false);
    expect(panel.querySelector("#tonightPick")).toBeTruthy();
    expect(panel.querySelector("#tonightGenre")).toBeTruthy();
  });

  it("clicking pick reveals a game from the backlog", () => {
    state.allStatus = { hades: "backlog" };
    renderTonightPicker();
    document.getElementById("tonightPick").click();
    const result = document.getElementById("tonightResult");
    expect(result.textContent).toContain("Hades");
  });

  it("renders a 'because you like X' recommendation strip when applicable", () => {
    state.allTags = { hades: ["favorite"] };
    state.allStatus = { celeste: "backlog" };
    renderTonightPicker();
    const panel = document.getElementById("tonightPicker");
    expect(panel.textContent).toContain("Because you like indie");
    expect(panel.querySelector(".tonight-rec-chip")).toBeTruthy();
  });
});
