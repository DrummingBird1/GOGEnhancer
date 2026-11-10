import { describe, it, expect } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
window.GOGPlusGogDom = window.GOGPlusGogDom || { currencyHint: () => null, findPriceNodes: () => ({ nodes: [] }), displayText: (n) => n.textContent };
await import("../extension/content/currency-detection.js");
await import("../extension/content/tooltips.js");

describe("price parsing", () => {
  const { parsePrice } = window.GOGPlusCurrency;

  it("reads Brazilian reais as BRL, never as a 100x-too-big dollar amount", () => {
    expect(parsePrice("R$ 12,50")).toBe(12.5);
    expect(parsePrice("R$ 12,50", "USD")).toBeNull(); // a bare "$" is not the tail of "R$"
  });

  it("keeps a space or non-breaking space between thousands groups inside one number", () => {
    expect(parsePrice("1 097,99 zł", "PLN")).toBe(1097.99);
    expect(parsePrice("26 069 ₽", "RUB")).toBe(26069);
    expect(parsePrice("1 234,50 €", "EUR")).toBe(1234.5);
  });

  it("still parses the ordinary shapes", () => {
    expect(parsePrice("$19.99", "USD")).toBe(19.99);
    expect(parsePrice("19,99 €", "EUR")).toBe(19.99);
    expect(parsePrice("1,234.56 $", "USD")).toBe(1234.56);
  });
});

describe("tooltip content is rebuilt from an allow-list", () => {
  const { safeFragment } = window.GOGPlusTooltips;
  const html = (frag) => {
    const d = document.createElement("div");
    d.appendChild(frag);
    return d.innerHTML;
  };

  it("keeps formatting and the extension's own classes", () => {
    expect(html(safeFragment('<strong>Low</strong><br><span class="gog-plus-tip-warn">careful</span>'))).toBe(
      '<strong>Low</strong><br><span class="gog-plus-tip-warn">careful</span>'
    );
  });

  it("drops scripts, images, links, handlers and foreign classes", () => {
    const out = html(safeFragment('<img src=x onerror="alert(1)"><a href="javascript:1" onclick="x()">go</a><script>boom()</script><span class="evil" style="x">t</span>'));
    expect(out).not.toMatch(/<img|<a |<script|onerror|onclick|style=|class="evil"/);
    expect(out).toContain("go");
  });
});
