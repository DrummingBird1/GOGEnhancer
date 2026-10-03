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

describe("achievements v2: roster, tiers, hidden ones", () => {
  it("has at least 30 achievements, each with a tier and a unique id", () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) expect(["bronze", "silver", "gold"]).toContain(a.tier);
  });

  it("keeps every id that shipped before v4, so nobody loses an unlock", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    for (const old of ["first-tag", "curator", "archivist", "note-taker", "storyteller", "price-watcher", "market-analyst", "snapshot-streak", "wishlist-curator", "budget-tracker", "refund-guardian"]) {
      expect(ids).toContain(old);
    }
  });

  it("has some hidden achievements, and tierCounts adds up", () => {
    expect(ACHIEVEMENTS.filter((a) => a.hidden).length).toBeGreaterThanOrEqual(3);
    const c = window.GOGPlusAchievements.tierCounts({ "first-tag": "x" });
    expect(c.bronze.have).toBe(1);
    expect(c.bronze.total + c.silver.total + c.gold.total).toBe(ACHIEVEMENTS.length);
  });

  it("unlocks the library, deal and habit achievements at their thresholds", () => {
    const e = (over) => evaluateAchievements({ ...emptyStats, ...over }, {});
    expect(e({ owned: 10 })).toContain("shelf-started");
    expect(e({ owned: 9 })).not.toContain("shelf-started");
    expect(e({ owned: 150 })).toEqual(expect.arrayContaining(["shelf-started", "collector", "hoard"]));
    expect(e({ finished: 25 })).toEqual(expect.arrayContaining(["finisher", "closer", "completionist-games"]));
    expect(e({ retroOwned: 10 })).toContain("retro-heart");
    expect(e({ alertsSet: 5 })).toEqual(expect.arrayContaining(["tripwire", "alert-master"]));
    expect(e({ streakBest: 30 })).toEqual(expect.arrayContaining(["streak-3", "streak-7", "streak-30"]));
    expect(e({ syncUsed: true })).toContain("everywhere");
    expect(e({ backedUp: true })).toContain("safety-net");
    expect(e({ challengesDone: 12 })).toEqual(expect.arrayContaining(["challenger", "challenge-12"]));
    expect(e({ genresTracked: 5 })).toContain("explorer");
    expect(e({ notInterested: 20 })).toContain("picky");
    expect(e({ taggedGames: 50 })).toContain("librarian");
    expect(e({ snapshots: 500 })).toContain("snapshot-500");
    expect(e({ wishlistSize: 50 })).toContain("wishlist-50");
  });

  it("'Backlog Zero' needs finished games AND an empty backlog", () => {
    expect(evaluateAchievements({ ...emptyStats, finished: 5, backlog: 0 }, {})).toContain("backlog-zero");
    expect(evaluateAchievements({ ...emptyStats, finished: 5, backlog: 1 }, {})).not.toContain("backlog-zero");
    expect(evaluateAchievements({ ...emptyStats, finished: 4, backlog: 0 }, {})).not.toContain("backlog-zero");
  });

  it("'Completionist' unlocks once everything else has — even within the same evaluation", () => {
    const everythingElse = Object.fromEntries(ACHIEVEMENTS.filter((a) => a.id !== "completionist").map((a) => [a.id, "x"]));
    expect(evaluateAchievements(emptyStats, everythingElse)).toEqual(["completionist"]);
    const missingOne = { ...everythingElse };
    delete missingOne["first-tag"];
    expect(evaluateAchievements(emptyStats, missingOne)).toEqual([]);
    // all but Completionist qualify at once from the stats alone
    const maxed = { taggedGames: 99, notesCount: 99, trackedGames: 999, snapshots: 9999, wishlistPricedCount: 99, purchasesWithPrice: 9, activeRefunds: 9, owned: 999, finished: 99, backlog: 0, genresTracked: 9, retroOwned: 99, alertsSet: 9, streakBest: 99, wishlistSize: 99, notInterested: 99, syncUsed: true, backedUp: true, challengesDone: 99 };
    const all = evaluateAchievements(maxed, {});
    expect(all).toContain("completionist");
    expect(all).toHaveLength(ACHIEVEMENTS.length);
  });
});
