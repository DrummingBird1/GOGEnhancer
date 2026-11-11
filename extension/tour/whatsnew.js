/**
 * "GOG Enhancer was updated" — opened in a new tab by background.js after every
 * update, so nobody has to wonder whether it happened. Lists the changelog of every
 * version since the one they had (`?from=`), in their interface language.
 */
// @ts-check

(() => {
  "use strict";

  const $ = /** @type {(id: string) => any} */ ((id) => document.getElementById(id));
  const tx = (/** @type {string} */ s) => window.GOGPlusPageI18n?.tx(s) ?? s;
  const MAX_PER_VERSION = 14;

  async function init() {
    const s = await window.GOGPlusStorage.get({ uiLanguage: "en" });
    const lang = s.uiLanguage || "en";
    const current = chrome.runtime.getManifest().version;
    const from = new URLSearchParams(location.search).get("from") || "";
    const api = window.GOGPlusChangelog;
    let versions = api ? api.versionsSince(from, current) : [];
    if (!versions.length && api && api.CHANGELOG[current]) versions = [current];

    $("wnPill").textContent = `GOG Enhancer ${current}`;
    $("wnIntro").textContent = from ? `Version ${from} → ${current}. Here is what changed:` : `You now have version ${current}. Here is what changed:`;

    const body = $("wnBody");
    for (const v of versions) {
      if (versions.length > 1) {
        const h = document.createElement("h2");
        h.className = "wn-version";
        h.textContent = `v${v}`;
        body.appendChild(h);
      }
      const ul = document.createElement("ul");
      ul.className = "wn-list";
      for (const text of (api.CHANGELOG[v] || []).slice(0, MAX_PER_VERSION)) {
        const li = document.createElement("li");
        li.textContent = text;
        ul.appendChild(li);
      }
      body.appendChild(ul);
    }
    window.GOGPlusI18n?.apply(lang);
    $("wnClose").addEventListener("click", () => window.close());
    void tx;
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
