// Locale check: the same game page as a visitor in each currency would see it
// (the currency is named only by a body class; the symbol is printed by CSS and
// the number is written the way that country writes it). The extension must
// read the price, convert it with the configured rates and print the result —
// and must never print garbage for a currency it has no rate for.
//
//   node e2e/locales.mjs

import { startHarness } from "./harness.mjs";
import { gameV4 } from "./fixtures-real.mjs";

const results = [];
function check(name, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${!ok && detail ? `\n      ${detail}` : ""}`);
}

// rates are "per 1 USD": ILS 4, EUR 0.9, GBP 0.8, PLN 4, RUB 90. Target: ILS.
const CASES = [
  { code: "usd", css: '::before { content: "$ " }', base: "49.99", final: "24.99", want: /₪\s?100\b/, label: "USD 24.99 → ₪100" },
  { code: "eur", css: '::after { content: " €" }', base: "49,99", final: "24,99", want: /₪\s?111\b/, label: "EUR 24,99 € → ₪111" },
  { code: "gbp", css: '::before { content: "£" }', base: "39.99", final: "19.99", want: /₪\s?(99|100)\b/, label: "GBP £19.99 → ₪100" },
  { code: "pln", css: '::after { content: " zł" }', base: "199,99", final: "99,99", want: /₪\s?100\b/, label: "PLN 99,99 zł → ₪100" },
  { code: "pln", css: '::after { content: " zł" }', base: "2 199,99", final: "1 097,99", want: /₪\s?1[ ,.  ]?098\b/, label: "PLN 1 097,99 zł (space thousands) → ₪1,098" },
  { code: "rub", css: '::after { content: " ₽" }', base: "5 499", final: "2 499", want: /₪\s?111\b/, label: "RUB 2 499 ₽ → ₪111" },
  { code: "brl", css: '::before { content: "R$ " }', base: "259,90", final: "129,90", want: null, label: "BRL R$ 129,90 (no rate configured) → no absurd figure" },
  { code: "ils", css: '::before { content: "₪" }', base: "89.90", final: "44.90", want: "none", label: "ILS ₪44.90 on an ILS target → no note" },
];

const h = await startHarness({ extPath: new URL("../extension", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
await h.setSettings({
  sync: { currencyConverter: true, targetCurrency: "ILS", taxEstimator: false, rates: { ILS: 4, EUR: 0.9, GBP: 0.8, PLN: 4, RUB: 90 }, priceCompareTable: false },
  local: { priceHistory: {} },
});

let current = CASES[0];
await h.context.route("https://www.gog.com/en/game/alpha_game", (route) => {
  const c = current;
  let html = gameV4()
    .replace("_prices-in-usd", `_prices-in-${c.code}`)
    .replace('._price::before { content: "$ " }', `._price${c.css}`)
    .replace(">49.99<", `>${c.base}<`)
    .replace(/>24\.99</g, `>${c.final}<`);
  route.fulfill({ status: 200, contentType: "text/html", body: html });
});

for (const c of CASES) {
  current = c;
  await h.setSettings({ local: { priceHistory: {} } });
  const page = await h.context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("https://www.gog.com/en/game/alpha_game");
  await page.waitForSelector("#gog-plus-gamepanel", { timeout: 8000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 900));
  const notes = await page.evaluate(() => [...document.querySelectorAll(".gog-plus-conv-note")].map((n) => n.textContent.trim()));
  const hist = await h.sw.evaluate(() => new Promise((r) => chrome.storage.local.get("priceHistory", (v) => r(v.priceHistory?.alpha_game?.slice(-1)[0]))));
  const joined = notes.join(" | ");
  let ok;
  if (c.want === "none") ok = notes.length === 0;
  else if (c.want === null) ok = notes.every((n) => !/₪\s?\d{4,}/.test(n)) && (!hist || hist.p < 1000);
  else ok = c.want.test(joined);
  const recorded = c.want === null || c.want === "none" ? true : !!hist && hist.c === c.code.toUpperCase();
  check(`${c.label}`, ok && recorded && errors.length === 0, `notes=[${joined}] recorded=${JSON.stringify(hist)} errors=${errors.join(" | ")}`);
  await page.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await h.cleanup();
process.exit(failed ? 1 : 0);
