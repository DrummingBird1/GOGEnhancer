import { describe, it, expect } from "vitest";

await import("../content/currency-detection.js");
const { parsePrice, SYMBOL_TO_CODE } = window.GOGPlusCurrency;

describe("parsePrice", () => {
  it("parses a simple USD value", () => {
    expect(parsePrice("$24.99", "USD")).toBe(24.99);
  });

  it("strips thousands separators (US-style)", () => {
    expect(parsePrice("$1,234.56", "USD")).toBe(1234.56);
  });

  it("returns null when no price token is present", () => {
    expect(parsePrice("no price here")).toBe(null);
  });

  it("returns null when forced to a currency that's not in the text", () => {
    expect(parsePrice("$24.99", "EUR")).toBe(null);
  });

  it("detects without a known currency hint", () => {
    expect(parsePrice("Now only €15.50")).toBe(15.5);
    expect(parsePrice("₪89")).toBe(89);
  });

  it("handles the symbol immediately followed by the number", () => {
    expect(parsePrice("$5", "USD")).toBe(5);
  });

  it("handles a space between symbol and number", () => {
    expect(parsePrice("$ 9.99", "USD")).toBe(9.99);
  });

  it("knows the full symbol→code map", () => {
    expect(SYMBOL_TO_CODE["$"]).toBe("USD");
    expect(SYMBOL_TO_CODE["€"]).toBe("EUR");
    expect(SYMBOL_TO_CODE["₪"]).toBe("ILS");
    expect(SYMBOL_TO_CODE["zł"]).toBe("PLN");
  });

  // EUR / PLN / RUB use comma as the decimal mark. The parser disambiguates
  // by tail-digit count: "19,99" (2 tail digits) is decimal; "1,234" (3) is
  // thousands. When both . and , appear, the right-most one is the decimal.
  it("handles EUR-style decimal comma", () => {
    expect(parsePrice("€19,99", "EUR")).toBe(19.99);
    expect(parsePrice("€1.234,56", "EUR")).toBe(1234.56);
  });

  it("handles PLN-style decimal comma", () => {
    expect(parsePrice("zł 49,90", "PLN")).toBe(49.9);
  });

  it("still parses US-style commas as thousands", () => {
    expect(parsePrice("$1,234.56", "USD")).toBe(1234.56);
    expect(parsePrice("$1,234", "USD")).toBe(1234);
  });
});
