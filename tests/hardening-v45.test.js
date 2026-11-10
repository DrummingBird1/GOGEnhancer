import { describe, it, expect } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/currency-format.js");
await import("../extension/lib/backup-crypto.js");
await import("../extension/lib/sync-core.js");
await import("../extension/lib/pack.js");
await import("../extension/lib/wishlist-tools.js");
await import("../extension/lib/library-tools.js");

const V = window.GOGPlusValidate;

describe("validate: slugs, cells, file names", () => {
  it("accepts real slugs and refuses prototype names and path-like input", () => {
    expect(V.isSlug("the_witcher_3_wild_hunt")).toBe(true);
    for (const bad of ["__proto__", "constructor", "prototype", "../x", "A B", "", "a".repeat(200), 5, null]) {
      expect(V.isSlug(bad)).toBe(false);
    }
  });

  it("slugMap drops hostile keys and keeps the rest", () => {
    const hostile = JSON.parse('{"__proto__": ["x"], "good_game": ["rpg"], "bad key": ["y"]}');
    const out = V.slugMap(hostile);
    expect(Object.keys(out)).toEqual(["good_game"]);
    expect({}.x).toBeUndefined();
  });

  it("neutralises spreadsheet formulas and quotes separators", () => {
    expect(V.csvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(V.csvCell("+1")).toBe("'+1");
    expect(V.csvCell("-2")).toBe("'-2");
    expect(V.csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(V.csvCell("a,b")).toBe('"a,b"');
    expect(V.csvCell("plain")).toBe("plain");
    expect(V.csvCell(null)).toBe("");
  });

  it("makes safe file names", () => {
    expect(V.safeFileName("../../etc/passwd")).not.toMatch(/[\\/]/);
    expect(V.safeFileName("..hidden")).not.toMatch(/^\./);
    expect(V.safeFileName("")).toBe("_");
  });
});

describe("validate: sanitizeStorage", () => {
  const D = window.GOG_PLUS_DEFAULTS;

  it("drops unknown keys, wrong types and per-browser keys, and says what it dropped", () => {
    const { clean, skipped } = V.sanitizeStorage(
      { theme: "light", vatPercent: "lots", madeUpKey: 1, webhookUrl: "https://secret", tags: { a_game: ["rpg"] } },
      D
    );
    expect(clean.theme).toBe("light");
    expect(clean.tags).toEqual({ a_game: ["rpg"] });
    expect(clean.vatPercent).toBeUndefined();
    expect(clean.webhookUrl).toBeUndefined();
    expect(skipped.sort()).toEqual(["madeUpKey", "vatPercent"]);
  });

  it("rebuilds history, colours, purchases and alerts, dropping markup in dates, currencies and colours", () => {
    const { clean } = V.sanitizeStorage(
      {
        priceHistory: {
          ok_game: [
            { d: "2026-01-02", p: 9.99, c: "USD" },
            { d: '"><img src=x onerror=alert(1)>', p: 5, c: "USD" },
            { d: "2026-01-03", p: 5, c: "<b>" },
          ],
        },
        tagColors: { fun: "#ff00aa", evil: "red;background:url(//x)" },
        purchaseLog: { ok_game: { date: "2026-02-03", currency: "EUR", price: 4 }, odd_game: { date: "<x>", currency: "no" } },
        priceAlerts: { ok_game: { threshold: 5, currency: "USD" }, bad_game: { threshold: "5", currency: "USD" } },
      },
      D
    );
    expect(clean.priceHistory.ok_game).toHaveLength(1);
    expect(clean.tagColors).toEqual({ fun: "#ff00aa" });
    expect(clean.purchaseLog.ok_game.date).toBe("2026-02-03");
    expect(clean.purchaseLog.odd_game.date).toBeUndefined();
    expect(Object.keys(clean.priceAlerts)).toEqual(["ok_game"]);
  });

  it("keeps only same-site catalog presets", () => {
    const { clean } = V.sanitizeStorage({ catalogPresets: { mine: "/en/games?order=desc:trending", evil: "https://evil.example/x" } }, D);
    expect(Object.keys(clean.catalogPresets)).toEqual(["mine"]);
  });
});

describe("currency symbols are markup-safe", () => {
  it("keeps only letters for an unknown currency", () => {
    expect(window.GOGPlusCurrencyFormat.symbolFor('"><svg onload=1>')).toBe("SVGON");
    expect(window.GOGPlusCurrencyFormat.symbolFor("USD")).toBe("$");
    expect(window.GOGPlusCurrencyFormat.symbolFor("constructor")).toBe("CONST");
  });
});

describe("encrypted backups", () => {
  const C = window.GOGPlusBackupCrypto;

  it("round-trips and records the iteration count", async () => {
    const env = await C.encryptBackup("secret text", "pässword");
    expect(env.iterations).toBe(600000);
    expect(env.formatVersion).toBe(2);
    expect(await C.decryptBackup(env, "pässword")).toBe("secret text");
  }, 30000);

  it("refuses a file from a newer version and absurd iteration counts", async () => {
    const env = await C.encryptBackup("x", "pw");
    await expect(C.decryptBackup({ ...env, formatVersion: 99 }, "pw")).rejects.toThrow(/newer version/);
    await expect(C.decryptBackup({ ...env, iterations: 5 }, "pw")).rejects.toThrow(/Unsupported/);
  }, 30000);

  it("still opens a version-1 file (no count in it: 250k iterations)", async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode("old"), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode("legacy")));
    const b64 = (u) => btoa(String.fromCharCode(...u));
    expect(await C.decryptBackup({ salt: b64(salt), iv: b64(iv), ciphertext: b64(ct) }, "old")).toBe("legacy");
  }, 30000);
});

describe("folder sync merge", () => {
  const S = window.GOGPlusSyncCore;
  const snap = (data, meta = {}) => ({ data, meta });

  it("a device with its clock in the future does not win forever", () => {
    const now = 1_000_000_000_000;
    const future = now + 365 * 24 * 3600e3;
    const local = snap({ notes: { g: "mine" } }, { "notes:g": { t: now } });
    const remote = snap({ notes: { g: "theirs" } }, { "notes:g": { t: future } });
    const out = S.mergeSnapshots(local, remote, { now });
    // Clamped to "now + a few minutes": still newest, but the stored stamp is not a year ahead.
    expect(out.meta["notes:g"].t).toBeLessThan(now + 10 * 60e3);
  });

  it("records neither side ever stamped are merged, not picked by string order", () => {
    const local = snap({ tags: { g: ["a"] }, notes: { g: "first" } });
    const remote = snap({ tags: { g: ["b"] }, notes: { g: "second" } });
    const out = S.mergeSnapshots(local, remote, { now: 1 });
    expect(out.data.tags.g.sort()).toEqual(["a", "b"]);
    expect(out.data.notes.g).toContain("first");
    expect(out.data.notes.g).toContain("second");
    expect(out.conflicts.length).toBe(2);
  });
});

describe("tag packs", () => {
  const P = window.GOGPlusPack;

  it("mergePack ignores hostile slugs and bad dates instead of throwing", () => {
    const pack = {
      games: [
        JSON.parse('{"slug":"__proto__","tags":["x"]}'),
        { slug: "constructor", tags: ["y"] },
        { slug: "fine_game", tags: ["rpg"], purchaseDate: { not: "a string" }, note: 7 },
        { slug: "other_game", tags: ["co-op"], purchaseDate: "2026-03-04", note: "hi" },
      ],
      tagColors: JSON.parse('{"__proto__":"#ff0000","ok":"#00ff00"}'),
    };
    const out = P.mergePack(pack, { tags: {}, notes: {}, purchaseLog: {}, tagColors: {} });
    expect(Object.keys(out.tags).sort()).toEqual(["fine_game", "other_game"]);
    expect(out.purchaseLog).toEqual({ other_game: { date: "2026-03-04" } });
    expect(out.notes).toEqual({ other_game: "hi" });
    expect(out.tagColors).toEqual({ ok: "#00ff00" });
  });

  it("refuses an oversized share link without inflating it", async () => {
    await expect(P.decodeShare("z." + "A".repeat(300 * 1024))).rejects.toThrow(/damaged/);
  });
});

describe("spreadsheet exports", () => {
  it("the wishlist CSV neutralises formulas in titles and tags", () => {
    const T = window.GOGPlusWishlistTools;
    const csv = T.toCsv(
      [{ title: "=cmd|' /C calc'!A0", slug: "evil_game", price: 5, currency: "USD", discountPct: 0 }],
      { tags: { evil_game: ["+tag"] } }
    );
    expect(csv).not.toMatch(/(^|,|\n)=cmd/);
    expect(csv).toContain("'=cmd");
  });
});
