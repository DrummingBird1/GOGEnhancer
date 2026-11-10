// Upgrade test: installs the PREVIOUS release (a git tag) into a browser profile,
// fills it with realistic data in that release's shape, swaps the extension
// files for the current ones, restarts the browser on the same profile (so the
// extension id and storage are the same, and `onInstalled` fires with reason
// "update"), and checks that nothing the user had was lost or broken.
//
//   node e2e/upgrade.mjs [fromTag]        (default v4.0.0)
//
// Local only (needs a Chromium that honours --load-extension, like the rest of
// the e2e tooling). Nothing real is requested: gog.com is served from fixtures.

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, cpSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { startHarness } from "./harness.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FROM = process.argv[2] || "v4.0.0";
const results = [];
function check(name, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${!ok && detail ? `\n      ${detail}` : ""}`);
}

const work = mkdtempSync(join(tmpdir(), "gog-enhancer-upgrade-"));
const extDir = join(work, "ext");
const profile = join(work, "profile");
mkdirSync(extDir, { recursive: true });
mkdirSync(profile, { recursive: true });

// 1. The old release's files, exactly as tagged.
const tar = join(work, "old.tar");
execFileSync("git", ["-c", `safe.directory=${ROOT}`, "-C", ROOT, "archive", "--format=tar", "-o", tar, FROM, "extension"]);
execFileSync("tar", ["-xf", "old.tar"], { cwd: work }); // relative: GNU tar reads "C:" as a remote host
cpSync(join(work, "extension"), extDir, { recursive: true });
const oldVersion = JSON.parse(readFileSync(join(extDir, "manifest.json"), "utf8")).version;
const newVersion = JSON.parse(readFileSync(join(ROOT, "extension", "manifest.json"), "utf8")).version;
console.log(`Upgrade ${oldVersion} (${FROM}) → ${newVersion}\n`);

// 2. Realistic data in the old release's shapes.
const sync = {
  targetCurrency: "EUR",
  rates: { ILS: 3.7, EUR: 0.93, GBP: 0.8, PLN: 4.1, RUB: 90 },
  theme: "crt",
  vatPercent: 17,
  taxEstimator: true,
  regionPreset: "custom",
  hebrewTranslations: true,
  keyboardNav: true,
  monthlyBudget: { amount: 50, currency: "EUR" },
  quietHours: { enabled: true, from: "23:00", to: "07:00" },
};
const local = {
  catalogPresets: { "RPG under 10": "/en/games?genres=role-playing&price=below_10" },
  tags: { alpha_game: ["rpg", "co-op"], beta_quest: ["retro"] },
  notes: { alpha_game: "Play with Dan\nCheck the DLC" },
  gameStatus: { alpha_game: "playing", beta_quest: "backlog" },
  tagColors: { rpg: "#ff00aa" },
  tagOrder: ["rpg", "retro", "co-op"],
  priceHistory: {
    alpha_game: [
      { d: "2026-08-01", p: 29.99, c: "USD" },
      { d: "2026-09-10", p: 14.99, c: "USD", b: 29.99 },
      { d: "2026-10-30", p: 24.99, c: "USD", b: 49.99 },
    ],
  },
  purchaseLog: { beta_quest: { purchaseDate: "2026-10-20", price: 9.99, currency: "USD" } },
  priceAlerts: { alpha_game: { threshold: 12, currency: "EUR", createdAt: 1790000000000 } },
  ownedSlugs: { beta_quest: "2026-10-20" },
  gameFacts: { alpha_game: { t: 1790000000000, title: "Alpha Game", rd: "2015-05-19" } },
};

// 3. Start the old release on a fresh profile and seed it.
let h = await startHarness({ extPath: extDir, userDataDir: profile });
const extId = h.extId;
const seedVersion = await h.sw.evaluate(() => chrome.runtime.getManifest().version);
check(`the old release (${oldVersion}) is what is installed first`, seedVersion === oldVersion, seedVersion);
await h.setSettings({ sync, local });
const before = {
  sync: await h.sw.evaluate(() => new Promise((r) => chrome.storage.sync.get(null, r))),
  local: await h.sw.evaluate(() => new Promise((r) => chrome.storage.local.get(null, r))),
};
await h.cleanup();

// 4. Swap in the current files and start again on the same profile.
rmSync(extDir, { recursive: true, force: true });
cpSync(join(ROOT, "extension"), extDir, { recursive: true });
// A store update replaces the extension's service worker script; a browser that
// merely sees changed files under an unpacked folder keeps running the cached
// old one, so drop that cache to get what an update really does.
rmSync(join(profile, "Default", "Service Worker"), { recursive: true, force: true });
h = await startHarness({ extPath: extDir, userDataDir: profile, onWorker: process.env.UPGRADE_DEBUG ? (w) => w.on("console", (m) => console.log("      SWLOG", m.type(), m.text().slice(0, 240))) : undefined });
check("the extension keeps its id across the upgrade", h.extId === extId);
const readInfo = () => h.sw.evaluate(async () => ({
  version: chrome.runtime.getManifest().version,
  alarms: (await chrome.alarms.getAll()).map((a) => a.name).sort(),
  perms: await chrome.permissions.getAll(),
}));
// The upgrade work (migrations, defaults, then the alarms) takes a moment.
let info = await readInfo();
for (let i = 0; i < 20 && info.alarms.length < 7; i++) {
  await new Promise((r) => setTimeout(r, 500));
  info = await readInfo();
}

check(`the new release (${newVersion}) is running`, info.version === newVersion, info.version);
check("the service worker is the new release's code", (await h.sw.evaluate(() => typeof self.GOGPlusValidate)) === "object");
check("all seven background alarms exist", info.alarms.length === 7, info.alarms.join());
const manifestHosts = await h.sw.evaluate(() => chrome.runtime.getManifest().host_permissions);
check("the new manifest declares only gog.com as a host", JSON.stringify(manifestHosts) === JSON.stringify(["https://www.gog.com/*"]), JSON.stringify(manifestHosts));
console.log(`      (info: hosts this profile still holds from the old grant: ${JSON.stringify(info.perms.origins)})`);

const after = {
  sync: await h.sw.evaluate(() => new Promise((r) => chrome.storage.sync.get(null, r))),
  local: await h.sw.evaluate(() => new Promise((r) => chrome.storage.local.get(null, r))),
};
// chrome.storage returns object keys in alphabetical order, so compare canonically.
const canon = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
const lost = [];
for (const [area, seed] of [["sync", sync], ["local", local]]) {
  for (const [k, v] of Object.entries(seed)) {
    if (canon(after[area][k]) !== canon(v)) lost.push(`${area}.${k}: ${JSON.stringify(v).slice(0, 110)} → ${JSON.stringify(after[area][k])?.slice(0, 160)}`);
  }
}
// The FX job may legitimately refresh the rates on first start.
check("every setting and every piece of data the user had is intact", lost.filter((k) => !k.startsWith("sync.rates")).length === 0, lost.join(" || "));
check("nothing the old release stored was dropped", Object.keys(before.local).every((k) => k in after.local) && Object.keys(before.sync).every((k) => k in after.sync));

// 5. Pages still work with that data.
async function pageErrors(url, wait = 1500) {
  const page = await h.context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text()) && errors.push(m.text()));
  await page.goto(url);
  await new Promise((r) => setTimeout(r, wait));
  return { page, errors };
}

{
  const { page, errors } = await pageErrors(`chrome-extension://${extId}/options/options.html`);
  const view = await page.evaluate(() => ({
    currency: document.getElementById("currencySelect")?.value || document.querySelector("select[id*=urrency]:not(#monthlyBudgetCurrency)")?.value,
    vat: document.getElementById("vatPercent")?.value,
    quiet: document.getElementById("quietEnabled")?.checked,
  }));
  check("options page: loads without errors and shows the old settings", errors.length === 0 && view.currency === "EUR" && view.vat === "17" && view.quiet === true, JSON.stringify({ view, errors }));
  await page.close();
}
{
  const { page, errors } = await pageErrors(`chrome-extension://${extId}/tags/tags.html`);
  const tags = await page.evaluate(() => document.body.innerText);
  check("dashboard: loads without errors and lists the old tags and notes", errors.length === 0 && /rpg/.test(tags) && /retro/.test(tags), errors.join(" | ") || tags.slice(0, 120));
  await page.close();
}
{
  const { page, errors } = await pageErrors(`chrome-extension://${extId}/popup/popup.html`);
  check("popup: loads without errors", errors.length === 0, errors.join(" | "));
  await page.close();
}
{
  const { page, errors } = await pageErrors("https://www.gog.com/en/game/alpha_game", 2500);
  const g = await page.evaluate(() => ({
    panel: !!document.getElementById("gog-plus-gamepanel"),
    note: document.getElementById("gog-plus-note")?.value,
    history: !!document.querySelector('[data-section-id="history"]'),
    tags: [...document.querySelectorAll(".gog-plus-tag-chip")].map((c) => c.textContent.replace("×", "").trim()),
  }));
  check("game page: the panel appears with the old note, tags and price history", g.panel && g.note === "Play with Dan\nCheck the DLC" && g.history && g.tags.includes("rpg") && g.tags.includes("co-op"), JSON.stringify(g));
  check("game page: no page errors with data from the old release", errors.length === 0, errors.join(" | "));
  await page.close();
}
{
  const { page, errors } = await pageErrors("https://www.gog.com/en/games/v4", 2000);
  const c = await page.evaluate(() => ({ bar: !!document.getElementById("gog-plus-catbar"), presets: document.getElementById("gog-plus-cat-presets")?.options.length }));
  check("catalog: the bar mounts and the old saved search is offered", c.bar && c.presets >= 2 && errors.length === 0, JSON.stringify({ c, errors }));
  await page.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await h.cleanup();
rmSync(work, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
