import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// The repository front page exists in every interface language; the translations must keep the
// English structure (sections, tables, bullets, links) so a change to one is easy to port.
const ROOT = resolve(__dirname, "..");
const read = (f) => readFileSync(resolve(ROOT, f), "utf8").replace(/\r\n/g, "\n");
const CODES = ["he", "ru", "pl", "de", "fr", "es", "zh-CN", "pt-BR"];
const en = read("README.md");
const lines = (t, re) => t.split("\n").filter((l) => re.test(l)).length;
const shape = (t) => ({
  headings: lines(t, /^#/),
  tableRows: lines(t, /^\|/),
  links: (t.match(/\]\(https?:/g) || []).length,
});

describe("README in every language", () => {
  it("links every language from every README", () => {
    for (const f of ["README.md", ...CODES.map((c) => `README.${c}.md`)]) {
      const t = read(f);
      for (const c of CODES) expect(t, `${f} links README.${c}.md`).toContain(`href="README.${c}.md"`);
    }
  });

  it.each(CODES.filter((c) => c !== "he"))("README.%s.md keeps the English structure", (code) => {
    const f = `README.${code}.md`;
    expect(existsSync(resolve(ROOT, f))).toBe(true);
    const t = read(f);
    expect(shape(t)).toEqual(shape(en));
    expect(t).not.toMatch(/\{\{(?!\s*product\.title)/); // no leftover template placeholders
    expect(t).toContain("DrummingBird1/GOGEnhancer");
  });
});
