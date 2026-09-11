import { describe, it, expect, beforeEach, vi } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/dom-safety.js");
await import("../extension/lib/currency-format.js");
await import("../extension/lib/genres.js");
await import("../extension/lib/game-status.js");
await import("../extension/tags/state.js");
await import("../extension/tags/features/tag-management.js");
await import("../extension/tags/features/games-list.js");
await import("../extension/tags/features/stats.js");
await import("../extension/tags/features/export-import.js");
await import("../extension/tags/features/recommendations.js");
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
