import { describe, it, expect } from "vitest";

await import("../extension/lib/lang-names.js");

const L = window.GOGPlusLangNames;

describe("preferredNames", () => {
  it("uses the explicit list when there is one", () => {
    expect(L.preferredNames([" Hebrew ", "", "Greek"], "en")).toEqual(["Hebrew", "Greek"]);
  });
  it("falls back to the UI language, then English", () => {
    expect(L.preferredNames([], "he")).toEqual(["Hebrew"]);
    expect(L.preferredNames(null, "de")).toEqual(["German"]);
    expect(L.preferredNames(undefined, "xx")).toEqual(["English"]);
    expect(L.preferredNames()).toEqual(["English"]);
  });
});

describe("findLanguage", () => {
  const table = { English: {}, Deutsch: {}, "עברית": {} };
  it("matches a name however the page spelled it", () => {
    expect(L.findLanguage(table, "German")).toBe("Deutsch");
    expect(L.findLanguage(table, "deutsch")).toBe("Deutsch");
    expect(L.findLanguage(table, "Hebrew")).toBe("עברית");
    expect(L.findLanguage(table, "English")).toBe("English");
  });
  it("returns null when the game doesn't have it", () => {
    expect(L.findLanguage(table, "French")).toBeNull();
    expect(L.findLanguage(table, "Klingon")).toBeNull();
    expect(L.findLanguage(null, "French")).toBeNull();
  });
  it("matches an unknown language only by its own name", () => {
    expect(L.findLanguage({ Greek: {} }, "greek")).toBe("Greek");
  });
});
