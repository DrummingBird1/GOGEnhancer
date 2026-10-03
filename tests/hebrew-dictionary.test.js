import { describe, it, expect } from "vitest";

await import("../extension/lib/genres.js");
await import("../extension/content/translations.js");

const T = () => window.GOG_PLUS_TRANSLATIONS;
const exact = () => T().exact;
const translate = (text) => {
  const t = text.trim();
  if (exact()[t]) return exact()[t];
  for (const { re, fmt } of T().patterns) {
    const m = t.match(re);
    if (m) return m.slice(1).reduce((out, v, i) => out.replace(`$${i + 1}`, v), fmt);
  }
  return text;
};

describe("the redesigned store's interface strings (recorded from the live site, 2026-10-03)", () => {
  it("translates the catalog filters, sorting and toggles", () => {
    for (const [en, he] of [
      ["Filters", "מסננים"],
      ["Sort by", "מיין לפי"],
      ["Price range", "טווח מחירים"],
      ["Release Status", "סטטוס יציאה"],
      ["Show only discounted", "הצג רק מוזלים"],
      ["Hide DLCs and extras", "הסתר DLC ותוספות"],
      ["Highest discounts", "ההנחות הגבוהות ביותר"],
      ["Price (from lowest)", "מחיר (מהנמוך)"],
      ["Release date (from newest)", "תאריך יציאה (מהחדש)"],
    ]) {
      expect(translate(en)).toBe(he);
    }
  });

  it("translates the home page's calls to action", () => {
    expect(translate("Browse deals")).toBe("עיינו במבצעים");
    expect(translate("See all games")).toBe("ראו את כל המשחקים");
    expect(translate("Add to library")).toBe("הוסף לספרייה");
    expect(translate("IN LIBRARY")).toBe("בספרייה");
  });

  it("translates the new count patterns", () => {
    expect(translate("8000+ deals up to -95%")).toBe("8000+ מבצעים עד 95%- הנחה");
    expect(translate("128 reviews")).toBe("128 ביקורות");
    expect(translate("3 items added")).toBe("נוספו 3 פריטים");
  });

  it("leaves everything else alone", () => {
    expect(translate("Cyberpunk 2077")).toBe("Cyberpunk 2077");
  });
});

describe("text the extension READS survives translation", () => {
  // The extension takes genre labels, tag names and language names from the
  // page, and the translator may have rewritten them by then.
  it("maps a genre label back from its Hebrew translation, so genre detection doesn't depend on the translator", () => {
    const G = window.GOGPlusGenres;
    let checked = 0;
    for (const [english, bucket] of Object.entries(G.GENRE_LABEL_TO_BUCKET)) {
      for (const key of [english, english[0].toUpperCase() + english.slice(1), english.toUpperCase()]) {
        const he = exact()[key];
        if (!he) continue;
        expect(G.mapGenreLabel(he), `"${key}" → "${he}"`).toBe(bucket);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0); // Strategy and RPG really are translated today
    expect(G.mapGenreLabel("Role-playing")).toBe("rpg"); // untranslated still works
    expect(G.mapGenreLabel("something else")).toBeNull();
  });

  it("does not translate tag values or the language names the language check compares", () => {
    for (const v of ["Story Rich", "Atmospheric", "Exploration", "Fantasy", "English", "Deutsch", "Polski", "Français", "Español", "Русский", "עברית"]) {
      expect(exact()[v], `"${v}"`).toBeUndefined();
    }
  });
});
