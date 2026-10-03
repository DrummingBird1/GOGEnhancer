import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// options.js keeps PRESETS as a plain top-level const (not exposed), so read the
// shipped sources: every preset button on the page must have a definition, and
// every definition a button — a mismatch means a button that silently does nothing.
const EXT = resolve(__dirname, "../extension");
const js = readFileSync(resolve(EXT, "options/options.js"), "utf8");
const html = readFileSync(resolve(EXT, "options/options.html"), "utf8");

const block = js.slice(js.indexOf("const PRESETS = {"), js.indexOf("};", js.indexOf("const PRESETS = {")));
const defined = [...block.matchAll(/^\s*([a-z]{2}):\s*\{\s*targetCurrency:\s*"([A-Z]{3})",\s*vatPercent:\s*(\d+)/gm)].map((m) => ({ id: m[1], cur: m[2], vat: Number(m[3]) }));
const buttons = [...html.matchAll(/data-preset="([a-z]+)"/g)].map((m) => m[1]);

describe("region presets", () => {
  it("has a definition for every button (except the manual one) and a button for every definition", () => {
    expect(buttons.filter((b) => b !== "custom").sort()).toEqual(defined.map((d) => d.id).sort());
  });

  it("covers the euro area's national VAT rates, and Russia", () => {
    const by = Object.fromEntries(defined.map((d) => [d.id, d]));
    expect(by.de).toEqual({ id: "de", cur: "EUR", vat: 19 });
    expect(by.fr.vat).toBe(20);
    expect(by.es.vat).toBe(21);
    expect(by.it.vat).toBe(22);
    expect(by.nl.vat).toBe(21);
    expect(by.ru).toEqual({ id: "ru", cur: "RUB", vat: 20 });
  });

  it("only uses currencies the rate table can convert to", () => {
    const supported = new Set(["ILS", "EUR", "GBP", "PLN", "RUB", "USD"]);
    for (const d of defined) expect(supported.has(d.cur), d.id).toBe(true);
  });
});
