import { describe, it, expect } from "vitest";

// Randomised and property checks over the pure libraries that read data nobody
// controls (a backup file, a sync file, a shared pack) or merge two devices'
// copies. A seeded generator keeps every run identical, so a failure is
// reproducible: the failing seed is in the message.

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/validate.js");
await import("../extension/lib/sync-core.js");
await import("../extension/lib/pack.js");
await import("../extension/lib/backup-crypto.js");
await import("../extension/lib/library-search.js");
await import("../extension/lib/catalog-tools.js");

const V = window.GOGPlusValidate;
const DEFAULTS = window.GOG_PLUS_DEFAULTS;

/** mulberry32 */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const NASTY = ["__proto__", "constructor", "prototype", "../etc/passwd", "a/b", "", " ", "<img src=x onerror=1>", "javascript:alert(1)", "\u0000", "𝔘𝔫𝔦", "x".repeat(5000), "toString", "hasOwnProperty", "=cmd|' /C calc'!A0", "ok_slug", "good-slug_1", "2026-01-01", "#ff00aa", "url(javascript:1)"];
function junk(r, depth = 0) {
  const k = Math.floor(r() * 9);
  if (depth > 3 && k > 5) return NASTY[Math.floor(r() * NASTY.length)];
  switch (k) {
    case 0: return null;
    case 1: return Math.floor(r() * 2000) - 1000;
    case 2: return [NaN, Infinity, -0, 1e308][Math.floor(r() * 4)];
    case 3: return r() < 0.5;
    case 4: case 5: return NASTY[Math.floor(r() * NASTY.length)];
    case 6: return Array.from({ length: Math.floor(r() * 4) }, () => junk(r, depth + 1));
    default: {
      const o = {};
      const n = Math.floor(r() * 5);
      for (let i = 0; i < n; i++) o[NASTY[Math.floor(r() * NASTY.length)]] = junk(r, depth + 1);
      return o;
    }
  }
}

describe("sanitizeStorage never throws and never lets a dangerous key or value through", () => {
  it("survives 3000 random payloads", () => {
    for (let seed = 1; seed <= 3000; seed++) {
      const r = rng(seed);
      const payload = {};
      const keys = [...Object.keys(DEFAULTS), ...NASTY];
      const n = 1 + Math.floor(r() * 8);
      for (let i = 0; i < n; i++) payload[keys[Math.floor(r() * keys.length)]] = junk(r);
      let out;
      try {
        out = V.sanitizeStorage(payload, DEFAULTS);
      } catch (e) {
        throw new Error(`seed ${seed}: threw ${e.message}`);
      }
      for (const k of Object.keys(out.clean)) {
        expect(Object.prototype.hasOwnProperty.call(DEFAULTS, k), `seed ${seed}: unknown key ${k} kept`).toBe(true);
        expect(V.PER_BROWSER_KEYS.includes(k), `seed ${seed}: per-browser key ${k} kept`).toBe(false);
      }
      for (const k of ["tags", "notes", "gameStatus", "priceHistory", "purchaseLog", "priceAlerts", "ownedSlugs", "tagColors"]) {
        if (!(k in out.clean)) continue;
        for (const slug of Object.keys(out.clean[k])) {
          if (k === "tagColors") continue;
          expect(V.isSlug(slug), `seed ${seed}: ${k} kept slug ${JSON.stringify(slug).slice(0, 40)}`).toBe(true);
        }
      }
      for (const c of Object.values(out.clean.tagColors || {})) expect(/^#[0-9a-f]{3,8}$/i.test(c), `seed ${seed}: colour ${c}`).toBe(true);
      if ("targetCurrency" in out.clean) expect(out.clean.targetCurrency === "none" || /^[A-Z]{3}$/.test(out.clean.targetCurrency)).toBe(true);
      for (const list of Object.values(out.clean.priceHistory || {})) {
        for (const e of list) {
          expect(Number.isFinite(e.p), `seed ${seed}: price ${e.p}`).toBe(true);
          expect(/^\d{4}-\d{2}-\d{2}$/.test(e.d)).toBe(true);
        }
      }
      // Cleaning is idempotent: a clean payload is its own clean form.
      const again = V.sanitizeStorage(out.clean, DEFAULTS);
      expect(again.skipped, `seed ${seed}: second pass still skipped ${again.skipped}`).toEqual([]);
    }
  });
});

describe("mergePack on hostile packs", () => {
  it("never throws, never pollutes prototypes, never invents a slug", () => {
    const P = window.GOGPlusPack;
    for (let seed = 1; seed <= 1500; seed++) {
      const r = rng(seed * 7);
      const games = Array.from({ length: 1 + Math.floor(r() * 5) }, () => ({ slug: junk(r), tags: junk(r), note: junk(r), purchaseDate: junk(r) }));
      const pack = { format: P.FORMAT, games, tagColors: junk(r) };
      const cur = { tags: { ok_slug: ["a"] }, notes: {}, purchaseLog: {}, tagColors: {} };
      let out;
      try {
        out = P.mergePack(pack, cur);
      } catch (e) {
        throw new Error(`seed ${seed}: threw ${e.message}`);
      }
      expect({}.polluted).toBeUndefined();
      for (const slug of Object.keys(out.tags)) expect(V.isSlug(slug) || slug === "ok_slug", `seed ${seed}: slug ${slug}`).toBe(true);
      expect(cur.tags.ok_slug).toEqual(["a"]); // inputs are never mutated
    }
  });
});

describe("sync merge properties", () => {
  const S = window.GOGPlusSyncCore;
  const NOW = 1_800_000_000_000;
  const mk = (r, tOff) => {
    const slugs = ["a_game", "b_game", "c_game"];
    const tags = {};
    const notes = {};
    const meta = {};
    for (const s of slugs) {
      if (r() < 0.6) {
        tags[s] = ["rpg", "co-op", "retro"].filter(() => r() < 0.5);
        meta[`tags:${s}`] = { t: NOW - Math.floor(r() * 1e6) - tOff };
      }
      if (r() < 0.4) {
        notes[s] = `note ${Math.floor(r() * 5)}`;
        meta[`notes:${s}`] = { t: NOW - Math.floor(r() * 1e6) - tOff };
      }
    }
    return { data: { tags, notes }, meta };
  };

  it("merging a device with itself changes nothing", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const a = mk(rng(seed), 0);
      const m = S.mergeSnapshots(a, JSON.parse(JSON.stringify(a)), { now: NOW });
      expect(m.localChanged, `seed ${seed}`).toBe(false);
      expect(m.remoteChanged, `seed ${seed}`).toBe(false);
      expect(m.conflicts, `seed ${seed}`).toEqual([]);
    }
  });

  it("both devices end up with the same data, whichever order they sync in", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const a = mk(rng(seed), 0);
      const b = mk(rng(seed + 9999), 0);
      const ab = S.mergeSnapshots(a, b, { now: NOW });
      const ba = S.mergeSnapshots(b, a, { now: NOW });
      expect(JSON.stringify(ab.data, Object.keys(ab.data).sort()), `seed ${seed}`).toBe(JSON.stringify(ba.data, Object.keys(ba.data).sort()));
      // …and a second round with the merged result is a no-op.
      const again = S.mergeSnapshots({ data: ab.data, meta: ab.meta }, { data: ba.data, meta: ba.meta }, { now: NOW });
      expect(again.localChanged || again.remoteChanged, `seed ${seed}: not converged`).toBe(false);
    }
  });
});

describe("encrypted backups", () => {
  it("round-trip random text under random passwords, and a wrong password never decrypts", async () => {
    const { encryptBackup, decryptBackup } = window.GOGPlusBackupCrypto;
    const r = rng(42);
    for (let i = 0; i < 6; i++) {
      const text = JSON.stringify(junk(r)) + "🎮".repeat(Math.floor(r() * 50));
      const pw = NASTY[Math.floor(r() * NASTY.length)] + String(i);
      const env = await encryptBackup(text, pw);
      expect(await decryptBackup(env, pw)).toBe(text);
      await expect(decryptBackup(env, pw + "x")).rejects.toBeTruthy();
    }
  }, 60000);
});

describe("library search and saved-search URLs", () => {
  it("search never throws on odd queries; presets only ever stay on gog.com catalog paths", () => {
    const S = window.GOGPlusLibrarySearch;
    const C = window.GOGPlusCatalogTools;
    const data = { tags: { a_game: ["rpg"] }, ownedSlugs: { a_game: 1 }, gameFacts: { a_game: { rd: "2015-05-19" } } };
    const r = rng(5);
    for (let i = 0; i < 2000; i++) {
      const q = JSON.stringify(junk(r)).slice(0, 80);
      expect(() => S.searchLibrary(data, q)).not.toThrow();
      const u = C.sanitizePresetUrl(JSON.stringify(junk(r)));
      if (u) expect(/^\/[a-z0-9/_-]*(\?[^\s"'<>]*)?$/i.test(u), `preset ${u}`).toBe(true);
    }
    for (const bad of ["https://evil.example/", "//evil.example/x", "javascript:alert(1)", "/\\evil.example"]) {
      expect(C.sanitizePresetUrl(bad), bad).toBeNull();
    }
  });
});

describe("saved-search URLs are re-encoded, not trusted", () => {
  it("angle brackets in the query come out percent-encoded", () => {
    expect(window.GOGPlusCatalogTools.sanitizePresetUrl("/en/games?x=<script>")).toBe("/en/games?x=%3Cscript%3E");
  });
});
