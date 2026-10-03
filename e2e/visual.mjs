// Visual regression for the parts of the extension people actually look at:
// the game-page panel, the catalog and wishlist bars, the popup, the options
// page's privacy section and the tag dashboard — rendered by the real extension
// in a real Chromium from fixture pages and fixed sample data.
//
//   node e2e/visual.mjs             compare with e2e/baselines/*.png
//   node e2e/visual.mjs --update    record what it renders now as the new baselines
//
// A screenshot has to be byte-identical to its baseline. That holds on one
// machine (same fonts, same rendering) and is why the baselines are recorded
// where they are used — LOCAL ONLY, never in CI, and a different OS/font set
// needs `--update` once. When one differs the new render is saved to
// e2e/baselines/actual/<name>.png (git-ignored) so you can look at it and then
// either fix the regression or run --update to accept it.
//
// Anything that changes with the clock is masked.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startHarness } from "./harness.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "e2e", "baselines");
const ACTUAL = join(DIR, "actual");
const UPDATE = process.argv.includes("--update");
mkdirSync(ACTUAL, { recursive: true });

const SAMPLE_DIGEST = {
  generatedAt: Date.parse("2026-10-03T12:00:00Z"),
  dropsThisWeek: 4,
  refundClosing: [{ slug: "the_witcher_3", daysLeft: 2 }],
  priceAlertHits: [{ slug: "hades", price: 9.5, currency: "USD", threshold: 10 }],
  wishlistDrops: [{ slug: "cyberpunk_2077", price: 20, currency: "USD", dropPct: 55 }],
  endingSoon: [],
};

const { context, setSettings, extId, cleanup } = await startHarness({ extPath: join(ROOT, "extension"), viewport: { width: 1100, height: 900 } });
const results = [];

async function capture(name, page, { selector, mask = [] } = {}) {
  await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }" });
  await page.waitForTimeout(400);
  const target = selector ? page.locator(selector).first() : page;
  const png = await target.screenshot({ mask: mask.map((m) => page.locator(m)), animations: "disabled", ...(selector ? {} : { fullPage: false }) });
  const file = join(DIR, `${name}.png`);
  if (UPDATE || !existsSync(file)) {
    writeFileSync(file, png);
    results.push({ name, status: UPDATE ? "updated" : "created" });
  } else if (Buffer.compare(png, readFileSync(file)) === 0) {
    results.push({ name, status: "same" });
  } else {
    writeFileSync(join(ACTUAL, `${name}.png`), png);
    results.push({ name, status: "DIFFERENT" });
  }
}

try {
  await setSettings({
    sync: { theme: "neon", targetCurrency: "ILS", rates: { ILS: 4, EUR: 0.9 }, currencyConverter: true, taxEstimator: false, onboardingComplete: true, lastSeenVersion: "4.0.0", preferredLanguages: ["English"] },
    local: { tourSeen: "4.0.0", weeklyDigest: SAMPLE_DIGEST },
  });

  // --- the game-page panel
  let page = await context.newPage();
  await page.goto("https://www.gog.com/en/game/alpha_game");
  await page.waitForSelector("#gog-plus-gamepanel", { timeout: 8000 });
  await page.waitForTimeout(800);
  await capture("game-panel", page, { selector: "#gog-plus-gamepanel", mask: [".gog-plus-deal-timer", ".gog-plus-gp-muted"] });
  await page.close();

  // --- the catalog bar and the first row of tiles
  await setSettings({ local: { ownedSlugs: {}, notInterested: {} }, sync: { catalogTools: true, ownedDisplay: "dim" } });
  page = await context.newPage();
  await page.goto("https://www.gog.com/en/games/v4");
  await page.waitForSelector("#gog-plus-catbar", { timeout: 8000 });
  await page.waitForTimeout(600);
  await capture("catalog-bar", page, { selector: "#gog-plus-catbar" });
  await page.close();

  // --- the wishlist bar
  await setSettings({ sync: { wishlistFilters: true, wishlistSmart: true } });
  page = await context.newPage();
  await page.goto("https://www.gog.com/en/account/wishlist");
  await page.waitForSelector("#gog-plus-wlfilters", { timeout: 8000 });
  await page.waitForTimeout(1000);
  await capture("wishlist-bar", page, { selector: "#gog-plus-wlfilters" });
  await page.close();

  // --- extension pages
  page = await context.newPage();
  await page.setViewportSize({ width: 400, height: 900 });
  await page.goto(`chrome-extension://${extId}/popup/popup.html`);
  await page.waitForSelector("#digestSection:not([hidden])", { timeout: 8000 });
  await capture("popup", page, { mask: ["#rateStrip"] });
  await page.close();

  await setSettings({ local: { netLog: [{ t: Date.parse("2026-10-03T11:59:00Z"), kind: "fx", host: "api.frankfurter.app", path: "/latest", status: 200, ok: true }], tags: { alpha_game: ["rpg"] } } });
  page = await context.newPage();
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto(`chrome-extension://${extId}/options/options.html`);
  await page.waitForSelector("#privNet table", { timeout: 8000 });
  await capture("options-privacy", page, { selector: "#privNet", mask: ["#privNet td:last-child"] });
  await page.close();

  page = await context.newPage();
  await page.goto(`chrome-extension://${extId}/tags/tags.html`);
  await page.waitForTimeout(1500);
  await capture("tag-dashboard", page, { mask: [".stat-value", "time"] });
  await page.close();
} finally {
  await cleanup();
}

console.log("");
for (const r of results) console.log(`  ${r.status === "DIFFERENT" ? "✗" : "✓"} ${r.name}: ${r.status}`);
const different = results.filter((r) => r.status === "DIFFERENT");
if (different.length) console.log(`\n${different.length} screenshot(s) differ — look at e2e/baselines/actual/, then fix the regression or run with --update.`);
process.exit(different.length ? 1 : 0);
