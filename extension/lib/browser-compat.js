/**
 * GOG+ Firefox compatibility groundwork (v3.0.0, UNVERIFIED — see CLAUDE.md
 * and the README's browser-support note; only Chromium-based tooling is
 * available to actually test with here).
 *
 * Every other module in this codebase calls the callback-based `chrome.*`
 * namespace directly (GOGPlusStorage etc. wrap it in promises, but the raw
 * calls underneath are still `chrome.storage.local.get(keys, cb)` style).
 * Chrome and Chromium-based browsers (Edge, Brave, Opera, ...) always
 * expose `chrome`. Firefox's WebExtensions historically exposed only the
 * promise-based `browser` namespace, though modern Firefox also aliases
 * `chrome` for compatibility — this shim exists for the narrower case of a
 * Firefox build/config where only `browser` is present, so the rest of the
 * codebase doesn't need a single line changed to run there.
 *
 * Must load FIRST — before any other module touches `chrome.*` — in both
 * manifest.json's content_scripts list and background.js's imports, and as
 * the first <script> in every extension page (popup/options/onboarding/tags).
 *
 * What this does NOT cover (still real, unverified gaps for a Firefox port):
 *   - manifest.json's `background.service_worker` + `"type": "module"` is a
 *     Chrome MV3 pattern; Firefox's MV3 background support differs (event
 *     pages / background scripts) and may need a Firefox-specific manifest
 *     variant to actually load.
 *   - chrome.alarms, chrome.notifications, and chrome.action are assumed
 *     present with matching semantics; Firefox's implementations have not
 *     been exercised against this extension's actual usage.
 */
// @ts-check

(() => {
  "use strict";

  // `self` is a universal alias for the global object in every context this
  // file actually loads into (page window, content script, service worker)
  // — no real case here has `self` undefined, so this doesn't need a
  // separate `window` fallback the way some browser feature-detection does.
  const g = typeof self !== "undefined" ? self : globalThis;
  if (typeof g.chrome === "undefined" && typeof g.browser !== "undefined") {
    g.chrome = g.browser;
  }
})();
