import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getLocal = (keys) => new Promise((r) => chrome.storage.local.get(keys, r));
const setLocal = (items) => new Promise((r) => chrome.storage.local.set(items, r));
const removeLocal = (keys) => new Promise((r) => chrome.storage.local.remove(keys, r));

// The shared chrome shim's reset wipes storage.onChanged listeners, and
// background.js registers its own once at import — so each test re-imports it
// into a clean slate (this file is isolated, so the extra listeners that
// creates can't leak into other suites).
async function loadBackground() {
  globalThis.__resetChromeStores();
  vi.resetModules();
  globalThis.__chromeListeners.omniboxChanged.length = 0;
  globalThis.__chromeListeners.omniboxEntered.length = 0;
  await import("../extension/lib/defaults.js");
  await import("../extension/lib/storage.js");
  await import("../extension/lib/migrations.js");
  await import("../extension/background/background.js");
}

const metaOf = async () => (await getLocal({ syncMeta: {} })).syncMeta;

describe("sync timestamping", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await loadBackground();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1000);
  });
  afterEach(() => vi.useRealTimers());

  it("stamps a newly written record and tombstones a removed one", async () => {
    await setLocal({ tags: { a: ["x"] } });
    await vi.waitFor(async () => expect((await metaOf())["tags:a"]).toEqual({ t: 1000 }));

    vi.setSystemTime(2000);
    await setLocal({ tags: {} });
    await vi.waitFor(async () => expect((await metaOf())["tags:a"]).toEqual({ t: 2000, del: true }));
  });

  it("only restamps the records that actually changed", async () => {
    await setLocal({ notes: { a: "one", b: "two" } });
    await vi.waitFor(async () => expect(Object.keys(await metaOf())).toHaveLength(2));

    vi.setSystemTime(5000);
    await setLocal({ notes: { a: "one", b: "changed" } });
    await vi.waitFor(async () => expect((await metaOf())["notes:b"]).toEqual({ t: 5000 }));
    expect((await metaOf())["notes:a"]).toEqual({ t: 1000 });
  });

  it("handles changes to several synced keys in one write", async () => {
    await setLocal({ tags: { a: ["x"] }, gameStatus: { a: "playing" }, tagOrder: ["x"] });
    await vi.waitFor(async () => {
      const m = await metaOf();
      expect(m["tags:a"]).toBeTruthy();
      expect(m["gameStatus:a"]).toBeTruthy();
      expect(m["tagOrder:_"]).toBeTruthy();
    });
  });

  it("does not stamp a change that arrives together with syncMeta (a sync being applied)", async () => {
    const carried = { "tags:a": { t: 42 } };
    await setLocal({ tags: { a: ["synced"] }, syncMeta: carried });
    await new Promise((r) => setTimeout(r, 20));
    expect(await metaOf()).toEqual(carried);
  });

  it("ignores keys that aren't synced, and a no-op rewrite", async () => {
    await setLocal({ notifLog: { k: 1 }, wishlistCache: { discountedCount: 1, total: 2 } });
    await new Promise((r) => setTimeout(r, 20));
    expect(await metaOf()).toEqual({});

    await setLocal({ tags: { a: ["x"] } });
    await vi.waitFor(async () => expect((await metaOf())["tags:a"]).toBeTruthy());
    vi.setSystemTime(9000);
    await setLocal({ tags: { a: ["x"] } });
    await new Promise((r) => setTimeout(r, 20));
    expect((await metaOf())["tags:a"]).toEqual({ t: 1000 });
  });

  it("does not stamp changes from the sync storage area", async () => {
    await new Promise((r) => chrome.storage.sync.set({ theme: "light" }, r));
    await new Promise((r) => setTimeout(r, 20));
    expect(await metaOf()).toEqual({});
  });

  it("survives a failure while stamping and keeps stamping later changes", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const realGet = self.GOGPlusStorage.get;
    self.GOGPlusStorage.get = vi.fn().mockRejectedValueOnce(new Error("boom"));
    await setLocal({ tags: { a: ["x"] } });
    await vi.waitFor(() => expect(err).toHaveBeenCalledWith(expect.stringContaining("timestamping failed"), expect.any(Error)));
    self.GOGPlusStorage.get = realGet;

    await setLocal({ tags: { a: ["x"], b: ["y"] } });
    await vi.waitFor(async () => expect((await metaOf())["tags:b"]).toBeTruthy());
    err.mockRestore();
  });

  it("serializes rapid back-to-back changes so none is lost", async () => {
    await Promise.all([setLocal({ notes: { a: "1" } }), setLocal({ gameStatus: { b: "backlog" } }), removeLocal("tagColors")]);
    await vi.waitFor(async () => {
      const m = await metaOf();
      expect(m["notes:a"]).toBeTruthy();
      expect(m["gameStatus:b"]).toBeTruthy();
    });
  });
});

describe("omnibox", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await loadBackground();
  });

  it("registers a default suggestion and both listeners", () => {
    expect(chrome.omnibox.setDefaultSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringContaining("library") })
    );
    expect(globalThis.__chromeListeners.omniboxChanged).toHaveLength(1);
    expect(globalThis.__chromeListeners.omniboxEntered).toHaveLength(1);
  });

  it("suggests matching library games from local storage", async () => {
    await setLocal({
      tags: { the_witcher_3: ["rpg"], stardew_valley: ["cozy"] },
      gameStatus: { the_witcher_3: "playing" },
    });
    const suggest = vi.fn();
    await globalThis.__chromeListeners.omniboxChanged[0]("witcher", suggest);
    expect(suggest).toHaveBeenCalledWith([
      { content: "slug:the_witcher_3", description: "<match>The Witcher 3</match> <dim>#rpg · playing</dim>" },
    ]);
  });

  it("suggests nothing for a query that matches nothing", async () => {
    const suggest = vi.fn();
    await globalThis.__chromeListeners.omniboxChanged[0]("zzz", suggest);
    expect(suggest).toHaveBeenCalledWith([]);
  });

  it("opens a chosen game in the current tab", () => {
    globalThis.__chromeListeners.omniboxEntered[0]("slug:the_witcher_3", "currentTab");
    expect(chrome.tabs.update).toHaveBeenCalledWith({ url: "https://www.gog.com/en/game/the_witcher_3" });
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it("opens in a new foreground or background tab as asked, running a store search for free text", () => {
    globalThis.__chromeListeners.omniboxEntered[0]("half life", "newForegroundTab");
    expect(chrome.tabs.create).toHaveBeenLastCalledWith({
      url: "https://www.gog.com/en/games?query=half%20life",
      active: true,
    });
    globalThis.__chromeListeners.omniboxEntered[0]("half life", "newBackgroundTab");
    expect(chrome.tabs.create).toHaveBeenLastCalledWith({
      url: "https://www.gog.com/en/games?query=half%20life",
      active: false,
    });
  });

  it("loads fine in a browser without the omnibox API", async () => {
    const saved = chrome.omnibox;
    delete chrome.omnibox;
    await expect(loadBackground()).resolves.toBeUndefined();
    chrome.omnibox = saved;
  });
});
