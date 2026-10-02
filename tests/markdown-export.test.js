import { describe, it, expect } from "vitest";

await import("../extension/lib/markdown-export.js");

const Md = window.GOGPlusMarkdownExport;
const NOW = Date.parse("2026-10-02T12:00:00Z");

describe("toHashtag", () => {
  it("turns spaces into hyphens and drops punctuation", () => {
    expect(Md.toHashtag("Open World")).toBe("#Open-World");
    expect(Md.toHashtag("  co-op!  ")).toBe("#co-op");
    expect(Md.toHashtag("sci-fi/space")).toBe("#sci-fi/space");
  });

  it("keeps non-latin letters", () => {
    expect(Md.toHashtag("משחקי תפקידים")).toBe("#משחקי-תפקידים");
  });

  it("skips tags Obsidian would reject", () => {
    expect(Md.toHashtag("2026")).toBe("");
    expect(Md.toHashtag("!!!")).toBe("");
    expect(Md.toHashtag("   ")).toBe("");
  });
});

describe("buildLibraryMarkdown", () => {
  const data = {
    slugs: ["witcher_3", "stardew_valley", "hades", "untouched_game"],
    tags: { witcher_3: ["RPG", "Open World"], hades: ["roguelike"], stardew_valley: ["2026"] },
    notes: { witcher_3: "Great story.\n\nFinish Blood and Wine." },
    status: { witcher_3: "playing", hades: "finished", stardew_valley: "backlog" },
    purchases: { witcher_3: { date: "2026-09-01", price: 19.99, currency: "USD" }, hades: { date: "2026-08-01" } },
  };

  it("groups by status in a fixed order, with a final group for the rest", () => {
    const md = Md.buildLibraryMarkdown(data, { now: NOW });
    const order = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(order).toEqual(["Playing", "Backlog", "Finished", "No status"]);
    expect(md).toContain("# My GOG library");
    expect(md).toContain("_Exported 2026-10-02 by GOG Enhancer · 4 games_");
  });

  it("renders each game as a link with hashtags, purchase info and a blockquoted note", () => {
    const md = Md.buildLibraryMarkdown(data, { now: NOW });
    expect(md).toContain(
      "- [Witcher 3](https://www.gog.com/en/game/witcher_3) #RPG #Open-World — bought 2026-09-01 (19.99 USD)"
    );
    expect(md).toContain("  > Great story.\n  >\n  > Finish Blood and Wine.");
    expect(md).toContain("- [Hades](https://www.gog.com/en/game/hades) #roguelike — bought 2026-08-01\n");
  });

  it("omits unusable tags and empty sections", () => {
    const md = Md.buildLibraryMarkdown({ slugs: ["stardew_valley"], tags: { stardew_valley: ["2026"] }, status: {} }, { now: NOW });
    expect(md).toContain("- [Stardew Valley](https://www.gog.com/en/game/stardew_valley)\n");
    expect(md).not.toContain("#2026");
    expect(md).not.toContain("## Playing");
  });

  it("uses the supplied title function, custom heading, and escapes link brackets", () => {
    const md = Md.buildLibraryMarkdown(
      { slugs: ["x"] },
      { now: NOW, heading: "Backlog", titleOf: () => "Game [Remastered]" }
    );
    expect(md).toContain("# Backlog");
    expect(md).toContain("[Game \\[Remastered\\]](https://www.gog.com/en/game/x)");
  });

  it("handles an empty library and singular wording", () => {
    expect(Md.buildLibraryMarkdown({ slugs: [] }, { now: NOW })).toContain("0 games");
    expect(Md.buildLibraryMarkdown({ slugs: ["a"] }, { now: NOW })).toContain("1 game_");
  });

  it("treats an unknown status as 'No status'", () => {
    const md = Md.buildLibraryMarkdown({ slugs: ["a"], status: { a: "weird" } }, { now: NOW });
    expect(md).toContain("## No status");
  });
});
