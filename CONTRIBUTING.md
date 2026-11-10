# Contributing to GOG Enhancer

Thanks for helping. This is a small, privacy-first browser extension (Manifest V3, vanilla JavaScript, no bundler), and it is already live on the Chrome Web Store, so changes reach real people's data. A few habits keep that safe.

**[CLAUDE.md](./CLAUDE.md) is the source of truth** for architecture, load order, storage, privacy and security rules, and for how to work in this repository — whether you are a person or an AI coding agent (Claude Code, Codex, Grok…). Read its "Current status and handoff" section first. This file is the short version.

## Set up

```bash
npm install
npm run verify        # unit tests, lint, typecheck, coverage thresholds — about a minute
```

Load the extension for manual testing: `chrome://extensions` → Developer mode → **Load unpacked** → choose the **`extension/`** folder (not the repository root).

Use **npm** here, not pnpm: `package-lock.json` is what CI installs from.

## Before you open a pull request

- `npm run verify` is green. For changes to what runs on gog.com, also `npm run verify:e2e` (a real Chromium against recorded page shapes; local only, CI has no browser). `npm run verify:full` adds the deeper checks (upgrade from earlier releases, backups, accessibility, resilience…).
- A bug fix comes with a test that fails without it. Reproduce first.
- **Network, permissions, hosts:** adding any means updating `lib/net.js`, `PRIVACY.md`, `docs/privacy.html`, `store/STORE_LISTING.md` and `tests/privacy-audit.test.js` together. The default answer to a new permission is no.
- **Stored data:** never rename an internal `gog-plus` / `GOGPlus` identifier, and never change a storage shape without a migration and a test with the old shape.
- **Visible text:** every new string in the extension's own pages needs a row in all six translation files (`tests/i18n-pages-data.test.js` tells you what is missing).
- **gog.com markup:** nothing outside `content/gog-dom*.js` looks for gog.com's class names.
- User-facing changes get an entry in both `extension/lib/changelog.js` and `docs/changelog.html`; `README.md` and `README.he.md` change together.

## Please do not

- Put personal data, local paths, tokens or private notes in a commit, issue or PR.
- Describe an unfixed security problem in a public issue — use the contact in `SECURITY.md` once it is merged, or the repository owner's profile until then.
- Merge a release, push a tag or publish to a store. Those are the maintainer's.

## Working with an AI coding agent

It is welcome; the same rules apply to it. It should read `CLAUDE.md`, state which files it will touch before editing the shared hotspots listed there, run `npm run verify`, and say what it did not verify. Per-machine agent files (`AGENTS.md`, `HANDOFF.local.md`, `.claude/settings.local.json`) stay untracked.
