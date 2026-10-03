// Regenerates the Chrome Web Store / website screenshots (1280x800) from the real
// extension:
//
//   node e2e/store-screenshots.mjs [outDir]       default: store/screenshots, then copied to docs/assets/screenshots
//
// The game page and the catalog are the REAL gog.com (public, logged out — a few page loads);
// everything the extension itself shows (price history, tags, notes, status, purchases, the
// weekly digest) comes from DEMO DATA written into the temporary browser profile, so the
// numbers on the extension's panels are illustrative, not anyone's real history. Look at the
// result before uploading it anywhere — gog.com's own prices and layout are whatever the site
// shows today.

import { cpSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startHarness } from "./harness.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] ? resolve(process.argv[2]) : join(ROOT, "store", "screenshots");
mkdirSync(OUT, { recursive: true });

/** The game page's real slug — resolved from the live site before anything is seeded. */
let GAME = "the_witcher_3_wild_hunt";
const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const series = (base, dips) => dips.map(([ago, pct]) => ({ d: day(ago), p: Math.round(base * (1 - pct / 100) * 100) / 100, c: "USD" }));

const demoLocal = () => ({
  tags: {
    [GAME]: ["rpg", "favourite", "co-op later"],
    cyberpunk_2077: ["rpg", "story"],
    baldurs_gate_3: ["rpg", "co-op"],
    hollow_knight: ["metroidvania", "indie"],
    hades: ["roguelike", "indie"],
    stardew_valley: ["cozy", "co-op"],
    disco_elysium_the_final_cut: ["story", "rpg"],
  },
  notes: { [GAME]: "Wait for the Blood and Wine bundle price.", baldurs_gate_3: "Play with Dana — start in November." },
  tagColors: { rpg: "#c64fff", indie: "#00f0ff", story: "#ffd166", "co-op": "#7fffa6" },
  gameStatus: { [GAME]: "playing", baldurs_gate_3: "backlog", hollow_knight: "finished", hades: "finished", stardew_valley: "backlog", disco_elysium_the_final_cut: "backlog", cyberpunk_2077: "backlog" },
  gameGenres: { [GAME]: "rpg", cyberpunk_2077: "rpg", baldurs_gate_3: "rpg", hollow_knight: "indie", hades: "indie" },
  priceHistory: {
    [GAME]: series(39.99, [[200, 0], [150, 70], [120, 0], [90, 50], [60, 0], [30, 75], [10, 60], [0, 60]]),
    cyberpunk_2077: series(59.99, [[180, 0], [100, 50], [60, 0], [20, 65], [0, 50]]),
    baldurs_gate_3: series(59.99, [[120, 0], [60, 0], [0, 0]]),
    hollow_knight: series(14.99, [[160, 0], [90, 40], [30, 0], [0, 50]]),
    hades: series(24.99, [[200, 0], [140, 33], [70, 0], [0, 33]]),
    stardew_valley: series(14.99, [[150, 0], [75, 20], [0, 20]]),
  },
  purchaseLog: { hollow_knight: { date: day(300), price: 7.5, currency: "USD" }, hades: { date: day(25), price: 16.7, currency: "USD" }, [GAME]: { date: day(12), price: 9.99, currency: "USD" } },
  statusDates: { hades: { finished: day(18) }, hollow_knight: { finished: day(200) }, [GAME]: { playing: day(9) } },
  ownedSlugs: { hollow_knight: day(300), hades: day(25), [GAME]: day(12) },
  wishlistSlugs: ["baldurs_gate_3", "stardew_valley", "cyberpunk_2077"],
  streak: { last: day(0), current: 6, best: 11 },
  weeklyDigest: {
    generatedAt: Date.now(),
    dropsThisWeek: 5,
    refundClosing: [{ slug: GAME, daysLeft: 18 }],
    priceAlertHits: [{ slug: "cyberpunk_2077", price: 29.99, currency: "USD", threshold: 30 }],
    wishlistDrops: [{ slug: "stardew_valley", price: 11.99, currency: "USD", dropPct: 20 }],
    endingSoon: [],
  },
  netLog: [
    { t: Date.now() - 5 * 60000, kind: "fx", host: "api.frankfurter.app", path: "/latest", status: 200, ok: true },
    { t: Date.now() - 2 * 3600000, kind: "mods", host: "www.gog.com", path: "/en/mods", status: 200, ok: true },
    { t: Date.now() - 26 * 3600000, kind: "fx", host: "api.frankfurter.app", path: "/latest", status: 200, ok: true },
  ],
  lastSeenVersion: "4.0.0", // the popup is shown without the "what's new" panel
  achievements: { "first-tag": day(30), curator: day(20), "note-taker": day(18), finisher: day(18), tripwire: day(9), "streak-3": day(3) },
});

const SYNC = {
  theme: "neon", targetCurrency: "ILS", currencyConverter: true, designInjection: true, taxEstimator: false, onboardingComplete: true, lastSeenVersion: "4.0.0",
  rates: { ILS: 3.6, EUR: 0.92, GBP: 0.79, PLN: 4.0 }, ratesUpdatedAt: Date.now() - 3600000, preferredLanguages: ["English", "Hebrew"],
  catalogTools: true, ownedDisplay: "dim", monthlyBudget: { amount: 60, currency: "USD" }, monthlyGoal: 2,
};

const { context, setSettings, extId, cleanup } = await startHarness({ live: true, extPath: join(ROOT, "extension"), viewport: { width: 1280, height: 800 }, extraArgs: ["--lang=en-US"] });
const done = [];
try {
  // Which slug does the live site settle on for this game? (It redirects to the current edition.)
  {
    const probe = await context.newPage();
    await probe.goto(`https://www.gog.com/en/game/${GAME}`, { waitUntil: "domcontentloaded" });
    await probe.waitForTimeout(2500);
    const real = /\/game\/([^/?#]+)/.exec(new URL(probe.url()).pathname)?.[1];
    if (real) GAME = real;
    await probe.close();
  }
  await setSettings({ sync: SYNC, local: demoLocal() });

  const shot = async (name, page) => {
    await page.screenshot({ path: join(OUT, `${name}.png`), clip: { x: 0, y: 0, width: 1280, height: 800 } });
    done.push(name);
  };

  // --- the catalog: converted prices, the catalog bar, badges
  {
    const page = await context.newPage();
    await page.goto("https://www.gog.com/en/games?order=desc:trending", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#gog-plus-catbar", { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(4000);
    await page.evaluate(() => window.scrollTo(0, 250));
    await page.waitForTimeout(800);
    await shot("currency-banner", page);
    await page.close();
  }

  // --- a game page: the insights panel
  {
    const page = await context.newPage();
    await page.goto(`https://www.gog.com/en/game/${GAME}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#gog-plus-gamepanel", { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(4500);
    await page.evaluate(() => document.getElementById("gog-plus-gamepanel")?.scrollIntoView({ block: "start" }));
    await page.evaluate(() => window.scrollBy(0, -60));
    await page.waitForTimeout(900);
    await shot("game-page-panel", page);
    await page.close();
  }

  // --- the tag dashboard
  {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extId}/tags/tags.html`);
    await page.waitForSelector(".game-card", { timeout: 8000 });
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: "#gog-plus-toast-host, .gog-plus-toast { display: none !important; }" });
    await shot("tag-dashboard", page);
    await page.close();
  }

  // --- the popup, on a card the size of a store screenshot
  {
    const page = await context.newPage();
    await page.setViewportSize({ width: 400, height: 760 });
    await page.goto(`chrome-extension://${extId}/popup/popup.html`);
    await page.waitForSelector("#digestSection:not([hidden])", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
    // The top of the popup (what's new, this week, currency and the first toggles) — the whole
    // thing is a long scroll that would be unreadably small on a 1280x800 card.
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: 400, height: 760 } });
    const frame = await context.newPage();
    await frame.setViewportSize({ width: 1280, height: 800 });
    await frame.setContent(`<body style="margin:0;height:800px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 25% 20%,#3a1670,#0b0616 70%)">
      <img style="max-height:760px;border-radius:14px;box-shadow:0 20px 70px #000b,0 0 0 1px #ffffff22" src="data:image/png;base64,${png.toString("base64")}"></body>`);
    await frame.waitForTimeout(400);
    await shot("popup-settings", frame);
    await frame.close();
    await page.close();
  }

  // --- the options page: what it contacts and keeps
  {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extId}/options/options.html`);
    await page.waitForSelector("#privNet table", { timeout: 8000 });
    await page.evaluate(() => document.getElementById("privNet")?.closest("section, .card")?.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(700);
    await shot("advanced-settings", page);
    await page.close();
  }
} finally {
  await cleanup();
}

if (OUT === join(ROOT, "store", "screenshots")) {
  const docs = join(ROOT, "docs", "assets", "screenshots");
  for (const n of done) cpSync(join(OUT, `${n}.png`), join(docs, `${n}.png`));
  console.log(`Copied ${done.length} to docs/assets/screenshots`);
}
console.log(`Wrote ${done.join(", ")} to ${OUT}`);
