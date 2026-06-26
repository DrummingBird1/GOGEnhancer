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
  Converts prices to ILS, EUR, GBP, PLN, USD, or RUB using exchange rates
  fetched from frankfurter.app (a free, public, ECB-backed rate service).
  Works whether GOG shows you USD, EUR, or any other locale — full
  cross-currency conversion via the rate matrix.

▸ Price-history tracking + sale-event markers
  Records a price snapshot every time you visit a game page. The game
  panel shows current vs. all-time-low vs. average on a sparkline with
  hover tooltips for each data point and dashed markers at every 30%+
  price drop. A celebratory banner highlights when the current price
  matches the all-time low. Fully local — no server.

▸ Refund window timer
  Mark when you bought a game and the panel counts down GOG's 30-day
  money-back window for you. Optional desktop notification when 1–2 days
  remain (opt-in).

▸ IsThereAnyDeal compare button
  One click on a game page opens an IsThereAnyDeal search for the same
  title across Steam, Epic, Humble, and other stores.

▸ Personal tags & notes (with rename, merge, colors, drag-to-reorder)
  Add private tags and notes to any game. The dashboard lets you search,
  filter, assign per-tag colors, rename or merge tags, drag pills to
  reorder, and export or import via CSV. Notes support inline markdown
  (bold, italic, links, lists, code).

▸ Library year-in-review
  Annual stats: games tracked, biggest price drop, most-watched title,
  watch advantage (current vs. peak across the library), refund windows
  logged. All computed from your local data.

▸ Hebrew translations + RTL
  Optional Hebrew dictionary covering navigation, UI strings, and common
  patterns. Real RTL with logical-property CSS — not a flipped page.

▸ Wishlist sale alerts + quick filters
  Wishlist-icon badge counts items on sale. Quick filter bar offers
  "On sale", "Under $10/$25", "Rated 4.5+", and dynamic genre chips
  (RPG / Horror / Strategy / Sci-fi / Indie). Optional desktop
  notification when wishlist deals appear (opt-in).

▸ Theme picker + visual upgrade
  Four themes: Neon (default), Classic GOG, CRT Green, Sunset. System-font
  monospace numerals for prices, era-aware accents (CRT scan-lines for
  classics, neon underglow for cyberpunk/witcher, genre-tuned hover
  effects for RPG/Horror/Strategy/Sci-fi/Indie titles), gold pill on
  "Good Old Game" markers, glassmorphism on the game-page panel with a
  blurred hero backdrop pulled from the page's cover art.

▸ Privacy-first
  No analytics, no third-party tracking, no Google Fonts, no remote code.
  All your tags, notes, and history stay on your device. Two outbound
  requests only: exchange rates from frankfurter.app and the public GOG
  mods catalog. Both omit cookies and identifying information. Desktop
  notifications (if you enable them) use the local chrome.notifications
  API — nothing transmitted.

▸ Open source under the MIT license. Verifiable end-to-end.

DISCLAIMER: This is an unofficial third-party tool. It is not affiliated
with, endorsed by, or sponsored by GOG sp. z o.o. or CD Projekt S.A.
The "GOG" name is used nominatively to describe the website the extension
works with.

Privacy policy: https://github.com/DrummingBird1/GOGEnhancer/blob/main/PRIVACY.md
Source code:    https://github.com/DrummingBird1/GOGEnhancer
```

---

## Detailed description (עברית)

```
GOG Enhancer הוא תוסף third-party (לא רשמי) שמוסיף ל-GOG.com את הפיצ'רים
שהאתר לא מציע מהקופסה — בלי analytics, בלי פרסומות, בלי קוד מרוחק.

▸ המרת מטבע חיה (cross-currency מלא)
  ממיר מחירים לשקלים / יורו / לירה / זלוטי / דולר / רובל. שערים נמשכים
  אוטומטית מ-frankfurter.app (שירות חינמי מבוסס הבנק המרכזי האירופי).
  עובד גם כשה-GOG מציג EUR/GBP מקומיים — לא רק USD.

▸ מעקב היסטוריית מחירים + סימוני מבצעים
  כל ביקור בעמוד משחק מתעד snapshot. גרף sparkline עם current /
  all-time-low / ממוצע, hover tooltips על כל נקודה, וסימוני קו על
  ירידות מחיר של 30%+. באנר חוגג מציין כשהמחיר בשפל היסטורי.

▸ Refund window timer
  סמן מתי קנית משחק וה-panel סופר אחורה את ה-30 יום של מדיניות
  ה-refund של GOG. אופציונלית: התראת system כש-1-2 ימים נשארו (opt-in).

▸ כפתור השוואה ב-IsThereAnyDeal
  לחיצה אחת פותחת חיפוש ITAD ב-Steam, Epic, Humble ועוד.

▸ תגיות והערות מתקדמות
  תגיות והערות פרטיות לכל משחק. בלוח התגיות יש חיפוש, סינון, color
  picker לכל תג, rename / merge / delete, drag-to-reorder, ויצוא+יבוא
  CSV. ההערות תומכות ב-markdown (bold, italic, links, lists, code).

▸ Year-in-review לספריה שלך
  סטטיסטיקה שנתית: כמה משחקים נעקבו, ירידת המחיר הגדולה, המשחק
  הכי-נעקב, watch advantage (current מול peak), refund windows שנפתחו.
  הכל מחושב מנתונים מקומיים.

▸ עברית + RTL מלא
  מילון עברית רחב, RTL אמיתי עם logical-properties CSS.

▸ Wishlist — התראות מבצעים + סינונים
  badge על אייקון ההרחבה סופר פריטים במבצע. סרגל סינון: "On sale",
  "Under $10/$25", "Rated 4.5+", וגם chips דינמיים לפי ז'אנר
  (RPG / Horror / Strategy / Sci-fi / Indie). אופציונלי: התראת
  system כשמבצעים חדשים מופיעים (opt-in).

▸ Theme picker + שדרוג עיצוב
  ארבעה themes: Neon (ברירת מחדל), Classic GOG, CRT Green, Sunset.
  גופן monospace למחירים, accents מותאמי-עידן (סקאן-ליינס לקלאסיקות,
  neon לקיברפאנק/וויצ'ר, hover ייעודי לפי ז'אנר), pill זהב על
  "Good Old Game", glassmorphism על ה-game panel עם hero blur מתוך
  ה-cover art של העמוד.

▸ פרטיות לפני הכל
  שום analytics, שום tracking, שום Google Fonts, שום קוד מרוחק. תגיות,
  הערות, היסטוריה — הכל נשאר אצלך. שתי בקשות חיצוניות בלבד: שערי מטבע
  מ-frankfurter.app וקטלוג mods פומבי של GOG. desktop notifications
  (אם מפעילים) משתמשות ב-chrome.notifications המקומי — שום מידע יוצא.

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
> Used to schedule periodic background refreshes: exchange rates every 12 hours from frankfurter.app, the public GOG mods catalog every 24 hours, the wishlist sale-count badge every 6 hours, and a once-daily check that fires desktop notifications when a tracked refund window is about to close (only if the user opted in).

### `notifications`
> Used exclusively for optional, opt-in alerts the user controls from Advanced Options: a system notification when a manually-marked refund window has 1–2 days remaining, and a system notification when the count of wishlist items on sale jumps. All notifications use the local chrome.notifications API — nothing is transmitted off-device. The toggle is OFF by default; nothing fires until the user enables it.

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

> **⚠️ Use demo data, not your real account.** The screenshots currently in
> `screenshots/` were captured from a real browsing session and may show a
> personal GOG account name, real wishlist, or owned library. Before publishing,
> reshoot them while **signed out** (or with a throwaway account) so nothing
> personal is exposed. Pick well-known games (Witcher 3, Cyberpunk 2077,
> Hollow Knight, Disco Elysium) so the demo reads clearly without revealing your
> own taste/purchases. Add a few generic tags ("co-op", "backlog", "RPG night")
> and visit 3–4 game pages first so price-history and the dashboard look real.

1. **`01-currency-banner.png` (1280×800)** — Open the GOG.com homepage with the extension active. Frame the DRM-free banner at the top + the first row of game cards with the green "30-DAY REFUND" badges visible. This is your hero shot.

2. **`02-game-page-panel.png` (1280×800)** — Open any game page (e.g. Cyberpunk 2077 or Heroes of Might and Magic 3). Frame the GOG Enhancer "insights" panel that shows current/all-time-low/average + the sparkline + ITAD compare button.

3. **`03-tag-dashboard.png` (1280×800)** — Open the tag dashboard from the popup. Capture the search box + tag pills on the left + game cards on the right. Have at least 3-4 tagged games to make the demo look real.

4. **`04-popup-settings.png` (1280×800)** — Click the toolbar icon. Frame the popup with the master toggle, currency dropdown, and the rate-strip showing "1 USD = 3.65 ILS · 2h ago". Make sure the new "Refund window timer" toggle is visible.

5. **`05-hebrew-rtl.png` (1280×800)** — Same homepage with Hebrew translations + RTL layout enabled. This is the differentiator for the Israeli market.

6. **`06-theme-picker.png` (1280×800)** — Advanced Options page, the "Look & feel" card (theme picker with all four swatches). New in v2.1, worth showcasing.

7. **`07-year-in-review.png` (1280×800)** — Tag dashboard with the Library year-in-review section visible. Make sure there's enough price-history data so the "biggest drop" and "watch advantage" cards aren't empty.

### Promo tile (optional but strongly recommended)

- **`promo-440x280.png`** — A simple promo tile. Suggested layout: dark background (#0a0612), the "GOG Enhancer" wordmark in the magenta/cyan color scheme on the left, and a small product preview (a single converted game card) on the right.

---

## Pre-submission checklist

Before clicking "Submit for review", verify:

- [ ] Privacy policy is hosted at a publicly reachable URL (GitHub Pages works). Paste that URL into the Privacy section of the dashboard.
- [ ] All **six** permission justifications above are pasted into the form (including the new `notifications` one for v2.1+).
- [ ] At least one 1280×800 screenshot is uploaded. Reshoot popup + advanced-settings if your earlier captures predate v2.1's refund-timer toggle and theme picker.
- [ ] The Single-purpose statement above is pasted in the Distribution tab.
- [ ] The detailed description matches what you actually shipped (don't promise features not in the build).
- [ ] You have tested the extension in real Chrome on at least: GOG homepage, game page, wishlist, options page, tag dashboard, onboarding wizard.
- [ ] You have visited /account/wishlist at least once after install so the badge has data to show.
- [ ] If this is an update from v2.0.x: existing users will see a "GOG Enhancer wants to add: Display notifications" prompt on update because v2.1 adds the `notifications` permission. Mention this in the update notes so it doesn't surprise anyone.

Reviews for permission expansions (the `notifications` add in v2.1) typically take 5–10 business days instead of the usual 1–2. Plan accordingly.
