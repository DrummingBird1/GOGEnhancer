/**
 * GOG+ options page: the small controls that don't belong in options.js —
 * the two opt-in gog.com toggles (keyboard navigation, system check) and the
 * "Check this page" selector-health report.
 *
 * The report works by asking a content script that's already running on a
 * gog.com tab what its lookups found (GOGPlusGogDom.diagnose()) — so it
 * reflects exactly what the extension sees on the live page, which is the
 * thing you can't reproduce from a bug report that just says "it broke".
 */

(() => {
  "use strict";

  /** The page's controls are looked up by id and used as inputs, buttons, … — typed loosely on purpose. */
  const $ = /** @type {(id: string) => any} */ ((id) => document.getElementById(id));

  const TOGGLES = ["keyboardNav", "sysReqCheck"];

  /**
   * The most recently used gog.com tab — the one the user was just looking at
   * before coming to the options page.
   * @param {Array<{ id?: number, active?: boolean, lastAccessed?: number }>} tabs
   */
  function pickTab(tabs) {
    const usable = tabs.filter((t) => typeof t.id === "number");
    if (!usable.length) return null;
    return [...usable].sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
  }

  /** @param {any} d the object GOGPlusGogDom.diagnose() returns */
  function formatReport(d) {
    const hints = Object.entries(d.framework || {})
      .filter(([, on]) => on)
      .map(([name]) => name);
    const lines = [
      `GOG Enhancer diagnostics (v${d.extensionVersion})`,
      `Page: ${d.path} (${d.pageType})`,
      `Framework hints: ${hints.length ? hints.join(", ") : "none"}`,
      `Observed root: ${d.observedRoot || "none"}`,
      `Game cards: ${d.cards.total} found, ${d.cards.withImage} with a cover image`,
      `Prices: ${d.prices.count} found via ${d.prices.strategy}${
        d.prices.sample.length ? ` — e.g. ${d.prices.sample.map((s) => `"${s}"`).join(", ")}` : ""
      }`,
      `Game title: ${d.title.found ? `found via ${d.title.strategy}` : "not found"}`,
      `Panel position: ${d.panelAnchor ? `via ${d.panelAnchor}` : "not found"}`,
      `Applied so far: ${d.applied.cards} cards, ${d.applied.convertedPrices} converted prices, game panel ${d.applied.gamePanel ? "yes" : "no"}`,
      ...(d.perf && d.perf.passes
        ? [
            `Speed: ${d.perf.passes} passes, slowest ${Math.round(d.perf.maxMs)} ms${
              Object.entries(d.perf.features || {})
                .sort((a, b) => b[1].maxMs - a[1].maxMs)
                .slice(0, 1)
                .map(([name, f]) => ` (${name} ${Math.round(f.maxMs)} ms)`)
                .join("")
            }`,
          ]
        : []),
      "",
      d.warnings.length
        ? `${d.warnings.length} issue${d.warnings.length === 1 ? "" : "s"} found:\n${d.warnings.map((w) => `  ! ${w}`).join("\n")}`
        : "No problems found on this page.",
    ];
    return lines.join("\n");
  }

  /** @returns {Promise<any>} the diagnose() report from the best gog.com tab */
  function requestReport() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ url: "https://www.gog.com/*" }, (tabs) => {
        const tab = pickTab(tabs || []);
        if (!tab) {
          reject(new Error("Open a gog.com page first, then press this button."));
          return;
        }
        chrome.tabs.sendMessage(tab.id, { type: "gog-plus-diagnose" }, (response) => {
          if (chrome.runtime.lastError || !response) {
            reject(
              new Error(
                "That tab didn't answer. Reload the gog.com page (the extension only runs on pages loaded after it was installed or updated) and try again."
              )
            );
            return;
          }
          resolve(response);
        });
      });
    });
  }

  async function refreshToggles() {
    const s = await window.GOGPlusStorage.get(TOGGLES);
    for (const id of TOGGLES) if ($(id)) $(id).checked = !!s[id];
  }

  async function init() {
    if (!$("diagBlock")) return;
    await refreshToggles();
    for (const id of TOGGLES) {
      $(id)?.addEventListener("change", () => window.GOGPlusStorage.set({ [id]: $(id).checked }));
    }
    window.GOGPlusStorage.onChange(({ key }) => {
      if (TOGGLES.includes(key)) refreshToggles();
    });

    let lastText = "";
    $("diagRun").addEventListener("click", async () => {
      $("diagStatus").textContent = "Checking…";
      $("diagStatus").classList.remove("has-error");
      try {
        const report = await requestReport();
        lastText = `${formatReport(report)}\n\n--- raw ---\n${JSON.stringify(report, null, 2)}`;
        $("diagOutput").textContent = lastText;
        $("diagOutput").hidden = false;
        $("diagCopy").hidden = false;
        $("diagStatus").textContent = report.warnings.length
          ? `${report.warnings.length} issue${report.warnings.length === 1 ? "" : "s"} found — see below.`
          : "Everything the extension looks for was found.";
      } catch (err) {
        $("diagOutput").hidden = true;
        $("diagCopy").hidden = true;
        $("diagStatus").textContent = err instanceof Error ? err.message : String(err);
        $("diagStatus").classList.add("has-error");
      }
    });

    $("diagCopy").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(lastText);
        $("diagStatus").textContent = "Report copied.";
      } catch {
        $("diagStatus").textContent = "Couldn't copy automatically — select the report text and copy it.";
        $("diagStatus").classList.add("has-error");
      }
    });
  }

  window.GOGPlusToolsSection = { pickTab, formatReport, requestReport, init };

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
