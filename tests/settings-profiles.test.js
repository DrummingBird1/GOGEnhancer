import { describe, it, expect } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/settings-profiles.js");

const P = window.GOGPlusSettingsProfiles;
const DEFAULTS = window.GOG_PLUS_DEFAULTS;

describe("profiles", () => {
  it("only ever set look-and-feel / feature switches that are real settings", () => {
    for (const [id, p] of Object.entries(P.PROFILES)) {
      for (const k of Object.keys(p.settings)) {
        expect(P.PROFILE_KEYS, `${id}.${k}`).toContain(k);
        expect(k in DEFAULTS || k === "keyboardNav", `${id}.${k} exists in defaults`).toBe(true);
      }
    }
  });

  it("never touch data, currency or notification setup", () => {
    for (const id of Object.keys(P.PROFILES)) {
      const keys = Object.keys(P.applyProfile(id));
      for (const forbidden of ["tags", "notes", "priceHistory", "targetCurrency", "rates", "vatPercent", "desktopNotifications", "autoSync", "webhookUrl", "quietHours"]) {
        expect(keys).not.toContain(forbidden);
      }
    }
  });

  it("applyProfile returns the profile's settings, or null for an unknown one", () => {
    expect(P.applyProfile("accessible")).toMatchObject({ dyslexiaFont: true, calmMode: true, uiScale: 1.25, theme: "highcontrast" });
    expect(P.applyProfile("minimal")).toMatchObject({ catalogTools: false, realDiscountCheck: true });
    expect(P.applyProfile("full")).toMatchObject({ keyboardNav: true, catalogTools: true });
    expect(P.applyProfile("nope")).toBeNull();
  });

  it("recognises the profile the settings currently match", () => {
    expect(P.matchingProfile({ ...DEFAULTS, ...P.applyProfile("minimal") })).toBe("minimal");
    expect(P.matchingProfile({ ...DEFAULTS, ...P.applyProfile("accessible") })).toBe("accessible");
    expect(P.matchingProfile({ ...DEFAULTS, ...P.applyProfile("full") })).toBe("full");
    expect(P.matchingProfile({ ...DEFAULTS, ...P.applyProfile("full"), calmMode: true })).toBeNull();
  });

  it("describes each profile for the picker", () => {
    for (const p of Object.values(P.PROFILES)) {
      expect(p.label).toBeTruthy();
      expect(p.description.length).toBeGreaterThan(20);
    }
  });
});
