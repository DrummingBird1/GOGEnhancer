# Chrome Web Store — Listing Copy

This file contains every piece of text you'll be asked to paste into the
Chrome Web Store Developer Dashboard when submitting **GOG Enhancer**.
Copy each block as-is.

---

## Single-purpose statement

> GOG Enhancer's single purpose is to enhance the user experience on the GOG.com storefront — by adding currency conversion, price history, personal tagging, Hebrew translation, and small visual improvements to that one site.

(One sentence. Chrome Web Store reviewers care about this matching what the
extension actually does. Don't add features outside of this scope without
updating this statement first.)

---

## Category

**Shopping** (primary). Secondary if the form allows: *Productivity*.

---

## Short description (under 132 chars)

Already in `manifest.json` as the `description` field. Identical to:

> תוסף third-party (לא רשמי) ל-GOG.com: המרת מטבע חיה, מעקב היסטוריית מחירים, תגיות, עברית + RTL.

If you want an English version for the English locale:

> Unofficial GOG.com helper: live currency conversion, price-history tracking, personal tags, Hebrew + RTL.

---

## Detailed description (English)

```
GOG Enhancer is an unofficial third-party browser extension that adds the
features GOG.com does not ship with — without any analytics, ads, or remote
code.

▸ Live currency conversion
  Converts USD prices to ILS, EUR, GBP, PLN, or RUB using exchange rates
  fetched from frankfurter.app (a free, public, ECB-backed rate service).
  Detects the page's existing currency so it never double-converts.

▸ Price-history tracking
  Records a small price snapshot every time you visit a game page.
  Shows current vs. all-time-low vs. average on a sparkline you can review
  any time. Fully local — no server.

▸ IsThereAnyDeal compare button
  One click on a game page opens an IsThereAnyDeal search for the same
  title across Steam, Epic, Humble, and other stores.

▸ Personal tags & notes
  Add private tags ("co-op weekend", "after I finish Witcher 3") and notes
  to any game. A separate dashboard page lets you search, filter, and
  export to CSV.

▸ Hebrew translations + RTL
  Optional Hebrew dictionary covering navigation, UI strings, and common
  patterns. Real RTL with logical-property CSS — not a flipped page.

▸ Wishlist sale alerts
  When you visit your wishlist, a small badge appears on the toolbar icon
  with the count of items currently on sale.

▸ Visual upgrade (optional)
  System-font monospace numerals for prices, era-aware accents on classic
  vs. modern game covers, gold pill on "Good Old Game" markers.

▸ Privacy-first
  No analytics, no third-party tracking, no Google Fonts, no remote code.
  All your tags, notes, and history stay on your device. Two outbound
  requests only: exchange rates from frankfurter.app and the public GOG
  mods catalog. Both omit cookies and identifying information.

▸ Open source under the MIT license. Verifiable end-to-end.

DISCLAIMER: This is an unofficial third-party tool. It is not affiliated
with, endorsed by, or sponsored by GOG sp. z o.o. or CD Projekt S.A.
The "GOG" name is used nominatively to describe the website the extension
works with.

Privacy policy: [insert URL after publishing PRIVACY.md to GitHub Pages or similar]
Source code:    [insert GitHub URL after publishing]
```

---

## Detailed description (עברית)

```
GOG Enhancer הוא תוסף third-party (לא רשמי) שמוסיף ל-GOG.com את הפיצ'רים
שהאתר לא מציע מהקופסה — בלי analytics, בלי פרסומות, בלי קוד מרוחק.

▸ המרת מטבע חיה
  ממיר מחירי USD לשקלים / יורו / לירה / זלוטי / רובל. שערים נמשכים
  אוטומטית מ-frankfurter.app (שירות חינמי מבוסס הבנק המרכזי האירופי).
  מזהה אם GOG כבר מציג במטבע מקומי ולא ממיר פעמיים.

▸ מעקב היסטוריית מחירים
  כל ביקור בעמוד משחק מתעד תמונת-מצב של המחיר. גרף sparkline מציג
  current vs. all-time-low vs. ממוצע. הכל מקומי — שום שרת.

▸ כפתור השוואה ב-IsThereAnyDeal
  לחיצה אחת בעמוד משחק פותחת חיפוש ITAD שמחפש את אותו משחק ב-Steam,
  Epic, Humble ועוד.

▸ תגיות והערות אישיות
  הוסף תגיות ("co-op סוף שבוע", "אחרי שאסיים Witcher") והערות לכל משחק.
  לוח תגיות נפרד עם חיפוש, סינון, וייצוא CSV.

▸ עברית + RTL מלא
  מילון עברית רחב, RTL אמיתי עם logical-properties CSS (לא דף הפוך).

▸ התראות מבצעי wishlist
  ביקור ב-wishlist מעדכן badge על אייקון ההרחבה עם מספר הפריטים במבצע.

▸ שדרוג עיצוב (אופציונלי)
  גופן monospace למחירים, accents שונים לקלאסיקות מול משחקים מודרניים,
  pill זהב על "Good Old Game".

▸ פרטיות לפני הכל
  שום analytics, שום tracking, שום Google Fonts, שום קוד מרוחק. תגיות,
  הערות, היסטוריה — הכל נשאר אצלך. שתי בקשות חיצוניות בלבד: שערי מטבע
  מ-frankfurter.app וקטלוג mods פומבי של GOG. שתיהן בלי cookies.

▸ Open source ברישיון MIT. ניתן לאימות.

הערה משפטית: זהו תוסף third-party לא רשמי. אין קשר, חסות או אישור מצד
GOG sp. z o.o. או CD Projekt S.A. השם "GOG" משמש כאן באופן תיאורי בלבד.
```

---

## Permission justifications

The Chrome Web Store form asks for a justification per permission. Use these
exact answers:

### `storage`
> Used to save user preferences (which features are enabled, target currency, VAT rate) in chrome.storage.sync, and personal data (tags, notes, price history) in chrome.storage.local. Nothing is transmitted off-device.

### `activeTab`
> Used by the popup's "Reload tab" button so the user can refresh the GOG.com page they are currently viewing after toggling features.

### `alarms`
> Used to schedule periodic background refreshes: exchange rates every 12 hours from frankfurter.app, and the public GOG mods catalog every 24 hours.

### Host permission: `https://www.gog.com/*`
> Required to run the content script that adds currency conversion, badges, tags UI, and Hebrew translations on GOG.com pages, and to fetch the public /en/mods catalog page in the background. This extension is single-purpose for GOG.com and does not interact with other domains in the user's browser.

### Host permission: `https://api.frankfurter.app/*`
> Required to fetch USD-to-target-currency exchange rates from the Frankfurter public API. This is the sole external service the extension talks to. No user data is sent — only a public GET request for rates.

---

## Privacy practices certification

The form will ask several yes/no questions. Correct answers for this
extension:

- "Does this item collect or use any of the following user data?" — Answer:
  - **Personally identifiable information:** No
  - **Health information:** No
  - **Financial and payment information:** No
  - **Authentication information:** No
  - **Personal communications:** No
  - **Location:** No
  - **Web history:** No
  - **User activity:** No
  - **Website content:** No (we read public game-page text on the user's behalf, but we don't collect or transmit it)

- "I do not sell or transfer user data to third parties..." — **Yes, I certify**
- "I do not use or transfer user data for purposes that are unrelated..." — **Yes, I certify**
- "I do not use or transfer user data to determine creditworthiness..." — **Yes, I certify**

---

## Screenshots — what to capture

Required: at least **one** screenshot at 1280×800 or 640×400. Recommended: 4–5.
Capture them all in a clean Chrome window with no other extensions visible.

1. **`01-currency-banner.png` (1280×800)** — Open the GOG.com homepage with the extension active. Frame the DRM-free banner at the top + the first row of game cards with the green "30-DAY REFUND" badges visible. This is your hero shot.

2. **`02-game-page-panel.png` (1280×800)** — Open any game page (e.g. Cyberpunk 2077 or Heroes of Might and Magic 3). Frame the GOG Enhancer "insights" panel that shows current/all-time-low/average + the sparkline + ITAD compare button.

3. **`03-tag-dashboard.png` (1280×800)** — Open the tag dashboard from the popup. Capture the search box + tag pills on the left + game cards on the right. Have at least 3-4 tagged games to make the demo look real.

4. **`04-popup-settings.png` (1280×800)** — Click the toolbar icon. Frame the popup with the master toggle, currency dropdown, and the rate-strip showing "1 USD = 3.65 ILS · 2h ago".

5. **`05-hebrew-rtl.png` (1280×800)** — Same homepage with Hebrew translations + RTL layout enabled. This is the differentiator for the Israeli market.

### Promo tile (optional but strongly recommended)

- **`promo-440x280.png`** — A simple promo tile. Suggested layout: dark background (#0a0612), the "GOG Enhancer" wordmark in the magenta/cyan color scheme on the left, and a small product preview (a single converted game card) on the right.

---

## Pre-submission checklist

Before clicking "Submit for review", verify:

- [ ] Privacy policy is hosted at a publicly reachable URL (GitHub Pages works). Paste that URL into the Privacy section of the dashboard.
- [ ] All five permission justifications above are pasted into the form.
- [ ] At least one 1280×800 screenshot is uploaded.
- [ ] The Single-purpose statement above is pasted in the Distribution tab.
- [ ] The detailed description matches what you actually shipped (don't promise features not in the build).
- [ ] You have tested the extension in real Chrome on at least: GOG homepage, game page, wishlist, options page, tag dashboard, onboarding wizard.
- [ ] You have visited /account/wishlist at least once after install so the badge has data to show.

Reviews typically take 1–7 days. Plan accordingly.
