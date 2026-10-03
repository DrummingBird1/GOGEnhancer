/**
 * GOG+ tag packs — a portable bundle of tags (and optionally notes and
 * purchase dates) for a set of games, used by the dashboard's export / import
 * and by share links.
 *
 * A pack never overwrites anything: importing adds tags, and only fills a
 * note, a purchase date or a tag colour that the importer doesn't already
 * have. Everything here is pure, so the dashboard and the gog.com content
 * script (which opens a share link) behave identically.
 *
 * Share links put the pack in the URL FRAGMENT (`…#gogplus-pack=…`), which a
 * browser never sends to a server — the link is only ever read by this
 * extension, on the recipient's machine. Share links carry tags and colours
 * only: notes and purchase dates are personal and stay out of them.
 */
// @ts-check

(() => {
  "use strict";

  const FORMAT = "gog-enhancer-tag-pack";
  const SHARE_PREFIX = "gogplus-pack=";
  const COLOR_RE = /^#[0-9a-f]{3,8}$/i;
  /** Upper bound on what a link may ask to import — a fragment is attacker-controlled input. */
  const MAX_GAMES = 2000;
  const MAX_TAGS_PER_GAME = 50;
  const MAX_TEXT = 60;

  /**
   * @typedef {{ slug: string, tags: string[], note?: string, purchaseDate?: string | null }} PackGame
   * @typedef {{ format: string, formatVersion: number, name: string, exportedAt: string, gameCount: number, games: PackGame[], tagColors: Record<string, string> }} Pack
   * @typedef {{ tags: Record<string, string[]>, notes: Record<string, string>, purchaseLog: Record<string, any>, tagColors: Record<string, string> }} PackData
   */

  /**
   * @param {{ slugs: string[], tags: Record<string, string[]>, notes: Record<string, string>, purchaseLog: Record<string, any>, tagColors: Record<string, string> }} src
   * @param {string} name
   * @param {Date} [now]
   * @returns {Pack}
   */
  function buildPack(src, name, now = new Date()) {
    /** @type {Set<string>} */
    const used = new Set();
    const games = src.slugs.map((slug) => {
      const tags = src.tags[slug] || [];
      tags.forEach((t) => used.add(t));
      const raw = src.purchaseLog[slug];
      const date = typeof raw === "string" ? raw : raw?.date;
      return { slug, tags, note: src.notes[slug] || "", purchaseDate: date || null };
    });
    /** @type {Record<string, string>} */
    const tagColors = {};
    for (const t of used) if (src.tagColors[t]) tagColors[t] = src.tagColors[t];
    return {
      format: FORMAT,
      formatVersion: 1,
      name: name.trim() || "Untitled pack",
      exportedAt: now.toISOString(),
      gameCount: games.length,
      games,
      tagColors,
    };
  }

  /**
   * Throws a user-presentable Error unless `pack` looks like a pack.
   * @param {any} pack
   * @returns {Pack}
   */
  function validatePack(pack) {
    if (pack?.format !== FORMAT) throw new Error("Not a recognised tag pack (wrong format field).");
    if (!Array.isArray(pack.games)) throw new Error("Pack has no games array.");
    return pack;
  }

  /**
   * Merges a pack into existing data without overwriting anything. Never
   * mutates its inputs.
   * @param {Pack} pack
   * @param {PackData} cur
   * @returns {PackData & { counts: { tags: number, notes: number, purchases: number, colors: number } }}
   */
  function mergePack(pack, cur) {
    const tags = Object.fromEntries(Object.entries(cur.tags).map(([k, v]) => [k, [...v]]));
    const notes = { ...cur.notes };
    const purchaseLog = { ...cur.purchaseLog };
    const tagColors = { ...cur.tagColors };
    const counts = { tags: 0, notes: 0, purchases: 0, colors: 0 };
    for (const g of pack.games) {
      if (!g || typeof g.slug !== "string" || !g.slug) continue;
      if (Array.isArray(g.tags) && g.tags.length) {
        const existing = new Set(tags[g.slug] || []);
        const before = existing.size;
        for (const t of g.tags) if (typeof t === "string" && t.trim()) existing.add(t);
        if (existing.size > before) {
          tags[g.slug] = [...existing];
          counts.tags += existing.size - before;
        }
      }
      if (g.note && !notes[g.slug]) {
        notes[g.slug] = g.note;
        counts.notes++;
      }
      if (g.purchaseDate && !purchaseLog[g.slug]) {
        purchaseLog[g.slug] = { date: g.purchaseDate };
        counts.purchases++;
      }
    }
    for (const [t, c] of Object.entries(pack.tagColors || {})) {
      if (!tagColors[t] && typeof c === "string" && COLOR_RE.test(c)) {
        tagColors[t] = c;
        counts.colors++;
      }
    }
    return { tags, notes, purchaseLog, tagColors, counts };
  }

  /* ---------------- share links ---------------- */

  /** @param {Uint8Array} bytes */
  function toBase64Url(bytes) {
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  /** @param {string} s @returns {Uint8Array} */
  function fromBase64Url(s) {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }

  /**
   * @param {"compress" | "decompress"} mode
   * @param {Uint8Array} bytes
   * @returns {Promise<Uint8Array>}
   */
  async function pipe(mode, bytes) {
    const Ctor = mode === "compress" ? globalThis.CompressionStream : globalThis.DecompressionStream;
    const stream = new Blob([/** @type {BlobPart} */ (bytes)]).stream().pipeThrough(new Ctor("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /**
   * Tags and colours only, in a compact shape: `{ v, n, g: [[slug, tags], …], c }`.
   * @param {Pack} pack
   * @returns {Promise<string>} the fragment value (`z.` deflated, or `j.` plain)
   */
  async function encodeShare(pack) {
    const compact = {
      v: 1,
      n: pack.name,
      g: pack.games.filter((g) => g.tags?.length).map((g) => [g.slug, g.tags]),
      c: pack.tagColors || {},
    };
    const bytes = new TextEncoder().encode(JSON.stringify(compact));
    if (typeof globalThis.CompressionStream === "function") {
      try {
        return `z.${toBase64Url(await pipe("compress", bytes))}`;
      } catch {
        // fall through to the uncompressed form
      }
    }
    return `j.${toBase64Url(bytes)}`;
  }

  /**
   * Parses a fragment value back into a (tags-only) pack, sanitising every
   * field: a share link is untrusted input.
   * @param {string} value
   * @returns {Promise<Pack>}
   */
  async function decodeShare(value) {
    const kind = value.slice(0, 2);
    const body = value.slice(2);
    let bytes;
    try {
      bytes = fromBase64Url(body);
      if (kind === "z.") {
        if (typeof globalThis.DecompressionStream !== "function") throw new Error("no decompression");
        bytes = await pipe("decompress", bytes);
      } else if (kind !== "j.") {
        throw new Error("unknown encoding");
      }
    } catch {
      throw new Error("This share link is damaged or not from GOG Enhancer.");
    }
    /** @type {any} */
    let raw;
    try {
      raw = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new Error("This share link is damaged or not from GOG Enhancer.");
    }
    if (raw?.v !== 1 || !Array.isArray(raw.g)) throw new Error("This share link is from a newer GOG Enhancer, or isn't one.");

    /** @type {PackGame[]} */
    const games = [];
    for (const entry of raw.g.slice(0, MAX_GAMES)) {
      const [slug, tags] = Array.isArray(entry) ? entry : [];
      if (typeof slug !== "string" || !/^[a-z0-9_]{1,120}$/.test(slug) || !Array.isArray(tags)) continue;
      const clean = tags
        .filter((t) => typeof t === "string")
        .map((t) => t.trim().slice(0, MAX_TEXT))
        .filter(Boolean)
        .slice(0, MAX_TAGS_PER_GAME);
      if (clean.length) games.push({ slug, tags: clean });
    }
    /** @type {Record<string, string>} */
    const tagColors = {};
    for (const [t, c] of Object.entries(raw.c && typeof raw.c === "object" ? raw.c : {})) {
      if (typeof c === "string" && COLOR_RE.test(c)) tagColors[t.slice(0, MAX_TEXT)] = c;
    }
    return {
      format: FORMAT,
      formatVersion: 1,
      name: typeof raw.n === "string" ? raw.n.slice(0, 80) : "Shared pack",
      exportedAt: "",
      gameCount: games.length,
      games,
      tagColors,
    };
  }

  /** @param {string} value @param {string} [origin] */
  function shareUrl(value, origin = "https://www.gog.com/en/games") {
    return `${origin}#${SHARE_PREFIX}${value}`;
  }

  /** The fragment value of a `#gogplus-pack=…` hash, or null. @param {string} hash */
  function shareValueFromHash(hash) {
    const h = hash.replace(/^#/, "");
    return h.startsWith(SHARE_PREFIX) ? h.slice(SHARE_PREFIX.length) : null;
  }

  const api = { FORMAT, buildPack, validatePack, mergePack, encodeShare, decodeShare, shareUrl, shareValueFromHash };
  if (typeof window !== "undefined") window.GOGPlusPack = api;
  if (typeof self !== "undefined") self.GOGPlusPack = api;
})();
