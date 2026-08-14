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
      // etc.) — enforced here. content.js and tags.js are only partially
      // covered so far (their hot-zone/pure-function subset — see
      // tests/apply-card-badges.test.js, content-internals.test.js,
      // tags-internals.test.js) and don't have a threshold yet; raise this
      // gradually as more of them gets covered rather than setting an
      // unrealistic global bar that's doomed to fail today.
      thresholds: {
        "extension/lib/**/*.js": {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80,
        },
      },
    },
  },
});
