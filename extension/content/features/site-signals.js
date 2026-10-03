/**
 * GOG+ site signals — small things the content script notices on gog.com and
 * hands to the rest of the extension:
 *
 *   • A store-wide sale advertised on the home page ("8000+ deals up to
 *     -95%", "Autumn Sale") → the service worker, which decides whether to
 *     notify (opt-in "Season radar"; honours quiet hours and the daily digest).
 *   • A tag-pack share link (`…#gogplus-pack=…`) → a confirmation dialog, then
 *     a no-overwrite merge into the user's own tags. The link is untrusted
 *     input: lib/pack.js sanitises every field, and nothing is imported
 *     without the user pressing the button.
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusContentState;
  const Dom = window.GOGPlusGogDom;

  /* ---------------- sale radar ---------------- */

  let lastSaleSent = "";

  function reportSaleBanner() {
    if (!state.settings.seasonRadar || Dom.pageType() !== "home") return;
    const text = Dom.homeSaleBanner();
    if (!text || text === lastSaleSent) return;
    lastSaleSent = text;
    try {
      chrome.runtime.sendMessage({ type: "sale-radar", text });
    } catch (_) {
      /* the extension was reloaded mid-session */
    }
  }

  /* ---------------- pack share links ---------------- */

  /** @param {string} message @param {() => void} onYes */
  function confirmDialog(message, onYes) {
    // One prompt at a time: a newer link replaces an unanswered older one.
    document.querySelector("[data-gog-plus-pack]")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "gog-plus-modal-overlay";
    overlay.dataset.gogPlusPack = "";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Import a shared tag pack");
    const card = document.createElement("div");
    card.className = "gog-plus-modal gog-plus-modal--small";
    const p = document.createElement("p");
    p.textContent = message;
    const row = document.createElement("div");
    row.className = "gog-plus-modal-actions";
    const yes = document.createElement("button");
    yes.type = "button";
    yes.className = "gog-plus-bar-btn is-primary";
    yes.textContent = "Import";
    const no = document.createElement("button");
    no.type = "button";
    no.className = "gog-plus-bar-btn";
    no.textContent = "No thanks";
    const close = () => overlay.remove();
    yes.addEventListener("click", () => {
      close();
      onYes();
    });
    no.addEventListener("click", close);
    row.append(yes, no);
    card.append(p, row);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    no.focus();
  }

  async function checkPackLink() {
    const Pack = window.GOGPlusPack;
    const value = Pack?.shareValueFromHash(location.hash);
    if (!value) return;
    // The fragment has been read; take it out of the address bar so a reload
    // or a bookmark doesn't ask again.
    history.replaceState(null, "", location.pathname + location.search);
    let pack;
    try {
      pack = await Pack.decodeShare(value);
    } catch (err) {
      window.GOGPlusToasts?.show(err instanceof Error ? err.message : "That share link couldn't be read", { variant: "muted", duration: 5000 });
      return;
    }
    if (!pack.games.length) {
      window.GOGPlusToasts?.show("That shared pack has no tags in it", { variant: "muted" });
      return;
    }
    const tagCount = new Set(pack.games.flatMap((g) => g.tags)).size;
    confirmDialog(
      `Someone shared a tag pack called “${pack.name}”: ${tagCount} tag${tagCount === 1 ? "" : "s"} on ${pack.games.length} game${pack.games.length === 1 ? "" : "s"}. ` +
        "Importing adds them to your own tags — nothing you already have is changed or removed.",
      async () => {
        const cur = await window.GOGPlusStorage.get(["tags", "notes", "purchaseLog", "tagColors"]);
        const merged = Pack.mergePack(pack, cur);
        await window.GOGPlusStorage.set({ tags: merged.tags, tagColors: merged.tagColors });
        state.settings.tags = merged.tags;
        window.GOGPlusToasts?.show(`Imported ${merged.counts.tags} tag${merged.counts.tags === 1 ? "" : "s"} from “${pack.name}”`);
      }
    );
  }

  window.GOGPlusSiteSignals = { reportSaleBanner, checkPackLink };
})();
