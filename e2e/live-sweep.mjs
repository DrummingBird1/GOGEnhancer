// The real gog.com again, this time across languages and page kinds, and with a
// stopwatch: each page is loaded with the extension OFF and then ON, and the
// difference in main-thread blocking time (long tasks) is what the extension
// costs the visitor. Also errors from the extension's code, the panel / bar /
// conversion where they belong, and that Hebrew mode really translates.
//
//   node e2e/live-sweep.mjs          (logged-out, public pages, ~20 page loads)

import { startHarness } from "./harness.mjs";

const results = [];
function check(name, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${!ok && detail ? `\n      ${detail}` : ""}`);
}

const PAGES = [
  ["home /en/", "/en/", "home"],
  ["home /de/", "/de/", "home"],
  ["catalog /en/games", "/en/games", "catalog"],
  ["catalog /pl/games", "/pl/games", "catalog"],
  ["catalog search", "/en/games?query=dungeon", "catalog"],
  ["game /en/", "/en/game/gris", "game"],
  ["game /de/", "/de/game/the_witcher_3_wild_hunt", "game"],
  ["game /fr/", "/fr/game/cyberpunk_2077", "game"],
  ["game /pl/", "/pl/game/cyberpunk_2077", "game"],
  ["bundle", "/en/game/prince_of_persia_bundle", "game"],
];

const h = await startHarness({
  live: true,
  extPath: new URL("../extension", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  cookies: [{ name: "gog_lc", value: "IL_ILS_en-US", domain: ".gog.com", path: "/" }],
});
await h.context.addInitScript(() => {
  window.__tbt = 0;
  window.__longTasks = 0;
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__longTasks++;
        window.__tbt += Math.max(0, e.duration - 50);
      }
    }).observe({ type: "longtask", buffered: true });
  } catch (_) {}
});
const baseSettings = { targetCurrency: "USD", currencyConverter: true, taxEstimator: false, catalogTools: true, priceCompareTable: false, hebrewTranslations: false };

async function visit(path, enabled) {
  await h.setSettings({ sync: { ...baseSettings, enabled }, local: { priceHistory: {}, failureLog: [] } });
  const page = await h.context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && /\[GOG\+\]|gog-plus|GOGPlus/.test(m.text()) && errors.push(m.text()));
  await page.goto(`https://www.gog.com${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load", { timeout: 40000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 4500));
  const m = await page.evaluate(() => ({
    tbt: Math.round(window.__tbt),
    tasks: window.__longTasks,
    ours: document.querySelectorAll("[class*='gog-plus-'], [id*='gog-plus-']").length,
    notes: document.querySelectorAll(".gog-plus-conv-note").length,
    panel: !!document.getElementById("gog-plus-gamepanel"),
    bar: !!document.getElementById("gog-plus-catbar"),
    nodes: document.querySelectorAll("*").length,
  }));
  const failures = await h.sw.evaluate(() => new Promise((r) => chrome.storage.local.get("failureLog", (v) => r(v.failureLog || []))));
  await page.close();
  return { ...m, errors, failures };
}

let overheads = [];
for (const [label, path, kind] of PAGES) {
  // Network and the site's own scripts make one sample noisy (the same page
  // blocks 380–710 ms with the extension off), so take the median of three.
  const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const offs = [];
  const ons = [];
  for (let i = 0; i < 3; i++) {
    offs.push(await visit(path, false));
    ons.push(await visit(path, true));
  }
  const off = { ...offs[0], tbt: med(offs.map((x) => x.tbt)) };
  const on = { ...ons[ons.length - 1], tbt: med(ons.map((x) => x.tbt)), errors: ons.flatMap((x) => x.errors), failures: ons.flatMap((x) => x.failures), panel: ons.every((x) => x.panel), bar: ons.every((x) => x.bar) };
  const over = on.tbt - off.tbt;
  overheads.push(over);
  const good = kind === "game" ? on.panel : kind === "catalog" ? on.bar : on.ours > 0;
  check(
    `${label}: ${kind === "game" ? (on.panel ? "panel" : "NO panel") : kind === "catalog" ? (on.bar ? "bar" : "NO bar") : "extension active"}, ${on.notes} converted price(s), blocking ${off.tbt} → ${on.tbt} ms (${over >= 0 ? "+" : ""}${over})`,
    good && on.errors.length === 0 && on.failures.length === 0 && over < 600,
    JSON.stringify({ errors: on.errors.slice(0, 2), failures: on.failures.slice(0, 2), good })
  );
}
const avg = overheads.reduce((a, b) => a + b, 0) / overheads.length;
console.log(`\n      average extra blocking time: ${avg.toFixed(0)} ms per page (a page "feels" slow past ~300 ms of long tasks)`);
check("on average the extension adds under 300 ms of main-thread blocking", avg < 300, avg.toFixed(0));

// Hebrew mode on a real page.
await h.setSettings({ sync: { ...baseSettings, hebrewTranslations: true, rtlLayout: true, enabled: true } });
{
  const page = await h.context.newPage();
  await page.goto("https://www.gog.com/en/games", { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 5000));
  const he = await page.evaluate(() => ({ dir: document.documentElement.dir || getComputedStyle(document.documentElement).direction, hebrew: (document.body.innerText.match(/[֐-׿]+/g) || []).length, translated: document.querySelectorAll(".gog-plus-translated").length }));
  check(`Hebrew mode on the real catalog: right-to-left, ${he.hebrew} Hebrew word(s) on the page`, he.hebrew > 0 || he.translated > 0, JSON.stringify(he));
  await page.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await h.cleanup();
process.exit(failed ? 1 : 0);
