import { describe, it, expect, beforeEach } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/streak.js");
await import("../extension/lib/challenges.js");

const S = () => window.GOGPlusStreak;
const C = () => window.GOGPlusChallenges;

describe("streak.touch", () => {
  it("starts at 1 on the first visit", () => {
    expect(S().touch(undefined, "2026-10-03")).toEqual({ last: "2026-10-03", current: 1, best: 1 });
  });

  it("grows by one on consecutive days, across month and year ends", () => {
    let s = S().touch(undefined, "2026-12-30");
    s = S().touch(s, "2026-12-31");
    s = S().touch(s, "2027-01-01");
    expect(s).toEqual({ last: "2027-01-01", current: 3, best: 3 });
  });

  it("ignores a second visit the same day, and a clock that went backwards", () => {
    const s = S().touch(undefined, "2026-10-03");
    expect(S().touch(s, "2026-10-03")).toEqual(s);
    expect(S().touch(s, "2026-10-01")).toEqual(s);
  });

  it("starts over after a gap but keeps the best", () => {
    let s = S().touch(undefined, "2026-10-01");
    s = S().touch(s, "2026-10-02");
    s = S().touch(s, "2026-10-03");
    s = S().touch(s, "2026-10-06");
    expect(s).toEqual({ last: "2026-10-06", current: 1, best: 3 });
  });

  it("refuses a malformed day", () => {
    expect(S().touch(undefined, "tomorrow")).toEqual({ last: "", current: 0, best: 0 });
  });
});

describe("streak.running", () => {
  const s = { last: "2026-10-03", current: 5, best: 9 };
  it("is alive today and the day after, over after that", () => {
    expect(S().running(s, "2026-10-03")).toBe(5);
    expect(S().running(s, "2026-10-04")).toBe(5);
    expect(S().running(s, "2026-10-05")).toBe(0);
    expect(S().running(undefined, "2026-10-05")).toBe(0);
  });
});

describe("dayOf / daysBetween", () => {
  it("uses the local calendar", () => {
    expect(S().dayOf(new Date(2026, 9, 3, 23, 59))).toBe("2026-10-03");
    expect(S().daysBetween("2026-02-28", "2026-03-01")).toBe(1);
    expect(S().daysBetween("2024-02-28", "2024-03-01")).toBe(2); // leap year
  });
});

describe("streak.recordVisit", () => {
  beforeEach(() => globalThis.__resetChromeStores());
  const local = () => new Promise((r) => chrome.storage.local.get("streak", r));

  it("writes once a day and says nothing the second time", async () => {
    const first = await S().recordVisit(window.GOGPlusStorage, new Date(2026, 9, 3, 9));
    expect(first).toEqual({ last: "2026-10-03", current: 1, best: 1 });
    expect(await S().recordVisit(window.GOGPlusStorage, new Date(2026, 9, 3, 18))).toBeNull();
    const next = await S().recordVisit(window.GOGPlusStorage, new Date(2026, 9, 4, 8));
    expect(next.current).toBe(2);
    expect((await local()).streak.best).toBe(2);
  });

  it("never throws, even when storage does", async () => {
    const broken = { get: async () => { throw new Error("gone"); }, set: async () => {} };
    expect(await S().recordVisit(broken)).toBeNull();
  });
});

describe("challenges.pick", () => {
  it("chooses three different challenges, the same ones every time for a month", () => {
    const a = C().pick("2026-10").map((c) => c.id);
    expect(a).toHaveLength(3);
    expect(new Set(a).size).toBe(3);
    expect(C().pick("2026-10").map((c) => c.id)).toEqual(a);
  });

  it("varies from month to month", () => {
    const sets = new Set();
    for (let m = 1; m <= 12; m++) sets.add(C().pick(`2026-${String(m).padStart(2, "0")}`).map((c) => c.id).sort().join());
    expect(sets.size).toBeGreaterThan(3);
  });

  it("never offers both sizes of 'finish'", () => {
    for (let m = 1; m <= 12; m++) {
      const ids = C().pick(`2027-${String(m).padStart(2, "0")}`).map((c) => c.id);
      expect(ids.filter((i) => i.startsWith("finish-")).length).toBeLessThanOrEqual(1);
    }
  });
});

describe("challenges.evaluate", () => {
  const month = "2026-10";
  const data = {
    statusDates: { a: { playing: "2026-10-02", finished: "2026-10-09" }, b: { finished: "2026-09-30" }, c: { playing: "2026-10-12" } },
    priceHistory: { x: [{ d: "2026-10-01" }, { d: "2026-10-02" }], y: [{ d: "2026-10-02" }], z: [{ d: "2026-08-02" }] },
    streakNow: 4,
  };
  const measure = (id) => C().POOL.find((c) => c.id === id).measure(data, month);

  it("measures each kind of goal from dated data, within the month only", () => {
    expect(measure("finish-1")).toBe(1);
    expect(measure("finish-2")).toBe(1);
    expect(measure("start-3")).toBe(2);
    expect(measure("price-days-10")).toBe(2); // 10-01 and 10-02
    expect(measure("track-5")).toBe(2); // x and y first recorded in October, z in August
    expect(measure("streak-7")).toBe(4);
  });

  it("caps progress at the goal and marks completion", () => {
    const list = C().evaluate(month, { ...data, statusDates: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`g${i}`, { playing: "2026-10-01", finished: "2026-10-02" }])), streakNow: 40 });
    for (const c of list) {
      expect(c.progress).toBeLessThanOrEqual(c.goal);
    }
    expect(list.some((c) => c.done)).toBe(true);
  });

  it("copes with empty data", () => {
    const list = C().evaluate(month, {});
    expect(list).toHaveLength(3);
    expect(list.every((c) => c.progress === 0 && !c.done)).toBe(true);
  });

  it("tracks what is newly done, and the total ever done", () => {
    const list = [{ id: "a", done: true }, { id: "b", done: false }, { id: "c", done: true }];
    expect(C().newlyDone(list, ["a"])).toEqual(["c"]);
    expect(C().totalDone({ "2026-09": ["a", "b"], "2026-10": ["c"] })).toBe(3);
    expect(C().totalDone(undefined)).toBe(0);
  });

  it("names a month", () => {
    expect(C().monthKey(new Date(2026, 0, 5))).toBe("2026-01");
  });
});
