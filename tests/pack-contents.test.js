import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resetEnv, getLocal, tick, state } from "./helpers/content-env.js";
import { gamePageHtml } from "./helpers/fixtures.js";

const K = () => window.GOGPlusKnowledge;
const Deals = () => window.GOGPlusDeals;
const SLUG = "lands_of_lore_1_2";
const text = (el) => el?.textContent.replace(/\s+/g, " ").trim();

const CHILDREN = [
  { id: "1", slug: "lands_of_lore_the_throne_of_chaos", title: "Lands of Lore: The Throne of Chaos" },
  { id: "2", slug: "lands_of_lore_guardians_of_destiny", title: "Lands of Lore: Guardians of Destiny" },
];

/** api.gog.com/v2 answers: the pack, then each child by id. */
function mockProductApi({ pack = true } = {}) {
  const children = { 1: "lands_of_lore_the_throne_of_chaos", 2: "lands_of_lore_guardians_of_destiny" };
  globalThis.fetch = vi.fn(async (url) => {
    const id = /games\/(\d+)/.exec(url)[1];
    const body =
      id === "1207658980"
        ? { _links: pack ? { includesGames: [{ href: "https://api.gog.com/v2/games/1" }, { href: "https://api.gog.com/v2/games/2" }] } : {} }
        : { _embedded: { product: { title: `Child ${id}` } }, _links: { store: { href: `https://www.gog.com/en/game/${children[id]}` } } };
    return { ok: true, status: 200, json: async () => body };
  });
}

beforeEach(() => {
  resetEnv({ path: `/en/game/${SLUG}`, bodyClass: "productcard _prices-in-usd user-logged-in" });
  K()._internals.packLookups.clear();
  document.body.innerHTML = gamePageHtml({ productId: "1207658980" });
});
afterEach(() => vi.restoreAllMocks());

describe("pure helpers", () => {
  it("packInfoFresh: only a recent answer with a children list counts", () => {
    const now = Date.now();
    expect(Deals().packInfoFresh({ t: now - 1000, children: [] }, now)).toBe(true);
    expect(Deals().packInfoFresh({ t: now - Deals().PACK_TTL_MS - 1, children: [] }, now)).toBe(false);
    expect(Deals().packInfoFresh({ t: now }, now)).toBe(false);
    expect(Deals().packInfoFresh(undefined, now)).toBe(false);
  });

  it("packOverlap splits a pack into owned and missing", () => {
    const r = Deals().packOverlap(CHILDREN, { [CHILDREN[0].slug]: "2026-01-01" });
    expect(r.total).toBe(2);
    expect(r.owned.map((c) => c.slug)).toEqual([CHILDREN[0].slug]);
    expect(r.missing.map((c) => c.slug)).toEqual([CHILDREN[1].slug]);
    expect(r.allOwned).toBe(false);
    expect(Deals().packOverlap(CHILDREN, { [CHILDREN[0].slug]: 1, [CHILDREN[1].slug]: 1 }).allOwned).toBe(true);
    expect(Deals().packOverlap([], {}).allOwned).toBe(false);
  });

  it("ownedPacksContaining finds owned packs that include a game", () => {
    const packInfo = { pack_a: { children: CHILDREN }, pack_b: { children: [CHILDREN[0]] }, pack_c: { children: [] } };
    expect(Deals().ownedPacksContaining(CHILDREN[0].slug, packInfo, { pack_a: 1 })).toEqual(["pack_a"]);
    expect(Deals().ownedPacksContaining(CHILDREN[0].slug, packInfo, { pack_a: 1, pack_b: 1 })).toEqual(["pack_a", "pack_b"]);
    expect(Deals().ownedPacksContaining(CHILDREN[0].slug, packInfo, {})).toEqual([]);
    expect(Deals().ownedPacksContaining("pack_a", packInfo, { pack_a: 1 })).toEqual([]); // not itself
  });
});

describe("reading the page", () => {
  it("finds the product id and the release date", () => {
    const Dom = window.GOGPlusGogDom;
    expect(Dom.readProductId()).toBe("1207658980");
    expect(Dom.readReleaseDate()).toBe("2015-05-19");
  });

  it("falls back to the JSON-LD sku, and says null when there is no id", () => {
    const Dom = window.GOGPlusGogDom;
    document.querySelector("[card-product]").remove();
    expect(Dom.readProductId()).toBe("1207658980"); // from sku
    document.body.innerHTML = gamePageHtml();
    expect(Dom.readProductId()).toBeNull();
    document.body.innerHTML = gamePageHtml({ productId: "../../x" });
    expect(Dom.readProductId()).toBeNull();
  });
});

describe("ensurePackInfo", () => {
  it("asks GOG's product API once and caches the pack's contents", async () => {
    mockProductApi();
    expect(await K().ensurePackInfo(SLUG)).toBe(true);
    expect(state.settings.packInfo[SLUG].children.map((c) => c.slug)).toEqual(CHILDREN.map((c) => c.slug));
    expect((await getLocal("packInfo")).packInfo[SLUG].children).toHaveLength(2);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    // already fresh — no second look
    expect(await K().ensurePackInfo(SLUG)).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it("caches an ordinary game as 'contains nothing'", async () => {
    mockProductApi({ pack: false });
    expect(await K().ensurePackInfo(SLUG)).toBe(true);
    expect(state.settings.packInfo[SLUG].children).toEqual([]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not cache — or guess — when the lookup fails, and doesn't retry in the same session", async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    expect(await K().ensurePackInfo(SLUG)).toBe(false);
    expect(state.settings.packInfo[SLUG]).toBeUndefined();
    expect(await K().ensurePackInfo(SLUG)).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the switch is off, off a game page, or without an id", async () => {
    globalThis.fetch = vi.fn();
    state.settings.packContents = false;
    expect(await K().ensurePackInfo(SLUG)).toBe(false);
    state.settings.packContents = true;
    window.history.replaceState({}, "", "/en/games");
    expect(await K().ensurePackInfo(SLUG)).toBe(false);
    window.history.replaceState({}, "", `/en/game/${SLUG}`);
    document.body.innerHTML = gamePageHtml();
    expect(await K().ensurePackInfo(SLUG)).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("keeps the cache bounded, dropping the oldest answers", async () => {
    mockProductApi({ pack: false });
    const old = {};
    for (let i = 0; i < K()._internals.MAX_PACK_INFO; i++) old[`g${i}`] = { t: 1000 + i, children: [] };
    state.settings.packInfo = old;
    await K().ensurePackInfo(SLUG);
    const keys = Object.keys(state.settings.packInfo);
    expect(keys).toHaveLength(K()._internals.MAX_PACK_INFO);
    expect(keys).toContain(SLUG);
    expect(keys).not.toContain("g0");
  });
});

describe("the game panel", () => {
  const section = () => window.GOGPlusGameExtras.renderLibrarySection(SLUG);
  const now = () => Date.now();

  it("warns about the games of a pack you already own, and lists the pack", () => {
    state.settings.packInfo = { [SLUG]: { t: now(), children: CHILDREN } };
    state.settings.ownedSlugs = { [CHILDREN[0].slug]: "2026-01-01" };
    const s = section();
    expect(text(s)).toContain("⚠ You already own 1 of the 2 games in this pack: Lands of Lore: The Throne of Chaos.");
    expect(text(s.querySelector(".gog-plus-pack-list"))).toContain("✓ Lands of Lore: The Throne of Chaos");
    expect(text(s.querySelector(".gog-plus-pack-list"))).toContain("Lands of Lore: Guardians of Destiny");
    expect(s.querySelector(".is-bad")).not.toBeNull();
  });

  it("says when you already own every game in it", () => {
    state.settings.packInfo = { [SLUG]: { t: now(), children: CHILDREN } };
    state.settings.ownedSlugs = Object.fromEntries(CHILDREN.map((c) => [c.slug, "2026-01-01"]));
    expect(text(section())).toContain("⚠ You already own all 2 games in this pack.");
  });

  it("reassures when none of its games are yours", () => {
    state.settings.packInfo = { [SLUG]: { t: now(), children: CHILDREN } };
    expect(text(section())).toContain("This pack has 2 games — none of them are in your library yet.");
  });

  it("says nothing about packs for an ordinary game", () => {
    state.settings.packInfo = { [SLUG]: { t: now(), children: [] } };
    const s = section(); // (the suggested-tags row is all that is left)
    expect(s.querySelector(".gog-plus-pack-list")).toBeNull();
    expect(text(s)).not.toContain("pack");
  });

  it("tells you when a pack you own already contains this game", () => {
    const game = "lands_of_lore_the_throne_of_chaos";
    window.history.replaceState({}, "", `/en/game/${game}`);
    state.settings.packInfo = { [SLUG]: { t: now(), children: CHILDREN } };
    state.settings.ownedSlugs = { [SLUG]: "2026-01-01" };
    state.settings.gameFacts = { [SLUG]: { t: 1, title: "Lands of Lore 1+2" } };
    const s = window.GOGPlusGameExtras.renderLibrarySection(game);
    expect(text(s)).toContain("✓ Already in your library through Lands of Lore 1+2.");
  });

  it("asks for the pack's contents (once) while the panel renders", async () => {
    mockProductApi();
    section();
    section();
    await tick(10);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3); // pack + 2 children, one lookup
  });
});

describe("a bundle page names its games itself (selenium-id BundleCoverItem)", () => {
  const BUNDLE = "prince_of_persia_bundle";
  const covers = `
    <div class="bundle-covers" selenium-id="BundleCovers">
      <a selenium-id="BundleCoverItem" href="/en/game/prince_of_persia_the_sands_of_time" title="Prince of Persia®: The Sands of Time"><img alt=""></a>
      <a selenium-id="BundleCoverItem" href="/en/game/prince_of_persia_warrior_within" title="Prince of Persia: Warrior Within"><img alt=""></a>
      <a selenium-id="BundleCoverItem" href="/en/game/prince_of_persia_warrior_within" title="duplicate"><img alt=""></a>
      <a selenium-id="BundleCoverItem" href="/en/game/${BUNDLE}" title="itself"><img alt=""></a>
    </div>`;

  beforeEach(() => {
    window.history.replaceState({}, "", `/en/game/${BUNDLE}`);
    document.body.innerHTML = gamePageHtml({ productId: "1207658999" }) + covers;
  });

  it("reads the games from the covers, once each, without the bundle itself", () => {
    expect(window.GOGPlusGogDom.readBundleItems(BUNDLE)).toEqual([
      { slug: "prince_of_persia_the_sands_of_time", title: "Prince of Persia®: The Sands of Time" },
      { slug: "prince_of_persia_warrior_within", title: "Prince of Persia: Warrior Within" },
    ]);
    expect(window.GOGPlusGogDom.bundleSlugs(BUNDLE)).toEqual(["prince_of_persia_the_sands_of_time", "prince_of_persia_warrior_within"]);
  });

  it("learns the contents with no request at all", async () => {
    globalThis.fetch = vi.fn();
    expect(await K().ensurePackInfo(BUNDLE)).toBe(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(state.settings.packInfo[BUNDLE].children.map((c) => c.slug)).toEqual(["prince_of_persia_the_sands_of_time", "prince_of_persia_warrior_within"]);
    expect((await getLocal("packInfo")).packInfo[BUNDLE].children).toHaveLength(2);
  });

  it("works even without the pack-contents switch's request path — and the panel warns about what you own", async () => {
    globalThis.fetch = vi.fn();
    state.settings.ownedSlugs = { prince_of_persia_warrior_within: "2026-01-01" };
    await K().ensurePackInfo(BUNDLE);
    const s = window.GOGPlusGameExtras.renderLibrarySection(BUNDLE);
    expect(text(s)).toContain("⚠ You already own 1 of the 2 games in this pack: Prince of Persia: Warrior Within.");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("falls back to the product API on a page that has no such covers", async () => {
    document.body.innerHTML = gamePageHtml({ productId: "1207658980" });
    mockProductApi();
    window.history.replaceState({}, "", `/en/game/${SLUG}`);
    expect(await K().ensurePackInfo(SLUG)).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalled();
  });
});
