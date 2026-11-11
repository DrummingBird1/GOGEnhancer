---
description: Run the project's gates and report what failed (add "e2e" or "full" for the browser checks)
---
Run the checks for this repository and report the result plainly.

1. `$ARGUMENTS` empty → `npm run verify` (unit tests, lint, typecheck, coverage thresholds).
2. `$ARGUMENTS` = `e2e` → `npm run verify:e2e` (adds the end-to-end suite, both zips and the zip check).
3. `$ARGUMENTS` = `full` → `npm run verify:full` (adds upgrade, backup, locale, page-sweep, accessibility, resilience, service-worker, big-backup and soak checks). These open a real Chromium and take several minutes; run them in the background.

If a step fails, show the last lines of its output, find the cause in the code (do not loosen a test or a threshold to make it pass), fix it, and run the failed step again. Say which steps you did NOT run. Never push, tag or publish.
