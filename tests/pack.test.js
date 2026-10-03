import { describe, it, expect } from "vitest";

await import("../extension/lib/pack.js");

const P = window.GOGPlusPack;

const src = {
  slugs: ["a", "b"],
  tags: { a: ["rpg", "co-op"], b: [], c: ["unused"] },
  notes: { a: "great", c: "x" },
  purchaseLog: { a: { date: "2026-01-01", price: 5, currency: "USD" }, b: "2025-05-05" },
  tagColors: { rpg: "#ff0000", unused: "#00ff00" },
};

describe("buildPack", () => {
  const pack = P.buildPack(src, "  My pack ", new Date("2026-10-02T00:00:00Z"));
  it("collects the chosen games with their tags, notes and purchase dates", () => {
    expect(pack).toMatchObject({ format: "gog-enhancer-tag-pack", formatVersion: 1, name: "My pack", gameCount: 2, exportedAt: "2026-10-02T00:00:00.000Z" });
    expect(pack.games).toEqual([
      { slug: "a", tags: ["rpg", "co-op"], note: "great", purchaseDate: "2026-01-01" },
      { slug: "b", tags: [], note: "", purchaseDate: "2025-05-05" },
    ]);
  });
  it("only carries colours for tags the pack uses", () => {
    expect(pack.tagColors).toEqual({ rpg: "#ff0000" });
  });
  it("names an unnamed pack and uses the clock by default", () => {
    expect(P.buildPack(src, "   ").name).toBe("Untitled pack");
    expect(P.buildPack(src, "x").exportedAt).toMatch(/^\d{4}-/);
  });
});

describe("validatePack", () => {
  it("accepts a pack and rejects other things with a clear message", () => {
    const pack = P.buildPack(src, "x");
    expect(P.validatePack(pack)).toBe(pack);
    expect(() => P.validatePack({ format: "nope", games: [] })).toThrow(/wrong format/);
    expect(() => P.validatePack(null)).toThrow(/wrong format/);
    expect(() => P.validatePack({ format: "gog-enhancer-tag-pack" })).toThrow(/no games/);
  });
});

describe("mergePack", () => {
  const pack = {
    format: "gog-enhancer-tag-pack",
    games: [
      { slug: "a", tags: ["rpg", "new"], note: "theirs", purchaseDate: "2020-01-01" },
      { slug: "z", tags: ["fresh", "  "], note: "zed", purchaseDate: "2021-01-01" },
      { slug: "", tags: ["ignored"] },
      null,
      { slug: "y", tags: "not-an-array" },
    ],
    tagColors: { rpg: "#111111", fresh: "#222222", bad: "javascript:alert(1)", new: 5 },
  };
  const cur = { tags: { a: ["rpg"] }, notes: { a: "mine" }, purchaseLog: { a: { date: "2026-01-01" } }, tagColors: { rpg: "#abcdef" } };
  const out = P.mergePack(pack, cur);

  it("adds tags without duplicating and never overwrites a note, purchase or colour", () => {
    expect(out.tags).toEqual({ a: ["rpg", "new"], z: ["fresh"] });
    expect(out.notes).toEqual({ a: "mine", z: "zed" });
    expect(out.purchaseLog).toEqual({ a: { date: "2026-01-01" }, z: { date: "2021-01-01" } });
    expect(out.tagColors).toEqual({ rpg: "#abcdef", fresh: "#222222" });
  });
  it("counts what it added", () => {
    expect(out.counts).toEqual({ tags: 2, notes: 1, purchases: 1, colors: 1 });
  });
  it("does not mutate its inputs", () => {
    expect(cur.tags.a).toEqual(["rpg"]);
    expect(cur.notes).toEqual({ a: "mine" });
  });
  it("works without tag colours", () => {
    expect(P.mergePack({ format: "x", games: [] }, cur).counts).toEqual({ tags: 0, notes: 0, purchases: 0, colors: 0 });
  });
});

describe("share links", () => {
  const pack = P.buildPack({ ...src, slugs: ["a", "b"] }, "Shared!");

  it("round-trips tags and colours only (notes and purchase dates stay private)", async () => {
    const value = await P.encodeShare(pack);
    expect(value).toMatch(/^[zj]\./);
    const back = await P.decodeShare(value);
    expect(back.name).toBe("Shared!");
    expect(back.games).toEqual([{ slug: "a", tags: ["rpg", "co-op"] }]);
    expect(back.tagColors).toEqual({ rpg: "#ff0000" });
    expect(JSON.stringify(back)).not.toContain("great");
    expect(JSON.stringify(back)).not.toContain("2026-01-01");
    expect(P.validatePack(back)).toBe(back);
  });

  it("falls back to the uncompressed form without CompressionStream", async () => {
    const saved = globalThis.CompressionStream;
    globalThis.CompressionStream = undefined;
    try {
      const value = await P.encodeShare(pack);
      expect(value.startsWith("j.")).toBe(true);
      expect((await P.decodeShare(value)).games).toHaveLength(1);
    } finally {
      globalThis.CompressionStream = saved;
    }
  });

  it("falls back to plain when compression throws", async () => {
    const saved = globalThis.CompressionStream;
    globalThis.CompressionStream = function () {
      throw new Error("nope");
    };
    try {
      expect((await P.encodeShare(pack)).startsWith("j.")).toBe(true);
    } finally {
      globalThis.CompressionStream = saved;
    }
  });

  const plain = (obj) => "j." + btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  it("sanitises a hostile link: bad slugs, oversized lists, junk colours and tags", async () => {
    const hostile = {
      v: 1,
      n: "x".repeat(500),
      g: [
        ["ok_game", ["fine", "   ", 5, "y".repeat(500)]],
        ["../etc/passwd", ["bad"]],
        ["has space", ["bad"]],
        ["only_empty_tags", [""]],
        "not-an-entry",
        ["no_tags_array", "x"],
        ...Array.from({ length: 3000 }, (_, i) => [`g_${i}`, ["t"]]),
      ],
      c: { good: "#fff", evil: "url(javascript:alert(1))", [`k`.repeat(200)]: "#000" },
    };
    const back = await P.decodeShare(plain(hostile));
    expect(back.name).toHaveLength(80);
    expect(back.games[0]).toEqual({ slug: "ok_game", tags: ["fine", "y".repeat(60)] });
    expect(back.games.some((g) => g.slug.includes("/") || g.slug.includes(" "))).toBe(false);
    expect(back.games.length).toBeLessThanOrEqual(2000);
    expect(back.tagColors.good).toBe("#fff");
    expect(back.tagColors.evil).toBeUndefined();
    expect(Object.keys(back.tagColors).every((k) => k.length <= 60)).toBe(true);
  });

  it("names an unnamed link and tolerates a missing colour block", async () => {
    const back = await P.decodeShare(plain({ v: 1, g: [["a", ["t"]]] }));
    expect(back.name).toBe("Shared pack");
    expect(back.tagColors).toEqual({});
  });

  it("refuses damaged, unknown and newer links with a clear message", async () => {
    await expect(P.decodeShare("j.@@@")).rejects.toThrow(/damaged/);
    await expect(P.decodeShare("q.abcd")).rejects.toThrow(/damaged/);
    await expect(P.decodeShare("z.AAAA")).rejects.toThrow(/damaged/);
    await expect(P.decodeShare("j." + btoa("not json"))).rejects.toThrow(/damaged/);
    await expect(P.decodeShare(plain({ v: 2, g: [] }))).rejects.toThrow(/newer/);
    await expect(P.decodeShare(plain({ v: 1 }))).rejects.toThrow(/newer/);
    const saved = globalThis.DecompressionStream;
    globalThis.DecompressionStream = undefined;
    try {
      await expect(P.decodeShare("z.AAAA")).rejects.toThrow(/damaged/);
    } finally {
      globalThis.DecompressionStream = saved;
    }
  });

  it("builds and reads the URL fragment", () => {
    const url = P.shareUrl("j.abc");
    expect(url).toBe("https://www.gog.com/en/games#gogplus-pack=j.abc");
    expect(P.shareValueFromHash(new URL(url).hash)).toBe("j.abc");
    expect(P.shareValueFromHash("#other=1")).toBeNull();
    expect(P.shareValueFromHash("")).toBeNull();
    expect(P.shareUrl("j.abc", "https://example.test/x")).toBe("https://example.test/x#gogplus-pack=j.abc");
  });
});
