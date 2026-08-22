/**
 * GOG+ game status vocabulary — Playing / Backlog / Finished.
 *
 * A fixed-vocabulary status per game, distinct from free-form tags: tags
 * answer "how did I categorize this" (genre, mood, whatever the user
 * invents), status answers "what am I actually doing with it" from a
 * small closed set. Shared between the tag dashboard
 * (tags/features/games-list.js) and the on-page game panel
 * (content/features/game-page.js) so both surfaces use the exact same
 * three states, labels, and colors.
 *
 * Storage key: gameStatus (local) — { slug: "playing" | "backlog" | "finished" }
 */
// @ts-check

(() => {
  "use strict";

  /** @type {Array<{ id: string, label: string, icon: string, color: string }>} */
  const STATUSES = [
    { id: "playing", label: "Playing", icon: "▶", color: "#7fffa6" },
    { id: "backlog", label: "Backlog", icon: "📥", color: "#00f0ff" },
    { id: "finished", label: "Finished", icon: "✓", color: "#c64fff" },
  ];

  /**
   * @param {string | null | undefined} id
   * @returns {{ id: string, label: string, icon: string, color: string } | null}
   */
  function statusById(id) {
    return STATUSES.find((s) => s.id === id) || null;
  }

  const api = { STATUSES, statusById };
  if (typeof window !== "undefined") window.GOGPlusGameStatus = api;
  if (typeof self !== "undefined") self.GOGPlusGameStatus = api;
})();
