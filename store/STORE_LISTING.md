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

The manifest's `description` field comes from `extension/_locales/<lang>/messages.json` (`extDescription`). The English text is the dashboard default:

> Unofficial GOG.com helper: live currency conversion, price-history tracking, personal tags, Hebrew + RTL.

The short descriptions in other languages are in [`listings/`](./listings/).

---

## Detailed description (English)

```
GOG Enhancer is an unofficial third-party browser extension that adds the
features GOG.com does not ship with — without any analytics, ads, or remote
code.

▸ Live currency conversion
  Converts prices to 24 currencies (ILS, EUR, GBP, PLN, USD, RUB, BRL, AUD, CAD, CHF, SEK, NOK, DKK, CZK, HUF, RON, TRY, CNY, JPY, MXN, ZAR, NZD, SGD, THB, IDR) using exchange rates
  fetched from frankfurter.dev (a free, public, ECB-backed rate service).
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
  A refund-deadline calendar (.ics), a release-date calendar for the games
  on your wishlist, Markdown / Obsidian / CSV exports, a wishlist card and
  a weekly digest you can save as a PNG or a web page — all made on your
  device. Optional J / K / T keyboard navigation on game grids (and
  W / N / A on a game page), and a RAM-only system check on game pages.

▸ Nine interface languages
  The tag dashboard, Advanced Options, popup, first-run wizard and the
  extension's own text on gog.com come in English, Hebrew (right-to-left),
  Russian, Polish, German, French, Spanish, Simplified Chinese and
  Brazilian Portuguese. What you wrote yourself — tag names, notes — is never translated.

▸ See exactly what it does
  A privacy dashboard in Advanced Options lists every address the extension
  contacted and everything it keeps on your device, and a test fails the
  build if a permission or address ever changes without this policy
  saying so. If a feature stops working after a gog.com change, the popup
  offers a one-click report with no web addresses and no personal data.

▸ Achievements, streaks and challenges
  36 local achievements in three tiers (a few hidden), a streak of days
  you've browsed, and three monthly challenges. The dashboard works from
  the keyboard too: a skip link, tags reordered with Alt + arrow keys,
  menus and dialogs that hold focus and announce changes to screen readers.

▸ Smarter prices and a smarter wishlist
  "Is this discount real?" compares the base price with GOG's own
  lowest-in-30-days and your history; an offer countdown, price per hour of
  play, the price in several currencies, a per-game sale rhythm, and a
  comparison chart. The wishlist gets sorting (discount, distance from the
  low, converted price), "near the low" / "ending soon" filters, a live
  total and exports. The catalog gets a tools bar: dim or hide games you
  own, "not interested", local sort, density, saved filters, side-by-side
  comparison, and optional endless scrolling (off by default). A pack's
  page shows what it really contains and warns when it overlaps games you
  already own.

▸ Learns your library as you browse — nothing is fetched
  The extension remembers which games gog.com itself marks "IN LIBRARY" on
  pages you open, plus ratings, languages and prices a game page states.
  That powers hide-owned, a language check, "what changed since your last
  visit", similar games you own, a weighted backlog roulette, a monthly
  goal, Wrapped / collector cards (PNG, drawn on your device), note
  history, and exports for Obsidian, Notion, Google Sheets and Trello. It
  never logs in to your account and never sends any of it anywhere.

▸ Calmer notifications and a calmer look
  Quiet hours and weekdays, one summary a day, price thresholds, alerts by tag, an
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
  All your tags, notes, and history stay on your device. Five outbound
  destinations only: exchange rates from frankfurter.dev, the public GOG
  mods catalog, GOG's own product API (api.gog.com — once per game page, to
  see what a pack contains; toggleable), GOG's own catalog API
  (catalog.gog.com — only if you turn on endless scrolling), and
  (optionally, on by default, toggleable) game-title lookups against
  CheapShark's keyless deals API for the price comparison table. None of
  these send cookies, a referrer or account information, and every request
  is listed in Advanced Options (Privacy & transparency) next to what the
  extension keeps on your device. Desktop
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

## Detailed description (other languages)

Every other language has its own file in [`listings/`](./listings/), one per language code (`he.md`, `de.md`, `es.md`, `fr.md`, `pl.md`, `pt_BR.md`, `ru.md`, `zh_CN.md`). The English text above is the dashboard default ("all languages").

---

## Permission justifications

The Chrome Web Store form asks for a justification per permission. Use these
exact answers:

### `storage`
> Used to save user preferences (which features are enabled, target currency, VAT rate) in chrome.storage.sync, and personal data (tags, notes, price history) in chrome.storage.local. Nothing is transmitted off-device.

### `alarms`
> Used to schedule periodic background refreshes: exchange rates every 12 hours from frankfurter.dev, the public GOG mods catalog every 24 hours, the wishlist sale-count badge every 6 hours, a once-daily local check for refund windows and price alerts, a weekly digest, the release of held-back notifications, and the optional folder auto-sync (notifications only if the user opted in).

### `notifications`
> Used exclusively for optional, opt-in alerts the user controls from Advanced Options: a system notification when a manually-marked refund window has 1–2 days remaining, and a system notification when the count of wishlist items on sale jumps. All notifications use the local chrome.notifications API — nothing is transmitted off-device. The toggle is OFF by default; nothing fires until the user enables it.

### Host permission: `https://www.gog.com/*`
> Required to run the content script that adds currency conversion, badges, tags UI, and Hebrew translations on GOG.com pages, and to fetch the public /en/mods catalog page in the background. This extension is single-purpose for GOG.com and does not interact with other domains in the user's browser.

### No host permission for exchange rates (`api.frankfurter.dev`)
> Exchange rates are fetched from the Frankfurter public API, which allows cross-origin reads, so the extension declares no host permission for it (version 4.5.1 removed the old one). No user data is sent — only a public GET request for rates.

### No permission for folder sync or the address-bar keyword
> The optional folder sync uses the browser's own folder picker (File System Access API): the user grants one folder at a time, from a click, and the extension only touches the sync file (and, if the user enables dated backups, backup files) in it. The background auto-sync only runs while the browser still remembers that grant and cannot prompt. The address-bar keyword ("gog") is declared in the manifest and needs no permission. Neither makes a network request.

### No permission for GOG's own APIs (`api.gog.com`, `catalog.gog.com`)
> Two optional features ask GOG's own public APIs — the same endpoints gog.com's pages call — for data about the page the user is already viewing: which games a pack contains (api.gog.com, only the numeric product id is sent) and the next page of a catalog list (catalog.gog.com, only when the user turns on endless scrolling, which is off by default). They are requested from the gog.com page under its own cross-origin rules, with no cookies and no referrer, so they need no host permission. Every request is listed for the user under Advanced Options → Privacy & transparency.

### Optional host permission: `https://*/*` (`optional_host_permissions`)
> Never granted at install and never used unless the user turns on the optional "send notifications to my own webhook" setting and types an https address. At that moment the extension requests access to that single origin through the browser's own permission prompt, and only the notification's title and text are POSTed to it (no cookies, no referrer, no library data). The address is stored locally and excluded from every export and sync. If the user never sets a webhook, no network request is ever made under this permission. A broad optional pattern is required because the address is chosen by the user and cannot be known in advance.

### No host permission for the price comparison (`www.cheapshark.com`)
> The optional cross-store price comparison asks CheapShark's public deals API, which allows cross-origin reads, so the extension declares no host permission for it (version 4.5.1 removed the old one, and the unused `activeTab` permission). Only the game's title is sent, as a public GET request; no user data, cookies or account information. Toggle off in the popup.

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

Ten screenshots per language are in `store/screenshots/en/` and `store/screenshots/he/`
(`01-catalog` … `10-whats-new`, 1280×800); upload the set that matches each listing language.
They are generated by `node e2e/store-screenshots.mjs` from real gog.com pages with **demo data** in the
extension's own panels — no personal account, wishlist or library appears in them.
Re-run it after a UI change and re-upload the files in the dashboard. The DRM-free
banner is pinned to the bottom edge of the page, so it appears at the bottom of the
currency-banner shot. Optional extra shots: the Hebrew/RTL home page, the theme picker
in Advanced Options (eleven themes), and the dashboard's year-in-review.

### Promo tile (optional but strongly recommended)

- **`promo-small-440x280.png`** and **`promo-marquee-1400x560.png`** (plus the Hebrew `*.he.png` versions) are drawn by `store/brand/promo.py`; the store logo is `store/logo-128x128.png`. Re-run `uv run --with pillow python store/brand/promo.py` after any design change.

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
- [ ] This is an update to a live listing: 4.5.1 **removes** two permissions (`activeTab`, the CheapShark host), so users see no new prompt; any later change that adds a permission or host re-prompts every user.

Reviews for permission expansions typically take 5–10 business days instead of the usual 1–2; an update that only removes permissions is usually quick.
