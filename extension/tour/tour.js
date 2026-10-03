/**
 * GOG+ v4 tour — five short slides on what changed, opened once after an update
 * from before v4 (see background.js) and again from Advanced Options. The last
 * slide can check the open gog.com tab with the same selector-health report as
 * Advanced Options → "Check this page".
 */

(() => {
  "use strict";

  /** The page's controls are looked up by id and used as inputs, buttons, … — typed loosely on purpose. */
  const $ = /** @type {(id: string) => any} */ ((id) => document.getElementById(id));
  const $$ = /** @type {(selector: string) => NodeListOf<HTMLElement>} */ ((selector) => document.querySelectorAll(selector));
  let index = 0;
  let keysBound = false;

  const slides = () => Array.from($$(".slide"));
  /** Text the tour writes itself, in the page's language — see lib/i18n-pages.js. */
  const tx = (/** @type {string} */ s) => window.GOGPlusPageI18n?.tx(s) ?? s;

  function show(i) {
    const all = slides();
    index = Math.max(0, Math.min(all.length - 1, i));
    all.forEach((s, n) => {
      s.hidden = n !== index;
    });
    $$(".tour-dot").forEach((d, n) => {
      d.classList.toggle("is-on", n === index);
      d.setAttribute("aria-selected", String(n === index));
    });
    $("tourPrev").disabled = index === 0;
    $("tourNext").textContent = tx(index === all.length - 1 ? "Done" : "Next");
  }

  function next() {
    if (index >= slides().length - 1) {
      window.close();
      return;
    }
    show(index + 1);
  }

  async function checkSite() {
    const status = $("tourCheckStatus");
    const out = $("tourCheckOutput");
    status.textContent = "Checking…";
    status.classList.remove("has-error");
    try {
      const Tools = window.GOGPlusToolsSection;
      const report = await Tools.requestReport();
      out.textContent = Tools.formatReport(report);
      out.hidden = false;
      status.textContent = report.warnings.length
        ? `${report.warnings.length} thing${report.warnings.length === 1 ? "" : "s"} to look at — see below.`
        : "Everything the extension looks for was found on that page.";
    } catch (err) {
      out.hidden = true;
      status.textContent = err instanceof Error ? err.message : String(err);
      status.classList.add("has-error");
    }
  }

  function init() {
    const dots = $("tourDots");
    slides().forEach((_, n) => {
      const d = document.createElement("button");
      d.type = "button";
      d.className = "tour-dot";
      d.setAttribute("role", "tab");
      d.setAttribute("aria-label", tx(`Slide ${n + 1}`));
      d.addEventListener("click", () => show(n));
      dots.appendChild(d);
    });
    $("tourPrev").addEventListener("click", () => show(index - 1));
    $("tourNext").addEventListener("click", next);
    $("tourSkip").addEventListener("click", () => window.close());
    $("tourOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());
    $("tourCheck").addEventListener("click", checkSite);
    // The document outlives a re-init (tests build the page repeatedly), so the
    // key handler is attached once — a second one would move two slides per press.
    if (!keysBound) {
      keysBound = true;
      document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") next();
        else if (e.key === "ArrowLeft") show(index - 1);
      });
    }
    show(0);
  }

  /** Builds the tour, then puts it in the language chosen under Advanced Options. */
  async function boot() {
    init();
    const { uiLanguage } = (await window.GOGPlusStorage?.get({ uiLanguage: "en" })) || {};
    if (uiLanguage && uiLanguage !== "en") {
      window.GOGPlusI18n?.apply(uiLanguage);
      show(index); // the buttons' own text was written before the language was known
    }
  }

  window.GOGPlusTour = { show, next, checkSite, init, boot, get index() { return index; } };
  document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
