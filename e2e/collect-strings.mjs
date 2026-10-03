// Lists the English the extension's own pages actually show — text nodes and
// title / placeholder / aria-label attributes in the rendered DOM, after the
// pages have drawn with a realistic library behind them — so the translation
// rows in lib/i18n-pages-*.js can be checked against what's really on screen.
//
//   node e2e/collect-strings.mjs              print the strings that have no Hebrew row yet
//   node e2e/collect-strings.mjs --all        print every string
//   node e2e/collect-strings.mjs --json out   write {page: [strings]} to a file
//
// Only what the pages show on their own is visible to it (no clicking through
// menus and dialogs); strings that appear on an action are found by reading the code.

import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startHarness } from "./harness.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const ALL = args.includes("--all");
const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : null;
// --lang xx shows the pages in that language: what is still English is what has no row yet.
const LANG = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : "en";

const day = (n) => new Date(Date.UTC(2026, 9, 3) - n * 86400000).toISOString().slice(0, 10);
const slugs = ["alpha_game", "beta_quest", "gamma_tactics", "delta_racer", "epsilon_tales", "zeta_arena"];
const snap = (base, n) => Array.from({ length: n }, (_, i) => ({ d: day((n - i) * 9), p: Math.round((base - (i % 3) * 3) * 100) / 100, c: "USD" }));

const LOCAL = {
  tags: { alpha_game: ["rpg", "retro"], beta_quest: ["rpg"], gamma_tactics: ["strategy", "retro"], delta_racer: ["racing"], epsilon_tales: ["story"] },
  notes: { alpha_game: "Great soundtrack", beta_quest: "Wait for the sale" },
  priceHistory: Object.fromEntries(slugs.map((s, i) => [s, snap(20 + i * 4, 6)])),
  purchaseLog: { alpha_game: { date: day(5), price: 12.5, currency: "USD" }, beta_quest: { date: day(20), price: 9, currency: "USD" }, gamma_tactics: { date: day(200) } },
  gameStatus: { alpha_game: "playing", beta_quest: "backlog", gamma_tactics: "finished", delta_racer: "backlog", epsilon_tales: "finished" },
  gameGenres: { alpha_game: "rpg", beta_quest: "adventure", gamma_tactics: "strategy", delta_racer: "racing", epsilon_tales: "adventure", zeta_arena: "action" },
  wishlistSlugs: ["zeta_arena", "delta_racer"],
  ownedSlugs: { alpha_game: day(40), gamma_tactics: day(80) },
  gameFacts: { alpha_game: { rd: "2020-01-01", lang: ["English"] } },
  statusDates: { alpha_game: { playing: day(3) }, gamma_tactics: { finished: day(30) } },
  priceAlerts: { zeta_arena: { threshold: 10, currency: "USD", createdAt: Date.now() } },
  achievements: { first_tag: day(10) },
  streak: { last: day(0), current: 4, best: 9 },
  challengesDone: {},
  syncFolderName: "GOG sync",
  failureLog: [{ feature: "card badges", message: "no tiles", page: "/games", count: 2, first: Date.now() - 5000, last: Date.now() - 1000 }],
  netLog: [{ t: Date.now() - 60000, kind: "fx", host: "api.frankfurter.app", path: "/latest", status: 200, ok: true }],
  weeklyDigest: { generatedAt: Date.now(), dropsThisWeek: 4, refundClosing: [{ slug: "alpha_game", daysLeft: 2 }], priceAlertHits: [{ slug: "zeta_arena", price: 9.5, currency: "USD", threshold: 10 }], wishlistDrops: [{ slug: "delta_racer", price: 20, currency: "USD", dropPct: 55 }], endingSoon: [] },
};
const SYNC = { uiLanguage: LANG, onboardingComplete: true, lastSeenVersion: "3.9.0", theme: "neon", monthlyBudget: { amount: 50, currency: "USD" }, monthlyGoal: 2, preferredLanguages: ["English", "Hebrew"], webhookEnabled: false };

const { context, setSettings, extId, cleanup } = await startHarness({ extPath: join(ROOT, "extension"), viewport: { width: 1200, height: 900 } });

/** Runs inside a page: every English string the translator would look up. */
function collect() {
  return window.GOGPlusPageI18n ? window.GOGPlusPageI18n.strings(document.body) : [];
}

/** Clicks through the dashboard's menus and dialogs so the strings they show are listed too. */
async function withInteractions(page, base) {
  const all = new Set(base);
  const take = async () => {
    for (const x of await page.evaluate(collect)) all.add(x);
  };
  const step = async (label, fn) => {
    try {
      await fn();
      await page.waitForTimeout(250);
      await take();
    } catch (err) {
      console.log(`  (interaction skipped: ${label} — ${String(err.message).split("\n")[0]})`);
    }
  };
  await step("filter builder", async () => {
    await page.click("#filterBuilderBtn");
  });
  await page.keyboard.press("Escape");
  await step("tag menu", async () => {
    await page.locator(".tag-pill-menu").first().click();
  });
  await page.keyboard.press("Escape");
  await step("colour picker", async () => {
    await page.locator(".tag-pill-swatch").first().click();
  });
  await page.keyboard.press("Escape");
  await step("price chart", async () => {
    await page.locator(".game-card-chart-toggle").first().click();
  });
  await step("pick something", async () => {
    await page.getByText("Pick something").first().click();
  });
  await step("spin", async () => {
    await page.getByRole("button", { name: "Spin" }).first().click();
  });
  await step("status", async () => {
    await page.locator(".game-card-status button").first().click();
  });
  await step("search with no match", async () => {
    await page.fill("#search", "zzzzzz-no-such-game");
  });
  await step("search with a tag", async () => {
    await page.fill("#search", "tag:rpg");
  });
  await step("density", async () => {
    await page.click("#densityBtn, button:has-text('Density')");
  });
  return [...all];
}

/** The options page: a search with no hit, a theme card, the profile picker. */
async function withOptionsInteractions(page, base) {
  const all = new Set(base);
  const take = async () => {
    for (const x of await page.evaluate(collect)) all.add(x);
  };
  const step = async (label, fn) => {
    try {
      await fn();
      await page.waitForTimeout(250);
      await take();
    } catch (err) {
      console.log(`  (interaction skipped: ${label} — ${String(err.message).split("\n")[0]})`);
    }
  };
  await step("settings search", async () => {
    await page.fill("input[type=search], #settingsSearch", "zzzz-nothing");
  });
  await step("clear search", async () => {
    await page.fill("input[type=search], #settingsSearch", "");
  });
  return [...all];
}

const found = {};
try {
  await setSettings({ sync: SYNC, local: LOCAL });
  const pages = [
    ["dashboard", `chrome-extension://${extId}/tags/tags.html`, 2500],
    ["options", `chrome-extension://${extId}/options/options.html`, 2500],
    ["popup", `chrome-extension://${extId}/popup/popup.html`, 1500],
    ["onboarding", `chrome-extension://${extId}/onboarding/onboarding.html`, 1000],
  ];
  for (const [name, url, wait] of pages) {
    const page = await context.newPage();
    await page.setViewportSize({ width: name === "popup" ? 400 : 1200, height: 900 });
    await page.goto(url);
    await page.waitForTimeout(wait);
    let strings = await page.evaluate(collect);
    if (name === "dashboard") strings = await withInteractions(page, strings);
    if (name === "options") strings = await withOptionsInteractions(page, strings);
    // In English every string is shown; in another language what's left is what no row (or key) translated.
    const covered = await page.evaluate(
      ({ list, lang }) => {
        // What carries a data-i18n key (the popup) is translated by lib/i18n.js, not by a row.
        const norm = (t) => String(t).replace(/\s+/g, " ").trim();
        const keyed = new Set([...document.querySelectorAll("[data-i18n]")].map((e) => norm(e.textContent)));
        for (const e of document.querySelectorAll("[data-i18n-attr]")) {
          for (const pair of (e.getAttribute("data-i18n-attr") || "").split(",")) {
            const attr = pair.trim().split(":")[0];
            if (attr && e.getAttribute(attr)) keyed.add(norm(e.getAttribute(attr)));
          }
        }
        return list.map((x) => (lang === "en" ? keyed.has(x) || (window.GOGPlusPageI18n?.covers(x, "he") ?? false) : !/[A-Za-z]{3,}/.test(x)));
      },
      { list: strings, lang: LANG }
    );
    found[name] = strings.map((s, i) => ({ s, covered: covered[i] }));
    await page.close();
  }
} finally {
  await cleanup();
}

for (const [name, list] of Object.entries(found)) {
  const missing = list.filter((x) => !x.covered);
  console.log(`\n== ${name}: ${list.length} strings, ${missing.length} ${LANG === "en" ? "without a Hebrew row" : "still English in " + LANG}`);
  for (const x of ALL ? list : missing) console.log(`  ${x.covered ? "·" : "✗"} ${x.s}`);
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(Object.fromEntries(Object.entries(found).map(([k, v]) => [k, v.map((x) => x.s)])), null, 1));
