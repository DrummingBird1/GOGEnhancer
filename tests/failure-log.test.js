import { describe, it, expect, beforeEach, vi } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/i18n.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/changelog.js");
await import("../extension/lib/failure-log.js");

const L = () => window.GOGPlusFailureLog;
const NOW = Date.parse("2026-10-03T12:00:00Z");
const HOUR = 3600e3;
const getLocal = (k) => new Promise((r) => chrome.storage.local.get(k, r));

describe("add", () => {
  it("records a failure with its feature, message and the page type", () => {
    const list = L().add([], { feature: "game page", message: "x is undefined", page: "game" }, NOW);
    expect(list).toEqual([{ feature: "game page", message: "x is undefined", page: "game", count: 1, first: NOW, last: NOW }]);
  });

  it("merges the same failure seen again within hours into one entry", () => {
    let list = L().add([], { feature: "game page", message: "boom", page: "game" }, NOW);
    list = L().add(list, { feature: "game page", message: "boom", page: "game" }, NOW + HOUR);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ count: 2, first: NOW, last: NOW + HOUR });
  });

  it("keeps different messages, and a repeat after the merge window, as separate entries", () => {
    let list = L().add([], { feature: "a", message: "one" }, NOW);
    list = L().add(list, { feature: "a", message: "two" }, NOW + 1);
    list = L().add(list, { feature: "a", message: "one" }, NOW + L().MERGE_MS + 5);
    expect(list.map((e) => e.message)).toEqual(["one", "two", "one"]);
  });

  it("never grows past its cap, dropping the oldest", () => {
    let list = [];
    for (let i = 0; i < L().MAX_ENTRIES + 10; i++) list = L().add(list, { feature: `f${i}`, message: "m" }, NOW + i);
    expect(list).toHaveLength(L().MAX_ENTRIES);
    expect(list[list.length - 1].feature).toBe(`f${L().MAX_ENTRIES + 9}`);
  });

  it("trims long text and tolerates a missing list", () => {
    const list = L().add(undefined, { feature: "x".repeat(200), message: "y".repeat(500) }, NOW);
    expect(list[0].feature.length).toBe(60);
    expect(list[0].message.length).toBe(200);
  });

  it("does not modify the list it was given", () => {
    const before = [{ feature: "a", message: "b", page: "", count: 1, first: NOW, last: NOW }];
    L().add(before, { feature: "a", message: "b" }, NOW + 1);
    expect(before[0].count).toBe(1);
  });
});

describe("current / summarize", () => {
  const list = [
    { feature: "old", message: "m", page: "", count: 1, first: NOW - 3 * 24 * HOUR, last: NOW - 3 * 24 * HOUR },
    { feature: "Currency conversion", message: "m", page: "store", count: 3, first: NOW - HOUR, last: NOW - HOUR },
    { feature: "Game page", message: "n", page: "game", count: 1, first: NOW - 2 * HOUR, last: NOW - 2 * HOUR },
  ];

  it("counts only what failed in the last day", () => {
    expect(L().current(list, 0, NOW).map((e) => e.feature)).toEqual(["Currency conversion", "Game page"]);
  });

  it("hides what was dismissed", () => {
    expect(L().current(list, NOW - 90 * 60 * 1000, NOW).map((e) => e.feature)).toEqual(["Currency conversion"]);
    expect(L().current(list, NOW, NOW)).toEqual([]);
    expect(L().current(undefined, 0, NOW)).toEqual([]);
  });

  it("summarizes by feature with repeat counts", () => {
    expect(L().summarize(list.slice(1))).toBe("Currency conversion (3×), Game page");
  });
});

describe("the report", () => {
  const entries = [{ feature: "Game page", message: "Cannot read properties of null", page: "game", count: 4, first: NOW, last: NOW }];

  it("names the browser by family and major version only", () => {
    expect(L().browserOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.7444.60 Safari/537.36")).toBe("Chrome 142");
    expect(L().browserOf("Mozilla/5.0 ... Chrome/141.0.0.0 Safari/537.36 Edg/141.0.3537.57")).toBe("Chrome 141");
    expect(L().browserOf("Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0")).toBe("Firefox 130");
    expect(L().browserOf("")).toBe("unknown browser");
  });

  it("states what failed and promises no addresses or personal data", () => {
    const text = L().buildReport(entries, { version: "4.0.0", userAgent: "Chrome/142.0.1 Safari/537.36" });
    expect(text).toContain("GOG Enhancer v4.0.0 — something isn't working on gog.com");
    expect(text).toContain("Browser: Chrome 142");
    expect(text).toContain("- Game page: Cannot read properties of null — on a game page, 4 times");
    expect(text).toContain("Check this page");
    expect(text).toContain("no web addresses, game names or personal data");
    expect(text).not.toMatch(/https?:\/\//);
  });

  it("links to a prefilled GitHub issue — and only builds the link", () => {
    const url = L().issueUrl("line one\nline two & more", "4.0.0");
    expect(url.startsWith("https://github.com/DrummingBird1/GOGEnhancer/issues/new?")).toBe(true);
    const q = new URL(url).searchParams;
    expect(q.get("title")).toBe("Something stopped working (v4.0.0)");
    expect(q.get("body")).toBe("line one\nline two & more");
    expect(new URL(L().issueUrl("x".repeat(9000), "4.0.0")).searchParams.get("body").length).toBe(5500);
  });
});

describe("persist", () => {
  beforeEach(() => {
    globalThis.__resetChromeStores();
    L()._lastWrite.clear();
  });

  it("stores a failure locally", async () => {
    await L().persist("Game page", new Error("boom"), "game");
    const { failureLog } = await getLocal("failureLog");
    expect(failureLog).toHaveLength(1);
    expect(failureLog[0]).toMatchObject({ feature: "Game page", message: "boom", page: "game", count: 1 });
  });

  it("doesn't write the same failure again within minutes (a broken feature fails on every pass)", async () => {
    const spy = vi.spyOn(window.GOGPlusStorage, "set");
    for (let i = 0; i < 20; i++) await L().persist("Game page", new Error("boom"), "game");
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("never throws, even when storage does", async () => {
    const spy = vi.spyOn(window.GOGPlusStorage, "get").mockRejectedValue(new Error("storage gone"));
    await expect(L().persist("x", new Error("y"))).resolves.toBeUndefined();
    spy.mockRestore();
  });
});

describe("the popup notice", () => {
  const html = `
    <input type="checkbox" id="masterEnabled">
    <div id="whatsNew" hidden><span id="whatsNewVersion"></span><ul id="whatsNewList"></ul><button id="whatsNewDismiss"></button></div>
    <div id="rateStrip"></div><div id="dealsSection" hidden><ul id="dealsList"></ul></div>
    <div id="digestSection" hidden><ul id="digestList"></ul></div>
    <div id="brokenBanner" hidden><p id="brokenText"></p><button id="brokenCopy"></button><button id="brokenIssue"></button><button id="brokenDismiss"></button></div>
    <select id="targetCurrency"><option value="ILS">ILS</option></select><input type="number" id="vatPercent">
    <button id="refreshRates"></button><button id="openTags"></button><button id="openOptions"></button><button id="reload"></button>`;

  async function boot() {
    document.body.innerHTML = html;
    await import("../extension/popup/popup.js");
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await new Promise((r) => setTimeout(r, 0));
  }
  const setLocal = (o) => new Promise((r) => chrome.storage.local.set(o, r));

  beforeEach(() => {
    globalThis.__resetChromeStores();
    vi.resetModules();
    chrome.runtime.getManifest = () => ({ version: "4.0.0" });
  });

  it("stays hidden when nothing has failed", async () => {
    await boot();
    expect(document.getElementById("brokenBanner").hidden).toBe(true);
  });

  it("appears when a feature failed recently, naming it, with a report ready", async () => {
    await setLocal({ failureLog: [{ feature: "Game page", message: "boom", page: "game", count: 2, first: Date.now(), last: Date.now() }] });
    await boot();
    const box = document.getElementById("brokenBanner");
    expect(box.hidden).toBe(false);
    expect(document.getElementById("brokenText").textContent).toContain("Game page (2×) stopped working");
    expect(box.dataset.report).toContain("GOG Enhancer v4.0.0");
  });

  it("copies the report, opens the prefilled issue page, and can be dismissed for good", async () => {
    await setLocal({ failureLog: [{ feature: "Game page", message: "boom", page: "game", count: 1, first: Date.now(), last: Date.now() }] });
    await boot();
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    document.getElementById("brokenCopy").click();
    await new Promise((r) => setTimeout(r, 0));
    expect(writeText.mock.calls[0][0]).toContain("Game page: boom");

    chrome.tabs.create.mockClear();
    document.getElementById("brokenIssue").click();
    expect(chrome.tabs.create.mock.calls[0][0].url).toContain("https://github.com/DrummingBird1/GOGEnhancer/issues/new?");

    document.getElementById("brokenDismiss").click();
    await new Promise((r) => setTimeout(r, 5));
    expect(document.getElementById("brokenBanner").hidden).toBe(true);
    vi.resetModules();
    await boot();
    expect(document.getElementById("brokenBanner").hidden).toBe(true); // stays dismissed
  });
});
