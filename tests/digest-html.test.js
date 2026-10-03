import { describe, it, expect } from "vitest";

await import("../extension/lib/digest-html.js");

const D = () => window.GOGPlusDigestHtml;
const NOW = Date.parse("2026-10-03T12:00:00Z");

const DIGEST = {
  generatedAt: NOW,
  dropsThisWeek: 3,
  refundClosing: [{ slug: "the_witcher_3", daysLeft: 2 }, { slug: "grim_fandango", daysLeft: 1 }],
  priceAlertHits: [{ slug: "hades", price: 9.5, currency: "USD", threshold: 10 }],
  wishlistDrops: [{ slug: "cyberpunk_2077", price: 20, currency: "EUR", dropPct: 55 }],
  endingSoon: [{ slug: "alan_wake", endsAt: NOW + 30 * 3600e3 }, { slug: "control", endsAt: NOW + 3600e3 }],
};

describe("build", () => {
  const html = D().build(DIGEST, {});

  it("is a complete, script-free, request-free page", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/<img\b/i);
    expect(html).not.toMatch(/src=|@import|url\(/i);
    expect(html).toContain('<meta name="referrer" content="no-referrer">');
    expect(html).toContain("<title>GOG Enhancer — this week (2026-10-03)</title>");
  });

  it("lists every kind of highlight with a readable detail", () => {
    expect(html).toContain("Refund windows closing");
    expect(html).toContain("closes in 2 days");
    expect(html).toContain("closes in 1 day<");
    expect(html).toContain("$9.50 (alert at 10.00)");
    expect(html).toContain("55% below its peak · € 20.00".replace("€ ", "€"));
    expect(html).toContain("ends in 2 days");
    expect(html).toContain("ends within a day");
    expect(html).toContain("3 price drops across the games you track this week.");
  });

  it("links each game to its page, opening safely in a new tab", () => {
    expect(html).toContain('<a href="https://www.gog.com/en/game/the_witcher_3" target="_blank" rel="noopener noreferrer">The Witcher 3</a>');
  });

  it("escapes everything that came from stored data", () => {
    const evil = D().build({ generatedAt: NOW, refundClosing: [{ slug: "x", daysLeft: 1 }] }, { titleOf: () => '<img src=x onerror="alert(1)">' });
    expect(evil).not.toContain("<img");
    expect(evil).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    const slug = D().build({ generatedAt: NOW, refundClosing: [{ slug: 'a"><b>', daysLeft: 1 }] }, {});
    expect(slug).not.toContain("<b>");
    expect(slug).toContain("a%22%3E%3Cb%3E");
  });

  it("says so when there is nothing to report", () => {
    const empty = D().build({ generatedAt: NOW }, {});
    expect(empty).toContain("Nothing needs your attention this week.");
    expect(empty).not.toContain("<h2>");
  });
});

describe("helpers", () => {
  it("counts highlights, not the drop trivia", () => {
    expect(D().highlightCount(DIGEST)).toBe(6);
    expect(D().highlightCount({ generatedAt: NOW, dropsThisWeek: 9 })).toBe(0);
    expect(D().highlightCount(null)).toBe(0);
  });

  it("names the file by date", () => {
    expect(D().fileName(NOW)).toBe("gog-enhancer-digest-2026-10-03.html");
  });

  it("escapes the five dangerous characters", () => {
    expect(D().esc(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
    expect(D().esc(null)).toBe("");
  });
});
