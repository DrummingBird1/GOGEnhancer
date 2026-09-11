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

const state = window.GOGPlusTagsState;
const { renderGames, buildDashboardChart, genreSuggestionFor } = window.GOGPlusTagsGamesList;

function resetState() {
  state.allTags = {};
  state.allNotes = {};
  state.allHistory = {};
  state.allWishlistSlugs = [];
  state.allPurchases = {};
  state.allStatus = {};
  state.allGenres = {};
  state.tagColors = {};
  state.tagOrder = [];
}

beforeEach(() => {
  resetState();
  document.body.innerHTML = `<span id="counts"></span><div id="gameList"></div><div id="tagList"></div>`;
});

describe("buildDashboardChart", () => {
  it("renders an SVG with a legend showing low/avg/latest", () => {
    const html = buildDashboardChart([
      { d: "2026-01-01", p: 30, c: "USD" },
      { d: "2026-01-10", p: 20, c: "USD" },
      { d: "2026-01-20", p: 25, c: "USD" },
    ]);
    expect(html).toContain("<svg");
    expect(html).toContain("Low: $20.00");
    expect(html).toContain("Latest: $25.00");
    expect(html).toContain("Avg: $25.00"); // (30+20+25)/3 = 25
  });

  it("uses the latest entry's currency symbol", () => {
    const html = buildDashboardChart([
      { d: "2026-01-01", p: 100, c: "ILS" },
      { d: "2026-01-10", p: 90, c: "ILS" },
    ]);
    expect(html).toContain("₪90.00");
  });
});

describe("renderGames — chart toggle", () => {
  it("shows a chart toggle button only for games with 2+ snapshots", () => {
    state.allHistory = {
      hades: [{ d: "d1", p: 30, c: "USD" }, { d: "d2", p: 20, c: "USD" }],
      one_snapshot: [{ d: "d1", p: 10, c: "USD" }],
    };
    state.allStatus = { hades: "playing", one_snapshot: "playing" };
    renderGames();
    const cards = [...document.querySelectorAll(".game-card")];
    const hadesCard = cards.find((c) => c.querySelector(".game-card-slug").textContent === "hades");
    const oneSnapCard = cards.find((c) => c.querySelector(".game-card-slug").textContent === "one_snapshot");
    expect(hadesCard.querySelector(".game-card-chart-toggle")).toBeTruthy();
    expect(oneSnapCard.querySelector(".game-card-chart-toggle")).toBeNull();
  });

  it("builds and reveals the chart lazily on first click, then just toggles visibility", () => {
    state.allHistory = { hades: [{ d: "d1", p: 30, c: "USD" }, { d: "d2", p: 20, c: "USD" }] };
    state.allStatus = { hades: "playing" };
    renderGames();
    const card = document.querySelector(".game-card");
    const toggle = card.querySelector(".game-card-chart-toggle");
    const panel = card.querySelector(".game-card-chart");

    expect(panel.hidden).toBe(true);
    expect(panel.innerHTML).toBe("");

    toggle.click();
    expect(panel.hidden).toBe(false);
    expect(panel.querySelector("svg")).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    toggle.click();
    expect(panel.hidden).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("clicking the chart toggle doesn't trigger card-level handlers (stopPropagation)", () => {
    state.allHistory = { hades: [{ d: "d1", p: 30, c: "USD" }, { d: "d2", p: 20, c: "USD" }] };
    state.allStatus = { hades: "playing" };
    let cardClicked = false;
    renderGames();
    const card = document.querySelector(".game-card");
    card.addEventListener("click", () => {
      cardClicked = true;
    });
    card.querySelector(".game-card-chart-toggle").click();
    expect(cardClicked).toBe(false);
  });
});

describe("genreSuggestionFor", () => {
  it("returns null when the game already has a tag", () => {
    state.allTags = { hades: ["favorite"] };
    expect(genreSuggestionFor("hades")).toBeNull();
  });

  it("returns null when no genre can be resolved", () => {
    expect(genreSuggestionFor("some_totally_unrecognized_game")).toBeNull();
  });

  it("suggests a display-friendly name from the slug-pattern heuristic when untagged", () => {
    expect(genreSuggestionFor("hades")).toBe("Indie"); // GENRE_PATTERNS' indie bucket
    expect(genreSuggestionFor("civilization")).toBe("Strategy");
  });

  it("prefers the confirmed per-visit genre cache over the slug heuristic", () => {
    state.allGenres = { hades: "horror" }; // overrides the indie heuristic
    expect(genreSuggestionFor("hades")).toBe("Horror");
  });
});

describe("renderGames — auto-tag suggestion", () => {
  it("shows a suggestion chip on an untagged card with a resolvable genre", () => {
    state.allStatus = { hades: "backlog" }; // needs SOME data to appear in matchingSlugs()
    renderGames();
    const card = document.querySelector(".game-card");
    const chip = card.querySelector(".game-card-tag-suggestion");
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain("Indie");
  });

  it("shows no suggestion chip once the game already has a tag", () => {
    state.allTags = { hades: ["favorite"] };
    renderGames();
    const card = document.querySelector(".game-card");
    expect(card.querySelector(".game-card-tag-suggestion")).toBeNull();
  });

  it("clicking the suggestion applies it as a real tag and hides the chip on re-render", async () => {
    state.allStatus = { hades: "backlog" };
    renderGames();
    const card = document.querySelector(".game-card");
    const chip = card.querySelector(".game-card-tag-suggestion");
    chip.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(state.allTags.hades).toEqual(["Indie"]);
    const s = await new Promise((r) => chrome.storage.local.get(["tags"], r));
    expect(s.tags.hades).toEqual(["Indie"]);

    // renderGames() ran again as part of applying the suggestion — the
    // now-tagged card should show a real chip, not the suggestion button.
    const refreshedCard = document.querySelector(".game-card");
    expect(refreshedCard.querySelector(".game-card-tag-suggestion")).toBeNull();
    expect(refreshedCard.querySelector(".game-card-chip").textContent).toBe("Indie");
  });

  it("clicking the suggestion doesn't bubble up to card-level click handlers", async () => {
    state.allStatus = { hades: "backlog" };
    let cardClicked = false;
    renderGames();
    const card = document.querySelector(".game-card");
    card.addEventListener("click", () => {
      cardClicked = true;
    });
    card.querySelector(".game-card-tag-suggestion").click();
    await new Promise((r) => setTimeout(r, 0));
    expect(cardClicked).toBe(false);
  });
});
