---
description: gog.com's markup changed and something stopped working — the repair playbook
---
Follow "When gog.com changes its markup (playbook)" in CLAUDE.md:

1. Reproduce: `E2E_LIVE=1 npm run e2e` (a failing live check names the lookup that broke) and `npm run e2e:structure` (which hook disappeared). The options page's "Check this page" shows which adapter strategy matched.
2. Inspect the real page with the browser tools (logged out is enough). Change ONLY the lookup in `extension/content/gog-dom.js` / `gog-dom-facts.js` — never add a raw `querySelector` for a gog.com class name to a feature module.
3. Add the new shape (structure only, no content) to `e2e/fixtures-real.mjs` and `tests/helpers/fixtures.js`.
4. Re-run `E2E_ONLY=real npm run e2e`, then `/verify e2e`. Re-record the structure baseline with `node e2e/structure.mjs --update` and note the inspection date in the "Site adapter" section of CLAUDE.md.
