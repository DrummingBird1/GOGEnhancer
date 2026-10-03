// Loads every content-script module EXCEPT content.js, in manifest order, so a
// test can exercise the v4 features against the real set of globals. (The
// load-order test is what proves the manifest order itself; this mirrors it.)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const EXT = resolve(__dirname, "../../extension");
const manifest = JSON.parse(readFileSync(resolve(EXT, "manifest.json"), "utf8"));
const files = manifest.content_scripts[0].js.filter((p) => p !== "content/content.js");

for (const f of files) await import(/* @vite-ignore */ resolve(EXT, f));

export const state = window.GOGPlusContentState;

/** Resets stores, DOM, URL and the shared state to a known baseline. */
export function resetEnv({ path = "/en/games", settings = {}, currency = { code: "USD", symbol: "$" }, bodyClass = "" } = {}) {
  globalThis.__resetChromeStores();
  // toasts.js keeps a reference to its host element for the life of the module,
  // so the host must survive a reset (emptied, not removed).
  [...document.body.children].forEach((c) => {
    if (c.classList.contains("gog-plus-toasts")) c.replaceChildren();
    else c.remove();
  });
  document.body.className = bodyClass;
  document.documentElement.className = "";
  window.history.replaceState({}, "", path);
  state.settings = { ...window.GOG_PLUS_DEFAULTS, ...settings };
  state.pageCurrency = currency;
  state.observers.forEach((o) => o.disconnect?.());
  state.observers = [];
  state.failures = {};
  window.GOGPlusCatalog?._state.reset();
  window.GOGPlusReviewTools?._state.reset();
}

export const getLocal = (keys) => new Promise((r) => chrome.storage.local.get(keys, r));

/** Waits for pending microtasks / zero-delay timers. */
export const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// toasts.js keeps a reference to its host element for the whole run, so a test
// that does `document.body.innerHTML = ...` would send every later toast into
// a detached node. Make the body's innerHTML setter keep that one element.
const innerHTML = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
Object.defineProperty(document.body, "innerHTML", {
  configurable: true,
  get() {
    return innerHTML.get.call(this);
  },
  set(html) {
    [...this.childNodes].forEach((n) => {
      if (!(n.nodeType === 1 && n.classList.contains("gog-plus-toasts"))) n.remove();
    });
    this.insertAdjacentHTML("afterbegin", html);
  },
});
