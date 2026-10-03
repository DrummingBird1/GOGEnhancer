import { describe, it, expect } from "vitest";

await import("../extension/lib/wishlist-tools.js");

const W = window.GOGPlusWishlistTools;
const row = (o) => ({ slug: "x", title: "X", price: 10, currency: "USD", discountPct: 0, owned: false, tba: false, free: false, ...o });

const rows = [
  row({ slug: "a", title: "Alpha", price: 20, discountPct: 50 }),
  row({ slug: "b", title: "Beta", price: 5, discountPct: 0 }),
  row({ slug: "c", title: "Gamma", price: 8, discountPct: 75 }),
  row({ slug: "d", title: "Delta", price: null, owned: true }),
  row({ slug: "e", title: "Epsilon", price: 15, discountPct: 50, currency: "ILS" }),
];
const history = {
  a: [{ d: "2026-01-01", p: 20, c: "USD" }, { d: "2026-02-01", p: 40, c: "USD" }],
  b: [{ d: "2026-01-01", p: 4, c: "USD" }],
  c: [{ d: "2026-01-01", p: 8, c: "USD" }],
};
const ctx = { history, rates: { ILS: 4 }, target: "USD", now: Date.parse("2026-10-02T00:00:00Z") };
const slugs = (rs) => rs.map((r) => r.slug);

describe("pctAboveLow / nearLow", () => {
  it("is 0 at the tracked low, positive above it, null without history or price", () => {
    expect(W.pctAboveLow(rows[0], ctx)).toBe(0);
    expect(W.pctAboveLow(rows[1], ctx)).toBe(25);
    expect(W.pctAboveLow(rows[3], ctx)).toBeNull();
    expect(W.pctAboveLow(rows[4], ctx)).toBeNull();
    expect(W.pctAboveLow(row({ slug: null }), ctx)).toBeNull();
  });
  it("counts within 10% of the low as near", () => {
    expect(W.nearLow(rows[0], ctx)).toBe(true);
    expect(W.nearLow(rows[1], ctx)).toBe(false);
    expect(W.nearLow(rows[4], ctx)).toBe(false);
  });
  it("treats a new minimum as the low", () => {
    expect(W.pctAboveLow(row({ slug: "a", price: 10 }), ctx)).toBe(0);
  });
});

describe("endingSoon", () => {
  const e = (ms) => ({ ...ctx, offerEnds: { a: ctx.now + ms } });
  it("is true inside 48h and false outside, expired or unknown", () => {
    expect(W.endingSoon(rows[0], e(3600e3))).toBe(true);
    expect(W.endingSoon(rows[0], e(49 * 3600e3))).toBe(false);
    expect(W.endingSoon(rows[0], e(-1))).toBe(false);
    expect(W.endingSoon(rows[1], e(3600e3))).toBe(false);
    expect(W.endingSoon(rows[0], ctx)).toBe(false);
  });
  it("defaults now to the clock", () => {
    expect(W.endingSoon(rows[0], { offerEnds: { a: Date.now() + 3600e3 } })).toBe(true);
  });
});

describe("sortRows", () => {
  it("keeps page order for default and never mutates the input", () => {
    const copy = rows.slice();
    expect(slugs(W.sortRows(rows, "default", ctx))).toEqual(["a", "b", "c", "d", "e"]);
    expect(rows).toEqual(copy);
  });
  it("sorts by discount, biggest first, priced rows before unpriced", () => {
    expect(slugs(W.sortRows(rows, "discount", ctx))).toEqual(["c", "a", "e", "b", "d"]);
  });
  it("sorts by converted price both ways, unpriced last", () => {
    // e is 15 ILS = 3.75 USD
    expect(slugs(W.sortRows(rows, "price-asc", ctx))).toEqual(["e", "b", "c", "a", "d"]);
    expect(slugs(W.sortRows(rows, "price-desc", ctx))).toEqual(["a", "c", "b", "e", "d"]);
  });
  it("puts unconvertible currencies after convertible ones", () => {
    const r = [row({ slug: "p", price: 1, currency: "XXX" }), row({ slug: "q", price: 99 })];
    expect(slugs(W.sortRows(r, "price-asc", ctx))).toEqual(["q", "p"]);
  });
  it("sorts by distance to the tracked low, unknown last", () => {
    expect(slugs(W.sortRows(rows, "near-low", ctx))).toEqual(["a", "c", "b", "d", "e"]);
  });
  it("sorts by title", () => {
    expect(slugs(W.sortRows(rows, "title", ctx))).toEqual(["a", "b", "d", "e", "c"]);
  });
  it("falls back to page order for an unknown mode and works without ctx", () => {
    expect(slugs(W.sortRows(rows, "nope"))).toEqual(["a", "b", "c", "d", "e"]);
    expect(slugs(W.sortRows(rows, "discount"))).toEqual(["c", "a", "e", "b", "d"]);
    expect(W.SORT_MODES).toContain("near-low");
  });
});

describe("matchesFilter", () => {
  it("applies each filter", () => {
    expect(W.matchesFilter(rows[0], "sale")).toBe(true);
    expect(W.matchesFilter(rows[1], "sale")).toBe(false);
    expect(W.matchesFilter(rows[3], "hide-owned")).toBe(false);
    expect(W.matchesFilter(rows[0], "hide-owned")).toBe(true);
    expect(W.matchesFilter(rows[0], "near-low", ctx)).toBe(true);
    expect(W.matchesFilter(rows[1], "near-low", ctx)).toBe(false);
    expect(W.matchesFilter(rows[0], "ending-soon", { ...ctx, offerEnds: { a: ctx.now + 1000 } })).toBe(true);
    expect(W.matchesFilter(rows[0], "all")).toBe(true);
    expect(W.matchesFilter(rows[0], "nonsense")).toBe(true);
    expect(W.matchesFilter(rows[0], "near-low")).toBe(false);
  });
});

describe("totals", () => {
  it("sums priced, unowned rows in the target currency and estimates the saving", () => {
    const t = W.totals(rows, ctx);
    // 20 + 5 + 8 + 3.75 (the owned row has no price)
    expect(t.total).toBeCloseTo(36.75);
    expect(t.count).toBe(5);
    expect(t.priced).toBe(4);
    expect(t.owned).toBe(1);
    expect(t.onSale).toBe(3);
    // a: 20 is 50% off 40 → 20; c: 8 is 75% off 32 → 24; e: 3.75 is 50% off → 3.75
    expect(t.saving).toBeCloseTo(20 + 24 + 3.75);
    expect(t.currency).toBe("USD");
  });
  it("works without a target (one currency, no conversion) and skips unconvertible rows", () => {
    const t = W.totals([row({ price: 5 }), row({ price: 7, currency: "XXX" })], { target: "USD", rates: {} });
    expect(t.total).toBe(5);
    expect(t.priced).toBe(1);
    const noTarget = W.totals([row({ price: 5 }), row({ price: 7 })]);
    expect(noTarget.total).toBe(12);
    expect(noTarget.currency).toBe("USD");
  });
  it("ignores 100% discounts when estimating savings (free games)", () => {
    expect(W.totals([row({ price: 0, discountPct: 100 })]).saving).toBe(0);
  });
});

describe("groupRows", () => {
  const c = { tags: { a: ["rpg", "x"], b: ["rpg"], c: ["indie"] }, status: { a: "backlog" }, genres: { c: "horror" } };
  it("returns one unlabeled group for none", () => {
    expect(W.groupRows(rows, "none")).toEqual([{ label: "", rows }]);
  });
  it("groups by first tag, biggest group first, rest under Other", () => {
    const g = W.groupRows(rows, "tag", c);
    expect(g.map((x) => x.label)).toEqual(["rpg", "indie", "Other"]);
    expect(slugs(g[0].rows)).toEqual(["a", "b"]);
    expect(slugs(g[2].rows)).toEqual(["d", "e"]);
  });
  it("groups by status and genre", () => {
    expect(W.groupRows(rows, "status", c).map((x) => x.label)).toEqual(["backlog", "Other"]);
    expect(W.groupRows(rows, "genre", c).map((x) => x.label)).toEqual(["horror", "Other"]);
  });
  it("handles rows without a slug and a missing ctx", () => {
    expect(W.groupRows([row({ slug: null })], "tag")).toEqual([{ label: "Other", rows: [expect.anything()] }]);
  });
});

describe("exports", () => {
  it("writes RFC 4180 CSV with quoting and the tracked low", () => {
    const csv = W.toCsv([row({ slug: "a", title: 'He said "hi", ok', price: 20, discountPct: 50 }), row({ slug: "d", price: null, owned: true })], {
      history,
      tags: { a: ["rpg", "co-op"] },
    });
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Title,Slug,Price,Currency,Discount %,Owned,Tracked low,Tags");
    expect(lines[1]).toBe('"He said ""hi"", ok",a,20.00,USD,50,,20.00,rpg; co-op');
    expect(lines[2]).toBe("X,d,,USD,0,yes,,");
    expect(csv.endsWith("\r\n")).toBe(true);
  });
  it("writes a Markdown checklist with totals", () => {
    const md = W.toMarkdown(rows, ctx);
    expect(md).toContain("# GOG wishlist");
    expect(md).toContain("- [ ] [Alpha](https://www.gog.com/en/game/a) — 20.00 USD (-50%)");
    expect(md).toContain("- [ ] [Delta](https://www.gog.com/en/game/d) — owned");
    expect(md).toMatch(/5 games, 3 on sale, total 36\.75 USD/);
  });
  it("labels free and TBA rows", () => {
    const md = W.toMarkdown([row({ price: null, free: true, slug: null, title: "F" }), row({ price: null, tba: true, title: "T", slug: "t" }), row({ price: null, title: "N", slug: "n" })]);
    expect(md).toContain("- [ ] F — free");
    expect(md).toContain("— TBA");
    expect(md).toContain("— —");
  });
});
