import { describe, it, expect } from "vitest";

await import("../extension/lib/catalog-tools.js");
await import("../extension/lib/links.js");

const C = window.GOGPlusCatalogTools;

describe("tileVisibility", () => {
  const tile = { slug: "a", owned: false };
  it("shows everything by default", () => {
    expect(C.tileVisibility(tile, {})).toEqual({ hidden: false, dim: false, reason: "" });
  });
  it("hides a game marked not interested, owned or not", () => {
    expect(C.tileVisibility(tile, { notInterested: { a: 1 } })).toMatchObject({ hidden: true, reason: "not-interested" });
    expect(C.tileVisibility({ slug: "a", owned: true }, { notInterested: { a: 1 }, ownedDisplay: "show" })).toMatchObject({ hidden: true });
  });
  it("can show hidden games again", () => {
    expect(C.tileVisibility(tile, { notInterested: { a: 1 }, hideNotInterested: false }).hidden).toBe(false);
  });
  it("dims or hides owned games, using the page label or the learned set", () => {
    expect(C.tileVisibility({ slug: "a", owned: true }, { ownedDisplay: "dim" })).toEqual({ hidden: false, dim: true, reason: "owned" });
    expect(C.tileVisibility(tile, { ownedDisplay: "dim", ownedSlugs: { a: "2026-01-01" } }).dim).toBe(true);
    expect(C.tileVisibility({ slug: "a", owned: true }, { ownedDisplay: "hide" })).toMatchObject({ hidden: true, reason: "owned" });
    expect(C.tileVisibility({ slug: "a", owned: true }, { ownedDisplay: "show" }).dim).toBe(false);
  });
  it("can restrict to games with recorded history", () => {
    expect(C.tileVisibility(tile, { historyOnly: true })).toMatchObject({ hidden: true, reason: "no-history" });
    expect(C.tileVisibility(tile, { historyOnly: true, history: { a: [{}] } }).hidden).toBe(false);
    expect(C.tileVisibility(tile, { historyOnly: true, history: { a: [] } }).hidden).toBe(true);
  });
});

describe("saved searches", () => {
  it("keeps same-site catalog paths with their query and drops everything else", () => {
    expect(C.sanitizePresetUrl("https://www.gog.com/en/games?genres=rpg&order=desc:trending")).toBe("/en/games?genres=rpg&order=desc:trending");
    expect(C.sanitizePresetUrl("/en/games/adventure?page=2")).toBe("/en/games/adventure?page=2");
    expect(C.sanitizePresetUrl("/games")).toBe("/games");
    expect(C.sanitizePresetUrl("https://evil.example/en/games?x=1")).toBeNull();
    expect(C.sanitizePresetUrl("https://www.gog.com/en/account/wishlist")).toBeNull();
    expect(C.sanitizePresetUrl("javascript:alert(1)")).toBeNull();
    expect(C.sanitizePresetUrl("http://[bad")).toBeNull();
  });
  it("adds presets immutably and refuses bad ones", () => {
    const base = { a: "/en/games" };
    const next = C.addPreset(base, "  RPGs  ", "https://www.gog.com/en/games?genres=rpg");
    expect(next).toEqual({ a: "/en/games", RPGs: "/en/games?genres=rpg" });
    expect(base).toEqual({ a: "/en/games" });
    expect(C.addPreset(base, "", "/en/games")).toBe(base);
    expect(C.addPreset(base, "x", "https://evil.example/games")).toBe(base);
    expect(Object.keys(C.addPreset({}, "n".repeat(80), "/games"))[0]).toHaveLength(40);
  });
  it("suggests a readable name", () => {
    expect(C.suggestPresetName("/en/games?genres=rpg&order=desc:trending&page=3")).toBe("genres: rpg, sorted trending");
    expect(C.suggestPresetName("/en/games")).toBe("All games");
    expect(C.suggestPresetName("/en/games?page=2")).toBe("All games");
  });
});

describe("buildComparison", () => {
  const items = [
    { slug: "a", title: "Alpha", price: 10, currency: "USD", discountPct: 50, owned: false },
    { slug: "b", title: "", price: null, currency: "USD", discountPct: 0, owned: true },
  ];
  const ctx = {
    history: { a: [{ d: "1", p: 20, c: "USD" }, { d: "2", p: 10, c: "USD" }, { d: "3", p: 5, c: "EUR" }] },
    facts: {
      a: { rating: { score: 4.8, count: 2848 }, criticsPct: 95, langs: { English: { a: true, t: true }, Hebrew: { a: false, t: true } }, hours: { Main: "108 h" } },
      b: { langs: { French: { a: true, t: true } } },
    },
    genres: { a: "rpg" },
    tags: { a: ["co-op", "long"] },
    preferred: ["Hebrew", "German"],
  };
  const table = C.buildComparison(items, ctx);
  const cell = (label, i) => table.rows.find((r) => r.label === label).cells[i];

  it("lays out one column per game, falling back to the slug for a missing title", () => {
    expect(table.columns).toEqual([{ slug: "a", title: "Alpha" }, { slug: "b", title: "b" }]);
  });
  it("fills prices, history and facts, with dashes for what is unknown", () => {
    expect(cell("Price now", 0)).toBe("10.00 USD");
    expect(cell("Price now", 1)).toBe("In library");
    expect(cell("Discount", 0)).toBe("-50%");
    expect(cell("Discount", 1)).toBe("—");
    expect(cell("Tracked low", 0)).toBe("10.00 USD");
    expect(cell("Tracked average", 0)).toBe("15.00 USD");
    expect(cell("Tracked low", 1)).toBe("—");
    expect(cell("Rating", 0)).toBe("4.8/5 (2848)");
    expect(cell("Rating", 1)).toBe("—");
    expect(cell("Critics", 0)).toBe("95%");
    expect(cell("Critics", 1)).toBe("—");
    expect(cell("Time to beat", 0)).toBe("108 h");
    expect(cell("Genre", 0)).toBe("rpg");
    expect(cell("Your tags", 0)).toBe("co-op, long");
    expect(cell("Your tags", 1)).toBe("—");
  });
  it("reports whether the preferred languages are supported", () => {
    expect(cell("Your language", 0)).toBe("Hebrew");
    expect(cell("Your language", 1)).toBe("none");
    const audio = C.buildComparison(items.slice(0, 1), { ...ctx, preferred: ["English"] });
    expect(audio.rows.find((r) => r.label === "Your language").cells[0]).toBe("English (audio)");
    const noPref = C.buildComparison(items.slice(0, 1), { ...ctx, preferred: [] });
    expect(noPref.rows.find((r) => r.label === "Your language").cells[0]).toBe("—");
  });
  it("works with no context at all", () => {
    const t = C.buildComparison(items);
    expect(t.rows[0].cells).toEqual(["10.00 USD", "In library"]);
  });
});

describe("openInLinks", () => {
  it("builds link-only URLs from the title, encoded", () => {
    const links = window.GOGPlusLinks.openInLinks("The Witcher 3: Wild Hunt", "the_witcher_3");
    expect(links.map((l) => l.id)).toEqual(["itad", "steam", "pcgw", "hltb", "steamdb"]);
    expect(links[1].url).toBe("https://store.steampowered.com/search/?term=The%20Witcher%203%3A%20Wild%20Hunt");
    expect(links.every((l) => l.url.startsWith("https://"))).toBe(true);
  });
  it("falls back to the slug, and to nothing", () => {
    expect(window.GOGPlusLinks.openInLinks("", "grim_fandango")[0].url).toContain("grim%20fandango");
    expect(window.GOGPlusLinks.openInLinks("", "")).toEqual([]);
  });
});
