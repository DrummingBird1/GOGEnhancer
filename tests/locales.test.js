import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

// The store dashboard offers a per-language listing only for the languages the package
// itself carries in _locales — so these folders are what makes "Add translation" appear.
const EXT = resolve(__dirname, "../extension");
const manifest = JSON.parse(readFileSync(resolve(EXT, "manifest.json"), "utf8"));
const dirs = readdirSync(resolve(EXT, "_locales"));

describe("_locales", () => {
  it("the manifest points at its description and names a default locale that exists", () => {
    expect(manifest.description).toBe("__MSG_extDescription__");
    expect(dirs).toContain(manifest.default_locale);
  });

  it("covers the nine interface languages", () => {
    expect(dirs.sort()).toEqual(["de", "en", "es", "fr", "he", "pl", "pt_BR", "ru", "zh_CN"]);
  });

  it.each(["de", "en", "es", "fr", "he", "pl", "pt_BR", "ru", "zh_CN"])("%s has a description within the store's 132 characters", (code) => {
    const m = JSON.parse(readFileSync(resolve(EXT, "_locales", code, "messages.json"), "utf8"));
    const text = m.extDescription.message;
    expect(text.length).toBeGreaterThan(20);
    expect(text.length).toBeLessThanOrEqual(132);
  });
});
