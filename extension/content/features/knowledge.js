/**
 * GOG+ knowledge: what the extension learns about games just by the user
 * browsing — which ones are already in their library, and the facts a game
 * page states (languages, ratings, time to beat, tags, last price).
 *
 * Everything here is read from pages the user opened themselves and stored
 * locally; nothing is fetched. It is what powers "hide games I own",
 * "does it have my language", "what changed since I last looked", and the
 * library statistics that need to know ownership.
 *
 * Ownership comes from three places, all of them the site's own statements:
 *   • the "IN LIBRARY" label on catalog / home tiles,
 *   • the `.owned-status` label on a game page,
 *   • the "owned" state of a wishlist row.
 * It is only ever ADDED from tiles and wishlist rows (a tile can't prove a
 * game is NOT owned when logged out); it is REMOVED only when a game page,
 * while logged in, shows the game as not in the library (a refund).
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusContentState;
  const Dom = window.GOGPlusGogDom;

  const MAX_FACTS = 800;
  /** Two page loads closer together than this are one "visit". */
  const VISIT_GAP_MS = 30 * 60 * 1000;

  const today = () => new Date().toISOString().slice(0, 10);

  /* ---------------- ownership ---------------- */

  let ownershipWrite = Promise.resolve();

  /**
   * @param {Record<string, true | string>} add slugs to mark owned
   * @param {string[]} remove slugs to unmark
   */
  function commitOwnership(add, remove) {
    const cur = state.settings.ownedSlugs || {};
    const addKeys = Object.keys(add).filter((s) => !cur[s]);
    const removeKeys = remove.filter((s) => cur[s]);
    if (!addKeys.length && !removeKeys.length) return Promise.resolve();
    const next = { ...cur };
    for (const s of addKeys) next[s] = add[s];
    for (const s of removeKeys) delete next[s];
    state.settings.ownedSlugs = next;
    // Chained so two quick passes can't write over each other.
    ownershipWrite = ownershipWrite.then(() => window.GOGPlusStorage.set({ ownedSlugs: next }));
    return ownershipWrite;
  }

  /**
   * One pass over the current page. Returns a promise that settles once any
   * write has been made.
   * @param {ParentNode} [root]
   */
  function learnOwnership(root = document) {
    if (!state.settings.ownershipLearning) return Promise.resolve();
    /** @type {Record<string, true | string>} */
    const add = {};
    /** @type {string[]} */
    const remove = [];
    const day = today();

    for (const t of Dom.catalogTiles(root)) {
      if (t.el.querySelector(".product-label--owned")) add[t.slug] = day;
    }
    for (const row of Dom.wishlistRows()) {
      const r = Dom.readWishlistRow(row);
      if (r.slug && r.owned) add[r.slug] = day;
    }
    const slug = Dom.slugFromLocation();
    if (slug && Dom.pageType() === "game") {
      const owned = Dom.isGameOwned();
      if (owned === true) add[slug] = day;
      else if (owned === false) remove.push(slug);
    }
    return commitOwnership(add, remove);
  }

  /* ---------------- game facts ---------------- */

  /** @param {any} f */
  function snapshotOf(f) {
    return { t: f.t, price: f.price || null, rating: f.rating || null, criticsPct: f.criticsPct ?? null };
  }

  /**
   * Builds the facts record for the current game page, keeping what an earlier
   * read had for anything the page hasn't rendered yet (the languages table,
   * for one, appears well after the price).
   * @param {any | undefined} old the stored record, if any
   * @param {ReturnType<typeof Dom.readGameFacts>} page
   * @param {ReturnType<typeof Dom.readGamePrices>} prices
   * @param {number} now
   */
  function buildFacts(old, page, prices, now) {
    /** @type {Record<string, {a: boolean, t: boolean}> | undefined} */
    let langs;
    if (page.languages) {
      langs = {};
      for (const [name, v] of Object.entries(page.languages)) langs[name] = { a: v.audio, t: v.text };
    }
    const hasPrice = prices.final != null;
    return {
      t: now,
      title: page.title || old?.title || undefined,
      rating: page.rating ?? old?.rating ?? null,
      criticsPct: page.criticsPct ?? old?.criticsPct ?? null,
      langs: langs ?? old?.langs,
      hours: page.timeToBeat ?? old?.hours,
      tags: page.tags.length ? page.tags.slice(0, 16) : old?.tags,
      year: page.releaseYear ?? old?.year ?? null,
      rd: page.releaseDate || old?.rd || undefined,
      // The offer end is NOT carried over: a page without one means no offer.
      pe: hasPrice ? page.promoEnd : old?.pe ?? null,
      price: hasPrice
        ? { p: prices.final, b: prices.base, l: prices.lowest30, c: prices.currency }
        : old?.price ?? null,
    };
  }

  /**
   * JSON with object keys sorted. chrome.storage hands objects back with their
   * keys in alphabetical order, while a freshly built record has them in
   * insertion order — plain JSON.stringify calls those "different", which made
   * every pass rewrite the record, which re-rendered the panel, which wrote the
   * record… (found by the end-to-end suite; happy-dom keeps insertion order and
   * never showed it).
   * @param {any} v @returns {string}
   */
  function canonical(v) {
    if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
    if (v && typeof v === "object") {
      return `{${Object.keys(v)
        .sort()
        .filter((k) => v[k] !== undefined)
        .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
        .join(",")}}`;
    }
    return JSON.stringify(v) ?? "null";
  }

  /** @param {any} a @param {any} b */
  const sameFacts = (a, b) => {
    if (!a) return false;
    const strip = (/** @type {any} */ f) => canonical({ ...f, t: 0, prev: undefined });
    return strip(a) === strip(b);
  };

  // Belt and braces: whatever makes a record look "new" on every pass, a page
  // session never writes the facts more than a handful of times a minute.
  /** @type {number[]} */
  const writeLog = [];
  const MAX_WRITES_PER_MINUTE = 6;

  /**
   * Reads the current game page and stores what changed. A "visit" boundary
   * (30 minutes since the last write) moves the previous snapshot into `prev`
   * so the panel can say what changed since then.
   * @param {string} slug
   * @param {number} [now]
   */
  async function recordGameFacts(slug, now = Date.now()) {
    if (!slug) return;
    const page = Dom.readGameFacts();
    const prices = Dom.readGamePrices();
    if (!page.title && prices.final == null) return;

    const all = state.settings.gameFacts || {};
    const old = all[slug];
    const next = /** @type {any} */ (buildFacts(old, page, prices, now));
    const newVisit = !old || now - old.t >= VISIT_GAP_MS;
    if (!newVisit && sameFacts(old, next)) return;
    next.prev = newVisit && old ? snapshotOf(old) : old?.prev;
    if (!next.prev) delete next.prev;

    const recent = writeLog.filter((t) => now - t < 60 * 1000);
    if (recent.length >= MAX_WRITES_PER_MINUTE) return;
    writeLog.length = 0;
    writeLog.push(...recent, now);

    const merged = { ...all, [slug]: next };
    const slugs = Object.keys(merged);
    if (slugs.length > MAX_FACTS) {
      slugs
        .sort((a, b) => (merged[a].t || 0) - (merged[b].t || 0))
        .slice(0, slugs.length - MAX_FACTS)
        .forEach((s) => delete merged[s]);
    }
    state.settings.gameFacts = merged;
    await window.GOGPlusStorage.set({ gameFacts: merged });
  }

  /**
   * What changed between the previous visit and now, as short lines.
   * @param {any} facts
   * @returns {string[]}
   */
  function changesSince(facts) {
    const prev = facts?.prev;
    if (!prev) return [];
    const out = [];
    const a = prev.price;
    const b = facts.price;
    if (a && b && a.c === b.c && a.p != null && b.p != null && a.p !== b.p) {
      const dir = b.p < a.p ? "dropped" : "rose";
      out.push(`Price ${dir} from ${a.p.toFixed(2)} to ${b.p.toFixed(2)} ${b.c || ""}`.trim());
    }
    if (a && b && (a.b == null) !== (b.b == null) && a.c === b.c) {
      out.push(b.b != null ? "A discount started" : "The discount ended");
    }
    if (prev.rating && facts.rating) {
      const dr = Math.round((facts.rating.score - prev.rating.score) * 10) / 10;
      const dn = facts.rating.count - prev.rating.count;
      if (dr !== 0) out.push(`Rating ${dr > 0 ? "up" : "down"} ${Math.abs(dr)} to ${facts.rating.score}`);
      if (dn > 0) out.push(`${dn} new review${dn === 1 ? "" : "s"}`);
    }
    if (prev.criticsPct != null && facts.criticsPct != null && prev.criticsPct !== facts.criticsPct) {
      out.push(`Critics' score ${facts.criticsPct > prev.criticsPct ? "up" : "down"} to ${facts.criticsPct}%`);
    }
    return out;
  }

  /* ---------------- packs ---------------- */

  const MAX_PACK_INFO = 400;
  /** Slugs already looked up (or tried) in this page session — one try each. */
  /** @type {Set<string>} */
  const packLookups = new Set();

  /**
   * Learns what the current game page's product contains, from GOG's own
   * product API, and caches it for 30 days (an ordinary game caches as []).
   * Only the numeric product id leaves the page. Does nothing when the
   * "packContents" switch is off, when the answer is still fresh, or when a
   * lookup for this slug already ran this session; a failed lookup is not
   * cached, so nothing is guessed.
   * @param {string} slug
   * @returns {Promise<boolean>} true when something new was stored
   */
  async function ensurePackInfo(slug) {
    const s = state.settings;
    if (!s.packContents || !slug || Dom.pageType() !== "game") return false;
    if (window.GOGPlusDeals.packInfoFresh(s.packInfo?.[slug]) || packLookups.has(slug)) return false;
    const id = Dom.readProductId();
    if (!id) return false;
    packLookups.add(slug);
    const children = await window.GOGPlusGogApi.fetchPackContents(id, slug);
    if (!children) return false;
    /** @type {Record<string, any>} */
    const next = { ...(s.packInfo || {}), [slug]: { t: Date.now(), children } };
    const keys = Object.keys(next);
    if (keys.length > MAX_PACK_INFO) {
      keys
        .sort((a, b) => (next[a].t || 0) - (next[b].t || 0))
        .slice(0, keys.length - MAX_PACK_INFO)
        .forEach((k) => delete next[k]);
    }
    state.settings.packInfo = next;
    await window.GOGPlusStorage.set({ packInfo: next });
    return true;
  }

  /* ---------------- not interested ---------------- */

  /**
   * @param {string} slug
   * @param {boolean} [on] omit to toggle
   * @returns {Promise<boolean>} the new state
   */
  async function setNotInterested(slug, on) {
    const cur = state.settings.notInterested || {};
    const want = on ?? !cur[slug];
    if (!!cur[slug] === want) return want;
    const next = { ...cur };
    if (want) next[slug] = today();
    else delete next[slug];
    state.settings.notInterested = next;
    await window.GOGPlusStorage.set({ notInterested: next });
    return want;
  }

  window.GOGPlusKnowledge = {
    learnOwnership,
    recordGameFacts,
    changesSince,
    setNotInterested,
    ensurePackInfo,
    _internals: { buildFacts, sameFacts, canonical, snapshotOf, MAX_FACTS, VISIT_GAP_MS, MAX_WRITES_PER_MINUTE, writeLog, packLookups, MAX_PACK_INFO },
  };
})();
