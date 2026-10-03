/**
 * GOG+ library tools — what the extension can say about a collection once it
 * knows what's in it: games like this one that you own, a backlog roulette
 * weighted by what you'd enjoy, a monthly "finished" goal, the yearly
 * "Wrapped" summary, a collector card, and a Markdown vault for Obsidian.
 *
 * Pure functions over the extension's stored data (`data` mirrors the
 * storage keys: tags, notes, gameStatus, purchaseLog, priceHistory,
 * ownedSlugs, gameFacts, gameGenres, statusDates, rates). No DOM, no I/O.
 */
// @ts-check

(() => {
  "use strict";

  const DAY_MS = 24 * 60 * 60 * 1000;

  /** @param {string} slug */
  const titleFromSlug = (slug) => slug.split("_").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");

  /** @param {Record<string, any>} data @param {string} slug */
  const titleOf = (data, slug) => data.gameFacts?.[slug]?.title || titleFromSlug(slug);

  /** @param {Record<string, any>} data @param {string} slug @returns {Set<string>} */
  function tagSet(data, slug) {
    const s = new Set();
    for (const t of data.gameFacts?.[slug]?.tags || []) s.add(String(t).toLowerCase());
    for (const t of data.tags?.[slug] || []) s.add(String(t).toLowerCase());
    return s;
  }

  /* ---------------- similar games you own ---------------- */

  /**
   * Owned games that share tags with `slug` — GOG's own tags (read from game
   * pages you opened) and your own. Needs at least two shared tags, or one
   * when the game has very few tags.
   * @param {string} slug
   * @param {Record<string, any>} data
   * @param {number} [limit]
   * @returns {Array<{ slug: string, title: string, shared: string[] }>}
   */
  function similarOwned(slug, data, limit = 5) {
    const mine = tagSet(data, slug);
    if (!mine.size) return [];
    const need = mine.size <= 2 ? 1 : 2;
    /** @type {Array<{ slug: string, title: string, shared: string[] }>} */
    const out = [];
    for (const other of Object.keys(data.ownedSlugs || {})) {
      if (other === slug) continue;
      const theirs = tagSet(data, other);
      const shared = [...mine].filter((t) => theirs.has(t));
      if (shared.length >= need) out.push({ slug: other, title: titleOf(data, other), shared });
    }
    return out.sort((a, b) => b.shared.length - a.shared.length || a.title.localeCompare(b.title)).slice(0, limit);
  }

  /* ---------------- backlog roulette ---------------- */

  /**
   * One weighted random pick.
   * @template {{ weight: number }} T
   * @param {T[]} items
   * @param {() => number} [rng] returns [0, 1)
   * @returns {T | null}
   */
  function weightedPick(items, rng = Math.random) {
    const live = items.filter((i) => i.weight > 0);
    if (!live.length) return null;
    let r = rng() * live.reduce((s, i) => s + i.weight, 0);
    for (const i of live) {
      r -= i.weight;
      if (r < 0) return i;
    }
    return live[live.length - 1];
  }

  /**
   * Weights for the backlog: everything starts at 1; well-reviewed games,
   * quick ones (main story ≤ 10 h, from GOG's time-to-beat) and games that have
   * been waiting a long time count for more.
   * @param {string[]} slugs
   * @param {Record<string, any>} data
   * @param {number} [now]
   * @returns {Array<{ slug: string, title: string, weight: number, why: string[] }>}
   */
  function backlogWeights(slugs, data, now = Date.now()) {
    return slugs.map((slug) => {
      let weight = 1;
      /** @type {string[]} */
      const why = [];
      const facts = data.gameFacts?.[slug];
      if (facts?.rating && facts.rating.score >= 4) {
        weight += (facts.rating.score - 3.5) * 2;
        why.push(`rated ${facts.rating.score}/5`);
      }
      const mainHours = parseFloat(String(facts?.hours?.Main || "").replace(",", ""));
      if (mainHours > 0 && mainHours <= 10) {
        weight += 1;
        why.push("a short one");
      }
      const raw = data.purchaseLog?.[slug];
      const date = typeof raw === "string" ? raw : raw?.date;
      const bought = date ? Date.parse(`${date}T00:00:00Z`) : NaN;
      if (Number.isFinite(bought)) {
        const years = Math.min(3, Math.max(0, (now - bought) / (365 * DAY_MS)));
        if (years >= 0.5) {
          weight += years * 0.5;
          why.push("waiting a while");
        }
      }
      return { slug, title: titleOf(data, slug), weight, why };
    });
  }

  /* ---------------- monthly goal ---------------- */

  /**
   * @param {{ statusDates?: Record<string, { finished?: string }>, goal: number, now?: number }} p
   * @returns {{ finished: number, goal: number, pct: number, daysLeft: number, onTrack: boolean }}
   */
  function monthlyProgress({ statusDates = {}, goal, now = Date.now() }) {
    const d = new Date(now);
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const finished = Object.values(statusDates).filter((s) => s?.finished?.startsWith(month)).length;
    const daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    const daysLeft = daysInMonth - d.getUTCDate();
    const pct = goal > 0 ? Math.min(100, Math.round((finished / goal) * 100)) : 0;
    // On track = at least the share of the goal that the elapsed share of the month calls for.
    const elapsed = d.getUTCDate() / daysInMonth;
    return { finished, goal, pct, daysLeft, onTrack: goal > 0 && finished >= Math.floor(goal * elapsed) };
  }

  /* ---------------- Wrapped ---------------- */

  /**
   * @param {Record<string, any>} data
   * @param {number} year
   * @param {{ target: string }} opts currency the money figures are in
   */
  function wrappedStats(data, year, { target }) {
    const rates = data.rates || {};
    /** @param {number} amt @param {string} cur */
    const conv = (amt, cur) => {
      if (cur === target) return amt;
      const s = cur === "USD" ? 1 : rates[cur];
      const t = target === "USD" ? 1 : rates[target];
      return s > 0 && t > 0 ? (amt / s) * t : null;
    };
    const y = String(year);
    /** @type {Array<{ slug: string, date: string, paid: number | null }>} */
    const bought = [];
    for (const [slug, raw] of Object.entries(data.purchaseLog || {})) {
      const e = typeof raw === "string" ? { date: raw } : /** @type {any} */ (raw);
      if (!e?.date?.startsWith(y)) continue;
      bought.push({ slug, date: e.date, paid: typeof e.price === "number" && e.currency ? conv(e.price, e.currency) : null });
    }
    const paidRows = bought.filter((b) => b.paid !== null);
    const spent = paidRows.reduce((s, b) => s + /** @type {number} */ (b.paid), 0);
    const finished = Object.entries(data.statusDates || {})
      .filter(([, s]) => /** @type {any} */ (s)?.finished?.startsWith(y))
      .map(([slug]) => slug);

    /** @type {Map<string, number>} */
    const tagCount = new Map();
    for (const b of bought) for (const t of data.tags?.[b.slug] || []) tagCount.set(t, (tagCount.get(t) || 0) + 1);
    const topTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([tag, count]) => ({ tag, count }));

    /** @type {Map<string, number>} */
    const genreCount = new Map();
    for (const b of bought) {
      const g = data.gameGenres?.[b.slug];
      if (g) genreCount.set(g, (genreCount.get(g) || 0) + 1);
    }
    const topGenre = [...genreCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const byMonth = Array.from({ length: 12 }, () => 0);
    for (const b of bought) byMonth[parseInt(b.date.slice(5, 7), 10) - 1]++;

    const priciest = paidRows.slice().sort((a, b) => /** @type {number} */ (b.paid) - /** @type {number} */ (a.paid))[0] || null;
    const cheapest = paidRows.slice().sort((a, b) => /** @type {number} */ (a.paid) - /** @type {number} */ (b.paid))[0] || null;

    return {
      year,
      currency: target,
      bought: bought.length,
      spent,
      averagePaid: paidRows.length ? spent / paidRows.length : 0,
      finished: finished.length,
      topTags,
      topGenre,
      byMonth,
      priciest: priciest && { slug: priciest.slug, title: titleOf(data, priciest.slug), paid: /** @type {number} */ (priciest.paid) },
      cheapest: cheapest && { slug: cheapest.slug, title: titleOf(data, cheapest.slug), paid: /** @type {number} */ (cheapest.paid) },
    };
  }

  /* ---------------- collector card ---------------- */

  /**
   * @param {Record<string, any>} data
   * @param {number} [thisYear]
   */
  function collectorCard(data, thisYear = new Date().getFullYear()) {
    const owned = Object.keys(data.ownedSlugs || {});
    /** @type {Record<string, number>} */
    const byDecade = {};
    let known = 0;
    let classic = 0;
    let oldest = null;
    /** @type {Map<string, number>} */
    const genres = new Map();
    for (const slug of owned) {
      const year = data.gameFacts?.[slug]?.year;
      if (typeof year === "number") {
        known++;
        const decade = `${Math.floor(year / 10) * 10}s`;
        byDecade[decade] = (byDecade[decade] || 0) + 1;
        if (year <= thisYear - 15) classic++;
        if (oldest === null || year < oldest.year) oldest = { slug, year, title: titleOf(data, slug) };
      }
      const g = data.gameGenres?.[slug];
      if (g) genres.set(g, (genres.get(g) || 0) + 1);
    }
    return {
      owned: owned.length,
      yearsKnown: known,
      byDecade,
      // Share of games with a known year that are at least 15 years old — the
      // "Good Old Game" ratio.
      classicPct: known ? Math.round((classic / known) * 100) : null,
      oldest,
      topGenres: [...genres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([genre, count]) => ({ genre, count })),
    };
  }

  /* ---------------- Obsidian vault ---------------- */

  /** @param {string} v */
  const yamlStr = (v) => JSON.stringify(String(v));

  /**
   * One Markdown file per game that has something to say about it (tags, a
   * note, a status, a purchase, or just being owned), plus an index. Frontmatter
   * is YAML that Obsidian's Properties and Dataview read directly.
   * @param {Record<string, any>} data
   * @param {{ now?: Date }} [opts]
   * @returns {Array<{ path: string, content: string }>}
   */
  function obsidianFiles(data, opts = {}) {
    const slugs = new Set([
      ...Object.keys(data.tags || {}).filter((s) => (data.tags[s] || []).length),
      ...Object.keys(data.notes || {}).filter((s) => data.notes[s]),
      ...Object.keys(data.gameStatus || {}),
      ...Object.keys(data.purchaseLog || {}),
      ...Object.keys(data.ownedSlugs || {}),
    ]);
    const generated = (opts.now || new Date()).toISOString().slice(0, 10);
    /** @type {Array<{ path: string, content: string }>} */
    const files = [];
    const index = ["# GOG library", "", `Exported ${generated} by GOG Enhancer — ${slugs.size} games.`, ""];

    for (const slug of [...slugs].sort()) {
      const title = titleOf(data, slug);
      const facts = data.gameFacts?.[slug];
      const raw = data.purchaseLog?.[slug];
      const purchase = typeof raw === "string" ? { date: raw } : raw;
      const tags = data.tags?.[slug] || [];
      const lines = ["---", `title: ${yamlStr(title)}`, `slug: ${yamlStr(slug)}`, `url: ${yamlStr(`https://www.gog.com/en/game/${slug}`)}`];
      if (data.gameStatus?.[slug]) lines.push(`status: ${yamlStr(data.gameStatus[slug])}`);
      lines.push(`owned: ${data.ownedSlugs?.[slug] ? "true" : "false"}`);
      if (purchase?.date) lines.push(`purchased: ${purchase.date}`);
      if (typeof purchase?.price === "number") lines.push(`paid: ${yamlStr(`${purchase.price.toFixed(2)} ${purchase.currency || ""}`.trim())}`);
      if (facts?.rating) lines.push(`rating: ${facts.rating.score}`);
      if (facts?.year) lines.push(`released: ${facts.year}`);
      if (data.gameGenres?.[slug]) lines.push(`genre: ${yamlStr(data.gameGenres[slug])}`);
      if (tags.length) lines.push(`tags: [${tags.map((t) => yamlStr(String(t).replace(/\s+/g, "-"))).join(", ")}]`);
      lines.push("---", "", `# ${title}`, "");
      if (data.notes?.[slug]) lines.push(String(data.notes[slug]), "");
      const hist = (data.priceHistory?.[slug] || []).slice(-10);
      if (hist.length) {
        lines.push("## Price history", "", "| Date | Price |", "| --- | --- |");
        for (const e of hist) lines.push(`| ${e.d} | ${e.p.toFixed(2)} ${e.c} |`);
        lines.push("");
      }
      files.push({ path: `GOG/Games/${slug}.md`, content: lines.join("\n") });
      index.push(`- [[${slug}|${title}]]${data.gameStatus?.[slug] ? ` — ${data.gameStatus[slug]}` : ""}`);
    }
    files.unshift({ path: "GOG/Index.md", content: index.join("\n") + "\n" });
    return files;
  }

  const api = {
    titleFromSlug,
    similarOwned,
    weightedPick,
    backlogWeights,
    monthlyProgress,
    wrappedStats,
    collectorCard,
    obsidianFiles,
  };
  if (typeof window !== "undefined") window.GOGPlusLibraryTools = api;
  if (typeof self !== "undefined") self.GOGPlusLibraryTools = api;
})();
