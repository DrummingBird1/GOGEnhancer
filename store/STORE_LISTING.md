# Chrome Web Store — Listing Copy

This file contains every piece of text you'll be asked to paste into the
Chrome Web Store Developer Dashboard when submitting **GOG Enhancer**.
Copy each block as-is.

---

## Single-purpose statement

> GOG Enhancer's single purpose is to enhance the user experience on the GOG.com storefront — by adding currency conversion, price history and deal analysis, personal tagging and library tools, notifications about that store's prices, Hebrew translation, and small visual improvements to that one site.

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

▸ Cross-store price comparison table
  A small table right on the game page shows what Steam, Epic, Humble
  Store, Fanatical, and GreenManGaming currently charge for the same
  title, via the free CheapShark API — no need to open a new tab.
  Also adds a 0-100 "deal score" next to the existing worth-waiting
  verdict, and a sale-calendar prediction for GOG's next likely
  discount window in the tag dashboard.

▸ Personal tags & notes (with rename, merge, colors, drag-to-reorder)
  Add private tags and notes to any game. The dashboard lets you search,
  filter, assign per-tag colors, rename or merge tags, drag pills to
  reorder, and export or import via CSV. Notes support inline markdown
  (bold, italic, links, lists, code).

▸ Library year-in-review
  Annual stats: games tracked, biggest price drop, most-watched title,
  watch advantage (current vs. peak across the library), refund windows
  logged. All computed from your local data.

▸ "What to play tonight" + genre recommendations
  A one-click random pick from your Backlog, optionally narrowed to a
  genre. The dashboard also surfaces backlog games sharing a genre with
  titles you've already tagged or marked Finished/Playing — no ML, no
  network call, just your own local data.

▸ Encrypted backup, CSV round-trips, and a shareable read-only export
  "Export everything" in Advanced Options now offers a password-protected
  (AES-256-GCM, on-device only) backup alongside the plain JSON one. The
  Tags CSV export/import now round-trips play status too, not just tags
  and notes. The dashboard can also export the currently-filtered games
  as a single self-contained, script-free HTML page for sharing outside
  the extension.

▸ Real charts, genre distribution, and a spending tracker
  Expand any tracked game's card in the dashboard to see its full price
  chart. A genre-distribution chart shows which genres your library
  actually leans toward. Log a price alongside a purchase date on the
  game page's Refund window section and the dashboard totals your
  spending, with an optional monthly budget comparison. Year-in-review
  now also surfaces your "most patient purchase" and a multi-year trend.

▸ Weekly digest + auto-tag suggestions
  A new "This week" panel in the popup summarizes refund windows closing
  soon, price-alert hits, and wishlist drops — computed regardless of the
  desktop-notifications toggle, so it's useful even with notifications
  off. Untagged games in the tag dashboard also show a one-click suggested
  tag based on GOG's own genre metadata, never applied without a click.

▸ Accessibility, custom themes, and smarter filtering
  A high-contrast theme and an optional dyslexia-friendly font stack (no
  remote font downloads — just reordering locally-installed fonts).
  Pick your own accent colors with the new custom theme editor. Tag a game
  straight from its card on a listing page via a hover "+" button — no need
  to open it. The tag dashboard's search box gained a discoverable filter
  picker plus a genre: operator, and games can now carry an attached photo
  alongside their note.

▸ Achievements
  A small, entirely local set of badges in the tag dashboard — tagging,
  tracking, note-taking, and spending milestones unlock as you use the
  extension, with a toast when a new one lands.

▸ Built to keep working when the site changes
  Every lookup of GOG's page markup goes through one adapter that tries
  several strategies, so a redesign degrades gracefully instead of
  silently switching features off. A "Native" theme reads GOG's own colors
  and font so the extension's panels blend in, and "Check this page" in
  Advanced Options reports which lookups still work on the page you have
  open.

▸ Sync across devices — through a folder you choose
  Point the extension at a folder your own Dropbox / OneDrive / Google
  Drive / Syncthing already syncs. It reads and writes one file there and
  merges tags, notes, play status, purchases, alerts and price history from
  every browser, optionally encrypted with a passphrase. It can run by
  itself (when you open the dashboard and every 30 minutes, while the
  browser still remembers the folder permission) and keep dated backups
  there. No server of ours, no new network access — the folder is the whole
  transport.

▸ Search your library from the address bar
  Type gog, press Tab, then a game name, tag:rpg or status:backlog.

▸ Exports and small conveniences
  A refund-deadline calendar (.ics) and a Markdown export (Obsidian,
  Notion…) from the tag dashboard, optional J / K / T keyboard navigation
  on game grids (and W / N / A on a game page), and a RAM-only system
  check on game pages.

▸ Smarter prices and a smarter wishlist
  "Is this discount real?" compares the base price with GOG's own
  lowest-in-30-days and your history; an offer countdown, price per hour of
  play, the price in several currencies, a per-game sale rhythm, and a
  comparison chart. The wishlist gets sorting (discount, distance from the
  low, converted price), "near the low" / "ending soon" filters, a live
  total and exports. The catalog gets a tools bar: dim or hide games you
  own, "not interested", local sort, density, saved filters, side-by-side
  comparison.

▸ Learns your library as you browse — nothing is fetched
  The extension remembers which games gog.com itself marks "IN LIBRARY" on
  pages you open, plus ratings, languages and prices a game page states.
  That powers hide-owned, a language check, "what changed since your last
  visit", similar games you own, a weighted backlog roulette, a monthly
  goal, Wrapped / collector cards (PNG, drawn on your device), note
  history, and exports for Obsidian, Notion, Google Sheets and Trello. It
  never logs in to your account and never sends any of it anywhere.

▸ Calmer notifications and a calmer look
  Quiet hours, one summary a day, price thresholds, alerts by tag, an
  optional season radar and a richer weekly digest. Fold, dock and reorder
  the game panel; calm mode, a one-click plain look, colour-vision palettes,
  text-size scaling and settings profiles. Optionally, notifications can
  also be posted to a webhook address you type yourself — the browser asks
  you once to allow that one origin, only notification text is sent, and
  nothing is requested unless you do this.

▸ Hebrew translations + RTL
  Optional Hebrew dictionary covering navigation, UI strings, and common
  patterns. Real RTL with logical-property CSS — not a flipped page.

▸ Wishlist sale alerts + quick filters
  Wishlist-icon badge counts items on sale. Quick filter bar offers
  "On sale", "Under $10/$25", "Rated 4.5+", and dynamic genre chips
  (RPG / Horror / Strategy / Sci-fi / Indie). Optional desktop
  notification when wishlist deals appear (opt-in).

▸ Theme picker + visual upgrade
  Neon (default), Classic GOG, CRT Green, Sunset, Light, Auto, a new
  High Contrast theme, and a Custom theme editor for picking your own
  colors. System-font monospace numerals for prices, era-aware accents
  (CRT scan-lines for classics, neon underglow for cyberpunk/witcher,
  genre-tuned hover effects for RPG/Horror/Strategy/Sci-fi/Indie titles),
  gold pill on "Good Old Game" markers, glassmorphism on the game-page
  panel with a blurred hero backdrop pulled from the page's cover art.

▸ Privacy-first
  No analytics, no third-party tracking, no Google Fonts, no remote code.
  All your tags, notes, and history stay on your device. Three outbound
  destinations only: exchange rates from frankfurter.app, the public GOG
  mods catalog, GOG's own product API (api.gog.com — once per game page, to
  see what a pack contains; toggleable) and catalog API (catalog.gog.com —
  only if you turn on endless scrolling), and (optionally, on by default,
  toggleable) game-title lookups against CheapShark's keyless deals API for
  the price comparison table. None of these send cookies or account
  information, and a list of every request is shown in Advanced Options. Desktop
  notifications (if you enable them) use the local chrome.notifications
  API — nothing transmitted. The only other possible destination is a
  webhook address you enter yourself (off by default; the browser asks you
  to approve that single origin; only notification text is sent).

▸ Open source under the MIT license. Verifiable end-to-end.

DISCLAIMER: This is an unofficial third-party tool. It is not affiliated
with, endorsed by, or sponsored by GOG sp. z o.o. or CD Projekt S.A.
The "GOG" name is used nominatively to describe the website the extension
works with.

Privacy policy: https://drummingbird1.github.io/GOGEnhancer/privacy.html
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

▸ טבלת השוואת מחירים חוצת-חנויות
  טבלה קטנה ישירות בעמוד המשחק מציגה כמה Steam, Epic, Humble Store,
  Fanatical ו-GreenManGaming גובים עבור אותו כותר, דרך ה-API החינמי של
  CheapShark — בלי לפתוח טאב חדש. גם מוסיף "ציון עסקה" 0-100 ליד
  ה-worth-waiting verdict הקיים, ותחזית לוח שנת מבצעים בלוח התגיות.

▸ תגיות והערות מתקדמות
  תגיות והערות פרטיות לכל משחק. בלוח התגיות יש חיפוש, סינון, color
  picker לכל תג, rename / merge / delete, drag-to-reorder, ויצוא+יבוא
  CSV. ההערות תומכות ב-markdown (bold, italic, links, lists, code).

▸ Year-in-review לספריה שלך
  סטטיסטיקה שנתית: כמה משחקים נעקבו, ירידת המחיר הגדולה, המשחק
  הכי-נעקב, watch advantage (current מול peak), refund windows שנפתחו.
  הכל מחושב מנתונים מקומיים.

▸ "מה לשחק הערב?" + המלצות לפי ז'אנר
  בחירה אקראית בלחיצה אחת מה-Backlog שלך, עם אפשרות לצמצם לפי ז'אנר.
  הלוח גם מציג משחקי Backlog שחולקים ז'אנר עם משחקים שכבר תייגת או
  סימנת כ-Finished/Playing — בלי ML, בלי קריאת רשת, רק הנתונים
  המקומיים שלך.

▸ גיבוי מוצפן, CSV דו-כיווני, ועמוד שיתוף לקריאה בלבד
  "Export everything" בהגדרות המתקדמות מציע עכשיו גם גיבוי מוגן
  בסיסמה (AES-256-GCM, מקומי בלבד) לצד ה-JSON הרגיל. יבוא/יצוא ה-CSV
  של התגיות עכשיו כולל גם סטטוס משחק, לא רק תגיות והערות. הלוח יכול
  גם לייצא את המשחקים המסוננים כעמוד HTML עצמאי לקריאה בלבד, לשיתוף
  מחוץ לתוסף.

▸ גרפים אמיתיים, פילוג ז'אנרים, ומעקב הוצאות
  הרחבת כרטיס כל משחק נעקב בלוח מציגה את הגרף המלא שלו. גרף פילוג
  ז'אנרים מראה לאילו ז'אנרים הספרייה שלך נוטה בפועל. תיעוד מחיר לצד
  תאריך רכישה בסקציית Refund window בעמוד המשחק גורם ללוח לסכם את
  ההוצאות שלך, עם השוואה אופציונלית לתקציב חודשי. ה-Year-in-review
  מציג עכשיו גם את "הרכישה הכי סבלנית" שלך ומגמה רב-שנתית.

▸ דוח שבועי + הצעות תיוג אוטומטיות
  פאנל "השבוע" חדש בפופאפ מסכם חלונות החזר שנסגרים בקרוב, התראות מחיר
  שהופעלו, וירידות ברשימת המשאלות — מחושב ללא קשר ל-toggle של desktop
  notifications, כך שהוא שימושי גם כשההתראות כבויות. משחקים ללא תגית
  בלוח התגיות מציגים גם הצעת תגית בלחיצה אחת מבוססת מטא-דאטה של ז'אנר
  מ-GOG עצמו, שלעולם לא מוחלת בלי לחיצה.

▸ נגישות, ערכות נושא מותאמות אישית, וסינון חכם יותר
  ערכת נושא בניגודיות גבוהה ואופציית גופן ידידותי לדיסלקציה (בלי הורדת
  גופנים מרוחקים — רק שינוי סדר עדיפויות בין גופנים מותקנים מקומית).
  בחרו את הצבעים שלכם עם עורך ה-Custom theme החדש. תייגו משחק ישירות
  מהכרטיס שלו בעמוד רשימה דרך כפתור "+" ב-hover — בלי לפתוח אותו. תיבת
  החיפוש בלוח התגיות קיבלה בורר סינון גלוי + אופרטור genre:, ומשחקים
  יכולים כעת לשאת תמונה מצורפת לצד ההערה.

▸ Achievements
  סט קטן ומקומי לגמרי של תגי הישג בלוח התגיות — אבני דרך של תיוג, מעקב,
  כתיבת הערות והוצאות נפתחות תוך כדי שימוש בתוסף, עם toast כשנפתח חדש.

▸ נבנה להמשיך לעבוד כשהאתר משתנה
  כל חיפוש של מבנה הדף של GOG עובר דרך מתאם אחד שמנסה כמה אסטרטגיות,
  כך ששינוי עיצוב מתדרדר בעדינות במקום לכבות פיצ'רים בשקט. ערכת נושא
  "Native" קוראת את הצבעים והפונט של GOG עצמו, וכפתור "Check this page"
  ב-Advanced Options מראה אילו חיפושים עדיין עובדים בדף הפתוח.

▸ סנכרון בין מכשירים — דרך תיקייה שתבחרו
  כוונו את התוסף לתיקייה ש-Dropbox / OneDrive / Google Drive / Syncthing
  שלכם כבר מסנכרנים. הוא קורא וכותב שם קובץ אחד וממזג תגיות, הערות,
  סטטוס, רכישות, התראות והיסטוריית מחירים מכל דפדפן, עם הצפנה אופציונלית
  בסיסמה. הוא יכול לרוץ לבד (בפתיחת הדשבורד וכל 30 דקות, כל עוד הדפדפן
  עדיין זוכר את הרשאת התיקייה) ולשמור שם גיבויים מתוארכים. בלי שרת שלנו
  ובלי גישת רשת חדשה — התיקייה היא כל ההובלה.

▸ חיפוש בספרייה מסרגל הכתובות
  הקלידו gog, לחצו Tab, ואז שם משחק, tag:rpg או status:backlog.

▸ ייצוא ושיפורי נוחות קטנים
  לוח שנה של מועדי refund‏ (.ics) וייצוא Markdown (Obsidian, Notion…) מלוח
  התגיות, ניווט מקלדת אופציונלי J / K / T ברשימות משחקים (ו-W / N / A בעמוד
  משחק), ובדיקת מערכת של RAM בלבד בעמוד משחק.

▸ מחירים חכמים ו-wishlist חכם
  "האם ההנחה אמיתית?" משווה את מחיר הבסיס ל"המחיר הנמוך ב-30 הימים
  האחרונים" של GOG עצמה ולהיסטוריה שלכם; ספירה לאחור לסיום מבצע, מחיר
  לשעת משחק, המחיר בכמה מטבעות, קצב מבצעים לכל משחק וגרף השוואה. ל-wishlist
  נוספים מיון (הנחה, מרחק מהשפל, מחיר מומר), מסננים "קרוב לשפל" ו"נגמר
  בקרוב", סכום חי וייצוא. לקטלוג נוסף סרגל כלים: עמעום או הסתרה של
  משחקים שבבעלותכם, "לא מעניין", מיון מקומי, צפיפות, פילטרים שמורים
  והשוואה צד-לצד.

▸ לומד את הספרייה שלכם תוך כדי גלישה — בלי להביא כלום
  התוסף זוכר אילו משחקים gog.com עצמה מסמנת "IN LIBRARY" בדפים שפתחתם,
  וגם דירוגים, שפות ומחירים שדף משחק מציג. זה מזין הסתרת משחקים בבעלותכם,
  מד שפות, "מה השתנה מאז הביקור הקודם", משחקים דומים שיש לכם, רולטת
  Backlog משוקללת, יעד חודשי, כרטיסי Wrapped / אספן (PNG, מצוירים במכשיר
  שלכם), היסטוריית הערות וייצוא ל-Obsidian, Notion, Google Sheets ו-Trello.
  הוא אף פעם לא מתחבר לחשבון שלכם ולא שולח שום דבר מזה לשום מקום.

▸ התראות רגועות יותר ומראה רגוע יותר
  שעות שקט, סיכום אחד ביום, ספי מחיר, התראות לפי תג, רדאר מבצעי עונה
  אופציונלי ודייג'סט שבועי עשיר יותר. קיפול, עגינה וסידור מחדש של פאנל
  המשחק; מצב שקט, מראה פשוט בלחיצה אחת, פלטות לעיוורון צבעים, שינוי גודל
  טקסט ופרופילי הגדרות. אופציונלית, אפשר לשלוח את ההתראות גם ל-webhook
  בכתובת שתקלידו בעצמכם — הדפדפן ישאל פעם אחת אם לאשר את המקור הבודד הזה,
  רק טקסט ההתראה נשלח, ושום דבר לא מתבקש אם לא תעשו זאת.

▸ עברית + RTL מלא
  מילון עברית רחב, RTL אמיתי עם logical-properties CSS.

▸ Wishlist — התראות מבצעים + סינונים
  badge על אייקון ההרחבה סופר פריטים במבצע. סרגל סינון: "On sale",
  "Under $10/$25", "Rated 4.5+", וגם chips דינמיים לפי ז'אנר
  (RPG / Horror / Strategy / Sci-fi / Indie). אופציונלי: התראת
  system כשמבצעים חדשים מופיעים (opt-in).

▸ Theme picker + שדרוג עיצוב
  Neon (ברירת מחדל), Classic GOG, CRT Green, Sunset, Light, Auto, ערכת
  High Contrast חדשה, ועורך Custom theme לבחירת צבעים משלכם. גופן
  monospace למחירים, accents מותאמי-עידן (סקאן-ליינס לקלאסיקות, neon
  לקיברפאנק/וויצ'ר, hover ייעודי לפי ז'אנר), pill זהב על
  "Good Old Game", glassmorphism על ה-game panel עם hero blur מתוך
  ה-cover art של העמוד.

▸ פרטיות לפני הכל
  שום analytics, שום tracking, שום Google Fonts, שום קוד מרוחק. תגיות,
  הערות, היסטוריה — הכל נשאר אצלך. שלושה יעדים חיצוניים בלבד: שערי מטבע
  מ-frankfurter.app, קטלוג mods פומבי של GOG, ו(אופציונלי, ברירת מחדל
  פעיל, ניתן לכיבוי) בדיקת שם משחק מול ה-API החינמי של CheapShark
  לטבלת ההשוואה. אף אחד מהם לא שולח cookies או פרטי חשבון. desktop
  notifications (אם מפעילים) משתמשות ב-chrome.notifications המקומי —
  שום מידע יוצא. היעד האפשרי היחיד הנוסף הוא כתובת webhook שתקלידו
  בעצמכם (כבוי כברירת מחדל; הדפדפן ישאל אם לאשר את המקור הבודד הזה; רק
  טקסט ההתראה נשלח).

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
> Required to fetch USD-to-target-currency exchange rates from the Frankfurter public API. No user data is sent — only a public GET request for rates.

### No permission for folder sync or the address-bar keyword
> The optional folder sync uses the browser's own folder picker (File System Access API): the user grants one folder at a time, from a click, and the extension only touches the sync file (and, if the user enables dated backups, backup files) in it. The background auto-sync only runs while the browser still remembers that grant and cannot prompt. The address-bar keyword ("gog") is declared in the manifest and needs no permission. Neither makes a network request.

### No permission for GOG's own APIs (`api.gog.com`, `catalog.gog.com`)
> Two optional features ask GOG's own public APIs — the same endpoints gog.com's pages call — for data about the page the user is already viewing: which games a pack contains (api.gog.com, only the numeric product id is sent) and the next page of a catalog list (catalog.gog.com, only when the user turns on endless scrolling, which is off by default). They are requested from the gog.com page under its own cross-origin rules, with no cookies and no referrer, so they need no host permission. Every request is listed for the user under Advanced Options → Privacy & transparency.

### Optional host permission: `https://*/*` (`optional_host_permissions`)
> Never granted at install and never used unless the user turns on the optional "send notifications to my own webhook" setting and types an https address. At that moment the extension requests access to that single origin through the browser's own permission prompt, and only the notification's title and text are POSTed to it (no cookies, no referrer, no library data). The address is stored locally and excluded from every export and sync. If the user never sets a webhook, no network request is ever made under this permission. A broad optional pattern is required because the address is chosen by the user and cannot be known in advance.

### Host permission: `https://www.cheapshark.com/*`
> Required to fetch the optional cross-store price comparison table (Steam, Epic, Humble Store, Fanatical, GreenManGaming) shown on GOG game pages. CheapShark's deals API is free and keyless. Only the game's title is sent, as a public GET request; no user data, cookies, or account information. Toggleable in the popup ("Price comparison table"), on by default.

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

  - Note for the "Website content" / "User activity" answers: the extension reads which games gog.com displays as owned and facts shown on pages the user opens, and keeps them **only on the device**. The one path by which text derived from that could leave the device is the optional user-entered webhook (notification title and text only, to an address the user chose and approved in a browser prompt). That is a user-directed transfer, not collection by the developer — if the dashboard form asks about it, describe it as such and link the privacy policy (section 3.7).

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

- [ ] Privacy policy is live at https://drummingbird1.github.io/GOGEnhancer/privacy.html (GitHub Pages). Paste that URL into the Privacy section of the dashboard.
- [ ] All permission justifications above are pasted into the form (including `notifications` and, from v4.0.0, the **optional** host permission `https://*/*` — expect a longer review and be ready to explain that it is only ever requested at runtime for a user-typed webhook address).
- [ ] At least one 1280×800 screenshot is uploaded. Reshoot popup + advanced-settings if your earlier captures predate v2.1's refund-timer toggle and theme picker.
- [ ] The Single-purpose statement above is pasted in the Distribution tab.
- [ ] The detailed description matches what you actually shipped (don't promise features not in the build).
- [ ] You have tested the extension in real Chrome on at least: GOG homepage, game page, wishlist, options page, tag dashboard, onboarding wizard.
- [ ] You have visited /account/wishlist at least once after install so the badge has data to show.
- [ ] If this is an update from v2.0.x: existing users will see a "GOG Enhancer wants to add: Display notifications" prompt on update because v2.1 adds the `notifications` permission. Mention this in the update notes so it doesn't surprise anyone.

Reviews for permission expansions (the `notifications` add in v2.1) typically take 5–10 business days instead of the usual 1–2. Plan accordingly.
