import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const { firefoxManifest, INCLUDE, GECKO_ID } = await import("../scripts/build-firefox.mjs");

const EXT = resolve(__dirname, "../extension");
const chrome = JSON.parse(readFileSync(resolve(EXT, "manifest.json"), "utf8"));

describe("the Firefox build", () => {
  const ff = firefoxManifest(chrome);

  it("swaps the service worker for a background page that loads the same module", () => {
    expect(chrome.background.service_worker).toBe("background/background.js");
    expect(ff.background).toEqual({ scripts: ["background/background.js"], type: "module" });
    expect(existsSync(resolve(EXT, ff.background.scripts[0]))).toBe(true);
  });

  it("carries an add-on id and says the developer receives no data", () => {
    expect(ff.browser_specific_settings.gecko.id).toBe(GECKO_ID);
    expect(ff.browser_specific_settings.gecko.data_collection_permissions).toEqual({ required: ["none"] });
    expect(parseFloat(ff.browser_specific_settings.gecko.strict_min_version)).toBeGreaterThanOrEqual(140);
  });

  it("changes nothing else — the same permissions, hosts, scripts and pages", () => {
    const { background: _b, browser_specific_settings: _s, ...rest } = ff;
    const { background: _c, ...chromeRest } = chrome;
    expect(rest).toEqual(chromeRest);
    // and the source manifest was not touched
    expect(chrome.browser_specific_settings).toBeUndefined();
  });

  it("does not mutate its input", () => {
    const copy = JSON.parse(JSON.stringify(chrome));
    firefoxManifest(chrome);
    expect(chrome).toEqual(copy);
  });

  it("ships the same files as build.ps1", () => {
    const ps = readFileSync(resolve(__dirname, "../build.ps1"), "utf8");
    const listed = [...ps.matchAll(/^\s+"([^"]+)",?\s*$/gm)].map((m) => m[1]);
    expect([...INCLUDE].sort()).toEqual(listed.sort());
  });
});
