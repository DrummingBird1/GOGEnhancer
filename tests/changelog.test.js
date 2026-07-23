import { describe, it, expect } from "vitest";

await import("../extension/lib/changelog.js");
const { compareVersions, versionsSince } = window.GOGPlusChangelog;

describe("compareVersions", () => {
  it("orders numerically, not lexicographically", () => {
    expect(compareVersions("2.9.0", "2.10.0")).toBe(-1);
    expect(compareVersions("2.10.0", "2.9.0")).toBe(1);
  });

  it("treats equal versions as equal", () => {
    expect(compareVersions("2.5.0", "2.5.0")).toBe(0);
  });

  it("treats a missing segment as 0", () => {
    expect(compareVersions("2.5", "2.5.0")).toBe(0);
    expect(compareVersions("2.5.1", "2.5")).toBe(1);
  });
});

describe("versionsSince", () => {
  const sample = { "2.4.0": ["a"], "2.5.0": ["b"], "2.6.0": ["c"] };

  it("returns only the current version on first run (no lastSeen)", () => {
    expect(versionsSince("", "2.6.0", sample)).toEqual(["2.6.0"]);
  });

  it("returns [] on first run if current has no changelog entry", () => {
    expect(versionsSince("", "9.9.9", sample)).toEqual([]);
  });

  it("returns every version strictly after lastSeen, up to current", () => {
    expect(versionsSince("2.4.0", "2.6.0", sample)).toEqual(["2.5.0", "2.6.0"]);
  });

  it("returns nothing once caught up", () => {
    expect(versionsSince("2.6.0", "2.6.0", sample)).toEqual([]);
  });

  it("skips versions with no changelog entry in the range", () => {
    expect(
      versionsSince("2.4.0", "2.6.0", { "2.4.0": ["a"], "2.6.0": ["c"] })
    ).toEqual(["2.6.0"]);
  });
});
