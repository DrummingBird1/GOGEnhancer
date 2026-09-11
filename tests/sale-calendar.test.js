import { describe, it, expect } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/dom-safety.js");
await import("../extension/lib/currency-format.js");
await import("../extension/lib/game-status.js");
await import("../extension/tags/state.js");
await import("../extension/tags/features/tag-management.js");
await import("../extension/tags/features/games-list.js");
await import("../extension/tags/features/stats.js");
await import("../extension/tags/features/export-import.js");
await import("../extension/tags/tags.js");

const { nextSaleWindow, renderSaleHeatmap } = window.GOGPlusTagsStats;
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
