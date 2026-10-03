/**
 * GOG+ language names — maps the extension's UI languages (and whatever the
 * user types) onto the language names gog.com prints in a game's "Languages"
 * table, which are localised with the site's own language ("Hebrew" on /en/,
 * "Deutsch" on /de/). Pure; no DOM.
 */
// @ts-check

(() => {
  "use strict";

  /** UI language code → every name the site might use for it. */
  const ALIASES = {
    en: ["English"],
    he: ["Hebrew", "עברית"],
    ru: ["Russian", "Русский"],
    pl: ["Polish", "Polski"],
    de: ["German", "Deutsch"],
    fr: ["French", "Français", "Francais"],
    es: ["Spanish", "Español", "Espanol"],
  };

  /** @param {string} s */
  const norm = (s) => s.normalize("NFC").trim().toLowerCase();

  /**
   * The languages to look for: the user's explicit list, else the one that
   * matches their UI language.
   * @param {string[] | null | undefined} preferred
   * @param {string} [uiLanguage]
   * @returns {string[]} display names (English where known)
   */
  function preferredNames(preferred, uiLanguage = "en") {
    const explicit = (preferred || []).map((s) => s.trim()).filter(Boolean);
    if (explicit.length) return explicit;
    const own = /** @type {Record<string, string[]>} */ (ALIASES)[uiLanguage];
    return own ? [own[0]] : ["English"];
  }

  /**
   * Finds the entry of a game's language table that is `wanted`, whatever
   * name the page used for it.
   * @param {Record<string, any>} table language name → support
   * @param {string} wanted a name such as "Hebrew"
   * @returns {string | null} the key as the page spelled it
   */
  function findLanguage(table, wanted) {
    const w = norm(wanted);
    const names = new Set([w]);
    for (const list of Object.values(ALIASES)) {
      if (list.some((n) => norm(n) === w)) list.forEach((n) => names.add(norm(n)));
    }
    return Object.keys(table || {}).find((k) => names.has(norm(k))) ?? null;
  }

  const api = { ALIASES, preferredNames, findLanguage };
  if (typeof window !== "undefined") window.GOGPlusLangNames = api;
  if (typeof self !== "undefined") self.GOGPlusLangNames = api;
})();
