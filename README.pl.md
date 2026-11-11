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

Nieoficjalne rozszerzenie dla GOG.com: przeliczanie cen po bieżących kursach, historia cen, porównywanie cen w innych sklepach, własne tagi, pełne odświeżenie wyglądu, hebrajski i RTL — bez Google Fonts i bez analityki.

> **Zastrzeżenie:** to nieoficjalne rozszerzenie. Nie jest powiązane z GOG sp. z o.o. ani CD Projekt S.A., ani przez nie wspierane czy sponsorowane. Nazwa „GOG” służy wyłącznie do opisania sklepu, z którym współpracuje rozszerzenie.

---

## 📂 Zawartość repozytorium

| Plik / folder | Przeznaczenie |
|---|---|
| **`extension/`** | **Samo rozszerzenie** — `manifest.json` oraz `background/`, `content/`, `lib/`, `popup/`, `options/`, `onboarding/`, `tags/`, `tour/`, `icons/`. Ten folder wczytujesz jako „Załaduj rozpakowane” i to on trafia do pliku zip. |
| **`store/`** | Materiały dla sklepu, które **nie należą** do rozszerzenia: `STORE_LISTING.md` (teksty do panelu), `listings/` (opis sklepu, po jednym pliku na język), `screenshots/` (po dziesięć na język, generowane przez `e2e/store-screenshots.mjs`), `brand/` (logo i grafiki promocyjne), `release-images/` (banery wydań, zob. `ARCHITECTURE.md`). Wysyłane osobno, nigdy nie trafiają do zip. |
| **`docs/`** | Strona rozszerzenia na GitHub Pages — strona główna, przewodnik, polityka prywatności, lista zmian. |
| `PRIVACY.md` | Polityka prywatności (dostępna też pod publicznym adresem `docs/privacy.html`) |
| `README.he.md`, `README.ru.md`, `README.pl.md`, `README.de.md`, `README.fr.md`, `README.es.md`, `README.zh-CN.md`, `README.pt-BR.md` | Pełne tłumaczenia tego pliku — po jednym na język interfejsu |
| `LICENSE` | Licencja MIT |
| `build.ps1` | Skrypt budowania — pakuje `extension/` do `dist/gog-enhancer-webstore.zip` (`node scripts/build-firefox.mjs` buduje eksperymentalny zip dla Firefoksa) |
| `scripts/`, `e2e/` | Skrypt wydania (`release.mjs`), kompilacja dla Firefoksa i testy end-to-end: zestaw Playwright (fixtures, żywa strona, z logowaniem), budżet wydajności, rejestrator struktury strony, porównywanie zrzutów ekranu, narzędzie do zbierania tekstów do tłumaczeń i generator zrzutów dla sklepu. Tylko lokalnie, nic z tego nie trafia do rozszerzenia. |
| `dist/` | Wyniki budowania (w gitignore). Tworzone przez `build.ps1` |
| `tests/`, `package.json`, `vitest.config.js`, `eslint.config.js` | Vitest i ESLint dla czystych modułów pomocniczych. Nie trafiają do zip rozszerzenia. |
| `.github/workflows/` | GitHub Actions: `test.yml` uruchamia lint i testy przy push/PR, `release.yml` buduje zip i publikuje wydanie po wypchnięciu tagu `v*.*.*`, `canary.yml` to cykliczne sprawdzanie żywej strony |
| `ARCHITECTURE.md` | Notatki o architekturze — układ, przechowywanie, kolejność ładowania, granice prywatności |
| `README.md` | Angielska wersja tego pliku |

---

## ✨ Przegląd funkcji

### Architektura
- **Jedna warstwa przechowywania** — ustawienia w `storage.sync` (lekkie, synchronizowane między urządzeniami), cięższe dane (tagi, historia, pamięci podręczne) w `storage.local`. Żaden limit nie jest przekraczany.
- **Wersjonowanie i migracja ustawień** — przy aktualizacji z v1 tagi i notatki są automatycznie przenoszone z sync do local.
- **Tylko czcionki systemowe** — zero zależności od Google Fonts, zero zdalnego kodu i analityki.
- **Jedna warstwa sieciowa** (`lib/net.js`) — przez nią przechodzi każde zapytanie rozszerzenia: lista dozwolonych pięciu hostów, bez ciasteczek i referera, z limitem czasu i lokalnym dziennikiem „host + ścieżka” (nigdy samo zapytanie), który pokazuje strona ustawień zaawansowanych. Test przerywa budowanie, jeśli uprawnienie lub host zmieni się bez uaktualnienia dokumentów o prywatności.
- **Jeden adapter strony** (`content/gog-dom.js`) — każde wyszukiwanie w znacznikach gog.com (karty, ceny, tytuł, miejsce panelu) próbuje kilku strategii, więc redesign powoduje łagodne pogorszenie działania, a nie ciche zepsucie. „Sprawdź tę stronę” w ustawieniach zaawansowanych pokazuje, które wyszukiwania jeszcze działają.
- **Wąski `MutationObserver`** na zawartości strony z debouncingiem; szum nagłówka jest odfiltrowany, a podmiana `<main>` jest wychwytywana.
- **Każda funkcja działa w izolacji** — jeśli po zmianie strony jedno wyszukiwanie przestaje działać, wyłącza się tylko ta funkcja, a reszta działa dalej; „Sprawdź tę stronę” wylicza błędy.
- **Uczy się tylko ze stron, które sam otwierasz** — posiadanie gier, oceny, języki i fakty cenowe są odczytywane ze stron odwiedzanych przez Ciebie i zapisywane lokalnie. Rozszerzenie nie pobiera niczego dodatkowo.

### Funkcje
- 💱 **Bieżące kursy dla 24 walut** — szekel, euro, funt, złoty, rubel, real, jen, juan i inne, pobierane automatycznie z `api.frankfurter.dev` co 12 godzin. Można je edytować ręcznie.
- 📈 **Śledzenie cen** — każda wizyta na stronie gry zapisuje próbkę. Panel statystyk na stronie gry pokazuje cenę aktualną, historyczne minimum i średnią oraz werdykt „Warto poczekać?”.
- 🔍 **Porównanie w IsThereAnyDeal** — przycisk na stronie gry szuka tego samego tytułu w Steam / Epic / Humble / Fanatical.
- 🏷️ **Pełny panel tagów** — osobna strona z wyszukiwaniem, filtrowaniem, licznikiem przy każdym tagu i eksportem do CSV. Podpowiedzi istniejących tagów.
- 🔔 **Alerty o promocjach z listy życzeń** — znaczek na ikonie paska liczy przecenione pozycje listy życzeń; okno pokazuje trzy największe obniżki śledzonych cen.
- 🛡️ **Baner DRM-free** — pełny baner z ikoną tarczy i gradientową plakietką „GOG+”.
- 🎨 **Odświeżone karty** — z uwzględnieniem gry: „Good Old Game” dostaje subtelny efekt CRT i złotą poświatę; tytuły Cyberpunk/Witcher — turkusowo-magentowy neonowy blask.
- 🪟 **Stylizowane podpowiedzi** — zastępują domyślne podpowiedzi przeglądarki: z nagłówkami, bogatą treścią i automatycznym pozycjonowaniem.
- 📋 **Dynamiczna lista modów** — pobierana automatycznie z `gog.com/en/mods` co 24 godziny.
- 🌍 **Automatyczne rozpoznawanie waluty na stronie** — jeśli GOG już pokazuje EUR (użytkownicy z UE), rozszerzenie nie przelicza ponownie.
- 🎯 **Poprawny RTL** — `inline-start`/`end` zamiast `left`/`right` oraz `unicode-bidi: isolate` dla cen.
- ⌨️ **Skróty klawiszowe** — `Alt+G` otwiera okno, `Alt+Shift+G` włącza i wyłącza rozszerzenie, `Alt+Shift+H` przełącza hebrajski; `Ctrl/Cmd+K` otwiera paletę poleceń do całej reszty.
- 🧙 **Kreator pierwszego uruchomienia** — 4 kroki (waluta, region, funkcje, motyw), otwiera się automatycznie po pierwszej instalacji.
- ☁️ **Synchronizacja między urządzeniami przez wybrany folder** (Dropbox, OneDrive, Google Drive, Syncthing…) — scala tagi, notatki, statusy, zakupy, alerty i historię cen rekord po rekordzie, opcjonalnie szyfrowane. Żaden nasz pośrednik nie bierze w tym udziału. Chrome / Edge / Brave.
- 🔎 **Wyszukiwanie biblioteki z paska adresu** — wpisz `gog` + Tab, a potem nazwę gry, `tag:rpg` lub `status:backlog`.
- 🎨 **Motyw „Native”** — pobiera kolory i czcionkę samego gog.com, więc dodane elementy zlewają się ze stroną, jakkolwiek będzie wyglądać.
- ⌨️ **Nawigacja klawiaturą** (opcjonalna) — `J`/`K` przechodzą między grami na liście, `T` taguje wybraną.
- 📅 **Pliki kalendarza (`.ics`)** dla terminów zwrotu i dat premier gier z listy życzeń oraz 📝 **eksport do Markdown / Obsidian / CSV** z panelu tagów — wszystko powstaje na Twoim urządzeniu.
- 🌍 **Dziewięć języków interfejsu** — panel tagów, ustawienia zaawansowane, okno, kreator pierwszego uruchomienia i własne teksty rozszerzenia na gog.com po angielsku, hebrajsku (od prawej do lewej), rosyjsku, polsku, niemiecku, francusku, hiszpańsku, chińsku uproszczonym i portugalsku brazylijskim. To, co piszesz sam (nazwy tagów, notatki), nigdy nie jest tłumaczone.
- 🔒 **Panel prywatności** w ustawieniach zaawansowanych — każdy adres, z którym rozszerzenie się kontaktowało, co i ile przechowuje na urządzeniu, jaki dodatkowy dostęp do stron przyznała mu przeglądarka, i czyszczenie jednym kliknięciem.
- 🩺 **Raport o awarii** — gdy funkcja przestaje działać po zmianie strony, okno proponuje raport jednym kliknięciem bez adresów internetowych i danych osobowych („Zgłoś na GitHubie” tylko otwiera stronę z wypełnionym tekstem).
- 🖥️ **Kontrola systemu** na stronach gier — porównuje wymaganie gry dotyczące RAM z tym, co zgłasza przeglądarka (procesora i karty graficznej przeglądarki nie widzą). Opisz swój komputer w ustawieniach zaawansowanych, a wymagania dotyczące RAM i wolnego miejsca na dysku zostaną z nim porównane; system, procesor i karta graficzna są pokazane obok wymagań, ale nie oceniane — to szacunek.

#### Promocje i ceny (v4)
- 💸 **„Czy ta promocja jest prawdziwa?”** — porównuje cenę bazową z najniższą ceną GOG z 30 dni i Twoją historią; ⏳ **odliczanie oferty** na stronie gry, na kartach i w zestawieniu.
- **Cena za godzinę gry**, **cena w kilku walutach** naraz, **rytm wyprzedaży** dla każdej gry, **wykres porównawczy** 2–3 gier, sumy **„ile zaoszczędziłem”** i krajowe **ustawienia VAT** (DE, FR, ES, IT, NL, RU).

#### Lista życzeń i katalog (v4)
- 💖 **Inteligentna lista życzeń** — sortowanie według zniżki / odległości od minimum / przeliczonej ceny / daty dodania, filtry „blisko minimum” i „kończy się wkrótce”, bieżąca suma, grupowanie według tagu lub statusu, eksport do CSV / Markdown / `.ics`.
- 🗂️ **Narzędzia katalogu** — pasek nad siatką: przyciemnianie lub ukrywanie gier, które już masz, **niezainteresowany** (z możliwością przywrócenia), lokalne sortowanie strony, gęstość kompaktowa / lista, zapisane zestawy filtrów, zbiorcze tagowanie i śledzenie, porównanie gier obok siebie.
- ♾️ **Nieskończone przewijanie** (opcjonalne, domyślnie wyłączone) — po dojściu do końca strony katalogu kolejna jest dodawana poniżej, z własnego API katalogu GOG (`catalog.gog.com`, to samo wywołanie, które wykonuje strona).

#### Strona gry i biblioteka (v4)
- 🎮 **Kontrola języka**, **co zmieniło się od ostatniej wizyty**, filtr recenzji, **podobne gry, które masz**, **co naprawdę zawiera pakiet** (odczytywane ze strony samego pakietu lub z API produktów GOG raz na stronę gry — wysyłany jest tylko numeryczny identyfikator) z ostrzeżeniem, gdy pakiet pokrywa się z tym, co posiadasz, linki „otwórz w” Steam / IsThereAnyDeal / PCGamingWiki / HowLongToBeat / SteamDB oraz skróty `W` / `N` / `A`.
- 📚 **Uczy się Twojej biblioteki podczas przeglądania** (z etykiety „IN LIBRARY” samej strony), co umożliwia ukrywanie posiadanych gier, prawdziwe statystyki biblioteki, ważoną ruletkę zaległości, miesięczny cel „gier do ukończenia” oraz **karty Wrapped / kolekcjonera** do zapisania jako PNG.
- 📝 **Historia wersji notatek**, eksport do **skarbca Obsidian** (`.zip`) oraz eksporty CSV / linia po linii dla **Notion, Arkuszy Google i Trello**.
- 🏆 **36 osiągnięć** w trzech poziomach (część ukryta), **seria** dni przeglądania i trzy **miesięczne wyzwania** — wszystko lokalnie.
- ♿ **Panel obsługiwany z klawiatury** — link „przejdź do treści”, zmiana kolejności tagów `Alt`+`↑`/`↓`, menu i okna dialogowe przytrzymujące fokus oraz komunikaty głosowe o zmianach dla czytników ekranu.

#### Synchronizacja, powiadomienia i wygląd (v4)
- 🔄 **Automatyczna synchronizacja folderu** (co 30 minut i przy otwarciu panelu, gdy przeglądarka pamięta uprawnienie do folderu, a plik nie jest zaszyfrowany hasłem), lista konfliktów oraz kopie zapasowe z datą w folderze (najwyżej raz dziennie, przy otwarciu panelu).
- 🔔 **Godziny ciszy i cichy dni tygodnia**, tryb **„jedno podsumowanie dziennie”**, progi, **alerty według tagów**, opcjonalny **radar sezonów**, bogatszy cotygodniowy przegląd do zapisania jako strona WWW, karta listy życzeń do zapisania jako PNG oraz opcjonalny **webhook na adres, którym dysponujesz** (zob. tabelę uprawnień).
- 🎨 **Zwijanie / dokowanie / zmiana kolejności** panelu gry, **tryb spokojny**, **prosty wygląd** jednym kliknięciem, palety dla osób z zaburzeniami widzenia barw, skalowanie tekstu, profile ustawień i krótka **wycieczka** po aktualizacji.

### Moduł odświeżenia wyglądu
Włączany przełącznikiem „Design injection” w oknie. Gdy jest włączony:
- Ceny wszędzie używają czcionki o stałej szerokości (`ui-monospace` / Cascadia / JetBrains) z cyframi tabelarycznymi.
- Karty zależne od epoki: linie skanowania dla klasyków, neonowy blask dla tytułów z epoki cyberpunku.
- Subtelna głębia i cienie, gradientowe tło, mikrointerakcje po najechaniu.
- Plakietka „Good Old Game” dostaje metaliczny złoty gradient zamiast płaskiego fioletu.
- Szkieletowe loadery z efektem migotania zamiast odsłoniętych zastępników `{{ product.title }}`.
- Czysty układ: ukrywa wygasłe promocje z minionych lat.
- Jedenaście motywów (Neon, Classic GOG, CRT Green, Sunset, Light, AMOLED, Amber, High contrast, Custom, Auto, Native) — Auto podąża za jasnym/ciemnym ustawieniem systemu, Native za wyglądem gog.com.

### Uczciwie o prywatności
- **Tylko pięć domen** (oraz jeden adres webhooka, który możesz wpisać sam, tylko jeśli włączysz tę funkcję) otrzymuje zapytania sieciowe — a każde zapytanie jest widoczne w ustawieniach zaawansowanych (Prywatność i przejrzystość):
  1. `www.gog.com` — odczyt zawartości stron i wstawianie interfejsu oraz publiczna lista modów raz dziennie.
  2. `api.frankfurter.dev` — kursy walut (bez klucza API, bez śledzenia).
  3. `www.cheapshark.com` — opcjonalna tabela porównania cen na stronach gier (bezpłatna, bez klucza; wyłączana w oknie).
  4. `api.gog.com` — własne API produktów GOG: raz na stronę gry pyta, jakie gry zawiera pakiet (wysyłany jest tylko numeryczny identyfikator; domyślnie włączone, wyłączane w sekcji *Katalog, lista życzeń i biblioteka*).
  5. `catalog.gog.com` — własne API katalogu GOG, używane tylko po włączeniu nieskończonego przewijania (domyślnie wyłączone).

  Dwa ostatnie nie mają wpisu w tabeli uprawnień, bo są wywoływane ze strony na zasadach cross-origin samego GOG — tymi samymi wywołaniami, które wykonuje strona — więc Chrome nie pokazuje dodatkowego ostrzeżenia przy instalacji.
- **Synchronizacja folderu sama nie wysyła żadnych zapytań sieciowych** — czyta i zapisuje jeden plik w wybranym folderze; wysyłaniem zajmuje się Twój klient chmury.
- **Webhook jest opcjonalny i Twój** — przy instalacji nie jest nic żądane. Jeśli wpiszesz własny adres `https://` w ustawieniach zaawansowanych, przeglądarka raz zapyta o zgodę dla tego jednego źródła; wysyłany jest tylko tekst powiadomienia, a sam adres nigdy nie opuszcza urządzenia przez eksport ani synchronizację.
- **Zero analityki, zero gtag, zero Google Fonts.**
- **Tagi, notatki i historia są na Twoim urządzeniu** w `chrome.storage.local`. Nic stamtąd nie wychodzi.
- **Otwarty kod** — każda linia kodu jest w tym repozytorium.

---

## 🚀 Instalacja

1. Pobierz `gog-enhancer-webstore.zip` ze strony [Releases](https://github.com/DrummingBird1/GOGEnhancer/releases) i rozpakuj gdziekolwiek (albo, jeśli sklonowałeś repozytorium, użyj bezpośrednio folderu `extension/`).
2. Otwórz Chrome i przejdź do `chrome://extensions/`.
3. Włącz **Tryb dewelopera** (prawy górny róg).
4. Kliknij **Załaduj rozpakowane** i wybierz rozpakowany folder (lub `extension/`).
5. Kreator pierwszego uruchomienia otworzy się automatycznie w nowej karcie. Przejdź przez kroki.
6. Wejdź na [gog.com](https://www.gog.com) — rozszerzenie działa.

---

## 🌐 Obsługa przeglądarek

| Przeglądarka | Status |
|---|---|
| **Chrome** | ✅ W pełni obsługiwany — główna platforma docelowa. |
| **Edge, Brave, Opera** (oparte na Chromium) | ✅ Działa tak samo jak Chrome — ten sam silnik, te same kroki „Załaduj rozpakowane”. |
| **Firefox** | ⚠️ Eksperymentalnie / niezweryfikowane. `node scripts/build-firefox.mjs` buduje wariant dla Firefoksa (strona tła zamiast service workera, identyfikator dodatku, deklaracja „niczego nie zbiera”), który przechodzi `web-ext lint` bez błędów, a zip jest dołączany do każdego wydania na GitHubie — ale **nigdy nie był uruchomiony w prawdziwym Firefoksie**, a synchronizacja folderu wymaga API, którego Firefox nie ma. Obsługiwaną drogą instalacji jest strona w Chrome Web Store; użytkownicy Edge mogą zainstalować stamtąd to samo rozszerzenie albo użyć „Załaduj rozpakowane” (Edge Add-ons nie ma jeszcze strony). |

---

## ⌨️ Skróty klawiszowe

| Skrót | Działanie |
|---|---|
| `Alt+G` | Otwiera okno |
| `Alt+Shift+G` | Włącza / wyłącza GOG Enhancer |
| `Alt+Shift+H` | Włącza / wyłącza tłumaczenia na hebrajski |
| `Ctrl/Cmd+K` (na gog.com) | Otwiera paletę poleceń |
| `J` / `K` / `T` (na listach gier, opcjonalnie) | Poprzednia/następna gra, tagowanie wybranej |
| `W` / `N` / `A` (na stronie gry, opcjonalnie) | `W` naciska przycisk listy życzeń na stronie (przełącza), `N` przechodzi do pola notatki, `A` do pola alertu cenowego; `?` pokazuje listę klawiszy |
| `gog` + `Tab` (pasek adresu) | Wyszukiwanie w Twojej bibliotece |

Skróty można zmienić pod adresem `chrome://extensions/shortcuts`.

---

## ⚙️ Wyjaśnienie uprawnień

| Uprawnienie | Po co |
|---|---|
| `storage` | Zapis ustawień, tagów i historii |
| `alarms` | Planowanie odświeżania w tle kursów, modów i listy życzeń |
| `notifications` | Tylko na życzenie — alerty o terminach zwrotu i promocjach z listy życzeń |
| Host: `www.gog.com` | Wstawianie interfejsu na strony GOG |
| Host: `api.frankfurter.dev` | Pobieranie kursów walut |
| Brak uprawnienia: `www.cheapshark.com` | Opcjonalne porównanie cen w różnych sklepach na stronach gier — CheapShark zezwala na odczyt cross-origin, więc uprawnienie hosta nie jest deklarowane |
| Opcjonalny host: dowolne źródło `https://` | **Nigdy nie przyznawane przy instalacji.** Żądane w trakcie działania, dla jednego źródła, jeśli wpiszesz własny adres webhooka w ustawieniach zaawansowanych; wysyłany jest tam tylko tekst powiadomienia |

Uprawnienia nie są potrzebne do synchronizacji folderu (dostęp do jednego folderu przyznajesz kliknięciem) ani do słowa kluczowego w pasku adresu.

---

## 🛠️ Znane ograniczenia

- **Dostosowanie do redesignu sprawdzono na żywej stronie, ale gog.com wciąż się zmienia** — strona główna, katalog i strona gry zostały zbadane i sprawdzone od początku do końca (bez logowania) 2026-10-02; strony konta (lista życzeń, biblioteka, koszyk) wymagają logowania i zbadano je tylko pod względem struktury. Strona miesza obecnie dwie generacje znaczników, więc spodziewaj się dalszych zmian. Jeśli po aktualizacji gog.com coś przestanie działać, użyj *Ustawienia zaawansowane → Sprawdź tę stronę*.
- **Synchronizacja folderu rozstrzyga konflikty według zegara każdego urządzenia** — wygrywa ostatnia edycja każdego rekordu (nadpisane rekordy są wymienione na stronie ustawień), więc mocno rozjechane zegary mogą wskazać złego zwycięzcę. Wymaga File System Access API (Chrome, Edge, Brave; nie Firefox), a dostęp do folderu trzeba co jakiś czas przyznawać ponownie na stronie ustawień. Zadanie w tle nie potrafi poprosić o uprawnienie ani hasło, więc przy ich braku po cichu pomija synchronizację, dopóki nie otworzysz panelu. Sprawdzono na lokalnym folderze, a nie na prawdziwym kliencie synchronizacji w chmurze.
- **Nie wszystko w v4 dało się sprawdzić na prawdziwej stronie** — funkcje zależne od zalogowania (wiersze listy życzeń, posiadanie gier, nakładanie się pakietów) zbudowano na podstawie nagranej *struktury* stron oraz testów jednostkowych i end-to-end, bez sprawdzenia na żywym koncie. Webhooka nie wypróbowano na prawdziwym adresie, a Firefox nie był testowany.
- **Nieskończone przewijanie wymaga, by API katalogu GOG pozostało takie, jakie jest** — kontynuuje tylko listę, którą potrafi dopasować do tej na ekranie, na podstawie zapytania, które sama strona przekazała stronie. Jeśli GOG ograniczy to API, funkcja po prostu przestanie dołączać gry; reszta nie ucierpi. Wpisy kalendarza dat premier istnieją tylko dla gier, których stronę otworzyłeś (sama lista życzeń pokazuje tylko rok).
- **Tłumaczenia nie zostały zweryfikowane** — osiem języków interfejsu innych niż angielski napisano bez weryfikacji przez native speakerów; projekt zaczął się od hebrajskiego, więc to on dostał najwięcej uwagi. Teksty pojawiające się dopiero po akcji (niektóre okna dialogowe i komunikaty o błędach) są objęte, ale wszystko nowe bez tłumaczenia po prostu zostaje po angielsku.
- **Niezrobione:** wykrywacz koszyka i darmowych gier, panel boczny i menu kontekstowe (każde wymaga nowego uprawnienia).
- **Pobieranie listy modów** — zależy od tego, czy `gog.com/en/mods` zachowa podobną strukturę. Jeśli coś się zepsuje, wymuś odświeżenie w ustawieniach zaawansowanych.
- **Licznik na znaczku listy życzeń** — opiera się na bieżącym zliczeniu w DOM podczas wizyty na `/account/wishlist` (ważność 24 h). Jeśli dawno nie wchodziłeś, znaczek pozostaje pusty do następnej wizyty — podpowiedź na ikonie zaproponuje wejście.
- **Licznik zwrotu opiera się na ręcznie wpisanej dacie** — GOG nie udostępnia daty zakupu w żadnym publicznym DOM, więc 30-dniowe odliczanie zależy od daty wpisanej w panelu. Brak daty — brak odliczania.
- **Wykrywanie gatunków jest częściowo automatyczne (od v2.6.0)** — Horror/Role-playing/Strategy są odczytywane z prawdziwego pola „Genre:” na stronie gry i zapisywane w pamięci według slugu (`gameGenres`) przy pierwszej wizycie. Sci-fi i Indie nadal opierają się na dopasowaniu znanych tytułów wyrażeniami regularnymi — na GOG wydają się leżeć w szerszej chmurze „Tags”, a nie w „Genre:”, i ta struktura nie została w pełni zweryfikowana. Dopóki dana gra nie zostanie odwiedzona, wszystkie pięć grup gatunków korzysta z wyrażeń regularnych.
- **Przeliczanie między walutami zawsze idzie przez USD** — jeśli brakuje w `rates` kursu którejś z pary, przeliczenie nie nastąpi. Wszystkie kursy są pobierane automatycznie co 12 godzin z frankfurter.dev.
- **Alerty cenowe całej listy życzeń, promocje z listy i wartość listy obejmują tylko gry, które odwiedziłeś** — wszystkie opierają się na `priceHistory`, budowanej tylko przez odwiedzenie strony samej gry. Dla gry z listy, której nigdy nie otworzyłeś, nie ma z czym porównywać, więc nie pojawi się w alertach, w „Promocjach z listy życzeń” w oknie ani w statystyce „Wartość listy życzeń”, nawet jeśli jej cena spadła.

---

## 📜 Lista zmian

Pełna historia wersji znajduje się na [stronie wydań GitHub](https://github.com/DrummingBird1/GOGEnhancer/releases) — każda wersja ma własną stronę i własny baner — oraz na [stronie zmian](https://drummingbird1.github.io/GOGEnhancer/changelog.html) w witrynie rozszerzenia.

---

## 🧑‍💻 Najpierw z myślą o Izraelu

Pierwotnie przygotowane dla użytkowników z Izraela (ILS, VAT 18%, hebrajski), ale równie dobrze działa z każdą z 24 obsługiwanych walut. Każde pole można edytować.

---

## ☕ Wsparcie

GOG Enhancer jest darmowy, ma otwarty kod, nie pokazuje reklam i nie zbiera danych. Jeśli oszczędza Ci pieniądze lub czas i chcesz wesprzeć dalszy rozwój, możesz zostać wspierającym na jednej z tych platform:

- **[Ko-fi](https://ko-fi.com/idanlights)**
- **[Buy Me a Coffee](https://buymeacoffee.com/solvaris)**
- **[Patreon](https://www.patreon.com/c/Solvaris)**

Całkowicie dobrowolnie — wszystkie funkcje pozostają darmowe dla wszystkich niezależnie od tego.
