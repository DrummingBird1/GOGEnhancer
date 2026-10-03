import { describe, it, expect } from "vitest";

await import("../extension/lib/note-history.js");

const N = window.GOGPlusNoteHistory;
const MIN = 60 * 1000;

describe("pushVersion", () => {
  it("keeps the replaced text as the newest version", () => {
    const h = N.pushVersion({}, "a", "first draft", 1000);
    expect(h).toEqual({ a: [{ t: 1000, text: "first draft" }] });
  });

  it("ignores empty text, repeats, and edits inside the same ten-minute session", () => {
    const h = { a: [{ t: 100 * MIN, text: "v1" }] };
    expect(N.pushVersion(h, "a", "", 200 * MIN)).toBe(h);
    expect(N.pushVersion(h, "a", "   \n", 200 * MIN)).toBe(h);
    expect(N.pushVersion(h, "a", undefined, 200 * MIN)).toBe(h);
    expect(N.pushVersion(h, "a", "v1", 200 * MIN)).toBe(h); // identical to the newest
    expect(N.pushVersion(h, "a", "v2", 105 * MIN)).toBe(h); // 5 minutes later: same session
    expect(N.pushVersion(h, "a", "v2", 111 * MIN).a.map((v) => v.text)).toEqual(["v2", "v1"]);
  });

  it("keeps at most five versions, newest first, without touching other games", () => {
    let h = { other: [{ t: 1, text: "keep" }] };
    for (let i = 0; i < 8; i++) h = N.pushVersion(h, "a", `v${i}`, (i + 1) * 20 * MIN);
    expect(h.a.map((v) => v.text)).toEqual(["v7", "v6", "v5", "v4", "v3"]);
    expect(h.other).toEqual([{ t: 1, text: "keep" }]);
  });
});

describe("recordChanges", () => {
  it("versions every note that changed or was removed, and nothing else", () => {
    const before = { a: "old a", b: "same", c: "will go", d: "" };
    const after = { a: "new a", b: "same", e: "brand new" };
    const h = N.recordChanges({}, before, after, 5000);
    expect(Object.keys(h).sort()).toEqual(["a", "c"]);
    expect(h.a[0]).toEqual({ t: 5000, text: "old a" });
    expect(h.c[0].text).toBe("will go");
  });

  it("returns the same history when nothing changed, and copes with missing sides", () => {
    const h = {};
    expect(N.recordChanges(h, { a: "x" }, { a: "x" }, 1)).toBe(h);
    expect(N.recordChanges(h, undefined, { a: "x" }, 1)).toBe(h);
    expect(N.recordChanges(h, { a: "x" }, undefined, 1).a[0].text).toBe("x");
  });
});

describe("ago", () => {
  it("describes how long ago in plain words", () => {
    const now = 10_000_000_000;
    expect(N.ago(now - 20_000, now)).toBe("just now");
    expect(N.ago(now - 5 * MIN, now)).toBe("5 min ago");
    expect(N.ago(now - 3 * 60 * MIN, now)).toBe("3h ago");
    expect(N.ago(now - 49 * 60 * MIN, now)).toBe("2d ago");
    expect(N.ago(Date.now() - MIN)).toBe("1 min ago");
  });
});
