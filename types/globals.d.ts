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

interface GogPlusGameStatusEntry {
  id: string;
  label: string;
  icon: string;
  color: string;
}

interface GogPlusGameStatusApi {
  STATUSES: GogPlusGameStatusEntry[];
  statusById(id: string | null | undefined): GogPlusGameStatusEntry | null;
}

// ---------------------------------------------------------------------
// content/ and tags/ — same "catch typos across module boundaries, not
// full type safety" philosophy as above. Every content/features/*.js and
// tags/features/*.js module shares state and helpers purely through
// window.GOGPlusX (see content/state.js's own doc comment on why), so
// without these declarations tsc can't see those properties exist at
// all. Loose `any`-shaped interfaces are enough to catch a typo'd
// property name or wrong argument count — the two failure modes this
// repo has actually hit — without modeling every render function's
// full signature.

interface GogPlusContentStateApi {
  settings: GogPlusSettings;
  pageCurrency: { code: string; symbol: string };
  observers: any[];
}

interface GogPlusContentUtilsApi {
  debounce(fn: (...args: any[]) => void, ms: number): (...args: any[]) => void;
  log(...args: any[]): void;
  slugFromHref(href: string | null | undefined): string | null;
  slugFromLocation(): string | null;
  gameTitleFromPage(): string | null;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface GogPlusLooseApi {
  [key: string]: any;
}

declare global {
  interface Window {
    GOGPlusContentState?: GogPlusContentStateApi;
    GOGPlusContentUtils?: GogPlusContentUtilsApi;
    GOGPlusContentInternals?: GogPlusLooseApi;
    GOGPlusCurrency?: GogPlusLooseApi;
    GOGPlusPriceHistory?: GogPlusLooseApi;
    GOGPlusToasts?: GogPlusLooseApi;
    GOGPlusTooltips?: GogPlusLooseApi;
    GOG_PLUS_TRANSLATIONS?: GogPlusLooseApi;
    GOG_PLUS_DEBUG?: boolean;
    GOGPlusCurrencyFeature?: GogPlusLooseApi;
    GOGPlusCardBadges?: GogPlusLooseApi;
    GOGPlusMiscFeatures?: GogPlusLooseApi;
    GOGPlusWishlistFeature?: GogPlusLooseApi;
    GOGPlusGamePage?: GogPlusLooseApi;
    GOGPlusCommandPalette?: GogPlusLooseApi;

    GOGPlusTagsState?: GogPlusLooseApi;
    GOGPlusTagsConstants?: GogPlusLooseApi;
    GOGPlusTagsInternals?: GogPlusLooseApi;
    GOGPlusTagsManagement?: GogPlusLooseApi;
    GOGPlusTagsGamesList?: GogPlusLooseApi;
    GOGPlusTagsStats?: GogPlusLooseApi;
    GOGPlusTagsExportImport?: GogPlusLooseApi;
  }
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
    GOGPlusGameStatus?: GogPlusGameStatusApi;
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
