// Lists every piece of English text the extension writes INTO gog.com pages (the
// insights panel, the catalog / wishlist / review bars, dialogs, toasts, the
// command palette…), so each can have a translation row. Opens the fixture pages
// with every feature on and pokes at the UI so the lazily-built parts appear.
//
//   node e2e/collect-content-strings.mjs            prints the strings (digits → {n})
//   node e2e/collect-content-strings.mjs --check    exits 1 when one has no row for Hebrew
//
// Run it after adding a feature; it is what keeps lib/i18n-pages-content.js complete.

import { startHarness } from "./harness.mjs";

const CHECK = process.argv.includes("--check");
const h = await startHarness({ extPath: new URL("../extension", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), viewport: { width: 1300, height: 900 } });
await h.setSettings({
  sync: { uiLanguage: "en", targetCurrency: "ILS", rates: { ILS: 4 }, currencyConverter: true, catalogTools: true, wishlistFilters: true, wishlistSmart: true, keyboardNav: true, priceCompareTable: true, drmFreeBanner: true, refundBadge: true, modIndicator: true, openInLinks: true, customTags: true, endlessCatalog: true, reviewTools: true, packContents: true, sysReqCheck: true },
  local: {
    tags: { alpha_game: ["rpg"], beta_game: ["co-op"] }, notes: { alpha_game: "x" }, gameStatus: { alpha_game: "playing" },
    priceHistory: { alpha_game: [{ d: "2026-08-01", p: 29.99, c: "USD" }, { d: "2026-09-10", p: 14.99, c: "USD", b: 29.99 }, { d: "2026-10-30", p: 24.99, c: "USD", b: 49.99 }] },
    purchaseLog: { alpha_game: { purchaseDate: "2026-10-30", price: 24.99, currency: "USD" } },
    gameFacts: { alpha_game: { t: 1, title: "Alpha Game", rd: "2015-05-19", pe: "2026-11-30 12:00:00.000000+00:00" } },
    ownedSlugs: { gamma_game: "2026-01-01" }, notInterested: { delta_game: "x" },
    priceAlerts: { alpha_game: { threshold: 10, currency: "ILS", createdAt: 1 } },
    catalogPresets: { "RPG under 10": "/en/games?price=below_10" },
  },
});

const all = new Set();
const collect = async (page) => {
  const texts = await page.evaluate(() => {
    const out = new Set();
    const roots = [...document.querySelectorAll("[class*='gog-plus-'], [id*='gog-plus-']")].filter((r) => !r.parentElement?.closest("[class*='gog-plus-'], [id*='gog-plus-']"));
    for (const r of roots) {
      const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        if (n.parentElement?.closest("script, style, [data-no-i18n], [translate=no], textarea")) continue;
        const t = n.nodeValue.replace(/\s+/g, " ").trim();
        if (t.length > 1 && /[A-Za-z]{2}/.test(t)) out.add(t);
      }
      for (const e of [r, ...r.querySelectorAll("*")]) {
        for (const a of ["title", "aria-label", "placeholder"]) {
          const t = (e.getAttribute && e.getAttribute(a) || "").trim();
          if (/[A-Za-z]{2}/.test(t)) out.add(t);
        }
      }
    }
    return [...out];
  });
  texts.forEach((t) => all.add(t));
};
const open = async (path) => {
  const p = await h.context.newPage();
  await h.context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "https://www.gog.com" }).catch(() => {});
  await p.goto(`https://www.gog.com${path}`);
  await new Promise((r) => setTimeout(r, 2200));
  return p;
};
const click = async (p, sel) => { await p.click(sel, { timeout: 1500, force: true }).catch(() => {}); await new Promise((r) => setTimeout(r, 250)); };

// game page: every section, every button
{
  const p = await open("/en/game/alpha_game");
  await p.evaluate(() => document.querySelectorAll("#gog-plus-gamepanel details").forEach((d) => (d.open = true)));
  await collect(p);
  for (const sel of ["#gog-plus-gamepanel button:has-text('Copy clean link')", "#gog-plus-gamepanel button:has-text('Copy summary')", "#gog-plus-alert-low", ".gog-plus-gp-tool", ".gog-plus-gp-toggle"]) { await click(p, sel); await collect(p); }
  await p.keyboard.press("?"); await collect(p); await p.keyboard.press("Escape");
  await p.keyboard.press("Control+k"); await new Promise((r) => setTimeout(r, 300)); await collect(p);
  await p.keyboard.type("tag"); await new Promise((r) => setTimeout(r, 300)); await collect(p); await p.keyboard.press("Escape");
  await p.close();
}
// pack and bundle pages
for (const path of ["/en/game/pack_game", "/en/game/bundle_game"]) { const p = await open(path); await collect(p); await p.close(); }
// catalog
{
  const p = await open("/en/games/v4");
  await collect(p);
  for (const sel of ["#gog-plus-cat-density", ".gog-plus-tilectl-btn", "#gog-plus-cat-hidden", "button:has-text('Compare')", ".gog-plus-bar-btn"]) { await click(p, sel); await collect(p); }
  await p.evaluate(() => { for (const s of document.querySelectorAll("#gog-plus-catbar select")) for (const o of s.options) o.textContent && o.setAttribute("data-collect", "1"); });
  for (const sel of ["#gog-plus-cat-sort", "#gog-plus-cat-ownedmode", "#gog-plus-cat-presets"]) {
    const opts = await p.evaluate((s) => [...(document.querySelector(s)?.options || [])].map((o) => o.textContent.trim()), sel);
    opts.forEach((t) => all.add(t));
  }
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await new Promise((r) => setTimeout(r, 2500)); await collect(p);
  await p.close();
}
// wishlist
{
  const p = await open("/en/account/wishlist");
  await collect(p);
  for (const sel of ["#gog-plus-wlfilters button"]) {
    const n = await p.locator(sel).count();
    for (let i = 0; i < n; i++) { await p.locator(sel).nth(i).click({ timeout: 1500, force: true }).catch(() => {}); await new Promise((r) => setTimeout(r, 200)); await collect(p); }
  }
  await collect(p);
  await p.close();
}

const norm = (t) => t.replace(/\d[\d.,]*/g, "{n}");
const list = [...new Set([...all].map(norm))].sort();
await h.cleanup();
if (CHECK) {
  // Load the translator and the content rows exactly as the content script does, and look each string up.
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const lib = resolve(dirname(fileURLToPath(import.meta.url)), "../extension/lib");
  const win = { document: { documentElement: { getAttribute: () => "en" } } };
  for (const f of ["i18n-pages.js", "i18n-pages-content.js"]) new Function("window", "document", readFileSync(resolve(lib, f), "utf8"))(win, win.document);
  const T = win.GOGPlusPageI18n;
  // what is not ours to translate: codes, fixture content, the site's own text
  const ignore = /^([A-Z]{3}|[A-Za-z]+ Game|Child (One|Two)|More (One|Two)|menu (one|two)|rpg|co-op|Adventure|Fantasy|Role-playing|Main|English|Genre|Languages|Add to cart|in library|IN LIBRARY|soon|GOG\.COM|PC games \/ All Games|.*\| GOG\.COM|RPG .*|.*\{n\}.*Reviews.*|[A-Z]{1,3}\$?\{n\}|Fr\.\{n\}|Ft\{n\}|lei\{n\}|Rp\{n\}|kr\{n\}|MX\$\{n\}|NZ\$\{n\}|Tags:|Genre:|My first tag|Ctrl \/ ⌘ \+ K|\+ (Adventure|Fantasy)|(Steam|SteamDB|PCGamingWiki|IsThereAnyDeal|HowLongToBeat) →|CSV|Markdown|GOG Enhancer|Pack Game|Bundle Game|Beta Game|Alpha Game.*)$/;
  const missing = list.filter((t) => !ignore.test(t) && T.translate(t.replace(/\{n\}/g, "5"), "he") === null);
  if (missing.length) {
    console.error(`${missing.length} string(s) without a Hebrew row:\n  ${missing.join("\n  ")}`);
    process.exit(1);
  }
  console.error("every string has a row");
  process.exit(0);
}
console.log(list.join("\n"));
console.error(`\n${list.length} strings`);
