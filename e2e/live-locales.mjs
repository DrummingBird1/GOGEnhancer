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
  "US_USD", "DE_EUR", "GB_GBP", "PL_PLN", "BR_BRL", "AU_AUD", "CA_CAD", "IL_ILS",
  "CH_CHF", "SE_SEK", "NO_NOK", "DK_DKK", "CZ_CZK", "HU_HUF", "RO_RON", "TR_TRY",
  "CN_CNY", "MX_MXN", "ZA_ZAR", "NZ_NZD", "SG_SGD", "TH_THB", "ID_IDR", "JP_JPY",
].map((x) => [`${x}_en-US`, x.split("_")[1]]);

for (const [lc, code] of STORES) {
  const h = await startHarness({
    live: true,
    extPath: new URL("../extension", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    cookies: [{ name: "gog_lc", value: lc, domain: ".gog.com", path: "/" }],
  });
  // no rates given: the built-in ones answer for every currency (the storage wrapper fills them in)
  await h.setSettings({ sync: { currencyConverter: true, targetCurrency: "ILS", taxEstimator: false, rates: {}, priceCompareTable: false }, local: { priceHistory: {} } });
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
  // GOG sells some games in only some stores: a price of 0 means "not sold here", nothing to convert
  const notSold = /"0(\.0+)?"/.test(info.shown || "") || /[|]0(\.0+)?[|]/.test(info.shown || "");
  const converted = code === "ILS" ? info.notes.length === 0 : notSold ? true : info.notes.length > 0 && !absurd;
  check(
    `${code}: page says ${gotCurrency || "?"}, shows ${info.shown}, note ${JSON.stringify(info.notes.slice(0, 2))}, recorded ${hist ? `${hist.p} ${hist.c}` : "nothing"}`,
    info.panel && converted && errors.length === 0 && (notSold || (hist && hist.c === code)) && gotCurrency === wantCode,
    JSON.stringify({ info, hist, errors })
  );
  // The new catalog pages carry no currency class and several stores print a bare "$" (or "kr", "¥", "R"):
  // the currency has to come from the page's own catalog request.
  {
    const cat = await h.context.newPage();
    await cat.goto("https://www.gog.com/en/games", { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 5000));
    const c = await cat.evaluate(() => {
      const notes = [...document.querySelectorAll(".gog-plus-conv-note")];
      return { n: notes.length, sample: notes[0]?.parentElement?.textContent.replace(/\s+/g, " ").trim().slice(0, 40) || null, big: notes.filter((x) => /₪\s?\d{4,}/.test(x.textContent)).length };
    });
    check(`${code} catalog: ${c.n} prices converted (e.g. ${c.sample})`, code === "JPY" || code === "ILS" || (c.n > 20 && c.big === 0), JSON.stringify(c));
    await cat.close();
  }
  await h.cleanup();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
