# Privacy Policy — GOG Enhancer

**Last updated:** May 6, 2026
**Extension version:** 2.0.3+
**Contact:** [insert your contact email or GitHub issues URL before publishing]

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
does not share your data with anyone. It makes exactly two kinds of network
requests, both to public unauthenticated endpoints, both of which transmit
*no information about you*: (a) currency exchange rates from
`api.frankfurter.app`, and (b) a periodic read of the public GOG mods page
at `gog.com/en/mods`.

---

## 2. Data stored on your device

All of the following is kept locally on your device using the Chromium
storage API. Nothing in this list ever leaves your computer through this
extension:

| What | Where | Why |
|---|---|---|
| Your settings (which features are on, currency choice, VAT rate, region preset) | `chrome.storage.sync` | So your preferences survive across devices if you are signed into Chrome with sync enabled |
| Tags and notes you add to games | `chrome.storage.local` | Personal organization on the GOG store |
| Price snapshots from game pages you visit | `chrome.storage.local` | Personal price-history charts (max 30 snapshots per game) |
| Cached list of moddable games | `chrome.storage.local` | To show the "★ MOD" badge without re-fetching constantly |
| Cached count of discounted wishlist items | `chrome.storage.local` | To set the toolbar badge counter |
| Cached currency exchange rates | `chrome.storage.sync` | So we don't refetch on every page |
| Onboarding completion flag | `chrome.storage.sync` | So we don't show the welcome wizard twice |

You can wipe all of this at any time from the **Advanced Settings** page
(toolbar icon → Advanced → Reset everything).

If you sign out of Chrome sync, the `chrome.storage.sync` portion is removed
from Google's servers per Google's Chrome Sync policy, which is independent
of this extension.

---

## 3. Network requests we make

The extension makes network requests to exactly two destinations. Both are
public endpoints. Neither receives any identifying information from us.

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

---

## 4. Permissions we request and why

| Permission | Why we need it |
|---|---|
| `storage` | To save your settings, tags, notes, and price history on your device |
| `activeTab` | When you click the toolbar icon, this lets the popup reload the active tab if you press the "Reload tab" button |
| `alarms` | To schedule the periodic FX-rate refresh and mods-list refresh in the background |
| Host permission for `https://www.gog.com/*` | To run the content script on GOG pages and to fetch the public `/en/mods` page in the background |
| Host permission for `https://api.frankfurter.app/*` | To fetch currency exchange rates |

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
- We do **not** read your GOG account information, your purchase history,
  your library, your payment methods, or your messages.
- We do **not** track which games you view, search for, or wishlist on
  any server.
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
