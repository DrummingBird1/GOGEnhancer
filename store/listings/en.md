# Chrome Web Store — English (en)

Paste the summary and the description below into the Developer Dashboard. The English text is the dashboard's default ("all languages"); the Hebrew one goes under the Hebrew translation. The permission justifications and the submission checklist are in `../STORE_LISTING.md`.

**Short description (max 132 characters)**

```
Unofficial GOG.com helper: live currency conversion, price history, deal checks, personal tags and notes. No tracking or ads.
```

**Description**

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
