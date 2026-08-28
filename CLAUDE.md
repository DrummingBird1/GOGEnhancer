# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**GOG Enhancer** — an unofficial third-party Chromium extension (Manifest V3) that enhances gog.com with live currency conversion, price-history tracking, custom tags, Hebrew/RTL translations, and visual upgrades. Vanilla JS/CSS, no framework, no bundler.

## Repository layout

The shippable extension lives entirely under **`extension/`** — `background/`, `content/`, `lib/`, `popup/`, `options/`, `onboarding/`, `tags/`, `icons/`, and `manifest.json`. This is the folder you "Load unpacked" in Chrome and the only thing `build.ps1` zips. Paths inside `manifest.json` and the HTML files are relative to `extension/`, so the whole folder moves as a unit.

**`store/`** holds Web-Store material that is *not* part of the extension: `STORE_LISTING.md` (submission text) and `screenshots/` (the 5 listing PNGs, uploaded separately to the dashboard). Nothing here ships in the zip.

Everything else stays at the repo root because it's neither the extension nor store-facing:
- User-facing docs: `README.md` (English, the repo's front page), `README.he.md` (full Hebrew translation, linked from the top of both), `PRIVACY.md`, `LICENSE`, `CLAUDE.md`.
- Build + test tooling: `build.ps1`, `package.json`, `package-lock.json`, `vitest.config.js`, `eslint.config.js`, `tests/`, `node_modules/`.
- `.github/workflows/` — CI (`test.yml`) and release automation (`release.yml`).
- `dist/` — build outputs (gitignored). `build.ps1` writes `dist/gog-enhancer-webstore.zip`; you can also unzip there for Chrome's "Load unpacked".

`build.ps1` zips **`extension/`** into `dist/gog-enhancer-webstore.zip` — its `$include` list (relative to `extension/`) is the explicit allow-list of what ships. The test/lint harness never ships.

## Running and debugging

The extension itself is plain vanilla JS — no bundler, no framework. A Vitest + ESLint harness lives alongside for pure-utility testing and linting (`npm install` once, see Run tests / Lint below).

- **Load unpacked**: `chrome://extensions/` → enable Developer mode → "Load unpacked" → pick the **`extension/`** folder (not the repo root). On install, the onboarding wizard opens in a new tab automatically.
- **Reload after edits**: click the reload icon for the extension on `chrome://extensions/`, then refresh the gog.com tab. The popup has a "Reload tab" button that does the latter for the active tab.
- **Content-script debug logging**: flip "Verbose console logging" in Advanced Options, or set `window.GOG_PLUS_DEBUG = true` in the gog.com DevTools console for one-off use. The content script logs prefixed `[GOG+]`.
- **Inspect the service worker**: `chrome://extensions/` → "service worker" link under the extension card. Use its console to inspect alarms, FX fetches, and `runtime.onMessage` traffic.
- **Force background jobs** (no need to wait for alarms): in the SW console, send `chrome.runtime.sendMessage({type: "force-fx-refresh"})` / `"force-mods-refresh"` / `"force-wishlist-refresh"`. Or use the buttons on the options page.
- **Repack for Web Store**: `.\build.ps1` → zips `extension/` into `dist/gog-enhancer-webstore.zip`.
- **Run tests**: `npm install` (one-time) → `npm test` (one-shot) or `npm run test:watch`. Specs live under `tests/`; environment is happy-dom with a chrome.* shim in `tests/setup.js`.
- **Lint**: `npm run lint` (runs ESLint flat config in `eslint.config.js`). CI also runs this on every push and PR via `.github/workflows/test.yml`.
- **Typecheck**: `npm run typecheck` (`tsc --noEmit` against `tsconfig.json`). Covers `extension/lib/**/*.js`, `extension/content/**/*.js`, and `extension/tags/**/*.js` — every module in all three carries `// @ts-check` + JSDoc annotations (extended from `lib/`-only in v2.9.0). Ambient globals (`window.GOGPlusStorage`, `window.GOGPlusContentState`, `window.GOGPlusTagsState`, etc.) are declared in `types/globals.d.ts` at the repo root, kept out of `extension/` so `build.ps1`'s wholesale folder copies never ship it — kept intentionally loose (`any`-shaped) per that file's own doc comment, since the goal is catching typos and cross-module API misuse, not full type safety. `popup/`, `options/`, and `onboarding/` aren't covered (their scripts are plain top-level, not the IIFE+`window.X` pattern content/tags use).

## GitHub workflow

- `main` is the only branch. Two existing remote commits ("Add files via upload") plus the v2.1+ commits sit on it.
- The repo is at https://github.com/DrummingBird1/GOGEnhancer. Push uses the GitHub noreply email — the account has the "block pushes that expose my email" privacy guard enabled, so commits authored with a personal email will bounce. Use `git -c user.email=<id>+DrummingBird1@users.noreply.github.com -c user.name=DrummingBird1` for a per-command override (no global config write); the numeric id is on the GitHub email-settings page.
- Local Windows checkout triggers git's "dubious ownership" warning. Prefix git commands with `-c safe.directory=<repo-root>` to bypass per command without writing global config.
- **Auto-push convention**: after a finished round of work (multiple related changes, lint+tests green, build verified), commit + push to `main` without requiring per-push confirmation. The user has authorized this end-to-end pattern. Show the resulting commit SHA in the wrap-up message. Don't push WIP mid-conversation; don't push if tests are failing.
- **Releases are tag-driven**: `.github/workflows/release.yml` watches `v*.*.*` tags. To cut a release after a version bump, run `git tag v2.1.2 && git push origin v2.1.2` — the workflow verifies the tag matches `manifest.json`'s `version`, runs `build.ps1` via `pwsh` on the Ubuntu runner, and publishes a GitHub Release with `gog-enhancer-webstore.zip` attached.
- **`main` has branch protection** (added v2.9.0): blocks force-pushes and branch deletion, and requires the `test` status check — but `enforce_admins` is **off** and there's no required-PR-review rule, so the direct-push-to-`main` workflow above is unaffected (a push before `test` has finished just prints a "bypassed rule violation" notice, it isn't blocked). Don't turn on required PR reviews or `enforce_admins` without asking first — that would break the established solo-dev workflow this whole section describes.
- **Repo "About" metadata is set explicitly**: description, homepage (the GitHub Pages URL), and topics are pushed via `gh repo edit`, not left blank — check `gh api repos/DrummingBird1/GOGEnhancer --jq '{description, homepage, topics}'` after any messaging change (Patreon → Ko-fi/BMC swap, tagline wording, etc.) so this doesn't drift out of sync with STORE_LISTING.md/README.md the way it once did.
- **README.md's hero section must stay accurate on every release** — it's what GitHub renders as the repo's front page. The version is a live shields.io dynamic-JSON badge reading `extension/manifest.json` off the raw GitHub URL (`https://img.shields.io/badge/dynamic/json?url=...manifest.json&query=%24.version`), **not** hardcoded text — don't revert it to a plain `**Version X.Y.Z**` string, that's exactly what went stale for 5 releases (2.4.1 → 2.9.0) before this fix. The logo is `docs/assets/hero-icon.png`.
- **README.md is English-only; `README.he.md` is the full Hebrew mirror** (since v2.9.0 — README used to code-mix both languages throughout). They link to each other at the top. If you change a section's *content* (not just wording) in one, port the change to the other in the same commit — don't let them drift into "the Hebrew one describes an older feature set."
- **The changelog does NOT live in README.md** (removed in v2.9.0 — every release page already has one, this was redundant). The two sources of truth are `extension/lib/changelog.js` (read by the popup's What's New panel) and `docs/changelog.html` (the website's full version-history page, styled with `docs/assets/site.css`) — `release.yml`'s "Verify a changelog entry exists" step checks both and fails the release if either is missing a `vX.Y.Z` entry. Add to both on every user-facing version bump. README.md/README.he.md's own "Changelog" section is just a two-line pointer to Releases + `docs/changelog.html` — leave it that way.
- **Release images**: before tagging any release, generate its banner —
  ```
  cd store/release-images && uv run --with pillow python generate_release_banner.py --version X.Y.Z --tagline "short headline"
  ```
  then commit `store/release-images/vX.Y.Z.png` in the same commit as the version bump/changelog (so it's present at the tag). `release.yml` picks it up automatically via its raw GitHub URL pinned to the tag and prepends it to the release notes — no workflow changes needed per release. If a release ships without one, nothing breaks; it's just missing that release's image on GitHub. (v2.9.0's own banner was added retroactively via `gh release edit`, pointing at `main` instead of the tag — the tag predates the file. Every future release should get the file committed **before** tagging so this workaround isn't needed again.)

## Architecture

### Storage tiering (`lib/storage.js`)

Storage is split across two `chrome.storage` areas, keyed by a hardcoded set:

- **`storage.sync`** (~100 KB, syncs across devices) — **preferences only**: feature toggles, target currency, FX rates, VAT, region preset, onboarding flag.
- **`storage.local`** (~5 MB, per-device) — **user data**: tags, notes, price history, mods list cache, wishlist cache, library, purchase log.

`window.GOGPlusStorage` (also `self.GOGPlusStorage` for the service worker) exposes `get`/`set`/`remove`/`onChange` with promise APIs. **Always go through this wrapper** — it auto-routes keys to the correct area via the `SYNC_KEYS`/`LOCAL_KEYS` sets. If you add a new persisted key, add it to one of those sets in `lib/storage.js`, otherwise it falls through to `local` (safer-by-default but not what you usually want for a preference). Direct `chrome.storage.sync`/`chrome.storage.local` access exists in only three places — `lib/migrations.js`, the export/import/clear flows in `options.js`, and inside `lib/storage.js` itself — and is intentional in all three.

Default values live in **`lib/storage.js`**'s sibling **`lib/defaults.js`** as `window.GOG_PLUS_DEFAULTS` (and `self.GOG_PLUS_DEFAULTS` for the SW). It's the single source of truth — adding a new persisted key means three coordinated edits: pick its area in `lib/storage.js` (`SYNC_KEYS`/`LOCAL_KEYS`), add its default value in `lib/defaults.js`, and register the script if a new HTML host needs it.

If a key's storage shape changes, bump `SETTINGS_VERSION` in `lib/defaults.js` and add a branch to `GOGPlusMigrations.run()` in `lib/migrations.js`. The v1→v2 migration already moves `tags`/`notes` from sync to local — model new migrations after it. This module is shared: `background.js` runs it on every `onInstalled`, and the Advanced Options import flow runs it after writing imported data into storage, so an old export gets the same shape-fixing pass a normal upgrade would.

### Content-script load order

`manifest.json` injects scripts on `https://www.gog.com/*` in this strict order:

```
lib/defaults.js         → window.GOG_PLUS_DEFAULTS, GOG_PLUS_SETTINGS_VERSION
lib/storage.js          → window.GOGPlusStorage
lib/dom-safety.js       → window.GOGPlusDomSafety (escapeHtml)
lib/currency-format.js  → window.GOGPlusCurrencyFormat (symbolFor, formatPrice)
lib/genres.js           → window.GOGPlusGenres (GENRE_PATTERNS, matchGenrePattern, mapGenreLabel)
lib/game-status.js      → window.GOGPlusGameStatus (STATUSES, statusById) — shared with tags/ dashboard
content/translations.js → window.GOG_PLUS_TRANSLATIONS
content/currency-detection.js → window.GOGPlusCurrency
content/price-history.js → window.GOGPlusPriceHistory
content/tooltips.js     → (binds to data-gog-plus-tip)
content/toasts.js       → window.GOGPlusToasts
content/state.js        → window.GOGPlusContentState ({ settings, pageCurrency, observers })
content/utils.js        → window.GOGPlusContentUtils (debounce, log, slugFromHref, slugFromLocation, gameTitleFromPage)
content/features/currency.js     → window.GOGPlusCurrencyFeature
content/features/card-badges.js  → window.GOGPlusCardBadges
content/features/misc.js         → window.GOGPlusMiscFeatures
content/features/wishlist.js     → window.GOGPlusWishlistFeature
content/features/game-page.js    → window.GOGPlusGamePage
content/features/command-palette.js → window.GOGPlusCommandPalette (Ctrl/Cmd+K quick actions)
content/content.js      → orchestrator (depends on all of the above)
```

`content.js` used to be one ~1560-line file (through v2.7.0); it's now an orchestrator that's genuinely just orchestration, with each feature split into its own file (the v2.8.0 module split). Every feature module shares mutable state via `content/state.js` rather than closure variables — see that file's own doc comment for the discipline this requires (always dereference `state.settings.x`, never capture `const settings = state.settings`). A few feature modules reference each other via the fully-qualified `window.GOGPlusX.fn()` path instead of top-level destructuring specifically to break circular load-order dependencies (e.g. wishlist ↔ currency); check for that pattern before "simplifying" an import.

Adding a new content-script module means registering it in `manifest.json` **before** `content.js`, and after `content/state.js` if it needs shared state.

### Content-script orchestration (`content/content.js`)

gog.com is an Angular SPA, so the DOM mutates constantly. Strategy:

1. On boot, load settings via `GOGPlusStorage.get(DEFAULTS)` into `state.settings`.
2. Run `processAll()` once, which dispatches to per-feature functions imported from `content/features/*.js` (`applyCurrencyConversion`, `applyCardBadges`, `hideExpiredSales`, `applyHebrewTranslations`, `ensureWishlistFilters`, `enhanceGamePage`, etc.).
3. Attach a `MutationObserver` to `main` / `[ng-view]` / `body` with a 250 ms debounced `processAll()`.
4. Subscribe to `GOGPlusStorage.onChange` — when a pref flips, clear `gog-plus-*-done` marker classes and re-run.

Each per-feature pass marks the nodes it processed with a class (`gog-plus-card-done`, `gog-plus-promo-done`, `gog-plus-converted`, `gog-plus-translated`) so it can be idempotent across re-runs.

### Card badge placement (regression-sensitive)

`applyCardBadges` (`content/features/card-badges.js`) is the v2.0.2 hot zone, with direct regression coverage in `tests/apply-card-badges.test.js` — read that file's comments (including the happy-dom layout-engine caveats) before touching the cover-host resolution logic. Critical rules:

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
2. **Lifecycle**: on `onInstalled`, run `GOGPlusMigrations.run()` → `ensureDefaults()` → create alarms → open onboarding tab if `reason === "install"`.
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
