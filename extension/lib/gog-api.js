/**
 * GOG+ client for GOG's OWN public APIs — the same endpoints gog.com itself
 * calls from the page, reached through `GOGPlusNet` (so every request is
 * allow-listed, cookie-less and listed in the privacy log).
 *
 *   catalog.gog.com/v1/catalog  — a page of the catalog. Used by "endless
 *                                 scrolling" to continue the list the user is
 *                                 looking at.
 *   api.gog.com/v2/games/{id}   — one product. Used to learn which games a
 *                                 pack contains, for the "you already own
 *                                 part of this pack" warning.
 *
 * Both are optional (their own switches, off / on as documented in
 * PRIVACY.md §3.8) and both fail soft: any problem returns null and the page
 * simply stays as it is.
 *
 * This file is pure apart from the two `fetch…` functions; everything else
 * (query building, calibration, response parsing) is unit-tested.
 */
// @ts-check

(() => {
  "use strict";

  const CATALOG_URL = "https://catalog.gog.com/v1/catalog";
  const PRODUCT_URL = "https://api.gog.com/v2/games/";
  const PAGE_SIZE = 48;
  /** The most children of a pack we will look up (one request each). */
  const MAX_PACK_CHILDREN = 12;

  /**
   * Filter parameters the site's catalog URL carries, which the API takes
   * under the same name. Anything else on the page URL is ignored rather than
   * forwarded.
   */
  const PASS_PARAMS = [
    "order", "query", "genres", "tags", "systems", "languages", "features",
    "releaseStatuses", "discounted", "price", "releaseDate", "productType", "hideDlcs",
  ];

  /** Every parameter name a catalog query may carry through us. */
  const ALLOWED_PARAMS = new Set([...PASS_PARAMS, "limit", "page", "countryCode", "locale", "currencyCode"]);

  /** @type {Record<string, string>} */
  const LOCALES = {
    en: "en-US", de: "de-DE", fr: "fr-FR", pl: "pl-PL", ru: "ru-RU", es: "es-ES", it: "it-IT", pt: "pt-BR", zh: "zh-Hans",
  };

  /** @param {string} v */
  const cleanValue = (v) => String(v || "").slice(0, 200).replace(/[^\w:,.\- %]/g, "");

  /**
   * Keeps only known parameter names, with cleaned values. A query that came
   * from the page is still page-supplied text, so it is never forwarded as is.
   * @param {URLSearchParams} src
   * @returns {URLSearchParams}
   */
  function sanitizeParams(src) {
    const out = new URLSearchParams();
    let n = 0;
    for (const [k, v] of src) {
      if (!ALLOWED_PARAMS.has(k) || !v || n++ >= 24) continue;
      out.set(k, cleanValue(v));
    }
    return out;
  }

  /**
   * The catalog request(s) the page's own server-side render made, read from
   * Angular's transfer state (the JSON in <script id="gogcom-store-state">):
   * its keys are "catalog.gog/v1/catalog?…" — the exact query, including the
   * visitor's country and currency, which no URL parameter carries — and each
   * value holds the response, so the games it listed come with it.
   * @param {string} text the script's text
   * @returns {Array<{ params: URLSearchParams, page: number, slugs: string[] }>}
   */
  function catalogRequestsFromState(text) {
    if (typeof text !== "string" || text.length > 8e6) return [];
    /** @type {any} */
    let state;
    try {
      state = JSON.parse(text);
    } catch (_) {
      return [];
    }
    const out = [];
    for (const [key, value] of Object.entries(state || {})) {
      if (!key.startsWith("catalog.gog/v1/catalog?")) continue;
      const params = sanitizeParams(new URLSearchParams(key.slice(key.indexOf("?") + 1)));
      const products = /** @type {any} */ (value)?.body?.products;
      if (!Array.isArray(products)) continue;
      const page = parseInt(params.get("page") || "1", 10);
      out.push({
        params,
        page: Number.isFinite(page) && page > 0 ? page : 1,
        slugs: products.map((/** @type {any} */ p) => p?.slug).filter((/** @type {any} */ s) => typeof s === "string"),
      });
    }
    return out;
  }

  /**
   * The query the PAGE itself last sent to the catalog API, if any — read from
   * the resource timeline (a content script can see it; it shares the page's
   * performance entries). Returns null when the page was server-rendered and
   * has made no catalog request yet.
   * @param {Array<{ name: string }>} entries performance.getEntriesByType("resource")
   * @returns {URLSearchParams | null}
   */
  function queryFromResources(entries) {
    for (let i = entries.length - 1; i >= 0; i--) {
      const name = entries[i]?.name || "";
      if (!name.startsWith(`${CATALOG_URL}?`)) continue;
      try {
        return sanitizeParams(new URL(name).searchParams);
      } catch (_) {
        /* keep looking */
      }
    }
    return null;
  }

  /**
   * A query built from the page's own URL — the fallback for a server-rendered
   * first load.
   * @param {string} search location.search
   * @returns {URLSearchParams}
   */
  function queryFromLocation(search) {
    const src = new URLSearchParams(search);
    const out = new URLSearchParams();
    for (const k of PASS_PARAMS) {
      const v = src.get(k);
      if (v) out.set(k, cleanValue(v));
    }
    if (!out.get("order")) out.set("order", "desc:trending");
    return out;
  }

  /**
   * @param {URLSearchParams} base
   * @param {number} page 1-based
   * @param {{ locale?: string, currency?: string, country?: string }} [env]
   * @returns {string}
   */
  function pageUrl(base, page, env = {}) {
    const q = new URLSearchParams(base);
    q.set("limit", String(PAGE_SIZE));
    q.set("page", String(Math.max(1, Math.floor(page))));
    // What the page's own request already said wins over our guess.
    if (env.locale && !q.has("locale")) q.set("locale", env.locale);
    if (env.currency && /^[A-Z]{3}$/.test(env.currency) && !q.has("currencyCode")) q.set("currencyCode", env.currency);
    if (env.country && /^[A-Z]{2}$/.test(env.country) && !q.has("countryCode")) q.set("countryCode", env.country);
    return `${CATALOG_URL}?${q.toString()}`;
  }

  /**
   * The API locale for a catalog path ("/en/games" → "en-US").
   * @param {string} pathname
   */
  function localeFromPath(pathname) {
    const m = /^\/([a-z]{2})(?:\/|$)/.exec(pathname || "");
    return (m && LOCALES[m[1]]) || "en-US";
  }

  /** The page number in a catalog URL (1 when absent). @param {string} search */
  function pageFromLocation(search) {
    const n = parseInt(new URLSearchParams(search).get("page") || "1", 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  /**
   * Does a fetched page of results continue the list the user is looking at?
   * The API's order can differ from the site's by a place or two ("trending"
   * is not perfectly stable), so this asks for MOST of the games on screen to
   * be in the response, not an exact match. This is the safety catch for
   * endless scrolling: if we can't prove the query is the same list, we don't
   * append anything.
   * @param {string[]} domSlugs slugs of the tiles on screen
   * @param {string[]} apiSlugs slugs the API returned for the same page number
   */
  function sameList(domSlugs, apiSlugs) {
    const dom = [...new Set(domSlugs)].slice(0, 12);
    if (dom.length < 4) return false;
    const api = new Set(apiSlugs);
    const hit = dom.filter((s) => api.has(s)).length;
    return hit >= Math.ceil(dom.length * 0.6);
  }

  /**
   * @typedef {Object} CatalogItem
   * @property {string} id
   * @property {string} slug
   * @property {string} title
   * @property {string} type game / pack / dlc / extras
   * @property {string} cover
   * @property {number | null} price final price, in `currency`
   * @property {number | null} base price before the discount
   * @property {number} discountPct 0 when not discounted
   * @property {string} currency
   * @property {string} releaseDate "YYYY-MM-DD" ("" when unknown)
   * @property {string[]} genres
   * @property {number | null} rating 0–5
   * @property {number} reviews
   */

  /** @param {any} v */
  const num = (v) => {
    const n = parseFloat(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  /** "2016.08.30" → "2016-08-30" @param {any} d */
  const isoDate = (d) => {
    const m = /^(\d{4})[.\-](\d{2})[.\-](\d{2})/.exec(String(d || ""));
    return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
  };

  /**
   * One product of a catalog response, reduced to what a card needs.
   * @param {any} p
   * @returns {CatalogItem | null}
   */
  function normalizeProduct(p) {
    if (!p || typeof p.slug !== "string" || !p.slug) return null;
    const final = num(p.price?.finalMoney?.amount ?? p.price?.final?.replace?.(/[^\d.,]/g, ""));
    const base = num(p.price?.baseMoney?.amount);
    const disc = parseInt(String(p.price?.discount || "").replace(/[^\d]/g, ""), 10);
    const rating = num(p.reviewsRating);
    return {
      id: String(p.id ?? ""),
      slug: p.slug,
      title: String(p.title || p.slug).slice(0, 140),
      type: String(p.productType || "game"),
      cover: typeof p.coverVertical === "string" && p.coverVertical.startsWith("https://") ? p.coverVertical : "",
      price: final,
      base: base != null && final != null && base > final ? base : null,
      discountPct: Number.isFinite(disc) ? disc : 0,
      currency: String(p.price?.finalMoney?.currency || ""),
      releaseDate: isoDate(p.releaseDate),
      genres: (Array.isArray(p.genres) ? p.genres : [])
        .map((/** @type {any} */ g) => (typeof g === "string" ? g : g?.name))
        .filter(Boolean)
        .slice(0, 3),
      rating: rating != null && rating > 0 && rating <= 5 ? rating : null,
      reviews: parseInt(String(p.reviewsCount ?? "0"), 10) || 0,
    };
  }

  /**
   * @param {any} json a catalog response
   * @returns {{ items: CatalogItem[], pages: number, total: number } | null}
   */
  function parseCatalog(json) {
    if (!json || !Array.isArray(json.products)) return null;
    const items = json.products.map(normalizeProduct).filter(Boolean);
    return { items, pages: parseInt(json.pages, 10) || 0, total: parseInt(json.productCount, 10) || 0 };
  }

  /**
   * One page of the catalog.
   * @param {string} url from `pageUrl`
   * @returns {Promise<{ items: CatalogItem[], pages: number, total: number } | null>}
   */
  async function fetchCatalogPage(url) {
    if (!url.startsWith(`${CATALOG_URL}?`)) return null;
    return parseCatalog(await window.GOGPlusNet.getJson("catalog", url));
  }

  /* ---------------- packs ---------------- */

  /**
   * Product ids a v2 product says it includes (a pack's games).
   * @param {any} v2
   * @returns {string[]}
   */
  function includedIds(v2) {
    const links = v2?._links?.includesGames;
    const list = Array.isArray(links) ? links : links ? [links] : [];
    return list
      .map((/** @type {any} */ l) => /\/games\/(\d+)/.exec(String(l?.href || ""))?.[1])
      .filter((/** @type {any} */ x) => !!x);
  }

  /** @param {any} v2 @returns {string} */
  function storeSlugOf(v2) {
    return /\/game\/([a-z0-9_]+)\/?$/.exec(String(v2?._links?.store?.href || ""))?.[1] || "";
  }

  /** @param {any} v2 @returns {string} */
  const titleOfProduct = (v2) => String(v2?._embedded?.product?.title || "").slice(0, 140);

  /**
   * What a product contains that you could ALSO own separately: [] for an
   * ordinary game, the matchable children for a pack, null when the lookup
   * failed (so the caller doesn't cache a guess).
   *
   * Many "packs" on GOG are just a game's own page, holding hidden component
   * products whose store link points back at the pack itself (checked on the
   * live API: Lands of Lore 1+2, The Witcher 3 GOTY). Those children have no
   * page or library entry of their own, so they can't be matched against what
   * you own and are left out; so are repeats.
   * @param {string} productId
   * @param {string} [ownSlug] the slug of the page being asked about
   * @returns {Promise<Array<{ id: string, slug: string, title: string }> | null>}
   */
  async function fetchPackContents(productId, ownSlug = "") {
    if (!/^\d{3,12}$/.test(productId)) return null;
    const Net = window.GOGPlusNet;
    const product = await Net.getJson("product", `${PRODUCT_URL}${productId}?locale=en-US`);
    if (!product) return null;
    const ids = includedIds(product).slice(0, MAX_PACK_CHILDREN);
    /** @type {Array<{ id: string, slug: string, title: string }>} */
    const out = [];
    const seen = new Set([ownSlug]);
    for (const id of ids) {
      const child = await Net.getJson("product", `${PRODUCT_URL}${id}?locale=en-US`);
      const slug = storeSlugOf(child);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      out.push({ id, slug, title: titleOfProduct(child) || slug.replace(/_/g, " ") });
    }
    return out;
  }

  const Api = {
    CATALOG_URL, PRODUCT_URL, PAGE_SIZE, MAX_PACK_CHILDREN, PASS_PARAMS,
    sanitizeParams, catalogRequestsFromState,
    queryFromResources, queryFromLocation, pageUrl, localeFromPath, pageFromLocation, sameList,
    normalizeProduct, parseCatalog, fetchCatalogPage,
    includedIds, storeSlugOf, titleOfProduct, fetchPackContents,
  };
  if (typeof window !== "undefined") /** @type {any} */ (window).GOGPlusGogApi = Api;
  if (typeof self !== "undefined") /** @type {any} */ (self).GOGPlusGogApi = Api;
})();
