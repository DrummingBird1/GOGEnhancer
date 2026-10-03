import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve(__dirname, "../extension/tour/tour.html"), "utf8");
const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, "");

await import("../extension/options/tools-section.js");
await import("../extension/tour/tour.js");

const T = window.GOGPlusTour;
const $ = (id) => document.getElementById(id);
const visible = () => [...document.querySelectorAll(".slide")].filter((s) => !s.hidden).map((s) => s.dataset.slide);

beforeEach(() => {
  document.body.innerHTML = body;
  window.close = vi.fn();
  T.init();
});

describe("the tour", () => {
  it("starts on the first slide with a dot per slide and Back disabled", () => {
    expect(visible()).toEqual(["0"]);
    expect(document.querySelectorAll(".tour-dot")).toHaveLength(5);
    expect($("tourPrev").disabled).toBe(true);
    expect(document.querySelector(".tour-dot.is-on").getAttribute("aria-selected")).toBe("true");
  });

  it("walks forward and back, and the last slide's button says Done", () => {
    $("tourNext").click();
    expect(visible()).toEqual(["1"]);
    expect($("tourPrev").disabled).toBe(false);
    $("tourPrev").click();
    expect(visible()).toEqual(["0"]);
    for (let i = 0; i < 4; i++) $("tourNext").click();
    expect(visible()).toEqual(["4"]);
    expect($("tourNext").textContent).toBe("Done");
    $("tourNext").click();
    expect(window.close).toHaveBeenCalled();
  });

  it("jumps with the dots and the arrow keys, and never leaves the range", () => {
    document.querySelectorAll(".tour-dot")[3].click();
    expect(visible()).toEqual(["3"]);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    expect(visible()).toEqual(["2"]);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(visible()).toEqual(["3"]);
    T.show(-5);
    expect(visible()).toEqual(["0"]);
    T.show(99);
    expect(visible()).toEqual(["4"]);
  });

  it("can be skipped and can open the settings", () => {
    $("tourSkip").click();
    expect(window.close).toHaveBeenCalled();
    $("tourOptions").click();
    expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
  });
});

describe("check my gog.com tab", () => {
  it("shows the report, and says when everything was found", async () => {
    chrome.tabs.query = vi.fn((_q, cb) => cb([{ id: 7, lastAccessed: 1 }]));
    chrome.tabs.sendMessage = vi.fn((_id, _msg, cb) =>
      cb({
        extensionVersion: "4.0.0", path: "/en/games", pageType: "store", framework: {}, observedRoot: "app-root",
        cards: { total: 4, withImage: 4 }, prices: { count: 3, strategy: "site-hooks", sample: ["$1"] },
        title: { found: false, strategy: "none" }, panelAnchor: null, applied: { cards: 4, convertedPrices: 3, gamePanel: false }, warnings: [],
      })
    );
    $("tourCheck").click();
    await new Promise((r) => setTimeout(r, 10));
    expect($("tourCheckOutput").hidden).toBe(false);
    expect($("tourCheckOutput").textContent).toContain("Game cards: 4 found");
    expect($("tourCheckStatus").textContent).toContain("Everything the extension looks for was found");
  });

  it("counts warnings, and explains when there is no gog.com tab or it doesn't answer", async () => {
    chrome.tabs.query = vi.fn((_q, cb) => cb([{ id: 7 }]));
    chrome.tabs.sendMessage = vi.fn((_id, _msg, cb) =>
      cb({
        extensionVersion: "4", path: "/", pageType: "home", framework: {}, observedRoot: null, cards: { total: 0, withImage: 0 },
        prices: { count: 0, strategy: "none", sample: [] }, title: { found: false }, panelAnchor: null, applied: { cards: 0, convertedPrices: 0, gamePanel: false },
        warnings: ["No game cards"],
      })
    );
    $("tourCheck").click();
    await new Promise((r) => setTimeout(r, 10));
    expect($("tourCheckStatus").textContent).toContain("1 thing to look at");

    chrome.tabs.query = vi.fn((_q, cb) => cb([]));
    $("tourCheck").click();
    await new Promise((r) => setTimeout(r, 10));
    expect($("tourCheckStatus").textContent).toContain("Open a gog.com page first");
    expect($("tourCheckStatus").classList.contains("has-error")).toBe(true);
    expect($("tourCheckOutput").hidden).toBe(true);
  });
});
