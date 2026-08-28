/**
 * GOG+ content-script shared state.
 *
 * content.js used to be one big IIFE where every feature closed over a
 * single `let settings` / `let pageCurrency`. Splitting the orchestrator
 * into content/features/*.js means those can no longer be closure
 * variables — each <script> tag gets its own top-level scope, so the only
 * thing every module shares is `window`.
 *
 * Every feature module holds `const state = window.GOGPlusContentState;`
 * once at load time and always dereferences fresh through it —
 * `state.settings.x`, `state.pageCurrency.x`, `state.observers` — never
 * capturing e.g. `const settings = state.settings` into its own local. That
 * discipline is what makes plain property reassignment on `state` safe: the
 * orchestrator's loadSettings()/onChange handler/processAll() freely do
 * `state.settings = {...}`, `state.pageCurrency = {...}`,
 * `state.observers = []`, and every module sees it immediately because
 * they're all reading through the same shared container object, not a
 * snapshot of one of its properties.
 */
// @ts-check

(() => {
  "use strict";

  const DEFAULTS = window.GOG_PLUS_DEFAULTS;

  const state = {
    settings: { ...DEFAULTS },
    pageCurrency: { code: "USD", symbol: "$" },
    observers: [],
  };

  window.GOGPlusContentState = state;
})();
