import { describe, it, expect } from "vitest";

// Import-for-side-effects: defaults.js attaches GOG_PLUS_DEFAULTS, storage.js
// attaches GOGPlusStorageKeys ({ SYNC_KEYS, LOCAL_KEYS }) to window.
await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");

const DEFAULTS = window.GOG_PLUS_DEFAULTS;
const { SYNC_KEYS, LOCAL_KEYS } = window.GOGPlusStorageKeys;

// Guard against the "falls through to local" trap the CLAUDE.md warns about:
// a persisted key added to lib/defaults.js without a matching entry in the
// SYNC_KEYS / LOCAL_KEYS partition in lib/storage.js is routed to local by
// default — silently, and usually not what you want for a preference. These
// tests fail at PR time instead.
describe("storage key routing", () => {
  it("routes every default key through exactly one storage area", () => {
    const unrouted = [];
    const both = [];
    for (const key of Object.keys(DEFAULTS)) {
      const inSync = SYNC_KEYS.has(key);
      const inLocal = LOCAL_KEYS.has(key);
      if (!inSync && !inLocal) unrouted.push(key);
      if (inSync && inLocal) both.push(key);
    }
    expect(
      unrouted,
      `keys in defaults.js with no SYNC_KEYS/LOCAL_KEYS entry: ${unrouted.join(", ")}`
    ).toEqual([]);
    expect(
      both,
      `keys listed in BOTH SYNC_KEYS and LOCAL_KEYS: ${both.join(", ")}`
    ).toEqual([]);
  });

  it("has no routing entries without a matching default", () => {
    const known = new Set(Object.keys(DEFAULTS));
    const orphans = [...SYNC_KEYS, ...LOCAL_KEYS].filter((k) => !known.has(k));
    expect(
      orphans,
      `keys routed in storage.js but absent from defaults.js: ${orphans.join(", ")}`
    ).toEqual([]);
  });
});
