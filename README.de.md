<p align="center">
  <img src="docs/assets/hero-icon.png" width="96" height="96" alt="GOG Enhancer logo" />
</p>

<h1 align="center">GOG Enhancer</h1>

<p align="center">
  <a href="https://github.com/DrummingBird1/GOGEnhancer/blob/main/extension/manifest.json"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FDrummingBird1%2FGOGEnhancer%2Fmain%2Fextension%2Fmanifest.json&query=%24.version&label=version&color=c64fff" alt="version" /></a>
  <img src="https://img.shields.io/badge/manifest-v3-00f0ff" alt="Manifest V3" />
  <a href="https://github.com/DrummingBird1/GOGEnhancer/actions/workflows/test.yml"><img src="https://img.shields.io/github/actions/workflow/status/DrummingBird1/GOGEnhancer/test.yml?branch=main&label=tests&color=7fffa6" alt="tests" /></a>
  <a href="https://github.com/DrummingBird1/GOGEnhancer/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-ff6b9d" alt="MIT license" /></a>
</p>

<p align="center">Chromium-based browsers (Chrome, Edge, Brave, Opera)</p>

<p align="center"><a href="README.md">English</a> · <a href="README.he.md">עברית</a> · <a href="README.ru.md">Русский</a> · <a href="README.pl.md">Polski</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.pt-BR.md">Português (Brasil)</a></p>

Eine inoffizielle Erweiterung für GOG.com von Dritten: Währungsumrechnung zu aktuellen Kursen, Preisverlauf, Preisvergleich mit anderen Shops, eigene Tags, eine umfassende optische Aufwertung, Hebräisch + RTL — ganz ohne Google Fonts und ohne Analytics.

> **Haftungsausschluss:** Dies ist eine inoffizielle Erweiterung von Dritten. Sie steht in keiner Verbindung zu GOG sp. z o.o. oder CD Projekt S.A. und wird von diesen weder unterstützt noch gesponsert. Der Name „GOG“ wird nur verwendet, um den Shop zu bezeichnen, mit dem die Erweiterung arbeitet.

---

## 📂 Inhalt des Repositorys

| Datei / Ordner | Zweck |
|---|---|
| **`extension/`** | **Die auslieferbare Erweiterung** — `manifest.json` plus `background/`, `content/`, `lib/`, `popup/`, `options/`, `onboarding/`, `tags/`, `tour/`, `icons/`. Diesen Ordner lädst du mit „Entpackte Erweiterung laden“, und er wird auch zur ZIP-Datei gepackt. |
| **`store/`** | Store-Material, das **nicht** zur Erweiterung gehört: `STORE_LISTING.md` (Texte für das Dashboard), `listings/` (Store-Beschreibung, eine Datei pro Sprache), `screenshots/` (zehn pro Sprache, erzeugt von `e2e/store-screenshots.mjs`), `brand/` (Logo und Werbebilder), `release-images/` (Release-Banner, siehe `CLAUDE.md`). Wird separat hochgeladen und nie in die ZIP-Datei gepackt. |
| **`docs/`** | Die Website der Erweiterung auf GitHub Pages — Startseite, Anleitung, Datenschutzerklärung, Änderungsprotokoll. |
| `PRIVACY.md` | Datenschutzerklärung (auch unter einer öffentlichen Adresse erreichbar: `docs/privacy.html`) |
| `README.he.md`, `README.ru.md`, `README.pl.md`, `README.de.md`, `README.fr.md`, `README.es.md`, `README.zh-CN.md`, `README.pt-BR.md` | Vollständige Übersetzungen dieser Datei, je eine pro Oberflächensprache |
| `LICENSE` | MIT-Lizenz |
| `build.ps1` | Build-Skript — packt `extension/` in `dist/gog-enhancer-webstore.zip` (`node scripts/build-firefox.mjs` baut die experimentelle Firefox-ZIP) |
| `scripts/`, `e2e/` | Release-Skript (`release.mjs`), der Firefox-Build und die End-to-End-Werkzeuge: die Playwright-Suite (Fixtures, Live-Seite, angemeldet), ein Performance-Budget, ein Struktur-Rekorder, Screenshot-Regression, ein Textsammler für die Übersetzungen und der Store-Screenshot-Generator. Nur lokal, nichts davon wird ausgeliefert. |
| `dist/` | Build-Ergebnisse (in gitignore). Von `build.ps1` erzeugt |
| `tests/`, `package.json`, `vitest.config.js`, `eslint.config.js` | Vitest und ESLint für die reinen Hilfsmodule. Nicht in der ZIP der Erweiterung enthalten. |
| `.github/workflows/` | GitHub Actions: `test.yml` führt Lint und Tests bei Push/PR aus, `release.yml` baut die ZIP und veröffentlicht ein Release beim Push eines `v*.*.*`-Tags, `canary.yml` ist eine geplante Prüfung der Live-Seite |
| `CLAUDE.md` | Projektnotizen für KI-Assistenten |
| `README.md` | Englische Fassung dieser Datei |

---

## ✨ Funktionsübersicht

### Architektur
- **Eine einheitliche Speicherschicht** — Einstellungen in `storage.sync` (leicht, geräteübergreifend synchronisiert), umfangreichere Daten (Tags, Verlauf, Caches) in `storage.local`. Keine der Quoten wird überschritten.
- **Versionierung und Migration der Einstellungen** — beim Update von v1 werden Tags und Notizen automatisch von sync nach local verschoben.
- **Nur Systemschriften** — keinerlei Abhängigkeit von Google Fonts, kein nachgeladener Code, keine Analytics.
- **Eine Netzwerkschicht** (`lib/net.js`) — jede Anfrage der Erweiterung läuft darüber: eine Positivliste mit fünf Hosts, keine Cookies, kein Referrer, ein Timeout und ein lokales Protokoll aus Host + Pfad (nie die Abfrage), das die Seite für erweiterte Einstellungen anzeigt. Ein Test bricht den Build ab, wenn sich eine Berechtigung oder ein Host ändert, ohne dass die Datenschutzdokumente das widerspiegeln.
- **Ein Seitenadapter** (`content/gog-dom.js`) — jede Suche im Markup von gog.com (Karten, Preise, Titel, Position des Panels) probiert mehrere Strategien, sodass ein Redesign die Funktionen eher abschwächt, als sie unbemerkt zu zerstören. „Diese Seite prüfen“ in den erweiterten Einstellungen zeigt, welche Suchen noch funktionieren.
- **Fokussierter `MutationObserver`** auf dem Seiteninhalt mit Debouncing; Kopfzeilen-Rauschen wird herausgefiltert, ein ausgetauschtes `<main>` wird erkannt.
- **Jede Funktion läuft isoliert** — bricht nach einer Seitenänderung eine Suche, wird nur diese Funktion abgeschaltet, der Rest läuft weiter; „Diese Seite prüfen“ listet auf, was ausgefallen ist.
- **Lernt nur von Seiten, die du selbst öffnest** — Besitz, Bewertungen, Sprachen und Preisfakten werden von Seiten gelesen, die du selbst besuchst, und lokal gespeichert. Die Erweiterung ruft dafür nichts zusätzlich ab.

### Funktionen
- 💱 **Aktuelle Wechselkurse für 24 Währungen** — Schekel, Euro, Pfund, Złoty, Rubel, Real, Yen, Yuan und mehr, automatisch alle 12 Stunden von `api.frankfurter.dev` abgerufen. Manuell bearbeitbar.
- 📈 **Preisverfolgung** — jeder Besuch einer Spieleseite speichert einen Messpunkt. Ein Statistikpanel auf der Spieleseite zeigt aktuellen Preis, historischen Tiefstpreis und Durchschnitt sowie ein „Lohnt sich das Warten?“-Urteil.
- 🔍 **Vergleich bei IsThereAnyDeal** — ein Button auf der Spieleseite sucht denselben Titel bei Steam / Epic / Humble / Fanatical.
- 🏷️ **Vollständiges Tag-Dashboard** — eine eigene Seite mit Suche, Filtern, Zähler je Tag und CSV-Export. Autovervollständigung für vorhandene Tags.
- 🔔 **Wunschlisten-Angebote und -Alarme** — ein Badge auf dem Symbol der Symbolleiste zählt reduzierte Wunschlisten-Titel; das Popup zeigt deine drei größten Preissenkungen unter den verfolgten Spielen.
- 🛡️ **DRM-free-Banner** — ein durchgehendes Banner mit Schildsymbol und einer „GOG+“-Pille mit Farbverlauf.
- 🎨 **Optische Aufwertung der Karten** — spielabhängig: „Good Old Game“ bekommt einen dezenten CRT-Effekt und einen goldenen Schein; Cyberpunk-/Witcher-Titel ein Cyan/Magenta-Neonleuchten.
- 🪟 **Gestaltete Tooltips** — ersetzen die Standard-Tooltips des Browsers, mit Überschriften, reichem Inhalt und automatischer Positionierung.
- 📋 **Dynamische Mod-Liste** — wird alle 24 Stunden automatisch von `gog.com/en/mods` gelesen.
- 🌍 **Automatische Währungserkennung auf der Seite** — zeigt GOG bereits EUR an (Nutzer in der EU), rechnet die Erweiterung nicht noch einmal um.
- 🎯 **Echtes RTL** — `inline-start`/`end` statt `left`/`right` und `unicode-bidi: isolate` für Preise.
- ⌨️ **Tastenkürzel** — `Alt+G` öffnet das Popup, `Alt+Shift+G` schaltet die Erweiterung ein/aus, `Alt+Shift+H` schaltet Hebräisch um; `Strg/Cmd+K` öffnet eine Befehlspalette für alles andere.
- 🧙 **Einrichtungsassistent** — 4 Schritte (Währung, Region, Funktionen, Design), öffnet sich bei der Erstinstallation automatisch.
- ☁️ **Sync zwischen Geräten über einen Ordner deiner Wahl** (Dropbox, OneDrive, Google Drive, Syncthing …) — führt Tags, Notizen, Status, Käufe, Alarme und Preisverlauf Datensatz für Datensatz zusammen, auf Wunsch verschlüsselt. Es steht nichts von uns dazwischen. Chrome / Edge / Brave.
- 🔎 **Bibliothekssuche in der Adressleiste** — `gog` + Tab eingeben, dann einen Spielnamen, `tag:rpg` oder `status:backlog`.
- 🎨 **Native-Design** — übernimmt die Farben und die Schrift von gog.com selbst, sodass sich die eingefügten Elemente in jedes künftige Aussehen der Seite einfügen.
- ⌨️ **Tastaturnavigation** (optional) — `J`/`K` wechseln zwischen Spielen in einer Liste, `T` versieht das fokussierte mit einem Tag.
- 📅 **Kalenderdateien (`.ics`)** für Rückgabefristen und die Erscheinungstermine von Wunschlisten-Spielen sowie 📝 **Markdown-/Obsidian-/CSV-Exporte** aus dem Tag-Dashboard — alles auf deinem Gerät erzeugt.
- 🌍 **Neun Oberflächensprachen** — Tag-Dashboard, erweiterte Einstellungen, Popup, Einrichtungsassistent und die eigenen Texte der Erweiterung auf gog.com auf Englisch, Hebräisch (rechts nach links), Russisch, Polnisch, Deutsch, Französisch, Spanisch, vereinfachtem Chinesisch und brasilianischem Portugiesisch. Was du selbst schreibst (Tag-Namen, Notizen), wird nie übersetzt.
- 🔒 **Datenschutz-Dashboard** in den erweiterten Einstellungen — jede Adresse, die die Erweiterung kontaktiert hat, was sie auf deinem Gerät speichert und wie viel, welchen zusätzlichen Seitenzugriff Chrome ihr gewährt hat, und Löschen mit einem Klick.
- 🩺 **Fehlerbericht** — wenn eine Funktion nach einer Seitenänderung nicht mehr funktioniert, bietet das Popup einen Bericht mit einem Klick, ohne Webadressen und ohne persönliche Daten („Auf GitHub melden“ öffnet nur eine Seite mit vorausgefülltem Text).
- 🖥️ **Systemcheck** auf Spieleseiten — vergleicht die RAM-Anforderung eines Spiels mit dem, was dein Browser meldet (CPU und GPU sieht ein Browser nicht). Beschreibe deinen Rechner in den erweiterten Einstellungen, dann werden RAM- und Speicherplatzanforderungen damit verglichen; Betriebssystem, Prozessor und Grafikkarte werden neben der Anforderung angezeigt, aber nicht bewertet — eine Schätzung.

#### Angebote und Preise (v4)
- 💸 **„Ist der Rabatt echt?“** — vergleicht den Grundpreis mit GOGs eigenem Tiefstpreis der letzten 30 Tage und deinem verfolgten Verlauf; ⏳ **Angebots-Countdown** auf der Spieleseite, auf Karten und im Digest.
- **Preis pro Spielstunde**, **Preis in mehreren Währungen** gleichzeitig, ein **Sale-Rhythmus** je Spiel, ein **Vergleichsdiagramm** für 2–3 Spiele, **„So viel habe ich gespart“**-Summen und nationale **MwSt.-Voreinstellungen** (DE, FR, ES, IT, NL, RU).

#### Wunschliste und Katalog (v4)
- 💖 **Intelligente Wunschliste** — Sortierung nach Rabatt / Abstand zum Tiefstpreis / umgerechnetem Preis / Hinzufügedatum, Filter „nahe am Tiefstpreis“ und „endet bald“, eine Live-Summe, Gruppierung nach Tag oder Status, Export als CSV / Markdown / `.ics`.
- 🗂️ **Katalogwerkzeuge** — eine Leiste über dem Raster: Spiele, die du besitzt, abdunkeln oder ausblenden, **nicht interessiert** (wiederherstellbar), lokale Sortierung der Seite, kompakte Dichte / Liste, gespeicherte Filtervoreinstellungen, Tags und Verfolgung in großer Zahl, Spiele nebeneinander vergleichen.
- ♾️ **Endloses Scrollen** (optional, standardmäßig aus) — am Ende einer Katalogseite wird die nächste darunter angefügt, aus GOGs eigener Katalog-API (`catalog.gog.com`, derselbe Aufruf, den auch die Seite macht).

#### Spieleseite und Bibliothek (v4)
- 🎮 **Sprachprüfung**, **was sich seit deinem letzten Besuch geändert hat**, Bewertungsfilter, **ähnliche Spiele, die du besitzt**, **was ein Paket wirklich enthält** (von der Seite des Pakets selbst gelesen oder einmal pro Spieleseite von GOGs Produkt-API — gesendet wird nur eine numerische ID) mit einem Hinweis, wenn es sich mit deinem Besitz überschneidet, „Öffnen in“-Links zu Steam / IsThereAnyDeal / PCGamingWiki / HowLongToBeat / SteamDB und die Kürzel `W` / `N` / `A`.
- 📚 **Lernt deine Bibliothek beim Surfen** (anhand des „IN LIBRARY“-Labels der Seite selbst), was das Ausblenden besessener Spiele, echte Bibliotheksstatistiken, ein gewichtetes Backlog-Roulette, ein monatliches Ziel „Spiele zum Durchspielen“ und **Wrapped-/Sammlerkarten** zum Speichern als PNG ermöglicht.
- 📝 **Versionsverlauf der Notizen**, ein Export als **Obsidian-Vault** (`.zip`) sowie CSV-/Zeilenexporte für **Notion, Google Sheets und Trello**.
- 🏆 **36 Erfolge** in drei Stufen (einige versteckt), eine **Serie** der Tage, an denen du gestöbert hast, und drei **monatliche Herausforderungen** — alles lokal.
- ♿ **Ein Dashboard, das sich per Tastatur bedienen lässt** — ein Sprunglink, Tags per `Alt`+`↑`/`↓` umsortieren, Menüs und Dialoge, die den Fokus halten, und Sprachansagen von Änderungen für Screenreader.

#### Sync, Benachrichtigungen und Aussehen (v4)
- 🔄 **Automatischer Ordner-Sync** (alle 30 Minuten und beim Öffnen des Dashboards, wenn der Browser die Ordnerberechtigung noch kennt und die Datei nicht passwortverschlüsselt ist), eine Konfliktliste und datierte Backups im Ordner (höchstens einmal am Tag, beim Öffnen des Dashboards).
- 🔔 **Ruhezeiten und ruhige Wochentage**, ein **Eine-Zusammenfassung-pro-Tag**-Modus, Schwellenwerte, **Alarme nach Tag**, ein optionales **Saison-Radar**, ein reicherer wöchentlicher Digest, den du als Webseite speichern kannst, eine Wunschlistenkarte als PNG — und ein optionaler **Webhook an eine Adresse, die dir gehört** (siehe Berechtigungstabelle).
- 🎨 **Falten / Andocken / Umsortieren** des Spielepanels, **ruhiger Modus**, ein **schlichtes Aussehen** mit einem Klick, Farbpaletten für Farbsehschwäche, Textgrößenanpassung, Einstellungsprofile und eine kurze **Tour** nach dem Update.

### Modul für die optische Aufwertung
Wird über den Schalter „Design injection“ im Popup aktiviert. Wenn er an ist:
- Preise verwenden überall eine Festbreitenschrift (`ui-monospace` / Cascadia / JetBrains) mit tabellarischen Ziffern.
- Epochenabhängige Karten: Scanlines für Klassiker, Neonleuchten für Titel aus der Cyberpunk-Ära.
- Dezente Tiefe und Schatten, ein Hintergrund-Farbverlauf, Mikrointeraktionen beim Darüberfahren.
- Die „Good Old Game“-Pille bekommt statt flachem Violett einen metallischen Goldverlauf.
- Skeleton-Loader mit Schimmer-Animation statt sichtbarer `{{ product.title }}`-Platzhalter.
- Aufgeräumtes Layout: blendet abgelaufene Aktionen aus vergangenen Jahren aus.
- Elf Designs (Neon, Classic GOG, CRT Green, Sunset, Light, AMOLED, Amber, High contrast, Custom, Auto, Native) — Auto folgt der Hell/Dunkel-Einstellung des Systems, Native dem Aussehen von gog.com.

### Ehrlicher Datenschutz
- **Nur fünf Domains** (plus die eine Webhook-Adresse, die du selbst eintragen kannst, nur wenn du das einschaltest) erhalten Netzwerkanfragen — und jede Anfrage ist in den erweiterten Einstellungen aufgelistet (Datenschutz & Transparenz):
  1. `www.gog.com` — zum Lesen der Seiteninhalte und Einfügen der Oberfläche sowie für die öffentliche Mod-Liste einmal am Tag.
  2. `api.frankfurter.dev` — für Wechselkurse (kein API-Schlüssel, kein Tracking).
  3. `www.cheapshark.com` — die optionale Preisvergleichstabelle auf Spieleseiten (kostenlos, ohne Schlüssel; im Popup abschaltbar).
  4. `api.gog.com` — GOGs eigene Produkt-API, einmal pro Spieleseite gefragt, welche Spiele ein Paket enthält (gesendet wird nur die numerische ID; standardmäßig an, abschaltbar unter *Katalog, Wunschliste & Bibliothek*).
  5. `catalog.gog.com` — GOGs eigene Katalog-API, nur genutzt, wenn du endloses Scrollen einschaltest (standardmäßig aus).

  Die letzten beiden stehen nicht in der Berechtigungstabelle, weil sie von der Seite aus nach GOGs eigenen Cross-Origin-Regeln aufgerufen werden — dieselben Aufrufe, die auch die Seite macht —, sodass Chrome dafür keine zusätzliche Installationswarnung zeigt.
- **Der Ordner-Sync stellt selbst keine Netzwerkanfrage** — er liest und schreibt eine Datei in einem von dir gewählten Ordner; das Hochladen übernimmt dein eigener Cloud-Client.
- **Der Webhook ist optional und gehört dir** — bei der Installation wird nichts angefragt. Trägst du in den erweiterten Einstellungen deine eigene `https://`-Adresse ein, fragt der Browser einmal nach der Erlaubnis für genau diesen Ursprung; gesendet wird nur der Benachrichtigungstext, und die Adresse verlässt dein Gerät weder per Export noch per Sync.
- **Null Analytics, null gtag, null Google Fonts.**
- **Tags, Notizen und Verlauf liegen auf deinem Gerät** in `chrome.storage.local`. Nichts davon verlässt es.
- **Open Source** — jede Codezeile steht in diesem Repository.

---

## 🚀 Installation

1. Lade `gog-enhancer-webstore.zip` von der Seite [Releases](https://github.com/DrummingBird1/GOGEnhancer/releases) herunter und entpacke sie irgendwohin (oder nutze, wenn du das Repository geklont hast, direkt den Ordner `extension/`).
2. Öffne Chrome und gehe zu `chrome://extensions/`.
3. Aktiviere den **Entwicklermodus** (oben rechts).
4. Klicke auf **Entpackte Erweiterung laden** und wähle den entpackten Ordner (oder `extension/`).
5. Der Einrichtungsassistent öffnet sich automatisch in einem neuen Tab. Geh die Schritte durch.
6. Rufe [gog.com](https://www.gog.com) auf — die Erweiterung ist aktiv.

---

## 🌐 Browser-Unterstützung

| Browser | Status |
|---|---|
| **Chrome** | ✅ Voll unterstützt — das ist das Hauptziel. |
| **Edge, Brave, Opera** (Chromium-basiert) | ✅ Funktioniert wie Chrome — gleiche Engine, gleiche Schritte mit „Entpackte Erweiterung laden“. |
| **Firefox** | ⚠️ Experimentell / ungeprüft. `node scripts/build-firefox.mjs` baut eine Firefox-Variante (eine Hintergrundseite statt des Service Workers, eine Add-on-ID, eine Erklärung „erhebt nichts“), die unter `web-ext lint` fehlerfrei ist, und die ZIP hängt an jedem GitHub-Release — aber **sie wurde nie in einem echten Firefox ausgeführt**, und für den Ordner-Sync braucht es eine API, die Firefox nicht hat. Der unterstützte Installationsweg ist der Eintrag im Chrome Web Store; Edge-Nutzer können dieselbe Erweiterung von dort installieren oder „Entpackte Erweiterung laden“ verwenden (Edge Add-ons hat noch keinen Eintrag). |

---

## ⌨️ Tastenkürzel

| Kürzel | Aktion |
|---|---|
| `Alt+G` | Popup öffnen |
| `Alt+Shift+G` | GOG Enhancer ein-/ausschalten |
| `Alt+Shift+H` | Hebräische Übersetzungen ein-/ausschalten |
| `Strg/Cmd+K` (auf gog.com) | Befehlspalette öffnen |
| `J` / `K` / `T` (in Spielelisten, optional) | Vorheriges/nächstes Spiel, fokussiertes Spiel taggen |
| `W` / `N` / `A` (auf einer Spieleseite, optional) | `W` drückt den Wunschlisten-Button der Seite (schaltet um), `N` springt zum Notizfeld, `A` zum Preisalarm-Feld; `?` listet die Tasten auf |
| `gog` + `Tab` (Adressleiste) | Eigene Bibliothek durchsuchen |

Die Kürzel lassen sich unter `chrome://extensions/shortcuts` ändern.

---

## ⚙️ Berechtigungen erklärt

| Berechtigung | Wozu |
|---|---|
| `storage` | Einstellungen, Tags und Verlauf speichern |
| `alarms` | Zeitplanung der Hintergrundaktualisierungen von Kursen, Mods und Wunschliste |
| `notifications` | Nur auf Wunsch — Desktop-Hinweise zu Rückgabefristen und Wunschlisten-Angeboten |
| Host: `www.gog.com` | Oberfläche in GOG-Seiten einfügen |
| Host: `api.frankfurter.dev` | Wechselkurse abrufen |
| Keine Berechtigung: `www.cheapshark.com` | Optionaler Preisvergleich zwischen Shops auf Spieleseiten — CheapShark erlaubt Cross-Origin-Lesen, daher wird keine Host-Berechtigung deklariert |
| Optionaler Host: beliebiger `https://`-Ursprung | **Wird bei der Installation nie gewährt.** Wird zur Laufzeit für einen einzigen Ursprung angefragt, wenn du in den erweiterten Einstellungen deine eigene Webhook-Adresse einträgst; dorthin wird nur der Benachrichtigungstext gesendet |

Für den Ordner-Sync (du gewährst jeweils einen Ordner, per Klick) und das Adressleisten-Schlüsselwort ist keine Berechtigung nötig.

---

## 🛠️ Bekannte Einschränkungen

- **Die Anpassung an das Redesign wurde an der Live-Seite geprüft, aber gog.com ändert sich weiter** — Startseite, Katalog und Spieleseite wurden am 2026-10-02 untersucht und durchgängig (ohne Anmeldung) ausprobiert; Kontoseiten (Wunschliste, Bibliothek, Warenkorb) erfordern eine Anmeldung und wurden nur strukturell untersucht. Die Seite mischt derzeit zwei Generationen von Markup, also sind weitere Änderungen zu erwarten. Wenn nach einem gog.com-Update etwas nicht mehr funktioniert, nutze *Erweiterte Einstellungen → Diese Seite prüfen*.
- **Der Ordner-Sync löst Konflikte nach der Uhr jedes Geräts** — pro Datensatz gewinnt die letzte Änderung (die überschriebenen Datensätze stehen auf der Einstellungsseite), weshalb stark abweichende Uhren den falschen Gewinner wählen können. Er braucht die File System Access API (Chrome, Edge, Brave; nicht Firefox), und der Ordnerzugriff muss auf der Einstellungsseite hin und wieder neu erteilt werden. Der Hintergrundjob kann weder nach einer Berechtigung noch nach einem Passwort fragen und überspringt den Sync stillschweigend, bis du das Dashboard öffnest, wenn eines davon fehlt. Er wurde mit einem lokalen Ordner getestet, nicht mit einem echten Cloud-Sync-Client.
- **Nicht alles in v4 ließ sich an der echten Seite prüfen** — Funktionen, die eine Anmeldung brauchen (Wunschlistenzeilen, Bibliotheksbesitz, welche Spiele sich mit einem Paket überschneiden), wurden aus aufgezeichneter Seiten-*Struktur* sowie Unit- und End-to-End-Tests gebaut, nicht mit einem Live-Konto ausprobiert. Der Webhook wurde nicht gegen einen echten Endpunkt getestet, und Firefox ist ungetestet.
- **Endloses Scrollen setzt voraus, dass GOGs Katalog-API so bleibt, wie sie ist** — es setzt nur eine Liste fort, die sich der auf dem Bildschirm zuordnen lässt, anhand der Abfrage, die die Seite selbst an die Seite übergeben hat. Schränkt GOG diese API ein, hängt die Funktion einfach nichts mehr an; alles andere bleibt unberührt. Einträge im Erscheinungskalender gibt es nur für Spiele, deren Seite du geöffnet hast (die Wunschliste selbst zeigt nur ein Jahr).
- **Die Übersetzungen sind ungeprüft** — die acht nicht-englischen Oberflächensprachen wurden ohne Durchsicht durch Muttersprachler geschrieben; ein Projekt, das mit Hebräisch begann, daher hat Hebräisch die meiste Aufmerksamkeit bekommen. Texte, die erst nach einer Aktion erscheinen (einige Dialoge und Fehlermeldungen), sind abgedeckt, aber alles Neue ohne Übersetzung bleibt einfach Englisch.
- **Nicht gebaut:** ein Erkenner für Warenkorb und Gratisaktionen, ein Seitenpanel und Kontextmenüs (jedes bräuchte eine neue Berechtigung).
- **Auslesen der Mod-Liste** — hängt davon ab, dass `gog.com/en/mods` eine ähnliche Struktur behält. Wenn das nachlässt, erzwinge eine Aktualisierung in den erweiterten Einstellungen.
- **Wunschlisten-Badge** — beruht auf einer Live-Zählung im DOM beim Besuch von `/account/wishlist` (24 h gültig). Warst du länger nicht dort, bleibt das Badge bis zum nächsten Besuch leer — der Tooltip des Symbols schlägt einen Besuch vor.
- **Der Rückgabe-Timer beruht auf einem von Hand eingegebenen Datum** — GOG stellt das Kaufdatum in keinem öffentlichen DOM bereit, daher hängt der 30-Tage-Countdown von einem Datum ab, das du im Panel eingibst. Kein Datum, kein Countdown.
- **Die Genre-Erkennung ist teilweise automatisch (seit v2.6.0)** — Horror/Role-playing/Strategy werden aus dem echten Feld „Genre:“ auf der Spieleseite gelesen und beim ersten Besuch pro Slug zwischengespeichert (`gameGenres`). Sci-fi und Indie beruhen weiterhin auf dem Abgleich bekannter Spieltitel per Regex — bei GOG scheinen sie in der breiteren „Tags“-Wolke statt unter „Genre:“ zu liegen, und diese Struktur ist nicht vollständig geprüft. Solange ein bestimmtes Spiel nicht besucht wurde, greifen alle fünf Genre-Gruppen auf den Regex zurück.
- **Die Umrechnung zwischen Währungen läuft immer über USD** — fehlt der Kurs eines der beiden Paare in `rates`, findet keine Umrechnung statt. Alle Kurse werden automatisch alle 12 Stunden von frankfurter.dev abgerufen.
- **Wunschlistenweite Preisalarme, Wunschlisten-Angebote und der Wunschlistenwert erfassen nur Spiele, die du besucht hast** — alle drei stützen sich auf `priceHistory`, das nur durch den Besuch der Seite eines Spiels aufgebaut wird. Für ein Wunschlisten-Spiel, das du nie besucht hast, gibt es nichts zum Vergleichen, also taucht es weder in Alarmen, noch in den „Wunschlisten-Angeboten“ des Popups, noch in der Kennzahl „Wunschlistenwert“ auf, selbst wenn sein Preis gefallen ist.

---

## 📜 Änderungsprotokoll

Die vollständige Versionshistorie findest du auf der [GitHub-Releases-Seite](https://github.com/DrummingBird1/GOGEnhancer/releases) — jede Version hat eine eigene Seite mit eigenem Banner — und auf der [Änderungsprotokoll-Seite](https://drummingbird1.github.io/GOGEnhancer/changelog.html) der Website der Erweiterung.

---

## 🧑‍💻 Zuerst für den israelischen Markt gebaut

Ursprünglich für Nutzer in Israel zugeschnitten (ILS, 18 % MwSt., Hebräisch) — funktioniert aber genauso gut mit jeder der 24 unterstützten Währungen. Jedes Feld ist bearbeitbar.

---

## ☕ Unterstützung

GOG Enhancer ist kostenlos, quelloffen, werbefrei und erhebt keine Daten. Wenn es dir Geld oder Zeit spart und du die Weiterentwicklung unterstützen möchtest, kannst du auf einer dieser Plattformen Unterstützer werden:

- **[Ko-fi](https://ko-fi.com/idanlights)**
- **[Buy Me a Coffee](https://buymeacoffee.com/solvaris)**
- **[Patreon](https://www.patreon.com/c/Solvaris)**

Völlig freiwillig — alle Funktionen bleiben für alle kostenlos, egal was.
