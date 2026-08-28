import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    setupFiles: ["./tests/setup.js"],
    include: ["tests/**/*.test.js"],
    coverage: {
      provider: "v8",
      include: ["extension/**/*.js"],
      // The reporter measures the whole extension (not just what's tested)
      // so it stays an honest picture of overall coverage, not a number
      // inflated by only looking at files that already have tests.
      reporter: ["text", "html", "lcov"],
      // extension/lib/ is where every module has real unit tests (see
      // tests/lib-modules.test.js, migrations.test.js, price-history.test.js
      // etc.) — enforced here, plus every top-level page script
      // (background.js, popup.js, options.js, onboarding.js) and the two
      // feature modules with the deepest business logic (command-palette.js,
      // wishlist.js), added once their own test suites landed. Everything
      // else in content/features/ and tags/features/ is only partially
      // covered so far (card-badges.js's hot-zone suite, plus whatever
      // content-internals.test.js/tags-internals.test.js's pure-function
      // subset exercises as a side effect) and doesn't have a threshold yet;
      // raise this gradually as more of them gets covered rather than
      // setting an unrealistic global bar that's doomed to fail today.
      thresholds: {
        "extension/lib/**/*.js": {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80,
        },
        "extension/background/background.js": {
          statements: 85,
          branches: 75,
          functions: 90,
          lines: 90,
        },
        "extension/popup/popup.js": {
          statements: 80,
          branches: 70,
          functions: 80,
          lines: 85,
        },
        "extension/options/options.js": {
          statements: 80,
          branches: 55,
          functions: 75,
          lines: 85,
        },
        "extension/onboarding/onboarding.js": {
          statements: 95,
          branches: 70,
          functions: 95,
          lines: 95,
        },
        "extension/content/features/command-palette.js": {
          statements: 85,
          branches: 75,
          functions: 75,
          lines: 90,
        },
        "extension/content/features/wishlist.js": {
          statements: 85,
          branches: 80,
          functions: 75,
          lines: 95,
        },
      },
    },
  },
});
