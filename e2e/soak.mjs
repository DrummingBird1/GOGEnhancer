// Soak test: the page keeps changing the way an Angular SPA does (tiles added and
// removed, prices rewritten, route changes, header ticking) for a few hundred
// cycles while the extension sorts, filters, converts and re-renders. Watches
// what a long browsing session would feel: JS heap after a forced GC, DOM nodes
// and listeners the extension owns, how long each burst of work takes, and
// whether the page ever stops settling.
//
//   node e2e/soak.mjs [cycles]       (default 150)

import { startHarness } from "./harness.mjs";

const CYCLES = Number(process.argv[2]) || 150;
const results = [];
function check(name, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${!ok && detail ? `\n      ${detail}` : ""}`);
}

const h = await startHarness({ extPath: new URL("../extension", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), viewport: { width: 1300, height: 900 } });
await h.setSettings({
  sync: { targetCurrency: "ILS", rates: { ILS: 4 }, currencyConverter: true, catalogTools: true, wishlistFilters: true, wishlistSmart: true, keyboardNav: true, priceHistoryTracking: true, priceCompareTable: false },
  local: { priceHistory: {}, notInterested: {} },
});

async function heapMB(page, cdp) {
  await cdp.send("HeapProfiler.collectGarbage");
  await cdp.send("HeapProfiler.collectGarbage");
  const { metrics } = await cdp.send("Performance.getMetrics");
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  return { heap: m.JSHeapUsedSize / 1048576, nodes: m.Nodes, listeners: m.JSEventListeners };
}

async function soak(label, path, cycleFn, heavyEvery = 0) {
  console.log(`\n${label} — ${CYCLES} cycles`);
  const page = await h.context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`https://www.gog.com${path}`);
  await new Promise((r) => setTimeout(r, 1500));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const first = await heapMB(page, cdp);
  const times = [];
  const heavy = []; // cycles that also re-sort / re-filter
  let mid = null;
  for (let i = 0; i < CYCLES; i++) {
    const t0 = Date.now();
    await cycleFn(page, i);
    (heavyEvery && i % heavyEvery === 0 ? heavy : times).push(Date.now() - t0);
    if (i === Math.floor(CYCLES / 3)) {
      await new Promise((r) => setTimeout(r, 1500)); // let the page settle, as at the end
      mid = await heapMB(page, cdp);
    }
  }
  // End in the same phase as the mid sample (the route test alternates between two pages).
  const midIdx = Math.floor(CYCLES / 3);
  await cycleFn(page, CYCLES + ((((midIdx - CYCLES) % 2) + 2) % 2));
  await new Promise((r) => setTimeout(r, 1500));
  const last = await heapMB(page, cdp);
  const grow = last.heap - (mid?.heap ?? first.heap);
  const sorted = [...times].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const heavyMax = heavy.length ? Math.max(...heavy) : 0;
  if (heavy.length) console.log(`      re-sort cycles (ms): ${heavy.join(" ")}`);
  console.log(`      heap ${first.heap.toFixed(1)} → ${mid.heap.toFixed(1)} → ${last.heap.toFixed(1)} MB · nodes ${first.nodes} → ${mid.nodes} → ${last.nodes} · listeners ${first.listeners} → ${mid.listeners} → ${last.listeners} · cycle p95 ${p95} ms`);
  check(`${label}: the heap stops growing (${grow.toFixed(1)} MB over the last two thirds)`, grow < 15, `${grow.toFixed(1)} MB`);
  const own = await page.evaluate(() => ({ ours: document.querySelectorAll("[class*='gog-plus-']").length, panels: document.querySelectorAll('#gog-plus-gamepanel').length, bars: document.querySelectorAll('#gog-plus-catbar, #gog-plus-wlfilters').length }));
  check(`${label}: the extension's own elements do not pile up (${own.ours}; nodes ${mid.nodes} → ${last.nodes} from the first third to the end)`, last.nodes < mid.nodes * 1.15 + 200 && own.panels <= 1 && own.bars <= 1, JSON.stringify(own));
  check(`${label}: listeners do not pile up from the first third to the end (${mid.listeners} → ${last.listeners})`, last.listeners < mid.listeners * 1.3 + 100, `${mid.listeners} → ${last.listeners}`);
  check(`${label}: a cycle stays quick (p95 ${p95} ms)`, p95 < 800, `${p95} ms`);
  if (heavy.length) check(`${label}: even a cycle that re-sorts stays under 3 s (worst ${heavyMax} ms)`, heavyMax < 3000, `${heavyMax} ms`);
  check(`${label}: no uncaught errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  // and the page settles: no work without a change
  const settled = await page.evaluate(async () => {
    const before = document.querySelectorAll("*").length;
    await new Promise((r) => setTimeout(r, 2500));
    return document.querySelectorAll("*").length - before;
  });
  check(`${label}: once the changes stop the page stops changing (${settled} nodes moved)`, Math.abs(settled) <= 3, String(settled));
  await page.close();
}

await soak("catalog (400 tiles)", "/en/games/big400", async (page, i) => {
  await page.evaluate((i) => {
    const grid = document.querySelector("[class*='paginated-products-grid'], .products-grid, product-tile")?.closest("[class*='grid']") || document.body;
    // the site rewrites some prices, drops some tiles and adds some
    const tiles = [...document.querySelectorAll("product-tile")];
    for (let k = 0; k < 20; k++) {
      const t = tiles[(i * 7 + k) % tiles.length];
      const p = t?.querySelector("price-value .final-value, [class*='final-amount']");
      if (p && !p.children.length) p.textContent = `${(9 + ((i + k) % 20)).toFixed(2)}`;
    }
    if (tiles.length > 380 && i % 3 === 0) for (let k = 0; k < 15; k++) tiles[tiles.length - 1 - k]?.remove();
    if (i % 3 === 1) for (let k = 0; k < 15; k++) { const c = tiles[k]?.cloneNode(true); if (c) { c.querySelector("a")?.setAttribute("href", `/en/game/soak_${i}_${k}`); grid.appendChild(c); } }
    const clock = document.getElementById("clock");
    if (clock) clock.textContent = new Date().toISOString().slice(11, 19);
  }, i);
  if (i % 10 === 0) {
    await page.selectOption("#gog-plus-cat-sort", ["price-asc", "discount", "price-desc", "default"][(i / 10) % 4], { timeout: 3000 });
  }
  await new Promise((r) => setTimeout(r, 40));
}, 10);

await soak("wishlist", "/en/account/wishlist", async (page, i) => {
  await page.evaluate((i) => {
    for (const el of document.querySelectorAll(".product-row__price-final, .product-row-price span")) if (!el.children.length && /\d/.test(el.textContent)) el.textContent = `${(5 + (i % 9)).toFixed(2)}`;
  }, i);
  if (i % 12 === 0) await page.click('#gog-plus-wlfilters button[data-wl-filter="hide-owned"]').catch(() => {});
  await new Promise((r) => setTimeout(r, 40));
});

await soak("game page, route changes", "/en/game/alpha_game", async (page, i) => {
  await page.evaluate((i) => {
    // the SPA swaps to another game and back without a page load
    const slug = i % 2 ? "alpha_game" : "other_game";
    history.pushState({}, "", `/en/game/${slug}`);
    const t = document.querySelector("h1");
    if (t) t.textContent = i % 2 ? "Alpha Game" : "Other Game";
    const p = document.querySelector('[selenium-id="ProductFinalPrice"]');
    if (p) p.textContent = (10 + (i % 15)).toFixed(2);
  }, i);
  await new Promise((r) => setTimeout(r, 120));
});

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await h.cleanup();
process.exit(failed ? 1 : 0);
