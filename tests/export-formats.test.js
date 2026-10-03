import { describe, it, expect } from "vitest";

await import("../extension/lib/export-formats.js");

const E = window.GOGPlusExportFormats;

const data = {
  tags: { hades: ["rpg", "co-op"], empty: [] },
  notes: { hades: 'Loved "it"\nsecond line', unused: "" },
  gameStatus: { hades: "finished", doom: "backlog" },
  purchaseLog: { hades: { date: "2025-12-10", price: 10, currency: "USD" }, doom: "2025-03-03" },
  ownedSlugs: { hades: "2025-12-10", quake: "2026-01-01" },
  priceHistory: { hades: [{ d: "1", p: 20, c: "USD" }, { d: "2", p: 12, c: "USD" }, { d: "3", p: 99, c: "EUR" }], tracked_only: [{ d: "1", p: 5, c: "USD" }] },
  gameFacts: { hades: { title: "Hades, GOTY", rating: { score: 4.8, count: 1 }, year: 2020 } },
  gameGenres: { hades: "rpg" },
  wishlistSlugs: ["wished_game", "doom"],
};

describe("knownSlugs", () => {
  it("lists every game the library knows anything about, once, sorted", () => {
    expect(E.knownSlugs(data)).toEqual(["doom", "hades", "quake", "tracked_only"]);
    expect(E.knownSlugs({})).toEqual([]);
  });
});

describe("libraryCsv", () => {
  const csv = E.libraryCsv(data);
  const lines = csv.split("\r\n");

  it("starts with a header row and ends with a newline", () => {
    expect(lines[0]).toBe(E.COLUMNS.join(","));
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("writes one properly quoted row per game", () => {
    expect(lines[2]).toBe(
      '"Hades, GOTY",hades,https://www.gog.com/en/game/hades,finished,yes,"rpg, co-op",' +
        '"Loved ""it"" second line",2025-12-10,10.00,USD,4.8,2020,rpg,99.00,99.00'
    );
  });

  it("handles legacy string purchases and games known only from history", () => {
    expect(lines[1]).toBe("Doom,doom,https://www.gog.com/en/game/doom,backlog,,,,2025-03-03,,,,,,,");
    expect(lines[4]).toBe("Tracked Only,tracked_only,https://www.gog.com/en/game/tracked_only,,,,,,,,,,,5.00,5.00");
  });

  it("is just a header for an empty library", () => {
    expect(E.libraryCsv({})).toBe(E.COLUMNS.join(",") + "\r\n");
  });
});

describe("trelloLines", () => {
  it("writes one line per game with status and latest price", () => {
    const lines = E.trelloLines(data).split("\n");
    expect(lines).toContain("Hades, GOTY — finished — 99.00 EUR");
    expect(lines).toContain("Doom — backlog");
    expect(lines).toContain("Wished Game");
  });
  it("can be limited to a status or to the wishlist", () => {
    expect(E.trelloLines(data, { status: "backlog" })).toBe("Doom — backlog");
    expect(E.trelloLines(data, { onlyWishlist: true }).split("\n").sort()).toEqual(["Doom — backlog", "Wished Game"]);
    expect(E.trelloLines({})).toBe("");
  });
});
