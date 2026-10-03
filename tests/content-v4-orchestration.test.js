import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gridHtml, gamePageHtml } from "./helpers/fixtures.js";

// content.js boots itself on import, so each test boots a fresh module graph —
// this time the WHOLE manifest list, to exercise the v4 wiring end to end.
const EXT = resolve(__dirname, "../extension");
const manifest = JSON.parse(readFileSync(resolve(EXT, "manifest.json"), "utf8"));
const FILES = manifest.content_scripts[0].js.map((f) => resolve(EXT, f));

async function boot() {
  // The game page asks CheapShark for prices; there is no network in tests.
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => [] }));
  window.GOGPlusContentState?.observers.forEach((o) => o.disconnect());
  globalThis.__resetChromeStores();
  globalThis.__chromeListeners.onMessage.length = 0;
  vi.resetModules();
  for (const f of FILES) await import(/* @vite-ignore */ f);
  await vi.advanceTimersByTimeAsync(50);
}

const html = document.documentElement;
const set = (area, items) => new Promise((r) => chrome.storage[area].set(items, r));
const state = () => window.GOGPlusContentState;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
  document.body.className = "";
  html.removeAttribute("style");
  html.className = "";
  window.history.replaceState({}, "", "/en/games");
});
afterEach(() => {
  window.GOGPlusContentState?.observers.forEach((o) => o.disconnect());
  vi.useRealTimers();
  window.history.replaceState({}, "", "/");
});

describe("per-feature failure isolation", () => {
  it("keeps running the features after one that throws, and records the failure", async () => {
    document.body.innerHTML = gridHtml([{ slug: "a", owned: true }]);
    await boot();
    await set("sync", { theme: "neon" });
    const real = window.GOGPlusCardBadges.applyCardBadges;
    // content.js captured applyCardBadges by reference at load; break the one
    // module that runs mid-list and check what still happens after it.
    const k = window.GOGPlusKnowledge;
    const spy = vi.spyOn(k, "learnOwnership");
    window.GOGPlusCurrency.detect = () => {
      throw new Error("detect exploded");
    };
    window.history.replaceState({}, "", "/en/games?x=1");
    // trigger a pass through a harmless setting change
    await set("sync", { calmMode: true });
    await vi.advanceTimersByTimeAsync(10);
    expect(state().failures["currency detection"]).toMatchObject({ count: expect.any(Number), message: "detect exploded" });
    expect(spy).toHaveBeenCalled(); // a later feature still ran
    // …and the failure was kept locally, so the popup can say something broke.
    const stored = await new Promise((r) => chrome.storage.local.get("failureLog", r));
    expect(stored.failureLog).toHaveLength(1);
    expect(stored.failureLog[0]).toMatchObject({ feature: "currency detection", message: "detect exploded", page: "store" });
    expect(real).toBeTypeOf("function");
  });

  it("catches a rejected promise from an async feature", async () => {
    window.history.replaceState({}, "", "/en/game/x");
    document.body.innerHTML = gamePageHtml();
    await boot();
    window.GOGPlusKnowledge.recordGameFacts = () => Promise.reject(new Error("storage full"));
    await set("sync", { calmMode: true });
    await vi.advanceTimersByTimeAsync(50);
    // enhanceGamePage awaits recordGameFacts; the rejection must not escape as an unhandled error
    expect(state().failures["game page"]?.message).toBe("storage full");
  });

  it("includes the failures in the 'Check this page' report", async () => {
    await boot();
    state().failures = { "card badges": { count: 2, message: "x", at: 1 } };
    const respond = vi.fn();
    globalThis.__chromeListeners.onMessage[0]({ type: "gog-plus-diagnose" }, {}, respond);
    expect(respond.mock.calls[0][0].featureFailures).toEqual({ "card badges": { count: 2, message: "x", at: 1 } });
  });
});

describe("look and feel", () => {
  it("applies calm mode, a colour-vision palette and the text size, and removes them again", async () => {
    await boot();
    await set("sync", { calmMode: true, palette: "deuteranopia", uiScale: 1.25 });
    await vi.advanceTimersByTimeAsync(10);
    expect(html.classList.contains("gog-plus-calm")).toBe(true);
    expect(html.classList.contains("gog-plus-palette--deuteranopia")).toBe(true);
    expect(html.style.getPropertyValue("--gp-scale")).toBe("1.25");
    await set("sync", { calmMode: false, palette: "default", uiScale: 1 });
    await vi.advanceTimersByTimeAsync(10);
    expect(html.classList.contains("gog-plus-calm")).toBe(false);
    expect([...html.classList].some((c) => c.startsWith("gog-plus-palette--"))).toBe(false);
    expect(html.style.getPropertyValue("--gp-scale")).toBe("");
  });

  it("clamps an absurd text size", async () => {
    await boot();
    await set("sync", { uiScale: 9 });
    await vi.advanceTimersByTimeAsync(10);
    expect(html.style.getPropertyValue("--gp-scale")).toBe("1.6");
  });

  it("plain look drops the injected styling and keeps the features, then restores them", async () => {
    await boot();
    await set("sync", { designInjection: true, cleanLayout: true, dyslexiaFont: true, theme: "neon" });
    await vi.advanceTimersByTimeAsync(10);
    expect(html.classList.contains("gog-plus-design")).toBe(true);
    await set("sync", { plainLook: true });
    await vi.advanceTimersByTimeAsync(10);
    expect(html.classList.contains("gog-plus-plain")).toBe(true);
    for (const c of ["gog-plus-design", "gog-plus-clean", "gog-plus-skeletons", "gog-plus-dyslexia-font"]) {
      expect(html.classList.contains(c), c).toBe(false);
    }
    expect(html.classList.contains("gog-plus-theme--native")).toBe(true);
    expect(html.classList.contains("gog-plus-disabled")).toBe(false);
    await set("sync", { plainLook: false });
    await vi.advanceTimersByTimeAsync(10);
    expect(html.classList.contains("gog-plus-design")).toBe(true);
    expect(html.classList.contains("gog-plus-dyslexia-font")).toBe(true);
    expect(html.classList.contains("gog-plus-theme--neon")).toBe(true);
  });
});

describe("storage changes", () => {
  it("a data-only change does not tear down and rebuild what is on the page", async () => {
    document.body.innerHTML = '<span class="gog-plus-conv-note">≈ ₪10</span><div class="gog-plus-card-done"></div>';
    await boot();
    await set("local", { ownedSlugs: { a: "2026-01-01" } });
    await vi.advanceTimersByTimeAsync(10);
    expect(document.querySelector(".gog-plus-conv-note")).not.toBeNull();
    expect(document.querySelector(".gog-plus-card-done")).not.toBeNull();
    // while a feature toggle still takes the full clean-and-rebuild path
    await set("sync", { refundBadge: false });
    await vi.advanceTimersByTimeAsync(10);
    expect(document.querySelector(".gog-plus-conv-note")).toBeNull();
  });

  it("tells interested features about data written elsewhere", async () => {
    await boot();
    const seen = [];
    document.addEventListener("gog-plus:data", (e) => seen.push(e.detail.key));
    await set("local", { notInterested: { a: "x" } });
    expect(seen).toContain("notInterested");
  });

  it("new facts about a game rebuild only the insights panel", async () => {
    window.history.replaceState({}, "", "/en/game/the_witcher_3");
    document.body.className = "productcard _prices-in-usd user-logged-in";
    document.body.innerHTML = gamePageHtml();
    await boot();
    await vi.advanceTimersByTimeAsync(400);
    const first = document.getElementById("gog-plus-gamepanel");
    expect(first).not.toBeNull();
    await set("local", { gameFacts: { the_witcher_3: { t: 1, title: "x" } } });
    await vi.advanceTimersByTimeAsync(400);
    expect(document.getElementById("gog-plus-gamepanel")).not.toBe(first);
  });
});

describe("following the site's light / dark mode", () => {
  it("re-samples the native theme when the page's colours change", async () => {
    html.style.backgroundColor = "rgb(20, 20, 24)";
    document.body.style.color = "rgb(235, 235, 240)";
    await boot();
    await set("sync", { theme: "native" });
    await vi.advanceTimersByTimeAsync(10);
    expect(html.classList.contains("gog-plus-theme--light")).toBe(false);
    // the site flips to a light theme
    html.style.backgroundColor = "rgb(250, 250, 250)";
    document.body.style.color = "rgb(20, 20, 20)";
    await vi.advanceTimersByTimeAsync(1500);
    expect(html.classList.contains("gog-plus-theme--light")).toBe(true);
  });

  it("does not re-run on its own class changes (no feedback loop)", async () => {
    await boot();
    await set("sync", { theme: "native" });
    await vi.advanceTimersByTimeAsync(10);
    const detect = vi.spyOn(window.GOGPlusCurrency, "detect");
    html.classList.add("gog-plus-something");
    html.classList.remove("gog-plus-something");
    await vi.advanceTimersByTimeAsync(2000);
    expect(detect).not.toHaveBeenCalled();
  });

  it("ignores page colour changes unless a theme that follows the site is in use", async () => {
    await boot();
    await set("sync", { theme: "neon" });
    await vi.advanceTimersByTimeAsync(10);
    const detect = vi.spyOn(window.GOGPlusCurrency, "detect");
    html.style.backgroundColor = "rgb(250, 250, 250)";
    await vi.advanceTimersByTimeAsync(2000);
    expect(detect).not.toHaveBeenCalled();
  });
});

describe("route changes", () => {
  it("removes the catalog bar when leaving the catalog", async () => {
    document.body.innerHTML = gridHtml([{ slug: "a" }]);
    await boot();
    await vi.advanceTimersByTimeAsync(400);
    expect(document.getElementById("gog-plus-catbar")).not.toBeNull();
    window.history.replaceState({}, "", "/en/game/a");
    document.body.innerHTML = '<h1 class="productcard-basics__title">A</h1>';
    await vi.advanceTimersByTimeAsync(1500);
    expect(document.getElementById("gog-plus-catbar")).toBeNull();
  });
});
