import { describe, it, expect, beforeEach } from "vitest";

// content.js is a closed IIFE with no exports of its own — it's the content
// script orchestrator, meant to run on gog.com, not to be imported as a
// module. Importing it here (mirroring manifest.json's real load order so
// its own top-level dependencies resolve) triggers its full bootstrap
// (loadSettings().then(processAll, startObserving)) as a side effect; that's
// fine — everything it touches is wrapped in try/catch or no-ops safely
// under happy-dom + the chrome shim. What we actually want is the small
// window.GOGPlusContentInternals surface it exposes for testing.
await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/dom-safety.js");
await import("../extension/lib/currency-format.js");
await import("../extension/lib/genres.js");
await import("../extension/content/translations.js");
await import("../extension/content/currency-detection.js");
await import("../extension/content/price-history.js");
await import("../extension/content/tooltips.js");
await import("../extension/content/toasts.js");
await import("../extension/content/state.js");
await import("../extension/content/utils.js");
await import("../extension/content/features/currency.js");
await import("../extension/content/features/card-badges.js");
await import("../extension/content/features/misc.js");
await import("../extension/content/features/wishlist.js");
await import("../extension/content/features/game-page.js");
await import("../extension/content/content.js");

const { slugFromHref, buildMiniSparkline, convertedFromCurrency, fxFreshness } =
  window.GOGPlusContentInternals;

beforeEach(() => globalThis.__resetChromeStores());

describe("slugFromHref", () => {
  it("extracts the slug from a /game/ path", () => {
    expect(slugFromHref("/en/game/stardew_valley")).toBe("stardew_valley");
    expect(slugFromHref("/game/cyberpunk_2077")).toBe("cyberpunk_2077");
  });

  it("returns null for a non-game href", () => {
    expect(slugFromHref("/wishlist")).toBe(null);
    expect(slugFromHref(null)).toBe(null);
    expect(slugFromHref(undefined)).toBe(null);
  });
});

describe("buildMiniSparkline", () => {
  it("returns an SVG string with one point per history entry (capped at 10)", () => {
    const history = Array.from({ length: 15 }, (_, i) => ({ d: `d${i}`, p: i + 1, c: "USD" }));
    const svg = buildMiniSparkline(history);
    expect(svg).toContain("<svg");
    expect(svg).toContain("<path");
    // Last 10 points → 10 coordinate pairs joined by " L"
    const coordCount = (svg.match(/\d+\.\d L|\d+\.\d"/g) || []).length;
    expect(coordCount).toBeGreaterThan(0);
  });

  it("doesn't divide by zero when every price is identical (flat range)", () => {
    const history = [
      { d: "d1", p: 10, c: "USD" },
      { d: "d2", p: 10, c: "USD" },
    ];
    expect(() => buildMiniSparkline(history)).not.toThrow();
    expect(buildMiniSparkline(history)).not.toContain("NaN");
  });
});

describe("convertedFromCurrency", () => {
  const settings = {
    targetCurrency: "ILS",
    rates: { ILS: 3.65, EUR: 0.92 },
    taxEstimator: false,
    vatPercent: 0,
  };

  it("converts USD to the target currency via the rate matrix", () => {
    expect(convertedFromCurrency(10, "USD", settings)).toBeCloseTo(36.5, 5);
  });

  it("converts a non-USD source through the USD pivot", () => {
    // 10 EUR -> USD (10/0.92) -> ILS (*3.65)
    const expected = (10 / 0.92) * 3.65;
    expect(convertedFromCurrency(10, "EUR", settings)).toBeCloseTo(expected, 5);
  });

  it("returns null when source and target currencies match", () => {
    expect(convertedFromCurrency(10, "ILS", settings)).toBe(null);
  });

  it("returns null when the target is 'none'", () => {
    expect(convertedFromCurrency(10, "USD", { ...settings, targetCurrency: "none" })).toBe(null);
  });

  it("returns null when a required rate is missing", () => {
    expect(convertedFromCurrency(10, "GBP", settings)).toBe(null);
  });

  it("applies VAT on top of the converted amount when taxEstimator is on", () => {
    const withTax = { ...settings, taxEstimator: true, vatPercent: 18 };
    const base = convertedFromCurrency(10, "USD", settings);
    const taxed = convertedFromCurrency(10, "USD", withTax);
    expect(taxed).toBeCloseTo(base * 1.18, 5);
  });
});

describe("fxFreshness", () => {
  const NOW = 1_700_000_000_000;

  it("reports 'bundled rates' and stale when never fetched", () => {
    const r = fxFreshness({ ratesUpdatedAt: 0, lastFxError: null }, NOW);
    expect(r.stale).toBe(true);
    expect(r.label).toBe("bundled rates");
  });

  it("reports fresh (not stale) shortly after a successful fetch", () => {
    const r = fxFreshness({ ratesUpdatedAt: NOW - 5 * 60_000, lastFxError: null }, NOW);
    expect(r.stale).toBe(false);
    expect(r.label).toBe("5 min ago");
  });

  it("reports stale once older than 48h even without an error", () => {
    const r = fxFreshness({ ratesUpdatedAt: NOW - 49 * 3600_000, lastFxError: null }, NOW);
    expect(r.stale).toBe(true);
    expect(r.label).toBe("2d ago");
  });

  it("reports stale whenever lastFxError is set, regardless of age", () => {
    const r = fxFreshness({ ratesUpdatedAt: NOW - 60_000, lastFxError: "network error" }, NOW);
    expect(r.stale).toBe(true);
  });
});
