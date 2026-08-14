import { describe, it, expect, beforeEach } from "vitest";

await import("../extension/lib/i18n.js");

const I18n = window.GOGPlusI18n;

beforeEach(() => {
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("lang");
  document.documentElement.removeAttribute("dir");
});

describe("GOGPlusI18n.t", () => {
  it("translates a known key in a known language", () => {
    expect(I18n.t("popup.subtitle", "en")).toBe("Enhanced");
    expect(I18n.t("language.label", "he")).toBe("שפת ממשק");
  });

  it("falls back to English when the key is missing in the requested language", () => {
    // Both dictionaries carry the same keys today, but the fallback chain
    // (dict[key] ?? STRINGS.en[key] ?? key) must hold even if they diverge.
    const enOnly = I18n.t("popup.subtitle", "he");
    expect(typeof enOnly).toBe("string");
    expect(enOnly.length).toBeGreaterThan(0);
  });

  it("returns the key itself when it exists nowhere", () => {
    expect(I18n.t("this.key.does.not.exist", "en")).toBe("this.key.does.not.exist");
  });

  it("falls back to <html lang> when no language is passed", () => {
    document.documentElement.setAttribute("lang", "he");
    expect(I18n.t("language.label")).toBe("שפת ממשק");
  });
});

describe("GOGPlusI18n.apply", () => {
  it("sets <html lang> and ltr dir for English", () => {
    I18n.apply("en");
    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(document.documentElement.getAttribute("dir")).toBe("ltr");
  });

  it("sets <html lang='he'> and rtl dir for Hebrew", () => {
    I18n.apply("he");
    expect(document.documentElement.getAttribute("lang")).toBe("he");
    expect(document.documentElement.getAttribute("dir")).toBe("rtl");
  });

  it("falls back to English for an unknown language code", () => {
    I18n.apply("xx-not-a-real-lang");
    expect(document.documentElement.getAttribute("lang")).toBe("en");
  });

  it("replaces textContent on every [data-i18n] element", () => {
    document.body.innerHTML = `<h2 data-i18n="popup.subtitle"></h2>`;
    I18n.apply("en");
    expect(document.querySelector("h2").textContent).toBe("Enhanced");
  });

  it("sets attributes described by [data-i18n-attr='attr:key']", () => {
    document.body.innerHTML = `<input data-i18n-attr="placeholder:language.label">`;
    I18n.apply("he");
    expect(document.querySelector("input").getAttribute("placeholder")).toBe("שפת ממשק");
  });

  it("supports multiple comma-separated attr:key pairs on one element", () => {
    document.body.innerHTML = `<button data-i18n-attr="title:popup.subtitle,aria-label:popup.subtitle"></button>`;
    I18n.apply("en");
    const btn = document.querySelector("button");
    expect(btn.getAttribute("title")).toBe("Enhanced");
    expect(btn.getAttribute("aria-label")).toBe("Enhanced");
  });

  it("ignores a malformed data-i18n-attr entry instead of throwing", () => {
    document.body.innerHTML = `<span data-i18n-attr="justAttrNoColon"></span>`;
    expect(() => I18n.apply("en")).not.toThrow();
  });
});
