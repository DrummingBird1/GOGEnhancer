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
await import("../extension/lib/deals.js");
await import("../extension/lib/lang-names.js");
await import("../extension/lib/library-tools.js");
await import("../extension/lib/export-formats.js");
await import("../extension/lib/pack.js");
await import("../extension/lib/zip.js");
await import("../extension/lib/share-card.js");
await import("../extension/lib/sync-core.js");
await import("../extension/lib/backup-crypto.js");
await import("../extension/lib/folder-sync-core.js");
await import("../extension/content/toasts.js");
await import("../extension/tags/state.js");
await import("../extension/tags/features/tag-management.js");
await import("../extension/tags/features/games-list.js");
await import("../extension/tags/features/filter-builder.js");
await import("../extension/tags/features/stats.js");
await import("../extension/tags/features/export-import.js");
await import("../extension/tags/features/library-hub.js");

const state = window.GOGPlusTagsState;
const List = window.GOGPlusTagsGamesList;
const Hub = window.GOGPlusTagsLibraryHub;
const $ = (id) => document.getElementById(id);
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));
const getLocal = (keys) => new Promise((r) => chrome.storage.local.get(keys, r));

function resetState() {
  Object.assign(state, {
    allTags: {}, allNotes: {}, allHistory: {}, allWishlistSlugs: [], allPurchases: {}, allStatus: {}, allGenres: {},
    allFacts: {}, allOwned: {}, statusDates: {}, rates: { ILS: 4 }, targetCurrency: "USD", monthlyGoal: 0,
    preferredLanguages: [], uiLanguage: "en", tagColors: {}, tagOrder: [], searchTerm: "", activeTag: null, sortBy: "name",
    syncFolderName: "",
  });
}

beforeEach(() => {
  globalThis.__resetChromeStores();
  resetState();
  document.body.innerHTML = `<span id="counts"></span><div id="gameList"></div><div id="tagList"></div><section id="libraryHub"></section>`;
});

describe("search operators", () => {
  it("parses lang:, owned: and ends:", () => {
    expect(List.parseSearchQuery("lang:Hebrew").lang).toBe("hebrew");
    expect(List.parseSearchQuery("owned:YES").owned).toBe("yes");
    expect(List.parseSearchQuery("owned:maybe").owned).toBeNull();
    expect(List.parseSearchQuery("ends:3").ends).toBe(3);
    expect(List.parseSearchQuery("ends:<2.5").ends).toBe(2.5);
    expect(List.parseSearchQuery("ends:soon").ends).toBeNull();
    expect(List.parseSearchQuery("ends:0").ends).toBeNull();
  });

  const search = (q) => {
    state.searchTerm = q;
    return List.matchingSlugs();
  };

  it("lang: keeps games that support the language, whatever name the page used", () => {
    state.allTags = { a: ["x"], b: ["x"], c: ["x"] };
    state.allFacts = { a: { langs: { Hebrew: { a: false, t: true } } }, b: { langs: { Deutsch: { a: true, t: true } } } };
    expect(search("lang:hebrew")).toEqual(["a"]);
    expect(search("lang:german")).toEqual(["b"]);
    expect(search("lang:french")).toEqual([]);
  });

  it("owned: filters by the learned library, and owned:yes also lists owned games with nothing else known", () => {
    state.allTags = { a: ["x"], b: ["x"] };
    state.allOwned = { a: "2026-01-01", only_owned: "2026-01-02" };
    expect(search("owned:yes").sort()).toEqual(["a", "only_owned"]);
    expect(search("owned:no")).toEqual(["b"]);
    expect(search("")).toEqual(["a", "b"]); // a plain search never floods the list with the whole library
  });

  it("ends: finds offers ending within N days, never ended or unknown ones", () => {
    const now = Date.now();
    state.allTags = { soon: ["x"], later: ["x"], over: ["x"], none: ["x"] };
    state.allFacts = {
      soon: { pe: new Date(now + 2 * 86400e3).toISOString() },
      later: { pe: new Date(now + 9 * 86400e3).toISOString() },
      over: { pe: new Date(now - 1000).toISOString() },
    };
    expect(search("ends:3")).toEqual(["soon"]);
    expect(search("ends:30").sort()).toEqual(["later", "soon"]);
  });

  it("falls back to GOG's own first tag for an auto-tag suggestion when no genre is known", () => {
    state.allFacts = { mystery_game: { tags: ["Atmospheric", "Story Rich"] } };
    expect(List.genreSuggestionFor("mystery_game")).toBe("Atmospheric");
    expect(List.genreSuggestionFor("unknown_game")).toBeNull();
    state.allTags = { mystery_game: ["already"] };
    expect(List.genreSuggestionFor("mystery_game")).toBeNull();
  });

  it("offers the new operators in the filter builder", () => {
    document.body.insertAdjacentHTML("beforeend", '<input id="search"><div id="filterBuilderPopover" hidden></div>');
    state.preferredLanguages = ["Hebrew"];
    window.GOGPlusTagsFilterBuilder.toggleFilterBuilder();
    const tokens = [...document.querySelectorAll(".filter-builder-chip")].map((c) => c.dataset.token);
    expect(tokens).toEqual(expect.arrayContaining(["owned:yes", "owned:no", "ends:3", "lang:hebrew"]));
  });
});

describe("importing a tag pack (regression: it used to always throw)", () => {
  it("merges tags, notes, purchases and colours and saves them", async () => {
    const pack = window.GOGPlusPack.buildPack(
      { slugs: ["hades"], tags: { hades: ["rpg"] }, notes: { hades: "great" }, purchaseLog: { hades: "2026-01-01" }, tagColors: { rpg: "#ff0000" } },
      "Friend"
    );
    window.confirm = vi.fn(() => true);
    window.alert = vi.fn();
    state.allTags = { hades: ["mine"] };
    document.body.insertAdjacentHTML("beforeend", '<div id="statsPanel"></div><div id="yearReview"></div><div id="saleHeatmap"></div>');
    const file = { text: async () => JSON.stringify(pack) };
    await window.GOGPlusTagsExportImport.importPackFromFile({ target: { files: [file], value: "x" } });
    expect(window.alert).toHaveBeenCalledTimes(1);
    expect(window.alert.mock.calls[0][0]).toContain("1 tag added");
    expect(window.alert.mock.calls[0][0]).toContain("1 tag color added");
    expect(state.tagColors).toEqual({ rpg: "#ff0000" });
    const saved = await getLocal(["tags", "notes", "purchaseLog", "tagColors"]);
    expect(saved.tags).toEqual({ hades: ["mine", "rpg"] });
    expect(saved.notes).toEqual({ hades: "great" });
    expect(saved.purchaseLog.hades).toEqual({ date: "2026-01-01" });
  });

  it("refuses something that isn't a pack, saving nothing", async () => {
    window.alert = vi.fn();
    await window.GOGPlusTagsExportImport.importPackFromFile({ target: { files: [{ text: async () => '{"format":"other"}' }], value: "x" } });
    expect(window.alert.mock.calls[0][0]).toContain("wrong format");
    expect(await getLocal(["tags"])).toEqual({});
  });
});

describe("Library hub", () => {
  const seed = () => {
    Object.assign(state, {
      allTags: { hades: ["rpg", "co-op"], doom: ["fps"] },
      allStatus: { hades: "finished", doom: "backlog", quake: "backlog" },
      allPurchases: { hades: { date: `${new Date().getFullYear()}-01-10`, price: 10, currency: "USD" } },
      allHistory: { hades: [{ d: "2026-01-01", p: 30, c: "USD", b: 30 }, { d: "2026-01-10", p: 10, c: "USD", b: 30 }] },
      allOwned: { hades: "2026-01-10", doom: "2026-02-01" },
      allFacts: { hades: { title: "Hades", year: 2001, rating: { score: 4.9, count: 1 } }, doom: { year: 2020 } },
      allGenres: { hades: "rpg" },
      statusDates: { hades: { finished: `${new Date().toISOString().slice(0, 7)}-01` } },
      monthlyGoal: 2,
    });
  };

  let downloads;
  beforeEach(() => {
    downloads = [];
    URL.createObjectURL = vi.fn((b) => (downloads.push(b), "blob:x"));
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
      downloads.push(this.download);
    });
  });
  const btn = (text) => [...document.querySelectorAll("#libraryHub button")].find((b) => b.textContent === text);

  it("shows a goal bar, the savings estimate, the collector card and a Wrapped for the year", () => {
    seed();
    Hub.renderHub();
    const hub = $("libraryHub").textContent;
    expect(hub).toContain("Finished this month");
    expect(hub).toContain("1 of 2");
    expect($("libraryHub").querySelector('[role="progressbar"]').getAttribute("aria-valuenow")).toBe("50");
    expect(hub).toContain("What the sales saved you");
    expect(hub).toContain("≈ $20"); // 30 list − 10 paid
    expect(hub).toContain("Collector card");
    expect(hub).toContain("2 games");
    expect(hub).toContain("Your year in games");
    expect($("hubWrapped").textContent).toContain("bought");
  });

  it("leaves out the cards that have nothing to say", () => {
    Hub.renderHub();
    const hub = $("libraryHub").textContent;
    expect(hub).not.toContain("Finished this month");
    expect(hub).not.toContain("What the sales saved you");
    expect(hub).toContain("learns your library from the “IN LIBRARY” labels");
  });

  it("spins a weighted pick from the backlog and can start playing it", async () => {
    seed();
    Hub.renderHub();
    btn("Spin").click();
    const pick = $("hubRoulette").querySelector(".hub-pick");
    expect(["Doom", "Quake"]).toContain(pick.textContent);
    expect(pick.href).toMatch(/gog\.com\/en\/game\/(doom|quake)/);
    window.GOGPlusTagsGamesList.renderGames = vi.fn();
    btn("Start playing it").click();
    await tick(10);
    expect(Object.values((await getLocal(["gameStatus"])).gameStatus)).toContain("playing");
    expect(window.GOGPlusTagsGamesList.renderGames).toHaveBeenCalled();
  });

  it("says so when the backlog is empty", () => {
    state.allStatus = {};
    Hub.renderHub();
    btn("Spin").click();
    expect($("hubRoulette").textContent).toContain("Nothing is marked “backlog”");
  });

  it("downloads a Wrapped card as a PNG without any network", async () => {
    seed();
    Hub.renderHub();
    const blob = new Blob(["png"], { type: "image/png" });
    window.GOGPlusShareCard.toPng = vi.fn(async () => blob);
    [...$("hubWrapped").querySelectorAll("button")].find((b) => b.textContent === "Download card (PNG)").click();
    await tick(10);
    expect(window.GOGPlusShareCard.toPng).toHaveBeenCalled();
    expect(downloads.some((d) => typeof d === "string" && /^gog-wrapped-\d{4}\.png$/.test(d))).toBe(true);
    expect($("hubStatus").textContent).toContain("nothing was uploaded");
  });

  it("copies the year as text", async () => {
    seed();
    Hub.renderHub();
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    [...$("hubWrapped").querySelectorAll("button")].find((b) => b.textContent === "Copy as text").click();
    await tick(10);
    expect(writeText.mock.calls[0][0]).toContain(`${new Date().getFullYear()} in games`);
    expect(writeText.mock.calls[0][0]).toContain("1 games bought");
  });

  it("exports an Obsidian vault as a zip, a CSV, and Trello lines", async () => {
    seed();
    Hub.renderHub();
    btn("Obsidian vault (.zip)").click();
    const zip = downloads.find((d) => d instanceof Blob);
    expect(zip.type).toBe("application/zip");
    expect(downloads.some((d) => /^gog-enhancer-vault-.*\.zip$/.test(d))).toBe(true);
    downloads.length = 0;
    btn("Spreadsheet / Notion (.csv)").click();
    expect(downloads.some((d) => /\.csv$/.test(d))).toBe(true);
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    btn("Copy for Trello").click();
    await tick(10);
    expect(writeText.mock.calls[0][0]).toContain("Doom — backlog");
    expect(writeText.mock.calls[0][0]).not.toContain("Hades"); // only the backlog
  });

  it("copies a share link for the tags — tags and colours only", async () => {
    seed();
    state.tagColors = { rpg: "#ff0000" };
    state.allNotes = { hades: "PRIVATE NOTE" };
    Hub.renderHub();
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    btn("Copy a link to my tags").click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled(), { timeout: 3000 });
    await tick(20); // let the status line settle before the next test resets the page
    const url = writeText.mock.calls[0][0];
    expect(url).toMatch(/^https:\/\/www\.gog\.com\/en\/games#gogplus-pack=[zj]\./);
    const back = await window.GOGPlusPack.decodeShare(window.GOGPlusPack.shareValueFromHash(new URL(url).hash));
    expect(back.games.map((g) => g.slug).sort()).toEqual(["doom", "hades"]);
    expect(JSON.stringify(back)).not.toContain("PRIVATE");
  });

  it("asks to tag something first when there are no tags", async () => {
    Hub.renderHub();
    btn("Copy a link to my tags").click();
    await vi.waitFor(() => expect($("hubStatus").textContent).toContain("Tag some games first"), { timeout: 3000 });
  });

  it("reports a failed action instead of throwing", async () => {
    seed();
    Hub.renderHub();
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }, configurable: true });
    btn("Copy for Trello").click();
    await tick(10);
    expect($("hubStatus").textContent).toBe("denied");
    expect($("hubStatus").classList.contains("has-error")).toBe(true);
  });

  describe("sync row", () => {
    it("is absent without a sync folder and describes the last auto-sync otherwise", () => {
      Hub.renderHub({ sync: { ran: true, result: { pulled: false } } });
      expect(document.querySelector(".hub-sync")).toBeNull();
      state.syncFolderName = "Dropbox";
      Hub.renderHub({ sync: { ran: true, result: { pulled: true } }, backup: { ran: true, result: { file: "gog-enhancer-backup-2026-10-02.json" } } });
      expect(document.querySelector(".hub-sync").textContent).toContain("pulled newer data");
      expect(document.querySelector(".hub-sync").textContent).toContain("Backup written");
      for (const [sync, text] of [
        [{ ran: false, reason: "permission" }, "re-allow the folder"],
        [{ ran: false, reason: "passphrase" }, "passphrase"],
        [{ ran: false, reason: "recent" }, "a moment ago"],
        [{ ran: false, reason: "disk full" }, "Sync failed: disk full"],
        [{ ran: false, reason: "off" }, "Sync folder"],
        [null, "Sync folder"],
      ]) {
        Hub.renderHub({ sync });
        expect(document.querySelector(".hub-sync").textContent).toContain(text);
      }
    });

    it("offers the conflict review and a Sync now button", async () => {
      state.syncFolderName = "Dropbox";
      Hub.renderHub({ conflicts: 2 });
      chrome.runtime.openOptionsPage.mockClear();
      btn("2 sync conflicts to review").click();
      expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
      Hub.renderHub({ conflicts: 1 });
      expect(btn("1 sync conflict to review")).toBeTruthy();
      const core = window.GOGPlusFolderSyncCore;
      vi.spyOn(core, "syncNow").mockResolvedValue({ pulled: false, pushed: false, created: false });
      btn("Sync now").click();
      await tick(10);
      expect($("hubStatus").textContent).toBe("Already in sync.");
    });

    it("reloads the dashboard when a manual sync pulled data", async () => {
      state.syncFolderName = "Dropbox";
      Hub.renderHub();
      window.GOGPlusTagsBoot = { refresh: vi.fn(async () => {}) };
      vi.spyOn(window.GOGPlusFolderSyncCore, "syncNow").mockResolvedValue({ pulled: true, pushed: false, created: false });
      btn("Sync now").click();
      await tick(10);
      expect(window.GOGPlusTagsBoot.refresh).toHaveBeenCalled();
    });

    it("runs the automatic sync and backup on open and redraws with the outcome", async () => {
      state.syncFolderName = "Dropbox";
      const core = window.GOGPlusFolderSyncCore;
      vi.spyOn(core, "autoSync").mockResolvedValue({ ran: true, result: { pulled: true } });
      vi.spyOn(core, "autoBackup").mockResolvedValue({ ran: false, reason: "off" });
      window.GOGPlusTagsBoot = { refresh: vi.fn(async () => {}) };
      await Hub.runAutoSync();
      expect(core.autoSync).toHaveBeenCalledWith({ interactive: false });
      expect(window.GOGPlusTagsBoot.refresh).toHaveBeenCalled();
      expect(document.querySelector(".hub-sync").textContent).toContain("pulled");
    });
  });
});
