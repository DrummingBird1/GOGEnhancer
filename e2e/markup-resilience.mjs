// What happens when gog.com changes its markup under the extension: the same
// pages with class names stripped, test hooks removed, structured data gone,
// prices turned into odd text, the DOM flooded with noise, or the page emptied.
// The extension may lose a feature, but it must never throw into the page,
// never hang it, and never leave half-built UI behind — and the features that
// do not depend on the broken part must keep working.
//
//   node e2e/markup-resilience.mjs

import { startHarness } from "./harness.mjs";
import { catalogV4, gameV4, wishlistV4 } from "./fixtures-real.mjs";

const results = [];
function check(name, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${!ok && detail ? `\n      ${detail}` : ""}`);
}

const strip = (html) => html.replace(/ class="[^"]*"/g, "").replace(/ selenium-id="[^"]*"/g, "").replace(/ id="(?!gog)[^"]*"/g, "");
const VARIANTS = {
  "class names and test hooks removed": (h) => strip(h),
  "structured data and meta tags removed": (h) => h.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "").replace(/<meta [^>]*>/g, ""),
  "prices replaced by text": (h) => h.replace(/>(\d+[.,]\d\d)</g, ">price on request<"),
  "10,000 meaningless elements added": (h) => h.replace("</body>", `${"<div><span>noise 1.5</span></div>".repeat(10000)}</body>`),
  "the title heading removed": (h) => h.replace(/<h1[\s\S]*?<\/h1>/, ""),
  "everything inside <body> removed": (h) => h.replace(/<body([^>]*)>[\s\S]*<\/body>/, "<body$1></body>"),
  "a stray script that throws on load": (h) => h.replace("</body>", "<script>throw new Error('site bug')</script></body>"),
  "right-to-left direction on <html>": (h) => h.replace("<html ", '<html dir="rtl" '),
};
const PAGES = { game: ["/en/game/alpha_game", () => gameV4()], catalog: ["/en/games/v4", () => catalogV4()], wishlist: ["/en/account/wishlist", () => wishlistV4()] };

const h = await startHarness({ extPath: new URL("../extension", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
await h.setSettings({
  sync: { targetCurrency: "ILS", rates: { ILS: 4 }, currencyConverter: true, catalogTools: true, wishlistFilters: true, wishlistSmart: true, keyboardNav: true, priceCompareTable: false, hebrewTranslations: true, drmFreeBanner: true },
  local: { priceHistory: {}, notInterested: {}, failureLog: [] },
});

let variant = null;
let which = null;
for (const [name, [path]] of Object.entries(PAGES)) {
  await h.context.route(`https://www.gog.com${path}`, (route) => {
    const base = PAGES[which][1]();
    route.fulfill({ status: 200, contentType: "text/html", body: variant ? VARIANTS[variant](base) : base });
  });
}

for (const [pageName, [path]] of Object.entries(PAGES)) {
  console.log(`\n${pageName} page`);
  which = pageName;
  for (const v of Object.keys(VARIANTS)) {
    variant = v;
    const page = await h.context.newPage();
    const errors = [];
    page.on("pageerror", (e) => { if (!/site bug/.test(e.message)) errors.push(e.message); });
    page.on("console", (m) => m.type() === "error" && !/site bug|net::ERR|Failed to load/.test(m.text()) && errors.push(m.text()));
    const t0 = Date.now();
    await page.goto(`https://www.gog.com${path}`, { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 1800));
    // the page must still answer a click within a fraction of a second (the extension did not hang it)
    const lag = await page.evaluate(() => new Promise((r) => { const t = performance.now(); setTimeout(() => r(performance.now() - t), 0); }));
    const halfBuilt = await page.evaluate(() => [...document.querySelectorAll("#gog-plus-gamepanel")].filter((p) => !p.querySelector("#gog-plus-gp-body")).length);
    const stuckSkeleton = await page.evaluate(() => document.querySelectorAll(".gog-plus-panel-loading").length);
    check(`${v}: no errors thrown, page stays responsive (${lag.toFixed(0)} ms), nothing half-built`, errors.length === 0 && lag < 800 && halfBuilt === 0 && stuckSkeleton === 0, JSON.stringify({ errors: errors.slice(0, 2), lag, halfBuilt }));
    await page.close();
  }
}

// What still works when only the class names are gone (the text shape of a price is the fallback).
variant = "class names and test hooks removed";
which = "catalog";
{
  const page = await h.context.newPage();
  await page.goto("https://www.gog.com/en/games/v4");
  await new Promise((r) => setTimeout(r, 2200));
  const notes = await page.evaluate(() => document.querySelectorAll(".gog-plus-conv-note").length);
  check("class names removed: prices that carry their symbol in the text are still found by their shape and converted on the catalog", notes >= 1, String(notes));
  await page.close();
}
variant = "everything inside <body> removed";
{
  const page = await h.context.newPage();
  await page.goto("https://www.gog.com/en/game/alpha_game");
  await new Promise((r) => setTimeout(r, 1500));
  const mess = await page.evaluate(() => [...document.body.querySelectorAll("[class*='gog-plus-'], [id*='gog-plus-']")].map((e) => (e.id ? '#' + e.id : '.' + String(e.className).split(' ')[0])));
  check("an emptied page gets only the banner and the toast holder, no panels or bars", mess.every((m) => /banner|toasts|announce/.test(m)), mess.join(', '));
  await page.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await h.cleanup();
process.exit(failed ? 1 : 0);
