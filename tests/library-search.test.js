import { describe, it, expect } from "vitest";

await import("../extension/lib/library-search.js");

const Search = window.GOGPlusLibrarySearch;

const data = {
  tags: { the_witcher_3: ["rpg", "Open World"], witcher_2: ["rpg"], stardew_valley: ["cozy"] },
  notes: { hades: "great" },
  gameStatus: { the_witcher_3: "playing", stardew_valley: "backlog" },
  purchaseLog: { cyberpunk_2077: { date: "2026-01-01" } },
  wishlistSlugs: ["baldurs_gate_3"],
  priceHistory: { disco_elysium: [] },
};

describe("humanize", () => {
  it("title-cases slugs", () => {
    expect(Search.humanize("the_witcher_3")).toBe("The Witcher 3");
    expect(Search.humanize("__x__")).toBe("X");
  });
});

describe("searchLibrary", () => {
  it("considers every slug the extension knows about", () => {
    const all = Search.searchLibrary(data, "", 50).map((r) => r.slug);
    expect(all.sort()).toEqual(
      ["baldurs_gate_3", "cyberpunk_2077", "disco_elysium", "hades", "stardew_valley", "the_witcher_3", "witcher_2"].sort()
    );
  });

  it("matches titles by substring and ranks prefix, then word-start, then inside", () => {
    const r = Search.searchLibrary(data, "witcher").map((x) => x.slug);
    // "Witcher 2" starts with it; "The Witcher 3" has it at a word start.
    expect(r).toEqual(["witcher_2", "the_witcher_3"]);
  });

  it("matches tags as plain terms and with the tag: operator", () => {
    expect(Search.searchLibrary(data, "cozy").map((x) => x.slug)).toEqual(["stardew_valley"]);
    expect(Search.searchLibrary(data, "tag:rpg").map((x) => x.slug).sort()).toEqual(["the_witcher_3", "witcher_2"]);
    expect(Search.searchLibrary(data, "tag:open").map((x) => x.slug)).toEqual(["the_witcher_3"]);
  });

  it("filters by status exactly", () => {
    expect(Search.searchLibrary(data, "status:playing").map((x) => x.slug)).toEqual(["the_witcher_3"]);
    expect(Search.searchLibrary(data, "status:play")).toEqual([]);
  });

  it("requires every term to match", () => {
    expect(Search.searchLibrary(data, "witcher status:playing").map((x) => x.slug)).toEqual(["the_witcher_3"]);
    expect(Search.searchLibrary(data, "witcher cozy")).toEqual([]);
  });

  it("treats empty operators as non-matching rather than matching everything", () => {
    expect(Search.searchLibrary(data, "tag:")).toEqual([]);
    expect(Search.searchLibrary(data, "status:")).toEqual([]);
  });

  it("is case-insensitive and respects the limit", () => {
    expect(Search.searchLibrary(data, "WITCHER").length).toBe(2);
    expect(Search.searchLibrary(data, "", 3)).toHaveLength(3);
  });

  it("returns tags and status with each result, and handles missing data", () => {
    const [r] = Search.searchLibrary(data, "the witcher");
    expect(r).toEqual({ slug: "the_witcher_3", title: "The Witcher 3", tags: ["rpg", "Open World"], status: "playing" });
    expect(Search.searchLibrary({}, "x")).toEqual([]);
  });
});

describe("omnibox helpers", () => {
  it("escapes XML so a game or tag name can't break the suggestion markup", () => {
    expect(Search.escapeXml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&apos;");
  });

  it("builds a suggestion with the title highlighted and extras dimmed", () => {
    const s = Search.suggestionFor({ slug: "the_witcher_3", title: "The Witcher 3", tags: ["rpg"], status: "playing" });
    expect(s.content).toBe("slug:the_witcher_3");
    expect(s.description).toBe("<match>The Witcher 3</match> <dim>#rpg · playing</dim>");
  });

  it("omits the dim part when there is nothing to show, and escapes what it does show", () => {
    expect(Search.suggestionFor({ slug: "a", title: "A", tags: [], status: "" }).description).toBe("<match>A</match>");
    expect(Search.suggestionFor({ slug: "a", title: "A & B", tags: ["<x>"], status: "" }).description).toBe(
      "<match>A &amp; B</match> <dim>#&lt;x&gt;</dim>"
    );
  });

  it("resolves a suggestion to the game page and free text to store search", () => {
    expect(Search.resolveOmniboxInput("slug:the_witcher_3")).toBe("https://www.gog.com/en/game/the_witcher_3");
    expect(Search.resolveOmniboxInput("half life")).toBe("https://www.gog.com/en/games?query=half%20life");
    expect(Search.resolveOmniboxInput("   ")).toBe("https://www.gog.com/en/games");
  });

  it("never lets a crafted 'slug:' value escape the game path", () => {
    expect(Search.resolveOmniboxInput("slug:../../evil")).toBe(
      "https://www.gog.com/en/games?query=slug%3A..%2F..%2Fevil"
    );
  });
});

describe("year / owned / wishlist operators", () => {
  const S = window.GOGPlusLibrarySearch;
  const data = {
    tags: { alpha_game: ["rpg"], beta_game: ["rpg"], gamma_game: [] },
    wishlistSlugs: ["beta_game"],
    ownedSlugs: { alpha_game: "2026-01-01", gamma_game: "2026-01-02" },
    gameFacts: { alpha_game: { rd: "2015-05-19", title: "Alpha: The Game" }, beta_game: { rd: "2020-02-02" }, gamma_game: { rd: "2011-11-11" } },
  };
  const slugs = (q) => S.searchLibrary(data, q, 10).map((r) => r.slug).sort();

  it("year: matches a year or a range, only for games whose date is known", () => {
    expect(slugs("year:2015")).toEqual(["alpha_game"]);
    expect(slugs("year:2010-2016")).toEqual(["alpha_game", "gamma_game"]);
    expect(slugs("year:abc")).toEqual([]);
  });

  it("owned: and wishlist: filter on yes / no", () => {
    expect(slugs("owned:yes")).toEqual(["alpha_game", "gamma_game"]);
    expect(slugs("owned:no")).toEqual(["beta_game"]);
    expect(slugs("wishlist:yes")).toEqual(["beta_game"]);
    expect(slugs("owned:maybe")).toEqual([]);
  });

  it("combine with the older operators, and a remembered title is used", () => {
    expect(slugs("tag:rpg owned:yes")).toEqual(["alpha_game"]);
    expect(S.searchLibrary(data, "alpha", 3)[0].title).toBe("Alpha: The Game");
  });
});
