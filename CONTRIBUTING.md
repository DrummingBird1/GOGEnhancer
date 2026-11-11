# Contributing to GOG Enhancer

Thanks for helping. This is a small, privacy-first browser extension (Manifest V3, vanilla JavaScript, no bundler), and it is already live on the Chrome Web Store, so changes reach real people's data. A few habits keep that safe.

**[ARCHITECTURE.md](./ARCHITECTURE.md)** describes how the extension is put together — architecture, load order, storage, privacy and security rules. Read the part about the area you are changing; this file is the short version of the working rules.

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
- User-facing changes get an entry in both `extension/lib/changelog.js` and `docs/changelog.html`; `README.md` and its translations (`README.he.md`, `.ru`, `.pl`, `.de`, `.fr`, `.es`, `.zh-CN`, `.pt-BR`) change together — `tests/readme-languages.test.js` keeps their structure identical.

## Please do not

- Put personal data, local paths, tokens or private notes in a commit, issue or PR.
- Describe an unfixed security problem in a public issue — use the contact in `SECURITY.md` once it is merged, or the repository owner's profile until then.
- Merge a release, push a tag or publish to a store. Those are the maintainer's.

## Releases, banners and store material

The maintainer cuts releases (version bump, both changelogs, the banner, the gates, the tag — `node scripts/release.mjs`, see its header). Two things worth knowing:

- **Release banners come in two styles.** A release whose version ends in `.0` gets the special *major* banner (1280×640: big logo, gradient version number, tagline and four highlight chips — `--highlights "a|b|c|d"`); other releases get the plain classic one. Generate it with `store/release-images/generate_release_banner.py` and commit `store/release-images/vX.Y.Z.png` before tagging.
- **Brand and store assets are generated, not hand-edited:** `store/brand/logo.py` (the mark, extension icons, favicon), `store/brand/promo.py` (store promo tiles, English and Hebrew), `e2e/store-screenshots.mjs` (ten screenshots per language, demo data), and one description file per language in `store/listings/`.
