import { describe, it, expect, beforeEach, vi } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/dom-safety.js");
await import("../extension/lib/currency-format.js");
await import("../extension/lib/genres.js");
await import("../extension/lib/purchases.js");
await import("../extension/lib/ics.js");
await import("../extension/lib/markdown-export.js");
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

const state = window.GOGPlusTagsState;
const { exportIcs, exportMarkdown } = window.GOGPlusTagsExportImport;

let blobs;
let lastDownload;

beforeEach(() => {
  blobs = [];
  lastDownload = null;
  window.alert = vi.fn();
  URL.createObjectURL = vi.fn((b) => {
    blobs.push(b);
    return "blob:test";
  });
  URL.revokeObjectURL = vi.fn();
  // Capture the anchor click instead of letting happy-dom try to navigate.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
    lastDownload = this.download;
  });
  state.allTags = {};
  state.allNotes = {};
  state.allStatus = {};
  state.allPurchases = {};
  state.activeTag = null;
  state.searchTerm = "";
  state.allHistory = {};
  state.allWishlistSlugs = [];
});

const text = (blob) => blob.text();

describe("exportIcs", () => {
  it("downloads a calendar with an event per open refund window", async () => {
    const recent = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
    state.allPurchases = { hades: { date: recent }, old_game: "2020-01-01" };
    exportIcs();
    expect(lastDownload).toMatch(/^gog-plus-refund-deadlines-\d{4}-\d{2}-\d{2}\.ics$/);
    const ics = await text(blobs[0]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:GOG refund window closes: Hades");
    expect(ics).not.toContain("old_game"); // window long closed
    expect(blobs[0].type).toContain("text/calendar");
  });

  it("explains itself instead of downloading an empty calendar", () => {
    state.allPurchases = { old_game: "2020-01-01" };
    exportIcs();
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("No open refund windows"));
    expect(blobs).toHaveLength(0);
  });
});

describe("exportMarkdown", () => {
  beforeEach(() => {
    state.allTags = { hades: ["roguelike", "Great Soundtrack"], witcher_3: ["rpg"] };
    state.allNotes = { hades: "Best run so far:\nthird try." };
    state.allStatus = { hades: "playing" };
    state.allPurchases = { hades: "2026-09-01" };
  });

  it("downloads the filtered library grouped by status, with tags, notes and purchases", async () => {
    exportMarkdown();
    expect(lastDownload).toMatch(/^gog-plus-library-\d{4}-\d{2}-\d{2}\.md$/);
    const md = await text(blobs[0]);
    expect(md).toContain("# My GOG library");
    expect(md).toContain("## Playing");
    expect(md).toContain("[Hades](https://www.gog.com/en/game/hades) #roguelike #Great-Soundtrack — bought 2026-09-01");
    expect(md).toContain("  > Best run so far:\n  > third try.");
    expect(md).toContain("## No status");
    expect(blobs[0].type).toContain("text/markdown");
  });

  it("respects the active tag filter and names the file and heading after it", async () => {
    state.activeTag = "rpg";
    exportMarkdown();
    expect(lastDownload).toMatch(/^gog-plus-rpg-/);
    const md = await text(blobs[0]);
    expect(md).toContain("# rpg — GOG library");
    expect(md).toContain("Witcher 3");
    expect(md).not.toContain("Hades");
  });

  it("alerts instead of exporting when nothing matches", () => {
    state.allTags = {};
    state.allNotes = {};
    state.allStatus = {};
    state.allPurchases = {};
    exportMarkdown();
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("nothing to export"));
    expect(blobs).toHaveLength(0);
  });

  it("skips malformed purchase entries instead of crashing", async () => {
    state.allPurchases = { hades: { nonsense: true } };
    exportMarkdown();
    const md = await text(blobs[0]);
    expect(md).not.toContain("bought");
  });
});
