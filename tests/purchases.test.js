import { describe, it, expect } from "vitest";

await import("../extension/lib/purchases.js");

const { normalizePurchaseEntry, purchaseDateOf } = window.GOGPlusPurchases;

describe("normalizePurchaseEntry", () => {
  it("wraps a legacy bare date string into { date }", () => {
    expect(normalizePurchaseEntry("2026-01-15")).toEqual({ date: "2026-01-15" });
  });

  it("passes through an already-normalized entry unchanged", () => {
    const entry = { date: "2026-01-15", price: 19.99, currency: "USD" };
    expect(normalizePurchaseEntry(entry)).toBe(entry);
  });

  it("returns null for an empty string, null, or undefined", () => {
    expect(normalizePurchaseEntry("")).toBeNull();
    expect(normalizePurchaseEntry(null)).toBeNull();
    expect(normalizePurchaseEntry(undefined)).toBeNull();
  });

  it("returns null for a malformed object without a date", () => {
    expect(normalizePurchaseEntry({ price: 10 })).toBeNull();
    expect(normalizePurchaseEntry({ date: "" })).toBeNull();
  });
});

describe("purchaseDateOf", () => {
  it("extracts the date from either shape", () => {
    expect(purchaseDateOf("2026-01-15")).toBe("2026-01-15");
    expect(purchaseDateOf({ date: "2026-01-15", price: 5 })).toBe("2026-01-15");
  });

  it("returns an empty string for nothing usable", () => {
    expect(purchaseDateOf(null)).toBe("");
    expect(purchaseDateOf(undefined)).toBe("");
    expect(purchaseDateOf({})).toBe("");
  });
});
