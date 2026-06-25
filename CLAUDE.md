# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**GOG Enhancer** — an unofficial third-party Chromium extension (Manifest V3) that enhances gog.com with live currency conversion, price-history tracking, custom tags, Hebrew/RTL translations, and visual upgrades. Vanilla JS/CSS, no framework, no bundler.

## Repository layout

The extension lives directly at the repo root — `background/`, `content/`, `lib/`, `popup/`, `options/`, `onboarding/`, `tags/`, `icons/`, and `manifest.json`. User-facing docs (`README.md`, `PRIVACY.md`, `LICENSE`) also sit at the root.

Auxiliary folders keep the rest tidy:
- `docs/` — internal dev docs (`STORE_LISTING.md` for Web Store submission text).
- `screenshots/` — the 5 listing PNGs (uploaded separately to the Web Store, not bundled in the zip).
- `dist/` — build outputs (gitignored). `build.ps1` writes `dist/gog-enhancer-webstore.zip`; you can also unzip there for Chrome's "Load unpacked".
- `tests/` — Vitest specs for the pure utilities (`lib/storage.js`, `content/currency-detection.js`).
- `.github/workflows/` — CI (`test.yml`) and release automation (`release.yml`).

`build.ps1` produces `dist/gog-enhancer-webstore.zip` for Chrome Web Store submission — code + manifest + icons only. Its `$include` list is the explicit allow-list of what ships. `package.json` + `vitest.config.js` + `package-lock.json` + `eslint.config.js` + `node_modules/` exist solely for the test/lint harness — none of that ships with the extension.

## Running and debugging

The extension itself is plain vanilla JS — no bundler, no framework. A Vitest + ESLint harness lives alongside for pure-utility testing and linting (`npm install` once, see Run tests / Lint below).

- **Load unpacked**: `chrome://extensions/` → enable Developer mode → "Load unpacked" → pick the repo root. On install, the onboarding wizard opens in a new tab automatically.
- **Reload after edits**: click the reload icon for the extension on `chrome://extensions/`, then refresh the gog.com tab. The popup has a "Reload tab" button that does the latter for the active tab.
- **Content-script debug logging**: flip "Verbose console logging" in Advanced Options, or set `window.GOG_PLUS_DEBUG = true` in the gog.com DevTools console for one-off use. The content script logs prefixed `[GOG+]`.
- **Inspect the service worker**: `chrome://extensions/` → "service worker" link under the extension card. Use its console to inspect alarms, FX fetches, and `runtime.onMessage` traffic.
- **Force background jobs** (no need to wait for alarms): in the SW console, send `chrome.runtime.sendMessage({type: "force-fx-refresh"})` / `"force-mods-refresh"` / `"force-wishlist-refresh"`. Or use the buttons on the options page.
- **Repack for Web Store**: `.\build.ps1` → writes `gog-enhancer-webstore.zip` at the repo root.
- **Run tests**: `npm install` (one-time) → `npm test` (one-shot) or `npm run test:watch`. Specs live under `tests/`; environment is happy-dom with a chrome.* shim in `tests/setup.js`.
- **Lint**: `npm run lint` (runs ESLint flat config in `eslint.config.js`). CI also runs this on every push and PR via `.github/workflows/test.yml`.

## GitHub workflow

- `main` is the only branch. Two existing remote commits ("Add files via upload") plus the v2.1+ commits sit on it.
- The repo is at https://github.com/DrummingBird1/GOGEnhancer. Push uses the GitHub noreply email — the account has the "block pushes that expose my email" privacy guard enabled, so commits authored with a personal email will bounce. Use `git -c user.email=<id>+DrummingBird1@users.noreply.github.com -c user.name=DrummingBird1` for a per-command override (no global config write); the numeric id is on the GitHub email-settings page.
- Local Windows checkout triggers git's "dubious ownership" warning. Prefix git commands with `-c safe.directory=<repo-root>` to bypass per command without writing global config.
- **Auto-push convention**: after a finished round of work (multiple related changes, lint+tests green, build verified), commit + push to `main` without requiring per-push confirmation. The user has authorized this end-to-end pattern. Show the resulting commit SHA in the wrap-up message. Don't push WIP mid-conversation; don't push if tests are failing.
- **Releases are tag-driven**: `.github/workflows/release.yml` watches `v*.*.*` tags. To cut a release after a version bump, run `git tag v2.1.2 && git push origin v2.1.2` — the workflow verifies the tag matches `manifest.json`'s `version`, runs `build.ps1` via `pwsh` on the Ubuntu runner, and publishes a GitHub Release with `gog-enhancer-webstore.zip` attached.

## Architecture

### Storage tiering (`lib/storage.js`)

Storage is split across two `chrome.storage` areas, keyed by a hardcoded set:

- **`storage.sync`** (~100 KB, syncs across devices) — **preferences only**: feature toggles, target currency, FX rates, VAT, region preset, onboarding flag.
- **`storage.local`** (~5 MB, per-device) — **user data**: tags, notes, price history, mods list cache, wishlist cache, library, purchase log.

`window.GOGPlusStorage` (also `self.GOGPlusStorage` for the service worker) exposes `get`/`set`/`remove`/`onChange` with promise APIs. **Always go through this wrapper** — it auto-routes keys to the correct area via the `SYNC_KEYS`/`LOCAL_KEYS` sets. If you add a new persisted key, add it to one of those sets in `lib/storage.js`, otherwise it falls through to `local` (safer-by-default but not what you usually want for a preference). Direct `chrome.storage.sync`/`chrome.storage.local` access exists in only three places — the migration in `background.js`, the export/import/clear flows in `options.js`, and inside `lib/storage.js` itself — and is intentional in all three.

Default values live in **`lib/storage.js`**'s sibling **`lib/defaults.js`** as `window.GOG_PLUS_DEFAULTS` (and `self.GOG_PLUS_DEFAULTS` for the SW). It's the single source of truth — adding a new persisted key means three coordinated edits: pick its area in `lib/storage.js` (`SYNC_KEYS`/`LOCAL_KEYS`), add its default value in `lib/defaults.js`, and register the script if a new HTML host needs it.

If a key's storage shape changes, bump `SETTINGS_VERSION` in `lib/defaults.js` and add a branch to `runMigrations()` in `background.js`. The v1→v2 migration already moves `tags`/`notes` from sync to local — model new migrations after it.

### Content-script load order

`manifest.json` injects scripts on `https://www.gog.com/*` in this strict order:

```
lib/defaults.js         → window.GOG_PLUS_DEFAULTS, GOG_PLUS_SETTINGS_VERSION
lib/storage.js          → window.GOGPlusStorage
content/translations.js → window.GOG_PLUS_TRANSLATIONS
content/currency-detection.js → window.GOGPlusCurrency
content/price-history.js → window.GOGPlusPriceHistory
content/tooltips.js     → (binds to data-gog-plus-tip)
content/toasts.js       → window.GOGPlusToasts
content/content.js      → orchestrator (depends on all of the above)
```

`content.js` is the orchestrator; the other files are pure modules that attach singletons to `window`. Adding a new content-script module means registering it in `manifest.json` **before** `content.js`.

### Content-script orchestration (`content/content.js`)

gog.com is an Angular SPA, so the DOM mutates constantly. Strategy:

1. On boot, load settings via `GOGPlusStorage.get(DEFAULTS)`.
2. Run `processAll()` once, which dispatches to per-feature functions (`applyCurrencyConversion`, `applyCardBadges`, `hideExpiredSales`, `applyHebrewTranslations`, `ensureWishlistFilters`, `enhanceGamePage`, etc.).
3. Attach a `MutationObserver` to `main` / `[ng-view]` / `body` with a 250 ms debounced `processAll()`.
4. Subscribe to `GOGPlusStorage.onChange` — when a pref flips, clear `gog-plus-*-done` marker classes and re-run.

Each per-feature pass marks the nodes it processed with a class (`gog-plus-card-done`, `gog-plus-promo-done`, `gog-plus-converted`, `gog-plus-translated`) so it can be idempotent across re-runs.

### Card badge placement (regression-sensitive)

`applyCardBadges` is the v2.0.2 hot zone. Critical rules:

- **Never set `position: relative` on the card anchor itself.** GOG's internal carousel/preview overlays use the card anchor as their positioned ancestor; reparenting `position` there collapses the overlays into the card. Walk up from the cover `<img>` and pick the smallest non-card ancestor (`gog-plus-cover-host`).
- **De-dup by slug.** GOG renders each game as multiple anchors (cover-link + body-link). Stamp only the first one per slug or you'll get duplicate badges.
- Era-aware classes (`gog-plus-cover--classic`, `gog-plus-cover--neon`) go on the same cover host, not the card.

### Background service worker (`background/background.js`)

ES module service worker. Three responsibilities:

1. **`chrome.alarms`-driven jobs**:
   - `gog-plus-fx` (every 12 h) — `fetch('https://api.frankfurter.app/latest?from=USD&to=ILS,EUR,GBP,PLN')`, merge into `rates`. On failure, stores the message in `lastFxError`; on success, clears it.
   - `gog-plus-mods` (every 24 h) — `fetch('https://www.gog.com/en/mods')`, regex-extract game slugs, store as `modsList`.
   - `gog-plus-wishlist` (every 6 h) — update toolbar badge from cached count (see below).
   - `gog-plus-daily` (every 24 h) — local-only. Scans `purchaseLog`, fires `chrome.notifications` for refund windows with 1–2 days left. Only runs if the user enabled `desktopNotifications`; dedupes via `notifLog`.
2. **Lifecycle**: on `onInstalled`, run `runMigrations()` → `ensureDefaults()` → create alarms → open onboarding tab if `reason === "install"`.
3. **Message handler** for `force-fx-refresh`, `force-mods-refresh`, `force-wishlist-refresh`, `wishlist-report`, `open-tag-dashboard`.

### The wishlist badge dance

gog.com is an Angular SPA, so `fetch('/account/wishlist')` from the SW returns the SSR shell, not the wishlist. The badge therefore uses a content-script→background round-trip:

1. When the user visits `/account/wishlist`, `content.js#reportWishlistCount()` polls the DOM at 750 ms intervals (up to ~6 s) until the card count is stable across two consecutive ticks, then counts `a[href*="/game/"]` containing `-NN%` and `chrome.runtime.sendMessage({type: "wishlist-report", discountedCount, total})`. The same data is used to populate live counters on the wishlist filter chips.
2. Background caches `{discountedCount, total}` as `wishlistCache` with a `wishlistCacheUpdatedAt` timestamp and a **24 h TTL**. The `gog-plus-wishlist` alarm only displays the cached count if fresh; otherwise it clears the badge and changes the action title to "visit your wishlist to refresh".

Don't try to make the SW scrape `/account/wishlist` directly — it won't work.

### Privacy boundary (manifest + permissions)

`host_permissions` is intentionally minimal: **`https://www.gog.com/*` and `https://api.frankfurter.app/*` only**. No Google Fonts, no analytics, no remote code. Before adding a third host:

1. Add it to `host_permissions` in `manifest.json`.
2. Update `PRIVACY.md`'s "Data we DO NOT collect / external hosts" section.
3. Update `STORE_LISTING.md`'s single-purpose statement if it changes scope.

The runtime permission `notifications` is opt-in: nothing fires unless the user enables "Desktop notifications" in Advanced Options. Background uses `chrome.notifications.create` only — no network traffic. Triggers live in `background/background.js` (`checkRefundWindowExpirations`, `maybeNotifyWishlistJump`) and dedupe via the `notifLog` key in `storage.local`.

### Security guards (don't regress these)

- **No `innerHTML` for user input.** Tags and notes go through `createElement` + `textContent` (see `renderTags` in `content.js`). The v2.0.1 XSS fix is here — reverting to innerHTML for tag names re-introduces the bug.
- **No inline event handlers** anywhere (Manifest V3 CSP forbids `onclick=`). Bind in JS via `addEventListener`.
- `web_accessible_resources` is restricted to `icons/*.png` for `gog.com` only. `tags.html` and `onboarding.html` are deliberately **not** web-accessible — they would be a fingerprint vector. Open them via `chrome.tabs.create({url: chrome.runtime.getURL(...)})` from the popup/background instead.

### Naming convention quirk

User-facing strings (manifest name, popup header, banner pill, action title) say **"GOG Enhancer"** since v2.0.3. Internal class names, storage keys, and global identifiers still use **`gog-plus`** / **`GOGPlus`** from the v1 codebase. **Do not rename internal identifiers** — existing users' synced settings and local data are keyed on them, and a rename without a migration would silently lose their data.
