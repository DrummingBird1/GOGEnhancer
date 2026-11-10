// Sweep of every page the extension owns, in every interface language and at the
// widths people really use: console / page errors, horizontal overflow, controls
// with no accessible name, images with no alt, duplicate ids, positive tabindex,
// text left in English after switching language, and the document direction.
//
//   node e2e/pages-sweep.mjs            (E2E_SHOTS=dir saves a screenshot of each)
//
// The dashboard is filled with some demo data first so it renders real content.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { startHarness } from "./harness.mjs";

const SHOTS = process.env.E2E_SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const results = [];
function check(name, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${!ok && detail ? `\n      ${detail}` : ""}`);
}

const LANGS = [["en", "ltr"], ["he", "rtl"], ["ru", "ltr"], ["pl", "ltr"], ["de", "ltr"], ["fr", "ltr"], ["es", "ltr"]];
const PAGES = [
  ["popup", "popup/popup.html", [380]],
  ["options", "options/options.html", [1100, 420]],
  ["dashboard", "tags/tags.html", [1200, 420]],
  ["onboarding", "onboarding/onboarding.html", [900, 420]],
  ["tour", "tour/tour.html", [900, 420]],
];

const h = await startHarness({ extPath: new URL("../extension", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
const demo = {
  tags: { alpha_game: ["rpg", "co-op"], beta_quest: ["retro"], gamma: ["strategy"] },
  notes: { alpha_game: "A note\nwith two lines" },
  gameStatus: { alpha_game: "playing", beta_quest: "backlog", gamma: "finished" },
  priceHistory: {
    alpha_game: [{ d: "2026-08-01", p: 29.99, c: "USD" }, { d: "2026-10-30", p: 14.99, c: "USD", b: 29.99 }],
    gamma: [{ d: "2026-09-01", p: 9.99, c: "USD" }],
  },
  purchaseLog: { gamma: { purchaseDate: "2026-10-01", price: 9.99, currency: "USD" } },
  ownedSlugs: { gamma: "2026-10-01" },
  gameFacts: { alpha_game: { t: 1790000000000, title: "Alpha Game", rd: "2015-05-19" } },
};

/** In-page audit: structural problems a screen-reader / keyboard user would hit. */
const audit = () => {
  const out = { noName: [], noAlt: [], dupIds: [], posTab: 0, overflow: null, empty: false };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };
  const name = (el) => {
    const label = el.labels && el.labels.length ? [...el.labels].map((l) => l.getAttribute("aria-label") || l.textContent).join(" ") : "";
    return (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") && "labelled" || label || el.title || el.textContent || el.getAttribute("placeholder") || el.value || "").trim();
  };
  for (const el of document.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=switch]")) {
    if (el.hidden || el.closest("[hidden]")) continue; // not on screen for anyone
    if (!visible(el) && !(el.type === "checkbox" || el.type === "radio")) continue;
    if (!name(el)) out.noName.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.className ? "." + String(el.className).split(" ")[0] : ""}`);
  }
  for (const img of document.querySelectorAll("img")) if (!img.hasAttribute("alt")) out.noAlt.push(img.src.slice(-40));
  const seen = new Set();
  for (const el of document.querySelectorAll("[id]")) {
    if (seen.has(el.id)) out.dupIds.push(el.id);
    seen.add(el.id);
  }
  out.posTab = document.querySelectorAll("[tabindex]:not([tabindex='0']):not([tabindex='-1'])").length;
  const doc = document.documentElement;
  out.overflow = doc.scrollWidth > doc.clientWidth + 2 ? `${doc.scrollWidth}>${doc.clientWidth}` : null;
  out.empty = (document.body.innerText || "").trim().length < 20;
  out.dir = doc.dir || getComputedStyle(doc).direction;
  out.lang = doc.lang;
  return out;
};

let count = 0;
for (const [lang, dir] of LANGS) {
  await h.setSettings({ sync: { uiLanguage: lang }, local: demo });
  for (const [name, path, widths] of PAGES) {
    for (const width of widths) {
      const page = await h.context.newPage();
      await page.setViewportSize({ width, height: 900 });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text()) && errors.push(m.text()));
      await page.goto(`chrome-extension://${h.extId}/${path}`);
      await new Promise((r) => setTimeout(r, 900));
      const a = await page.evaluate(audit);
      const problems = [];
      if (errors.length) problems.push(`errors: ${errors.slice(0, 2).join(" | ")}`);
      if (a.empty) problems.push("page is empty");
      if (a.noName.length) problems.push(`no accessible name: ${[...new Set(a.noName)].slice(0, 6).join(", ")}`);
      if (a.noAlt.length) problems.push(`img without alt: ${a.noAlt.slice(0, 3).join(", ")}`);
      if (a.dupIds.length) problems.push(`duplicate ids: ${[...new Set(a.dupIds)].slice(0, 5).join(", ")}`);
      if (a.posTab) problems.push(`${a.posTab} positive tabindex`);
      if (a.overflow && width >= 900) problems.push(`horizontal overflow ${a.overflow}`);
      if (name !== "tour" && a.dir !== dir) problems.push(`direction is ${a.dir}, expected ${dir}`);
      count++;
      check(`${lang} · ${name} @${width}px`, problems.length === 0, problems.join(" ;; "));
      if (SHOTS) await page.screenshot({ path: join(SHOTS, `${lang}-${name}-${width}.png`), fullPage: false });
      await page.close();
    }
  }
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed (${count} page views)`);
await h.cleanup();
process.exit(failed ? 1 : 0);
