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

Une extension tierce non officielle pour GOG.com : conversion de devises aux taux du jour, historique des prix, comparaison avec d'autres boutiques, tags personnels, une refonte visuelle complète, hébreu + RTL — sans Google Fonts et sans analytique.

> **Avertissement :** il s'agit d'une extension tierce non officielle. Elle n'est ni affiliée à GOG sp. z o.o. ou CD Projekt S.A., ni approuvée ou parrainée par eux. Le nom « GOG » n'est utilisé que pour désigner la boutique avec laquelle l'extension fonctionne.

---

## 📂 Contenu du dépôt

| Fichier / dossier | Rôle |
|---|---|
| **`extension/`** | **L'extension livrable** — `manifest.json` plus `background/`, `content/`, `lib/`, `popup/`, `options/`, `onboarding/`, `tags/`, `tour/`, `icons/`. C'est ce dossier que vous chargez avec « Charger l'extension non empaquetée » et ce qui est compressé en zip. |
| **`store/`** | Matériel pour la boutique qui **ne fait pas partie** de l'extension : `STORE_LISTING.md` (textes pour le tableau de bord), `listings/` (description de la boutique, un fichier par langue), `screenshots/` (dix par langue, générées par `e2e/store-screenshots.mjs`), `brand/` (logo et visuels promotionnels), `release-images/` (bannières de version, voir `ARCHITECTURE.md`). Envoyé séparément, jamais inclus dans le zip. |
| **`docs/`** | Le site de l'extension sur GitHub Pages — page d'accueil, guide, politique de confidentialité, journal des modifications. |
| `PRIVACY.md` | Politique de confidentialité (aussi disponible à une adresse publique : `docs/privacy.html`) |
| `README.he.md`, `README.ru.md`, `README.pl.md`, `README.de.md`, `README.fr.md`, `README.es.md`, `README.zh-CN.md`, `README.pt-BR.md` | Traductions complètes de ce fichier, une par langue d'interface |
| `LICENSE` | Licence MIT |
| `build.ps1` | Script de build — compresse `extension/` en `dist/gog-enhancer-webstore.zip` (`node scripts/build-firefox.mjs` construit le zip Firefox expérimental) |
| `scripts/`, `e2e/` | Script de publication (`release.mjs`), le build Firefox et les outils de bout en bout : la suite Playwright (fixtures, site réel, connecté), un budget de performance, un enregistreur de structure, la régression de captures, un collecteur de chaînes pour les traductions et le générateur de captures pour la boutique. En local uniquement, rien de tout cela n'est livré. |
| `dist/` | Résultats de build (ignorés par git). Régénérés par `build.ps1` |
| `tests/`, `package.json`, `vitest.config.js`, `eslint.config.js` | Vitest et ESLint pour les modules utilitaires purs. Non inclus dans le zip de l'extension. |
| `.github/workflows/` | GitHub Actions : `test.yml` lance lint et tests à chaque push/PR, `release.yml` construit le zip et publie une version lors du push d'un tag `v*.*.*`, `canary.yml` est une vérification planifiée du site réel |
| `ARCHITECTURE.md` | Notes d'architecture — structure, stockage, ordre de chargement, frontière de confidentialité |
| `README.md` | Version anglaise de ce fichier |

---

## ✨ Aperçu des fonctionnalités

### Architecture
- **Une couche de stockage unifiée** — préférences dans `storage.sync` (léger, synchronisé entre appareils), données plus volumineuses (tags, historique, caches) dans `storage.local`. Aucun quota n'est dépassé.
- **Versionnage et migration des réglages** — en passant de la v1, les tags et notes sont déplacés automatiquement de sync vers local.
- **Polices système uniquement** — aucune dépendance à Google Fonts, aucun code distant, aucune analytique.
- **Une seule couche réseau** (`lib/net.js`) — chaque requête de l'extension y passe : liste blanche de cinq hôtes, pas de cookies, pas de referrer, un délai d'expiration et un journal local « hôte + chemin » (jamais la requête) que montre la page des réglages avancés. Un test fait échouer le build si une permission ou un hôte change sans que les documents de confidentialité le disent.
- **Un seul adaptateur de site** (`content/gog-dom.js`) — chaque recherche dans le balisage de gog.com (cartes, prix, titre, position du panneau) essaie plusieurs stratégies, si bien qu'une refonte dégrade les fonctions en douceur au lieu de les casser en silence. « Vérifier cette page » dans les réglages avancés montre quelles recherches fonctionnent encore.
- **`MutationObserver` ciblé** sur le contenu de la page avec anti-rebond ; le bruit de l'en-tête est filtré et un `<main>` remplacé est détecté.
- **Chaque fonction s'exécute isolément** — si une recherche casse après un changement du site, seule cette fonction s'éteint et le reste continue ; « Vérifier cette page » liste ce qui a échoué.
- **N'apprend que des pages que vous ouvrez** — possession, notes, langues et faits de prix sont lus sur les pages que vous visitez vous-même et stockés localement. L'extension ne récupère rien en plus.

### Fonctionnalités
- 💱 **Taux en direct pour 24 devises** — shekel, euro, livre, zloty, rouble, réal, yen, yuan et d'autres, récupérés automatiquement sur `api.frankfurter.dev` toutes les 12 heures. Modifiables à la main.
- 📈 **Suivi des prix** — chaque visite d'une page de jeu enregistre un relevé. Un panneau de statistiques sur la page du jeu montre le prix actuel, le plus bas historique et la moyenne, ainsi qu'un verdict « Vaut-il la peine d'attendre ? ».
- 🔍 **Comparer sur IsThereAnyDeal** — un bouton sur la page du jeu cherche le même titre sur Steam / Epic / Humble / Fanatical.
- 🏷️ **Tableau de bord de tags complet** — une page séparée avec recherche, filtrage, compteur par tag et export CSV. Saisie semi-automatique des tags existants.
- 🔔 **Alertes et offres de la liste de souhaits** — un badge sur l'icône de la barre d'outils compte les jeux en promotion de la liste ; la fenêtre affiche vos trois plus fortes baisses de prix suivies.
- 🛡️ **Bannière DRM-free** — une bannière pleine avec une icône de bouclier et une pastille « GOG+ » en dégradé.
- 🎨 **Refonte visuelle des cartes** — adaptée au jeu : « Good Old Game » reçoit un discret effet CRT et un halo doré ; les titres Cyberpunk/Witcher un éclairage néon cyan/magenta.
- 🪟 **Info-bulles stylées** — remplacent les info-bulles par défaut du navigateur, avec titres, contenu riche et positionnement automatique.
- 📋 **Liste de mods dynamique** — récupérée automatiquement sur `gog.com/en/mods` toutes les 24 heures.
- 🌍 **Détection automatique de la devise de la page** — si GOG affiche déjà EUR (utilisateurs de l'UE), l'extension ne reconvertit pas.
- 🎯 **Vrai RTL** — `inline-start`/`end` au lieu de `left`/`right`, et `unicode-bidi: isolate` pour les prix.
- ⌨️ **Raccourcis clavier** — `Alt+G` ouvre la fenêtre, `Alt+Shift+G` active/désactive l'extension, `Alt+Shift+H` bascule l'hébreu ; `Ctrl/Cmd+K` ouvre une palette de commandes pour tout le reste.
- 🧙 **Assistant de première utilisation** — 4 étapes (devise, région, fonctions, thème), s'ouvre automatiquement à la première installation.
- ☁️ **Synchronisation entre appareils via un dossier de votre choix** (Dropbox, OneDrive, Google Drive, Syncthing…) — fusionne tags, notes, statuts, achats, alertes et historique des prix enregistrement par enregistrement, avec chiffrement facultatif. Rien de chez nous au milieu. Chrome / Edge / Brave.
- 🔎 **Recherche dans la bibliothèque depuis la barre d'adresse** — tapez `gog` + Tab, puis un nom de jeu, `tag:rpg` ou `status:backlog`.
- 🎨 **Thème « Native »** — prélève les couleurs et la police de gog.com lui-même, pour que les éléments ajoutés se fondent dans l'apparence du site, quelle qu'elle devienne.
- ⌨️ **Navigation au clavier** (facultative) — `J`/`K` passent d'un jeu à l'autre dans une liste, `T` ajoute un tag au jeu sélectionné.
- 📅 **Fichiers calendrier (`.ics`)** pour les délais de remboursement et les dates de sortie des jeux de la liste de souhaits, ainsi que 📝 **exports Markdown / Obsidian / CSV** depuis le tableau de bord de tags — tout est créé sur votre appareil.
- 🌍 **Neuf langues d'interface** — tableau de bord de tags, réglages avancés, fenêtre, assistant de première utilisation et textes propres à l'extension sur gog.com en anglais, hébreu (de droite à gauche), russe, polonais, allemand, français, espagnol, chinois simplifié et portugais brésilien. Ce que vous écrivez vous-même (noms de tags, notes) n'est jamais traduit.
- 🔒 **Tableau de bord de confidentialité** dans les réglages avancés — chaque adresse contactée par l'extension, ce qu'elle conserve sur votre appareil et en quelle quantité, l'accès supplémentaire aux sites que Chrome lui a accordé, et un effacement en un clic.
- 🩺 **Rapport de panne** — quand une fonction cesse de marcher après un changement du site, la fenêtre propose un rapport en un clic, sans adresses web ni données personnelles (« Signaler sur GitHub » ouvre seulement une page préremplie).
- 🖥️ **Vérification du système** sur les pages de jeu — compare l'exigence de RAM d'un jeu à ce que signale votre navigateur (les navigateurs ne voient ni le processeur ni la carte graphique). Décrivez votre ordinateur dans les réglages avancés et les exigences de RAM et d'espace disque libre sont comparées avec lui ; le système, le processeur et la carte graphique sont affichés à côté de l'exigence mais pas évalués — une estimation.

#### Offres et prix (v4)
- 💸 **« La remise est-elle réelle ? »** — compare le prix de base au plus bas des 30 derniers jours de GOG et à votre historique suivi ; ⏳ **compte à rebours de l'offre** sur la page du jeu, sur les cartes et dans le résumé.
- **Prix par heure de jeu**, **prix en plusieurs devises** à la fois, un **rythme des soldes** par jeu, un **graphique comparatif** pour 2–3 jeux, des totaux **« combien j'ai économisé »** et des **préréglages de TVA** nationaux (DE, FR, ES, IT, NL, RU).

#### Liste de souhaits et catalogue (v4)
- 💖 **Liste de souhaits intelligente** — tri par remise / écart au plus bas / prix converti / date d'ajout, filtres « près du plus bas » et « se termine bientôt », un total en direct, regroupement par tag ou statut, export CSV / Markdown / `.ics`.
- 🗂️ **Outils de catalogue** — une barre au-dessus de la grille : atténuer ou masquer les jeux que vous possédez, **pas intéressé** (restaurable), tri local de la page, densité compacte / liste, préréglages de filtres enregistrés, tags et suivi en masse, comparaison côte à côte.
- ♾️ **Défilement infini** (facultatif, désactivé par défaut) — en arrivant au bout d'une page de catalogue, la suivante est ajoutée en dessous, depuis l'API de catalogue propre à GOG (`catalog.gog.com`, le même appel que le site).

#### Page de jeu et bibliothèque (v4)
- 🎮 **Vérification des langues**, **ce qui a changé depuis votre dernière visite**, filtre d'avis, **jeux similaires que vous possédez**, **ce que contient vraiment un pack** (lu sur la page du pack lui-même, ou depuis l'API produit de GOG une fois par page de jeu — seul un identifiant numérique est envoyé) avec une alerte en cas de recoupement avec ce que vous possédez, liens « ouvrir dans » vers Steam / IsThereAnyDeal / PCGamingWiki / HowLongToBeat / SteamDB, et les raccourcis `W` / `N` / `A`.
- 📚 **Apprend votre bibliothèque en naviguant** (grâce à l'étiquette « IN LIBRARY » du site), ce qui permet de masquer les jeux possédés, des statistiques de bibliothèque réelles, une roulette pondérée du backlog, un objectif mensuel de « jeux à terminer » et des **cartes Wrapped / collectionneur** enregistrables en PNG.
- 📝 **Historique des versions des notes**, un export de **coffre Obsidian** (`.zip`) et des exports CSV / ligne par ligne pour **Notion, Google Sheets et Trello**.
- 🏆 **36 succès** sur trois niveaux (certains cachés), une **série** de jours de navigation et trois **défis mensuels** — le tout en local.
- ♿ **Un tableau de bord utilisable au clavier** — un lien d'évitement, des tags réordonnés avec `Alt`+`↑`/`↓`, des menus et dialogues qui retiennent le focus, et des annonces vocales des changements pour les lecteurs d'écran.

#### Synchronisation, notifications et apparence (v4)
- 🔄 **Synchronisation automatique du dossier** (toutes les 30 minutes et à l'ouverture du tableau de bord, quand le navigateur se souvient encore de l'autorisation du dossier et que le fichier n'est pas chiffré par mot de passe), une liste de conflits et des sauvegardes datées conservées dans le dossier (au plus une fois par jour, à l'ouverture du tableau de bord).
- 🔔 **Heures calmes et jours de la semaine calmes**, un mode **un résumé par jour**, des seuils, des **alertes par tag**, un **radar des saisons** facultatif, un résumé hebdomadaire plus riche enregistrable comme page web, une carte de liste de souhaits enregistrable en PNG — et un **webhook facultatif vers une adresse qui vous appartient** (voir le tableau des permissions).
- 🎨 **Replier / ancrer / réordonner** le panneau du jeu, **mode calme**, un **aspect simple** en un clic, des palettes adaptées aux déficiences de la vision des couleurs, une mise à l'échelle du texte, des profils de réglages et une courte **visite guidée** après la mise à jour.

### Module de refonte visuelle
S'active avec l'interrupteur « Design injection » de la fenêtre. Quand il est activé :
- Les prix utilisent partout une police à chasse fixe (`ui-monospace` / Cascadia / JetBrains) avec des chiffres tabulaires.
- Cartes selon l'époque : lignes de balayage pour les classiques, lueur néon pour les titres de l'ère cyberpunk.
- Profondeur et ombres discrètes, fond en dégradé, micro-interactions au survol.
- La pastille « Good Old Game » reçoit un dégradé doré métallique au lieu d'un violet uni.
- Chargeurs squelettes avec effet de scintillement au lieu de marqueurs `{{ product.title }}` visibles.
- Mise en page épurée : masque les promotions expirées des années passées.
- Onze thèmes (Neon, Classic GOG, CRT Green, Sunset, Light, AMOLED, Amber, High contrast, Custom, Auto, Native) — Auto suit le réglage clair/sombre du système, Native suit l'apparence de gog.com.

### Confidentialité sans détour
- **Seulement cinq domaines** (plus l'unique adresse de webhook que vous pouvez saisir vous-même, seulement si vous l'activez) reçoivent des requêtes réseau — et chaque requête est listée dans les réglages avancés (Confidentialité et transparence) :
  1. `www.gog.com` — pour lire le contenu des pages et insérer l'interface, ainsi que la liste publique des mods une fois par jour.
  2. `api.frankfurter.dev` — pour les taux de change (pas de clé d'API, pas de suivi).
  3. `www.cheapshark.com` — le tableau facultatif de comparaison de prix sur les pages de jeu (gratuit, sans clé ; désactivable dans la fenêtre).
  4. `api.gog.com` — l'API produit propre à GOG, interrogée une fois par page de jeu pour savoir quels jeux contient un pack (seul son identifiant numérique est envoyé ; activée par défaut, désactivable sous *Catalogue, liste de souhaits et bibliothèque*).
  5. `catalog.gog.com` — l'API de catalogue propre à GOG, utilisée seulement si vous activez le défilement infini (désactivé par défaut).

  Les deux derniers n'ont pas d'entrée dans le tableau des permissions car ils sont appelés depuis la page selon les règles cross-origin de GOG lui-même — les mêmes appels que ceux du site —, si bien que Chrome n'affiche aucun avertissement d'installation supplémentaire.
- **La synchronisation de dossier ne fait aucune requête réseau elle-même** — elle lit et écrit un fichier dans un dossier que vous choisissez ; c'est votre propre client cloud qui s'occupe de l'envoi.
- **Le webhook est facultatif et vous appartient** — rien n'est demandé à l'installation. Si vous saisissez votre propre adresse `https://` dans les réglages avancés, le navigateur vous demande une fois d'autoriser cette seule origine ; seul le texte de la notification y est envoyé, et l'adresse ne quitte jamais votre appareil via les exports ou la synchronisation.
- **Zéro analytique, zéro gtag, zéro Google Fonts.**
- **Tags, notes et historique restent sur votre appareil** via `chrome.storage.local`. Rien n'en sort.
- **Open source** — chaque ligne de code est dans ce dépôt.

---

## 🚀 Installation

1. Téléchargez `gog-enhancer-webstore.zip` depuis la page [Releases](https://github.com/DrummingBird1/GOGEnhancer/releases) et extrayez-le où vous voulez (ou, si vous avez cloné le dépôt, utilisez directement le dossier `extension/`).
2. Ouvrez Chrome et allez sur `chrome://extensions/`.
3. Activez le **Mode développeur** (coin supérieur droit).
4. Cliquez sur **Charger l'extension non empaquetée** et choisissez le dossier extrait (ou `extension/`).
5. L'assistant de première utilisation s'ouvre automatiquement dans un nouvel onglet. Suivez les étapes.
6. Allez sur [gog.com](https://www.gog.com) — l'extension est active.

---

## 🌐 Navigateurs pris en charge

| Navigateur | État |
|---|---|
| **Chrome** | ✅ Entièrement pris en charge — c'est la cible principale. |
| **Edge, Brave, Opera** (basés sur Chromium) | ✅ Fonctionne comme Chrome — même moteur, mêmes étapes « Charger l'extension non empaquetée ». |
| **Firefox** | ⚠️ Expérimental / non vérifié. `node scripts/build-firefox.mjs` construit une variante pour Firefox (une page d'arrière-plan à la place du service worker, un identifiant de module, une déclaration « ne collecte rien ») propre sous `web-ext lint`, et le zip est joint à chaque version GitHub — mais **elle n'a jamais été exécutée dans un vrai Firefox**, et la synchronisation de dossier nécessite une API que Firefox n'a pas. La voie d'installation prise en charge est la fiche du Chrome Web Store ; les utilisateurs d'Edge peuvent y installer la même extension ou utiliser « Charger l'extension non empaquetée » (Edge Add-ons n'a pas encore de fiche). |

---

## ⌨️ Raccourcis clavier

| Raccourci | Action |
|---|---|
| `Alt+G` | Ouvrir la fenêtre |
| `Alt+Shift+G` | Activer/désactiver GOG Enhancer |
| `Alt+Shift+H` | Activer/désactiver les traductions en hébreu |
| `Ctrl/Cmd+K` (sur gog.com) | Ouvrir la palette de commandes |
| `J` / `K` / `T` (sur les listes de jeux, facultatif) | Jeu précédent/suivant, taguer le jeu sélectionné |
| `W` / `N` / `A` (sur une page de jeu, facultatif) | `W` appuie sur le bouton de liste de souhaits du site (il bascule), `N` va au champ de note, `A` au champ d'alerte de prix ; `?` liste les touches |
| `gog` + `Tab` (barre d'adresse) | Rechercher dans votre propre bibliothèque |

Les raccourcis se modifient sur `chrome://extensions/shortcuts`.

---

## ⚙️ Permissions expliquées

| Permission | Pourquoi |
|---|---|
| `storage` | Enregistrer préférences, tags et historique |
| `alarms` | Planifier les actualisations en arrière-plan des taux, mods et liste de souhaits |
| `notifications` | Uniquement sur demande — alertes bureau pour les délais de remboursement et les offres de la liste de souhaits |
| Hôte : `www.gog.com` | Insérer l'interface dans les pages GOG |
| Hôte : `api.frankfurter.dev` | Récupérer les taux de change |
| Pas de permission : `www.cheapshark.com` | Comparaison facultative des prix entre boutiques sur les pages de jeu — CheapShark autorise la lecture cross-origin, donc aucune permission d'hôte n'est déclarée |
| Hôte facultatif : toute origine `https://` | **Jamais accordée à l'installation.** Demandée à l'exécution, pour une seule origine, si vous saisissez votre propre adresse de webhook dans les réglages avancés ; seul le texte de la notification y est envoyé |

Aucune permission n'est nécessaire pour la synchronisation de dossier (vous accordez un dossier à la fois, par un clic) ni pour le mot-clé de la barre d'adresse.

---

## 🛠️ Limitations connues

- **L'adaptation à la refonte a été vérifiée sur le site réel, mais gog.com continue de changer** — la page d'accueil, le catalogue et la page de jeu ont été inspectés et testés de bout en bout (sans connexion) le 2026-10-02 ; les pages de compte (liste de souhaits, bibliothèque, panier) exigent une connexion et n'ont été inspectées que structurellement. Le site mélange actuellement deux générations de balisage, attendez-vous donc à d'autres changements. Si quelque chose cesse de marcher après une mise à jour de gog.com, utilisez *Réglages avancés → Vérifier cette page*.
- **La synchronisation de dossier résout les conflits selon l'horloge de chaque appareil** — la dernière modification l'emporte par enregistrement (les enregistrements écrasés sont listés sur la page des réglages), donc des horloges très décalées peuvent désigner le mauvais gagnant. Elle nécessite la File System Access API (Chrome, Edge, Brave ; pas Firefox), et l'accès au dossier doit être accordé de nouveau depuis la page des réglages de temps en temps. La tâche d'arrière-plan ne peut demander ni autorisation ni mot de passe : s'il en manque un, elle saute la synchronisation en silence jusqu'à ce que vous ouvriez le tableau de bord. Testée avec un dossier local, pas avec un vrai client de synchronisation cloud.
- **Tout ce qui est dans la v4 n'a pas pu être vérifié sur le vrai site** — les fonctions qui dépendent de la connexion (lignes de la liste de souhaits, possession de la bibliothèque, jeux recoupés par un pack) ont été construites à partir de la *structure* enregistrée des pages et de tests unitaires et de bout en bout, sans essai avec un compte réel. Le webhook n'a pas été essayé sur un vrai point de terminaison, et Firefox n'est pas testé.
- **Le défilement infini suppose que l'API de catalogue de GOG reste telle quelle** — il ne prolonge qu'une liste qu'il peut faire correspondre à celle affichée, d'après la requête que le site a lui-même transmise à la page. Si GOG restreint cette API, la fonction cesse simplement d'ajouter des jeux ; rien d'autre n'est touché. Les entrées du calendrier des dates de sortie n'existent que pour les jeux dont vous avez ouvert la page (la liste de souhaits elle-même n'indique qu'une année).
- **Les traductions ne sont pas relues** — les huit langues d'interface autres que l'anglais ont été écrites sans relecture par des locuteurs natifs ; un projet d'abord hébraïque, donc l'hébreu a reçu le plus d'attention. Les textes qui n'apparaissent qu'après une action (certains dialogues et messages d'erreur) sont couverts, mais tout élément nouveau sans traduction reste simplement en anglais.
- **Non réalisé :** un détecteur de panier et de jeux offerts, un panneau latéral et des menus contextuels (chacun demanderait une nouvelle permission).
- **Récupération de la liste de mods** — dépend du fait que `gog.com/en/mods` garde une structure similaire. En cas de régression, forcez l'actualisation dans les réglages avancés.
- **Compteur du badge de la liste de souhaits** — repose sur un comptage en direct dans le DOM lors de la visite de `/account/wishlist` (validité 24 h). Si vous n'y êtes pas allé récemment, le badge reste vide jusqu'à la prochaine visite — l'info-bulle de l'icône suggère d'y passer.
- **Le minuteur de remboursement repose sur une date saisie à la main** — GOG n'expose la date d'achat dans aucun DOM public, donc le compte à rebours de 30 jours dépend d'une date que vous tapez dans le panneau. Pas de date, pas de compte à rebours.
- **La détection des genres est en partie automatique (depuis la v2.6.0)** — Horror/Role-playing/Strategy sont lus dans le vrai champ « Genre: » de la page du jeu et mis en cache par slug (`gameGenres`) à la première visite. Sci-fi et Indie reposent encore sur la correspondance de titres connus par expression régulière — chez GOG ils semblent se trouver dans le nuage « Tags » plus large plutôt que sous « Genre: », et cette structure n'est pas entièrement vérifiée. Tant qu'un jeu précis n'a pas été visité, les cinq groupes de genres reviennent à l'expression régulière.
- **La conversion entre devises passe toujours par l'USD** — si le taux de l'une des deux paires manque dans `rates`, la conversion n'a pas lieu. Tous les taux sont récupérés automatiquement toutes les 12 heures sur frankfurter.dev.
- **Les alertes de prix sur toute la liste de souhaits, les offres de la liste et la valeur de la liste ne couvrent que les jeux que vous avez visités** — les trois reposent sur `priceHistory`, construit uniquement en visitant la page d'un jeu. Un jeu de la liste que vous n'avez jamais visité n'a rien à comparer, donc il n'apparaîtra ni dans les alertes, ni dans les « Offres de la liste de souhaits » de la fenêtre, ni dans la statistique « Valeur de la liste de souhaits », même si son prix a baissé.

---

## 📜 Journal des modifications

L'historique complet des versions se trouve sur la [page des Releases GitHub](https://github.com/DrummingBird1/GOGEnhancer/releases) — chaque version a sa propre page, avec sa propre bannière — et sur la [page du journal des modifications](https://drummingbird1.github.io/GOGEnhancer/changelog.html) du site de l'extension.

---

## 🧑‍💻 Conçu d'abord pour le marché israélien

Initialement taillé pour les utilisateurs israéliens (ILS, TVA 18 %, hébreu) — mais fonctionne tout aussi bien avec n'importe laquelle des 24 devises prises en charge. Chaque champ est modifiable.

---

## ☕ Soutien

GOG Enhancer est gratuit, open source, sans publicité et ne collecte aucune donnée. S'il vous fait économiser de l'argent ou du temps et que vous souhaitez soutenir son développement, vous pouvez devenir soutien sur l'une de ces plateformes :

- **[Ko-fi](https://ko-fi.com/idanlights)**
- **[Buy Me a Coffee](https://buymeacoffee.com/solvaris)**
- **[Patreon](https://www.patreon.com/c/Solvaris)**

Entièrement facultatif — toutes les fonctionnalités restent gratuites pour tout le monde quoi qu'il arrive.
