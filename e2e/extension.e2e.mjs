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
import { homeReal, catalogReal, gameReal, realTile } from "./fixtures-real.mjs";

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
      await shot(page, `live-${label}`);
      await page.close();
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
