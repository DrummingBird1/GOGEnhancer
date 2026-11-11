// The real gog.com in each store currency: GOG picks the country/currency from
// the `gog_lc` cookie, so setting it shows the extension what a visitor from
// that country sees — the real markup, the real symbol placement, the real
// number format. Public pages only, logged out; a handful of page loads.
//
//   node e2e/live-locales.mjs

import { startHarness } from "./harness.mjs";

const results = [];
function check(name, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${!ok && detail ? `\n      ${detail}` : ""}`);
}

// rates per 1 USD; target ILS
const RATES = { ILS: 4, EUR: 0.9, GBP: 0.8, PLN: 4, RUB: 90, BRL: 5, AUD: 1.5, CAD: 1.25 };
const STORES = [
  ["US_USD_en-US", "USD"],
  ["DE_EUR_en-US", "EUR"],
  ["GB_GBP_en-US", "GBP"],
  ["PL_PLN_en-US", "PLN"],
  ["BR_BRL_en-US", "BRL"],
  ["AU_AUD_en-US", "AUD"],
  ["CA_CAD_en-US", "CAD"],
  ["IL_ILS_en-US", "ILS"],
];

for (const [lc, code] of STORES) {
  const h = await startHarness({
    live: true,
    extPath: new URL("../extension", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    cookies: [{ name: "gog_lc", value: lc, domain: ".gog.com", path: "/" }],
  });
  await h.setSettings({ sync: { currencyConverter: true, targetCurrency: "ILS", taxEstimator: false, rates: RATES, priceCompareTable: false }, local: { priceHistory: {} } });
  const page = await h.context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("https://www.gog.com/en/game/gris", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#gog-plus-gamepanel", { timeout: 25000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));
  const info = await page.evaluate(() => {
    const final = document.querySelector('[selenium-id="ProductFinalPrice"]');
    const shown = final ? `${getComputedStyle(final, "::before").content}|${final.textContent.trim()}|${getComputedStyle(final, "::after").content}` : null;
    return {
      bodyCurrency: [...document.body.classList].find((c) => /prices-in-/.test(c)),
      shown,
      notes: [...document.querySelectorAll(".gog-plus-conv-note")].map((n) => n.textContent.trim()),
      panel: !!document.getElementById("gog-plus-gamepanel"),
    };
  });
  const hist = await h.sw.evaluate(() => new Promise((r) => chrome.storage.local.get("priceHistory", (v) => r(v.priceHistory?.gris?.slice(-1)[0] || null))));
  const wantCode = code.toLowerCase();
  const gotCurrency = (info.bodyCurrency || "").replace(/^_?prices-in-/, "");
  const absurd = info.notes.some((n) => /₪\s?\d{4,}/.test(n)) && code !== "RUB";
  const converted = code === "ILS" ? info.notes.length === 0 : info.notes.length > 0 && !absurd;
  check(
    `${code}: page says ${gotCurrency || "?"}, shows ${info.shown}, note ${JSON.stringify(info.notes.slice(0, 2))}, recorded ${hist ? `${hist.p} ${hist.c}` : "nothing"}`,
    info.panel && converted && errors.length === 0 && (hist && hist.c === code) && gotCurrency === wantCode,
    JSON.stringify({ info, hist, errors })
  );
  await h.cleanup();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
