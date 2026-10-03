import { describe, it, expect } from "vitest";

await import("../extension/lib/deals.js");

const D = window.GOGPlusDeals;
const NOW = Date.parse("2026-10-02T12:00:00+03:00");

describe("parsePromoDate", () => {
  it("parses the site's `timer` attribute (space separator, microseconds, offset)", () => {
    expect(D.parsePromoDate("2026-10-07 09:59:59.000000+03:00")).toBe(Date.parse("2026-10-07T09:59:59.000+03:00"));
  });
  it("accepts plain ISO strings and epoch numbers, rejects junk", () => {
    expect(D.parsePromoDate("2026-10-07T00:00:00Z")).toBe(Date.parse("2026-10-07T00:00:00Z"));
    expect(D.parsePromoDate(1234)).toBe(1234);
    expect(D.parsePromoDate("")).toBeNull();
    expect(D.parsePromoDate(null)).toBeNull();
    expect(D.parsePromoDate("not a date")).toBeNull();
    expect(D.parsePromoDate(NaN)).toBeNull();
  });
});

describe("formatDuration / offerEndsIn", () => {
  it("formats days+hours, hours+minutes and minutes", () => {
    expect(D.formatDuration(5 * 86400e3 + 3 * 3600e3)).toBe("5d 3h");
    expect(D.formatDuration(2 * 86400e3)).toBe("2d");
    expect(D.formatDuration(3 * 3600e3 + 12 * 60e3)).toBe("3h 12m");
    expect(D.formatDuration(4 * 3600e3)).toBe("4h");
    expect(D.formatDuration(90e3)).toBe("1m");
    expect(D.formatDuration(-5)).toBe("1m");
  });

  it("flags urgency tiers and expiry", () => {
    const at = (ms) => D.offerEndsIn(NOW + ms, NOW);
    expect(at(5 * 86400e3)).toMatchObject({ urgent: false, soon: false, expired: false, label: "5d" });
    expect(at(2 * 86400e3)).toMatchObject({ urgent: false, soon: true });
    expect(at(5 * 3600e3)).toMatchObject({ urgent: true, soon: true, label: "5h" });
    expect(at(-1000)).toMatchObject({ expired: true, urgent: false, soon: false, label: "ended" });
    expect(D.offerEndsIn("nope", NOW)).toBeNull();
  });

  it("defaults `now` to the clock", () => {
    const r = D.offerEndsIn(Date.now() + 3600e3 * 2);
    expect(r.urgent).toBe(true);
  });
});

describe("realDiscount", () => {
  it("is null for impossible inputs", () => {
    expect(D.realDiscount({ base: 0, final: 5 })).toBeNull();
    expect(D.realDiscount({ base: 10, final: 12 })).toBeNull();
    expect(D.realDiscount({ base: 10, final: -1 })).toBeNull();
  });

  it("without GOG's 30-day figure it can only repeat the advertised percentage", () => {
    expect(D.realDiscount({ base: 49.99, final: 24.99 })).toEqual({
      advertisedPct: 50,
      effectivePct: null,
      inflationPts: 0,
      vs30: "unknown",
      lowest30: null,
    });
  });

  it("calls a price no lower than last month's 'same' — the real Witcher 3 reading", () => {
    const r = D.realDiscount({ base: 49.99, final: 24.99, lowest30: 24.99 });
    expect(r.vs30).toBe("same");
    expect(r.effectivePct).toBe(0);
    // The reference price was already half the list price, so the "-50%" claim
    // is entirely inflation.
    expect(r.inflationPts).toBe(50);
  });

  it("recognises a genuine drop below the 30-day low", () => {
    const r = D.realDiscount({ base: 20, final: 10, lowest30: 20 });
    expect(r).toMatchObject({ vs30: "better", effectivePct: 50, inflationPts: 0, advertisedPct: 50 });
  });

  it("flags a price that is higher than it was recently", () => {
    expect(D.realDiscount({ base: 20, final: 15, lowest30: 10 })).toMatchObject({ vs30: "worse", effectivePct: 0 });
  });

  it("measures inflation when the reference sits between the sale and list price", () => {
    const r = D.realDiscount({ base: 40, final: 20, lowest30: 30 });
    expect(r.advertisedPct).toBe(50);
    expect(r.effectivePct).toBe(33);
    expect(r.inflationPts).toBe(17);
    expect(r.vs30).toBe("better");
  });
});

describe("trackedPosition", () => {
  const hist = [
    { d: "2026-01-01", p: 30, c: "USD" },
    { d: "2026-02-01", p: 15, c: "USD" },
    { d: "2026-03-01", p: 30, c: "USD" },
    { d: "2026-04-01", p: 99, c: "EUR" },
  ];
  it("ignores other currencies and reports distance above the low", () => {
    const r = D.trackedPosition(18, hist, "USD");
    expect(r).toMatchObject({ low: 15, high: 30, count: 3, atLow: false, pctAboveLow: 20 });
    expect(r.avg).toBeCloseTo(25);
  });
  it("treats a new minimum as at-low", () => {
    expect(D.trackedPosition(10, hist, "USD")).toMatchObject({ low: 10, atLow: true, pctAboveLow: 0 });
  });
  it("is null with no comparable history", () => {
    expect(D.trackedPosition(10, [], "USD")).toBeNull();
    expect(D.trackedPosition(10, hist, "GBP")).toBeNull();
    expect(D.trackedPosition(10, null, "USD")).toBeNull();
  });
});

describe("saleStats", () => {
  const e = (d, p, b) => ({ d, p, c: "USD", ...(b ? { b } : {}) });

  it("needs at least two snapshots", () => {
    expect(D.saleStats([e("2026-01-01", 20)]).count).toBe(0);
    expect(D.saleStats(null).count).toBe(0);
  });

  it("finds episodes against the running highest price and predicts the next one", () => {
    const h = [
      e("2026-01-01", 20),
      e("2026-01-10", 10), // sale 1 (-50%)
      e("2026-01-20", 20),
      e("2026-03-10", 12), // sale 2
      e("2026-03-15", 20),
      e("2026-05-09", 10), // sale 3
    ];
    const s = D.saleStats(h);
    expect(s.count).toBe(3);
    expect(s.episodes[0]).toMatchObject({ start: "2026-01-10", end: "2026-01-10", minPrice: 10, depthPct: 50 });
    expect(s.medianGapDays).toBe(59); // gaps 59, 60 → lower median
    expect(s.avgDepthPct).toBe(47);
    expect(s.nextExpected).toBe("2026-07-07");
  });

  it("merges consecutive discounted snapshots into one episode", () => {
    const s = D.saleStats([e("2026-01-01", 20), e("2026-01-10", 10), e("2026-01-12", 8), e("2026-01-20", 20)]);
    expect(s.count).toBe(1);
    expect(s.episodes[0]).toMatchObject({ start: "2026-01-10", end: "2026-01-12", minPrice: 8, depthPct: 60 });
    expect(s.nextExpected).toBeNull();
  });

  it("closes a trailing open episode", () => {
    expect(D.saleStats([e("2026-01-01", 20), e("2026-01-10", 10)]).count).toBe(1);
  });

  it("uses the recorded list price so a permanent price cut is not a sale", () => {
    const s = D.saleStats([e("2026-01-01", 30, 30), e("2026-02-01", 20, 20), e("2026-03-01", 20, 20)]);
    expect(s.count).toBe(0);
  });

  it("counts a snapshot discounted against its own list price", () => {
    const s = D.saleStats([e("2026-01-01", 30, 30), e("2026-02-01", 15, 30)]);
    expect(s.count).toBe(1);
    expect(s.episodes[0].depthPct).toBe(50);
  });

  it("only compares snapshots in the latest currency", () => {
    const h = [{ d: "2026-01-01", p: 100, c: "EUR" }, e("2026-02-01", 20), e("2026-03-01", 19)];
    expect(D.saleStats(h).count).toBe(0);
  });
});

describe("hours and price per hour", () => {
  it("parses the site's hour strings", () => {
    expect(D.parseHours("154.5 h")).toBe(154.5);
    expect(D.parseHours("1,200 Hours")).toBe(1200);
    expect(D.parseHours("45½ h")).toBe(45.5);
    expect(D.parseHours("n/a")).toBeNull();
    expect(D.parseHours("")).toBeNull();
    expect(D.parseHours("0 h")).toBeNull();
  });
  it("divides price by hours", () => {
    expect(D.pricePerHour(24.99, 100)).toBe(0.25);
    expect(D.pricePerHour(0, 10)).toBe(0);
    expect(D.pricePerHour(10, 0)).toBeNull();
    expect(D.pricePerHour(10, null)).toBeNull();
    expect(D.pricePerHour(-1, 10)).toBeNull();
  });
});

describe("convertAll", () => {
  const rates = { ILS: 4, EUR: 0.5 };
  it("converts through USD and skips the source currency", () => {
    expect(D.convertAll(10, "USD", rates, ["USD", "ILS", "EUR"])).toEqual([
      { code: "ILS", value: 40 },
      { code: "EUR", value: 5 },
    ]);
    expect(D.convertAll(40, "ILS", rates, ["USD", "ILS", "EUR"])).toEqual([
      { code: "USD", value: 10 },
      { code: "EUR", value: 5 },
    ]);
  });
  it("adds VAT only to the user's own region currencies", () => {
    const out = D.convertAll(10, "USD", rates, ["ILS", "EUR"], {
      taxEstimator: true,
      vatPercent: 20,
      vatCurrencies: ["ILS"],
    });
    expect(out).toEqual([
      { code: "ILS", value: 48 },
      { code: "EUR", value: 5 },
    ]);
  });
  it("skips currencies it has no rate for, and unusable sources", () => {
    expect(D.convertAll(10, "USD", rates, ["JPY"])).toEqual([]);
    expect(D.convertAll(10, "JPY", rates, ["USD"])).toEqual([]);
    expect(D.convertAll(-1, "USD", rates, ["ILS"])).toEqual([]);
  });
});

describe("savingsSummary", () => {
  const rates = { ILS: 4 };
  const priceHistory = {
    a: [
      { d: "2025-01-01", p: 20, c: "USD", b: 30 },
      { d: "2025-02-01", p: 8, c: "USD", b: 30 },
    ],
    b: [{ d: "2026-01-01", p: 40, c: "ILS" }],
    c: [{ d: "2026-01-01", p: 10, c: "USD" }],
  };
  it("estimates savings per purchase against the highest list price seen", () => {
    const r = D.savingsSummary({
      purchaseLog: {
        a: { date: "2025-02-02", price: 8, currency: "USD" },
        b: { date: "2026-03-01", price: 10, currency: "ILS" },
        c: { date: "2026-03-01" }, // no price paid → skipped
        d: { date: "2026-03-01", price: 5, currency: "USD" }, // no history → skipped
        e: "2026-01-01", // legacy string shape → skipped
        f: { date: "2026-03-01", price: 99, currency: "USD" }, // paid ≥ list → skipped
      },
      priceHistory: { ...priceHistory, f: [{ d: "2026-01-01", p: 50, c: "USD" }] },
      rates,
      target: "USD",
    });
    expect(r.rows.map((x) => x.slug)).toEqual(["a", "b"]);
    expect(r.rows[0]).toMatchObject({ slug: "a", paid: 8, list: 30, saved: 22, year: "2025" });
    expect(r.rows[1].saved).toBeCloseTo(7.5); // (40-10)/4
    expect(r.total).toBeCloseTo(29.5);
    expect(r.byYear["2025"]).toBe(22);
    expect(r.byYear["2026"]).toBeCloseTo(7.5);
  });

  it("converts into the target currency and drops rows it cannot convert", () => {
    const r = D.savingsSummary({
      purchaseLog: { a: { date: "2025-02-02", price: 8, currency: "USD" }, z: { date: "2025-02-02", price: 1, currency: "XXX" } },
      priceHistory: { ...priceHistory, z: [{ d: "2025-01-01", p: 5, c: "XXX" }] },
      rates,
      target: "ILS",
    });
    expect(r.rows).toHaveLength(1);
    expect(r.total).toBeCloseTo(88);
  });

  it("is empty without a purchase log", () => {
    expect(D.savingsSummary({ purchaseLog: null, priceHistory: {}, rates, target: "USD" })).toEqual({ total: 0, byYear: {}, rows: [] });
  });
});
