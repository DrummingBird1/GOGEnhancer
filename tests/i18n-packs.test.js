import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Languages added after the original seven are "packs": [english, translation] pairs
// that may cover only part of the text. These tests keep each pack honest: what it
// says is well formed, and what MUST be covered (the extension's own text inside
// gog.com pages, the popup's keyed strings) is.

const LANGS = { zh: "中文（简体）", pt: "Português (Brasil)" };
const EXT = resolve(__dirname, "../extension");
const PAIR = /\["((?:[^"\\]|\\.)*)", "((?:[^"\\]|\\.)*)"\]/g;
let T;
let I18N;
let contentRows;

beforeAll(async () => {
  await import("../extension/lib/i18n.js");
  await import("../extension/lib/i18n-pages.js");
  await import("../extension/lib/i18n-pages-content.js");
  T = window.GOGPlusPageI18n;
  I18N = window.GOGPlusI18n;
  contentRows = T.rows().map((r) => r[0]); // the content rows are the only ones loaded here
  for (const l of Object.keys(LANGS)) {
    await import(`../extension/lib/i18n-lang-${l}-content.js`);
    await import(`../extension/lib/i18n-lang-${l}.js`);
  }
});

const sample = (english) => english.replace(/\{n\}/g, "5").replace(/\{\}/g, "X");

describe.each(Object.keys(LANGS))("language pack %s", (lang) => {
  it("is registered with its name", () => {
    expect(I18N.LANGUAGES[lang]).toBe(LANGS[lang]);
    expect(T.languages()).toContain(lang);
  });

  it("translates every piece of the extension's in-page text", () => {
    const missing = contentRows.filter((e) => T.translate(sample(e), lang) === null);
    expect(missing, `${lang} has no translation for: ${missing.join(" | ")}`).toEqual([]);
  });

  it("has every keyed popup string the English has", () => {
    const keys = [...readFileSync(resolve(EXT, "popup/popup.html"), "utf8").matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
    const missing = [...new Set(keys)].filter((k) => I18N.t(k, lang) === I18N.t(k, "en") && k !== "popup.row.refresh");
    expect(missing, `${lang} popup keys left in English: ${missing.join(", ")}`).toEqual([]);
  });

  it("uses only the placeholders its English has, and fills them", () => {
    const text = ["-content", "", "-options", "-dashboard"].map((k) => readFileSync(resolve(EXT, `lib/i18n-lang-${lang}${k}.js`), "utf8")).join(" ");
    const rows = [...text.matchAll(PAIR)];
    expect(rows.length).toBeGreaterThan(200);
    for (const [, en, tr] of rows) {
      expect(tr.length, en).toBeGreaterThan(0);
      const slots = (en.match(/\{n\}|\{\}/g) || []).length;
      const used = new Set([...tr.matchAll(/\{(\d+)(?:#[^}]*)?\}/g)].map((m) => Number(m[1])));
      for (const i of used) expect(i, `"${en}" -> "${tr}" uses {${i}} but the English has ${slots} slot(s)`).toBeLessThanOrEqual(slots);
      expect(tr, `"${en}" left a literal {n} or {}`).not.toMatch(/\{n\}|\{\}/);
      expect([...new Set(tr.match(/<\d+>/g) || [])].sort(), `tags in "${en}"`).toEqual([...new Set(en.match(/<\d+>/g) || [])].sort());
    }
  });

  it("covers every row of the options page and the dashboard", async () => {
    for (const f of ["options", "options-messages", "dashboard", "dashboard-messages"]) await import(`../extension/lib/i18n-pages-${f}.js`);
    await import(`../extension/lib/i18n-lang-${lang}-options.js`);
    await import(`../extension/lib/i18n-lang-${lang}-dashboard.js`);
    const pageRows = T.rows().map((r) => r[0]).filter((e) => !contentRows.includes(e));
    const missing = pageRows.filter((e) => T.translate(sample(e), lang) === null);
    expect(missing, `${lang} has no translation for: ${missing.slice(0, 8).join(" | ")}`).toEqual([]);
  });

  it("fills a translated sentence with its numbers and amounts", () => {
    const out = T.translate("Showing 5 of 48", lang);
    expect(out).toMatch(/5/);
    expect(out).toMatch(/48/);
    expect(out).not.toMatch(/Showing/);
  });
});

describe("where the languages are offered", () => {
  it("the options page lists each one, and every page and the content scripts load each pack", () => {
    const html = readFileSync(resolve(EXT, "options/options.html"), "utf8");
    const manifest = JSON.parse(readFileSync(resolve(EXT, "manifest.json"), "utf8"));
    const scripts = manifest.content_scripts[0].js;
    for (const l of Object.keys(LANGS)) {
      expect(html).toContain(`<option value="${l}">`);
      expect(scripts).toContain(`lib/i18n-lang-${l}-content.js`);
      expect(readFileSync(resolve(EXT, "options/options.html"), "utf8")).toContain(`i18n-lang-${l}-options.js`);
      expect(readFileSync(resolve(EXT, "tags/tags.html"), "utf8")).toContain(`i18n-lang-${l}-dashboard.js`);
      for (const page of ["popup/popup.html", "options/options.html", "tags/tags.html", "onboarding/onboarding.html", "tour/tour.html"]) {
        expect(readFileSync(resolve(EXT, page), "utf8"), `${page} loads the ${l} pack`).toContain(`i18n-lang-${l}.js`);
      }
    }
  });
});
