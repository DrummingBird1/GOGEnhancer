// One command for the mechanical parts of a release — the parts that are easy to
// forget (the version, BOTH changelogs, the banner, the gates, the tag):
//
//   node scripts/release.mjs 4.1.0 --tagline "short headline"           check only: shows what it would do
//   node scripts/release.mjs 4.1.0 --tagline "short headline" --apply   bump manifest.json, add changelog stubs, make the banner
//   node scripts/release.mjs 4.1.0 --commit                              (after writing the changelog) run the gates, commit, tag locally
//   node scripts/release.mjs 4.1.0 --push                                 push the branch and the tag — which publishes the GitHub Release
//
// It never pushes unless you pass --push, never edits the changelog text for you
// (the stubs say TODO and --commit refuses to go on while a TODO remains), and
// refuses to start from a dirty tree or a version that isn't newer.
//
// See CLAUDE.md, "GitHub workflow", for what the tag triggers.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "https://github.com/DrummingBird1/GOGEnhancer";
const NOREPLY = "215782517+DrummingBird1@users.noreply.github.com";

/* ---------------- pure helpers (unit-tested) ---------------- */

/** @param {string} v */
export const isVersion = (v) => /^\d+\.\d+\.\d+$/.test(v);

/** -1 / 0 / 1 for a < b / equal / a > b. @param {string} a @param {string} b */
export function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  return 0;
}

/** The manifest text with its version changed. @param {string} manifestText @param {string} version */
export function setManifestVersion(manifestText, version) {
  const re = /("version"\s*:\s*")\d+\.\d+\.\d+(")/;
  if (!re.test(manifestText)) throw new Error('manifest.json has no "version"');
  return manifestText.replace(re, `$1${version}$2`);
}

/**
 * Adds an entry for `version` to extension/lib/changelog.js (after the last one).
 * @param {string} js @param {string} version
 */
export function addChangelogJsStub(js, version) {
  if (js.includes(`"${version}":`)) return js; // already there
  const end = js.indexOf("\n  };", js.indexOf("const CHANGELOG"));
  if (end < 0) throw new Error("couldn't find the end of the CHANGELOG object");
  return js.slice(0, end) + `\n    "${version}": [\n      "TODO: one bullet per user-visible change (these show in the popup's What's new panel)",\n    ],` + js.slice(end);
}

/**
 * Adds an entry for `version` to docs/changelog.html, above the current one,
 * and demotes that one.
 * @param {string} html @param {string} version @param {string} title
 */
export function addChangelogHtmlStub(html, version, title) {
  if (html.includes(`>v${version}<`)) return html;
  const marker = '<div class="cl-entry is-current">';
  const at = html.indexOf(marker);
  if (at < 0) throw new Error('docs/changelog.html has no <div class="cl-entry is-current">');
  const entry = `${marker}
      <div class="cl-version-row"><span class="cl-version">v${version}</span><span class="cl-badge-current">Current</span></div>
      <p class="cl-title">${title}</p>
      <h4>TODO</h4>
      <ul>
        <li>TODO: what changed, in the same words as lib/changelog.js but with the detail the website has room for.</li>
      </ul>
      <a class="cl-release-link" href="${REPO}/releases/tag/v${version}" target="_blank" rel="noopener">View release →</a>
    </div>

    <div class="cl-entry">`;
  const rest = html.slice(at + marker.length).replace('<span class="cl-badge-current">Current</span>', "");
  return html.slice(0, at) + entry + rest;
}

/** Lines of text that still say TODO in the two changelogs. */
export function leftoverTodos(js, html) {
  return [...js.split("\n").map((l, i) => [`lib/changelog.js:${i + 1}`, l]), ...html.split("\n").map((l, i) => [`docs/changelog.html:${i + 1}`, l])]
    .filter(([, l]) => /\bTODO\b/.test(l))
    .map(([where, l]) => `${where}  ${l.trim().slice(0, 100)}`);
}

/* ---------------- the command ---------------- */

const read = (p) => readFileSync(join(ROOT, p), "utf8");
const write = (p, s) => writeFileSync(join(ROOT, p), s);

/** @param {string} cmd @param {string[]} args @param {{ allowFail?: boolean }} [o] */
function run(cmd, args, o = {}) {
  console.log(`  $ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0 && !o.allowFail) throw new Error(`${cmd} ${args[0] || ""} failed (exit ${r.status})`);
}
const git = (...a) => execFileSync("git", ["-c", `safe.directory=${ROOT}`, ...a], { cwd: ROOT, encoding: "utf8" }).trim();

function main(argv) {
  const version = argv.find((a) => /^\d/.test(a)) || "";
  const flag = (n) => argv.includes(`--${n}`);
  const tagline = argv.includes("--tagline") ? argv[argv.indexOf("--tagline") + 1] : "";
  if (!isVersion(version)) {
    console.error("Usage: node scripts/release.mjs <X.Y.Z> [--tagline \"…\"] [--apply | --commit | --push]");
    return 2;
  }

  const manifestPath = "extension/manifest.json";
  const current = JSON.parse(read(manifestPath)).version;
  const dirty = git("status", "--porcelain");
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");

  console.log(`Releasing v${version} (manifest says ${current}), on ${branch}`);
  if (flag("apply")) {
    if (compareVersions(version, current) <= 0) throw new Error(`v${version} is not newer than ${current}`);
    if (dirty) throw new Error("The working tree has uncommitted changes — commit or stash them first.");
    if (!tagline) throw new Error('--apply needs --tagline "short headline" (it becomes the banner and the changelog title)');
    write(manifestPath, setManifestVersion(read(manifestPath), version));
    write("extension/lib/changelog.js", addChangelogJsStub(read("extension/lib/changelog.js"), version));
    write("docs/changelog.html", addChangelogHtmlStub(read("docs/changelog.html"), version, tagline));
    run("uv", ["run", "--with", "pillow", "python", "generate_release_banner.py", "--version", version, "--tagline", tagline], { cwd: join(ROOT, "store", "release-images") });
    console.log(`\nDone. Now:\n  1. replace every TODO in extension/lib/changelog.js and docs/changelog.html\n  2. update README.md / README.he.md / PRIVACY.md / store/STORE_LISTING.md if features or permissions changed\n  3. node scripts/release.mjs ${version} --commit`);
    return 0;
  }

  if (flag("commit")) {
    const todos = leftoverTodos(read("extension/lib/changelog.js"), read("docs/changelog.html"));
    if (todos.length) {
      console.error(`The changelogs still have TODOs:\n  ${todos.join("\n  ")}`);
      return 1;
    }
    if (JSON.parse(read(manifestPath)).version !== version) throw new Error(`manifest.json says ${current}, not ${version} — run --apply first`);
    if (!existsSync(join(ROOT, "store", "release-images", `v${version}.png`))) throw new Error(`store/release-images/v${version}.png is missing — run --apply (or the banner generator) first`);
    console.log("Running the gates…");
    run("npm", ["test"]);
    run("npm", ["run", "lint"]);
    run("npm", ["run", "typecheck"]);
    run("pwsh", ["-NoProfile", "-File", "./build.ps1"]);
    const who = ["-c", `user.email=${NOREPLY}`, "-c", "user.name=DrummingBird1"];
    execFileSync("git", ["-c", `safe.directory=${ROOT}`, ...who, "add", "-A"], { cwd: ROOT, stdio: "inherit" });
    execFileSync("git", ["-c", `safe.directory=${ROOT}`, ...who, "commit", "-m", `v${version}`], { cwd: ROOT, stdio: "inherit" });
    execFileSync("git", ["-c", `safe.directory=${ROOT}`, ...who, "tag", `v${version}`], { cwd: ROOT, stdio: "inherit" });
    console.log(`\nCommitted and tagged v${version} locally. Nothing has been pushed.\nTo publish (this creates the GitHub Release):\n  node scripts/release.mjs ${version} --push`);
    return 0;
  }

  if (flag("push")) {
    if (git("tag", "--list", `v${version}`) !== `v${version}`) throw new Error(`There is no local tag v${version} — run --commit first.`);
    if (dirty) throw new Error("The working tree has uncommitted changes.");
    execFileSync("git", ["-c", `safe.directory=${ROOT}`, "push", "origin", branch], { cwd: ROOT, stdio: "inherit" });
    execFileSync("git", ["-c", `safe.directory=${ROOT}`, "push", "origin", `v${version}`], { cwd: ROOT, stdio: "inherit" });
    console.log(`\nPushed. release.yml now builds the zip and publishes the Release: ${REPO}/actions`);
    return 0;
  }

  // Default: check only.
  const problems = [];
  if (compareVersions(version, current) <= 0) problems.push(`v${version} is not newer than the manifest's ${current}`);
  if (dirty) problems.push("the working tree has uncommitted changes");
  if (!tagline) problems.push('no --tagline given (needed for --apply)');
  console.log(problems.length ? `Not ready: ${problems.join("; ")}.` : `Ready. Run again with --apply to bump the version, add the changelog stubs and make the banner.`);
  return problems.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (e) {
    console.error(String(e instanceof Error ? e.message : e));
    process.exit(1);
  }
}
