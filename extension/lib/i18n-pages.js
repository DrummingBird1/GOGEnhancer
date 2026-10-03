/**
 * GOG+ page translator — the second half of the extension's own-UI translations.
 *
 * `lib/i18n.js` translates what carries a `data-i18n` key (the popup). The tag
 * dashboard and the options page are mostly built from plain English markup and
 * from code that writes English into the DOM, so keying every string would mean
 * touching hundreds of lines — and every future string. This module translates
 * by the *English text itself*: a row says what the English reads, and what it
 * reads in the other six languages.
 *
 *   ["Reset everything", "אפס הכול", "Сбросить всё", "Zresetuj wszystko", "Alles zurücksetzen", "Tout réinitialiser", "Restablecer todo"]
 *
 * Rows live in `lib/i18n-pages-*.js`, which register themselves with `add()`.
 *
 * Placeholders in the English of a row:
 *   {n}   a number                         "{n} games"
 *   {}    any text (translated itself)     "Mark as {}"
 * and in the translations they come back by position: {1}, {2}…  Russian and
 * Polish need three plural forms, so `{1#игра|игры|игр}` picks by the number
 * captured as {1} (two forms — one|other — for the other languages).
 *
 * A sentence with highlighted words inside it (`Fetched live from <strong>x</strong>
 * every 12 hours`) is one row, with the highlighted element written as <1>…</1>
 * (<2>…</2> for the second) — that way the translation may put the words in any order.
 *
 * `apply(root, lang)` rewrites the text nodes, those sentences, and the title /
 * placeholder / aria-label / alt attributes under `root`, then keeps watching the
 * page, so what it draws later (the dashboard re-renders constantly) is translated
 * as it appears. The English is remembered per node, so switching language — or
 * back to English — starts from the original, never from a translation.
 *
 * Opt a subtree out with `translate="no"` or `data-no-i18n` — user content (tag
 * names, notes, game titles) and the language names in the language picker.
 *
 * A string with no row simply stays English. `tests/i18n-pages.test.js` fails
 * when a string in the pages' static markup has no row.
 */
// @ts-check

(() => {
  "use strict";

  /** The order of the translations inside a row, after the English. */
  const ORDER = ["he", "ru", "pl", "de", "fr", "es"];
  const ATTRS = ["title", "placeholder", "aria-label", "alt"];
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "KBD", "SVG", "NOSCRIPT"]);
  const INLINE_TAGS = new Set(["STRONG", "EM", "B", "I", "SPAN", "A", "CODE", "KBD", "TIME", "SMALL", "MARK", "U", "LABEL"]);

  /** @type {Record<string, Map<string, string>>} */
  const exact = {};
  /** @type {Record<string, { re: RegExp, fmt: string, weight: number }[]>} */
  const patterns = {};
  /** @type {string[][]} */
  const allRows = [];
  for (const l of ORDER) {
    exact[l] = new Map();
    patterns[l] = [];
  }

  /** @param {string} s */
  const norm = (s) => String(s).replace(/\s+/g, " ").trim();
  /** @param {string} s */
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  /**
   * Registers rows: `[english, he, ru, pl, de, fr, es]`.
   * @param {string[][]} rows
   */
  function add(rows) {
    for (const row of rows) {
      allRows.push(row);
      const english = norm(row[0]);
      const hasSlots = /\{n\}|\{\}/.test(english);
      ORDER.forEach((lang, i) => {
        const translated = row[i + 1];
        if (typeof translated !== "string" || !translated) return;
        if (!hasSlots) {
          exact[lang].set(english, translated);
          return;
        }
        const literal = english.replace(/\{n\}|\{\}/g, "");
        const source = english
          .split(/(\{n\}|\{\})/)
          .map((part) => (part === "{n}" ? "(\\d[\\d.,]*)" : part === "{}" ? "(.*?)" : escapeRe(part)))
          .join("");
        patterns[lang].push({ re: new RegExp(`^${source}$`), fmt: translated, weight: literal.length });
        patterns[lang].sort((a, b) => b.weight - a.weight); // the most specific wording first
      });
    }
  }

  /**
   * Which plural form a count takes in `lang`. Russian and Polish have three.
   * @param {number} n @param {string} lang
   */
  function pluralIndex(n, lang) {
    if (lang === "ru") {
      const m10 = n % 10;
      const m100 = n % 100;
      if (m10 === 1 && m100 !== 11) return 0;
      if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 1;
      return 2;
    }
    if (lang === "pl") {
      if (n === 1) return 0;
      const m10 = n % 10;
      const m100 = n % 100;
      if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 1;
      return 2;
    }
    return n === 1 ? 0 : 1;
  }

  /**
   * Fills a translation's {1} / {1#one|few|many} slots from the captured values.
   * @param {string} fmt @param {string[]} caps @param {string} lang
   * @param {(s: string) => string} sub how a captured piece of text is shown
   */
  function fill(fmt, caps, lang, sub) {
    return fmt.replace(/\{(\d+)(?:#([^}]*))?\}/g, (_, i, forms) => {
      const raw = caps[Number(i) - 1] ?? "";
      if (forms === undefined) return sub(raw);
      const list = forms.split("|");
      const n = Number(String(raw).replace(/[,\s]/g, ""));
      return list[Math.min(pluralIndex(Number.isFinite(n) ? n : 0, lang), list.length - 1)];
    });
  }

  /**
   * The translation of a piece of English text, or null when there isn't one.
   * Leading/trailing whitespace is kept as it was.
   * @param {string} text @param {string} lang
   * @returns {string | null}
   */
  function translate(text, lang) {
    if (!exact[lang]) return null;
    const n = norm(text);
    if (!n || !/[A-Za-z]/.test(n)) return null;
    let out = exact[lang].get(n) ?? null;
    if (out === null) {
      for (const { re, fmt } of patterns[lang]) {
        const m = n.match(re);
        if (m) {
          out = fill(fmt, m.slice(1), lang, (s) => translate(s, lang) ?? s);
          break;
        }
      }
    }
    if (out === null) return null;
    const lead = /^\s*/.exec(text)?.[0] ?? "";
    const trail = /\s*$/.exec(text)?.[0] ?? "";
    return lead + out + trail;
  }

  /**
   * English → the current page language, for strings JS shows outside the DOM
   * (confirm / alert / prompt). Falls back to the English.
   * @param {string} english @param {string} [lang]
   * @returns {string}
   */
  function tx(english, lang) {
    return translate(english, lang || document.documentElement.getAttribute("lang") || "en") ?? english;
  }

  /** @param {string} text @param {string} [lang] */
  function covers(text, lang = "he") {
    return translate(text, lang) !== null;
  }

  // --- the DOM walk -----------------------------------------------------------

  /** Text node → what it said before we translated it, and what we put there. @type {WeakMap<Node, { orig: string, shown: string }>} */
  const textOrig = new WeakMap();
  /** Element → the same, per attribute. @type {WeakMap<Element, Record<string, { orig: string, shown: string }>>} */
  const attrOrig = new WeakMap();
  /**
   * A translated sentence-with-highlights: the nodes it had, the text each
   * highlight had, and the nodes we replaced them with.
   * @type {WeakMap<Element, { lang: string, orig: Node[], inlineText: Map<Element, string>, shown: Node[], shownText: string[] }>}
   */
  const mixedRec = new WeakMap();

  /** @param {Element} el */
  const optedOut = (el) => SKIP_TAGS.has(el.tagName.toUpperCase()) || el.getAttribute("translate") === "no" || el.hasAttribute("data-no-i18n");

  /** True when `node` or any ancestor is opted out. @param {Node} node */
  function skipped(node) {
    for (let el = node.nodeType === 1 ? /** @type {Element} */ (node) : node.parentElement; el; el = el.parentElement) {
      if (optedOut(el)) return true;
    }
    return false;
  }

  /**
   * @param {Text} node @param {string} lang
   */
  function applyText(node, lang) {
    const rec = textOrig.get(node);
    const base = rec && node.nodeValue === rec.shown ? rec.orig : node.nodeValue ?? "";
    const next = lang === "en" ? null : translate(base, lang);
    if (next === null) {
      if (rec && node.nodeValue === rec.shown && rec.orig !== rec.shown) node.nodeValue = rec.orig;
      textOrig.delete(node);
      return;
    }
    if (node.nodeValue !== next) node.nodeValue = next;
    textOrig.set(node, { orig: base, shown: next });
  }

  /**
   * @param {Element} el @param {string} lang
   */
  function applyAttrs(el, lang) {
    for (const attr of ATTRS) {
      if (!el.hasAttribute(attr)) continue;
      const recs = attrOrig.get(el) || {};
      const rec = recs[attr];
      const cur = el.getAttribute(attr) ?? "";
      const base = rec && cur === rec.shown ? rec.orig : cur;
      const next = lang === "en" ? null : translate(base, lang);
      if (next === null) {
        if (rec && cur === rec.shown && rec.orig !== rec.shown) el.setAttribute(attr, rec.orig);
        delete recs[attr];
      } else {
        if (cur !== next) el.setAttribute(attr, next);
        recs[attr] = { orig: base, shown: next };
      }
      attrOrig.set(el, recs);
    }
  }

  /**
   * A sentence with highlighted words: the element's text with each highlight
   * written as <1>…</1>, or null when `el` isn't that shape.
   * @param {Element} el
   * @returns {{ key: string, inlines: Element[] } | null}
   */
  function mixedOf(el) {
    /** @type {Element[]} */
    const inlines = [];
    let hasText = false;
    let key = "";
    for (const c of el.childNodes) {
      if (c.nodeType === 3) {
        const v = c.nodeValue ?? "";
        if (/[A-Za-z]/.test(v)) hasText = true;
        key += v;
      } else if (c.nodeType === 1) {
        const e = /** @type {Element} */ (c);
        if (!INLINE_TAGS.has(e.tagName.toUpperCase()) || e.children.length) return null; // <kbd>/<code> stay as they are, in place
        inlines.push(e);
        key += `<${inlines.length}>${e.textContent}</${inlines.length}>`;
      } else if (c.nodeType !== 8) return null;
    }
    return hasText && inlines.length ? { key: norm(key), inlines } : null;
  }

  /** Puts a translated sentence back to what the page wrote. @param {Element} el */
  function restoreMixed(el) {
    const rec = mixedRec.get(el);
    mixedRec.delete(el);
    if (!rec) return;
    const same = el.childNodes.length === rec.shown.length && rec.shown.every((n, i) => n === el.childNodes[i] && (n.nodeType !== 3 || n.nodeValue === rec.shownText[i]));
    if (!same) return; // the page has redrawn it since — what's there is the page's own
    el.replaceChildren(...rec.orig);
    for (const [inline, text] of rec.inlineText) inline.textContent = text;
  }

  /**
   * @param {Element} el @param {string} lang
   * @returns {boolean} true when the element was handled as one sentence
   */
  function applyMixed(el, lang) {
    const rec = mixedRec.get(el);
    if (rec) {
      const same = el.childNodes.length === rec.shown.length && rec.shown.every((n, i) => n === el.childNodes[i] && (n.nodeType !== 3 || n.nodeValue === rec.shownText[i]));
      if (same && rec.lang === lang) return true; // already in this language, untouched
      if (same) restoreMixed(el); // another language: go back to the English first
      else mixedRec.delete(el);
    }
    if (lang === "en") return false;
    const m = mixedOf(el);
    if (!m) return false;
    const n = m.key;
    const found = exact[lang]?.get(n) !== undefined
      ? { fmt: /** @type {string} */ (exact[lang].get(n)), caps: /** @type {string[]} */ ([]) }
      : (() => {
          for (const p of patterns[lang]) {
            const hit = n.match(p.re);
            if (hit) return { fmt: p.fmt, caps: hit.slice(1) };
          }
          return null;
        })();
    if (!found) return false;

    const orig = [...el.childNodes];
    /** @type {Map<Element, string>} */
    const inlineText = new Map(m.inlines.map((e) => [e, e.textContent ?? ""]));
    /** @type {Node[]} */
    const shown = [];
    /** @type {string[]} */
    const shownText = [];
    const tr = (/** @type {string} */ s) => translate(s, lang) ?? s;
    for (const part of found.fmt.split(/(<\d+>[\s\S]*?<\/\d+>)/)) {
      if (!part) continue;
      const tag = /^<(\d+)>([\s\S]*?)<\/\d+>$/.exec(part);
      if (tag) {
        const inline = m.inlines[Number(tag[1]) - 1];
        if (!inline) continue;
        inline.textContent = fill(tag[2], found.caps, lang, tr);
        shown.push(inline);
        shownText.push("");
      } else {
        const text = document.createTextNode(fill(part, found.caps, lang, tr));
        shown.push(text);
        shownText.push(text.nodeValue ?? "");
      }
    }
    el.replaceChildren(...shown);
    mixedRec.set(el, { lang, orig, inlineText, shown, shownText });
    return true;
  }

  /** @param {Element} el @param {string} lang */
  function walkChildren(el, lang) {
    if (applyMixed(el, lang)) return;
    for (let c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) applyText(/** @type {Text} */ (c), lang);
      else if (c.nodeType === 1 && !optedOut(/** @type {Element} */ (c))) {
        applyAttrs(/** @type {Element} */ (c), lang);
        walkChildren(/** @type {Element} */ (c), lang);
      }
    }
  }

  /**
   * @param {Node} root @param {string} lang
   */
  function walk(root, lang) {
    if (root.nodeType === 3) {
      const parent = root.parentElement;
      if (parent && !skipped(parent)) walkChildren(parent, lang);
      return;
    }
    if (root.nodeType !== 1 || skipped(root)) return;
    const el = /** @type {Element} */ (root);
    applyAttrs(el, lang);
    walkChildren(el, lang);
  }

  /**
   * Every piece of English under `root` that the translator would look up — the
   * keys a row has to have. Used by the coverage test and by e2e/collect-strings.mjs.
   * @param {Node} root
   * @returns {string[]}
   */
  function strings(root) {
    /** @type {Set<string>} */
    const out = new Set();
    /** @param {Element} el */
    const visit = (el) => {
      if (optedOut(el)) return;
      for (const attr of ATTRS) {
        const v = el.getAttribute(attr);
        if (v && /[A-Za-z]/.test(v)) out.add(norm(v));
      }
      const m = mixedOf(el);
      if (m) {
        out.add(m.key);
        return;
      }
      for (const c of el.childNodes) {
        if (c.nodeType === 3) {
          const t = norm(c.nodeValue ?? "");
          if (t && /[A-Za-z]/.test(t)) out.add(t);
        } else if (c.nodeType === 1) visit(/** @type {Element} */ (c));
      }
    };
    if (root.nodeType === 1) visit(/** @type {Element} */ (root));
    return [...out];
  }

  // --- keeping up with a page that keeps drawing ------------------------------

  /** @type {MutationObserver | null} */
  let observer = null;
  /** @type {Set<Node>} */
  let pending = new Set();
  let scheduled = false;
  let currentLang = "en";

  function flush() {
    scheduled = false;
    const nodes = [...pending];
    pending = new Set();
    for (const n of nodes) if (n.isConnected) walk(n, currentLang);
  }

  /** @param {MutationRecord[]} records */
  function onMutations(records) {
    for (const r of records) {
      if (r.type === "attributes") pending.add(r.target);
      else for (const n of r.addedNodes) pending.add(n);
    }
    if (pending.size && !scheduled) {
      scheduled = true;
      setTimeout(flush, 0);
    }
  }

  /**
   * Translates everything under `root` to `lang` and keeps translating what the
   * page adds afterwards. `en` puts the original text back.
   * @param {Node} [root] @param {string} [lang]
   */
  function apply(root, lang) {
    const target = root || document.body;
    currentLang = lang && exact[lang] ? lang : "en";
    observer?.disconnect();
    observer = null;
    if (!target) return;
    walk(target, currentLang);
    if (currentLang !== "en" && typeof MutationObserver !== "undefined") {
      observer = new MutationObserver(onMutations);
      observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ATTRS });
    }
  }

  const Api = { ORDER, add, translate, tx, covers, apply, strings, rows: () => allRows, pluralIndex };
  /** @type {any} */ (window).GOGPlusPageI18n = Api;
})();
