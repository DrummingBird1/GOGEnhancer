// One command to run the checks before declaring work done.
//
//   npm run verify            the gates every change must pass: unit tests, lint, typecheck, coverage
//   npm run verify -- --e2e   …plus the end-to-end suite and the build of both zips
//   npm run verify -- --full  …plus every local deep check in e2e/ (needs a Chromium that honours
//                              --load-extension — see ARCHITECTURE.md "Running and debugging")
//
// Prints one line per step and a summary; exits 1 if any step failed. Steps that need a
// saved login (live-account) or touch the real site (live-*) are never run from here.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const full = args.has("--full");
const e2e = full || args.has("--e2e");

/** @type {Array<[string, string[]]>} */
const steps = [
  ["unit tests", ["npm", "test"]],
  ["lint", ["npm", "run", "lint"]],
  ["typecheck", ["npm", "run", "typecheck"]],
  ["coverage thresholds", ["npm", "run", "coverage"]],
];
if (e2e) {
  steps.push(
    ["end-to-end suite (synthetic + recorded shapes)", ["npm", "run", "e2e"]],
    ["Chrome zip", ["pwsh", "-NoProfile", "-File", "build.ps1"]],
    ["Firefox zip", ["npm", "run", "build:firefox"]],
    ["zip contents + the unpacked zip in a browser", ["node", "e2e/zip-check.mjs"]]
  );
}
if (full) {
  for (const [label, file] of [
    ["upgrade from 4.0.0 / 3.0.0 / 2.9.0", null],
    ["old backups into the current release", "e2e/backup-compat.mjs"],
    ["currency pages (fixtures)", "e2e/locales.mjs"],
    ["every extension page in 7 languages", "e2e/pages-sweep.mjs"],
    ["keyboard and colour contrast", "e2e/a11y-deep.mjs"],
    ["markup resilience", "e2e/markup-resilience.mjs"],
    ["service worker reliability", "e2e/sw-reliability.mjs"],
    ["large backup", "e2e/big-backup.mjs"],
    ["soak (memory, listeners)", "e2e/soak.mjs"],
  ]) {
    if (file) steps.push([label, ["node", file]]);
    else for (const tag of ["v4.0.0", "v3.0.0", "v2.9.0"]) steps.push([`${label}: ${tag}`, ["node", "e2e/upgrade.mjs", tag]]);
  }
}

const isWin = process.platform === "win32";
let failed = 0;
const rows = [];
for (const [label, cmd] of steps) {
  const t0 = Date.now();
  process.stdout.write(`▶ ${label} … `);
  const [bin, ...rest] = cmd;
  const r = spawnSync(isWin && bin === "npm" ? "npm.cmd" : bin, rest, { cwd: ROOT, encoding: "utf8", shell: isWin && bin === "npm", maxBuffer: 64 * 1024 * 1024 });
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? "ok" : "FAILED"} (${secs}s)`);
  if (!ok) console.log(String((r.stdout || "") + (r.stderr || "")).split("\n").slice(-25).join("\n"));
  rows.push([label, ok]);
}
console.log(`\n${rows.length - failed}/${rows.length} steps passed${failed ? ` — ${failed} failed` : ""}.`);
if (!existsSync(resolve(ROOT, "node_modules"))) console.log("(node_modules is missing: run `npm install` first)");
process.exit(failed ? 1 : 0);
