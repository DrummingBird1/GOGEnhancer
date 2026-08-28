import { describe, it, expect, beforeEach } from "vitest";

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

const state = window.GOGPlusTagsState;
const { renderStats } = window.GOGPlusTagsStats;

function resetState() {
  state.allTags = {};
  state.allNotes = {};
  state.allHistory = {};
  state.allWishlistSlugs = [];
  state.allPurchases = {};
  state.allStatus = {};
}

function findCard(panel, label) {
  return [...panel.querySelectorAll(".stat-card")].find(
    (c) => c.querySelector(".stat-label")?.textContent === label
  );
}

beforeEach(() => {
  globalThis.__resetChromeStores();
  resetState();
  document.body.innerHTML = `<div id="statsPanel"></div>`;
});

describe("wishlist value stat card", () => {
  it("sums current prices across wishlisted games with history", async () => {
    state.allWishlistSlugs = ["hades", "disco_elysium"];
    state.allHistory = {
      hades: [{ d: "d1", p: 30, c: "USD" }, { d: "d2", p: 20, c: "USD" }],
      disco_elysium: [{ d: "d1", p: 40, c: "USD" }, { d: "d2", p: 25, c: "USD" }],
      not_wishlisted: [{ d: "d1", p: 999, c: "USD" }], // not on the wishlist — excluded
    };
    await renderStats();
    const card = findCard(document.getElementById("statsPanel"), "Wishlist value");
    expect(card).toBeTruthy();
    expect(card.querySelector(".stat-value").textContent).toContain("45.00"); // 20 + 25
    expect(card.querySelector(".stat-sub").textContent).toContain("2 priced");
  });

  it("reports the gap to each game's tracked all-time low", async () => {
    state.allWishlistSlugs = ["hades"];
    state.allHistory = {
      hades: [{ d: "d1", p: 30, c: "USD" }, { d: "d2", p: 20, c: "USD" }, { d: "d3", p: 25, c: "USD" }],
    };
    // latest = 25, low = 20 -> 5.00 away from its low
    await renderStats();
    const card = findCard(document.getElementById("statsPanel"), "Wishlist value");
    expect(card.querySelector(".stat-sub").textContent).toContain("5.00");
    expect(card.querySelector(".stat-sub").textContent).toContain("away from all-time lows");
  });

  it("says 'already at tracked lows' when every wishlisted game is at its low", async () => {
    state.allWishlistSlugs = ["hades"];
    state.allHistory = { hades: [{ d: "d1", p: 30, c: "USD" }, { d: "d2", p: 20, c: "USD" }] };
    await renderStats();
    const card = findCard(document.getElementById("statsPanel"), "Wishlist value");
    expect(card.querySelector(".stat-value").textContent).toContain("20.00");
    expect(card.querySelector(".stat-sub").textContent).toContain("already at tracked lows");
  });

  it("prompts to visit games when no wishlisted game has price history yet", async () => {
    state.allWishlistSlugs = ["hades", "disco_elysium"];
    state.allHistory = {};
    await renderStats();
    const card = findCard(document.getElementById("statsPanel"), "Wishlist value");
    expect(card.querySelector(".stat-value").textContent.trim()).toBe("—");
    expect(card.querySelector(".stat-sub").textContent).toContain("visit wishlisted games");
  });

  it("groups totals by currency rather than mixing them", async () => {
    state.allWishlistSlugs = ["hades", "disco_elysium"];
    state.allHistory = {
      hades: [{ d: "d1", p: 100, c: "ILS" }],
      disco_elysium: [{ d: "d1", p: 20, c: "USD" }],
    };
    await renderStats();
    const card = findCard(document.getElementById("statsPanel"), "Wishlist value");
    const text = card.querySelector(".stat-value").textContent;
    expect(text).toContain("100");
    expect(text).toContain("20.00");
  });
});
