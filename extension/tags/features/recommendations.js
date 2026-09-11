/**
 * GOG+ tag-dashboard recommendations: "What to play tonight" (a random pick
 * from the backlog, optionally narrowed by genre) and a simple genre-overlap
 * recommendation ("because you like <genre>, these backlog games match") —
 * both purely client-side, no ML, no network call, built entirely from data
 * already tracked (game-status.js's backlog/finished/playing and the genre
 * signals from lib/genres.js).
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusTagsState;
  const { $ } = window.GOGPlusTagsConstants;
  const { escapeHtml } = window.GOGPlusDomSafety;
  const { matchGenrePattern } = window.GOGPlusGenres;

  // Resolve a slug's genre bucket: prefer the confirmed value cached from an
  // actual game-page visit (state.allGenres), falling back to the same
  // slug-pattern heuristic used for card styling elsewhere (lib/genres.js).
  /**
   * @param {string} slug
   * @returns {string | null}
   */
  function genreFor(slug) {
    return state.allGenres[slug] || matchGenrePattern(slug) || null;
  }

  /**
   * @returns {string[]}
   */
  function backlogSlugs() {
    return Object.keys(state.allStatus).filter((slug) => state.allStatus[slug] === "backlog");
  }

  // A random pick from the backlog, optionally narrowed to one genre bucket.
  // Returns null when nothing matches.
  /**
   * @param {string | null} [genre]
   * @returns {string | null}
   */
  function pickTonight(genre) {
    let pool = backlogSlugs();
    if (genre) pool = pool.filter((slug) => genreFor(slug) === genre);
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Genre counts across games the user has actually engaged with — tagged
  // (any tag at all), or marked "finished"/"playing". This is the entire
  // "recommendation model": which genres does the user's own data say they
  // gravitate towards?
  /**
   * @returns {Record<string, number>}
   */
  function ownedGenreCounts() {
    const engaged = new Set([
      ...Object.keys(state.allTags).filter((s) => (state.allTags[s] || []).length),
      ...Object.keys(state.allStatus).filter(
        (s) => state.allStatus[s] === "finished" || state.allStatus[s] === "playing"
      ),
    ]);
    /** @type {Record<string, number>} */
    const counts = {};
    for (const slug of engaged) {
      const g = genreFor(slug);
      if (g) counts[g] = (counts[g] || 0) + 1;
    }
    return counts;
  }

  // Backlog games sharing a genre with games the user already likes, ranked
  // by how strongly that genre is represented in their engaged-games set.
  /**
   * @param {number} [limit]
   * @returns {Array<{slug: string, genre: string}>}
   */
  function recommendFromBacklog(limit = 5) {
    const counts = ownedGenreCounts();
    const topGenres = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([g]) => g);
    if (!topGenres.length) return [];
    const scored = backlogSlugs()
      .map((slug) => ({ slug, genre: genreFor(slug) }))
      .filter(/** @returns {x is {slug: string, genre: string}} */ (x) => !!x.genre && topGenres.includes(x.genre))
      .sort((a, b) => topGenres.indexOf(a.genre) - topGenres.indexOf(b.genre));
    return scored.slice(0, limit);
  }

  function renderTonightPicker() {
    const panel = $("tonightPicker");
    if (!panel) return;
    const backlog = backlogSlugs();
    if (!backlog.length) {
      panel.innerHTML = "";
      panel.hidden = true;
      return;
    }
    panel.hidden = false;

    /** @type {Record<string, number>} */
    const genreCounts = {};
    for (const slug of backlog) {
      const g = genreFor(slug);
      if (g) genreCounts[g] = (genreCounts[g] || 0) + 1;
    }
    const genreOptions = Object.keys(genreCounts)
      .sort()
      .map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)} (${genreCounts[g]})</option>`)
      .join("");

    const recs = recommendFromBacklog(3);
    const slugToTitle = window.GOGPlusTagsGamesList.slugToTitle;

    panel.innerHTML = `
      <header class="tonight-header">
        <span class="tonight-eyebrow">Feeling indecisive?</span>
        <h2>What to play tonight</h2>
        <p class="tonight-sub">${backlog.length} game${backlog.length === 1 ? "" : "s"} in your backlog.</p>
      </header>
      <div class="tonight-controls">
        <select id="tonightGenre" aria-label="Filter by genre">
          <option value="">Any genre</option>
          ${genreOptions}
        </select>
        <button id="tonightPick" type="button">🎲 Pick something</button>
      </div>
      <div id="tonightResult" class="tonight-result" role="status"></div>
      ${
        recs.length
          ? `<div class="tonight-recs">
              <span class="tonight-recs-label">Because you like ${escapeHtml(recs[0].genre)}:</span>
              ${recs
                .map(
                  (r) =>
                    `<a class="tonight-rec-chip" href="https://www.gog.com/en/game/${encodeURIComponent(r.slug)}" target="_blank" rel="noopener">${escapeHtml(slugToTitle(r.slug))}</a>`
                )
                .join("")}
            </div>`
          : ""
      }
    `;

    $("tonightPick").addEventListener("click", () => {
      const genreSel = /** @type {HTMLSelectElement} */ ($("tonightGenre"));
      const genre = genreSel.value || null;
      const pick = pickTonight(genre);
      const result = $("tonightResult");
      if (!pick) {
        result.textContent = genre ? "No backlog games in that genre." : "Your backlog is empty!";
        return;
      }
      result.innerHTML = `<a href="https://www.gog.com/en/game/${encodeURIComponent(pick)}" target="_blank" rel="noopener">${escapeHtml(slugToTitle(pick))} →</a>`;
    });
  }

  window.GOGPlusTagsRecommendations = {
    genreFor,
    backlogSlugs,
    pickTonight,
    ownedGenreCounts,
    recommendFromBacklog,
    renderTonightPicker,
  };
})();
