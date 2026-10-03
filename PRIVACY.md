# Privacy Policy — GOG Enhancer

**Last updated:** October 3, 2026
**Extension version:** 4.0.0+
**Contact:** https://github.com/DrummingBird1/GOGEnhancer/issues

GOG Enhancer is an unofficial third-party browser extension that enhances the
shopping experience on GOG.com. It is not affiliated with, endorsed by, or
sponsored by GOG sp. z o.o. or CD Projekt S.A.

This document describes, in plain language, exactly what data the extension
handles, where it goes, and what we do *not* do. It is the source of truth
for our data practices. If anything in the code contradicts what is written
here, that is a bug — please file an issue.

---

## 1. Summary in one paragraph

GOG Enhancer stores all of your data on your own device. It does not have a
server, does not log anything, does not use analytics, does not show ads, and
does not share your data with anyone. It makes a small, fixed set of network
requests, all to public unauthenticated endpoints, none of which transmit
information about *you*: (a) currency exchange rates from
`api.frankfurter.app`, (b) a periodic read of the public GOG mods page at
`gog.com/en/mods`, and (c), if you leave the "Price comparison table" feature
on, a per-game title search against `cheapshark.com`'s public deals API when
you open a game page. Two more go to GOG's own public APIs and exist only for
features you can switch off: (d) `api.gog.com`, asked once per game page which
games a pack contains (only its numeric product id is sent), and (e)
`catalog.gog.com`, asked for the next page of a catalog list only if you turn
on endless scrolling (off by default) — section 3.8. One further request
exists only if *you* set it up: an optional webhook to an `https://` address
that you type yourself (section 3.7); it is off, and has no permission, until
you do. Every request is listed on the Advanced Options page
(Privacy & transparency).

---

## 2. Data stored on your device

All of the following is kept locally on your device using the Chromium
storage API. Nothing in this list ever leaves your computer through this
extension:

| What | Where | Why |
|---|---|---|
| Your feature toggles (which UI pieces are on, including the refund timer and desktop notifications switches) | `chrome.storage.sync` | So your preferences survive across devices if you are signed into Chrome with sync enabled |
| Your currency choice, VAT rate, region preset, and selected theme | `chrome.storage.sync` | Same — small preferences that should travel with you |
| Tags, per-tag colors, your custom tag ordering, and notes you add to games | `chrome.storage.local` | Personal organization on the GOG store |
| Price snapshots from game pages you visit | `chrome.storage.local` | Personal price-history charts (up to 100 snapshots per game; duplicates of the same price are collapsed) |
| Manual purchase dates you enter for the refund-window timer | `chrome.storage.local` | Local-only countdown of GOG's 30-day refund window |
| Dedup log for desktop notifications you've already received | `chrome.storage.local` | So we don't fire the same alert twice |
| Cached list of moddable games | `chrome.storage.local` | To show the "★ MOD" badge without re-fetching constantly |
| Cached count of discounted wishlist items | `chrome.storage.local` | To set the toolbar badge counter |
| Cached currency exchange rates and the last fetch error (if any) | `chrome.storage.sync` | So we don't refetch on every page; the error string lets the popup tell you when the rate refresh failed |
| Onboarding completion flag and the verbose-logging toggle | `chrome.storage.sync` | So we don't show the welcome wizard twice; the debug toggle is yours to flip in Advanced Options |
| Tag-dashboard density preference (comfortable / compact) | `chrome.storage.local` | Per-device UI preference — the dashboard remembers your choice between visits |
| Your custom theme colors, dyslexia-friendly font choice, and unlocked achievements | `chrome.storage.sync` / `chrome.storage.local` | Same categories as above — preferences sync, personal progress stays local |
| One optional photo you attach to a game's note in the tag dashboard | `IndexedDB` (a separate local database, not `chrome.storage`) | Images are downscaled on your device before saving; `chrome.storage`'s ~5&nbsp;MB total quota is too small for photos, so this uses its own local storage bucket instead. Still never leaves your device, and "Reset everything" deletes it too (best-effort — instantly if no other GOG Enhancer tab is open, otherwise once you close the others) |
| Per-record "last edited" timestamps for tags, notes, status, purchases and alerts | `chrome.storage.local` | Only used to merge changes correctly if you turn on folder sync (below); stamped locally, never sent anywhere by this extension |
| A browser-held reference to the sync folder you picked, its display name, and when you last synced | `IndexedDB` (the reference) and `chrome.storage.local` (name, time) | So you don't have to pick the folder again each time. The reference is only usable by this extension, and only for the one folder you chose |
| Which games the site showed you as **already in your library** (a list of game slugs and the date first seen) | `chrome.storage.local` | Read from the "IN LIBRARY" label and owned status that gog.com itself displays on pages **you** open — see the note below. Powers hiding owned games, library statistics and the language / "similar games you own" features |
| Facts a game page states when you open it: ratings, languages, time to beat, tags, release year, the price shown and when its offer ends (for up to 800 games), plus the previous visit's price and rating | `chrome.storage.local` | To show "what changed since your last visit", the language check and the offer countdown without fetching anything |
| Games you marked "not interested", saved catalog filter presets, price-drop rules by tag, status-change dates, a monthly "games to finish" goal, and earlier versions of your notes | `chrome.storage.local` | Your own library tools, kept on this device |
| What a pack contains (game ids, slugs and titles), per game page you opened, for 30 days | `chrome.storage.local` | The answer GOG's product API gave (section 3.8), so the "you already own part of this pack" warning doesn't ask again |
| The date each game is released on GOG, read from the game page you opened | `chrome.storage.local` (inside the game facts above) | Only to build the optional wishlist release-date calendar you can download |
| A list of the extension's own recent network requests: when, which address and path (never the query), and whether it worked — at most 120 entries | `chrome.storage.local` | So you can see exactly what it contacted (Advanced Options → Privacy & transparency). Cleared by "Clear the request list" and "Reset everything" |
| Your computer description if you choose to type one (operating system, processor, graphics card) | `chrome.storage.local` | Compared as plain text with a game's requirements; never read from your machine automatically and never sent anywhere |
| Notification rules (quiet hours, a one-summary-a-day mode, thresholds, season radar), notifications held back until their time, and display preferences (calm mode, plain look, palette, text size, panel order and fold state, profiles, the tour-seen flag) | `chrome.storage.sync` / `chrome.storage.local` | So the extension behaves the way you asked and notifications arrive when you wanted them |
| The address of your own webhook, and whether it is switched on | `chrome.storage.local` | Only if you set one up (3.7). It is a secret: it is **never** written to a backup, an export or the sync file, and is ignored if found in one |
| Which conflicts the last folder sync had to resolve, the timestamps it compared them to, and whether auto-sync and dated backups are switched on | `chrome.storage.local` | So the options page can tell you what was overwritten. Per-browser: never exported or synced |

**What "already in your library" means.** GOG Enhancer does **not** log in to your GOG account, call GOG's account API or read your order history. gog.com itself marks games you own ("IN LIBRARY") on the pages it shows you. The extension notices that mark while you browse and remembers it locally, so it can hide or dim games you own. It is never sent anywhere by this extension, it is not transmitted to CheapShark or to a webhook, and catalog pages can only ever *add* to it (a tile without the mark might just mean you are logged out); a refunded game is removed only when you open its own page while logged in. "Reset everything" deletes it.

**Folder sync (optional, off until you pick a folder).** If you choose a sync folder, the extension reads and writes one file in it, `gog-enhancer-sync.json`, containing your tags, notes, play status, purchase dates and prices, price alerts and price history (and, if you enable them, dated backup copies of your data in the same folder). It can do so automatically — when you open the tag dashboard and every 30 minutes in the background — but only while your browser still remembers the permission you gave for that folder, and only if the file isn't passphrase-encrypted (the extension never stores your passphrase). Otherwise it waits until you press "Sync now". That file is **in a folder you control**: if that folder is inside Dropbox, OneDrive, Google Drive or similar, that service's own policy then applies to the file. GOG Enhancer itself makes no network request for this and never receives the file. You can encrypt it with a passphrase (AES-256-GCM, on-device; the passphrase is never stored). Without a folder chosen, nothing is written outside the browser.

The **address-bar keyword** (`gog`) searches the same local data and sends it nowhere. The **calendar (.ics) and Markdown exports** are built on your device and saved as files you download.

You can wipe all of this at any time from the **Advanced Settings** page
(toolbar icon → Advanced → Reset everything). You can also back it all up to
a file — plain JSON, or password-encrypted (AES-256-GCM, entirely on-device
via the browser's own Web Crypto API — no server, no key ever transmitted
anywhere) — from the same page's "Export everything" buttons.

If you sign out of Chrome sync, the `chrome.storage.sync` portion is removed
from Google's servers per Google's Chrome Sync policy, which is independent
of this extension.

---

## 3. Background jobs and network requests

The extension runs several background jobs on a schedule. Two make network
requests (to two destinations only — both public, both unauthenticated);
the others are entirely local (the notification-delivery job, the 30-minute
folder auto-sync and the weekly digest included). A further, non-scheduled
request happens directly from the game-page content script itself — see 3.3
below — and one more exists only if you set up your own webhook (3.7).

### 3.1 `api.frankfurter.app` — currency exchange rates

- **What is sent:** A simple `GET https://api.frankfurter.app/latest?from=USD&to=ILS,EUR,GBP,PLN`. No headers identifying you, no cookies, no referrer linking back to you, no User-Agent uniqueness.
- **What is received:** A small JSON object with the day's published exchange rates from the European Central Bank.
- **Frequency:** Once every 12 hours, plus once when you press "Refresh rates" manually.
- **Why frankfurter.app:** They are a public, unauthenticated, ad-free, ECB-backed rate service that requires no API key. Their privacy policy is at https://www.frankfurter.app/.
- **What this could reveal:** Your IP address (as with any HTTP request from a browser). The service has no way to associate that IP with your identity, your GOG account, or any of your data inside this extension.

### 3.2 `www.gog.com/en/mods` — moddable games list

- **What is sent:** A standard `GET https://www.gog.com/en/mods` with `credentials: "omit"` (no cookies). This is the same request anyone gets when visiting that public page.
- **What is received:** The HTML of the public mods catalog page, which we parse to extract game slugs.
- **Frequency:** Once every 24 hours, plus when you press "Refresh mods" manually in Advanced Settings.
- **Why:** To keep the list of "★ MOD" badges accurate without your having to visit `/mods` yourself.
- **What this could reveal:** That you visited a public page. GOG cannot tie this request to your account because we explicitly omit your cookies.

### 3.3 `www.cheapshark.com` — cross-store price comparison

- **What is sent:** A `GET https://www.cheapshark.com/api/1.0/deals?title=<game title>&limit=30`, sent directly from the game-page content script (not the background service worker). No cookies, no API key (CheapShark's deals endpoint is keyless), no header identifying you beyond what your browser always sends on every request (its own User-Agent string — this cannot be changed or made more unique by the extension; `fetch()` cannot override the User-Agent header).
- **What is received:** A JSON list of that title's listings across other storefronts (Steam, Epic, Humble Store, Fanatical, GreenManGaming), used to render the "Compare prices" table on the game page.
- **Frequency:** Once per game page you open, only while the "Price comparison table" toggle (on by default) is enabled in the popup.
- **Why CheapShark:** A free, keyless, public deal-aggregation API — no account or paid tier required, so no shared secret ships inside the extension.
- **What this could reveal:** Your IP address and the title of the game page you're viewing, to CheapShark's servers, the same as visiting any public website. CheapShark has no way to tie that to your GOG account or any other data this extension holds.

### 3.4 Wishlist badge refresh — *no network request*

- **What happens:** Every 6 hours we read the locally-cached count of discounted wishlist items (last seen when you visited `/account/wishlist`) and update the toolbar badge text. If the cache is older than 24 hours, the badge is cleared and the tooltip tells you to revisit your wishlist.
- **Why it's not a network request:** GOG's wishlist page is an Angular app — the items only render in the live page DOM. We can't fetch it server-side meaningfully, so we don't try. The content script reports the count next time you actually visit the page.

### 3.5 Daily refund-window check — *no network request*

- **What happens:** Once a day, we walk the `purchaseLog` you've entered manually and compare each entry to today's date. If your opt-in "Desktop notifications" toggle is on AND any entry has 1–2 days left of GOG's 30-day refund window, we fire a local `chrome.notifications.create` so you know to decide on the refund. We also dedupe via the local `notifLog` so the same alert never fires twice.
- **Why it's not a network request:** Everything happens inside the browser. `chrome.notifications` is local to your machine. No data goes anywhere.

### 3.6 Sync through a folder you choose — *no network request by us*

- **What happens:** Only when you press "Sync now" on the options page, the extension reads `gog-enhancer-sync.json` from the folder you picked, merges it with your local data, and writes back whichever side changed. Folder access is granted by you through the browser's own folder picker, one folder at a time, and can be revoked in the browser or by pressing "Stop syncing".
- **Why it's not a network request:** Everything happens against files on your own disk. If your folder is synced by a cloud client, that client — not this extension — does the uploading.
- **Automatic runs (since v4):** if you switch on "Sync automatically", the same read-merge-write also runs when you open the tag dashboard and every 30 minutes in the background, and "Keep dated backups" additionally writes timestamped copies into the same folder (keeping the number you choose). The background run cannot show a permission prompt or ask for a passphrase, so it simply does nothing when either is needed.

### 3.7 Your own webhook — *optional, off by default, requires your approval*

- **What happens:** If you enable "Also send notifications to my own webhook" in Advanced Options and type an `https://` address (a Discord webhook, an IFTTT/Zapier hook, your own server…), the extension sends each notification — in addition to, or instead of, the on-screen one, depending on whether you also enabled desktop notifications — to that address as a small JSON `POST` (no cookies, no referrer).
- **What is sent:** Only the notification's title and text (for example "A Witcher game dropped 40%"). Not your library, not your tags or notes, not your settings, not an identifier.
- **Permission:** Nothing is requested at install. When you save the address, the browser asks you — once — to allow access to **that one origin** (this is the manifest's `optional_host_permissions`; it is never granted in advance, and you can revoke it in the browser at any time). The address is stored only on this device and is never included in a backup, an export or the sync file.
- **Who receives it:** Whoever runs the address you typed. That service's own policy applies; GOG Enhancer has no say in, and no visibility of, what it does with the text. A "Send a test" button in the same place sends a fixed test message.

### 3.8 GOG's own APIs — `api.gog.com` and `catalog.gog.com`

- **What they are:** the same public, unauthenticated endpoints gog.com's own pages call. They are requested from the gog.com page itself, so the browser applies to them the same cross-origin rules as to the site; they need **no additional permission**, and every request is sent without cookies and without a referrer.
- **`api.gog.com` — pack contents.** `GET https://api.gog.com/v2/games/<numeric product id>?locale=en-US`, once per game page you open (the answer is remembered for 30 days) and, when the page is a pack, once more for each game it includes (at most 12). Only the numeric product id — which is in the page's own address and markup — is sent. It is used to tell you when a pack contains games you already own. Switch it off with "Warn about packs that overlap my library" (on by default).
- **`catalog.gog.com` — endless scrolling.** `GET https://catalog.gog.com/v1/catalog?…` with the same filter and sort parameters the catalog page you are looking at already uses, plus a page number — only while "Endless scrolling" is on (off by default), once each time you scroll to the end of the list. It continues the list you are already viewing and appends nothing it cannot match to it.
- **What this could reveal:** your IP address and the product id or catalog filters of pages you are already viewing, to GOG — the company whose site you are on, not a new third party.
- **Frequency and visibility:** only as described; each request appears in the list under Advanced Options → Privacy & transparency.

---

## 4. Permissions we request and why

| Permission | Why we need it |
|---|---|
| `storage` | To save your settings, tags, notes, and price history on your device |
| `activeTab` | When you click the toolbar icon, this lets the popup reload the active tab if you press the "Reload tab" button |
| `alarms` | To schedule four periodic background jobs: exchange-rate refresh (12 h), mods-catalog refresh (24 h), wishlist sale-count badge update (6 h), and a once-daily local check for refund windows about to close |
| `notifications` | **Opt-in only.** When you enable "Desktop notifications" in Advanced Options, the extension can show a system notification when a refund window has 1–2 days left or when new wishlist items go on sale. Uses `chrome.notifications`, which is local to the browser — nothing is transmitted off-device. Off by default. |
| Host permission for `https://www.gog.com/*` | To run the content script on GOG pages and to fetch the public `/en/mods` page in the background |
| Host permission for `https://api.frankfurter.app/*` | To fetch currency exchange rates |
| Host permission for `https://www.cheapshark.com/*` | To fetch the cross-store price comparison table shown on game pages (opt-out toggle in the popup) |

| Optional host permission for `https://*/*` | **Optional and never granted at install.** Declared as `optional_host_permissions` so that, *only if you enter your own webhook address*, the browser can ask you to allow that single origin. Without it nothing can be sent anywhere new. |

GOG's own APIs (3.8), folder sync (including its automatic and backup modes) and the address-bar keyword need **no additional permission**: folder access is granted per folder by you through the browser's folder picker, and the omnibox keyword is declared in the manifest without a permission.

We do not request any other permissions. In particular we do not request
`tabs` (full tab access), `webRequest` (network interception), `cookies`
(cookie reading), `history` (browsing history), or `<all_urls>` host access.

---

## 5. Things we do not do

- We do **not** run analytics. There is no Google Analytics, no Mixpanel,
  no Sentry, no PostHog, no first-party telemetry, nothing.
- We do **not** show ads or accept payments from publishers/storefronts to
  highlight or hide products.
- We do **not** load any code from a remote source. All JavaScript that runs
  is shipped inside the extension and reviewed by Chrome at install time.
- We do **not** log in to, call or scrape your GOG account: no order history,
  no payment methods, no messages. The only library information the extension
  holds is the "already in your library" marks that gog.com itself shows on
  pages you open, remembered **on your device** (see section 2).
- We do **not** send which games you view, search for, own or wishlist to any
  server — including the optional webhook, which receives notification text only.
- We do **not** receive your synced library: the sync file lives only in a folder you chose, and we have no server it could be sent to.
- We do **not** sell, trade, or rent data, because we have no data to sell.
- We do **not** load any third-party fonts (no Google Fonts requests).
  All fonts are system fonts.

---

## 6. Children

The extension is not directed at children under 13 and does not knowingly
process data from anyone under 13. It also does not collect age information.

---

## 7. Changes to this policy

If we change what data the extension handles, this file will be updated and
the version number at the top will change. Significant changes will also
appear in the README changelog.

---

## 8. Open source

The full source code of this extension is open. You can verify everything
this document claims by reading the code.

---

*This privacy policy is written by the developer and reflects current behavior of the extension. It is not legal advice.*
