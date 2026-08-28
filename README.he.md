<p align="center">
  <img src="docs/assets/hero-icon.png" width="96" height="96" alt="לוגו GOG Enhancer" />
</p>

<h1 align="center">GOG Enhancer</h1>

<p align="center">
  <a href="https://github.com/DrummingBird1/GOGEnhancer/blob/main/extension/manifest.json"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FDrummingBird1%2FGOGEnhancer%2Fmain%2Fextension%2Fmanifest.json&query=%24.version&label=version&color=c64fff" alt="version" /></a>
  <img src="https://img.shields.io/badge/manifest-v3-00f0ff" alt="Manifest V3" />
  <a href="https://github.com/DrummingBird1/GOGEnhancer/actions/workflows/test.yml"><img src="https://img.shields.io/github/actions/workflow/status/DrummingBird1/GOGEnhancer/test.yml?branch=main&label=tests&color=7fffa6" alt="tests" /></a>
  <a href="https://github.com/DrummingBird1/GOGEnhancer/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-ff6b9d" alt="MIT license" /></a>
</p>

<p align="center">דפדפנים מבוססי-Chromium (Chrome, Edge, Brave, Opera)</p>

<p align="center"><a href="README.md">Read in English · קרא באנגלית</a></p>

תוסף third-party (לא רשמי) ל-GOG.com — המרת מטבע חיה, מעקב היסטוריית מחירים, השוואת מחירים בין חנויות, תגיות אישיות, שדרוג עיצובי מלא, עברית ו-RTL — והכל ללא Google Fonts וללא analytics.

> **הצהרה משפטית:** זהו תוסף third-party לא רשמי. אין קשר, חסות או אישור מצד GOG sp. z o.o. או CD Projekt S.A. השם "GOG" משמש כאן באופן תיאורי בלבד, כדי לתאר את חנות היעד שהתוסף פועל מולה.

---

## 📂 תוכן ה-repository

| קובץ / תיקייה | תפקיד |
|---|---|
| **`extension/`** | **התוסף עצמו** — `manifest.json` + `background/`, `content/`, `lib/`, `popup/`, `options/`, `onboarding/`, `tags/`, `icons/`. זו התיקייה שטוענים דרך "Load unpacked", וזו התיקייה היחידה שנארזת ל-zip. |
| **`store/`** | חומרי Web-Store שהם **לא** חלק מהתוסף: `STORE_LISTING.md` (טקסט ללוח הבקרה), `screenshots/` (5 תמונות למסך החנות), `release-images/` (סקריפט ליצירת תמונת באנר לכל גרסה, ראו `CLAUDE.md`). מועלים/משמשים בנפרד, לא נכללים ב-zip. |
| **`docs/`** | אתר התדמית של התוסף, מתארח ב-GitHub Pages — עמוד נחיתה, מדיניות פרטיות, יומן שינויים. |
| `PRIVACY.md` | מדיניות הפרטיות — מתארחת גם בכתובת ציבורית (`docs/privacy.html`) לפני הגשה לחנות הרחבות |
| `README.he.md` | הקובץ הזה |
| `LICENSE` | רישיון MIT |
| `build.ps1` | סקריפט build — אורז את `extension/` ל-`dist/gog-enhancer-webstore.zip` |
| `dist/` | פלטי build (לא נכללים ב-git). נוצרים מחדש על ידי `build.ps1` |
| `tests/`, `package.json`, `vitest.config.js`, `eslint.config.js` | סביבת Vitest + ESLint למודולי utility. לא נשלח בתוך ה-zip של התוסף. |
| `.github/workflows/` | GitHub Actions: `test.yml` מריץ lint+tests על כל push/PR, `release.yml` בונה את ה-zip ומפרסם Release בכל push של tag בפורמט `v*.*.*` |
| `CLAUDE.md` | הערות פרויקט לכלי AI לכתיבת קוד |
| `README.md` | הגרסה האנגלית של הקובץ הזה |

---

## ✨ סקירת פיצ'רים

### ארכיטקטורה
- **שכבת אחסון מאוחדת** — העדפות ב-`storage.sync` (קל ומסונכרן בין מכשירים), נתונים כבדים יותר (תגיות, היסטוריה, cache) ב-`storage.local`. שום דבר לא חורג מהמכסות.
- **גרסון הגדרות + מיגרציה** — שדרוג מ-v1 מעביר אוטומטית tags ו-notes מ-sync ל-local.
- **System fonts בלבד** — אפס תלות ב-Google Fonts. שום בקשת רשת חיצונית מלבד ה-API לשערי מטבע.
- **MutationObserver ממוקד** על `main` / `[ng-view]` עם debouncing — יותר חכם, פחות עבודה.

### פיצ'רים
- 💱 **שערי מטבע חיים** — נשלפים אוטומטית מ-`api.frankfurter.app` כל 12 שעות. ניתן לערוך ידנית.
- 📈 **מעקב מחירים** — כל ביקור בעמוד משחק מתעד תמונת-מצב. פאנל סטטיסטיקות בעמוד המשחק (current / all-time low / average), כולל חוות דעת "כדאי לחכות?".
- 🔍 **השוואה ב-IsThereAnyDeal** — כפתור בעמוד המשחק שמחפש את אותו משחק ב-Steam / Epic / Humble / Fanatical.
- 🏷️ **לוח תגיות מלא** — דף נפרד עם חיפוש, סינון, ספירה לכל תגית, ויצוא CSV. אוטוקומפליט לתגיות קיימות.
- 🔔 **התראות ומבצעי wishlist** — badge על אייקון התוסף סופר פריטים במבצע ב-wishlist; הפופאפ מציג את 3 ירידות המחיר המשמעותיות ביותר שאותרו.
- 🛡️ **באנר DRM-free** — באנר בולט עם אייקון מגן ו-pill בגרדיאנט "GOG+".
- 🎨 **שדרוג עיצובי לכרטיסים** — *card-aware*: "Good Old Game" מקבל אפקט CRT עדין + הילת זהב; משחקי Cyberpunk/Witcher מקבלים neon underglow ציאן/מג'נטה.
- 🪟 **טולטיפ מעוצב** — חלופה לטולטיפ ברירת-המחדל של הדפדפן, עם כותרות, תוכן עשיר, ומיקום אוטומטי.
- 📋 **רשימת מודים דינמית** — נסרקת אוטומטית מ-`gog.com/en/mods` כל 24 שעות.
- 🌍 **זיהוי מטבע אוטומטי בעמוד** — אם GOG כבר מציג ב-EUR (משתמשי EU), התוסף לא ממיר שוב.
- 🎯 **RTL אמיתי** — עם `inline-start`/`end` במקום `left`/`right`, ו-`unicode-bidi: isolate` למחירים.
- ⌨️ **קיצורי מקלדת** — `Alt+G` פותח את הפופאפ, `Alt+Shift+G` מפעיל/מכבה, `Alt+Shift+H` מחליף עברית; `Ctrl/Cmd+K` פותח command palette לכל השאר.
- 🧙 **אשף Onboarding** — 4 צעדים (מטבע, אזור, פיצ'רים, ערכת נושא), נפתח אוטומטית בהתקנה ראשונה.

### מודול שדרוג עיצוב
מופעל דרך ה-toggle "Design injection" בפופאפ. כשמופעל:
- מספרי מחירים בכל האתר עם **מונופונט** (`ui-monospace` / Cascadia / JetBrains) עם ספרות tabular.
- כרטיסים מודעי-עידן (era-aware): סקאן-ליינס לקלאסיקות, זוהר neon למשחקי עידן הסייברפאנק.
- depth/shadows עדינים, רקע גרדיאנט אמביינטי, מיקרו-אינטראקציות ב-hover.
- ה-pill של "Good Old Game" מקבל גרדיאנט זהב מתכתי במקום סגול שטוח.
- Skeleton loaders עם אנימציית shimmer במקום placeholders חשופים כמו `{{ product.title }}`.
- Clean layout: מסתיר מבצעים שפג תוקפם משנים קודמות.
- שש ערכות נושא (Neon, Classic GOG, CRT Green, Sunset, Light, Auto) — Auto עוקבת אחרי העדפת המערכת שלך (בהיר/כהה).

### פרטיות בכנות
- **שני דומיינים בלבד** מקבלים בקשות רשת:
  1. `www.gog.com` — לקריאת תוכן הדף ולהזרקת ה-UI.
  2. `api.frankfurter.app` — לשערי מטבע (ללא API key, ללא tracking).
- **אפס analytics, אפס gtag, אפס Google Fonts.**
- **תגיות, הערות והיסטוריה נשארות אצלך** דרך `chrome.storage.local`. שום דבר לא יוצא החוצה.
- **קוד פתוח** — כל שורת קוד נמצאת ב-repository הזה.

---

## 🚀 התקנה

1. הורידו את `gog-enhancer-webstore.zip` מעמוד ה-[Releases](https://github.com/DrummingBird1/GOGEnhancer/releases) וחלצו אותו לתיקייה כלשהי (או, אם קלונתם את ה-repo, השתמשו ישירות בתיקיית `extension/`).
2. פתחו את Chrome ועברו ל-`chrome://extensions/`.
3. הפעילו **Developer mode** (פינה ימנית עליונה).
4. לחצו **Load unpacked** ובחרו את התיקייה שחילצתם (או את `extension/`).
5. אשף ה-onboarding ייפתח אוטומטית בלשונית חדשה. עברו את הצעדים.
6. גלשו ל-[gog.com](https://www.gog.com) — התוסף פעיל.

---

## ⌨️ קיצורי מקלדת

| קיצור | פעולה |
|---|---|
| `Alt+G` | פתיחת הפופאפ |
| `Alt+Shift+G` | הפעלה/כיבוי של GOG Enhancer |
| `Alt+Shift+H` | הפעלה/כיבוי תרגום עברית |
| `Ctrl/Cmd+K` (ב-gog.com) | פתיחת ה-command palette |

ניתן לשנות קיצורים ב-`chrome://extensions/shortcuts`.

---

## ⚙️ הסבר ההרשאות

| הרשאה | למה |
|---|---|
| `storage` | שמירת העדפות, תגיות והיסטוריה |
| `activeTab` | רענון הלשונית הפעילה בלחיצה על "Reload" בפופאפ |
| `alarms` | תזמון רענוני רקע ל-FX/mods/wishlist |
| `notifications` | Opt-in בלבד — התראות desktop לחלונות refund ומבצעי wishlist |
| Host: `www.gog.com` | הזרקת UI לתוך עמודי GOG |
| Host: `api.frankfurter.app` | שליפת שערי מטבע |

---

## 🛠️ מגבלות ידועות

- **סריקת רשימת המודים** — תלויה בכך ש-`gog.com/en/mods` שומר על מבנה דומה. אם תהיה רגרסיה, ניתן לרענן בכוח דרך Advanced Options.
- **מונה ה-badge של wishlist** — מבוסס על ספירת DOM חיה כשמבקרים ב-`/account/wishlist` (TTL של 24 שעות). אם לא ביקרתם לאחרונה — ה-badge יישאר ריק עד הביקור הבא; ה-tooltip של אייקון התוסף ימליץ לבקר.
- **טיימר ה-refund מבוסס על תאריך שמוזן ידנית** — GOG לא חושף תאריך רכישה דרך DOM ציבורי, אז הספירה לאחור של 30 הימים תלויה בתאריך שמקלידים בפאנל. אם לא הוקלד תאריך — אין ספירה לאחור.
- **זיהוי ז'אנר אוטומטי חלקית (מאז v2.6.0)** — Horror/Role-playing/Strategy נקראים כעת מהשדה האמיתי "Genre:" בעמוד המשחק ונשמרים ב-cache לפי slug (`gameGenres`) בביקור ראשון. Sci-fi ו-Indie עדיין מבוססים על regex ידני של שמות משחקים מוכרים — ב-GOG הם נראים משויכים ל-"Tags" הרחב יותר ולא ל-"Genre:", ומבנה זה לא אומת במלואו. עד שמשחק מסוים לא בוקר, כל חמשת הז'אנרים נופלים חזרה ל-regex הישן.
- **המרת cross-currency תמיד עוברת דרך USD** — אם השער של אחד הזוגות חסר ב-`rates`, ההמרה לא תתבצע. כל השערים נשלפים אוטומטית כל 12 שעות מ-frankfurter.app.
- **התראות מחיר על כל ה-wishlist, מבצעי wishlist, וה-stat "Wishlist value" מכסים רק משחקים שביקרתם בהם** — שלושת הפיצ'רים נשענים על `priceHistory`, שנבנה רק מביקור בעמוד המשחק עצמו. משחק ב-wishlist שמעולם לא ביקרתם בו — אין לו נתון להשוואה, ולכן לא יופיע בהתראות, ב"מבצעים ברשימת המשאלות" בפופאפ, או ב-stat של "Wishlist value", גם אם המחיר צנח.

---

## 📜 יומן שינויים

היסטוריית הגרסאות המלאה נמצאת בעמוד ה-[GitHub Releases](https://github.com/DrummingBird1/GOGEnhancer/releases) — לכל גרסה יש עמוד משלה, עם תמונת באנר ייחודית — וגם בעמוד ה-[Changelog](https://drummingbird1.github.io/GOGEnhancer/changelog.html) באתר התוסף.

---

## 🧑‍💻 מותאם בתחילה למשתמש הישראלי

מותאם בתחילה למשתמש ישראלי (ILS, מע"מ 18%, עברית) — אבל עובד מצוין גם ל-EU/UK/US/PL. כל שדה ניתן לעריכה.

---

## ☕ תמיכה

GOG Enhancer הוא תוסף חינמי, קוד פתוח, ללא פרסומות, ולא אוסף נתונים. אם הוא
חוסך לכם כסף או זמן ותרצו לתמוך בהמשך הפיתוח, אפשר להפוך לתומכים באחת
מהאפשרויות הבאות:

- **[Ko-fi](https://ko-fi.com/idanlights)**
- **[Buy Me a Coffee](https://buymeacoffee.com/MrIdan)**
- **[Patreon](https://www.patreon.com/c/IdanLights)**

לחלוטין אופציונלי — כל הפיצ'רים נשארים חינמיים לכולם בכל מקרה.
