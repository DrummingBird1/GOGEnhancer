// Ambient type declarations for the globals each extension/lib/*.js module
// attaches to `window` (content scripts, popup/options/tags pages) and
// `self` (service worker). Used by `npm run typecheck` (tsc --noEmit) to
// typecheck lib/ against real call sites.
//
// Lives at the repo root (not inside extension/) so build.ps1's wholesale
// `lib` folder copy never sweeps this dev-only file into the shipped zip —
// same reasoning as tests/, tsconfig.json, and package.json staying out.
//
// Kept intentionally loose (mostly `any`/`Record<string, any>`) rather than
// exhaustively modeling every shape — the goal is catching typos and
// misused APIs across module boundaries, not full type safety.

// Ideally this would import the real `Settings` typedef from defaults.js
// (see its own JSDoc — it's the actual single source of truth), but that
// typedef lives inside an IIFE closure and defaults.js deliberately isn't a
// real ES module (it's loaded via a plain <script> tag / manifest.json
// content_scripts entry, same as every other lib file) — TS can't resolve a
// cross-file type import through that boundary without restructuring the
// load model, which isn't worth doing just for this. Kept loose here.
interface GogPlusSettings {
  [key: string]: any;
}

interface GogPlusStorageApi {
  get(
    keysOrDefaults?: string | string[] | Record<string, any>
  ): Promise<Partial<GogPlusSettings> & Record<string, any>>;
  set(items: Record<string, any>): Promise<void>;
  remove(keys: string | string[]): Promise<any>;
  onChange(
    callback: (change: { key: string; area: string; oldValue: any; newValue: any }) => void
  ): () => void;
}

interface GogPlusStorageKeysApi {
  SYNC_KEYS: Set<string>;
  LOCAL_KEYS: Set<string>;
}

interface GogPlusMigrationsApi {
  run(): Promise<void>;
}

interface GogPlusDomSafetyApi {
  escapeHtml(s: unknown): string;
}

interface GogPlusCurrencyFormatApi {
  symbolFor(cur: string): string;
  formatPrice(value: number, cur: string): string;
}

interface GogPlusGenrePattern {
  genre: string;
  re: RegExp;
}

interface GogPlusGenresApi {
  GENRE_PATTERNS: GogPlusGenrePattern[];
  GENRE_LABEL_TO_BUCKET: Record<string, string>;
  matchGenrePattern(slug: string | null | undefined): string | null;
  mapGenreLabel(labelText: string | null | undefined): string | null;
}

interface GogPlusChangelogApi {
  CHANGELOG: Record<string, string[]>;
  compareVersions(a: string, b: string): -1 | 0 | 1;
  versionsSince(
    lastSeen: string,
    current: string,
    changelog?: Record<string, string[]>
  ): string[];
}

interface GogPlusI18nApi {
  apply(lang: string): void;
  t(key: string, lang?: string): string;
}

declare global {
  interface Window {
    GOG_PLUS_DEFAULTS?: GogPlusSettings;
    GOG_PLUS_SETTINGS_VERSION?: number;
    GOGPlusStorage?: GogPlusStorageApi;
    GOGPlusStorageKeys?: GogPlusStorageKeysApi;
    GOGPlusMigrations?: GogPlusMigrationsApi;
    GOGPlusDomSafety?: GogPlusDomSafetyApi;
    GOGPlusCurrencyFormat?: GogPlusCurrencyFormatApi;
    GOGPlusGenres?: GogPlusGenresApi;
    GOGPlusChangelog?: GogPlusChangelogApi;
    GOGPlusI18n?: GogPlusI18nApi;
  }
  // eslint-disable-next-line no-var
  var GOG_PLUS_DEFAULTS: GogPlusSettings | undefined;
  // eslint-disable-next-line no-var
  var GOG_PLUS_SETTINGS_VERSION: number | undefined;
  // eslint-disable-next-line no-var
  var GOGPlusStorage: GogPlusStorageApi | undefined;
  // eslint-disable-next-line no-var
  var GOGPlusStorageKeys: GogPlusStorageKeysApi | undefined;
  // eslint-disable-next-line no-var
  var GOGPlusMigrations: GogPlusMigrationsApi | undefined;
}

export {};
