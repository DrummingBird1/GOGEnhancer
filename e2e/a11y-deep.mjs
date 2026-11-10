// Accessibility beyond "has a label": keyboard-only use and colour contrast.
//
// Keyboard: Tab through each extension page and the game-page panel — every
// control must be reachable, show where the focus is, and the order must not
// trap anyone; Escape must close what opened. Contrast: for every theme, every
// piece of visible text is measured against the colour actually behind it
// (WCAG 2: 4.5:1 for normal text, 3:1 for large or bold).
//
//   node e2e/a11y-deep.mjs

import { startHarness } from "./harness.mjs";

const results = [];
function check(name, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${!ok && detail ? `\n      ${detail}` : ""}`);
}
const h = await startHarness({ extPath: new URL("../extension", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), viewport: { width: 1200, height: 900 } });
const demo = {
  tags: { alpha_game: ["rpg", "co-op"], beta_quest: ["retro"] },
  notes: { alpha_game: "note" },
  gameStatus: { alpha_game: "playing" },
  priceHistory: { alpha_game: [{ d: "2026-08-01", p: 29.99, c: "USD" }, { d: "2026-10-30", p: 14.99, c: "USD", b: 29.99 }] },
  gameFacts: { alpha_game: { t: 1790000000000, title: "Alpha Game", rd: "2015-05-19" } },
};
await h.setSettings({ sync: { targetCurrency: "ILS", rates: { ILS: 4 }, currencyConverter: true, keyboardNav: true, priceCompareTable: false }, local: demo });

/** Tab through the page; report stops, trap, missing focus ring. */
async function tabWalk(page, label, maxStops = 500) {
  await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
  const stops = [];
  const noRing = [];
  let first = null;
  let trapped = true;
  for (let i = 0; i < maxStops; i++) {
    await page.keyboard.press("Tab");
    await new Promise((r) => setTimeout(r, 260)); // let a focus transition finish before reading the style
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      const snap = (e) => { const c = getComputedStyle(e); return [c.outlineStyle, c.outlineWidth, c.outlineColor, c.boxShadow, c.borderTopColor, c.borderBottomColor, c.backgroundColor, c.color, c.textDecorationLine].join("|"); };
      const prev = window.__prev;
      let prevResult = null;
      // date/time inputs take several Tab stops inside one control; their focus style is checked on its own below
      if (prev && prev.el !== el && prev.el.isConnected) prevResult = { id: prev.id, ring: prev.focused !== snap(prev.el) || prev.el.matches('input[type=date], input[type=time]') };
      if (!el || el === document.body) { window.__prev = null; return { gone: true, prevResult }; }
      const id = `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""}`;
      window.__prev = { el, id, focused: snap(el) };
      return { id, prevResult };
    });
    if (info.prevResult && !info.prevResult.ring) noRing.push(info.prevResult.id);
    if (info.gone) { trapped = false; break; }
    if (first === null) first = info.id;
    else if (info.id === first && stops.length > 2) { trapped = false; break; }
    stops.push(info.id);
    continue;
  }
  const interactive = await page.evaluate(() => [...document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [tabindex='0']")].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && !e.disabled && !e.closest("[hidden]"); }).length);
  const unique = new Set(stops).size;
  check(`${label}: ${stops.length} tab stops for ${interactive} visible controls, focus never trapped`, !trapped || stops.length < maxStops, `${stops.length} stops`);
  void unique;
  check(`${label}: every stop shows where the focus is (${noRing.length} without an outline or glow)`, noRing.length === 0, [...new Set(noRing)].slice(0, 8).join(", "));
  return { stops, interactive, unique };
}

for (const [name, path] of [["options", "options/options.html"], ["dashboard", "tags/tags.html"], ["popup", "popup/popup.html"], ["onboarding", "onboarding/onboarding.html"]]) {
  const p = await h.context.newPage();
  await p.goto(`chrome-extension://${h.extId}/${path}`);
  await new Promise((r) => setTimeout(r, 900));
  await tabWalk(p, `keyboard · ${name}`);
  await p.close();
}

// Date and time fields take several Tab stops inside one control, so check their focus style directly.
{
  const p = await h.context.newPage();
  await p.goto(`chrome-extension://${h.extId}/options/options.html`);
  await new Promise((r) => setTimeout(r, 800));
  const res = await p.evaluate(async () => {
    const out = [];
    for (const el of document.querySelectorAll("input[type=time], input[type=date]")) {
      const s = () => { const c = getComputedStyle(el); return [c.outlineStyle, c.boxShadow, c.borderTopColor].join("|"); };
      const a = s(); el.focus(); await new Promise((r) => setTimeout(r, 350)); const b = s(); el.blur();
      out.push(a !== b);
    }
    return out;
  });
  check(`date and time fields change their border when focused (${res.length} checked)`, res.length > 0 && res.every(Boolean), JSON.stringify(res));
  await p.close();
}

// Dashboard dialogs: open with the keyboard, Escape closes, focus returns.
{
  const p = await h.context.newPage();
  await p.goto(`chrome-extension://${h.extId}/tags/tags.html`);
  await new Promise((r) => setTimeout(r, 900));
  await p.focus("#filterBuilderBtn");
  await p.keyboard.press("Enter");
  await new Promise((r) => setTimeout(r, 300));
  const open = await p.evaluate(() => !document.getElementById("filterBuilderPopover").hidden);
  await p.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 300));
  const closed = await p.evaluate(() => document.getElementById("filterBuilderPopover").hidden && document.activeElement?.id === "filterBuilderBtn");
  check("dashboard: the filter builder opens with Enter, Escape closes it and focus goes back to its button", open && closed, JSON.stringify({ open, closed }));
  await p.close();
}

// Game-page panel by keyboard.
{
  const p = await h.context.newPage();
  await p.goto("https://www.gog.com/en/game/alpha_game");
  await p.waitForSelector("#gog-plus-gamepanel", { timeout: 8000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1200));
  await p.focus("#gog-plus-gamepanel button, #gog-plus-gamepanel a, #gog-plus-gamepanel input").catch(() => {});
  const seen = new Set();
  let ringless = 0;
  const ringlessIds = [];
  for (let i = 0; i < 80; i++) {
    const info = await p.evaluate(() => {
      const el = document.activeElement;
      const snap = (e) => { const c = getComputedStyle(e); return [c.outlineStyle, c.outlineWidth, c.outlineColor, c.boxShadow, c.borderTopColor, c.backgroundColor, c.color, c.textDecorationLine].join("|"); };
      const prev = window.__prev;
      const prevRing = prev && prev.el !== el && prev.el.isConnected ? { id: prev.id, ring: prev.focused !== snap(prev.el) || prev.el.matches('input[type=date], input[type=time]') } : null;
      if (!el || !el.closest("#gog-plus-gamepanel")) { window.__prev = null; return { out: true, prevRing }; }
      const id = el.tagName + (el.id ? "#" + el.id : "") + "." + String(el.className).split(" ")[0];
      window.__prev = { el, id, focused: snap(el) };
      return { id, prevRing };
    });
    if (info.prevRing && !info.prevRing.ring) { ringless++; ringlessIds.push(info.prevRing.id); }
    if (info.out) break;
    seen.add(info.id);
    await p.keyboard.press("Tab");
    await new Promise((r) => setTimeout(r, 260));
  }
  check(`game panel: ${seen.size} different controls reached by Tab, ${ringless} stops without a focus ring`, seen.size >= 8 && ringless === 0, `${seen.size} controls, ringless: ${ringlessIds.join(", ")}`);
  // the ? dialog is keyboard-operable
  await p.evaluate(() => document.activeElement?.blur?.());
  await p.keyboard.press("?");
  await new Promise((r) => setTimeout(r, 300));
  const dlg = await p.evaluate(() => { const d = document.getElementById("gog-plus-keyhelp"); return { open: !!d?.open, focusInside: !!d?.contains(document.activeElement) }; });
  await p.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 300));
  check("game page: the ? dialog takes focus when it opens", dlg.open && dlg.focusInside, JSON.stringify(dlg));
  await p.close();
}

/** Contrast audit run inside the page. */
const contrast = () => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const bgOf = (el) => {
    const stack = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== "none") return null; // a picture or gradient: not a single colour to measure against
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) stack.push(c);
      if (c && c.a >= 1) break;
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (const c of stack.reverse()) base = over(c, base);
    return base;
  };
  const bad = [];
  let measured = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const t = n.nodeValue.trim();
    if (t.length < 2) continue;
    if (!/[A-Za-z0-9֐-׿Ѐ-ӿ]/.test(t)) continue; // emoji / symbols draw their own colours
    const el = n.parentElement;
    if (!el || el.closest("script, style, [hidden], svg")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.3) continue;
    const fg = parse(cs.color);
    const bg = bgOf(el);
    if (!fg || !bg) continue;
    const eff = over({ ...fg, a: fg.a * parseFloat(cs.opacity) }, bg);
    const L1 = lum(eff), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(cs.fontSize);
    const large = px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
    measured++;
    if (ratio < (large ? 3 : 4.5)) bad.push({ ratio: Math.round(ratio * 10) / 10, fg: cs.color, bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`, text: t.slice(0, 28), el: el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : "") });
  }
  return { measured, bad };
};

const THEMES = ["neon", "classic", "crt", "sunset", "light", "auto", "highcontrast", "amoled", "amber"];
console.log("\nColour contrast (text vs. the colour behind it)");
const summary = [];
for (const theme of THEMES) {
  await h.setSettings({ sync: { theme } });
  const opt = await h.context.newPage();
  await opt.goto(`chrome-extension://${h.extId}/options/options.html`);
  await new Promise((r) => setTimeout(r, 1800)); // theme transitions must have finished
  const o = await opt.evaluate(contrast);
  await opt.close();
  const dash = await h.context.newPage();
  await dash.goto(`chrome-extension://${h.extId}/tags/tags.html`);
  await new Promise((r) => setTimeout(r, 1800));
  const d = await dash.evaluate(contrast);
  await dash.close();
  const game = await h.context.newPage();
  await game.goto("https://www.gog.com/en/game/alpha_game");
  await game.waitForSelector("#gog-plus-gamepanel", { timeout: 8000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1000));
  const gp = await game.evaluate(`(${contrast.toString()})()`).then((r) => r, () => ({ measured: 0, bad: [] }));
  await game.close();
  const lowO = o.bad.filter((b) => b.ratio < 3).length;
  summary.push([theme, o, d, gp]);
  const worst = (r) => r.bad.slice().sort((a, b) => a.ratio - b.ratio).slice(0, 3).map((b) => `${b.ratio}:${b.text}`).join(" | ");
  if (process.env.A11Y_DETAIL && ["neon", "light"].includes(theme)) { const grp = {}; for (const [src, r] of [["options", o], ["dashboard", d], ["panelpage", gp]]) for (const b of r.bad) { const k = `${src} ${b.el}`; (grp[k] = grp[k] || []).push(b); } for (const [k, v] of Object.entries(grp).sort((a, b) => Math.min(...a[1].map((x) => x.ratio)) - Math.min(...b[1].map((x) => x.ratio))).slice(0, 14)) console.log(`      [${theme}] ${k}  x${v.length}  worst ${Math.min(...v.map((x) => x.ratio))}  e.g. "${v[0].text}" fg ${v[0].fg} on ${v[0].bg}`); }
  console.log(`  ${theme.padEnd(13)} options ${o.bad.length}/${o.measured} under AA · dashboard ${d.bad.length}/${d.measured} · panel page ${gp.bad.length}/${gp.measured}${o.bad.length ? `  (worst ${worst(o)})` : ""}`);
}
const hc = summary.find(([t]) => t === "highcontrast");
check("the High contrast theme passes AA for everything it shows (options, dashboard)", hc[1].bad.length === 0 && hc[2].bad.length === 0, JSON.stringify([hc[1].bad.slice(0, 3), hc[2].bad.slice(0, 3)]));
const worstRatio = Math.min(...summary.flatMap(([, o, d]) => [...o.bad, ...d.bad].map((b) => b.ratio)), 21);
check(`no theme has text below 2:1 anywhere on the options page or dashboard (worst ${worstRatio})`, worstRatio >= 2, String(worstRatio));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await h.cleanup();
process.exit(failed ? 1 : 0);
