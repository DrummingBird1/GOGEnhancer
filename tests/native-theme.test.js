import { describe, it, expect, beforeEach } from "vitest";

await import("../extension/content/native-theme.js");

const Native = window.GOGPlusNativeTheme;
const html = document.documentElement;

beforeEach(() => {
  html.removeAttribute("style");
  document.body.removeAttribute("style");
  document.body.innerHTML = "";
});

describe("parseColor", () => {
  it("parses rgb(), rgba() and the space/slash syntax", () => {
    expect(Native.parseColor("rgb(10, 20, 30)")).toEqual({ r: 10, g: 20, b: 30, a: 1 });
    expect(Native.parseColor("rgba(10, 20, 30, 0.5)")).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(Native.parseColor("rgb(10 20 30 / 50%)")).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(Native.parseColor("transparent")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it("rejects colour spaces it can't read instead of guessing", () => {
    expect(Native.parseColor("oklch(0.5 0.1 200)")).toBeNull();
    expect(Native.parseColor("")).toBeNull();
    expect(Native.parseColor(null)).toBeNull();
  });
});

describe("colour maths", () => {
  it("luminance orders black < grey < white", () => {
    const l = (v) => Native.luminance({ r: v, g: v, b: v, a: 1 });
    expect(l(0)).toBe(0);
    expect(l(128)).toBeGreaterThan(0);
    expect(l(128)).toBeLessThan(l(255));
    expect(l(255)).toBeCloseTo(1, 5);
  });

  it("saturation tells colours from greys", () => {
    expect(Native.saturation({ r: 100, g: 100, b: 100, a: 1 })).toBe(0);
    expect(Native.saturation({ r: 0, g: 0, b: 0, a: 1 })).toBe(0);
    expect(Native.saturation({ r: 200, g: 20, b: 20, a: 1 })).toBeGreaterThan(0.8);
  });

  it("mix blends linearly", () => {
    const a = { r: 0, g: 0, b: 0, a: 1 };
    const b = { r: 100, g: 200, b: 50, a: 1 };
    expect(Native.mix(a, b, 0)).toEqual(a);
    expect(Native.mix(a, b, 1)).toEqual(b);
    expect(Native.mix(a, b, 0.5)).toEqual({ r: 50, g: 100, b: 25, a: 1 });
  });
});

describe("deriveTokens", () => {
  const dark = { bg: { r: 10, g: 10, b: 14, a: 1 }, text: { r: 240, g: 240, b: 245, a: 1 } };

  it("detects a dark site and derives surface/border tokens from bg+text", () => {
    const { isDark, vars } = Native.deriveTokens({ ...dark, accent: null, fontFamily: "" });
    expect(isDark).toBe(true);
    expect(vars["--gp-bg"]).toBe("rgb(10, 10, 14)");
    expect(vars["--gp-text"]).toBe("rgb(240, 240, 245)");
    expect(vars["--gp-text-dim"]).toBe("rgba(240, 240, 245, 0.65)");
    expect(vars["--gp-border"]).toBe("rgba(240, 240, 245, 0.12)");
    expect(vars["--gp-surface"]).not.toBe(vars["--gp-bg"]);
  });

  it("detects a light site", () => {
    const { isDark } = Native.deriveTokens({
      bg: { r: 250, g: 250, b: 250, a: 1 },
      text: { r: 20, g: 20, b: 20, a: 1 },
      accent: null,
      fontFamily: "",
    });
    expect(isDark).toBe(false);
  });

  it("only sets accent and font tokens when they were sampled", () => {
    const without = Native.deriveTokens({ ...dark, accent: null, fontFamily: "" }).vars;
    expect(without["--gp-magenta"]).toBeUndefined();
    expect(without["--gp-cyan"]).toBeUndefined();
    expect(without["--gp-body"]).toBeUndefined();

    const withBoth = Native.deriveTokens({
      ...dark,
      accent: { r: 150, g: 40, b: 220, a: 1 },
      fontFamily: "Inter, sans-serif",
    }).vars;
    expect(withBoth["--gp-magenta"]).toBe("rgb(150, 40, 220)");
    expect(withBoth["--gp-cyan"]).toMatch(/^rgb\(/);
    expect(withBoth["--gp-body"]).toBe("Inter, sans-serif");
  });
});

describe("sample / apply / clear", () => {
  function paintPage() {
    html.style.backgroundColor = "rgb(20, 20, 24)";
    document.body.style.color = "rgb(235, 235, 240)";
    document.body.style.fontFamily = "Inter, sans-serif";
  }

  it("samples background, text colour, font and the primary call-to-action", () => {
    paintPage();
    document.body.innerHTML = `<button class="add-to-cart-btn" style="background-color: rgb(30, 144, 255)">Buy</button>`;
    const s = Native.sample();
    expect(s.bg).toEqual({ r: 20, g: 20, b: 24, a: 1 });
    expect(s.text).toEqual({ r: 235, g: 235, b: 240, a: 1 });
    expect(s.accent).toEqual({ r: 30, g: 144, b: 255, a: 1 });
    expect(s.fontFamily).toContain("Inter");
  });

  it("ignores a grey call-to-action fill and falls back to its text colour, then to no accent", () => {
    paintPage();
    document.body.innerHTML = `<button class="primary-x" style="background-color: rgb(120, 120, 120); color: rgb(255, 80, 0)">Go</button>`;
    expect(Native.sample().accent).toEqual({ r: 255, g: 80, b: 0, a: 1 });

    document.body.innerHTML = `<button class="primary-x" style="background-color: rgb(120, 120, 120); color: rgb(130, 130, 130)">Go</button>`;
    expect(Native.sample().accent).toBeNull();
  });

  it("returns null when nothing opaque can be found", () => {
    expect(Native.sample()).toBeNull();
  });

  it("apply writes the --gp-* vars on <html> and reports dark/light", () => {
    paintPage();
    document.body.innerHTML = `<button class="buy-button" style="background-color: rgb(30, 144, 255)">Buy</button>`;
    const r = Native.apply();
    expect(r).toEqual({ isDark: true });
    expect(html.style.getPropertyValue("--gp-bg")).toBe("rgb(20, 20, 24)");
    expect(html.style.getPropertyValue("--gp-magenta")).toBe("rgb(30, 144, 255)");
  });

  it("apply clears everything and returns null when the page can't be sampled", () => {
    html.style.setProperty("--gp-bg", "red");
    expect(Native.apply()).toBeNull();
    expect(html.style.getPropertyValue("--gp-bg")).toBe("");
  });

  it("apply removes a stale accent when the new page has none", () => {
    paintPage();
    html.style.setProperty("--gp-magenta", "rgb(1, 2, 3)");
    Native.apply();
    expect(html.style.getPropertyValue("--gp-magenta")).toBe("");
  });

  it("clear removes every token", () => {
    html.style.setProperty("--gp-bg", "red");
    html.style.setProperty("--gp-body", "serif");
    Native.clear();
    expect(html.style.getPropertyValue("--gp-bg")).toBe("");
    expect(html.style.getPropertyValue("--gp-body")).toBe("");
  });
});
