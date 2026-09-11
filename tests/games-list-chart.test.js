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
const { renderGames, buildDashboardChart } = window.GOGPlusTagsGamesList;

function resetState() {
  state.allTags = {};
  state.allNotes = {};
  state.allHistory = {};
  state.allWishlistSlugs = [];
  state.allPurchases = {};
  state.allStatus = {};
}

beforeEach(() => {
  resetState();
  document.body.innerHTML = `<span id="counts"></span><div id="gameList"></div>`;
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
