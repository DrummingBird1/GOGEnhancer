// Backup compatibility: the PREVIOUS release (a git tag) writes a backup with its
// own Export buttons — plain and password-protected — and the CURRENT release
// reads them back through its Import button. Also checks that the current
// release's own export (with note images) round-trips, and that a hostile file
// is refused or cleaned rather than stored.
//
//   node e2e/backup-compat.mjs [fromTag]     (default v4.0.0)

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, cpSync, readFileSync, writeFileSync } from "node:fs";
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
const canon = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));

const work = mkdtempSync(join(tmpdir(), "gog-enhancer-backup-"));
const oldExt = join(work, "old");
mkdirSync(oldExt, { recursive: true });
execFileSync("git", ["-c", `safe.directory=${ROOT}`, "-C", ROOT, "archive", "--format=tar", "-o", join(work, "old.tar"), FROM, "extension"]);
execFileSync("tar", ["-xf", "old.tar"], { cwd: work });
cpSync(join(work, "extension"), oldExt, { recursive: true });
console.log(`Backups written by ${FROM}, read by the current release\n`);

const sync = { targetCurrency: "PLN", theme: "amber", vatPercent: 23, taxEstimator: true, hebrewTranslations: false };
const local = {
  tags: { alpha_game: ["rpg", "co-op"], gamma: ["שבת"] },
  notes: { alpha_game: "Line one\nLine two — ünïcode ✓" },
  gameStatus: { alpha_game: "finished" },
  priceHistory: { alpha_game: [{ d: "2026-09-10", p: 14.99, c: "USD" }, { d: "2026-10-30", p: 24.99, c: "USD", b: 49.99 }] },
  purchaseLog: { gamma: { purchaseDate: "2026-10-20", price: 9.99, currency: "USD" } },
};

// 1. The old release exports (plain and encrypted).
const old = await startHarness({ extPath: oldExt });
await old.setSettings({ sync, local });
const op = await old.context.newPage();
await op.goto(`chrome-extension://${old.extId}/options/options.html`);
const [plainDl] = await Promise.all([op.waitForEvent("download", { timeout: 10000 }), op.click("#exportAll")]);
const plainPath = join(work, "plain.json");
await plainDl.saveAs(plainPath);
const PASS = "correct horse battery";
op.on("dialog", (d) => d.accept(PASS));
const [encDl] = await Promise.all([op.waitForEvent("download", { timeout: 15000 }).catch(() => null), op.click("#exportAllEncrypted")]);
const encPath = join(work, "enc.json");
if (encDl) await encDl.saveAs(encPath);
await old.cleanup();
check(`${FROM} wrote a plain backup`, JSON.parse(readFileSync(plainPath, "utf8")).local?.tags?.alpha_game?.length === 2);
check(`${FROM} wrote an encrypted backup`, !!encDl && !!JSON.parse(readFileSync(encPath, "utf8")).format);

// 2. The current release imports both.
const cur = await startHarness({ extPath: join(ROOT, "extension") });
const page = await cur.context.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
await page.goto(`chrome-extension://${cur.extId}/options/options.html`);
let dialogs = [];
page.on("dialog", (d) => {
  dialogs.push(`${d.type()}: ${d.message().slice(0, 90)}`);
  d.accept(d.type() === "prompt" ? PASS : undefined);
});
async function importFile(path) {
  dialogs = [];
  await page.setInputFiles("#importFile", path);
  await new Promise((r) => setTimeout(r, 1800));
}
const stored = async () => ({
  sync: await cur.sw.evaluate(() => new Promise((r) => chrome.storage.sync.get(null, r))),
  local: await cur.sw.evaluate(() => new Promise((r) => chrome.storage.local.get(null, r))),
});
function same(got) {
  const bad = [];
  for (const [k, v] of Object.entries(sync)) if (canon(got.sync[k]) !== canon(v)) bad.push(`sync.${k}`);
  for (const [k, v] of Object.entries(local)) if (canon(got.local[k]) !== canon(v)) bad.push(`local.${k}`);
  return bad;
}

await importFile(plainPath);
let got = await stored();
check("the plain backup imports with every setting and all data intact", same(got).length === 0, same(got).join() + " | " + dialogs.join(" ; "));
check("…and says so, without skipping anything", dialogs.some((d) => /Imported successfully/.test(d)) && !dialogs.some((d) => /skipped/.test(d)), dialogs.join(" ; "));

await cur.setSettings({ sync: { targetCurrency: "USD", theme: "neon" }, local: { tags: {}, notes: {} } });
await importFile(encPath);
got = await stored();
check("the old encrypted backup (older key settings) opens with its password and imports intact", same(got).length === 0, same(got).join() + " | " + dialogs.join(" ; "));

// 3. The current release's own export round-trips, images included.
await page.evaluate(async () => {
  await window.GOGPlusAttachments.saveAttachment("alpha_game", new Blob([new Uint8Array([255, 216, 255, 1, 2, 3, 4])], { type: "image/jpeg" }));
});
const [ownDl] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), page.click("#exportAll")]);
const ownPath = join(work, "own.json");
await ownDl.saveAs(ownPath);
const own = JSON.parse(readFileSync(ownPath, "utf8"));
check("its own export carries the data and the note image", own.noteImages?.length === 1 && own.local.tags.alpha_game.length === 2);
await page.evaluate(() => window.GOGPlusAttachments.deleteAttachment("alpha_game"));
await cur.setSettings({ local: { tags: {} } });
await importFile(ownPath);
got = await stored();
const imgBack = await page.evaluate(async () => !!(await window.GOGPlusAttachments.getAttachment("alpha_game")));
check("…and importing it back restores both", same(got).length === 0 && imgBack, same(got).join());

// 4. Hostile and broken files.
const evil = {
  sync: { theme: { x: 1 }, targetCurrency: "javascript:alert(1)", __proto__: { polluted: true }, bogusKey: 1 },
  local: {
    tags: { "../evil": ["x"], constructor: ["y"], ok_slug: ["<img src=x onerror=alert(1)>"] },
    notes: { ok_slug: "<script>alert(1)</script>" },
    priceHistory: { ok_slug: [{ d: "<b>", p: "NaN", c: "ZZZZZ" }] },
    catalogPresets: { bad: "https://evil.example/", good: "/en/games?price=below_10" },
    tagColors: { x: "url(javascript:1)" },
  },
};
writeFileSync(join(work, "evil.json"), JSON.stringify(evil));
await cur.setSettings({ sync: { targetCurrency: "USD", theme: "neon" }, local: { tags: {}, notes: {}, catalogPresets: {}, priceHistory: {}, tagColors: {} } });
await importFile(join(work, "evil.json"));
got = await stored();
check("a hostile file does not set an unknown key, a bad theme or a bad currency", got.sync.bogusKey === undefined && got.sync.targetCurrency === "USD" && got.sync.theme === "neon", JSON.stringify({ t: got.sync.theme, c: got.sync.targetCurrency, b: got.sync.bogusKey }));
check("…drops path-like and prototype slugs but keeps the valid game", !("../evil" in (got.local.tags || {})) && !Object.prototype.hasOwnProperty.call(got.local.tags || {}, "constructor"), JSON.stringify(got.local.tags));
check("…keeps text as text (it is escaped when shown) and drops invalid history rows and colours", !(got.local.tagColors?.x) && (got.local.priceHistory?.ok_slug || []).length === 0, JSON.stringify({ c: got.local.tagColors, h: got.local.priceHistory }));
check("…only follows saved searches that stay on gog.com", got.local.catalogPresets?.bad === undefined && got.local.catalogPresets?.good === "/en/games?price=below_10", JSON.stringify(got.local.catalogPresets));
check("…and tells the user items were skipped", dialogs.some((d) => /skipped/.test(d)), dialogs.join(" ; "));

writeFileSync(join(work, "junk.json"), "this is not json {");
await importFile(join(work, "junk.json"));
check("a file that is not JSON is refused with a message", dialogs.some((d) => /Import failed/.test(d)), dialogs.join(" ; "));
check("no uncaught page errors on the options page", pageErrors.length === 0, pageErrors.join(" | "));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await cur.cleanup();
rmSync(work, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
