import { describe, it, expect } from "vitest";

await import("../extension/lib/library-tools.js");

const L = window.GOGPlusLibraryTools;

const data = {
  ownedSlugs: { a: "2026-01-01", b: "2026-01-01", c: "2026-01-01", d: "2026-01-01" },
  gameFacts: {
    target: { title: "Target", tags: ["RPG", "Fantasy", "Story Rich"], year: 2020 },
    a: { title: "Alpha", tags: ["rpg", "fantasy"], rating: { score: 4.8, count: 10 }, hours: { Main: "8 h" }, year: 2001 },
    b: { title: "Beta", tags: ["rpg"], year: 1998 },
    c: { tags: ["Racing"], year: 2012 },
  },
  tags: { target: ["co-op"], d: ["co-op", "story rich"], a: [] },
  gameGenres: { a: "rpg", b: "rpg", c: "strategy" },
  gameStatus: { a: "backlog", e: "finished" },
  notes: { a: "Great start.\nSecond line", z: "" },
  purchaseLog: {
    a: { date: "2025-12-10", price: 10, currency: "USD" },
    b: { date: "2025-06-01", price: 5, currency: "USD" },
    e: "2025-03-03",
    f: { date: "2024-01-01", price: 20, currency: "EUR" },
  },
  priceHistory: { a: [{ d: "2025-12-10", p: 10, c: "USD" }, { d: "2026-01-01", p: 12, c: "USD" }] },
  statusDates: { a: { finished: "2026-10-01" }, e: { finished: "2026-10-15" }, f: { finished: "2025-05-05" } },
  rates: { EUR: 0.5 },
};

describe("titleFromSlug", () => {
  it("title-cases a slug", () => {
    expect(L.titleFromSlug("the_witcher_3")).toBe("The Witcher 3");
    expect(L.titleFromSlug("a__b")).toBe("A  B");
  });
});

describe("similarOwned", () => {
  it("finds owned games sharing at least two tags, best first", () => {
    const r = L.similarOwned("target", data);
    expect(r.map((x) => x.slug)).toEqual(["a", "d"]);
    expect(r[0]).toMatchObject({ title: "Alpha", shared: ["rpg", "fantasy"] });
    expect(r[1]).toMatchObject({ slug: "d", title: "D", shared: ["story rich", "co-op"] });
  });
  it("needs a lower bar for games with few tags, and ignores itself and unknowns", () => {
    const few = { ...data, gameFacts: { ...data.gameFacts, t2: { tags: ["rpg"] } }, ownedSlugs: { ...data.ownedSlugs, t2: "x" } };
    const r = L.similarOwned("t2", few);
    expect(r.map((x) => x.slug)).toEqual(["a", "b"]);
    expect(L.similarOwned("nobody", data)).toEqual([]);
  });
  it("respects the limit and falls back to a slug title", () => {
    const many = { ...data, ownedSlugs: { ...data.ownedSlugs }, gameFacts: { ...data.gameFacts } };
    for (let i = 0; i < 10; i++) {
      many.ownedSlugs[`g_${i}`] = "x";
      many.gameFacts[`g_${i}`] = { tags: ["rpg", "fantasy"] };
    }
    const r = L.similarOwned("target", many, 3);
    expect(r).toHaveLength(3);
    expect(L.similarOwned("target", many, 20).find((x) => x.slug === "g_3").title).toBe("G 3");
  });
});

describe("weightedPick", () => {
  const items = [{ id: "x", weight: 1 }, { id: "y", weight: 3 }, { id: "z", weight: 0 }];
  it("walks the weights with the random number", () => {
    expect(L.weightedPick(items, () => 0).id).toBe("x");
    expect(L.weightedPick(items, () => 0.24).id).toBe("x");
    expect(L.weightedPick(items, () => 0.26).id).toBe("y");
    expect(L.weightedPick(items, () => 0.999).id).toBe("y");
  });
  it("never returns a zero-weight item and handles empty input", () => {
    for (let i = 0; i < 50; i++) expect(L.weightedPick(items).id).not.toBe("z");
    expect(L.weightedPick([])).toBeNull();
    expect(L.weightedPick([{ weight: 0 }])).toBeNull();
  });
  it("falls back to the last live item if the random number overshoots", () => {
    expect(L.weightedPick(items, () => 1).id).toBe("y");
  });
});

describe("backlogWeights", () => {
  const now = Date.parse("2026-10-02T00:00:00Z");
  const w = L.backlogWeights(["a", "b", "nobody"], data, now);
  it("rewards good reviews, short games and long-waiting purchases", () => {
    const a = w.find((x) => x.slug === "a");
    expect(a.weight).toBeGreaterThan(1 + (4.8 - 3.5) * 2); // review + short bonus
    expect(a.why).toEqual(["rated 4.8/5", "a short one", "waiting a while"]);
    expect(a.title).toBe("Alpha");
  });
  it("gives an old purchase a bonus capped at three years", () => {
    const b = w.find((x) => x.slug === "b");
    expect(b.why).toEqual(["waiting a while"]);
    expect(b.weight).toBeCloseTo(1 + 0.5 * ((now - Date.parse("2025-06-01T00:00:00Z")) / (365 * 86400e3)), 3);
    const ancient = L.backlogWeights(["x"], { purchaseLog: { x: "2000-01-01" } }, now)[0];
    expect(ancient.weight).toBe(2.5);
  });
  it("leaves unknown games at the base weight", () => {
    expect(w.find((x) => x.slug === "nobody")).toMatchObject({ weight: 1, why: [], title: "Nobody" });
  });
  it("uses the clock by default and tolerates legacy string purchases", () => {
    expect(L.backlogWeights(["e"], data)[0].why).toContain("waiting a while");
  });
});

describe("monthlyProgress", () => {
  const now = Date.parse("2026-10-16T12:00:00Z");
  it("counts finishes in the current month against the goal", () => {
    expect(L.monthlyProgress({ statusDates: data.statusDates, goal: 4, now })).toEqual({ finished: 2, goal: 4, pct: 50, daysLeft: 15, onTrack: true });
  });
  it("reports being behind, no goal, and an empty month", () => {
    expect(L.monthlyProgress({ statusDates: data.statusDates, goal: 10, now }).onTrack).toBe(false);
    expect(L.monthlyProgress({ statusDates: data.statusDates, goal: 0, now })).toMatchObject({ pct: 0, onTrack: false });
    expect(L.monthlyProgress({ goal: 2, now })).toMatchObject({ finished: 0 });
    expect(L.monthlyProgress({ goal: 1, now: Date.parse("2026-02-10T00:00:00Z"), statusDates: {} }).daysLeft).toBe(18);
  });
  it("caps the percentage at 100 and defaults to the clock", () => {
    expect(L.monthlyProgress({ statusDates: data.statusDates, goal: 1, now }).pct).toBe(100);
    expect(L.monthlyProgress({ goal: 1 }).goal).toBe(1);
  });
});

describe("wrappedStats", () => {
  const s = L.wrappedStats(data, 2025, { target: "USD" });
  it("summarises a year of purchases (a purchase without a price still counts as bought)", () => {
    expect(s).toMatchObject({ year: 2025, currency: "USD", bought: 3, finished: 1, spent: 15, averagePaid: 7.5 });
  });
  it("converts other currencies into the target", () => {
    const y = L.wrappedStats(data, 2024, { target: "USD" });
    expect(y).toMatchObject({ bought: 1, spent: 40 }); // 20 EUR at 0.5 per USD
  });
  it("finds the priciest and cheapest purchases and the monthly spread", () => {
    expect(s.priciest).toEqual({ slug: "a", title: "Alpha", paid: 10 });
    expect(s.cheapest).toMatchObject({ slug: "b", paid: 5 });
    expect(s.byMonth[11]).toBe(1);
    expect(s.byMonth[5]).toBe(1);
    expect(s.byMonth[2]).toBe(1);
  });
  it("counts tags and genres of what was bought", () => {
    const t = L.wrappedStats({ ...data, tags: { a: ["x", "y"], b: ["x"] } }, 2025, { target: "USD" });
    expect(t.topTags[0]).toEqual({ tag: "x", count: 2 });
    expect(s.topGenre).toBe("rpg");
  });
  it("handles a year with nothing in it and unconvertible currencies", () => {
    const e = L.wrappedStats(data, 1999, { target: "USD" });
    expect(e).toMatchObject({ bought: 0, spent: 0, averagePaid: 0, priciest: null, cheapest: null, topGenre: null });
    const odd = L.wrappedStats({ purchaseLog: { q: { date: "2025-01-01", price: 5, currency: "XXX" } } }, 2025, { target: "USD" });
    expect(odd).toMatchObject({ bought: 1, spent: 0, priciest: null });
  });
});

describe("collectorCard", () => {
  const c = L.collectorCard(data, 2026);
  it("summarises the owned library", () => {
    expect(c.owned).toBe(4);
    expect(c.yearsKnown).toBe(3);
    expect(c.byDecade).toEqual({ "2000s": 1, "1990s": 1, "2010s": 1 });
    expect(c.oldest).toMatchObject({ slug: "b", year: 1998 });
    expect(c.topGenres[0]).toEqual({ genre: "rpg", count: 2 });
  });
  it("computes the Good Old Game share from games at least 15 years old", () => {
    expect(c.classicPct).toBe(67); // 2001, 1998 of 2001, 1998, 2012
  });
  it("copes with an empty library", () => {
    expect(L.collectorCard({})).toMatchObject({ owned: 0, classicPct: null, oldest: null });
  });
});

describe("obsidianFiles", () => {
  const files = L.obsidianFiles(data, { now: new Date("2026-10-02T00:00:00Z") });
  const byPath = Object.fromEntries(files.map((f) => [f.path, f.content]));
  it("writes an index and one note per game that has something to say", () => {
    expect(files[0].path).toBe("GOG/Index.md");
    expect(Object.keys(byPath).filter((p) => p.startsWith("GOG/Games/")).sort()).toEqual(
      ["a", "b", "c", "d", "e", "f", "target"].map((s) => `GOG/Games/${s}.md`)
    );
    expect(byPath["GOG/Games/z.md"]).toBeUndefined(); // empty note only
    expect(byPath["GOG/Index.md"]).toContain("Exported 2026-10-02");
    expect(byPath["GOG/Index.md"]).toContain("[[a|Alpha]] — backlog");
  });
  it("writes YAML frontmatter Obsidian understands", () => {
    const a = byPath["GOG/Games/a.md"];
    expect(a.startsWith('---\ntitle: "Alpha"\nslug: "a"\nurl: "https://www.gog.com/en/game/a"\nstatus: "backlog"\nowned: true\npurchased: 2025-12-10\npaid: "10.00 USD"\nrating: 4.8\nreleased: 2001\ngenre: "rpg"\n---')).toBe(true);
    expect(a).toContain("# Alpha");
    expect(a).toContain("Great start.\nSecond line");
    expect(a).toContain("| 2026-01-01 | 12.00 USD |");
  });
  it("quotes tags and handles legacy purchases and unowned games", () => {
    expect(byPath["GOG/Games/d.md"]).toContain('tags: ["co-op", "story-rich"]');
    expect(byPath["GOG/Games/e.md"]).toContain("owned: false");
    expect(byPath["GOG/Games/e.md"]).toContain("purchased: 2025-03-03");
  });
  it("uses the clock when no date is given", () => {
    expect(L.obsidianFiles({})[0].content).toContain("0 games");
  });
});
