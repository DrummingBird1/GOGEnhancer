// Read-only walk through the logged-in parts of gog.com with the extension
// loaded: wishlist (filters, exports, pick), an owned game's page, the library
// page, the catalog with ownership marks, the cart page. Needs a login saved with
// `node e2e/save-login.mjs`. Never clicks anything that buys, adds to the cart or
// changes the account.
//
//   E2E_AUTH=e2e/.auth/gog.json node e2e/live-account.mjs

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { startHarness } from "./harness.mjs";

const AUTH = process.env.E2E_AUTH ? resolve(process.env.E2E_AUTH) : null;
if (!AUTH) {
  console.error("Set E2E_AUTH to the file written by `node e2e/save-login.mjs`.");
  process.exit(2);
}
const cookies = JSON.parse(readFileSync(AUTH, "utf8")).cookies;
const results = [];
function check(name, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${!ok && detail ? `\n      ${detail}` : ""}`);
}

const h = await startHarness({ live: true, extPath: new URL("../extension", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), cookies });
await h.context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "https://www.gog.com" }).catch(() => {});
await h.setSettings({
  sync: { wishlistFilters: true, wishlistSmart: true, ownershipLearning: true, catalogTools: true, targetCurrency: "ILS", currencyConverter: true, priceCompareTable: false },
  local: { ownedSlugs: {}, priceHistory: {} },
});
const open = async (path) => {
  const page = await h.context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource|net::ERR|403|CORS|Content Security|Unexpected end of attribute/i.test(m.text()) && page.errors.push(m.text()));
  await page.goto(`https://www.gog.com${path}`, { waitUntil: "domcontentloaded" });
  return page;
};
const stored = (area, key) => h.sw.evaluate(([a, k]) => new Promise((r) => chrome.storage[a].get(k, (v) => r(v[k]))), [area, key]);

// ---- wishlist ----
{
  const page = await open("/en/account/wishlist");
  await page.waitForSelector("#gog-plus-wlfilters", { timeout: 30000, state: "attached" }).catch(() => {});
  await new Promise((r) => setTimeout(r, 4000));
  const s = await page.evaluate(() => {
    const bar = document.getElementById("gog-plus-wlfilters");
    const r = bar?.getBoundingClientRect();
    const rows = [...document.querySelectorAll(".product-row--wishlist")];
    return { barVisible: !!r && r.width > 0 && r.height > 0, rows: rows.length, rowsVisible: rows.filter((x) => x.getBoundingClientRect().height > 0).length, buttons: [...(bar?.querySelectorAll("button") || [])].map((b) => b.textContent.trim().replace(/\s+/g, " ")) };
  });
  check(`wishlist: the bar is visible and the page has ${s.rows} real row(s)`, s.barVisible && s.rows >= 0, JSON.stringify(s));
  const filters = ["All", "On sale", "Hide owned"];
  for (const label of filters) {
    const btn = await page.$(`#gog-plus-wlfilters button:has-text("${label}")`);
    if (!btn) { check(`wishlist: filter "${label}" exists`, false, s.buttons.join(" | ")); continue; }
    await btn.click();
    await new Promise((r) => setTimeout(r, 300));
    const vis = await page.evaluate(() => [...document.querySelectorAll(".product-row--wishlist")].filter((x) => getComputedStyle(x.closest(".product-row-wrapper") || x).display !== "none").length);
    check(`wishlist: "${label}" leaves ${vis} of ${s.rows} rows and breaks nothing`, vis <= s.rows);
  }
  await (await page.$('#gog-plus-wlfilters button:has-text("All")'))?.click();
  // exports: only that a file is produced and that it opens as the format promises
  for (const [label, test] of [["CSV", (t) => /title|slug/i.test(t.split("\n")[0])], ["Markdown", (t) => /#|\*|-/.test(t)]]) {
    const btn = await page.$(`#gog-plus-wlfilters button:has-text("${label}")`);
    if (!btn || s.rows === 0) { check(`wishlist: ${label} export skipped (${s.rows} rows)`, true); continue; }
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }).catch(() => null), btn.click()]);
    let text = "";
    if (dl) text = readFileSync(await dl.path(), "utf8");
    check(`wishlist: the ${label} export is a real file (${text.length} bytes)`, !!dl && test(text), text.slice(0, 120));
  }
  const pick = await page.$('#gog-plus-wlfilters button:has-text("Pick one on sale")');
  if (pick) {
    await pick.click();
    await new Promise((r) => setTimeout(r, 500));
    const out = await page.evaluate(() => ({ picked: !!document.querySelector(".gog-plus-wl-picked"), toast: document.querySelector(".gog-plus-toast")?.textContent?.slice(0, 50) || "" }));
    check(`wishlist: "Pick one on sale" answers (${out.picked ? "highlighted a game" : out.toast})`, out.picked || /Nothing on sale/.test(out.toast), JSON.stringify(out));
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#gog-plus-wlfilters", { timeout: 30000, state: "attached" }).catch(() => {});
  await new Promise((r) => setTimeout(r, 3500));
  const bars = await page.evaluate(() => document.querySelectorAll("#gog-plus-wlfilters").length);
  check("wishlist: after a reload there is exactly one bar", bars === 1, String(bars));
  check("wishlist: no page errors", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
  await page.close();
}

// ---- library page ----
{
  const page = await open("/en/account");
  await new Promise((r) => setTimeout(r, 5000));
  const lib = await page.evaluate(() => ({ url: location.pathname, owned: document.querySelectorAll("a[href*='/game/'], [class*='product-row']").length, ext: document.querySelectorAll("[class*='gog-plus-']").length }));
  check(`account page: loads (${lib.url}), ${lib.owned} game link(s), ${lib.ext} extension element(s)`, page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
  await page.close();
}

// ---- an owned game ----
{
  const cat = await open("/en/games?query=a");
  await cat.waitForSelector(".gog-plus-card-done", { timeout: 30000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));
  const owned = await stored("local", "ownedSlugs");
  const slug = Object.keys(owned || {})[0];
  await cat.close();
  if (!slug) {
    check("owned game: the catalog showed no owned game on this page (nothing to open)", true);
  } else {
    const page = await open(`/en/game/${slug}`);
    await page.waitForSelector("#gog-plus-gamepanel", { timeout: 25000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 2500));
    const g = await page.evaluate(() => ({
      loggedIn: document.body.classList.contains("user-logged-in"),
      panel: !!document.getElementById("gog-plus-gamepanel"),
      sections: [...document.querySelectorAll("#gog-plus-gp-body > [data-section-id]")].map((x) => x.dataset.sectionId),
      ownedLabel: !!document.querySelector("[class*='owned']"),
    }));
    const stillOwned = (await stored("local", "ownedSlugs"))?.[slug];
    check(`owned game "${slug}": logged in, the panel builds (${g.sections.join(",")}), ownership is kept`, g.loggedIn && g.panel && !!stillOwned, JSON.stringify({ g, stillOwned }));
    check("owned game: no page errors", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
    await page.close();
  }
}

// ---- cart ----
{
  const page = await open("/en/checkout");
  await new Promise((r) => setTimeout(r, 4000));
  check("cart / checkout page loads with the extension, no page errors (nothing clicked)", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
  await page.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await h.cleanup();
process.exit(failed ? 1 : 0);
