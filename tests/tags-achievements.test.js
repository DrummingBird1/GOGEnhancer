import { describe, it, expect, beforeEach } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/purchases.js");
await import("../extension/lib/achievements.js");
await import("../extension/lib/streak.js");
await import("../extension/lib/challenges.js");
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
  state.allStatus = {};
  state.allGenres = {};
  state.allFacts = {};
  state.allOwned = {};
  state.statusDates = {};
  state.alerts = {};
  state.streak = { last: "", current: 0, best: 0 };
  state.challengesDone = {};
  state.notInterested = {};
  state.lastAutoBackupAt = 0;
  state.syncFolderName = "";
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

describe("achievements v2 on the dashboard", () => {
  it("computeStats reads the library, habits and tools numbers", () => {
    state.allOwned = { a: "2026-01-01", b: "2026-01-01", c: "2026-01-01" };
    state.allFacts = { a: { year: 1999 }, b: { year: 2004 }, c: { year: 2010 } };
    state.allStatus = { a: "finished", b: "finished", c: "backlog", d: "playing" };
    state.allTags = { a: ["x"] };
    state.allGenres = { a: "rpg", c: "horror", z: "strategy" };
    state.allHistory = { d: [{ d: "2026-01-01", p: 1, c: "USD" }] };
    state.alerts = { a: {}, b: {} };
    state.streak = { last: "2026-10-03", current: 2, best: 9 };
    state.allWishlistSlugs = ["a", "b", "c", "d"];
    state.notInterested = { q: "2026-01-01" };
    state.syncFolderName = "Dropbox";
    state.lastAutoBackupAt = 123;
    state.challengesDone = { "2026-09": ["finish-1", "streak-7"], "2026-10": ["start-3"] };
    const s = computeStats();
    expect(s).toMatchObject({
      owned: 3, finished: 2, backlog: 1, retroOwned: 2, alertsSet: 2, streakBest: 9, wishlistSize: 4,
      notInterested: 1, syncUsed: true, backedUp: true, challengesDone: 3,
    });
    expect(s.genresTracked).toBe(2); // rpg (a: tagged) and horror (c: has a status); z was never touched, b and d have no genre
  });

  it("shows tiers, keeps hidden achievements hidden until they unlock, and reveals them afterwards", async () => {
    renderAchievements();
    const panel = document.getElementById("achievementsPanel");
    expect(panel.querySelector(".tier-chip.tier-gold").textContent).toMatch(/^gold 0\/\d+$/);
    const hidden = [...panel.querySelectorAll(".achievement-badge.is-hidden")];
    expect(hidden.length).toBeGreaterThanOrEqual(3);
    expect(hidden[0].textContent).toContain("???");
    expect(panel.textContent).not.toContain("Backlog Zero");
    state.allStatus = Object.fromEntries(["a", "b", "c", "d", "e"].map((s) => [s, "finished"]));
    await evaluateAndPersist();
    renderAchievements();
    expect(panel.textContent).toContain("Backlog Zero");
  });

  it("evaluates this month's challenges, stores completions once, and offers 'Challenger'", async () => {
    const month = window.GOGPlusChallenges.monthKey(new Date());
    const wanted = window.GOGPlusChallenges.pick(month).map((c) => c.id);
    // Make every challenge of the month true at once.
    const day = `${month}-02`;
    state.statusDates = Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`g${i}`, { playing: day, finished: day }]));
    state.allHistory = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`p${i}`, Array.from({ length: 11 }, (_, k) => ({ d: `${month}-${String(k + 1).padStart(2, "0")}`, p: 1, c: "USD" }))]));
    state.streak = { last: window.GOGPlusStreak.dayOf(new Date()), current: 8, best: 8 };
    const done = await window.GOGPlusTagsAchievements.evaluateChallenges();
    expect(done.length).toBe(wanted.length);
    expect(state.challengesDone[month].sort()).toEqual([...wanted].sort());
    expect((await new Promise((r) => chrome.storage.local.get("challengesDone", r))).challengesDone[month]).toHaveLength(wanted.length);
    expect(await window.GOGPlusTagsAchievements.evaluateChallenges()).toEqual([]); // not twice
    const newly = await evaluateAndPersist();
    expect(newly).toContain("challenger");
  });

  it("draws the challenges with progress bars and the streak", () => {
    state.streak = { last: window.GOGPlusStreak.dayOf(new Date()), current: 4, best: 9 };
    renderAchievements();
    const panel = document.getElementById("achievementsPanel");
    expect(panel.querySelectorAll(".challenge")).toHaveLength(3);
    const bar = panel.querySelector(".challenge-bar");
    expect(bar.getAttribute("role")).toBe("progressbar");
    expect(bar.getAttribute("aria-valuemax")).toBeTruthy();
    expect(panel.querySelector(".streak-chip").textContent).toBe("🔥 4-day streak · best 9");
  });
});
