import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

// The shipped translation rows (lib/i18n-pages-*.js): that they are whole, that
// their placeholders agree with the English, and that nothing static in the four
// pages that use them is left without a row.

const EXT = resolve(__dirname, "../extension");
const LANGS = ["he", "ru", "pl", "de", "fr", "es"];

const PAGES = {
  dashboard: { html: "tags/tags.html", files: ["common", "dashboard", "dashboard-messages"] },
  options: { html: "options/options.html", files: ["common", "options", "options-messages"] },
  popup: { html: "popup/popup.html", files: ["common", "popup"] },
  onboarding: { html: "onboarding/onboarding.html", files: ["common", "onboarding"] },
  tour: { html: "tour/tour.html", files: ["common", "options-messages", "tour"] },
};

/** What a page may show without a row: names, codes, addresses, numbers and sizes. */
const TECHNICAL = new Set([
  "GOG Enhancer", "GOG Enhancer 4", "v4.0.0", "v2.4", "ILS", "EUR", "GBP", "PLN", "RUB", "USD", "zł", "₪ ILS", "€ EUR", "£ GBP", "₽ RUB", "zł PLN", "$ USD",
  "1 USD =", "frankfurter.app", "api.frankfurter.app", "www.gog.com", "www.cheapshark.com", "api.gog.com", "catalog.gog.com", "gog.com",
  "Ko-fi", "☕ Ko-fi", "Patreon", "💜 Patreon", "https://discord.com/api/webhooks/…", "Windows 11", "Ryzen 5 5600", "RTX 3060", "Hebrew, English",
  "J", "K", "T", "?", "Alt", "G", "H", "Shift", "English", "עברית (Hebrew)", "Русский (Russian)", "Polski (Polish)", "Deutsch (German)", "Français (French)", "Español (Spanish)",
  "↓ CSV", "📝 Markdown ↓", "Webhook", "[GOG+]", "window.GOG_PLUS_DEBUG = true", "chrome.notifications", "gog-enhancer-sync.json", "gog-enhancer-backup-YYYY-MM-DD.json",
  "USD", "Alt+↑ / Alt+↓", "Name",
]);

/** Loads the translator and one page's row files into a fresh module state. */
async function loadPage(name) {
  vi.resetModules();
  delete window.GOGPlusPageI18n;
  await import("../extension/lib/i18n-pages.js");
  for (const f of PAGES[name].files) await import(`../extension/lib/i18n-pages-${f}.js`);
  return window.GOGPlusPageI18n;
}

const body = (htmlPath) => {
  const html = readFileSync(resolve(EXT, htmlPath), "utf8");
  const inner = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)[1];
  return inner.replace(/<script[\s\S]*?<\/script>/gi, "");
};

describe("the shipped rows", () => {
  /** @type {string[][]} */
  let rows = [];
  beforeEach(async () => {
    vi.resetModules();
    delete window.GOGPlusPageI18n;
    await import("../extension/lib/i18n-pages.js");
    const names = readdirSync(resolve(EXT, "lib")).flatMap((n) => /^i18n-pages-(.+)\.js$/.exec(n)?.[1] ?? []);
    expect(names.length).toBeGreaterThanOrEqual(8);
    for (const n of names) await import(`../extension/lib/i18n-pages-${n}.js`);
    rows = window.GOGPlusPageI18n.rows();
  });

  it("has a translation in all six languages for every row", () => {
    expect(rows.length).toBeGreaterThan(500);
    for (const row of rows) {
      expect(row.length, `"${row[0]}"`).toBe(7);
      for (let i = 1; i <= 6; i++) expect(typeof row[i] === "string" && row[i].trim().length > 0, `${LANGS[i - 1]}: "${row[0].slice(0, 50)}"`).toBe(true);
    }
  });

  it("uses only placeholders its English has, and the same highlighted-word tags", () => {
    for (const row of rows) {
      const slots = (row[0].match(/\{n\}|\{\}/g) || []).length;
      const tags = [...new Set(row[0].match(/<\d+>/g) || [])].sort();
      for (let i = 1; i <= 6; i++) {
        const t = row[i];
        for (const m of t.matchAll(/\{(\d+)(?:#[^}]*)?\}/g)) expect(Number(m[1]), `${LANGS[i - 1]}: "${row[0].slice(0, 50)}" uses {${m[1]}} of ${slots}`).toBeLessThanOrEqual(slots);
        expect([...new Set(t.match(/<\d+>/g) || [])].sort(), `${LANGS[i - 1]} tags: "${row[0].slice(0, 50)}"`).toEqual(tags);
        expect(t, `${LANGS[i - 1]} left a {n} or {} in "${row[0].slice(0, 50)}"`).not.toMatch(/\{n\}|\{\}/);
      }
    }
  });

  it("gives Russian and Polish three plural forms wherever it picks by number", () => {
    for (const row of rows) {
      for (const [i, lang] of [[2, "ru"], [3, "pl"]]) {
        for (const m of row[i].matchAll(/\{\d+#([^}]*)\}/g)) expect(m[1].split("|").length, `${lang}: "${row[0].slice(0, 50)}"`).toBe(3);
      }
      for (const [i, lang] of [[1, "he"], [4, "de"], [5, "fr"], [6, "es"]]) {
        for (const m of row[i].matchAll(/\{\d+#([^}]*)\}/g)) expect(m[1].split("|").length, `${lang}: "${row[0].slice(0, 50)}"`).toBe(2);
      }
    }
  });

  it("says the same thing wherever the same English appears twice", () => {
    /** @type {Map<string, string[]>} */
    const seen = new Map();
    for (const row of rows) {
      const key = row[0].replace(/\s+/g, " ").trim();
      if (seen.has(key)) expect(row.slice(1), `"${key.slice(0, 60)}" translated two ways`).toEqual(seen.get(key));
      else seen.set(key, row.slice(1));
    }
  });

  it("keeps Hebrew phrases free of a stray left-to-right-only join", () => {
    for (const row of rows) expect(row[1], `"${row[0].slice(0, 40)}"`).not.toMatch(/^\s|\s$/);
  });
});

describe.each(Object.keys(PAGES))("the %s page", (name) => {
  it("has a row for everything it writes in its own markup", async () => {
    const T = await loadPage(name);
    document.body.innerHTML = body(PAGES[name].html);
    const missing = T.strings(document.body).filter((s) => !TECHNICAL.has(s) && !LANGS.every((l) => T.covers(s, l)));
    // Popup strings that carry a data-i18n key are translated by lib/i18n.js, not by a row.
    const keyed = new Set(
      [...document.querySelectorAll("[data-i18n]")].map((e) => e.textContent.replace(/\s+/g, " ").trim()).concat(
        [...document.querySelectorAll("[data-i18n-attr]")].flatMap((e) => (e.getAttribute("data-i18n-attr") || "").split(",").map((p) => e.getAttribute(p.trim().split(":")[0]) || ""))
      )
    );
    expect(missing.filter((s) => !keyed.has(s)), `${name}: no row for these`).toEqual([]);
  });

  it("really translates when the page's own language is switched on", async () => {
    const T = await loadPage(name);
    document.body.innerHTML = body(PAGES[name].html);
    const before = document.body.textContent;
    T.apply(document.body, "he");
    expect(document.body.textContent).not.toBe(before);
    T.apply(document.body, "en");
    expect(document.body.textContent).toBe(before);
  });
});
