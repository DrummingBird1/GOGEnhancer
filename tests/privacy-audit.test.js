import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, join } from "node:path";

// The privacy promise is only as good as the check that keeps it true. These
// tests fail when the code, the manifest and the documents stop agreeing:
//   • a permission or host added to manifest.json without PRIVACY.md,
//     docs/privacy.html and store/STORE_LISTING.md saying so,
//   • a network destination added to lib/net.js without the same,
//   • a network call that bypasses lib/net.js (and so its allow-list and log),
//   • anything that could load or run remote code.
// CLAUDE.md's "Doc consistency" rule describes the human process; this is the
// part a machine can enforce.

const ROOT = resolve(__dirname, "..");
const EXT = resolve(ROOT, "extension");
const read = (p) => readFileSync(resolve(ROOT, p), "utf8");
const manifest = JSON.parse(read("extension/manifest.json"));

await import("../extension/lib/net.js");
const NET_HOSTS = Object.keys(window.GOGPlusNet.HOSTS);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const files = walk(EXT);
const rel = (p) => relative(ROOT, p).replace(/\\/g, "/");
const ofType = (...exts) => files.filter((f) => exts.some((e) => f.endsWith(e)));

const PRIVACY = read("PRIVACY.md");
const PRIVACY_HTML = read("docs/privacy.html");
const STORE = read("store/STORE_LISTING.md");
const CLAUDE = read("CLAUDE.md");

const hostOf = (pattern) => pattern.replace(/^https:\/\//, "").replace(/\/\*$/, "");

describe("permissions", () => {
  // If this list has to change, the documents below have to change with it —
  // that is the point. Update this array in the same commit as the documents.
  it("are exactly the ones the documents explain", () => {
    expect([...manifest.permissions].sort()).toEqual(["activeTab", "alarms", "notifications", "storage"]);
    expect([...manifest.host_permissions].sort()).toEqual(["https://api.frankfurter.app/*", "https://www.cheapshark.com/*", "https://www.gog.com/*"]);
    expect(manifest.optional_host_permissions).toEqual(["https://*/*"]);
  });

  it.each(["storage", "activeTab", "alarms", "notifications"])("explains the %s permission in the policy, its web page and the store listing", (perm) => {
    for (const doc of [PRIVACY, PRIVACY_HTML, STORE]) expect(doc).toContain(`\`${perm}\``.replace(/`/g, doc === PRIVACY_HTML ? "" : "`"));
  });

  it.each(manifest.host_permissions)("explains the host permission %s everywhere", (pattern) => {
    for (const doc of [PRIVACY, PRIVACY_HTML, STORE, CLAUDE]) expect(doc).toContain(pattern);
  });

  it("describes the optional webhook permission as optional and user-initiated, everywhere", () => {
    for (const doc of [PRIVACY, PRIVACY_HTML, STORE, CLAUDE]) {
      expect(doc).toContain("optional_host_permissions");
      expect(doc.toLowerCase()).toContain("webhook");
    }
    expect(PRIVACY).toMatch(/never granted|Nothing is requested at install/i);
  });

  it("does not grant broad access at install", () => {
    const all = JSON.stringify(manifest.permissions) + JSON.stringify(manifest.host_permissions);
    expect(all).not.toMatch(/<all_urls>|\*:\/\/\*|"tabs"|"webRequest"|"cookies"|"history"|"downloads"/);
  });
});

describe("network destinations (lib/net.js allow-list)", () => {
  it.each(NET_HOSTS)("%s is declared in the policy, its web page, the store listing and CLAUDE.md or the privacy-boundary notes", (host) => {
    for (const doc of [PRIVACY, PRIVACY_HTML]) expect(doc).toContain(host);
    expect(STORE).toContain(host.replace(/^www\./, ""));
  });

  it("every host permission is on the allow-list (nothing is granted that the code can't use)", () => {
    for (const p of manifest.host_permissions) expect(NET_HOSTS).toContain(hostOf(p));
  });

  it("any allow-listed host WITHOUT a host permission is a documented same-company API reached under the page's CORS rules", () => {
    const granted = new Set(manifest.host_permissions.map(hostOf));
    const corsOnly = NET_HOSTS.filter((h) => !granted.has(h));
    expect(corsOnly.sort()).toEqual(["api.gog.com", "catalog.gog.com"]);
    for (const h of corsOnly) expect(PRIVACY).toContain(h);
    expect(PRIVACY).toMatch(/no (?:additional )?permission/i);
  });
});

describe("every network call goes through lib/net.js", () => {
  const jsFiles = ofType(".js", ".mjs");
  const FETCH_ALLOWED = new Set([
    "extension/lib/net.js", // the layer itself
    "extension/background/background.js", // the user's own webhook (host-only logging; see postWebhook)
  ]);

  it("calls fetch() only where it is allowed to", () => {
    const offenders = jsFiles
      .filter((f) => /(?<![\w.$])fetch\s*\(/.test(readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")))
      .map(rel)
      .filter((f) => !FETCH_ALLOWED.has(f));
    // storage.js has a local helper called fetch() — it is not a network call.
    expect(offenders.filter((f) => f !== "extension/lib/storage.js")).toEqual([]);
  });

  it("uses no other way of talking to the network", () => {
    for (const f of jsFiles) {
      const code = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(code, rel(f)).not.toMatch(/XMLHttpRequest|new\s+WebSocket|sendBeacon|new\s+EventSource|importScripts\s*\(\s*["'`]https?:/);
    }
  });

  it("the webhook is the only fetch outside the layer, and it only logs the host", () => {
    const bg = read("extension/background/background.js");
    const code = bg.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect((code.match(/(?<![\w.$])fetch\s*\(/g) || []).length).toBe(1);
    expect(bg).toContain("recordWebhook(new URL(clean).hostname");
  });
});

describe("no remote code, no inline code", () => {
  it("has no eval, Function constructor or string timers", () => {
    for (const f of ofType(".js", ".mjs")) {
      const code = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(code, rel(f)).not.toMatch(/(?<![\w.$])eval\s*\(|new\s+Function\s*\(|(?:setTimeout|setInterval)\s*\(\s*["'`]/);
    }
  });

  it("loads scripts only from inside the extension", () => {
    for (const f of ofType(".html")) {
      const html = readFileSync(f, "utf8");
      for (const m of html.matchAll(/<script\b[^>]*>/gi)) {
        expect(m[0], rel(f)).not.toMatch(/src\s*=\s*["']?(?:https?:)?\/\//i);
        expect(m[0], rel(f)).toMatch(/src\s*=/); // no inline script bodies (MV3 CSP forbids them)
      }
      expect(html, rel(f)).not.toMatch(/<link\b[^>]*href\s*=\s*["']?(?:https?:)?\/\//i);
      expect(html, rel(f)).not.toMatch(/\son[a-z]+\s*=\s*["']/i); // no inline handlers
    }
  });

  it("pulls no remote stylesheets, fonts or images in CSS", () => {
    for (const f of ofType(".css")) {
      expect(readFileSync(f, "utf8"), rel(f)).not.toMatch(/@import|url\(\s*["']?(?:https?:)?\/\//i);
    }
  });

  it("declares no extension-page CSP loosening", () => {
    expect(JSON.stringify(manifest.content_security_policy || {})).not.toMatch(/unsafe-eval|unsafe-inline|https?:\/\//);
  });
});

describe("the documents agree with each other", () => {
  it("README, the Hebrew README, the policy and the store listing all mention the optional webhook permission row", () => {
    expect(read("README.md")).toContain("Optional host");
    expect(read("README.he.md")).toContain("Host אופציונלי");
  });
});
