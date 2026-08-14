import { describe, it, expect } from "vitest";

await import("../extension/lib/dom-safety.js");
await import("../extension/lib/currency-format.js");
await import("../extension/lib/genres.js");

const { escapeHtml } = window.GOGPlusDomSafety;
const { symbolFor, formatPrice } = window.GOGPlusCurrencyFormat;
const { GENRE_PATTERNS, matchGenrePattern, mapGenreLabel } = window.GOGPlusGenres;

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<script>alert("x")&'y'</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&amp;&#39;y&#39;&lt;/script&gt;"
    );
  });

  it("is null/undefined-safe", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("stringifies non-string input", () => {
    expect(escapeHtml(42)).toBe("42");
  });
});

describe("symbolFor / formatPrice", () => {
  it("maps known currencies to their symbol", () => {
    expect(symbolFor("ILS")).toBe("₪");
    expect(symbolFor("USD")).toBe("$");
    expect(symbolFor("PLN")).toBe("zł");
  });

  it("falls back to the raw code for an unknown currency", () => {
    expect(symbolFor("XYZ")).toBe("XYZ");
  });

  it("rounds ILS/RUB to whole units", () => {
    expect(formatPrice(15.7, "ILS")).toBe("₪16");
    expect(formatPrice(15.4, "RUB")).toBe("₽15");
  });

  it("keeps 2 decimals for other currencies", () => {
    expect(formatPrice(15, "USD")).toBe("$15.00");
    expect(formatPrice(9.999, "EUR")).toBe("€10.00");
  });
});

describe("matchGenrePattern", () => {
  it("matches a known franchise slug to its bucket", () => {
    expect(matchGenrePattern("resident_evil_2")).toBe("horror");
    expect(matchGenrePattern("stardew_valley")).toBe("indie");
    expect(matchGenrePattern("baldurs_gate_3")).toBe("rpg");
  });

  it("returns null for an unrecognized slug", () => {
    expect(matchGenrePattern("some_random_indie_sounding_but_unlisted_game")).toBe(null);
  });

  it("returns null for empty input without throwing", () => {
    expect(matchGenrePattern("")).toBe(null);
    expect(matchGenrePattern(null)).toBe(null);
  });

  it("every pattern in the table is a valid, distinct genre bucket", () => {
    const genres = GENRE_PATTERNS.map((g) => g.genre);
    expect(new Set(genres).size).toBe(genres.length);
  });
});

describe("mapGenreLabel", () => {
  it("maps confirmed GOG genre labels case/whitespace-insensitively", () => {
    expect(mapGenreLabel("Horror")).toBe("horror");
    expect(mapGenreLabel("  ROLE-PLAYING  ")).toBe("rpg");
    expect(mapGenreLabel("Strategy")).toBe("strategy");
  });

  it("returns null for genres not confirmed to appear in GOG's Genre field", () => {
    // Sci-fi and Indie are deliberately excluded — see lib/genres.js.
    expect(mapGenreLabel("Sci-fi")).toBe(null);
    expect(mapGenreLabel("Indie")).toBe(null);
  });

  it("returns null for empty input without throwing", () => {
    expect(mapGenreLabel("")).toBe(null);
    expect(mapGenreLabel(null)).toBe(null);
  });
});
