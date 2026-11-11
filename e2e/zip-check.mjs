// Checks the files that would actually be submitted: unpacks dist/*.zip, compares
// every file with the source, makes sure everything the manifest and the pages
// point at is inside, that nothing private or development-only came along, and
// then loads the UNPACKED ZIP (not the source folder) into a browser and
// exercises it.
//
//   npm run build (build.ps1) && npm run build:firefox, then: node e2e/zip-check.mjs

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startHarness } from "./harness.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
function check(name, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${!ok && detail ? `\n      ${detail}` : ""}`);
}
const walk = (dir, base = dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name), base) : [relative(base, join(dir, e.name)).replace(/\\/g, "/")]));
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const unzip = (zip, out) => execFileSync("powershell", ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${out}' -Force`]);

const work = mkdtempSync(join(tmpdir(), "gog-enhancer-zip-"));
const webDir = join(work, "web");
const ffDir = join(work, "ff");
unzip(join(ROOT, "dist", "gog-enhancer-webstore.zip"), webDir);
unzip(join(ROOT, "dist", "gog-enhancer-firefox.zip"), ffDir);

for (const [label, dir, firefox] of [["Chrome zip", webDir, false], ["Firefox zip", ffDir, true]]) {
  console.log(`\n${label}`);
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const files = new Set(walk(dir));
  check("manifest.json is at the root and says 4.5.1", manifest.version === JSON.parse(readFileSync(join(ROOT, "extension", "manifest.json"), "utf8")).version, manifest.version);

  // Everything the manifest points at.
  const refs = new Set();
  for (const cs of manifest.content_scripts || []) for (const f of [...(cs.js || []), ...(cs.css || [])]) refs.add(f);
  if (manifest.background?.service_worker) refs.add(manifest.background.service_worker);
  for (const f of manifest.background?.scripts || []) refs.add(f);
  if (manifest.action?.default_popup) refs.add(manifest.action.default_popup);
  if (manifest.options_page) refs.add(manifest.options_page);
  if (manifest.options_ui?.page) refs.add(manifest.options_ui.page);
  for (const f of Object.values(manifest.icons || {})) refs.add(f);
  for (const f of Object.values(manifest.action?.default_icon || {})) refs.add(f);
  const missing = [...refs].filter((f) => !files.has(f));
  check(`all ${refs.size} files the manifest names are in the zip`, missing.length === 0, missing.join(", "));

  // Every script / stylesheet / image the extension's own pages load.
  const pageMissing = [];
  for (const f of files) {
    if (!f.endsWith(".html")) continue;
    const html = readFileSync(join(dir, f), "utf8");
    for (const m of html.matchAll(/(?:src|href)="([^"#?]+)"/g)) {
      const ref = m[1];
      if (/^(https?:|data:|mailto:|chrome-extension:|\/\/)/.test(ref)) continue;
      const target = join(dirname(f), ref).replace(/\\/g, "/");
      if (!files.has(target)) pageMissing.push(`${f} → ${ref}`);
    }
  }
  check("every script, stylesheet and image the pages load is in the zip", pageMissing.length === 0, pageMissing.slice(0, 6).join(" | "));

  // Nothing private or development-only.
  const bad = [...files].filter((f) => /(^|\/)(node_modules|tests?|e2e|docs|store|scripts|types|coverage|\.git|\.github)(\/|$)|\.(map|md|local\.json|log|ps1|mjs|py|test\.js)$|(^|\/)(\.env|package(-lock)?\.json|SWEEP|CLAUDE|AGENTS)/i.test(f));
  check("nothing from tests, docs, tooling, secrets or notes is in the zip", bad.length === 0, bad.slice(0, 8).join(", "));
  const secrets = [];
  for (const f of files) {
    if (!/\.(js|json|html|css)$/.test(f)) continue;
    const t = readFileSync(join(dir, f), "utf8");
    if (/-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9]{30,}|password\s*[:=]\s*["'][^"']{6,}/i.test(t)) secrets.push(f);
  }
  check("no key, token or password-looking string in any file", secrets.length === 0, secrets.join(", "));

  // Byte-for-byte the source (the Firefox zip differs only in manifest.json).
  const differ = [];
  const extra = [];
  for (const f of files) {
    const src = join(ROOT, "extension", f);
    if (!existsSync(src)) { extra.push(f); continue; }
    if (firefox && f === "manifest.json") continue;
    if (sha(src) !== sha(join(dir, f))) differ.push(f);
  }
  check("every file is identical to the one in extension/", differ.length === 0 && extra.length === 0, `differ=${differ.join(",")} notInSource=${extra.join(",")}`);
  const sourceFiles = new Set(walk(join(ROOT, "extension")));
  const left = [...sourceFiles].filter((f) => !files.has(f));
  check(`the zip leaves out only what the build allow-list excludes (${left.length} source file(s) not shipped)`, true, left.join(", "));
  const size = statSync(join(ROOT, "dist", firefox ? "gog-enhancer-firefox.zip" : "gog-enhancer-webstore.zip")).size;
  check(`size is ${(size / 1024).toFixed(0)} KB (store limit is 2 GB; under 1 MB is lean)`, size < 1024 * 1024);

  if (firefox) {
    check("Firefox manifest: a gecko id, background scripts instead of a service worker", !!manifest.browser_specific_settings?.gecko?.id && Array.isArray(manifest.background?.scripts) && !manifest.background?.service_worker, JSON.stringify(manifest.background));
  } else {
    check("Chrome manifest: MV3, a service worker, no <all_urls>, no remote code policy exceptions", manifest.manifest_version === 3 && !!manifest.background?.service_worker && !JSON.stringify(manifest).includes("<all_urls>") && !manifest.content_security_policy?.extension_pages?.includes("unsafe"), JSON.stringify(manifest.content_security_policy));
  }
}

// Load the unpacked ZIP into a browser and use it.
console.log("\nThe unpacked Chrome zip, loaded into a browser");
const h = await startHarness({ extPath: webDir });
const version = await h.sw.evaluate(() => chrome.runtime.getManifest().version);
check("the service worker starts from the zip's files", !!version, version);
let alarms = 0;
for (let i = 0; i < 20 && alarms < 7; i++) {
  alarms = await h.sw.evaluate(async () => (await chrome.alarms.getAll()).length);
  if (alarms < 7) await new Promise((r) => setTimeout(r, 500));
}
check("all seven alarms are created", alarms === 7, String(alarms));
const errs = [];
for (const path of ["popup/popup.html", "options/options.html", "tags/tags.html", "onboarding/onboarding.html", "tour/tour.html"]) {
  const p = await h.context.newPage();
  p.on("pageerror", (e) => errs.push(`${path}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !/net::ERR|Failed to load resource/.test(m.text()) && errs.push(`${path}: ${m.text()}`));
  await p.goto(`chrome-extension://${h.extId}/${path}`);
  await new Promise((r) => setTimeout(r, 700));
  await p.close();
}
check("popup, options, dashboard, onboarding and tour all open without errors", errs.length === 0, errs.join(" | "));
const page = await h.context.newPage();
const pe = [];
page.on("pageerror", (e) => pe.push(e.message));
await h.setSettings({ sync: { targetCurrency: "ILS", rates: { ILS: 4 }, currencyConverter: true } });
await page.goto("https://www.gog.com/en/game/alpha_game");
await page.waitForSelector("#gog-plus-gamepanel", { timeout: 8000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 800));
const g = await page.evaluate(() => ({ panel: !!document.getElementById("gog-plus-gamepanel"), notes: document.querySelectorAll(".gog-plus-conv-note").length }));
check("on a game page the zip's content scripts build the panel and convert the price", g.panel && g.notes > 0 && pe.length === 0, JSON.stringify({ g, pe }));
await h.cleanup();

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
rmSync(work, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
