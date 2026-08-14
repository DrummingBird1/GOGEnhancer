/**
 * GOG+ genre taxonomy.
 *
 * Two independent genre signals, both consumed by content.js:
 *
 *   GENRE_PATTERNS — a hand-written franchise/keyword regex per bucket,
 *     matched against a game's slug. Works for any game without a visit,
 *     but only recognizes titles someone hand-listed here.
 *
 *   GENRE_LABEL_TO_BUCKET — real genre text read off a game's own "Genre:"
 *     field (see content.js#detectGameGenreBucket), cached per slug once
 *     visited. Only covers genres confirmed to actually appear in that
 *     field (Horror, Role-playing, Strategy) — sci-fi and indie appear to
 *     live in GOG's separate, unverified "Tags" cloud instead, so they
 *     intentionally keep using GENRE_PATTERNS only.
 *
 * The cache takes priority when present; GENRE_PATTERNS is the fallback for
 * anything not yet visited (or outside the three confirmed genres) — see
 * applyCardBadges() and applyWishlistFilter() in content.js.
 */
// @ts-check

(() => {
  "use strict";

  /** @typedef {{ genre: string, re: RegExp }} GenrePattern */

  // Cyberpunk + Witcher have their own neon class so they're intentionally
  // excluded here. First match wins per slug.
  /** @type {GenrePattern[]} */
  const GENRE_PATTERNS = [
    {
      genre: "horror",
      re: /silent_hill|resident_evil|amnesia|outlast|alien_isolation|dead_space|the_evil_within|dying_light|layers_of_fear|^soma$|scorn|callisto/i,
    },
    {
      genre: "strategy",
      re: /civilization|stellaris|crusader_kings|hearts_of_iron|europa_universalis|total_war|age_of_empires|starcraft|^anno|tropico|company_of_heroes|frostpunk/i,
    },
    {
      genre: "scifi",
      re: /mass_effect|deus_ex|system_shock|^prey|subnautica|no_mans_sky|star_wars|halo|^doom|outer_wilds|outer_worlds|^stray$|disco_elysium/i,
    },
    {
      genre: "rpg",
      re: /baldurs_gate|divinity|pillars_of_eternity|pathfinder|neverwinter|planescape|dragon_age|kingdom_come|^gothic|^risen|dark_souls|elden_ring|skyrim|morrowind|oblivion|fallout|wasteland|tyranny/i,
    },
    {
      genre: "indie",
      re: /stardew|hollow_knight|cuphead|^hades|celeste|undertale|dead_cells|terraria|factorio|rimworld|^inside|^limbo|owlboy|tunic|cocoon/i,
    },
  ];

  /** @type {Record<string, string>} */
  const GENRE_LABEL_TO_BUCKET = {
    horror: "horror",
    "role-playing": "rpg",
    "role playing": "rpg",
    rpg: "rpg",
    strategy: "strategy",
    "turn-based strategy": "strategy",
    "real-time strategy": "strategy",
  };

  // Returns the first GENRE_PATTERNS bucket whose regex matches `slug`, or
  // null. Pulled out of three separate inline loops in content.js
  // (applyCardBadges, the wishlist filter-chip counts, and originally also
  // duplicated logic in applyWishlistFilter).
  /**
   * @param {string | null | undefined} slug
   * @returns {string | null}
   */
  function matchGenrePattern(slug) {
    if (!slug) return null;
    for (const { genre, re } of GENRE_PATTERNS) {
      if (re.test(slug)) return genre;
    }
    return null;
  }

  // Case/whitespace-insensitive lookup into GENRE_LABEL_TO_BUCKET. Separated
  // from the DOM-walking part of detectGameGenreBucket() so the mapping
  // itself is a pure, directly testable function.
  /**
   * @param {string | null | undefined} labelText
   * @returns {string | null}
   */
  function mapGenreLabel(labelText) {
    if (!labelText) return null;
    return GENRE_LABEL_TO_BUCKET[String(labelText).trim().toLowerCase()] || null;
  }

  const api = { GENRE_PATTERNS, GENRE_LABEL_TO_BUCKET, matchGenrePattern, mapGenreLabel };
  if (typeof window !== "undefined") window.GOGPlusGenres = api;
  if (typeof self !== "undefined") self.GOGPlusGenres = api;
})();
