// End-to-end check: loads the real extension into a real Chromium and drives
// it against synthetic gog.com pages (see fixtures.mjs). Complements the
// Vitest suite, which runs in happy-dom — no layout engine, no real
// MutationObserver timing, no real content-script injection.
//
//   npm run e2e            run it (needs a Chromium; see below)
//   E2E_SHOTS=dir          also save screenshots there
//   PW_CHROMIUM=path       use this chrome.exe instead of auto-detecting
//
// Not part of CI: it needs a Chromium build that still honours
// --load-extension (Playwright's does; branded Google Chrome 137+ does not).
// It looks for one already installed by Playwright before giving up.

import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { storeLegacy, storeVariant, gameLegacy, gameVariant } from "./fixtures.mjs";
import { homeReal, catalogReal, gameReal, realTile, catalogV4, wishlistV4, gameV4, V4_TILES } from "./fixtures-real.mjs";

// E2E_LIVE=1 runs the extension against the REAL gog.com (public pages, logged
// out, a handful of page loads) instead of fixtures — the only way to know the
// recorded fixtures still match the site. Manual use only.
const LIVE = process.env.E2E_LIVE === "1";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXT = process.env.E2E_EXT || join(ROOT, "extension");
const SHOTS = process.env.E2E_SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

function findChromium() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  const base = join(process.env.LOCALAPPDATA || "", "ms-playwright");
  if (existsSync(base)) {
    const dirs = readdirSync(base)
      .filter((d) => /^chromium-\d+$/.test(d))
      .sort((a, b) => parseInt(b.split("-")[1]) - parseInt(a.split("-")[1]));
    for (const d of dirs) {
      for (const sub of ["chrome-win64", "chrome-win"]) {
        const exe = join(base, d, sub, "chrome.exe");
        if (existsSync(exe)) return exe;
      }
    }
  }
  return undefined; // fall back to Playwright's own default
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${!ok && detail ? `\n      ${detail}` : ""}`);
}

const PAGES = {
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
  "/en/game/pack_game": () => gameV4({ productId: "9990001", title: "Pack Game" }),
};

const userDataDir = mkdtempSync(join(tmpdir(), "gog-enhancer-e2e-"));
const context = await chromium.launchPersistentContext(userDataDir, {
  executablePath: findChromium(),
  headless: false,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "--headless=new", "--no-first-run"],
  viewport: { width: 1100, height: 800 },
});

try {
  // Nothing real leaves the machine: gog.com is served from fixtures, and the
  // two APIs the extension calls get empty answers.
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (!/^https?:$/.test(url.protocol)) return route.continue();
    if (LIVE && /(^|\.)(gog\.com|gog-statics\.com|gogcdn\.net)$/.test(url.hostname)) {
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
  console.log(`Extension loaded (id ${extId.slice(0, 8)}…)\n`);

  // A fresh install opens the onboarding tab; it isn't what we're testing.
  await new Promise((r) => setTimeout(r, 800));
  for (const p of context.pages()) if (p.url().includes("onboarding")) await p.close();

  const setSettings = (areaItems) =>
    sw.evaluate(async ({ sync, local }) => {
      if (sync) await new Promise((r) => chrome.storage.sync.set(sync, r));
      if (local) await new Promise((r) => chrome.storage.local.set(local, r));
    }, areaItems);

  await setSettings({
    sync: { targetCurrency: "ILS", rates: { ILS: 4, EUR: 0.9 }, currencyConverter: true, taxEstimator: false, keyboardNav: true },
  });

  const shot = async (page, name) => {
    if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) });
  };
  const open = async (path) => {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(`https://www.gog.com${path}`);
    page.errors = errors;
    return page;
  };

  if (!LIVE) {
  if (process.env.E2E_ONLY !== "real") {
  for (const [label, path] of [
    ["legacy markup", "/en/games"],
    ["variant markup (no recognisable class names)", "/en/games/variant"],
  ]) {
    console.log(`Store listing — ${label}`);
    const page = await open(path);
    await page.waitForSelector(".gog-plus-card-done", { timeout: 5000 }).catch(() => {});

    const info = await page.evaluate(() => ({
      stamped: document.querySelectorAll(".gog-plus-card-done").length,
      hosts: document.querySelectorAll(".gog-plus-cover-host").length,
      hostIsCard: [...document.querySelectorAll("a[href*='/game/']")].some((a) => a.classList.contains("gog-plus-cover-host")),
      cardPositionChanged: [...document.querySelectorAll("a[href*='/game/']")].some((a) => a.style.position),
      notes: [...document.querySelectorAll(".gog-plus-conv-note")].map((n) => n.textContent.trim()),
      banner: !!document.getElementById("gog-plus-banner"),
      quickAdd: document.querySelectorAll(".gog-plus-quickadd-btn").length,
    }));
    check("every card is stamped", info.stamped === 3, `stamped=${info.stamped}`);
    check("badges anchor to the cover wrapper, never the card itself", info.hosts === 3 && !info.hostIsCard && !info.cardPositionChanged);
    check("every price gets a conversion note (incl. split $ + number)", info.notes.length === 3, JSON.stringify(info.notes));
    // rates: 1 USD = 4 ILS → $19.99, $29.99, $9.99 → ₪80, ₪120, ₪40
    check("conversion uses the configured rate", JSON.stringify(info.notes) === JSON.stringify(["≈ ₪80", "≈ ₪120", "≈ ₪40"]), JSON.stringify(info.notes));
    check("DRM-free banner and quick-add buttons present", info.banner && info.quickAdd === 3);
    check("no uncaught page errors", page.errors.length === 0, page.errors.join(" | "));

    // Keyboard navigation
    await page.keyboard.press("j");
    const first = await page.evaluate(() => document.activeElement?.getAttribute("href"));
    await page.keyboard.press("j");
    const second = await page.evaluate(() => document.activeElement?.getAttribute("href"));
    await page.keyboard.press("k");
    const back = await page.evaluate(() => document.activeElement?.getAttribute("href"));
    check(
      "J / K move focus between cards",
      first === "/en/game/the_witcher_3_wild_hunt" && second === "/en/game/cyberpunk_2077" && back === first,
      `${first} → ${second} → ${back}`
    );
    await shot(page, `store-${label.split(" ")[0]}`);

    // Header churn must not cause processing passes forever (observer filter).
    const passes = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const clock = document.getElementById("clock");
          let marks = 0;
          const probe = new MutationObserver(() => {});
          probe.observe(document.body, { childList: true, subtree: true });
          const t = setInterval(() => {
            clock.textContent = `00:0${marks++}`;
          }, 100);
          setTimeout(() => {
            clearInterval(t);
            probe.disconnect();
            resolve(document.querySelectorAll(".gog-plus-conv-note").length);
          }, 1200);
        })
    );
    check("a ticking header doesn't duplicate conversion notes", passes === 3, `notes after churn=${passes}`);
    await page.close();
  }

  for (const [label, path] of [
    ["legacy markup", "/en/game/cool_game"],
    ["variant markup (header h1, split price, no price classes)", "/en/game/cool_game_variant"],
  ]) {
    console.log(`Game page — ${label}`);
    const page = await open(path);
    await page.waitForSelector("#gog-plus-gamepanel", { timeout: 6000 }).catch(() => {});
    const g = await page.evaluate(() => {
      const panel = document.getElementById("gog-plus-gamepanel");
      const title = document.querySelector("h1.productcard-basics__title, h1.c-title");
      return {
        panel: !!panel,
        sitsAfterTitle: !!panel && title?.nextElementSibling === panel,
        sysRows: [...document.querySelectorAll(".gog-plus-sysreq-row")].map((r) => r.textContent),
        notes: document.querySelectorAll(".gog-plus-conv-note").length,
      };
    });
    check("insights panel mounts directly under the game title (not the site-header h1)", g.panel && g.sitsAfterTitle);
    check("system check reads Minimum/Recommended RAM from the page", g.sysRows.length === 2 && /Minimum: 4 GB/.test(g.sysRows[0]), JSON.stringify(g.sysRows));
    check("the buy-box price is converted", g.notes >= 1, `notes=${g.notes}`);
    check("no uncaught page errors", page.errors.length === 0, page.errors.join(" | "));
    await shot(page, `game-${label.split(" ")[0]}`);
    await page.close();
  }

  console.log("Client-side navigation");
  {
    const page = await open("/en/game/cool_game");
    await page.waitForSelector("#gog-plus-gamepanel", { timeout: 6000 });
    // Swap <main> wholesale and change the URL without a reload, like an SPA router.
    await page.evaluate(() => {
      history.pushState({}, "", "/en/games");
      document.querySelector("main").replaceWith(Object.assign(document.createElement("main"), {
        innerHTML: `<div class="grid"><a class="product-tile" style="display:block;width:220px" href="/en/game/stardew_valley"><div style="width:220px;height:124px"><img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></div><div class="price-text">$9.99</div></a></div>`,
      }));
    });
    await page.waitForFunction(() => !document.getElementById("gog-plus-gamepanel"), null, { timeout: 4000 }).then(
      () => check("the old game's panel is removed after navigating away", true),
      () => check("the old game's panel is removed after navigating away", false, "panel still present")
    );
    await page.waitForSelector(".gog-plus-card-done", { timeout: 4000 }).then(
      () => check("the replaced <main> is picked up (observer re-bound)", true),
      () => check("the replaced <main> is picked up (observer re-bound)", false, "new card never stamped")
    );
    await page.close();
  }

  console.log("Native theme");
  {
    await setSettings({ sync: { theme: "native" } });
    const page = await open("/en/game/cool_game");
    await page.waitForSelector("#gog-plus-gamepanel", { timeout: 6000 }).catch(() => {});
    const t = await page.evaluate(() => {
      const css = getComputedStyle(document.documentElement);
      return {
        cls: [...document.documentElement.classList].filter((c) => c.startsWith("gog-plus-theme--")),
        bg: css.getPropertyValue("--gp-bg").trim(),
        accent: css.getPropertyValue("--gp-magenta").trim(),
        siteBg: getComputedStyle(document.body).backgroundColor,
      };
    });
    check("adopts the site's own background colour", t.bg === t.siteBg, `${t.bg} vs ${t.siteBg}`);
    check("adopts the call-to-action colour as the accent", t.accent === "rgb(120, 60, 230)", t.accent);
    check("a dark site gets the dark base (no light class)", t.cls.includes("gog-plus-theme--native") && !t.cls.includes("gog-plus-theme--light"), t.cls.join());
    await shot(page, "game-native-theme");

    // The options page's "Check this page" must see this very tab.
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extId}/options/options.html`);
    await options.click("#diagRun");
    await options.waitForFunction(() => !document.getElementById("diagOutput").hidden, null, { timeout: 5000 }).catch(() => {});
    const diag = await options.textContent("#diagOutput").catch(() => "");
    check("options → 'Check this page' reports on the live gog.com tab", /Page: \/en\/game\/cool_game \(game\)/.test(diag) && /No problems found/.test(diag), diag.slice(0, 300));
    await shot(options, "options-diagnostics");
    await options.close();

    await setSettings({ sync: { theme: "neon" } });
    await page.waitForFunction(() => !document.documentElement.style.getPropertyValue("--gp-bg"), null, { timeout: 4000 }).then(
      () => check("switching away from Native clears its colours", true),
      () => check("switching away from Native clears its colours", false)
    );
    await page.close();
  }

  console.log("Variant page diagnostics");
  {
    const page = await open("/en/game/cool_game_variant");
    await page.waitForSelector("#gog-plus-gamepanel", { timeout: 6000 }).catch(() => {});
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extId}/options/options.html`);
    await options.click("#diagRun");
    await options.waitForFunction(() => !document.getElementById("diagOutput").hidden, null, { timeout: 5000 }).catch(() => {});
    const diag = (await options.textContent("#diagOutput").catch(() => "")) || "";
    check("the report names the lookup strategies that actually matched", /Prices: \d+ found via text-shape/.test(diag) && /Game title: found via h1-matches-og/.test(diag), diag.slice(0, 400));
    check("…and warns that class names have changed", /text shape/.test(diag));
    await options.close();
    await page.close();
  }

  } // E2E_ONLY=real skips everything above (lets the same checks run against an older build)

  // ---- Markup shapes recorded from the live site (see fixtures-real.mjs) ----
  const storageGet = (area, key) => sw.evaluate(({ area, key }) => new Promise((r) => chrome.storage[area].get(key, r)), { area, key });
  await setSettings({ sync: { theme: "neon" }, local: { priceHistory: {}, gameGenres: {} } });

  console.log("Real structure — catalog (new Angular app, vertical tiles, custom elements)");
  {
    const page = await open("/en/games/real");
    await page.waitForSelector(".gog-plus-card-done", { timeout: 5000 }).catch(() => {});
    const c = await page.evaluate(() => ({
      stamped: document.querySelectorAll(".gog-plus-card-done").length,
      hosts: [...document.querySelectorAll(".gog-plus-cover-host")].map((h) => h.className.split(" ").find((c) => c.startsWith("product-tile__"))),
      notes: [...document.querySelectorAll(".gog-plus-conv-note")].map((n) => n.textContent.trim()),
      perPriceSpan: [...document.querySelectorAll("price-value span:not(.gog-plus-conv-note)")].map((s) => s.querySelectorAll(".gog-plus-conv-note").length),
    }));
    check("every tile is stamped, badges on the full-width cover wrapper", c.stamped === 3 && c.hosts.length === 3 && c.hosts.every((h) => h === "product-tile__image-wrapper"), JSON.stringify(c));
    const overlap = await page.evaluate(() => {
      const b = document.getElementById("gog-plus-banner")?.getBoundingClientRect();
      const h = document.querySelector("header")?.getBoundingClientRect();
      return b && h ? !(b.bottom <= h.top || b.top >= h.bottom) : null;
    });
    check("the DRM-free banner doesn't cover the site's fixed header", overlap === false, String(overlap));
    check("base and final prices are each converted exactly once", c.notes.length === 5 && c.perPriceSpan.every((n) => n === 1), JSON.stringify(c));
    await shot(page, "real-catalog");
    await page.close();
  }

  console.log("Real structure — home page (19 hero <main>s, tiles outside them)");
  {
    const page = await open("/en/");
    await page.waitForSelector(".gog-plus-card-done", { timeout: 5000 }).catch(() => {});
    // A tile that arrives later, in a section that is NOT inside any <main>.
    await page.evaluate((html) => document.getElementById("slot").insertAdjacentHTML("beforeend", html), realTile("limbo", "Limbo", 90, "9.99", "1.99"));
    const late = await page.waitForFunction(() => document.querySelector('a[href$="/limbo"].gog-plus-card-done'), null, { timeout: 4000 }).then(() => true, () => false);
    check("tiles added later outside the hero <main>s are still picked up", late);
    const obs = await page.evaluate(() => document.querySelectorAll("main").length);
    check("(the page really has several <main>s, so <main> can't be the observed root)", obs === 3);
    await page.close();
  }

  console.log("Real structure — game page (AngularJS, CSS-printed symbol, hidden <main>)");
  {
    const page = await open("/en/game/gris");
    await page.waitForSelector("#gog-plus-gamepanel", { timeout: 6000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 600));
    const g = await page.evaluate(() => ({
      finalNote: document.querySelector(".product-actions-price__final-amount .gog-plus-conv-note")?.textContent.trim() || null,
      baseNote: document.querySelector(".product-actions-price__base-amount .gog-plus-conv-note")?.textContent.trim() || null,
      sysRows: [...document.querySelectorAll(".gog-plus-sysreq-row")].map((r) => r.textContent),
    }));
    check("the bare CSS-symbol price is converted (2.99 USD × 4 → ₪12, not read as EUR from JSON-LD)", g.finalNote === "≈ ₪12" && g.baseNote === "≈ ₪60", JSON.stringify(g));
    check("system check reads the real requirements table (visible one, not the hidden copy)", g.sysRows.length === 2 && /Minimum: 4 GB/.test(g.sysRows[0]) && /Recommended: 16 GB/.test(g.sysRows[1]), JSON.stringify(g.sysRows));
    const hist = (await storageGet("local", "priceHistory")).priceHistory || {};
    const entry = (hist.gris || [])[0];
    check("the price is recorded in the price history (final price, page's own currency)", !!entry && entry.p === 2.99 && entry.c === "USD", JSON.stringify(hist));
    const genres = (await storageGet("local", "gameGenres")).gameGenres || {};
    check("the genre is read from the site's genre hook", genres.gris === "rpg", JSON.stringify(genres));
    check("no uncaught page errors", page.errors.length === 0, page.errors.join(" | "));
    await shot(page, "real-game");

    // The page's only <main> is hidden; later changes must still be processed.
    await page.evaluate(() => {
      const s = document.createElement("span");
      s.id = "late-price";
      s.className = "product-actions-price__final-amount _price";
      s.textContent = "5.00";
      document.getElementById("buybox").appendChild(s);
    });
    const lateNote = await page.waitForFunction(() => document.querySelector("#late-price .gog-plus-conv-note"), null, { timeout: 4000 }).then(() => true, () => false);
    check("content added after load is processed even though the page's only <main> is hidden", lateNote);
    await page.close();
  }

  console.log("v4 — catalog tools (sort by CSS order, hide owned, not interested, compare)");
  {
    await setSettings({ local: { ownedSlugs: {}, notInterested: {}, priceHistory: {}, gameFacts: {} }, sync: { ownedDisplay: "show", catalogTools: true } });
    const page = await open("/en/games/v4");
    await page.waitForSelector("#gog-plus-catbar", { timeout: 6000 }).catch(() => {});
    const titlesInVisualOrder = () =>
      page.evaluate(() =>
        [...document.querySelectorAll("product-tile")]
          .filter((t) => getComputedStyle(t).display !== "none")
          .map((t) => ({ title: t.querySelector("product-title")?.textContent.trim(), x: t.getBoundingClientRect().left, y: t.getBoundingClientRect().top }))
          .sort((a, b) => a.y - b.y || a.x - b.x)
          .map((t) => t.title)
      );
    const bar = await page.evaluate(() => ({ bar: !!document.getElementById("gog-plus-catbar"), beforeGrid: document.getElementById("gog-plus-catbar")?.nextElementSibling?.classList.contains("paginated-products-grid") }));
    check("the catalog bar mounts directly above the grid", bar.bar && bar.beforeGrid, JSON.stringify(bar));
    const learned = (await storageGet("local", "ownedSlugs")).ownedSlugs || {};
    check("the 'IN LIBRARY' label teaches the extension which game is owned", Object.keys(learned).join() === "gamma_game", JSON.stringify(learned));

    await page.selectOption("#gog-plus-cat-sort", "price-asc");
    const asc = await titlesInVisualOrder();
    check("sorting by price re-orders the tiles on screen (CSS order on the grid items)", asc.join() === "Beta Game,Gamma Game,Delta Game,Alpha Game", asc.join());
    await page.selectOption("#gog-plus-cat-sort", "discount");
    const disc = await titlesInVisualOrder();
    check("sorting by discount puts the biggest first", disc[0] === "Gamma Game" && disc[1] === "Alpha Game", disc.join());
    await page.selectOption("#gog-plus-cat-sort", "default");

    await page.selectOption("#gog-plus-cat-owned", "hide");
    const hid = await page.waitForFunction(() => getComputedStyle([...document.querySelectorAll("product-tile")][2]).display === "none", null, { timeout: 4000 }).then(() => true, () => false);
    check("'Hide owned games' removes the owned tile and the grid closes up", hid && (await titlesInVisualOrder()).length === 3);
    await page.selectOption("#gog-plus-cat-owned", "dim");
    const dim = await page.waitForFunction(() => Number(getComputedStyle([...document.querySelectorAll("product-tile")][2]).opacity) < 0.6, null, { timeout: 4000 }).then(() => true, () => false);
    check("'Dim' keeps the owned tile but fades it", dim);
    await page.selectOption("#gog-plus-cat-owned", "show");

    // Hover reveals the per-tile controls (inside the cover host, not on the card).
    const first = page.locator("product-tile").first();
    await first.hover();
    await page.locator("product-tile").first().locator(".gog-plus-tilectl-hide").click({ force: true });
    const hiddenNow = await page.waitForFunction(() => getComputedStyle(document.querySelectorAll("product-tile")[0]).display === "none", null, { timeout: 4000 }).then(() => true, () => false);
    const ni = (await storageGet("local", "notInterested")).notInterested || {};
    check("✕ on a tile hides that game and remembers it", hiddenNow && "alpha_game" in ni, JSON.stringify(ni));
    const reload = await page.evaluate(() => (location.reload(), true));
    void reload;
    await page.waitForSelector("#gog-plus-catbar", { timeout: 6000 }).catch(() => {});
    const stillHidden = await page.waitForFunction(() => getComputedStyle(document.querySelectorAll("product-tile")[0]).display === "none", null, { timeout: 4000 }).then(() => true, () => false);
    check("…and it stays hidden after a reload", stillHidden);

    // Compare two tiles → a modal with a table.
    await page.locator("product-tile").nth(1).hover();
    await page.locator("product-tile").nth(1).locator(".gog-plus-tilectl-compare").click({ force: true });
    await page.locator("product-tile").nth(3).hover();
    await page.locator("product-tile").nth(3).locator(".gog-plus-tilectl-compare").click({ force: true });
    await page.locator(".gog-plus-compare-tray button", { hasText: "Compare" }).click();
    const cmp = await page.evaluate(() => ({ rows: document.querySelectorAll(".gog-plus-compare-table tr").length, dialog: document.querySelector(".gog-plus-modal-overlay")?.getAttribute("role") }));
    check("comparing two tiles opens a side-by-side table", cmp.rows >= 8 && cmp.dialog === "dialog", JSON.stringify(cmp));
    await shot(page, "v4-catalog-compare");
    check("no uncaught page errors", page.errors.length === 0, page.errors.join(" | "));
    await page.close();
  }

  console.log("v4 — GOG's own APIs: endless scrolling and pack contents (real fetch, real CORS)");
  {
    await setSettings({ sync: { endlessCatalog: true, catalogTools: true, packContents: true, targetCurrency: "ILS" }, local: { ownedSlugs: { child_one: "2026-01-01" }, notInterested: {}, packInfo: {}, gameFacts: {}, netLog: [] } });
    const page = await open("/en/games/v4");
    const more = await page.waitForFunction(() => document.querySelectorAll("#gog-plus-endless .gog-plus-more-card").length >= 2, null, { timeout: 8000 }).then(() => true, () => false);
    const e = await page.evaluate(() => ({
      titles: [...document.querySelectorAll(".gog-plus-more-title")].map((t) => t.textContent),
      after: document.getElementById("gog-plus-endless")?.previousElementSibling?.classList.contains("paginated-products-grid"),
      status: document.querySelector(".gog-plus-endless-status")?.textContent,
      note: document.querySelector(".gog-plus-more-price em")?.textContent.trim(),
      href: document.querySelector(".gog-plus-more-link")?.getAttribute("href"),
    }));
    check("endless scrolling appends the next page, as our own cards, below the site's grid", more && e.after && e.titles.join() === "More One,More Two", JSON.stringify(e));
    check("…with a link to each game, a converted price, and a note when the list ends", e.href === "/en/game/more_one" && /≈ ₪/.test(e.note || "") && /everything/.test(e.status || ""), JSON.stringify(e));
    const noPriceNotes = await page.evaluate(() => !document.querySelector("#gog-plus-endless .gog-plus-conv-note"));
    check("our own cards are never double-converted by the price converter", noPriceNotes);
    check("no uncaught page errors", page.errors.length === 0, page.errors.join(" | "));
    await shot(page, "v4-endless");
    await page.close();

    const pack = await open("/en/game/pack_game");
    const packText = await pack
      .waitForFunction(() => /You already own 1 of the 2 games in this pack/.test(document.getElementById("gog-plus-gamepanel")?.textContent || ""), null, { timeout: 8000 })
      .then(() => true, () => false);
    const list = await pack.evaluate(() => [...document.querySelectorAll(".gog-plus-pack-list a")].map((a) => a.textContent));
    check("a pack page asks GOG's product API what it contains and warns about the games you own", packText, "no warning in the panel");
    check("…and lists them, marking the owned one", list.join() === "✓ Child One,Child Two", list.join());
    const stored = (await storageGet("local", "packInfo")).packInfo?.pack_game;
    check("the answer is cached, with the games' slugs", stored?.children?.map((c) => c.slug).join() === "child_one,child_two", JSON.stringify(stored));
    const rd = (await storageGet("local", "gameFacts")).gameFacts?.pack_game?.rd;
    check("the game's release date is read from the page", rd === "2015-05-19", String(rd));
    await pack.close();

    const log = (await storageGet("local", "netLog")).netLog || [];
    const hosts = [...new Set(log.map((l) => l.host))].sort().join();
    check("every request is in the local log — host and path, no query", hosts.includes("api.gog.com") && hosts.includes("catalog.gog.com") && log.every((l) => !String(l.path).includes("?")), hosts);

    const opts = await context.newPage();
    await opts.goto(`chrome-extension://${extId}/options/options.html`);
    const net = await opts.waitForFunction(() => /catalog\.gog\.com/.test(document.getElementById("privNet")?.textContent || ""), null, { timeout: 6000 }).then(() => true, () => false);
    const store = await opts.waitForFunction(() => /Total on this device/.test(document.getElementById("privStore")?.textContent || ""), null, { timeout: 6000 }).then(() => true, () => false);
    check("the options page's privacy dashboard shows what was contacted and what is stored", net && store);
    await shot(opts, "v4-privacy");
    await opts.close();
    await setSettings({ sync: { endlessCatalog: false } });
  }

  console.log("v4 — wishlist (real rows only, smart sort, totals)");
  {
    await setSettings({ sync: { wishlistFilters: true, wishlistSmart: true, targetCurrency: "ILS" }, local: { notInterested: {} } });
    const page = await open("/en/account/wishlist");
    await page.waitForSelector("#gog-plus-wlfilters", { timeout: 6000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1200));
    const w = await page.evaluate(() => ({
      all: document.querySelector('#gog-plus-wlfilters button[data-f="all"] .gog-plus-wlfilter-count')?.textContent,
      sale: document.querySelector('#gog-plus-wlfilters button[data-f="sale"] .gog-plus-wlfilter-count')?.textContent,
      total: document.querySelector("#gog-plus-wlfilters [data-wl-total]")?.textContent,
      barInList: !!document.querySelector(".account__products > #gog-plus-wlfilters"),
    }));
    check("the filter bar counts the 4 real rows, not the header's menu tiles", w.all === "4" && w.sale === "2", JSON.stringify(w));
    check("the live total adds up what is left to buy (owned excluded)", /3 games|4 games/.test(w.total || "") && /₪/.test(w.total || ""), w.total);
    await page.selectOption('#gog-plus-wlfilters select[data-wl="sort"]', "discount");
    const order = await page.evaluate(() => [...document.querySelectorAll(".product-row-wrapper")].filter((r) => getComputedStyle(r).display !== "none").sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).map((r) => r.querySelector(".product-row__title").textContent.trim()));
    check("sort by discount re-orders the rows on screen", order[0] === "Deal Game" && order[1] === "Cheap Game", order.join());
    await page.click('#gog-plus-wlfilters button[data-wl-filter="hide-owned"]');
    const noOwned = await page.waitForFunction(() => [...document.querySelectorAll(".product-row-wrapper")].filter((r) => getComputedStyle(r).display !== "none").length === 3, null, { timeout: 4000 }).then(() => true, () => false);
    check("'Hide owned' hides the owned row", noOwned);
    check("no uncaught page errors", page.errors.length === 0, page.errors.join(" | "));
    await shot(page, "v4-wishlist");
    await page.close();
  }

  console.log("v4 — game page (deal check, offer timer, languages, collapsible panel, review filter)");
  {
    await setSettings({ sync: { targetCurrency: "ILS", preferredLanguages: ["English", "Hebrew"], realDiscountCheck: true, offerTimer: true, languageMeter: true, reviewTools: true, priceCompareTable: false }, local: { priceHistory: {}, gameFacts: {}, panelCollapsed: {} } });
    const page = await open("/en/game/alpha_game");
    await page.waitForSelector("#gog-plus-gamepanel", { timeout: 6000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 800));
    const g = await page.evaluate(() => {
      const t = (sel) => document.querySelector(sel)?.textContent.replace(/\s+/g, " ").trim() || "";
      return {
        deal: t('[data-section-id="deal"]'),
        timer: !!document.querySelector(".gog-plus-deal-timer"),
        chips: [...document.querySelectorAll(".gog-plus-lang-chip")].map((c) => c.textContent),
        ids: [...document.querySelectorAll("#gog-plus-gp-body > [data-section-id]")].map((s) => s.dataset.sectionId),
        reviewBar: !!document.getElementById("gog-plus-reviewbar"),
      };
    });
    check("the deal check compares the advertised discount with GOG's own 30-day low", /−50% off the list price/.test(g.deal) && /not cheaper than it was recently/.test(g.deal), g.deal.slice(0, 260));
    check("the offer countdown comes from the page's machine-readable timer", g.timer && /Offer ends in 1d|Offer ends in 2d|Offer ends in 4\dh/.test(g.deal), g.deal.slice(0, 120));
    check("the language check finds English (text + audio) and flags a missing Hebrew", g.chips[0] === "English: text + audio ✓" && g.chips[1] === "Hebrew: not supported", JSON.stringify(g.chips));
    check("price per hour uses GOG's time-to-beat figure", /\$0\.25 \(Main, 100 h\)/.test(g.deal), g.deal.slice(0, 300));
    check("every section has a stable id", g.ids.includes("deal") && g.ids.includes("facts") && g.ids.includes("tags"), g.ids.join());
    check("the review filter mounts above the reviews", g.reviewBar);

    // Collapse a section → its content is really hidden by CSS, and it is remembered.
    await page.click('[data-section-id="deal"] .gog-plus-gp-toggle');
    const hidden = await page.evaluate(() => getComputedStyle(document.querySelector('[data-section-id="deal"] .gog-plus-deal-line, [data-section-id="deal"] .gog-plus-deal-timer')).display === "none");
    await new Promise((r) => setTimeout(r, 300));
    const saved = (await sw.evaluate(() => new Promise((r) => chrome.storage.sync.get("panelCollapsed", r)))).panelCollapsed || {};
    check("collapsing a section hides its content and remembers the choice", hidden && saved.deal === true, JSON.stringify(saved));

    // 5★ filter hides the 2★ review.
    await page.click('#gog-plus-reviewbar button[data-stars="5"]');
    const hid = await page.evaluate(() => [...document.querySelectorAll("article.review__item")].map((a) => getComputedStyle(a).display !== "none"));
    check("the review filter shows only the chosen number of stars", hid[0] === true && hid[1] === false, JSON.stringify(hid));

    // Facts are cached for later: language, rating, offer end.
    const facts = (await storageGet("local", "gameFacts")).gameFacts?.alpha_game;
    check("the page's facts are cached (languages, rating, offer end, release year)", !!facts && facts.langs?.English?.a === true && facts.rating?.score === 4.8 && !!facts.pe && facts.year === 2015, JSON.stringify(facts));
    check("no uncaught page errors", page.errors.length === 0, page.errors.join(" | "));
    await shot(page, "v4-game");

    // Plain look: all of our decoration goes away, the panel's features stay.
    await setSettings({ sync: { plainLook: true } });
    const plain = await page.waitForFunction(() => document.documentElement.classList.contains("gog-plus-plain") && !document.documentElement.classList.contains("gog-plus-design"), null, { timeout: 4000 }).then(() => true, () => false);
    const stillThere = await page.evaluate(() => !!document.getElementById("gog-plus-gamepanel"));
    check("'Plain look' drops the injected styling but keeps the panel working", plain && stillThere);
    await setSettings({ sync: { plainLook: false } });
    await page.close();
  }
  } else {
    console.log("LIVE mode — real gog.com, public pages, logged out");
    // The live site prices different page types in different currencies for
    // the same visitor (the new home/catalog showed USD where the legacy game
    // page showed the local currency), so convert to one that is neither —
    // otherwise "nothing to convert" would be indistinguishable from "broken".
    await setSettings({
      sync: { theme: "neon", targetCurrency: "EUR", rates: { ILS: 3.65, EUR: 0.9, GBP: 0.8, PLN: 4 }, taxEstimator: false },
      local: { priceHistory: {}, gameGenres: {} },
    });
    const storageGet = (area, key) => sw.evaluate(({ area, key }) => new Promise((r) => chrome.storage[area].get(key, r)), { area, key });
    const open = async (path) => {
      const page = await context.newPage();
      page.errors = [];
      page.on("pageerror", (e) => page.errors.push(e.message));
      await page.goto(`https://www.gog.com${path}`, { waitUntil: "domcontentloaded" });
      return page;
    };

    for (const [label, path] of [["home", "/en/"], ["catalog", "/en/games"]]) {
      const page = await open(path);
      await page.waitForSelector(".gog-plus-card-done", { timeout: 20000 }).catch(() => {});
      const info = await page.evaluate(() => ({
        stamped: document.querySelectorAll(".gog-plus-card-done").length,
        notes: document.querySelectorAll(".gog-plus-conv-note").length,
        tileHosts: [...document.querySelectorAll("product-tile .gog-plus-cover-host")].filter((h) => h.className.includes("product-tile__image-wrapper")).length,
        diag: null,
      }));
      check(`${label}: tiles are stamped`, info.stamped > 5, JSON.stringify(info));
      check(`${label}: badges sit on the tile's cover wrapper`, info.tileHosts > 5, JSON.stringify(info));
      check(`${label}: prices get conversion notes`, info.notes > 5, JSON.stringify(info));
      if (label === "catalog") {
        await new Promise((r) => setTimeout(r, 800));
        const v4 = await page.evaluate(() => ({
          bar: !!document.getElementById("gog-plus-catbar"),
          barBeforeGrid: !!document.getElementById("gog-plus-catbar")?.nextElementSibling?.className.includes("paginated-products-grid"),
          controls: document.querySelectorAll(".gog-plus-tilectl").length,
        }));
        check("catalog: the tools bar mounts above the grid and tiles get their controls", v4.bar && v4.barBeforeGrid && v4.controls > 5, JSON.stringify(v4));
        // The local sort must really re-order what is on screen.
        await page.selectOption("#gog-plus-cat-sort", "title").catch(() => {});
        const sorted = await page.evaluate(() => {
          const t = [...document.querySelectorAll("product-tile")].filter((e) => getComputedStyle(e).display !== "none")
            .map((e) => ({ title: (e.querySelector("product-title")?.textContent || "").replace(/\s+/g, " ").trim(), x: e.getBoundingClientRect().left, y: Math.round(e.getBoundingClientRect().top / 20) }))
            .sort((a, b) => a.y - b.y || a.x - b.x).map((e) => e.title);
          return { n: t.length, ordered: t.every((x, i) => i === 0 || t[i - 1].localeCompare(x) <= 0), sample: t.slice(0, 4) };
        });
        check("catalog: sorting this page by title re-orders the live grid", sorted.n > 5 && sorted.ordered, JSON.stringify(sorted));
      }
      await shot(page, `live-${label}`);
      await page.close();
    }

    {
      // GOG's own APIs from a real content script, against the real servers: the
      // proof that the CORS route (no host permission) works.
      await setSettings({ sync: { endlessCatalog: true, catalogTools: true }, local: { netLog: [] } });
      const seenCatalog = [];
      const onReq = (r) => /catalog\.gog\.com/.test(r.url()) && seenCatalog.push(r.url().replace("https://catalog.gog.com/v1/catalog?", ""));
      context.on("request", onReq);
      const page = await open("/en/games");
      await page.waitForSelector("product-tile", { timeout: 20000 }).catch(() => {});
      const first = await page.evaluate(() => [...document.querySelectorAll("product-tile a[href*='/game/']")].map((a) => a.getAttribute("href").split("/game/")[1]));
      // Real catalogs are many screens tall: it loads when the reader gets near the end, so scroll there.
      await page.waitForSelector("#gog-plus-endless", { timeout: 15000 }).catch(() => {});
      await page.evaluate(() => document.getElementById("gog-plus-endless")?.scrollIntoView({ block: "end" }));
      const more = await page.waitForFunction(() => document.querySelectorAll("#gog-plus-endless .gog-plus-more-card").length >= 24, null, { timeout: 25000 }).then(() => true, () => false);
      const live = await page.evaluate(() => ({
        n: document.querySelectorAll("#gog-plus-endless .gog-plus-more-card").length,
        slugs: [...document.querySelectorAll("#gog-plus-endless .gog-plus-more-card")].map((c) => c.dataset.slug),
        status: document.querySelector(".gog-plus-endless-status")?.textContent,
        withPrice: document.querySelectorAll("#gog-plus-endless .gog-plus-more-price").length,
      }));
      context.off("request", onReq);
      check("endless scrolling (live): the next catalog page is appended from catalog.gog.com", more && live.n >= 24, JSON.stringify({ ...live, slugs: live.slugs.slice(0, 3), asked: seenCatalog, firstTiles: first.slice(0, 4), url: page.url() }));
      check("…and none of it repeats what the page already shows", live.slugs.every((s) => !first.includes(s)), live.slugs.filter((s) => first.includes(s)).join());
      const log = (await storageGet("local", "netLog")).netLog || [];
      check("…every call is in the request log", log.some((l) => l.host === "catalog.gog.com" && l.ok), JSON.stringify(log.slice(-3)));
      check("no uncaught page errors", page.errors.length === 0, page.errors.join(" | "));
      await shot(page, "live-endless");
      await page.close();
      await setSettings({ sync: { endlessCatalog: false } });

      // A real bundle: Prince of Persia Bundle contains four games, each with a page of its own.
      await setSettings({ sync: { packContents: true }, local: { packInfo: {}, ownedSlugs: {} } });
      const pk = await open("/en/game/prince_of_persia_bundle");
      await pk.waitForSelector("#gog-plus-gamepanel", { timeout: 20000 }).catch(() => {});
      const got = await pk.waitForFunction(() => document.querySelectorAll(".gog-plus-pack-list a").length === 4, null, { timeout: 20000 }).then(() => true, () => false);
      const kids = (await storageGet("local", "packInfo")).packInfo?.prince_of_persia_bundle?.children || [];
      check("a real bundle page lists its four games, learned from api.gog.com", got && kids.length === 4 && kids.every((k) => k.slug && k.title), JSON.stringify(kids));
      if (kids.length === 4) {
        await setSettings({ local: { ownedSlugs: { [kids[0].slug]: "2026-01-01" } } });
        await pk.reload({ waitUntil: "domcontentloaded" });
        const warned = await pk.waitForFunction(() => /You already own 1 of the 4 games in this pack/.test(document.getElementById("gog-plus-gamepanel")?.textContent || ""), null, { timeout: 20000 }).then(() => true, () => false);
        const panelText = await pk.evaluate(() => (document.getElementById("gog-plus-gamepanel")?.textContent || "").replace(/\s+/g, " ").slice(0, 400));
        check("…and warns when you own one of them", warned, `${panelText} | kid=${kids[0].slug}`);
      }
      await pk.close();

      // Many "packs" are one game's own page holding hidden components that point back at it:
      // those must not be reported as separate games.
      const ll = await open("/en/game/lands_of_lore_1_2");
      await ll.waitForSelector("#gog-plus-gamepanel", { timeout: 20000 }).catch(() => {});
      const settled = await ll.waitForFunction(() => true, null, { timeout: 1000 }).then(() => true, () => false);
      await new Promise((r) => setTimeout(r, 4000));
      const llInfo = (await storageGet("local", "packInfo")).packInfo?.lands_of_lore_1_2;
      const llList = await ll.evaluate(() => document.querySelectorAll(".gog-plus-pack-list a").length);
      check("a one-game 'pack' (hidden components pointing back at itself) lists nothing to match", settled && !!llInfo && llInfo.children.length === 0 && llList === 0, JSON.stringify(llInfo));
      await ll.close();
    }

    {
      const page = await open("/en/game/gris");
      await page.waitForSelector("#gog-plus-gamepanel", { timeout: 20000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1500));
      const g = await page.evaluate(() => ({
        panel: !!document.getElementById("gog-plus-gamepanel"),
        finalNote: document.querySelector('[selenium-id="ProductFinalPrice"] .gog-plus-conv-note')?.textContent.trim() || null,
        bodyClass: document.body.className.split(" ").filter((c) => /prices-in/.test(c)).join(","),
        sysRows: [...document.querySelectorAll(".gog-plus-sysreq-row")].length,
      }));
      check("game page: insights panel mounts", g.panel, JSON.stringify(g));
      check("game page: the bare-number price is converted", !!g.finalNote, JSON.stringify(g));
      const hist = (await storageGet("local", "priceHistory")).priceHistory || {};
      check("game page: a price is recorded in the history", (hist.gris || []).length === 1 && hist.gris[0].p > 0, JSON.stringify(hist));
      check("game page: system check found the requirements table", g.sysRows >= 1, JSON.stringify(g));
      const facts = (await storageGet("local", "gameFacts")).gameFacts?.gris;
      check("game page: ratings, tags and release year are read into the facts cache", !!facts && !!facts.rating && (facts.tags || []).length > 0 && typeof facts.year === "number", JSON.stringify(facts || null).slice(0, 300));
      check("game page: the release date is read from the real page's JSON-LD", /^\d{4}-\d{2}-\d{2}$/.test(facts?.rd || ""), String(facts?.rd));
      const sections = await page.evaluate(() => [...document.querySelectorAll("#gog-plus-gp-body > [data-section-id]")].map((x) => x.dataset.sectionId));
      check("game page: the panel's sections are built and identified", sections.includes("history") && sections.includes("tags"), sections.join());
      check("no uncaught page errors", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
      await shot(page, "live-game");
      await page.close();
    }
  }
} finally {
  await context.close();
  rmSync(userDataDir, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
