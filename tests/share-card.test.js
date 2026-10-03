import { describe, it, expect, vi } from "vitest";

await import("../extension/lib/library-tools.js");
await import("../extension/lib/share-card.js");

const S = window.GOGPlusShareCard;
const texts = (ops) => ops.filter((o) => o.type === "text").map((o) => o.text);

describe("fit", () => {
  it("leaves short text alone and shortens long text with an ellipsis", () => {
    expect(S.fit("short", 30, 600)).toBe("short");
    const cut = S.fit("x".repeat(200), 30, 300);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut.length).toBeLessThan(30);
  });
});

describe("layout", () => {
  const model = {
    title: "2025 in games",
    subtitle: "Mostly rpg",
    accent: "#ff00aa",
    stats: Array.from({ length: 8 }, (_, i) => ({ label: `stat ${i}`, value: String(i) })),
    lists: [
      { title: "Top tags", rows: Array.from({ length: 6 }, (_, i) => ({ label: `tag ${i}`, value: String(i) })) },
      { title: "Empty", rows: [] },
      { title: "Second", rows: [{ label: "a", value: "1" }] },
      { title: "Third (dropped)", rows: [{ label: "b", value: "2" }] },
    ],
    footer: "my footer",
  };
  const ops = S.layout(model);

  it("starts with the background and draws the title block", () => {
    expect(ops[0].type).toBe("gradient");
    expect(texts(ops)).toEqual(expect.arrayContaining(["GOG ENHANCER", "2025 in games", "Mostly rpg", "my footer"]));
    expect(ops.find((o) => o.type === "rect" && o.h === 14).fill).toBe("#ff00aa");
  });

  it("caps what it draws so it always fits the card", () => {
    expect(texts(ops).filter((t) => /^stat /.test(t))).toHaveLength(6);
    expect(texts(ops).filter((t) => /^tag /.test(t))).toHaveLength(4);
    expect(texts(ops)).not.toContain("THIRD (DROPPED)");
    expect(texts(ops)).not.toContain("EMPTY");
    for (const o of ops) if (o.type === "text") expect(o.y).toBeLessThan(S.HEIGHT);
  });

  it("falls back to a safe accent and works without optional parts", () => {
    const bare = S.layout({ title: "T", accent: "javascript:alert(1)", stats: [] });
    expect(bare.find((o) => o.type === "rect" && o.h === 14).fill).toBe("#00f0ff");
    expect(texts(bare)).toContain("Made locally in my browser with GOG Enhancer");
    expect(texts(bare)).not.toContain(undefined);
  });
});

describe("render", () => {
  function fakeCtx() {
    const calls = [];
    const rec = (name) => (...a) => calls.push([name, ...a]);
    return {
      calls,
      createLinearGradient: (..._a) => ({ addColorStop: (...s) => calls.push(["stop", ...s]) }),
      fillRect: rec("fillRect"),
      beginPath: rec("beginPath"),
      roundRect: rec("roundRect"),
      fill: rec("fill"),
      fillText: rec("fillText"),
      set fillStyle(v) {
        calls.push(["fillStyle", typeof v === "string" ? v : "gradient"]);
      },
      set font(v) {
        calls.push(["font", v]);
      },
      set textAlign(v) {
        calls.push(["align", v]);
      },
    };
  }

  it("replays every operation on the context", () => {
    const ctx = fakeCtx();
    S.render(ctx, S.layout({ title: "T", stats: [{ label: "l", value: "v" }], lists: [{ title: "L", rows: [{ label: "a", value: "1" }] }] }));
    const names = ctx.calls.map((c) => c[0]);
    expect(names).toContain("stop");
    expect(names).toContain("roundRect");
    expect(ctx.calls.find((c) => c[0] === "fillText" && c[1] === "T")).toBeTruthy();
    expect(ctx.calls.find((c) => c[0] === "align" && c[1] === "right")).toBeTruthy();
  });

  it("uses plain rectangles when the context has no roundRect", () => {
    const ctx = fakeCtx();
    ctx.roundRect = undefined;
    S.render(ctx, [{ type: "rect", x: 0, y: 0, w: 10, h: 10, fill: "#fff", radius: 5 }]);
    expect(ctx.calls.map((c) => c[0])).toContain("fillRect");
  });
});

describe("toPng", () => {
  it("draws on a canvas and resolves with its PNG", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => ({ createLinearGradient: () => ({ addColorStop() {} }), fillRect() {}, fillText() {}, beginPath() {}, roundRect() {}, fill() {} })), toBlob: (cb, type) => cb(type === "image/png" ? blob : null) };
    vi.spyOn(document, "createElement").mockReturnValueOnce(canvas);
    expect(await S.toPng({ title: "T", stats: [] })).toBe(blob);
    expect(canvas.width).toBe(S.WIDTH);
    expect(canvas.height).toBe(S.HEIGHT);
  });

  it("rejects when there is no 2D context or the encoder fails", async () => {
    vi.spyOn(document, "createElement").mockReturnValueOnce({ getContext: () => null });
    await expect(S.toPng({ title: "T", stats: [] })).rejects.toThrow(/Canvas/);
    vi.spyOn(document, "createElement").mockReturnValueOnce({ width: 0, height: 0, getContext: () => ({ createLinearGradient: () => ({ addColorStop() {} }), fillRect() {}, fillText() {} }), toBlob: (cb) => cb(null) });
    await expect(S.toPng({ title: "T", stats: [] })).rejects.toThrow(/image/);
  });
});

describe("models", () => {
  const w = {
    year: 2025, currency: "ILS", bought: 12, spent: 345.6, finished: 4, averagePaid: 28.8, topGenre: "rpg",
    topTags: [{ tag: "co-op", count: 3 }],
    priciest: { title: "Big", paid: 99 },
    cheapest: { title: "Small", paid: 1 },
  };
  it("builds the Wrapped card", () => {
    const m = S.wrappedModel(w);
    expect(m.title).toBe("2025 in games");
    expect(m.subtitle).toBe("Mostly rpg");
    expect(m.stats.map((s) => s.value)).toEqual(["12", "346 ILS", "4", "29 ILS"]);
    expect(m.lists[1].rows.map((r) => r.label)).toEqual(["Priciest: Big", "Cheapest: Small"]);
    expect(S.wrappedModel(w, { saved: 500 }).stats[3]).toEqual({ label: "saved vs list price", value: "500 ILS" });
    expect(S.wrappedModel({ ...w, topGenre: null, priciest: null, cheapest: null }).lists[1].rows).toEqual([]);
  });
  it("builds the collector card", () => {
    const m = S.collectorModel({ owned: 40, classicPct: 67, oldest: { title: "Old", year: 1998 }, byDecade: { "2000s": 5, "1990s": 2 }, topGenres: [{ genre: "rpg", count: 9 }] });
    expect(m.stats).toEqual([{ label: "games owned", value: "40" }, { label: "“Good Old Games” (15+ years)", value: "67%" }]);
    expect(m.subtitle).toBe("Oldest: Old (1998)");
    expect(m.lists[0].rows.map((r) => r.label)).toEqual(["1990s", "2000s"]);
    expect(S.collectorModel({ owned: 0, classicPct: null, oldest: null, byDecade: {}, topGenres: [] }).stats[1].value).toBe("—");
  });
});
