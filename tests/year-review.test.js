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

const state = window.GOGPlusTagsState;
const { renderYearReview } = window.GOGPlusTagsStats;

const THIS_YEAR = String(new Date().getFullYear());

function resetState() {
  state.allHistory = {};
  state.allPurchases = {};
  state.yearReviewYear = null;
}

beforeEach(() => {
  resetState();
  document.body.innerHTML = `<div id="yearReview"></div>`;
});

describe("renderYearReview — most patient purchase", () => {
  it("shows the game with the longest gap between first snapshot and purchase date", () => {
    state.allHistory = {
      hades: [{ d: `${THIS_YEAR}-01-01`, p: 30, c: "USD" }],
      celeste: [{ d: `${THIS_YEAR}-01-20`, p: 20, c: "USD" }],
    };
    state.allPurchases = {
      hades: { date: `${THIS_YEAR}-01-15`, price: 20, currency: "USD" }, // 14 days
      celeste: { date: `${THIS_YEAR}-01-22`, price: 15, currency: "USD" }, // 2 days
    };
    renderYearReview();
    const panel = document.getElementById("yearReview");
    expect(panel.textContent).toContain("Most patient purchase");
    expect(panel.textContent).toContain("Hades");
    expect(panel.textContent).toContain("14 days of watching first");
  });

  it("shows an empty message when no purchase has tracked history to compare against", () => {
    state.allPurchases = { hades: { date: `${THIS_YEAR}-01-15` } };
    state.allHistory = {}; // no tracked history at all
    renderYearReview();
    const panel = document.getElementById("yearReview");
    expect(panel.textContent).toContain("No priced purchase with tracked history");
  });

  it("ignores a purchase on (or before) the first tracked snapshot — zero patience isn't a highlight", () => {
    state.allHistory = { hades: [{ d: `${THIS_YEAR}-01-15`, p: 30, c: "USD" }] };
    state.allPurchases = { hades: { date: `${THIS_YEAR}-01-15` } }; // bought same day as first snapshot
    renderYearReview();
    const panel = document.getElementById("yearReview");
    expect(panel.textContent).toContain("No priced purchase with tracked history");
  });

  it("only considers purchases dated within the selected year", () => {
    state.allHistory = {
      hades: [{ d: "2020-01-01", p: 30, c: "USD" }],
      celeste: [{ d: `${THIS_YEAR}-01-01`, p: 10, c: "USD" }], // keeps the panel non-empty
    };
    state.allPurchases = { hades: { date: "2020-06-01" } }; // not this year — excluded
    renderYearReview();
    const panel = document.getElementById("yearReview");
    expect(panel.textContent).toContain("No priced purchase with tracked history");
  });
});

describe("renderYearReview — multi-year trend", () => {
  it("omits the trend strip entirely when there's only one year of data", () => {
    state.allHistory = { hades: [{ d: `${THIS_YEAR}-01-01`, p: 30, c: "USD" }] };
    renderYearReview();
    expect(document.querySelector(".yr-trend")).toBeNull();
  });

  it("shows one bar per year, in chronological order, when multiple years exist", () => {
    state.allHistory = {
      hades: [
        { d: "2024-01-01", p: 30, c: "USD" },
        { d: "2025-01-01", p: 25, c: "USD" },
        { d: "2025-06-01", p: 20, c: "USD" },
        { d: `${THIS_YEAR}-01-01`, p: 15, c: "USD" }, // keeps the panel non-empty for the current year
      ],
    };
    renderYearReview();
    const years = [...document.querySelectorAll(".yr-trend-year")].map((el) => el.textContent);
    expect(years[0]).toBe("2024"); // chronological, not the year-picker's newest-first order
    expect(years.at(-1)).toBe(THIS_YEAR);
  });
});
