// Shared plumbing for the end-to-end tools (extension.e2e.mjs, visual.mjs,
// structure.mjs): find a Chromium that still honours --load-extension, load the
// real extension into it, and serve gog.com from fixtures (or let the real site
// through, in "live" mode).
//
// Nothing real leaves the machine in fixture mode: gog.com is answered from
// fixtures, and the APIs the extension calls get canned answers.

import { chromium } from "playwright-core";
import { existsSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { storeLegacy, storeVariant, gameLegacy, gameVariant } from "./fixtures.mjs";
import { homeReal, catalogReal, gameReal, catalogV4, catalogBig, wishlistV4, gameV4, V4_TILES } from "./fixtures-real.mjs";

/** Branded Google Chrome 137+ ignores --load-extension, so look for the Chromium Playwright installed. */
export function findChromium() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  const candidates = [];
  if (process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== "0") candidates.push(process.env.PLAYWRIGHT_BROWSERS_PATH);
  candidates.push(
    join(process.env.LOCALAPPDATA || "", "ms-playwright"), // Windows
    join(homedir(), ".cache", "ms-playwright"), // Linux
    join(homedir(), "Library", "Caches", "ms-playwright") // macOS
  );
  const exes = [
    ["chrome-win64", "chrome.exe"],
    ["chrome-win", "chrome.exe"],
    ["chrome-linux64", "chrome"],
    ["chrome-linux", "chrome"],
    ["chrome-mac-arm64", "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"],
    ["chrome-mac-x64", "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"],
    ["chrome-mac", "Chromium.app/Contents/MacOS/Chromium"],
  ];
  for (const base of candidates) {
    if (!existsSync(base)) continue;
    const dirs = readdirSync(base)
      .filter((d) => /^chromium-\d+$/.test(d))
      .sort((a, b) => parseInt(b.split("-")[1]) - parseInt(a.split("-")[1]));
    for (const d of dirs) {
      for (const [sub, exe] of exes) {
        const p = join(base, d, sub, exe);
        if (existsSync(p)) return p;
      }
    }
  }
  return undefined; // fall back to Playwright's own default
}

/** The fixture pages, by path on www.gog.com. */
export const PAGES = {
  "/en/games": storeLegacy,
  "/en/games/variant": storeVariant,
  "/en/game/cool_game": gameLegacy,
  "/en/game/cool_game_variant": gameVariant,
  "/en/": homeReal,
  "/en": homeReal,
  "/en/games/real": catalogReal,
  "/en/game/gris": gameReal,
  "/en/games/v4": catalogV4,
  "/en/account/wishlist": wishlistV4,
  "/en/game/alpha_game": gameV4,
  "/en/games/big48": () => catalogBig(48),
  "/en/games/big400": () => catalogBig(400),
  "/en/game/pack_game": () => gameV4({ productId: "9990001", title: "Pack Game" }),
  "/en/game/bundle_game": () => gameV4({ title: "Bundle Game", bundle: [["child_one", "Child One"], ["child_two", "Child Two"]] }),
};

/**
 * @param {{ live?: boolean, extPath: string, viewport?: { width: number, height: number }, cookies?: any[] }} opts
 */
export async function startHarness({ live = false, extPath, viewport = { width: 1100, height: 800 }, cookies }) {
  const userDataDir = mkdtempSync(join(tmpdir(), "gog-enhancer-e2e-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: findChromium(),
    headless: false,
    args: [`--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`, "--headless=new", "--no-first-run"],
    viewport,
  });

  // Cookies the user saved with `node e2e/save-login.mjs` (logged-in checks).
  if (cookies?.length) await context.addCookies(cookies);

  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (!/^https?:$/.test(url.protocol)) return route.continue();
    if (live && /(^|\.)(gog\.com|gog-statics\.com|gogcdn\.net)$/.test(url.hostname)) {
      return route.continue();
    }
    if (url.hostname === "www.gog.com") {
      const page = PAGES[url.pathname];
      return page
        ? route.fulfill({ status: 200, contentType: "text/html", body: page() })
        : route.fulfill({ status: 404, body: "not a fixture" });
    }
    if (url.hostname === "api.frankfurter.app") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ rates: { ILS: 4 } }) });
    }
    if (url.hostname === "www.cheapshark.com") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    // GOG's own APIs, answered the way the real ones are: JSON with a CORS
    // header that allows the gog.com page's origin (a content script's fetch
    // carries that origin, so without the header it would be blocked).
    const cors = { "access-control-allow-origin": "https://www.gog.com" };
    if (url.hostname === "images.gog-statics.com") {
      // The covers our endless-scrolling cards point at: a 1x1 transparent GIF.
      return route.fulfill({ status: 200, contentType: "image/gif", body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64") });
    }
    if (url.hostname === "catalog.gog.com") {
      const page = Number(url.searchParams.get("page") || 1);
      const product = (slug, title) => ({
        id: `id_${slug}`, slug, title, productType: "game", coverVertical: "https://images.gog-statics.com/x.jpg", releaseDate: "2020.01.01",
        genres: [{ name: "RPG" }], reviewsRating: 4.5, reviewsCount: 5,
        price: { finalMoney: { amount: "9.99", currency: "USD" }, baseMoney: { amount: "19.99", currency: "USD" }, discount: "-50%" },
      });
      const products = page === 1 ? V4_TILES.map((t) => product(t[0], t[1])) : page === 2 ? [product("more_one", "More One"), product("more_two", "More Two")] : [];
      return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ products, pages: 2, productCount: 6 }) });
    }
    if (url.hostname === "api.gog.com") {
      const id = /\/games\/(\d+)/.exec(url.pathname)?.[1];
      const child = (slug, title) => ({ _embedded: { product: { title } }, _links: { store: { href: `https://www.gog.com/en/game/${slug}` } } });
      const answers = {
        9990001: { _links: { includesGames: [{ href: "https://api.gog.com/v2/games/9990002" }, { href: "https://api.gog.com/v2/games/9990003" }] } },
        9990002: child("child_one", "Child One"),
        9990003: child("child_two", "Child Two"),
      };
      return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(answers[id] || { _links: {} }) });
    }
    return route.abort();
  });

  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent("serviceworker");
  const extId = new URL(sw.url()).host;

  // A fresh install opens the onboarding tab; it isn't what we're testing.
  await new Promise((r) => setTimeout(r, 800));
  for (const p of context.pages()) if (p.url().includes("onboarding")) await p.close();

  const setSettings = (areaItems) =>
    sw.evaluate(async ({ sync, local }) => {
      if (sync) await new Promise((r) => chrome.storage.sync.set(sync, r));
      if (local) await new Promise((r) => chrome.storage.local.set(local, r));
    }, areaItems);

  const storageGet = (area, key) => sw.evaluate(({ area, key }) => new Promise((r) => chrome.storage[area].get(key, r)), { area, key });

  const cleanup = async () => {
    await context.close();
    rmSync(userDataDir, { recursive: true, force: true });
  };

  return { context, sw, extId, setSettings, storageGet, cleanup };
}
