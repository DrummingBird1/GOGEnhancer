import { describe, it, expect, beforeEach } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/purchases.js");
await import("../extension/lib/achievements.js");
await import("../extension/content/toasts.js");
await import("../extension/tags/state.js");
await import("../extension/tags/features/achievements.js");

const state = window.GOGPlusTagsState;
const { computeStats, evaluateAndPersist, renderAchievements } = window.GOGPlusTagsAchievements;

function resetState() {
  state.allTags = {};
  state.allNotes = {};
  state.allHistory = {};
  state.allWishlistSlugs = [];
  state.allPurchases = {};
  state.achievements = {};
}

beforeEach(() => {
  resetState();
  globalThis.__resetChromeStores();
  document.body.innerHTML = `<div id="achievementsPanel"></div>`;
});

describe("tags/features/achievements.js", () => {
  it("computeStats reads the same numbers stats.js's renderStats computes", () => {
    state.allTags = { hades: ["fav"], stardew_valley: [] };
    state.allNotes = { hades: "great" };
    state.allHistory = { hades: [{ d: "2026-01-01", p: 10, c: "USD" }] };
    const stats = computeStats();
    expect(stats.taggedGames).toBe(1); // stardew_valley has an empty tag array
    expect(stats.notesCount).toBe(1);
    expect(stats.trackedGames).toBe(1);
    expect(stats.snapshots).toBe(1);
  });

  it("evaluateAndPersist unlocks and persists newly-qualifying achievements", async () => {
    state.allTags = { hades: ["fav"] };
    const newly = await evaluateAndPersist();
    expect(newly).toContain("first-tag");
    expect(state.achievements["first-tag"]).toBeTruthy();
    const s = await new Promise((r) => chrome.storage.local.get(["achievements"], r));
    expect(s.achievements["first-tag"]).toBeTruthy();
  });

  it("evaluateAndPersist is a no-op the second time (already unlocked)", async () => {
    state.allTags = { hades: ["fav"] };
    await evaluateAndPersist();
    const secondRun = await evaluateAndPersist();
    expect(secondRun).toEqual([]);
  });

  it("renderAchievements shows the full roster with unlocked ones marked", async () => {
    state.allTags = { hades: ["fav"] };
    await evaluateAndPersist();
    renderAchievements();
    const panel = document.getElementById("achievementsPanel");
    expect(panel.querySelectorAll(".achievement-badge").length).toBeGreaterThan(1);
    const unlocked = panel.querySelectorAll(".achievement-badge.unlocked");
    expect(unlocked.length).toBe(1);
    expect(panel.textContent).toContain("Getting Started");
  });
});
