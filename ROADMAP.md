# Roadmap

A status list for **GOG Enhancer**, an unofficial, privacy-first extension for gog.com. It shows what has shipped, what is being finished, and what is still an idea. There are no dates, and items can change or be dropped. The detailed history is in [`docs/changelog.html`](docs/changelog.html) and in the extension's in-app "What's new" panel.

Last updated for **v4.5.1**.

## Shipped

- **2.5** — Lowest-price badge, stale-rate warning with the exact rate, tag-colour dot on store cards, shareable tag packs.
- **2.6 – 2.9** — Genre-aware card styling, safer settings import, command palette (Ctrl/⌘ + K), wishlist-wide price alerts, play status, auto theme, wishlist deals and a "worth waiting?" verdict, type-checked code.
- **3.0** — CheapShark price table and deal score, sale calendar, encrypted backup, spending tracker, achievements, custom theme.
- **4.0** — Rebuilt for gog.com's redesign behind one site adapter; library learning and pack contents; folder sync; privacy dashboard; notification pipeline; opt-in endless scrolling; calendar files; keyboard access.
- **4.5** — Input validation on every import path, a calmer insights panel, working endless scrolling, live exchange rates in 24 currencies, nine interface languages, two new themes, quiet weekdays, copy / summary / pick helpers, a "what's new" tab after each update, and fewer permissions (`activeTab` and the CheapShark host permission were removed).
- **4.5.1** — Options-page rate boxes, new logo and icons, translated changelog and README in all nine languages.

## In progress

- **Store submission of 4.5.x.** 4.5.0 is tagged and released on GitHub; 4.5.1 is on `main` and not yet tagged or submitted. A release needs the maintainer's go-ahead.
- **Hardening and cleanup follow-ups** from a post-release review of the extension. Fixed ones land in normal releases and are described in the changelog.
- **Development tooling.** Dependency updates for test and lint tools, including a test-environment upgrade that needs some DOM tests adapted first.

## Open

- **Edge Add-ons submission.**
- **A real Firefox run.** The Firefox build is experimental and has not been exercised in a real Firefox.
- **Native-speaker review** of the non-English translations.
- **Real-world runs** of folder sync with a cloud-synced folder and of the optional webhook (both need browser permission prompts that automated tests cannot answer).

## Ideas, not started

- **Regional price comparison** ("cheaper in another region"). Prices can already be shown in several currencies, but there is no comparison.
- **Bundle value.** A pack's real contents and overlap with games you own are shown, but not a total against the bundle price.
- **Play queue** and **draggable dashboard widgets.**
- **Rules builder** for custom tags and alerts.
- **Lowest price ever, across stores.** The cross-store comparison and deal score exist; a true all-time low is not shown.

## Not planned

- Anything that needs your GOG account password or sends your library to a server. The extension stays local-first.
- New host permissions for convenience. The default answer is no.

Ideas and bug reports are welcome as [issues](https://github.com/DrummingBird1/GOGEnhancer/issues).
