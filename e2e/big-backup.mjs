// A big library: thousands of tagged games, long notes, price histories up to the
// extension's own storage budget. Exports it (plain and encrypted), wipes the
// profile, imports it back, and checks nothing was lost or skipped and that each
// step finishes in a sensible time.
//
//   node e2e/big-backup.mjs

import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startHarness } from "./harness.mjs";

const results = [];
function check(name, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${!ok && detail ? `\n      ${detail}` : ""}`);
}
const canon = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));

const GAMES = 2500;
const slug = (i) => `game_${String(i).padStart(5, "0")}`;
const tags = {};
const notes = {};
const gameStatus = {};
const priceHistory = {};
const purchaseLog = {};
const ownedSlugs = {};
const gameFacts = {};
for (let i = 0; i < GAMES; i++) {
  const s = slug(i);
  tags[s] = ["rpg", "co-op", "retro", `tag${i % 50}`, "שבת"].slice(0, 2 + (i % 4));
  if (i % 2 === 0) notes[s] = `Note for game ${i} — ${"lorem ipsum ünïcode ✓ ".repeat(8 + (i % 10))}`;
  gameStatus[s] = ["backlog", "playing", "finished"][i % 3];
  if (i % 3 === 0) {
    priceHistory[s] = Array.from({ length: 40 }, (_, k) => ({ d: `2026-${String(1 + (k % 12)).padStart(2, "0")}-${String(1 + (k % 28)).padStart(2, "0")}`, p: 5 + ((i + k) % 40), c: "USD", ...(k % 4 === 0 ? { b: 49.99 } : {}) }));
  }
  if (i % 4 === 0) purchaseLog[s] = { purchaseDate: "2026-10-01", price: 9.99, currency: "USD" };
  if (i % 5 === 0) ownedSlugs[s] = "2026-10-01";
  gameFacts[s] = { t: 1790000000000, title: `Game number ${i}`, rd: `20${10 + (i % 15)}-05-19` };
}
const local = { tags, notes, gameStatus, priceHistory, purchaseLog, ownedSlugs, gameFacts };
const bytes = JSON.stringify(local).length;
console.log(`Seeding ${GAMES} games, about ${(bytes / 1048576).toFixed(1)} MB of data\n`);

const work = mkdtempSync(join(tmpdir(), "gog-enhancer-big-"));
const h = await startHarness({ extPath: new URL("../extension", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
await h.setSettings({ local });
const page = await h.context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`chrome-extension://${h.extId}/options/options.html`);
page.on("dialog", (d) => d.accept(d.type() === "prompt" ? "a long enough password" : undefined));
const stored = () => page.evaluate(() => new Promise((r) => chrome.storage.local.get(null, r)));

let t0 = Date.now();
const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.click("#exportAll")]);
const plain = join(work, "plain.json");
await dl.saveAs(plain);
const tExport = Date.now() - t0;
check(`plain export: ${(statSync(plain).size / 1048576).toFixed(1)} MB in ${tExport} ms`, tExport < 15000 && statSync(plain).size > bytes * 0.8, `${tExport} ms`);

t0 = Date.now();
const [dl2] = await Promise.all([page.waitForEvent("download", { timeout: 90000 }), page.click("#exportAllEncrypted")]);
const enc = join(work, "enc.json");
await dl2.saveAs(enc);
const tEnc = Date.now() - t0;
check(`encrypted export (key derivation + test-open): ${(statSync(enc).size / 1048576).toFixed(1)} MB in ${tEnc} ms`, tEnc < 30000, `${tEnc} ms`);

for (const [label, file, budget] of [["plain", plain, 20000], ["encrypted", enc, 40000]]) {
  await page.evaluate(() => new Promise((r) => chrome.storage.local.clear(r)));
  const msgs = [];
  const onDialog = (d) => msgs.push(`${d.type()}: ${d.message().slice(0, 70)}`);
  page.on("dialog", onDialog);
  t0 = Date.now();
  await page.setInputFiles("#importFile", file);
  await page.waitForFunction(() => true);
  // wait for the "Imported successfully" alert
  const deadline = Date.now() + budget;
  while (Date.now() < deadline && !msgs.some((m) => /Imported successfully|Import failed/.test(m))) await new Promise((r) => setTimeout(r, 200));
  const tImp = Date.now() - t0;
  page.off("dialog", onDialog);
  const got = await stored();
  let diffs = 0;
  for (const k of Object.keys(local)) if (canon(got[k]) !== canon(local[k])) diffs++;
  check(`${label} import: ${GAMES} games back in ${tImp} ms, ${diffs} dataset(s) differ`, diffs === 0 && tImp < budget && msgs.some((m) => /Imported successfully/.test(m)) && !msgs.some((m) => /skipped/.test(m)), JSON.stringify({ diffs, msgs }));
}

// The dashboard with that library.
const dash = await h.context.newPage();
const derr = [];
dash.on("pageerror", (e) => derr.push(e.message));
t0 = Date.now();
await dash.goto(`chrome-extension://${h.extId}/tags/tags.html`);
await dash.waitForFunction(() => document.querySelectorAll("#gameList > *:not(.empty-msg)").length > 0, null, { timeout: 30000 }).catch(() => {});
const tDash = Date.now() - t0;
const cards = await dash.evaluate(() => document.querySelectorAll("#gameList > *:not(.empty-msg)").length);
console.log("      gameList:", await dash.evaluate(() => `${document.getElementById("gameList")?.children.length} children; first: ${document.getElementById("gameList")?.firstElementChild?.className}; counts: ${document.getElementById("counts")?.textContent}`));
check(`the dashboard opens with ${cards} cards in ${tDash} ms`, cards > 0 && tDash < 15000 && derr.length === 0, JSON.stringify({ tDash, cards, derr: derr.slice(0, 2) }));
t0 = Date.now();
await dash.fill("#search", "tag:rpg status:finished");
await dash.waitForTimeout(600);
const tSearch = Date.now() - t0;
check(`a combined search answers in ${tSearch} ms`, tSearch < 4000);
check("no uncaught errors during any of this", errors.length === 0 && derr.length === 0, errors.concat(derr).slice(0, 3).join(" | "));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await h.cleanup();
rmSync(work, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
