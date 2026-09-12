import { describe, it, expect, beforeAll } from "vitest";

let ACHIEVEMENTS, evaluateAchievements;

beforeAll(async () => {
  await import("../extension/lib/achievements.js");
  ({ ACHIEVEMENTS, evaluateAchievements } = window.GOGPlusAchievements);
});

const emptyStats = {
  taggedGames: 0,
  notesCount: 0,
  trackedGames: 0,
  snapshots: 0,
  wishlistPricedCount: 0,
  purchasesWithPrice: 0,
  activeRefunds: 0,
};

describe("lib/achievements.js", () => {
  it("defines every achievement with a unique id and a working check()", () => {
    const ids = new Set();
    for (const a of ACHIEVEMENTS) {
      expect(ids.has(a.id)).toBe(false);
      ids.add(a.id);
      expect(typeof a.check).toBe("function");
      expect(typeof a.title).toBe("string");
      expect(typeof a.description).toBe("string");
      expect(typeof a.icon).toBe("string");
    }
  });

  it("unlocks nothing when every stat is zero", () => {
    expect(evaluateAchievements(emptyStats, {})).toEqual([]);
  });

  it("unlocks exactly the achievements a given stats snapshot qualifies for", () => {
    const stats = { ...emptyStats, taggedGames: 10, notesCount: 1 };
    const newly = evaluateAchievements(stats, {});
    expect(newly).toContain("first-tag");
    expect(newly).toContain("curator");
    expect(newly).toContain("note-taker");
    expect(newly).not.toContain("archivist"); // needs 25
    expect(newly).not.toContain("storyteller"); // needs 5 notes
  });

  it("never re-returns an id already present in `unlocked`", () => {
    const stats = { ...emptyStats, taggedGames: 1 };
    const newly = evaluateAchievements(stats, { "first-tag": "2026-01-01T00:00:00.000Z" });
    expect(newly).not.toContain("first-tag");
  });

  it("evaluates every documented threshold independently", () => {
    expect(evaluateAchievements({ ...emptyStats, taggedGames: 25 }, {})).toEqual(
      expect.arrayContaining(["first-tag", "curator", "archivist"])
    );
    expect(evaluateAchievements({ ...emptyStats, notesCount: 5 }, {})).toEqual(
      expect.arrayContaining(["note-taker", "storyteller"])
    );
    expect(evaluateAchievements({ ...emptyStats, trackedGames: 25 }, {})).toEqual(
      expect.arrayContaining(["price-watcher", "market-analyst"])
    );
    expect(evaluateAchievements({ ...emptyStats, snapshots: 50 }, {})).toContain("snapshot-streak");
    expect(evaluateAchievements({ ...emptyStats, wishlistPricedCount: 10 }, {})).toContain(
      "wishlist-curator"
    );
    expect(evaluateAchievements({ ...emptyStats, purchasesWithPrice: 1 }, {})).toContain(
      "budget-tracker"
    );
    expect(evaluateAchievements({ ...emptyStats, activeRefunds: 1 }, {})).toContain(
      "refund-guardian"
    );
  });

  it("doesn't crash and still evaluates the rest when one check() throws", () => {
    const target = ACHIEVEMENTS[0];
    const original = target.check;
    target.check = () => {
      throw new Error("boom");
    };
    try {
      const stats = { ...emptyStats, notesCount: 1 };
      expect(() => evaluateAchievements(stats, {})).not.toThrow();
      expect(evaluateAchievements(stats, {})).toContain("note-taker");
    } finally {
      target.check = original;
    }
  });
});
