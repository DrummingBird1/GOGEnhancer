# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**GOG Enhancer** — an unofficial third-party Chromium extension (Manifest V3) that enhances gog.com with live currency conversion, price-history tracking, custom tags, Hebrew/RTL translations, and visual upgrades. Vanilla JS/CSS, no framework, no bundler.

## Repository layout

The shippable extension lives entirely under **`extension/`** — `background/`, `content/`, `lib/`, `popup/`, `options/`, `onboarding/`, `tags/`, `icons/`, and `manifest.json`. This is the folder you "Load unpacked" in Chrome and the only thing `build.ps1` zips. Paths inside `manifest.json` and the HTML files are relative to `extension/`, so the whole folder moves as a unit.

**`store/`** holds Web-Store material that is *not* part of the extension: `STORE_LISTING.md` (submission text, English and Hebrew) and `screenshots/` (the 5 listing PNGs, uploaded separately to the dashboard; regenerate with `node e2e/store-screenshots.mjs` — they use demo data) and `release-images/`. Nothing here ships in the zip.

Everything else stays at the repo root because it's neither the extension nor store-facing:
- User-facing docs: `README.md` (English, the repo's front page), `README.he.md` (full Hebrew translation, linked from the top of both), `PRIVACY.md`, `LICENSE`, `CLAUDE.md`.
- Build + test tooling: `build.ps1`, `scripts/` (`release.mjs`, `build-firefox.mjs`), `e2e/`, `package.json`, `package-lock.json`, `vitest.config.js`, `eslint.config.js`, `tests/`, `node_modules/`.
- `docs/` — the GitHub Pages site: `index.html`, `guide.html` (how it works + FAQ), `privacy.html`, `changelog.html`, `assets/`.
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
- **Run tests**: `npm install` (one-time) → `npm test` (one-shot) or `npm run test:watch`. Specs live under `tests/`; environment is happy-dom with a chrome.* shim in `tests/setup.js`. **Use `npm` in this repo, not `pnpm`** (the global "always pnpm" rule is deliberately overridden here): `package-lock.json` is what CI installs from, and a stray `pnpm install` once bumped happy-dom and left a `pnpm-lock.yaml` behind. Content-script feature tests share `tests/helpers/content-env.js` (loads the real modules in manifest order against a fresh DOM) and `tests/helpers/fixtures.js` (markup recorded from the live site). `npm run coverage` enforces the per-folder thresholds in `vitest.config.js` (`lib/` 80/75/80/80) and is what CI runs.
- **`options.js`/`popup.js`/`tags.js` register their boot listener with `{ once: true }`** (`document.addEventListener("DOMContentLoaded", init, { once: true })`) — not cosmetic. Their test files re-import the module fresh per test (`vi.resetModules()` + dynamic `import()`) against the *same* long-lived `document`; without `{ once: true }`, `document.addEventListener` accumulates one listener per test, and a later test's `dispatchEvent(new Event("DOMContentLoaded"))` re-fires *every* earlier test's `init()` too — each of which calls `bind()` against the current test's fresh DOM, attaching duplicate click/change listeners. This stayed invisible for a long time because most existing assertions were loose (`toHaveBeenCalled()`, not an exact count) or idempotent; it surfaced once a v2.11.0 test asserted an exact single alert message. If a new page script needs its own boot listener, register it the same way.
- **End-to-end**: `npm run e2e` loads the real extension into a Chromium and drives it against *synthetic* gog.com pages (`e2e/fixtures.mjs` — a "legacy" markup shape and a "variant" one with no recognisable class names, split prices and a header `h1`), served by intercepting `https://www.gog.com/**` so nothing real is requested. It exists because happy-dom has no layout engine, no real injection and no real MutationObserver timing — it found two bugs the unit tests couldn't. Local only (CI has no Chromium): it needs a build that still honours `--load-extension`, which branded Google Chrome 137+ does not, so it auto-detects one Playwright already installed under `%LOCALAPPDATA%\ms-playwright` (override with `PW_CHROMIUM`; `E2E_SHOTS=dir` saves screenshots). `fixtures.mjs` holds two deliberately generic markup shapes; `fixtures-real.mjs` holds the shapes **recorded from the live site** (structure only, no content). `E2E_ONLY=real` runs just the recorded-shape checks (and `E2E_EXT=<dir>` points them at another build — running them against the released v3.0.0 failed 8 of 11 — all but one for features it already had — which is how the real-site regressions were demonstrated). `E2E_LIVE=1` runs the extension against the real gog.com (a few public, logged-out page loads) — the only way to know the recorded fixtures still match the site; manual use only. Account pages (wishlist/library/cart) need a login and are not covered end to end — only the *shape* of a logged-in wishlist row/tile was recorded (`wishlistV4`, `catalogV4`, `gameV4` in `fixtures-real.mjs`), so anything that depends on logged-in state beyond that structure is unverified against the real site. `E2E_LIVE=1` also checks the v4 catalog bar mounts above the grid, that sorting by title really re-orders the live grid, and that a real game page yields ratings/tags/year into the facts cache. **A lesson the e2e suite taught that happy-dom cannot:** `chrome.storage` returns object keys in *alphabetical* order, so any "did this record change?" comparison must be canonical (sorted keys — see `canonical()` in `content/features/knowledge.js`), or a perfectly steady page rewrites its own record forever (and `knowledge.js` additionally caps itself at `MAX_WRITES_PER_MINUTE`). Unit tests keep insertion order and will never show this class of bug.
- **`tests/load-order.test.js`** loads each entry point's scripts in exactly the order `manifest.json` / the HTML pages list them. Every other suite imports modules in an order the test author chose and would never notice a mis-ordered manifest — which kills the whole content script in a real browser.
- **Lint**: `npm run lint` (runs ESLint flat config in `eslint.config.js`). CI also runs this on every push and PR via `.github/workflows/test.yml`.
- **Typecheck**: `npm run typecheck` (`tsc --noEmit` against `tsconfig.json`). Covers `extension/lib/**/*.js`, `extension/content/**/*.js`, and `extension/tags/**/*.js` — every module in all three carries `// @ts-check` + JSDoc annotations (extended from `lib/`-only in v2.9.0). Ambient globals (`window.GOGPlusStorage`, `window.GOGPlusContentState`, `window.GOGPlusTagsState`, etc.) are declared in `types/globals.d.ts` at the repo root, kept out of `extension/` so `build.ps1`'s wholesale folder copies never ship it — kept intentionally loose (`any`-shaped) per that file's own doc comment, since the goal is catching typos and cross-module API misuse, not full type safety. `popup/`, `options/` and `onboarding/` are plain top-level scripts, not the IIFE+`window.X` pattern, so they are checked by their own `tsconfig.pages-*.json` (see the next bullets).
- **E2E tooling beyond the suite** (all in `e2e/`, all local — CI has no Chromium). `harness.mjs` is the shared launcher (Chromium with the extension, request interception with the fixtures, `setSettings`/`storageGet`; `extraArgs`). `extension.e2e.mjs` is the suite behind `npm run e2e` and also holds the **performance budget** (no single feature pass over 150 ms on 48 tiles / 600 ms on 400, and the page must *settle* — no pass triggered by the extension's own writes; it once caught a feature that re-triggered itself). `structure.mjs` records the live site's structure and diffs it against `e2e/baseline/structure.json` — run it after a site change. `visual.mjs` is screenshot regression against `e2e/baselines/*.png`: byte-identical comparison, so the baselines are specific to the machine's fonts and rendering (`--update` re-records them; never run it in CI). `collect-strings.mjs` lists what the extension's pages show that has no translation row (`--lang he` to look at the result). `store-screenshots.mjs` regenerates the five Web Store / website screenshots (real gog.com pages, **demo data** in the extension's own panels). `save-login.mjs` + `E2E_AUTH=<file>` add a logged-in block to the live run — written but **never run with a real account**.
- **Scripts**: `scripts/release.mjs` does the mechanical parts of a release (version bump in `manifest.json`, changelog stubs in both places, the banner, the gates, the local tag; it refuses to continue while a `TODO` stub remains and never pushes without `--push`); `scripts/build-firefox.mjs` (see "Firefox build" below); `.github/workflows/canary.yml` is a scheduled check of the live site that opens an issue — it can only be dispatched by hand once it is on `main`, and has not been run on GitHub.
- **Typecheck of the page scripts**: `tsconfig.pages-popup.json`, `tsconfig.pages-options.json` and `tsconfig.pages-onboarding.json` check those plain top-level scripts separately (`npm run typecheck` runs all four). The dashboard (`tags/`) is part of the main project.

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

## Dual-agent collaboration (Grok + Claude)

The same repo may be worked by **Claude Code** and **Grok** (this machine + Claude sessions) in parallel. This section is binding for both agents.

### Source of truth

- **`CLAUDE.md` is canonical.** Read it first; treat architecture, load order, storage, privacy, and security rules here as authoritative.
- `AGENTS.md` is a **thin local pointer** (gitignored; per-machine Codex/Grok bootstrap). Never let it grow back into a full stale copy of layout/architecture. If you find an obsolete full `AGENTS.md` (e.g. extension at repo root), replace it with the thin pointer — do not expand it into a second CLAUDE.

### Claim protocol before editing

Prefer separate concerns unless the user assigns differently:

- One agent owns `extension/content/features/*` (+ related tests under `tests/`).
- The other owns `extension/tags/features/*` **or** UI pages (`extension/popup/`, `extension/options/`, `extension/onboarding/`).

Before starting a chunk, **state in chat which paths you will touch**. If the other agent already claimed overlapping paths, wait or pick different files.

**One agent at a time** for these serialized hotspots:

- `extension/manifest.json` (content-script / resource order)
- `extension/lib/defaults.js`, `extension/lib/storage.js`, `extension/lib/migrations.js`
- `extension/lib/i18n.js`
- Shared CSS: `extension/content/content.css`, `extension/content/design-injection.css`, `extension/tags/tags.css`
- `extension/content/state.js`, `extension/tags/state.js`, `extension/content/content.js` (orchestrator)
- `package.json` / `package-lock.json` / `eslint.config.js` / `vitest.config.js`
- Dual docs that must stay paired: `README.md` <-> `README.he.md`, `PRIVACY.md` <-> `store/STORE_LISTING.md`, `extension/lib/changelog.js` <-> `docs/changelog.html`

Do **not** hand-edit generated outputs: `dist/`, `coverage/`, `node_modules/`, or generated release banner PNGs under `store/release-images/` (use the generator in that folder).

### Git / push when both agents are active

- The solo **auto-push-to-`main`** convention in GitHub workflow still applies when only **one** agent is finishing a round.
- When **both** agents are actively editing the same day/session: prefer a short-lived branch per agent (`agent/claude-...`, `agent/grok-...`), leave a clean commit for the user; **do not** both force-push or race-push to `main`. Coordinate: `git pull --rebase` before push; if a conflict lands on a hotspot file, **stop and ask the user** rather than inventing a merge.
- Never amend or rebase commits the other agent already pushed.
- Keep using the noreply author email override already documented under GitHub workflow.

### Quality gate

Before either agent declares done: run `npm test` and `npm run lint` (and `npm run typecheck` if types / `// @ts-check` modules were touched). Don't push with failing tests.

### Doc consistency

If privacy or host permissions change, update `CLAUDE.md` + `PRIVACY.md` + `store/STORE_LISTING.md` together (and `manifest.json`). Do not "fix" host counts from an outdated README paragraph without checking `extension/manifest.json`.

### Communication

Leave a brief wrap-up note: paths touched, tests/lint run, commit SHA if any — so the other agent can continue without re-discovery.

## Architecture

### Storage tiering (`lib/storage.js`)

Storage is split across two `chrome.storage` areas, keyed by a hardcoded set:

- **`storage.sync`** (~100 KB, syncs across devices) — **preferences only**: feature toggles, target currency, FX rates, VAT, region preset, onboarding flag.
- **`storage.local`** (~5 MB, per-device) — **user data**: tags, notes, price history, mods list cache, wishlist cache, library, purchase log.

`window.GOGPlusStorage` (also `self.GOGPlusStorage` for the service worker) exposes `get`/`set`/`remove`/`onChange` with promise APIs. **Always go through this wrapper** — it auto-routes keys to the correct area via the `SYNC_KEYS`/`LOCAL_KEYS` sets. If you add a new persisted key, add it to one of those sets in `lib/storage.js`, otherwise it falls through to `local` (safer-by-default but not what you usually want for a preference). Direct `chrome.storage.sync`/`chrome.storage.local` access exists in only three places — `lib/migrations.js`, the export/import/clear flows in `options.js`, and inside `lib/storage.js` itself — and is intentional in all three.

**Folder sync** (`options/folder-sync.js` + the pure merge logic in `lib/sync-core.js`) lets the user point the extension at a folder their own cloud client already syncs; it reads/writes one file, `gog-enhancer-sync.json`, and merges per record. The directory handle lives in IndexedDB (extension origin). Conflict resolution needs per-record timestamps, which the **service worker stamps from `storage.onChanged`** into the local `syncMeta` key (so no write site had to learn about syncing). Two invariants: (1) a change event that carries `syncMeta` *together with* data is "a sync being applied" and is **not** re-stamped — so the merge result must always be written in ONE `storage.local.set` containing both; (2) `syncFolderName`/`lastFolderSyncAt` are per-browser and are stripped on backup import. Deletions sync (tombstones, 90-day TTL). Never put synced datasets in `storage.sync` — it's ~100 KB.

Since v4 the folder-sync machinery is split so the **service worker can run it too**: `lib/folder-sync-core.js` holds the file/handle plumbing shared by the options page and `background.js` (the SW only ever uses `queryPermission`, never `requestPermission` — it can't show a prompt — and it can't ask for a passphrase, so `autoSync({interactive:false})` throws `SyncNeedsInteraction` and does nothing when the grant has lapsed or the file is encrypted; it then waits for the dashboard/options page). Auto-sync runs when the dashboard opens and on a 30-minute alarm (`AUTOSYNC_ALARM`); it can also write **dated backups** into the same folder with pruning. Conflicts (both sides changed a record since the last sync) resolve last-writer-wins but are *reported*: `syncBaseMeta` remembers the stamps at the last agreed point and `syncConflicts` lists what was overwritten, surfaced on the options page. **Per-browser keys never travel** — neither in the sync file nor in a backup export, and they are stripped on import: the `PER_BROWSER_KEYS` list in `options.js` — `syncFolderName`, `lastFolderSyncAt`, `syncBaseMeta`, `syncConflicts`, `autoSync`, `autoBackup`, `lastAutoBackupAt`, `webhookUrl`, `webhookEnabled`, `notifyQueue`, `tourSeen`. `lib/backup-crypto.js` is the AES-GCM/PBKDF2 passphrase wrapper used for encrypted backups; `lib/settings-profiles.js` names/switches whole sets of preferences; `lib/pack.js` is the tag-pack format (`mergePack` is the *only* place pack state is merged — an earlier inline version threw on every import).

Default values live in **`lib/storage.js`**'s sibling **`lib/defaults.js`** as `window.GOG_PLUS_DEFAULTS` (and `self.GOG_PLUS_DEFAULTS` for the SW). It's the single source of truth — adding a new persisted key means three coordinated edits: pick its area in `lib/storage.js` (`SYNC_KEYS`/`LOCAL_KEYS`), add its default value in `lib/defaults.js`, and register the script if a new HTML host needs it.

If a key's storage shape changes, bump `SETTINGS_VERSION` in `lib/defaults.js` and add a branch to `GOGPlusMigrations.run()` in `lib/migrations.js`. The v1→v2 migration already moves `tags`/`notes` from sync to local — model new migrations after it. This module is shared: `background.js` runs it on every `onInstalled`, and the Advanced Options import flow runs it after writing imported data into storage, so an old export gets the same shape-fixing pass a normal upgrade would.

### Content-script load order

`manifest.json` injects scripts on `https://www.gog.com/*` in this strict order:

```
lib/browser-compat.js   → `chrome`/`browser` namespace shim (Firefox groundwork — unverified in a real Firefox)
lib/defaults.js         → window.GOG_PLUS_DEFAULTS, GOG_PLUS_SETTINGS_VERSION
lib/storage.js          → window.GOGPlusStorage
lib/net.js              → window.GOGPlusNet (the ONE network layer — allow-list, no cookies/referrer, timeout, local netLog)
lib/failure-log.js      → window.GOGPlusFailureLog (features that failed, the popup's report)
lib/streak.js           → window.GOGPlusStreak (days you looked at gog.com)
lib/dom-safety.js       → window.GOGPlusDomSafety (escapeHtml)
lib/currency-format.js  → window.GOGPlusCurrencyFormat (symbolFor, formatPrice)
lib/genres.js           → window.GOGPlusGenres (GENRE_PATTERNS, matchGenrePattern, mapGenreLabel)
lib/game-status.js      → window.GOGPlusGameStatus (STATUSES, statusById) — shared with tags/ dashboard
lib/price-compare.js    → window.GOGPlusPriceCompare (fetchDeals against cheapshark.com — see Privacy boundary)
lib/gog-api.js         → window.GOGPlusGogApi (GOG's own catalog + product APIs: endless scrolling, pack contents)
lib/purchases.js        → window.GOGPlusPurchases (purchaseLog shape helpers)
lib/sysreq.js           → window.GOGPlusSysReq (RAM-requirement parsing + comparison for the game page)
lib/deals.js            → window.GOGPlusDeals (deal score, "is this a real discount", sale-season heuristic, pack-overlap warning)
lib/lang-names.js       → window.GOGPlusLangNames (language name normalisation for the "has my language" check)
lib/links.js            → window.GOGPlusLinks (outbound search/wiki links — plain <a href>, no fetch)
lib/wishlist-tools.js   → window.GOGPlusWishlistTools (sorting/grouping/totals over wishlist rows)
lib/catalog-tools.js    → window.GOGPlusCatalogTools (local sort/filter/compare over catalog tiles)
lib/library-tools.js    → window.GOGPlusLibraryTools (stats, "Wrapped"/collector numbers over the learned library)
lib/ics.js              → window.GOGPlusIcs (.ics files: an offer end, refund deadlines, release dates)
lib/share-card.js       → window.GOGPlusShareCard (Wrapped / collector / wishlist cards as PNG)
lib/pack.js             → window.GOGPlusPack (tag-pack export/import, mergePack)
lib/note-history.js     → window.GOGPlusNoteHistory (revision history for notes)
content/gog-dom.js      → window.GOGPlusGogDom (the site adapter — see "Site adapter" below; MUST precede utils.js)
content/gog-dom-facts.js → extends GOGPlusGogDom (catalog tiles, wishlist rows, game facts, ownership; MUST follow gog-dom.js)
content/translations.js → window.GOG_PLUS_TRANSLATIONS
content/currency-detection.js → window.GOGPlusCurrency
content/price-history.js → window.GOGPlusPriceHistory
content/tooltips.js     → (binds to data-gog-plus-tip)
content/toasts.js       → window.GOGPlusToasts
content/announce.js     → window.GOGPlusAnnounce (aria-live announcements)
content/native-theme.js → window.GOGPlusNativeTheme (samples the live page for the "native" theme)
content/state.js        → window.GOGPlusContentState ({ settings, pageCurrency, observers, failures })
content/utils.js        → window.GOGPlusContentUtils (debounce, log, slugFromHref, slugFromLocation, gameTitleFromPage)
content/features/currency.js     → window.GOGPlusCurrencyFeature
content/features/knowledge.js    → window.GOGPlusKnowledge (learns ownership + per-game facts from pages the user opens)
content/features/card-badges.js  → window.GOGPlusCardBadges
content/features/misc.js         → window.GOGPlusMiscFeatures
content/features/wishlist.js     → window.GOGPlusWishlistFeature (rewritten in v4 around `.product-row--wishlist`)
content/features/panel-chrome.js → window.GOGPlusPanelChrome (panel decoration, section order, compact/expanded modes)
content/features/game-extras.js  → window.GOGPlusGameExtras (language check, change-since-last-visit, links, calendar, share cards)
content/features/game-page.js    → window.GOGPlusGamePage (the insights panel; sections are an id'd array, each built inside its own try/catch)
content/features/catalog.js      → window.GOGPlusCatalog (tools bar, local sort/filter, comparison chart, tile controls)
content/features/catalog-endless.js → window.GOGPlusEndless (opt-in endless scrolling — see "Privacy boundary")
content/features/review-tools.js → window.GOGPlusReviewTools
content/features/site-signals.js → window.GOGPlusSiteSignals
content/features/command-palette.js → window.GOGPlusCommandPalette (Ctrl/Cmd+K quick actions)
content/features/keyboard-nav.js → window.GOGPlusKeyboardNav (opt-in J/K/T/W/N/A on game grids)
content/content.js      → orchestrator (depends on all of the above)
```

`content.js` used to be one ~1560-line file (through v2.7.0); it's now an orchestrator that's genuinely just orchestration, with each feature split into its own file (the v2.8.0 module split). Every feature module shares mutable state via `content/state.js` rather than closure variables — see that file's own doc comment for the discipline this requires (always dereference `state.settings.x`, never capture `const settings = state.settings`). A few feature modules reference each other via the fully-qualified `window.GOGPlusX.fn()` path instead of top-level destructuring specifically to break circular load-order dependencies (e.g. wishlist ↔ currency); check for that pattern before "simplifying" an import.

Adding a new content-script module means registering it in `manifest.json` **before** `content.js`, and after `content/state.js` if it needs shared state.

### Site adapter (`content/gog-dom.js` + `content/gog-dom-facts.js`)

**Everything that has to find something in gog.com's markup goes through `window.GOGPlusGogDom`** — game cards (`findCards`, `cardCoverHost`), prices (`findPriceNodes`), the game title (`resolveGameTitle`), where the insights panel mounts (`gamePageAnchor`), the wishlist/page roots, URL helpers (`slugFromHref`, `pageType`) and SPA route watching (`watchRoute`). Don't add a new `document.querySelector('.some-gog-class')` to a feature module; add or extend a lookup here. Each lookup tries independent strategies, most stable first — URL shape, page metadata (og:title, JSON-LD), semantic hooks (`h1`, `main`, `[role=main]`), class-name substrings, and finally the text *shape* of a price — and reports which one matched, which is what `diagnose()` (and the options page's "Check this page" button) surfaces. `gog-dom-facts.js` extends the same object with the v4 readers — `catalogTiles`, `readTile`, `wishlistRows`, `readWishlistRow`, `readGameFacts`, `readGamePrices`, `isGameOwned`, `promoEnd` — so the rule is unchanged: nothing outside the adapter touches gog.com's class names. What the live site looks like (inspected 2026-10-02 and re-checked 2026-10-03, so this is the ground truth the adapter is shaped around — re-check it if something breaks):

- **Two generations of markup coexist.** Home page and catalog are a new Angular app of custom elements (`<product-tile>`, `<product-price>`, `<price-value>`) with stable `selenium-id` test hooks; the game page and account pages (wishlist, library) are still AngularJS (`ng-app`, `h1.productcard-basics__title`, `div.layout.ng-scope`).
- **`<main>` is unreliable:** ~19 hero blocks on the home page, none on the catalog, and on the game page the only one is a hidden modal. Never `querySelector('main')`; use `spaRoot()` / `visibleMains()`.
- **Game-page prices have no currency symbol in the DOM** — `2.99`, with `::before { content: "$ " }` printing it (and `::after` hidden). The currency is named only by a body/html class (`_prices-in-usd`, `prices-in-usd`). Read prices through `displayText(el)` and the currency through `currencyHint()`, never `textContent` alone — otherwise conversion and price-history recording silently do nothing on game pages. The JSON-LD `offers.priceCurrency` is a *different* currency than the one displayed, so it is not usable for this.
- **Different page types can price in different currencies for the same visitor** (the new home/catalog showed USD where the legacy game page showed the local currency).
- Catalog tiles are vertical: `a.product-tile` > `div.product-tile__image-wrapper` (full tile width, ~half its height) — which is why `cardCoverHost` judges by area.
- The game page has its own `selenium-id` hooks: `ProductFinalPrice`, `ProductBasePrice`, `ProductGenres`; the requirements are a `.system-requirements` table of `.table__row`s (label / `__minimum` / `__recommended` cells), rendered twice with one copy hidden. GOG now also has its own HowLongToBeat section, so don't build one.
- **Logged-in state is only visible on the game page** (`user-logged-in` on `<body>`); catalog/home tiles never carry it, so a tile can prove a game is owned (`.product-label--owned` — the "IN LIBRARY" label) but can never prove it is *not*. That asymmetry is why `knowledge.js` only ever *adds* ownership from tiles and only a logged-in game page may *remove* it. The tile's visible title text also includes that "IN LIBRARY" label — read the title from `<product-title>`, not the tile's text.
- **Wishlist rows** are legacy AngularJS `.product-row--wishlist` rows; their state flags (owned/discounted/…) are *always present in the DOM and hidden*, so test visibility, not presence. The header menu also contains tiles that look like wishlist links (an old filter counted "All 7" from them) — only ever count real rows. A row exposes a release *year*, not a date — the exact date comes from the game page's JSON-LD (`releaseDate`, stored as `gameFacts[slug].rd`), so the release-date calendar only contains games whose page the user has opened.
- **Packs and bundles.** A bundle page lists its games in `[selenium-id="BundleCoverItem"]` elements (`readBundleItems` — no request needed). Otherwise `knowledge.js` asks GOG's v2 product API once per game page (`lib/gog-api.js` `fetchPackContents`, only the numeric product id from the JSON-LD `sku` is sent): `_links.includesGames` lists the children and each child's `_links.store.href` gives its slug. Children whose store slug equals the pack's own slug (hidden component entries that point back at it) and duplicates are dropped. Cached in `packInfo` (30-day TTL, at most 400); the overlap warning (`lib/deals.js` `packOverlap`) is computed from it. The old `RecommendedProductsPurchasedTogether` block was empty on every page inspected and is no longer used.

Rules that earned their place the hard way:

- **Never report the extension's own UI as the site's.** Our panel has elements with "price" in their class names; `findPriceNodes` excludes everything inside `OWN_UI_SEL`. Add new injected containers to that list.
- **Text-shape detection ignores our own `.gog-plus-conv-note` annotations**, otherwise a price stops looking like "just a price" the moment the converter touches it and price-history recording goes blind (a real bug, found by the e2e suite).
- **`cardCoverHost` judges "smaller than the card" by area** (≤ 90%), not by width *and* height. The old width ≤ 75% rule rejected full-width covers on vertical tiles, so badges silently disappeared.
- **The page observer watches `<body>`, filtered to the content root** (`content.js` `startObserving`). An observer bound to `<main>` can never notice `<main>` being replaced; header churn (a ticking countdown) is filtered out so it doesn't trigger a pass per second.
- **The DRM-free banner is pinned to the bottom edge** (`.gog-plus-banner`). In the normal flow at the top of `<body>` it was drawn over the first 40px of the redesigned site's `position: fixed` header and hid its navigation.
- **Never rewrite your own text if it hasn't changed.** The page observer watches `childList`, so a feature that re-renders its tray/bar/chips every pass wakes the observer, which runs a pass, which re-renders… (this happened three times in v4: catalog tray, catalog bar, wishlist genre chips). Use `setText`-style "only write if different" helpers or a signature check, and filter own mutations out of any observer you add.
- **The converter must leave the extension's own UI alone** (`isSiteElement` in `currency.js`) — it once appended "≈ ₪36" to our own "< $10" filter label.
- **Per-feature failure isolation.** `content.js` runs each feature from a `FEATURES` list inside its own try/catch and records the failure in `state.failures` (shown by "Check this page"); likewise each game-panel section is built in its own try/catch. One broken lookup after a site change must disable one feature, not the whole script.
- A content script lives in an isolated world and never sees the page's own `history.pushState`, so route changes are detected by `watchRoute` (Navigation API + popstate/hashchange + a 1 s poll), not by hooking history.

The **"native" theme** (`content/native-theme.js`) hard-codes no palette: it reads the page's computed background/text/font and the primary call-to-action colour and writes the `--gp-*` custom properties inline. `content.js` calls `GOGPlusNativeTheme.clear()` on every pass before applying any theme so one theme's inline vars never leak into the next.

### When gog.com changes its markup (playbook)

1. Reproduce with `E2E_LIVE=1 npm run e2e` — a failing live check names the lookup that stopped working; the options page's "Check this page" shows which adapter strategy matched.
2. Inspect the real page (the in-app browser works logged-out), update **only** the lookup in `gog-dom.js` / `gog-dom-facts.js`, and add the new shape to `e2e/fixtures-real.mjs` (structure only, no content) **and** `tests/helpers/fixtures.js`.
3. Re-run `E2E_ONLY=real npm run e2e`, then the full gates. Note the inspection date in the "Site adapter" section above.

### Content-script orchestration (`content/content.js`)

gog.com is an Angular SPA, so the DOM mutates constantly. Strategy:

1. On boot, load settings via `GOGPlusStorage.get(DEFAULTS)` into `state.settings`.
2. Run `processAll()` once, which dispatches to per-feature functions imported from `content/features/*.js` (`applyCurrencyConversion`, `applyCardBadges`, `hideExpiredSales`, `applyHebrewTranslations`, `ensureWishlistFilters`, `enhanceGamePage`, etc.).
3. Attach a `MutationObserver` to `main` / `[ng-view]` / `body` with a 250 ms debounced `processAll()`.
4. Subscribe to `GOGPlusStorage.onChange` — when a pref flips, clear `gog-plus-*-done` marker classes and re-run.

Storage changes take one of two paths: keys in `LIGHT_KEYS` (things like `ownedSlugs`, `gameFacts`, `notInterested` that features write themselves) just refresh `state.settings` and re-run the cheap passes; any other preference change does the full clean-and-rebuild. Features announce fresh data to each other with a `gog-plus:data` `CustomEvent` rather than calling each other.

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
   - `FLUSH_ALARM` — delivers notifications that quiet hours or the "daily batch" mode held back; `AUTOSYNC_ALARM` (30 min) — folder auto-sync (see Folder sync).
2. **Lifecycle**: on `onInstalled`, run `GOGPlusMigrations.run()` → `ensureDefaults()` → create alarms → open onboarding tab if `reason === "install"`.
3. **Message handler** for `force-fx-refresh`, `force-mods-refresh`, `force-wishlist-refresh`, `wishlist-report`, `open-tag-dashboard`, plus the v4 `sale-radar` (content script reports prices it saw → radar heuristic), `webhook-test` and `force-flush`.

   **Notifications go through one pipeline** (`emit` → `deliver` → `flushQueue` → optional `postWebhook`) governed by the pure `lib/notify-policy.js`: quiet hours (may wrap midnight), "daily" batching, price thresholds, per-tag alerts, the sale radar, and a digest that includes ending-soon offers. Status-change dates and note revisions are stamped from `storage.onChanged` in the SW too, so no write site needs to know.
4. **`syncMeta` timestamping** from `storage.onChanged` (see Storage tiering → Folder sync) and the **omnibox keyword** `gog` (`manifest.json` `omnibox`; searches the user's own library from local storage via `lib/library-search.js` — no permission, no network).

### The wishlist badge dance

gog.com is an Angular SPA, so `fetch('/account/wishlist')` from the SW returns the SSR shell, not the wishlist. The badge therefore uses a content-script→background round-trip:

1. When the user visits `/account/wishlist`, `content.js#reportWishlistCount()` polls the DOM at 750 ms intervals (up to ~6 s) until the card count is stable across two consecutive ticks, then counts `a[href*="/game/"]` containing `-NN%` and `chrome.runtime.sendMessage({type: "wishlist-report", discountedCount, total})`. The same data is used to populate live counters on the wishlist filter chips.
2. Background caches `{discountedCount, total}` as `wishlistCache` with a `wishlistCacheUpdatedAt` timestamp and a **24 h TTL**. The `gog-plus-wishlist` alarm only displays the cached count if fresh; otherwise it clears the badge and changes the action title to "visit your wishlist to refresh".

Don't try to make the SW scrape `/account/wishlist` directly — it won't work.

### Privacy boundary (manifest + permissions)

`host_permissions` is intentionally minimal: **`https://www.gog.com/*`, `https://api.frankfurter.app/*`, and `https://www.cheapshark.com/*`** — the last one powers the opt-out "Price comparison table" on the game page (`lib/price-compare.js`), a free keyless deal-aggregation API. No Google Fonts, no analytics, no remote code. Before adding a new host:

1. Add it to `host_permissions` in `manifest.json`.
2. Update `PRIVACY.md`'s network-requests section (§3) and its permissions table.
3. Update `STORE_LISTING.md`'s permission-justification list and, if it changes scope, its single-purpose statement.

Note for `fetch()` calls to any of these hosts: `User-Agent` is a forbidden header per the Fetch spec, so a call can never send a custom one — CheapShark rejects requests with a missing/generic UA, but a real browser's own UA (which is all `fetch()` ever sends) passes fine. Verified live against the API before `lib/price-compare.js` was written.

**All network traffic goes through `lib/net.js` (`GOGPlusNet.request`).** It refuses any URL that isn't https on its `HOSTS` allow-list, sends no cookies and no referrer, applies a timeout, and appends host + path (never the query) to the local `netLog` that the options page's privacy dashboard shows. The only `fetch()` outside it is the user's own webhook in `background.js` (it logs the host only — a webhook's path is a secret). `tests/privacy-audit.test.js` enforces this, and also fails when `manifest.json`'s permissions/hosts or `HOSTS` change without `PRIVACY.md`, `docs/privacy.html` and `store/STORE_LISTING.md` saying so, or when anything could load/run remote code (eval, `new Function`, remote `<script>`/CSS, inline handlers). Adding a destination = add it to `HOSTS`, to the audit test's expectations, and to all three documents.

Two of the allow-listed hosts have **no `host_permissions` entry**: `catalog.gog.com` (endless scrolling — `lib/gog-api.js`, `content/features/catalog-endless.js`, off by default) and `api.gog.com` (pack contents, on by default via `packContents`). They are GOG's own APIs, called from the content script under the page's CORS rules (the site itself calls them from `www.gog.com`, which the servers allow), so Chrome shows no extra install warning. Verified against the live site 2026-10-03: the catalog API answers a page-origin `fetch` with 200; the v2 product API's `_links.includesGames` lists a pack's children by id and each child's `_links.store.href` gives its slug. If GOG ever tightens CORS those two features degrade quietly (null results, nothing appended); don't "fix" that by adding broad host permissions without updating the privacy documents first.

**Optional webhook (v4).** The manifest also declares `optional_host_permissions: ["https://*/*"]`. It is *never* granted at install: only when the user types their **own** `https://` webhook URL in Advanced Options does the options page ask Chrome (one runtime prompt, for that origin only), and `background.js` `postWebhook` sends nothing but the notification text (title/body) to it. No URL is baked in; the secret URL is a per-browser key that is excluded from every export and sync. Everything that mentions permissions — `PRIVACY.md` (+ `docs/privacy.html`), `store/STORE_LISTING.md`, the README permissions table and this file — must keep describing it as optional/user-initiated. If you add any other optional host, the same checklist applies.

Folder sync adds **no host and no permission**: the extension only ever touches a file in a folder the user explicitly picked (File System Access API, re-granted from a click on the options page). The omnibox keyword needs no permission either. IndexedDB (extension origin) holds two things: note-image attachments and that folder handle. Everything v4 learns about the user's library (`ownedSlugs`, `gameFacts`, `notInterested`, note history, …) lives in `storage.local` and is derived only from pages the user opened — it makes no request of its own.

The runtime permission `notifications` is opt-in: nothing fires unless the user enables "Desktop notifications" in Advanced Options. Background uses `chrome.notifications.create` only — no network traffic. Triggers live in `background/background.js` (`checkRefundWindowExpirations`, `maybeNotifyWishlistJump`) and dedupe via the `notifLog` key in `storage.local`.

### Interface translations (`lib/i18n.js` + `lib/i18n-pages*.js`)

Two mechanisms, both applied by `GOGPlusI18n.apply(lang)`. `lib/i18n.js` is the old keyed one (`data-i18n` attributes, 7 languages) and still drives most of the popup. **`lib/i18n-pages.js` translates by the English text itself** and covers the tag dashboard, the options page, the popup's un-keyed strings and the first-run wizard: rows `[english, he, ru, pl, de, fr, es]` live in `lib/i18n-pages-{common,dashboard,dashboard-messages,options,options-messages,popup,onboarding}.js` and register themselves with `GOGPlusPageI18n.add()`. It rewrites text nodes and `title`/`placeholder`/`aria-label`/`alt`, translates a sentence with highlighted words as one piece (`<1>…</1>` marks the highlighted element, so a translation may reorder them; `<kbd>`/`<code>` stay in place), picks Russian/Polish plural forms (`{1#игра|игры|игр}`), remembers the English per node (so switching language, or back to English, starts from the original), and keeps watching the page with a `MutationObserver` so what the dashboard draws later is translated too. Placeholders in a row's English: `{n}` a number, `{}` any text (translated itself); in translations `{1}`, `{2}`… by position.

Rules: **a new user-visible string needs a row in all six languages** — `tests/i18n-pages-data.test.js` fails when a string in the four pages' static markup has none, and checks every row (six non-empty translations, placeholders and `<k>` tags consistent with the English, plural-form counts, the same English never translated two ways). Text a page builds in JS is covered only if it has a row — run `node e2e/collect-strings.mjs` to see what is missing. Dialogs (`confirm`/`alert`/`prompt`) bypass the DOM, so wrap them in `window.GOGPlusPageI18n.tx(...)`. Text that is the user's own (tag names, notes, game titles) and the language picker carry `data-no-i18n` / `translate="no"` and are never translated — add the attribute to any new element that shows user content. The scripts load in each page's HTML after `lib/i18n.js`; they are not content scripts. The six non-English translations were **not reviewed by native speakers**.

### Local progress: streak, challenges, achievements, failure log

`lib/streak.js` (days you looked at gog.com, local calendar days; `{last,current,best}`), `lib/challenges.js` (three monthly challenges picked deterministically from a pool of six by an FNV hash of the month; `challengesDone[month]`) and `lib/achievements.js` (36 achievements in bronze/silver/gold, some `hidden`, plus a Completionist; `tierCounts`) are pure and local; `tags/features/achievements.js` evaluates them and shows toasts. `lib/failure-log.js` records features that failed on a gog.com page (`failureLog`, at most 40 entries, de-duplicated, written at most every 10 minutes) and builds the report the popup banner offers — no web addresses, no personal data; "Report on GitHub" only opens an issue page with the text filled in. `netLog`, `failureLog`, `failureSeenAt`, `streak` and `challengesDone` are in `content.js`'s QUIET keys: changing them must not rebuild the page.

### Accessibility of the dashboard

`tags/a11y.js` (`GOGPlusTagsA11y`: `focusables`, `trapFocus`, `menu`, `announce`) and `content/announce.js` (`GOGPlusAnnounce`, an `aria-live="polite"` region) give the dashboard a skip link, landmarks, focusable tags (`Enter` filters, `Alt`+`↑`/`↓` reorders and announces the new position), menus with arrow keys / `Home` / `End` / `Esc` that return focus to their button, and dialogs (colour picker, filter builder) that trap focus. Keep new popovers on the same helpers; `tests/dashboard-a11y.test.js` covers them.

### Files the extension builds on the device

`lib/ics.js` (`buildRefundCalendar`, `buildReleaseCalendar` — release dates come from the game pages the user opened, `gameFacts.rd`), `lib/digest-html.js` (the weekly digest as one self-contained HTML file; the popup's *Save as page*), `lib/share-card.js` (Wrapped, collector and wishlist cards drawn on a canvas and saved as PNG), `lib/markdown-export.js`. None of them makes a request.

### Firefox build

`node scripts/build-firefox.mjs` (also `npm run build:firefox`) copies the same files `build.ps1` ships into `dist/firefox/` and zips them; only `manifest.json` differs (`background.scripts` + `type: module` instead of a service worker, `browser_specific_settings.gecko` with an add-on id, `strict_min_version` 140 and `data_collection_permissions: {required: ["none"]}`). `npm run lint:firefox` runs `web-ext lint` on it (0 errors; 22 `UNSAFE_VAR_ASSIGNMENT` warnings for the `innerHTML` templates, whose dynamic values all go through `escapeHtml`, and one note that `data_collection_permissions` needs Firefox for Android 142). The zip is attached to each GitHub Release. **It has never been run in a real Firefox**, and folder sync (File System Access API) is unavailable there — keep calling it experimental until someone has.

### Security guards (don't regress these)

- **No `innerHTML` for user input.** Tags and notes go through `createElement` + `textContent` (see `renderTags` in `content.js`). The v2.0.1 XSS fix is here — reverting to innerHTML for tag names re-introduces the bug.
- **No inline event handlers** anywhere (Manifest V3 CSP forbids `onclick=`). Bind in JS via `addEventListener`.
- `web_accessible_resources` is restricted to `icons/*.png` for `gog.com` only. `tags.html` and `onboarding.html` are deliberately **not** web-accessible — they would be a fingerprint vector. Open them via `chrome.tabs.create({url: chrome.runtime.getURL(...)})` from the popup/background instead.

### Naming convention quirk

User-facing strings (manifest name, popup header, banner pill, action title) say **"GOG Enhancer"** since v2.0.3. Internal class names, storage keys, and global identifiers still use **`gog-plus`** / **`GOGPlus`** from the v1 codebase. **Do not rename internal identifiers** — existing users' synced settings and local data are keyed on them, and a rename without a migration would silently lose their data.
