import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      ".vitest-cache/**",
      "dist/**",
      "coverage/**",
    ],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        // Extension-specific globals attached to window / self by IIFE modules.
        GOGPlusStorage: "readonly",
        GOGPlusStorageKeys: "readonly",
        GOGPlusMigrations: "readonly",
        GOGPlusDomSafety: "readonly",
        GOGPlusCurrencyFormat: "readonly",
        GOGPlusGenres: "readonly",
        GOG_PLUS_DEFAULTS: "readonly",
        GOG_PLUS_SETTINGS_VERSION: "readonly",
        GOG_PLUS_TRANSLATIONS: "readonly",
        GOG_PLUS_DEBUG: "readonly",
        GOGPlusCurrency: "readonly",
        GOGPlusPriceHistory: "readonly",
        GOGPlusTooltips: "readonly",
        GOGPlusToasts: "readonly",
        // content/state.js, content/utils.js, content/features/*.js — the
        // v2.8.0 content.js module split (see CLAUDE.md).
        GOGPlusContentState: "readonly",
        GOGPlusContentUtils: "readonly",
        GOGPlusCurrencyFeature: "readonly",
        GOGPlusCardBadges: "readonly",
        GOGPlusMiscFeatures: "readonly",
        GOGPlusWishlistFeature: "readonly",
        GOGPlusGamePage: "readonly",
        // tags/state.js, tags/features/*.js — the v2.8.0 tags.js module split.
        GOGPlusTagsState: "readonly",
        GOGPlusTagsConstants: "readonly",
        GOGPlusTagsStats: "readonly",
        GOGPlusTagsManagement: "readonly",
        GOGPlusTagsGamesList: "readonly",
        GOGPlusTagsExportImport: "readonly",
        GOGPlusTagsInternals: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-redeclare": "error",
      "no-implicit-globals": "off",
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
  {
    // Background service worker is an ES module per manifest.
    files: ["extension/background/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.serviceworker,
      },
    },
  },
  {
    // Vitest specs run under Node + happy-dom with vitest globals.
    files: ["tests/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
  {
    // Config files (Vitest, ESLint) run under Node as ES modules.
    files: ["vitest.config.js", "eslint.config.js"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
];
