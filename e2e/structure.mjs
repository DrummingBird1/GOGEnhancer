// Records the STRUCTURE of the live gog.com pages the extension depends on —
// never their content — and compares it with the last recording. It is how the
// recorded fixtures (fixtures-real.mjs) are kept honest, and the first thing to
// run when something breaks after a site change: it says which hook disappeared.
//
//   node e2e/structure.mjs            compare today's pages with e2e/baseline/structure.json
//   node e2e/structure.mjs --update   record today's pages as the new baseline
//
// What is recorded per page: how many elements match every selector the site
// adapter (content/gog-dom*.js) looks for, every custom element and
// `selenium-id` hook, the page's body classes that matter, the shape of the
// server-rendered state (key names only), and the keys of its JSON-LD. Public,
// logged-out pages only.
//
// Exit code 1 when a hook that used to exist is gone.

import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findChromium } from "./harness.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = resolve(ROOT, "e2e", "baseline", "structure.json");
const UPDATE = process.argv.includes("--update");

const PAGES = {
  home: { path: "/en/", wait: "product-tile" },
  catalog: { path: "/en/games", wait: "product-tile" },
  game: { path: "/en/game/gris", wait: '[selenium-id="ProductFinalPrice"]' },
  bundle: { path: "/en/game/prince_of_persia_bundle", wait: '[selenium-id="ProductFinalPrice"]' },
};

/** Every CSS selector string the adapter passes to querySelector / querySelectorAll / closest / matches. */
export function adapterSelectors() {
  const src = ["content/gog-dom.js", "content/gog-dom-facts.js"].map((f) => readFileSync(resolve(ROOT, "extension", f), "utf8")).join("\n");
  const out = new Set();
  for (const m of src.matchAll(/(?:querySelector(?:All)?|closest|matches)\(\s*(["'`])((?:(?!\1)[^\\\n]|\\.){2,200}?)\1/g)) {
    const sel = m[2].replace(/\\(["'`])/g, "$1");
    if (!sel.includes("${")) out.add(sel);
  }
  return [...out].sort();
}

/** @param {import("playwright-core").Page} page @param {string[]} selectors */
async function record(page, selectors) {
  return page.evaluate((selectors) => {
    const count = (sel) => {
      try {
        return document.querySelectorAll(sel).length;
      } catch (_) {
        return -1; // not a valid selector in this browser
      }
    };
    /** @type {Record<string, number>} */
    const selectorCounts = {};
    for (const sel of selectors) selectorCounts[sel] = count(sel);

    const customElements = {};
    const seleniumIds = {};
    for (const el of document.querySelectorAll("*")) {
      const t = el.tagName.toLowerCase();
      if (t.includes("-")) customElements[t] = (customElements[t] || 0) + 1;
      const id = el.getAttribute("selenium-id");
      if (id) seleniumIds[id] = (seleniumIds[id] || 0) + 1;
    }

    const stateEl = document.getElementById("gogcom-store-state");
    let stateKeys = [];
    try {
      stateKeys = Object.keys(JSON.parse(stateEl?.textContent || "{}")).map((k) => k.replace(/=[^&]*/g, "=…").replace(/\/[0-9a-f]{8,}/g, "/…").replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, "…"));
    } catch (_) {
      /* no state script */
    }

    const ld = [];
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const j = JSON.parse(s.textContent || "");
        for (const item of Array.isArray(j) ? j : [j]) ld.push(Object.keys(item || {}).sort().join(","));
      } catch (_) {
        /* malformed */
      }
    }

    return {
      selectors: selectorCounts,
      customElements,
      seleniumIds,
      // The currency in `_prices-in-ils` is the visitor's, not the site's structure.
      bodyClasses: [...new Set([...document.body.classList].filter((c) => /^(productcard|_prices-in-|_price-currency|user-logged-in|prices-in-)/.test(c)).map((c) => c.replace(/^(_?prices-in-)[a-z]{3}$/, "$1<currency>")))].sort(),
      hasCardProductAttr: !!document.querySelector("[card-product]"),
      storeState: { present: !!stateEl, keys: [...new Set(stateKeys)].sort() },
      jsonLd: [...new Set(ld)].sort(),
    };
  }, selectors);
}

/** @returns {{ missing: string[], appeared: string[], changed: string[] }} */
export function diff(before, now) {
  const missing = [];
  const appeared = [];
  const changed = [];
  const cmpCounts = (label, a = {}, b = {}) => {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const x = a[k] || 0;
      const y = b[k] || 0;
      if (x > 0 && y === 0) missing.push(`${label} ${k}  (was ${x})`);
      else if (x === 0 && y > 0) appeared.push(`${label} ${k}  (now ${y})`);
      else if (x >= 5 && Math.abs(y - x) / x > 0.5) changed.push(`${label} ${k}  ${x} → ${y}`);
    }
  };
  cmpCounts("selector", before.selectors, now.selectors);
  cmpCounts("element", before.customElements, now.customElements);
  cmpCounts("selenium-id", before.seleniumIds, now.seleniumIds);
  const setDiff = (label, a = [], b = []) => {
    for (const k of a) if (!b.includes(k)) missing.push(`${label} ${k}`);
    for (const k of b) if (!a.includes(k)) appeared.push(`${label} ${k}`);
  };
  setDiff("body class", before.bodyClasses, now.bodyClasses);
  setDiff("state key", before.storeState?.keys, now.storeState?.keys);
  setDiff("JSON-LD keys", before.jsonLd, now.jsonLd);
  if (before.hasCardProductAttr && !now.hasCardProductAttr) missing.push("[card-product] attribute");
  if (before.storeState?.present && !now.storeState?.present) missing.push("#gogcom-store-state script");
  return { missing, appeared, changed };
}

async function main() {
  const selectors = adapterSelectors();
  const browser = await chromium.launch({ executablePath: findChromium(), headless: true });
  const context = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  const now = { recordedAt: new Date().toISOString(), pages: {} };
  for (const [name, { path, wait }] of Object.entries(PAGES)) {
    const page = await context.newPage();
    await page.goto(`https://www.gog.com${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(wait, { timeout: 30000 }).catch(() => console.log(`  (${name}: "${wait}" never appeared)`));
    await page.waitForTimeout(2500);
    now.pages[name] = await record(page, selectors);
    console.log(`recorded ${name} (${path}): ${Object.keys(now.pages[name].seleniumIds).length} selenium-ids, ${Object.keys(now.pages[name].customElements).length} custom elements`);
    await page.close();
  }
  await browser.close();

  if (UPDATE || !existsSync(BASELINE)) {
    mkdirSync(dirname(BASELINE), { recursive: true });
    writeFileSync(BASELINE, JSON.stringify(now, null, 1) + "\n");
    console.log(`\n${UPDATE ? "Baseline updated" : "No baseline yet — recorded one"}: ${BASELINE}`);
    return 0;
  }

  const base = JSON.parse(readFileSync(BASELINE, "utf8"));
  console.log(`\nComparing with the baseline recorded ${base.recordedAt}`);
  let failed = false;
  for (const name of Object.keys(PAGES)) {
    const d = diff(base.pages[name] || {}, now.pages[name]);
    console.log(`\n${name}: ${d.missing.length} gone, ${d.changed.length} changed a lot, ${d.appeared.length} new`);
    for (const m of d.missing) console.log(`  ✗ GONE     ${m}`);
    for (const m of d.changed) console.log(`  ~ CHANGED  ${m}`);
    for (const m of d.appeared.slice(0, 12)) console.log(`  + new      ${m}`);
    if (d.appeared.length > 12) console.log(`  + …and ${d.appeared.length - 12} more new`);
    if (d.missing.length) failed = true;
  }
  if (failed) console.log("\nA hook the adapter relies on is gone — see CLAUDE.md, \"When gog.com changes its markup\".");
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code), (e) => {
    console.error(e);
    process.exit(2);
  });
}
