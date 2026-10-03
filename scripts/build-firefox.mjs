// Builds a Firefox variant of the extension into dist/firefox (and a zip next to it).
//
//   node scripts/build-firefox.mjs            writes dist/firefox/ and dist/gog-enhancer-firefox.zip
//   node scripts/build-firefox.mjs --no-zip   only the folder (what `web-ext lint` / `web-ext run` want)
//
// The source stays one extension for every browser; only manifest.json differs:
//
//   - Firefox has no extension service worker — a background page that loads the same
//     ES module (`background.scripts` + `"type": "module"`) is its equivalent.
//   - Firefox needs an add-on id for storage.sync, and (for new add-ons) a statement of
//     what the extension collects: nothing, the developer receives no data.
//
// What is NOT verified: there is no Firefox on the machine this was written on, so the
// build has been linted (`npx web-ext lint -s dist/firefox`) but never run in Firefox.
// Folder sync needs the File System Access API, which Firefox doesn't have — that card
// shows its "not supported in this browser" note there, everything else is plain
// WebExtension API.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Same allow-list as build.ps1 — what ships. */
export const INCLUDE = ["background", "content", "icons", "lib", "onboarding", "options", "popup", "tags", "tour", "manifest.json"];

export const GECKO_ID = "gog-enhancer@drummingbird1.github.io";
/** 140 is the first Firefox that understands `data_collection_permissions`. */
export const GECKO_MIN_VERSION = "140.0";

/**
 * The Firefox manifest for a Chrome one.
 * @param {Record<string, any>} chrome
 * @returns {Record<string, any>}
 */
export function firefoxManifest(chrome) {
  const m = JSON.parse(JSON.stringify(chrome));
  if (m.background?.service_worker) {
    m.background = { scripts: [m.background.service_worker], type: m.background.type || "module" };
  }
  m.browser_specific_settings = {
    gecko: {
      id: GECKO_ID,
      strict_min_version: GECKO_MIN_VERSION,
      // The developer receives nothing: no analytics, no accounts, no server. (The optional
      // webhook goes to an address the user types in, and carries only notification text.)
      data_collection_permissions: { required: ["none"] },
    },
  };
  return m;
}

function build({ zip }) {
  const out = join(ROOT, "dist", "firefox");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const name of INCLUDE) {
    if (name === "manifest.json") continue;
    cpSync(join(ROOT, "extension", name), join(out, name), { recursive: true });
  }
  const chrome = JSON.parse(readFileSync(join(ROOT, "extension", "manifest.json"), "utf8"));
  writeFileSync(join(out, "manifest.json"), JSON.stringify(firefoxManifest(chrome), null, 2) + "\n");
  console.log(`Built ${out} (v${chrome.version})`);

  if (!zip) return;
  const zipPath = join(ROOT, "dist", "gog-enhancer-firefox.zip");
  rmSync(zipPath, { force: true });
  const r =
    process.platform === "win32"
      ? spawnSync("powershell", ["-NoProfile", "-Command", `Compress-Archive -Path '${out}\\*' -DestinationPath '${zipPath}' -CompressionLevel Optimal`], { stdio: "inherit" })
      : spawnSync("zip", ["-qr", zipPath, "."], { cwd: out, stdio: "inherit" });
  if (r.status !== 0 || !existsSync(zipPath)) {
    console.error("Couldn't make the zip (the folder is still there to load as a temporary add-on).");
    process.exit(1);
  }
  console.log(`Built ${zipPath}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build({ zip: !process.argv.includes("--no-zip") });
}
