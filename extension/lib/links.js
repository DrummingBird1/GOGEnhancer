/**
 * GOG+ "open in…" links — plain URLs to other sites that know about a game.
 *
 * Deliberately links only: nothing here makes a request, so it needs no host
 * permission and sends nothing anywhere until the user clicks a link
 * themselves (the same stance as the IsThereAnyDeal button on the game page).
 */
// @ts-check

(() => {
  "use strict";

  /** @typedef {{ id: string, label: string, url: string }} OpenLink */

  /**
   * @param {string} title the game's title (falls back to the slug)
   * @param {string} [slug]
   * @returns {OpenLink[]}
   */
  function openInLinks(title, slug = "") {
    const q = encodeURIComponent((title || slug.replace(/_/g, " ")).trim());
    if (!q) return [];
    return [
      { id: "itad", label: "IsThereAnyDeal", url: `https://isthereanydeal.com/search/?q=${q}` },
      { id: "steam", label: "Steam", url: `https://store.steampowered.com/search/?term=${q}` },
      { id: "pcgw", label: "PCGamingWiki", url: `https://www.pcgamingwiki.com/w/index.php?search=${q}` },
      { id: "hltb", label: "HowLongToBeat", url: `https://howlongtobeat.com/?q=${q}` },
      { id: "steamdb", label: "SteamDB", url: `https://steamdb.info/search/?a=app&q=${q}` },
    ];
  }

  const api = { openInLinks };
  if (typeof window !== "undefined") window.GOGPlusLinks = api;
  if (typeof self !== "undefined") self.GOGPlusLinks = api;
})();
