---
description: Prepare a release on a branch — never merge, tag, push or submit
---
Prepare (not publish) the release `$ARGUMENTS` (for example `4.6.0`).

- Work on a branch `release/<version>`. A release is an UPDATE to a live Chrome Web Store listing: a storage-shape change needs a migration (`SETTINGS_VERSION`, `lib/migrations.js`) and a new host permission re-prompts every user.
- `node scripts/release.mjs` does the mechanical parts (version bump, changelog stubs, banner, gates, local tag). Fill every `TODO` stub: `extension/lib/changelog.js` (popup, with translations in `lib/i18n-pages-popup.js`) and `docs/changelog.html`.
- If privacy, permissions or hosts changed: update `PRIVACY.md`, `docs/privacy.html`, `store/STORE_LISTING.md`, `CLAUDE.md` and `tests/privacy-audit.test.js` together.
- Generate the banner: `cd store/release-images && uv run --with pillow python generate_release_banner.py --version X.Y.Z --tagline "…"` and commit it before tagging.
- Run `/verify full`, and `node e2e/upgrade.mjs v<previous>` for the previous release.
- Stop there. Merging, tagging, pushing, the GitHub Release and the store submission each need the maintainer's explicit go-ahead in THIS conversation; an earlier go-ahead does not carry over.
