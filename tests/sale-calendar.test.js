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

const { nextSaleWindow, renderSaleHeatmap, renderGenreDistribution } = window.GOGPlusTagsStats;
const state = window.GOGPlusTagsState;

describe("nextSaleWindow", () => {
  it("picks the soonest upcoming window from the fixed calendar when there's no observed month", () => {
    const now = new Date(2026, 0, 1); // Jan 1 — New Year Sale (Jan 2) is 1 day away
    const next = nextSaleWindow(null, now);
    expect(next.name).toBe("New Year Sale");
    expect(next.daysAway).toBe(1);
  });

  it("rolls a past-this-year window over to next year rather than returning a negative daysAway", () => {
    const now = new Date(2026, 11, 25); // Dec 25 — Winter Sale (Dec 20) already passed this year
    const next = nextSaleWindow(null, now);
    expect(next.daysAway).toBeGreaterThanOrEqual(0);
    expect(next.date.getTime()).toBeGreaterThanOrEqual(now.getTime());
  });

  it("prefers a window matching the observed peak month when one exists", () => {
    const now = new Date(2026, 0, 1);
    const next = nextSaleWindow(6, now); // June -> Summer Sale
    expect(next.name).toBe("Summer Sale");
    expect(next.month).toBe(6);
  });

  it("falls back to the full calendar when no known window matches the observed month", () => {
    const now = new Date(2026, 0, 1);
    const next = nextSaleWindow(2, now); // February has no dedicated window in the calendar
    expect(next).toBeTruthy();
  });
});

describe("renderSaleHeatmap", () => {
  it("shows a seasonal-calendar note (not a blank panel) when there's no tracked history yet", () => {
    state.allHistory = {};
    document.body.innerHTML = `<div id="saleHeatmap"></div>`;
    renderSaleHeatmap();
    const panel = document.getElementById("saleHeatmap");
    expect(panel.innerHTML).not.toBe("");
    expect(panel.textContent).toContain("Not enough tracked history");
  });

  it("includes a 'next likely window' prediction once there's observed drop data", () => {
    state.allHistory = {
      hades: [
        { d: "2025-06-01", p: 30, c: "USD" },
        { d: "2025-06-15", p: 20, c: "USD" },
      ],
    };
    document.body.innerHTML = `<div id="saleHeatmap"></div>`;
    renderSaleHeatmap();
    const panel = document.getElementById("saleHeatmap");
    expect(panel.textContent).toContain("Next likely window");
  });
});

describe("renderGenreDistribution", () => {
  function resetState() {
    state.allTags = {};
    state.allHistory = {};
    state.allStatus = {};
    state.allGenres = {};
  }

  beforeEach(() => {
    resetState();
    document.body.innerHTML = `<div id="genreDistribution"></div>`;
  });

  it("renders nothing when no known game resolves to a genre", () => {
    state.allTags = { some_totally_unrecognized_game: ["favorite"] };
    renderGenreDistribution();
    expect(document.getElementById("genreDistribution").innerHTML).toBe("");
  });

  it("counts genres across tagged, tracked, and status-marked games, deduped by slug", () => {
    state.allTags = { hades: ["favorite"] }; // indie
    state.allHistory = { celeste: [{ d: "d1", p: 10, c: "USD" }] }; // indie
    state.allStatus = { civilization: "backlog" }; // strategy
    renderGenreDistribution();
    const panel = document.getElementById("genreDistribution");
    expect(panel.textContent).toContain("indie");
    expect(panel.textContent).toContain("strategy");
    expect(panel.textContent).toContain("3"); // total across both buckets
  });

  it("prefers the confirmed genre cache over the slug heuristic", () => {
    state.allTags = { hades: ["favorite"] }; // slug heuristic says indie
    state.allGenres = { hades: "horror" }; // confirmed cache overrides it
    renderGenreDistribution();
    const panel = document.getElementById("genreDistribution");
    expect(panel.textContent).toContain("horror");
    expect(panel.textContent).not.toContain("indie");
  });

  it("sorts bars by count, descending, and sizes the fill relative to the top bar", () => {
    state.allTags = {
      hades: ["a"], // indie
      celeste: ["a"], // indie
      civilization: ["a"], // strategy
    };
    renderGenreDistribution();
    const rows = [...document.querySelectorAll(".genre-bar-row")];
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector(".genre-bar-label").textContent).toBe("indie");
    expect(rows[0].querySelector(".genre-bar-count").textContent).toBe("2");
    expect(rows[0].querySelector(".genre-bar-fill").getAttribute("style")).toContain("100.0%");
    expect(rows[1].querySelector(".genre-bar-label").textContent).toBe("strategy");
    expect(rows[1].querySelector(".genre-bar-fill").getAttribute("style")).toContain("50.0%");
  });
});
