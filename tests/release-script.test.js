import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isVersion, compareVersions, setManifestVersion, addChangelogJsStub, addChangelogHtmlStub, leftoverTodos } from "../scripts/release.mjs";

const ROOT = resolve(__dirname, "..");

describe("versions", () => {
  it("accepts only X.Y.Z", () => {
    expect(isVersion("4.1.0")).toBe(true);
    for (const bad of ["4.1", "v4.1.0", "4.1.0-beta", "", "a.b.c"]) expect(isVersion(bad)).toBe(false);
  });

  it("compares numerically", () => {
    expect(compareVersions("4.10.0", "4.9.0")).toBe(1);
    expect(compareVersions("4.0.0", "4.0.0")).toBe(0);
    expect(compareVersions("3.9.9", "4.0.0")).toBe(-1);
  });

  it("rewrites only the manifest's version", () => {
    const text = '{\n  "name": "x",\n  "version": "4.0.0",\n  "manifest_version": 3\n}';
    expect(setManifestVersion(text, "4.1.0")).toBe('{\n  "name": "x",\n  "version": "4.1.0",\n  "manifest_version": 3\n}');
    expect(() => setManifestVersion("{}", "4.1.0")).toThrow(/version/);
  });
});

describe("changelog stubs, against the real files", () => {
  const js = readFileSync(resolve(ROOT, "extension/lib/changelog.js"), "utf8");
  const html = readFileSync(resolve(ROOT, "docs/changelog.html"), "utf8");

  it("adds a js entry that the popup's version helper would find, once", () => {
    const next = addChangelogJsStub(js, "9.9.9");
    expect(next).toContain('"9.9.9": [');
    expect(next).toContain("TODO");
    expect(addChangelogJsStub(next, "9.9.9")).toBe(next);
    // still valid JavaScript
    expect(() => new Function(next.replace("window.GOGPlusChangelog", "globalThis.__x"))).not.toThrow();
  });

  it("adds an html entry above the current one and demotes it — with the badge on the new one only", () => {
    const next = addChangelogHtmlStub(html, "9.9.9", "The title");
    expect(next).toContain(">v9.9.9<");
    expect(next).toContain("The title");
    expect((next.match(/cl-badge-current/g) || []).length).toBe((html.match(/cl-badge-current/g) || []).length); // moved, not duplicated
    expect((next.match(/class="cl-entry is-current"/g) || []).length).toBe(1);
    expect(next.indexOf(">v9.9.9<")).toBeLessThan(next.indexOf(">v4.0.0<"));
    expect(addChangelogHtmlStub(next, "9.9.9", "x")).toBe(next);
  });

  it("flags every TODO the stubs leave behind — and none in the shipped files", () => {
    expect(leftoverTodos(js, html)).toEqual([]);
    const todos = leftoverTodos(addChangelogJsStub(js, "9.9.9"), addChangelogHtmlStub(html, "9.9.9", "t"));
    expect(todos.length).toBeGreaterThanOrEqual(3);
    expect(todos.some((t) => t.startsWith("lib/changelog.js"))).toBe(true);
    expect(todos.some((t) => t.startsWith("docs/changelog.html"))).toBe(true);
  });
});
