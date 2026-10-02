/**
 * GOG+ "Native" theme — injected UI that looks like it belongs on whatever
 * gog.com currently looks like.
 *
 * The other themes hard-code a palette, which is exactly what stops matching
 * when the site is redesigned. This one hard-codes nothing: at apply time it
 * reads the page's own computed colours and font (background, text, and the
 * primary call-to-action colour for the accent) and writes them into the
 * --gp-* custom properties the injected UI already uses. A dark site gets the
 * dark base palette for the accessory colours, a light one the light palette.
 *
 * If the page can't be sampled (colours not rgb(), nothing opaque found) it
 * returns null and the caller falls back to the default theme — it never
 * guesses.
 */
// @ts-check

(() => {
  "use strict";

  /** @typedef {{ r: number, g: number, b: number, a: number }} Rgba */

  /**
   * Parses the rgb()/rgba() strings getComputedStyle() returns for sRGB
   * colours. Anything else (oklch(), color(), "transparent" is handled) → null.
   * @param {string | null | undefined} str
   * @returns {Rgba | null}
   */
  function parseColor(str) {
    if (!str) return null;
    if (str === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    const m = str.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
    if (!m) return null;
    let a = 1;
    if (m[4] !== undefined) a = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a };
  }

  /** WCAG relative luminance, 0 (black) – 1 (white). @param {Rgba} c */
  function luminance(c) {
    const ch = [c.r, c.g, c.b].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }

  /** Rough "is this a colour or a grey" test — 0 grey .. 1 vivid. @param {Rgba} c */
  function saturation(c) {
    const max = Math.max(c.r, c.g, c.b);
    const min = Math.min(c.r, c.g, c.b);
    return max === 0 ? 0 : (max - min) / max;
  }

  /** Linear blend of two colours; t=0 → a, t=1 → b. @param {Rgba} a @param {Rgba} b @param {number} t */
  function mix(a, b, t) {
    return {
      r: Math.round(a.r + (b.r - a.r) * t),
      g: Math.round(a.g + (b.g - a.g) * t),
      b: Math.round(a.b + (b.b - a.b) * t),
      a: 1,
    };
  }

  /** @param {Rgba} c @param {number} [alpha] */
  function css(c, alpha = c.a) {
    return alpha >= 1 ? `rgb(${c.r}, ${c.g}, ${c.b})` : `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
  }

  /**
   * @typedef {Object} SiteSample
   * @property {Rgba} bg
   * @property {Rgba} text
   * @property {Rgba | null} accent
   * @property {string} fontFamily
   */

  /**
   * Maps a sample of the site to the --gp-* tokens.
   * @param {SiteSample} s
   * @returns {{ isDark: boolean, vars: Record<string, string> }}
   */
  function deriveTokens(s) {
    const isDark = luminance(s.bg) < 0.4;
    /** @type {Record<string, string>} */
    const vars = {
      "--gp-bg": css(s.bg),
      "--gp-surface": css(mix(s.bg, s.text, 0.07)),
      "--gp-text": css(s.text),
      "--gp-text-dim": css(s.text, 0.65),
      "--gp-text-muted": css(s.text, 0.4),
      "--gp-border": css(s.text, 0.12),
      "--gp-border-strong": css(s.text, 0.25),
    };
    if (s.accent) {
      vars["--gp-magenta"] = css(s.accent);
      vars["--gp-cyan"] = css(mix(s.accent, s.text, 0.35));
    }
    if (s.fontFamily) vars["--gp-body"] = s.fontFamily;
    return { isDark, vars };
  }

  const TOKEN_NAMES = [
    "--gp-bg",
    "--gp-surface",
    "--gp-text",
    "--gp-text-dim",
    "--gp-text-muted",
    "--gp-border",
    "--gp-border-strong",
    "--gp-magenta",
    "--gp-cyan",
    "--gp-body",
  ];

  // The page's primary call-to-action, most specific first. Its fill colour is
  // the closest thing a store has to a brand accent.
  const CTA_SELECTORS = [
    'button[class*="add-to-cart"]',
    'button[class*="AddToCart"]',
    '[class*="buy-button"]',
    '[class*="BuyButton"]',
    'button[class*="primary"]',
    'a[class*="button"][class*="primary"]',
    'button[class*="cart"]',
  ];

  /** @returns {SiteSample | null} */
  function sample() {
    // Background: nearest opaque ancestor of <main>/<body>.
    let bg = null;
    for (let el = document.querySelector("main, [role='main']") || document.body; el; el = el.parentElement) {
      const c = parseColor(getComputedStyle(el).backgroundColor);
      if (c && c.a >= 0.5) {
        bg = c;
        break;
      }
    }
    const bodyStyle = getComputedStyle(document.body);
    const text = parseColor(bodyStyle.color);
    if (!bg || !text) return null;

    /** @type {Rgba | null} */
    let accent = null;
    for (const sel of CTA_SELECTORS) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const cs = getComputedStyle(el);
      for (const raw of [cs.backgroundColor, cs.color]) {
        const c = parseColor(raw);
        if (c && c.a >= 0.5 && saturation(c) > 0.25) {
          accent = c;
          break;
        }
      }
      if (accent) break;
    }
    return { bg, text, accent, fontFamily: bodyStyle.fontFamily || "" };
  }

  /**
   * Writes the sampled tokens onto `el` (normally <html>).
   * @param {HTMLElement} [el]
   * @returns {{ isDark: boolean } | null} null when the page couldn't be sampled
   */
  function apply(el = document.documentElement) {
    const s = sample();
    if (!s) {
      clear(el);
      return null;
    }
    const { isDark, vars } = deriveTokens(s);
    for (const name of TOKEN_NAMES) {
      if (name in vars) el.style.setProperty(name, vars[name]);
      else el.style.removeProperty(name);
    }
    return { isDark };
  }

  /** @param {HTMLElement} [el] */
  function clear(el = document.documentElement) {
    for (const name of TOKEN_NAMES) el.style.removeProperty(name);
  }

  window.GOGPlusNativeTheme = { parseColor, luminance, saturation, mix, deriveTokens, sample, apply, clear };
})();
