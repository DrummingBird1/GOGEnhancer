/**
 * GOG+ UI translations for the extension's own pages (popup, options,
 * onboarding, tag dashboard). Not for gog.com content — that lives in
 * content/translations.js.
 *
 * Usage in HTML:
 *   <h2 data-i18n="popup.section.currency">Currency &amp; pricing</h2>
 *   <input data-i18n-attr="placeholder:search.placeholder" />
 *
 * Usage in JS (after defaults.js + this file):
 *   window.GOGPlusI18n.apply("he");   // or "en"
 *   const t = window.GOGPlusI18n.t("popup.title");
 *
 * Adding a language: copy the `en` block, translate the values, and add
 * the new entry to `LANGUAGES`. No code changes elsewhere.
 */

(() => {
  "use strict";

  const LANGUAGES = {
    en: "English",
    he: "עברית",
  };

  const STRINGS = {
    en: {
      // popup
      "popup.subtitle": "Enhanced",
      "popup.rate.bundled": "Using bundled rates · click ↻ to refresh",
      "popup.section.currency": "Currency & pricing",
      "popup.section.onpage": "On-page enhancements",
      "popup.section.visual": "Visual upgrade",
      "popup.section.library": "Library & account",
      "popup.section.localization": "Localization",
      "popup.row.targetCurrency": "Display alongside USD",
      "popup.row.vatToggle": "Estimate VAT / sales tax",
      "popup.row.vatToggle.sub": "Adds tax-inclusive price next to USD.",
      "popup.row.vatPercent": "VAT %",
      "popup.row.refresh": "↻ rates",
      "popup.row.refundBadge": '"30-day refund" badge',
      "popup.row.refundBadge.sub": "Reminder on every game card.",
      "popup.row.drmBanner": "DRM-free top banner",
      "popup.row.drmBanner.sub": "Surfaces GOG's core promise.",
      "popup.row.modIndicator": "Mod indicator on cards",
      "popup.row.modIndicator.sub": "★ MOD badge for moddable titles.",
      "popup.row.hideExpired": "Hide expired sales",
      "popup.row.hideExpired.sub": "Greys out promos with stale year stamps.",
      "popup.row.cleanLayout": "Cleaner homepage layout",
      "popup.row.cleanLayout.sub": "Collapses duplicate sale strips.",
      "popup.row.skeleton": "Skeleton loaders",
      "popup.row.skeleton.sub": "Replace bare placeholders with shimmer.",
      "popup.row.design": "Design injection",
      "popup.row.design.sub": 'Mono prices, era-aware cards, depth, golden "Good Old Game" pill.',
      "popup.row.richTooltips": "Rich tooltips",
      "popup.row.richTooltips.sub": "Custom-styled hover tips with details.",
      "popup.row.tags": "Custom tags & notes",
      "popup.row.tags.sub": "Plus autocomplete & dashboard.",
      "popup.row.wlFilters": "Wishlist quick filters",
      "popup.row.wlFilters.sub": "By sale, price, rating.",
      "popup.row.wlAlerts": "Wishlist sale alerts",
      "popup.row.wlAlerts.sub": "Toolbar badge counts wishlist deals.",
      "popup.row.priceHistory": "Price history tracking",
      "popup.row.priceHistory.sub": "Records prices on every visit.",
      "popup.row.lowestBadge": "Lowest-price badge",
      "popup.row.lowestBadge.sub": "💎 marks cards at their tracked all-time low.",
      "popup.row.refundTimer": "Refund window timer",
      "popup.row.refundTimer.sub": "Manual purchase-date countdown on game pages.",
      "popup.row.itad": "Compare on IsThereAnyDeal",
      "popup.row.itad.sub": "One-click cross-store price check.",
      "popup.row.hebrew": "Hebrew translation overlay",
      "popup.row.hebrew.sub": "Translates stable nav & UI strings.",
      "popup.row.rtl": "RTL layout",
      "popup.row.rtl.sub": "Mirrors layout for right-to-left.",
      "popup.btn.tags": "Tag dashboard",
      "popup.btn.advanced": "Advanced",
      "popup.btn.reload": "Reload tab",
      "popup.shortcuts": "Shortcuts:",
      "popup.shortcuts.open": "open",
      "popup.shortcuts.toggle": "toggle",
      "popup.support": "☕ Support this project",

      // options
      "options.hero.title": "Advanced settings",
      "options.hero.sub": "Fine-tune behavior, manage your data, and tweak what GOG Enhancer injects.",
      "options.section.language": "Language",
      "options.section.language.sub": "Switch the extension UI language. Doesn't affect GOG.com itself (that's controlled by the Hebrew translations toggle in the popup).",

      // common
      "language.label": "Interface language",
    },
    he: {
      // popup
      "popup.subtitle": "מועצם",
      "popup.rate.bundled": "משתמש בשערים מובנים · לחץ ↻ לרענון",
      "popup.section.currency": "מטבע ותמחור",
      "popup.section.onpage": "שדרוגי עמוד",
      "popup.section.visual": "שדרוג עיצובי",
      "popup.section.library": "ספרייה וחשבון",
      "popup.section.localization": "שפה ומיקום",
      "popup.row.targetCurrency": "להציג ליד USD",
      "popup.row.vatToggle": "אומדן מע״מ / מס",
      "popup.row.vatToggle.sub": "מוסיף מחיר כולל מס ליד USD.",
      "popup.row.vatPercent": "מע״מ %",
      "popup.row.refresh": "↻ שערים",
      "popup.row.refundBadge": 'תג "החזר 30 ימים"',
      "popup.row.refundBadge.sub": "תזכורת על כל כרטיס משחק.",
      "popup.row.drmBanner": "באנר DRM-free עליון",
      "popup.row.drmBanner.sub": "מבליט את ההבטחה המרכזית של GOG.",
      "popup.row.modIndicator": "אינדיקטור Mods על כרטיסים",
      "popup.row.modIndicator.sub": "תג ★ MOD למשחקים תומכי-mods.",
      "popup.row.hideExpired": "הסתר מבצעים שפג תוקפם",
      "popup.row.hideExpired.sub": "מאפיל קידומים עם שנה ישנה.",
      "popup.row.cleanLayout": "פריסת בית נקייה יותר",
      "popup.row.cleanLayout.sub": "מקפל רצועות מבצע כפולות.",
      "popup.row.skeleton": "Skeleton loaders",
      "popup.row.skeleton.sub": "מחליף placeholders ריקים בshimmer.",
      "popup.row.design": "הזרקת עיצוב",
      "popup.row.design.sub": 'מחירים mono, כרטיסים מודעי-עידן, עומק, pill זהב ל"Good Old Game".',
      "popup.row.richTooltips": "Tooltips עשירים",
      "popup.row.richTooltips.sub": "טיפים מעוצבים עם פרטים.",
      "popup.row.tags": "תגיות והערות אישיות",
      "popup.row.tags.sub": "עם autocomplete ולוח-בקרה.",
      "popup.row.wlFilters": "סינונים מהירים ל-wishlist",
      "popup.row.wlFilters.sub": "לפי מבצע, מחיר, דירוג.",
      "popup.row.wlAlerts": "התראות מבצעי wishlist",
      "popup.row.wlAlerts.sub": "Badge בסרגל סופר עסקאות.",
      "popup.row.priceHistory": "מעקב היסטוריית מחירים",
      "popup.row.priceHistory.sub": "מתעד מחירים בכל ביקור.",
      "popup.row.lowestBadge": "תג מחיר נמוך",
      "popup.row.lowestBadge.sub": "💎 מסמן משחקים בשפל המחיר שנרשם.",
      "popup.row.refundTimer": "Timer חלון החזר",
      "popup.row.refundTimer.sub": "ספירה לאחור ידנית מתאריך רכישה.",
      "popup.row.itad": "השוואה ב-IsThereAnyDeal",
      "popup.row.itad.sub": "בדיקת מחיר חוצת-חנויות בלחיצה.",
      "popup.row.hebrew": "תרגום עברית לאתר",
      "popup.row.hebrew.sub": "מתרגם מחרוזות ניווט יציבות.",
      "popup.row.rtl": "פריסת RTL",
      "popup.row.rtl.sub": "משקף את הפריסה לימין-לשמאל.",
      "popup.btn.tags": "לוח תגיות",
      "popup.btn.advanced": "מתקדם",
      "popup.btn.reload": "טען לשונית מחדש",
      "popup.shortcuts": "קיצורים:",
      "popup.shortcuts.open": "פתח",
      "popup.shortcuts.toggle": "החלף",
      "popup.support": "☕ תמכו בפרויקט",

      // options
      "options.hero.title": "הגדרות מתקדמות",
      "options.hero.sub": "כיוון התנהגות, ניהול הdata שלך, ושינוי מה ש-GOG Enhancer מזריק.",
      "options.section.language": "שפה",
      "options.section.language.sub": "החלף את שפת ה-UI של ההרחבה. לא משפיע על GOG.com עצמו (שם השליטה היא בtoggle של תרגום עברית בפופאפ).",

      // common
      "language.label": "שפת ממשק",
    },
  };

  const Api = {
    LANGUAGES,
    /** Translate a key in the given language (or current document language). */
    t(key, lang) {
      const dict = STRINGS[lang] || STRINGS[document.documentElement.getAttribute("lang") || "en"] || STRINGS.en;
      return dict[key] ?? STRINGS.en[key] ?? key;
    },
    /**
     * Walk the document and replace text in [data-i18n] elements, and attributes
     * in [data-i18n-attr="attribute:key"] elements. Sets <html lang> + dir.
     */
    apply(lang) {
      if (!STRINGS[lang]) lang = "en";
      document.documentElement.setAttribute("lang", lang);
      if (lang === "he") document.documentElement.setAttribute("dir", "rtl");
      else document.documentElement.setAttribute("dir", "ltr");

      document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        const v = Api.t(key, lang);
        if (v != null) el.textContent = v;
      });
      document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
        const spec = el.getAttribute("data-i18n-attr") || "";
        for (const pair of spec.split(",")) {
          const [attr, key] = pair.trim().split(":");
          if (!attr || !key) continue;
          const v = Api.t(key, lang);
          if (v != null) el.setAttribute(attr, v);
        }
      });
    },
  };

  if (typeof window !== "undefined") window.GOGPlusI18n = Api;
  if (typeof self !== "undefined") self.GOGPlusI18n = Api;
})();
