import { describe, it, expect } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/dom-safety.js");
await import("../extension/lib/currency-format.js");
await import("../extension/lib/genres.js");
await import("../extension/lib/game-status.js");
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

const { buildWorthWaitingVerdict } = window.GOGPlusGamePage;

describe("buildWorthWaitingVerdict", () => {
  it("shows the 'good' tier when the price is within 10% of the tracked low", () => {
    const html = buildWorthWaitingVerdict({
      latest: { p: 10.5 },
      min: { price: 10 },
      avg: 15,
      currency: "USD",
    });
    expect(html).toContain("gog-plus-worth-waiting--good");
    expect(html).toContain("🟢");
    expect(html).toContain("$10.00");
  });

  it("shows the 'ok' tier when below average but well above the low", () => {
    const html = buildWorthWaitingVerdict({
      latest: { p: 12 },
      min: { price: 5 },
      avg: 15,
      currency: "USD",
    });
    expect(html).toContain("gog-plus-worth-waiting--ok");
    expect(html).toContain("🟡");
    expect(html).toContain("$15.00");
  });

  it("shows the 'wait' tier when at or above average", () => {
    const html = buildWorthWaitingVerdict({
      latest: { p: 20 },
      min: { price: 5 },
      avg: 15,
      currency: "USD",
    });
    expect(html).toContain("gog-plus-worth-waiting--wait");
    expect(html).toContain("🔴");
  });

  it("uses the correct currency symbol", () => {
    const html = buildWorthWaitingVerdict({
      latest: { p: 30 },
      min: { price: 10 },
      avg: 15,
      currency: "ILS",
    });
    expect(html).toContain("₪15.00");
  });

  it("doesn't divide by zero when the tracked low is 0", () => {
    expect(() =>
      buildWorthWaitingVerdict({ latest: { p: 5 }, min: { price: 0 }, avg: 5, currency: "USD" })
    ).not.toThrow();
  });
});
