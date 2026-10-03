import { describe, it, expect, beforeEach, vi } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/options/tools-section.js");

const Tools = window.GOGPlusToolsSection;
const $ = (id) => document.getElementById(id);
const settle = () => new Promise((r) => setTimeout(r, 15));
const getSync = (keys) => new Promise((r) => chrome.storage.sync.get(keys, r));

const report = (over = {}) => ({
  extensionVersion: "4.0.0",
  path: "/en/game/cool_game",
  pageType: "game",
  framework: { angularJs: true, angular: false, reactLike: false, vueLike: false },
  observedRoot: "main",
  cards: { total: 3, withImage: 2 },
  prices: { count: 2, strategy: "class", sample: ["$9.99", "$19.99"] },
  title: { found: true, strategy: "legacy-class" },
  panelAnchor: "first-h1",
  applied: { cards: 2, convertedPrices: 2, gamePanel: true },
  warnings: [],
  ...over,
});

describe("pickTab", () => {
  it("picks the most recently used gog.com tab", () => {
    expect(Tools.pickTab([{ id: 1, lastAccessed: 5 }, { id: 2, lastAccessed: 9 }, { id: 3 }]).id).toBe(2);
  });

  it("works when the browser doesn't report lastAccessed, and skips tabs with no id", () => {
    expect(Tools.pickTab([{ id: 7 }]).id).toBe(7);
    expect(Tools.pickTab([{}, { id: undefined }])).toBeNull();
    expect(Tools.pickTab([])).toBeNull();
  });
});

describe("formatReport", () => {
  it("reports how fast the passes are, naming the slowest feature", () => {
    const text = Tools.formatReport(report({ perf: { passes: 7, lastMs: 3, maxMs: 41.6, features: { "card badges": { lastMs: 2, maxMs: 30.2 }, "game page": { lastMs: 1, maxMs: 4 } } } }));
    expect(text).toContain("Speed: 7 passes, slowest 42 ms (card badges 30 ms)");
    expect(Tools.formatReport(report())).not.toContain("Speed:");
  });

  it("summarises a healthy page", () => {
    const text = Tools.formatReport(report());
    expect(text).toContain("GOG Enhancer diagnostics (v4.0.0)");
    expect(text).toContain("Page: /en/game/cool_game (game)");
    expect(text).toContain("Framework hints: angularJs");
    expect(text).toContain('Prices: 2 found via class — e.g. "$9.99", "$19.99"');
    expect(text).toContain("Game title: found via legacy-class");
    expect(text).toContain("Panel position: via first-h1");
    expect(text).toContain("Applied so far: 2 cards, 2 converted prices, game panel yes");
    expect(text).toContain("No problems found on this page.");
  });

  it("lists problems, with correct singular/plural, and 'none' where nothing was found", () => {
    const one = Tools.formatReport(
      report({
        framework: {},
        observedRoot: null,
        title: { found: false, strategy: "none" },
        panelAnchor: null,
        prices: { count: 0, strategy: "none", sample: [] },
        applied: { cards: 0, convertedPrices: 0, gamePanel: false },
        warnings: ["The game title could not be read."],
      })
    );
    expect(one).toContain("Framework hints: none");
    expect(one).toContain("Observed root: none");
    expect(one).toContain("Prices: 0 found via none");
    expect(one).toContain("Game title: not found");
    expect(one).toContain("Panel position: not found");
    expect(one).toContain("1 issue found:\n  ! The game title could not be read.");

    const two = Tools.formatReport(report({ warnings: ["a", "b"] }));
    expect(two).toContain("2 issues found:");
  });
});

describe("requestReport", () => {
  beforeEach(() => {
    chrome.runtime.lastError = null;
  });

  it("asks the most recent gog.com tab and resolves with its report", async () => {
    chrome.tabs.query = vi.fn((_q, cb) => cb([{ id: 4, lastAccessed: 1 }, { id: 8, lastAccessed: 2 }]));
    chrome.tabs.sendMessage = vi.fn((_id, _msg, cb) => cb(report()));
    await expect(Tools.requestReport()).resolves.toEqual(report());
    expect(chrome.tabs.query).toHaveBeenCalledWith({ url: "https://www.gog.com/*" }, expect.any(Function));
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(8, { type: "gog-plus-diagnose" }, expect.any(Function));
  });

  it("explains when no gog.com tab is open", async () => {
    chrome.tabs.query = vi.fn((_q, cb) => cb([]));
    await expect(Tools.requestReport()).rejects.toThrow(/Open a gog.com page first/);
    chrome.tabs.query = vi.fn((_q, cb) => cb(undefined));
    await expect(Tools.requestReport()).rejects.toThrow(/Open a gog.com page first/);
  });

  it("explains how to recover when the tab has no content script (or doesn't answer)", async () => {
    chrome.tabs.query = vi.fn((_q, cb) => cb([{ id: 4 }]));
    chrome.tabs.sendMessage = vi.fn((_id, _msg, cb) => {
      chrome.runtime.lastError = { message: "Could not establish connection." };
      cb(undefined);
    });
    await expect(Tools.requestReport()).rejects.toThrow(/Reload the gog.com page/);
    chrome.runtime.lastError = null;
    chrome.tabs.sendMessage = vi.fn((_id, _msg, cb) => cb(undefined));
    await expect(Tools.requestReport()).rejects.toThrow(/Reload the gog.com page/);
  });
});

describe("page wiring", () => {
  const fixture = `
    <input type="checkbox" id="keyboardNav"><input type="checkbox" id="sysReqCheck">
    <div id="diagBlock">
      <button id="diagRun"></button><button id="diagCopy" hidden></button>
      <p id="diagStatus"></p><pre id="diagOutput" hidden></pre>
    </div>`;

  beforeEach(() => {
    globalThis.__resetChromeStores();
    document.body.innerHTML = fixture;
    chrome.runtime.lastError = null;
    chrome.tabs.query = vi.fn((_q, cb) => cb([{ id: 4 }]));
    chrome.tabs.sendMessage = vi.fn((_id, _msg, cb) => cb(report()));
  });

  it("does nothing on a page without the diagnostics block", async () => {
    document.body.innerHTML = "";
    await expect(Tools.init()).resolves.toBeUndefined();
  });

  it("loads the toggles from storage and persists changes", async () => {
    await new Promise((r) => chrome.storage.sync.set({ keyboardNav: true }, r));
    await Tools.init();
    expect($("keyboardNav").checked).toBe(true);
    expect($("sysReqCheck").checked).toBe(true); // default is on

    $("sysReqCheck").checked = false;
    $("sysReqCheck").dispatchEvent(new Event("change"));
    await settle();
    expect((await getSync("sysReqCheck")).sysReqCheck).toBe(false);
  });

  it("refreshes a toggle when its setting changes elsewhere", async () => {
    await Tools.init();
    expect($("keyboardNav").checked).toBe(false);
    await new Promise((r) => chrome.storage.sync.set({ keyboardNav: true }, r));
    await settle();
    expect($("keyboardNav").checked).toBe(true);
  });

  it("runs the check and shows the report with a copy button", async () => {
    await Tools.init();
    $("diagRun").click();
    await settle();
    expect($("diagStatus").textContent).toMatch(/Everything the extension looks for was found/);
    expect($("diagOutput").hidden).toBe(false);
    expect($("diagOutput").textContent).toContain("GOG Enhancer diagnostics (v4.0.0)");
    expect($("diagOutput").textContent).toContain("--- raw ---");
    expect($("diagCopy").hidden).toBe(false);
  });

  it("reports the issue count when something wasn't found", async () => {
    chrome.tabs.sendMessage = vi.fn((_id, _msg, cb) => cb(report({ warnings: ["x"] })));
    await Tools.init();
    $("diagRun").click();
    await settle();
    expect($("diagStatus").textContent).toBe("1 issue found — see below.");
    chrome.tabs.sendMessage = vi.fn((_id, _msg, cb) => cb(report({ warnings: ["x", "y"] })));
    $("diagRun").click();
    await settle();
    expect($("diagStatus").textContent).toBe("2 issues found — see below.");
  });

  it("shows the problem, hides stale output, and flags the error when the check can't run", async () => {
    await Tools.init();
    $("diagRun").click();
    await settle();
    chrome.tabs.query = vi.fn((_q, cb) => cb([]));
    $("diagRun").click();
    await settle();
    expect($("diagStatus").textContent).toMatch(/Open a gog.com page first/);
    expect($("diagStatus").classList.contains("has-error")).toBe(true);
    expect($("diagOutput").hidden).toBe(true);
    expect($("diagCopy").hidden).toBe(true);
  });

  it("copies the report to the clipboard, and says so when it can't", async () => {
    await Tools.init();
    $("diagRun").click();
    await settle();

    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    $("diagCopy").click();
    await settle();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("GOG Enhancer diagnostics"));
    expect($("diagStatus").textContent).toBe("Report copied.");

    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) },
      configurable: true,
    });
    $("diagCopy").click();
    await settle();
    expect($("diagStatus").textContent).toMatch(/Couldn't copy automatically/);
    expect($("diagStatus").classList.contains("has-error")).toBe(true);
  });
});
