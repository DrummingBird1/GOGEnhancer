import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gamePageHtml } from "./helpers/fixtures.js";

const EXT = resolve(__dirname, "../extension");
const manifest = JSON.parse(readFileSync(resolve(EXT, "manifest.json"), "utf8"));
const FILES = manifest.content_scripts[0].js.map((f) => resolve(EXT, f));

async function boot() {
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => [] }));
  window.GOGPlusContentState?.observers.forEach((o) => o.disconnect());
  globalThis.__resetChromeStores();
  globalThis.__chromeListeners.onMessage.length = 0;
  vi.resetModules();
  for (const f of FILES) await import(/* @vite-ignore */ f);
  await vi.advanceTimersByTimeAsync(50);
}
const set = (area, items) => new Promise((r) => chrome.storage[area].set(items, r));

beforeEach(() => {
  vi.useFakeTimers();
  document.body.className = "productcard _prices-in-usd user-logged-in";
  window.history.replaceState({}, "", "/en/game/the_witcher_3?utm=x");
  document.body.innerHTML = gamePageHtml();
});
afterEach(() => {
  window.GOGPlusContentState?.observers.forEach((o) => o.disconnect());
  vi.useRealTimers();
  window.history.replaceState({}, "", "/");
});

describe("small extras on the game page", () => {
  it("copies a clean link without the query string", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await boot();
    await vi.advanceTimersByTimeAsync(600);
    const btn = [...document.querySelectorAll("#gog-plus-gamepanel button")].find((b) => b.textContent === "Copy clean link");
    expect(btn).toBeTruthy();
    btn.click();
    await vi.advanceTimersByTimeAsync(10);
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\/en\/game\/the_witcher_3$/));
  });

  it("a note template adds its line to the note and saves it", async () => {
    await boot();
    await vi.advanceTimersByTimeAsync(600);
    const tpl = document.querySelector('#gog-plus-gamepanel button[data-tpl="Wait for a sale"]');
    expect(tpl).toBeTruthy();
    tpl.click();
    expect(document.getElementById("gog-plus-note").value).toBe("Wait for a sale");
    await vi.advanceTimersByTimeAsync(600);
    const { notes } = await new Promise((r) => chrome.storage.local.get("notes", r));
    expect(notes.the_witcher_3).toBe("Wait for a sale");
  });

  it("'−25% of lowest' sets an alert from the recorded history", async () => {
    await boot();
    await set("local", { priceHistory: { the_witcher_3: [{ d: "2026-01-01", p: 8, c: "USD" }] } });
    await vi.advanceTimersByTimeAsync(600);
    await vi.advanceTimersByTimeAsync(50);
    document.querySelector("#gog-plus-alert-low").click();
    await vi.advanceTimersByTimeAsync(600);
    const all = await new Promise((r) => chrome.storage.local.get(null, r));
    const { priceAlerts } = all;
    expect(priceAlerts.the_witcher_3.threshold).toBe(21.9); // 8 USD x 3.65 (ILS) x 0.75
  });
});
