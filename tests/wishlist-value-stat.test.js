import { describe, it, expect, beforeEach, vi } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/dom-safety.js");
await import("../extension/lib/currency-format.js");
await import("../extension/lib/genres.js");
await import("../extension/lib/purchases.js");
await import("../extension/lib/game-status.js");
await import("../extension/lib/attachments.js");
await import("../extension/lib/achievements.js");
await import("../extension/content/toasts.js");
await import("../extension/tags/state.js");
await import("../extension/tags/features/tag-management.js");
await import("../extension/tags/features/games-list.js");
await import("../extension/tags/features/filter-builder.js");
await import("../extension/tags/features/stats.js");
await import("../extension/tags/features/export-import.js");
await import("../extension/tags/features/recommendations.js");
await import("../extension/tags/features/achievements.js");
await import("../extension/tags/tags.js");

const state = window.GOGPlusTagsState;
const { renderStats } = window.GOGPlusTagsStats;

function resetState() {
  state.allTags = {};
  state.allNotes = {};
  state.allHistory = {};
  state.allWishlistSlugs = [];
  state.allPurchases = {};
  state.allStatus = {};
  state.monthlyBudget = null;
}

function findCard(panel, label) {
  return [...panel.querySelectorAll(".stat-card")].find(
    (c) => c.querySelector(".stat-label")?.textContent === label
  );
}

beforeEach(() => {
  globalThis.__resetChromeStores();
  resetState();
  document.body.innerHTML = `<div id="statsPanel"></div>`;
});

describe("wishlist value stat card", () => {
  it("sums current prices across wishlisted games with history", async () => {
    state.allWishlistSlugs = ["hades", "disco_elysium"];
    state.allHistory = {
      hades: [{ d: "d1", p: 30, c: "USD" }, { d: "d2", p: 20, c: "USD" }],
      disco_elysium: [{ d: "d1", p: 40, c: "USD" }, { d: "d2", p: 25, c: "USD" }],
      not_wishlisted: [{ d: "d1", p: 999, c: "USD" }], // not on the wishlist — excluded
    };
    await renderStats();
    const card = findCard(document.getElementById("statsPanel"), "Wishlist value");
    expect(card).toBeTruthy();
    expect(card.querySelector(".stat-value").textContent).toContain("45.00"); // 20 + 25
    expect(card.querySelector(".stat-sub").textContent).toContain("2 priced");
  });

  it("reports the gap to each game's tracked all-time low", async () => {
    state.allWishlistSlugs = ["hades"];
    state.allHistory = {
      hades: [{ d: "d1", p: 30, c: "USD" }, { d: "d2", p: 20, c: "USD" }, { d: "d3", p: 25, c: "USD" }],
    };
    // latest = 25, low = 20 -> 5.00 away from its low
    await renderStats();
    const card = findCard(document.getElementById("statsPanel"), "Wishlist value");
    expect(card.querySelector(".stat-sub").textContent).toContain("5.00");
    expect(card.querySelector(".stat-sub").textContent).toContain("away from all-time lows");
  });

  it("says 'already at tracked lows' when every wishlisted game is at its low", async () => {
    state.allWishlistSlugs = ["hades"];
    state.allHistory = { hades: [{ d: "d1", p: 30, c: "USD" }, { d: "d2", p: 20, c: "USD" }] };
    await renderStats();
    const card = findCard(document.getElementById("statsPanel"), "Wishlist value");
    expect(card.querySelector(".stat-value").textContent).toContain("20.00");
    expect(card.querySelector(".stat-sub").textContent).toContain("already at tracked lows");
  });

  it("prompts to visit games when no wishlisted game has price history yet", async () => {
    state.allWishlistSlugs = ["hades", "disco_elysium"];
    state.allHistory = {};
    await renderStats();
    const card = findCard(document.getElementById("statsPanel"), "Wishlist value");
    expect(card.querySelector(".stat-value").textContent.trim()).toBe("—");
    expect(card.querySelector(".stat-sub").textContent).toContain("visit wishlisted games");
  });

  it("shows a secondary line summing the cost at each game's own all-time low", async () => {
    state.allWishlistSlugs = ["hades", "disco_elysium"];
    state.allHistory = {
      hades: [{ d: "d1", p: 30, c: "USD" }, { d: "d2", p: 20, c: "USD" }],
      disco_elysium: [{ d: "d1", p: 40, c: "USD" }, { d: "d2", p: 25, c: "USD" }],
    };
    await renderStats();
    const card = findCard(document.getElementById("statsPanel"), "Wishlist value");
    const secondary = card.querySelector(".stat-sub-secondary");
    expect(secondary).toBeTruthy();
    expect(secondary.textContent).toContain("At all-time lows");
    expect(secondary.textContent).toContain("45.00"); // 20 + 25, both already at their low here
  });

  it("groups totals by currency rather than mixing them", async () => {
    state.allWishlistSlugs = ["hades", "disco_elysium"];
    state.allHistory = {
      hades: [{ d: "d1", p: 100, c: "ILS" }],
      disco_elysium: [{ d: "d1", p: 20, c: "USD" }],
    };
    await renderStats();
    const card = findCard(document.getElementById("statsPanel"), "Wishlist value");
    const text = card.querySelector(".stat-value").textContent;
    expect(text).toContain("100");
    expect(text).toContain("20.00");
  });
});

describe("library CSV export", () => {
  const { exportCsv } = window.GOGPlusTagsExportImport;

  beforeEach(() => {
    vi.restoreAllMocks();
    if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => "blob:mock");
    else vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  it("includes a status column alongside slug/tags/note", async () => {
    state.allTags = { hades: ["roguelike"] };
    state.allNotes = {};
    state.allStatus = { hades: "playing", stardew_valley: "backlog" };
    exportCsv();
    expect(URL.createObjectURL).toHaveBeenCalled();
    const blob = URL.createObjectURL.mock.calls[0][0];
    const text = await blob.text();
    expect(text).toContain("slug,tags,note,status");
    expect(text).toContain("hades");
    expect(text).toContain("playing");
    expect(text).toContain("stardew_valley");
    expect(text).toContain("backlog");
  });
});

describe("spending stat card", () => {
  it("shows a placeholder sub-line when no purchase has a price logged", async () => {
    state.allPurchases = { hades: "2026-01-10" }; // legacy string shape, no price
    await renderStats();
    const card = findCard(document.getElementById("statsPanel"), "Spending");
    expect(card.querySelector(".stat-value").textContent.trim()).toBe("—");
    expect(card.querySelector(".stat-sub").textContent).toContain("log a price");
  });

  it("sums logged prices across purchases, grouped by currency", async () => {
    state.allPurchases = {
      hades: { date: "2026-01-10", price: 19.99, currency: "USD" },
      celeste: { date: "2026-01-15", price: 14.99, currency: "USD" },
      disco_elysium: { date: "2026-01-20", price: 100, currency: "ILS" },
    };
    await renderStats();
    const card = findCard(document.getElementById("statsPanel"), "Spending");
    const text = card.querySelector(".stat-value").textContent;
    expect(text).toContain("34.98"); // 19.99 + 14.99 USD
    expect(text).toContain("100"); // ILS kept separate
    expect(card.querySelector(".stat-sub").textContent).toContain("3 purchases with price logged");
  });

  it("understands the legacy bare-string shape has no price (excluded from the sum)", async () => {
    state.allPurchases = { hades: "2026-01-10" };
    await renderStats();
    const card = findCard(document.getElementById("statsPanel"), "Spending");
    expect(card.querySelector(".stat-value").textContent.trim()).toBe("—");
  });

  it("compares this month's spend against a configured budget in the same currency", async () => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    state.allPurchases = {
      hades: { date: `${thisMonth}-05`, price: 30, currency: "USD" },
    };
    state.monthlyBudget = { amount: 50, currency: "USD" };
    await renderStats();
    const card = findCard(document.getElementById("statsPanel"), "Spending");
    expect(card.querySelector(".stat-sub").textContent).toContain("of");
    expect(card.querySelector(".stat-sub").textContent).toContain("budget this month");
    expect(card.classList.contains("stat-card--over-budget")).toBe(false);
  });

  it("flags the card as over-budget when this month's spend in the budget currency exceeds it", async () => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    state.allPurchases = {
      hades: { date: `${thisMonth}-05`, price: 60, currency: "USD" },
    };
    state.monthlyBudget = { amount: 50, currency: "USD" };
    await renderStats();
    const card = findCard(document.getElementById("statsPanel"), "Spending");
    expect(card.classList.contains("stat-card--over-budget")).toBe(true);
  });

  it("ignores purchases in a different currency than the budget for the budget check", async () => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    state.allPurchases = {
      hades: { date: `${thisMonth}-05`, price: 999, currency: "ILS" },
    };
    state.monthlyBudget = { amount: 50, currency: "USD" };
    await renderStats();
    const card = findCard(document.getElementById("statsPanel"), "Spending");
    expect(card.classList.contains("stat-card--over-budget")).toBe(false);
  });

  it("excludes purchases from prior months from the budget comparison", async () => {
    state.allPurchases = {
      hades: { date: "2020-01-05", price: 999, currency: "USD" }, // long past, not this month
    };
    state.monthlyBudget = { amount: 50, currency: "USD" };
    await renderStats();
    const card = findCard(document.getElementById("statsPanel"), "Spending");
    expect(card.classList.contains("stat-card--over-budget")).toBe(false);
  });
});

describe("static HTML export", () => {
  const { exportStaticHtml } = window.GOGPlusTagsExportImport;

  beforeEach(() => {
    vi.restoreAllMocks();
    if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => "blob:mock");
    else vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    window.alert = vi.fn();
  });

  it("alerts instead of exporting when nothing matches the current filter", () => {
    state.allTags = {};
    state.allNotes = {};
    state.allHistory = {};
    state.allStatus = {};
    exportStaticHtml();
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("No games match"));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("builds a self-contained, read-only HTML page listing the matching games", async () => {
    state.allTags = { hades: ["roguelike", "favorite"] };
    state.allNotes = { hades: "great **game**" };
    state.allStatus = { hades: "playing" };
    exportStaticHtml();
    expect(URL.createObjectURL).toHaveBeenCalled();
    const blob = URL.createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe("text/html");
    const html = await blob.text();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Hades");
    expect(html).toContain("roguelike");
    expect(html).toContain("<strong>game</strong>"); // note markdown rendered
    expect(html).toContain("playing");
    expect(html).toContain("https://www.gog.com/en/game/hades");
    // No <script> tags — a static, inert snapshot, not a live page.
    expect(html).not.toContain("<script");
  });

  it("never includes tags/notes from games outside the current filter", async () => {
    state.allTags = { hades: ["roguelike"], stardew_valley: ["cozy"] };
    state.allNotes = {};
    state.allStatus = {};
    state.activeTag = "roguelike";
    exportStaticHtml();
    const blob = URL.createObjectURL.mock.calls[0][0];
    const html = await blob.text();
    expect(html).toContain("Hades");
    expect(html).not.toContain("Stardew Valley");
    state.activeTag = null;
  });
});

describe("wishlist CSV export", () => {
  const { exportWishlistCsv } = window.GOGPlusTagsExportImport;

  beforeEach(() => {
    vi.restoreAllMocks();
    if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => "blob:mock");
    else vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    window.alert = vi.fn();
  });

  it("alerts instead of exporting when no wishlisted game has price history", () => {
    state.allWishlistSlugs = ["hades"];
    state.allHistory = {};
    exportWishlistCsv();
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("No wishlisted games"));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("builds a CSV row per priced wishlist game with title, price, and gap to the low", async () => {
    state.allWishlistSlugs = ["stardew_valley"];
    state.allHistory = {
      stardew_valley: [{ d: "d1", p: 30, c: "USD" }, { d: "d2", p: 20, c: "USD" }, { d: "d3", p: 24, c: "USD" }],
      not_on_wishlist: [{ d: "d1", p: 999, c: "USD" }],
    };
    exportWishlistCsv();
    expect(URL.createObjectURL).toHaveBeenCalled();
    const blob = URL.createObjectURL.mock.calls[0][0];
    const text = await blob.text();
    expect(text).toContain("slug,title,latest_price,currency,all_time_low,above_low_pct");
    expect(text).toContain("stardew_valley");
    expect(text).toContain("Stardew Valley");
    expect(text).toContain("24.00");
    expect(text).toContain("20.00");
    expect(text).toContain("20"); // (24-20)/20 = 20% above the low
    expect(text).not.toContain("not_on_wishlist");
  });

  it("adds the CSV export button to the wishlist-value card only when there's data to export", async () => {
    const { renderStats } = window.GOGPlusTagsStats;
    document.body.innerHTML = `<div id="statsPanel"></div>`;

    state.allWishlistSlugs = [];
    state.allHistory = {};
    await renderStats();
    expect(document.querySelector(".stat-card-action")).toBeNull();

    state.allWishlistSlugs = ["hades"];
    state.allHistory = { hades: [{ d: "d1", p: 30, c: "USD" }, { d: "d2", p: 20, c: "USD" }] };
    await renderStats();
    const btn = document.querySelector("#wishlistValueCard .stat-card-action");
    expect(btn).not.toBeNull();

    btn.click();
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});
