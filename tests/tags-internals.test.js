import { describe, it, expect } from "vitest";

// tags.js is a plain top-level script (not an IIFE) that only wires up
// document.addEventListener("DOMContentLoaded", init) — it never calls init()
// itself, so importing it here for its function declarations doesn't trigger
// the dashboard's full render/bind cycle. See tags.html's real script order.
await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/dom-safety.js");
await import("../extension/lib/currency-format.js");
await import("../extension/tags/tags.js");

const { parseSearchQuery, slugToTitle, safeHexColor, renderMarkdown } =
  window.GOGPlusTagsInternals;

describe("slugToTitle", () => {
  it("title-cases underscore-separated slugs", () => {
    expect(slugToTitle("stardew_valley")).toBe("Stardew Valley");
    expect(slugToTitle("baldurs_gate_3")).toBe("Baldurs Gate 3");
  });

  it("handles a single-word slug", () => {
    expect(slugToTitle("hades")).toBe("Hades");
  });
});

describe("safeHexColor", () => {
  it("accepts valid #hex colors of every allowed length", () => {
    expect(safeHexColor("#fff")).toBe("#fff");
    expect(safeHexColor("#ffffff")).toBe("#ffffff");
    expect(safeHexColor("#ffffffff")).toBe("#ffffffff");
  });

  it("rejects non-hex and non-string input", () => {
    expect(safeHexColor("red")).toBe("");
    expect(safeHexColor("#gggggg")).toBe("");
    expect(safeHexColor(null)).toBe("");
    expect(safeHexColor(undefined)).toBe("");
  });

  it("rejects a CSS-injection attempt disguised as a color", () => {
    expect(safeHexColor("#fff; background:url(javascript:alert(1))")).toBe("");
  });
});

describe("parseSearchQuery", () => {
  it("returns empty defaults for an empty/falsy query", () => {
    const f = parseSearchQuery("");
    expect(f.tag).toBe(null);
    expect(f.plain).toBe("");
  });

  it("parses a tag: filter", () => {
    expect(parseSearchQuery("tag:RPG").tag).toBe("rpg");
  });

  it("parses lowest:</> and snapshots:</> comparisons", () => {
    expect(parseSearchQuery("lowest:<10").lowestLt).toBe(10);
    expect(parseSearchQuery("lowest:>5.5").lowestGt).toBe(5.5);
    expect(parseSearchQuery("snapshots:>3").snapshotsGt).toBe(3);
  });

  it("parses a since: filter only when it's a 4-digit year", () => {
    expect(parseSearchQuery("since:2023").since).toBe("2023");
    expect(parseSearchQuery("since:23").since).toBe(null);
  });

  it("ignores a malformed numeric comparison instead of throwing", () => {
    expect(() => parseSearchQuery("lowest:<abc")).not.toThrow();
    expect(parseSearchQuery("lowest:<abc").lowestLt).toBe(null);
  });

  it("collects non-filter tokens into `plain`, lowercased", () => {
    const f = parseSearchQuery("Cyberpunk tag:scifi 2077");
    expect(f.tag).toBe("scifi");
    expect(f.plain).toBe("cyberpunk 2077");
  });
});

describe("renderMarkdown", () => {
  it("returns empty string for empty input", () => {
    expect(renderMarkdown("")).toBe("");
    expect(renderMarkdown(null)).toBe("");
  });

  it("escapes raw HTML in the input before applying markdown", () => {
    expect(renderMarkdown("<img src=x onerror=alert(1)>")).not.toContain("<img");
  });

  it("renders bold, italic, and inline code", () => {
    expect(renderMarkdown("**bold**")).toBe("<strong>bold</strong>");
    expect(renderMarkdown("*italic*")).toBe("<em>italic</em>");
    expect(renderMarkdown("`code`")).toBe("<code>code</code>");
  });

  it("renders an http(s) link but drops a javascript: link (keeping the text)", () => {
    expect(renderMarkdown("[go](https://example.com)")).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">go</a>'
    );
    expect(renderMarkdown("[click](javascript:alert(1))")).toBe("[click](javascript:alert(1))");
  });

  it("groups consecutive '- ' lines into a <ul>", () => {
    const out = renderMarkdown("- one\n- two");
    expect(out).toBe("<ul><li>one</li><li>two</li></ul>");
  });

  it("converts a lone newline to <br>", () => {
    expect(renderMarkdown("a\nb")).toBe("a<br>b");
  });
});
