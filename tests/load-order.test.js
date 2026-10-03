import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

// Every other suite imports the modules it needs in an order the TEST author
// chose. None of them would notice if manifest.json or an HTML page listed a
// script before something it depends on at load time (utils.js destructures
// GOGPlusGogDom the moment it loads, for instance) — which kills the whole
// content script in a real browser. This loads each entry point's scripts in
// exactly the order the shipped file lists them.

const EXT = resolve(__dirname, "../extension");

function pageScripts(htmlFile) {
  const html = readFileSync(resolve(EXT, htmlFile), "utf8");
  return [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => resolve(EXT, dirname(htmlFile), m[1]));
}

async function loadInOrder(files) {
  vi.resetModules();
  for (const f of files) await import(/* @vite-ignore */ f);
}

beforeEach(() => {
  globalThis.__resetChromeStores();
  document.body.innerHTML = "";
});

describe("manifest.json content script", () => {
  const manifest = JSON.parse(readFileSync(resolve(EXT, "manifest.json"), "utf8"));
  const files = manifest.content_scripts[0].js.map((p) => resolve(EXT, p));

  it("lists only files that exist, once each", () => {
    expect(new Set(files).size).toBe(files.length);
    for (const f of files) expect(() => readFileSync(f)).not.toThrow();
  });

  it("loads cleanly in manifest order and boots every module", async () => {
    document.body.innerHTML = `<main></main>`;
    await loadInOrder(files);
    for (const g of [
      "GOGPlusGogDom",
      "GOGPlusNativeTheme",
      "GOGPlusKeyboardNav",
      "GOGPlusSysReq",
      "GOGPlusContentState",
      "GOGPlusContentUtils",
      "GOGPlusCurrencyFeature",
      "GOGPlusCardBadges",
      "GOGPlusGamePage",
      "GOGPlusWishlistFeature",
      "GOGPlusCommandPalette",
      "GOGPlusDeals",
      "GOGPlusKnowledge",
      "GOGPlusPanelChrome",
      "GOGPlusGameExtras",
      "GOGPlusCatalog",
      "GOGPlusReviewTools",
      "GOGPlusSiteSignals",
      "GOGPlusWishlistTools",
      "GOGPlusCatalogTools",
      "GOGPlusLibraryTools",
      "GOGPlusPack",
      "GOGPlusLinks",
      "GOGPlusLangNames",
    ]) {
      expect(window[g], `window.${g}`).toBeTruthy();
    }
  });

  it("ships the stylesheets it references", () => {
    for (const css of manifest.content_scripts[0].css) expect(() => readFileSync(resolve(EXT, css))).not.toThrow();
  });
});

describe("extension pages load their scripts in a working order", () => {
  for (const page of ["options/options.html", "tags/tags.html", "popup/popup.html", "onboarding/onboarding.html", "tour/tour.html"]) {
    it(page, async () => {
      const files = pageScripts(page);
      expect(files.length).toBeGreaterThan(0);
      for (const f of files) expect(() => readFileSync(f), f).not.toThrow();
      // Real DOM so scripts that wire up on load find their elements.
      document.body.innerHTML = readFileSync(resolve(EXT, page), "utf8").match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1].replace(/<script[\s\S]*?<\/script>/g, "") ?? "";
      await expect(loadInOrder(files)).resolves.toBeUndefined();
    });
  }
});

describe("background service worker", () => {
  it("imports resolve and it boots", async () => {
    vi.resetModules();
    await import("../extension/background/background.js");
    expect(self.GOGPlusSyncCore).toBeTruthy();
    expect(self.GOGPlusLibrarySearch).toBeTruthy();
    expect(self.GOGPlusNotifyPolicy).toBeTruthy();
    expect(self.GOGPlusFolderSyncCore).toBeTruthy();
    expect(self.GOGPlusBackupCrypto).toBeTruthy();
  });
});
