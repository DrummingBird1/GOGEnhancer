/**
 * Rows shared by more than one of the extension's own pages (see i18n-pages.js).
 * Order of the translations: he, ru, pl, de, fr, es.
 */
// @ts-check

(() => {
  "use strict";

  /** @type {any} */ (window).GOGPlusPageI18n?.add([
    // --- regions and currencies
    ["Israel", "ישראל", "Израиль", "Izrael", "Israel", "Israël", "Israel"],
    ["EU", "האיחוד האירופי", "ЕС", "UE", "EU", "UE", "UE"],
    ["European Union", "האיחוד האירופי", "Европейский союз", "Unia Europejska", "Europäische Union", "Union européenne", "Unión Europea"],
    ["UK", "בריטניה", "Великобритания", "Wielka Brytania", "Vereinigtes Königreich", "Royaume-Uni", "Reino Unido"],
    ["United Kingdom", "בריטניה", "Великобритания", "Wielka Brytania", "Vereinigtes Königreich", "Royaume-Uni", "Reino Unido"],
    ["Poland", "פולין", "Польша", "Polska", "Polen", "Pologne", "Polonia"],
    ["USA", "ארה״ב", "США", "USA", "USA", "États-Unis", "EE. UU."],
    ["Germany", "גרמניה", "Германия", "Niemcy", "Deutschland", "Allemagne", "Alemania"],
    ["France", "צרפת", "Франция", "Francja", "Frankreich", "France", "Francia"],
    ["Spain", "ספרד", "Испания", "Hiszpania", "Spanien", "Espagne", "España"],
    ["Italy", "איטליה", "Италия", "Włochy", "Italien", "Italie", "Italia"],
    ["Netherlands", "הולנד", "Нидерланды", "Holandia", "Niederlande", "Pays-Bas", "Países Bajos"],
    ["Russia", "רוסיה", "Россия", "Rosja", "Russland", "Russie", "Rusia"],
    ["Custom", "מותאם אישית", "Своё", "Własne", "Benutzerdefiniert", "Personnalisé", "Personalizado"],
    ["{} · {n}% VAT", "{1} · {2}% מע״מ", "{1} · НДС {2}%", "{1} · VAT {2}%", "{1} · {2} % MwSt.", "{1} · TVA {2} %", "{1} · {2} % de IVA"],
    ["{n}% VAT · {}", "{1}% מע״מ · {2}", "НДС {1}% · {2}", "VAT {1}% · {2}", "{1} % MwSt. · {2}", "TVA {1} % · {2}", "{1} % de IVA · {2}"],
    ["{n}% VAT (varies) · {}", "{1}% מע״מ (משתנה) · {2}", "НДС {1}% (зависит от страны) · {2}", "VAT {1}% (zależy od kraju) · {2}", "{1} % MwSt. (je nach Land) · {2}", "TVA {1} % (variable) · {2}", "{1} % de IVA (varía) · {2}"],
    ["{n}% (state-dependent)", "{1}% (תלוי במדינה)", "{1}% (зависит от штата)", "{1}% (zależnie od stanu)", "{1} % (je nach Bundesstaat)", "{1} % (selon l'État)", "{1} % (según el estado)"],
    ["manual", "ידני", "вручную", "ręcznie", "manuell", "manuel", "manual"],
    ["Israeli Shekel", "שקל ישראלי", "Израильский шекель", "Izraelski szekel", "Israelischer Schekel", "Shekel israélien", "Séquel israelí"],
    ["Euro", "אירו", "Евро", "Euro", "Euro", "Euro", "Euro"],
    ["British Pound", "לירה שטרלינג", "Британский фунт", "Funt brytyjski", "Britisches Pfund", "Livre sterling", "Libra esterlina"],
    ["Polish Zloty", "זלוטי פולני", "Польский злотый", "Złoty polski", "Polnischer Złoty", "Zloty polonais", "Esloti polaco"],
    ["Russian Rouble", "רובל רוסי", "Российский рубль", "Rubel rosyjski", "Russischer Rubel", "Rouble russe", "Rublo ruso"],
    ["₪ ILS — Israeli Shekel", "₪ ILS — שקל ישראלי", "₪ ILS — израильский шекель", "₪ ILS — izraelski szekel", "₪ ILS — Israelischer Schekel", "₪ ILS — shekel israélien", "₪ ILS — séquel israelí"],
    ["€ EUR — Euro", "€ EUR — אירו", "€ EUR — евро", "€ EUR — euro", "€ EUR — Euro", "€ EUR — euro", "€ EUR — euro"],
    ["£ GBP — Pound", "£ GBP — לירה שטרלינג", "£ GBP — фунт стерлингов", "£ GBP — funt szterling", "£ GBP — Pfund Sterling", "£ GBP — livre sterling", "£ GBP — libra esterlina"],
    ["₽ RUB — Russian Rouble", "₽ RUB — רובל רוסי", "₽ RUB — российский рубль", "₽ RUB — rubel rosyjski", "₽ RUB — Russischer Rubel", "₽ RUB — rouble russe", "₽ RUB — rublo ruso"],
    ["zł PLN — Polish Zloty", "zł PLN — זלוטי פולני", "zł PLN — польский злотый", "zł PLN — złoty polski", "zł PLN — Polnischer Złoty", "zł PLN — zloty polonais", "zł PLN — esloti polaco"],

    // --- looks
    ["Neon", "ניאון", "Неон", "Neon", "Neon", "Néon", "Neón"],
    ["magenta + cyan", "מג׳נטה + ציאן", "маджента + циан", "magenta + cyjan", "Magenta + Cyan", "magenta + cyan", "magenta + cian"],
    ["magenta + cyan (default)", "מג׳נטה + ציאן (ברירת מחדל)", "маджента + циан (по умолчанию)", "magenta + cyjan (domyślnie)", "Magenta + Cyan (Standard)", "magenta + cyan (par défaut)", "magenta + cian (predeterminado)"],
    ["Classic GOG", "GOG קלאסי", "Классический GOG", "Klasyczny GOG", "Klassisches GOG", "GOG classique", "GOG clásico"],
    ["deep purple", "סגול עמוק", "глубокий фиолетовый", "głęboki fiolet", "tiefes Violett", "violet profond", "púrpura intenso"],
    ["CRT Green", "ירוק CRT", "Зелёный ЭЛТ", "Zielony CRT", "CRT-Grün", "Vert CRT", "Verde CRT"],
    ["phosphor", "זרחן", "люминофор", "luminofor", "Phosphor", "phosphore", "fósforo"],
    ["phosphor screen", "מסך זרחני", "люминофорный экран", "ekran luminoforowy", "Phosphor-Bildschirm", "écran au phosphore", "pantalla de fósforo"],
    ["Sunset", "שקיעה", "Закат", "Zachód słońca", "Sonnenuntergang", "Coucher de soleil", "Atardecer"],
    ["orange + pink", "כתום + ורוד", "оранжевый + розовый", "pomarańcz + róż", "Orange + Pink", "orange + rose", "naranja + rosa"],
    ["Light", "בהיר", "Светлая", "Jasny", "Hell", "Clair", "Claro"],
    ["inverted palette", "פלטה הפוכה", "инвертированная палитра", "odwrócona paleta", "invertierte Palette", "palette inversée", "paleta invertida"],
    ["Auto", "אוטומטי", "Авто", "Auto", "Automatisch", "Auto", "Automático"],
    ["matches your system", "תואם למערכת שלך", "как в системе", "zgodny z systemem", "passt zu deinem System", "suit votre système", "sigue tu sistema"],
    ["High contrast", "ניגודיות גבוהה", "Высокая контрастность", "Wysoki kontrast", "Hoher Kontrast", "Contraste élevé", "Alto contraste"],
    ["max readability", "קריאות מרבית", "максимальная читаемость", "maksymalna czytelność", "maximale Lesbarkeit", "lisibilité maximale", "máxima legibilidad"],
    ["pick your own colors", "בחרו צבעים משלכם", "выберите свои цвета", "wybierz własne kolory", "eigene Farben wählen", "choisissez vos couleurs", "elige tus colores"],
    ["Native", "מקורי", "Родная", "Natywny", "Nativ", "Natif", "Nativo"],
    ["matches gog.com's own look", "תואם למראה של gog.com", "как на gog.com", "dopasowany do wyglądu gog.com", "passt zum Look von gog.com", "reprend l'apparence de gog.com", "imita el aspecto de gog.com"],

    // --- buttons and words used on several pages
    ["Copy report", "העתק דוח", "Скопировать отчёт", "Kopiuj raport", "Bericht kopieren", "Copier le rapport", "Copiar informe"],
    ["Sync now", "סנכרן עכשיו", "Синхронизировать", "Synchronizuj teraz", "Jetzt synchronisieren", "Synchroniser maintenant", "Sincronizar ahora"],
    ["Never", "אף פעם", "Никогда", "Nigdy", "Nie", "Jamais", "Nunca"],
    ["Delete everything…", "מחק הכול…", "Удалить всё…", "Usuń wszystko…", "Alles löschen …", "Tout supprimer…", "Eliminar todo…"],
    ["Skip", "דלג", "Пропустить", "Pomiń", "Überspringen", "Passer", "Omitir"],
    ["Plain look", "מראה פשוט", "Простой вид", "Prosty wygląd", "Schlichtes Aussehen", "Apparence simple", "Aspecto sencillo"],
    ["Calm mode", "מצב רגוע", "Спокойный режим", "Tryb spokojny", "Ruhemodus", "Mode calme", "Modo tranquilo"],
    ["Catalog tools", "כלי קטלוג", "Инструменты каталога", "Narzędzia katalogu", "Katalog-Werkzeuge", "Outils du catalogue", "Herramientas del catálogo"],
    ["Smart wishlist", "רשימת משאלות חכמה", "Умный список желаемого", "Inteligentna lista życzeń", "Intelligente Wunschliste", "Liste de souhaits intelligente", "Lista de deseos inteligente"],
    ["Custom tags & notes", "תגיות והערות אישיות", "Свои теги и заметки", "Własne tagi i notatki", "Eigene Tags & Notizen", "Tags et notes personnalisés", "Etiquetas y notas propias"],
    ["Wishlist sale alerts", "התראות מבצע ברשימת המשאלות", "Оповещения о скидках из списка желаемого", "Alerty o promocjach z listy życzeń", "Angebots-Alarme für die Wunschliste", "Alertes de promotion de la liste de souhaits", "Alertas de ofertas de la lista de deseos"],
    ["Visual upgrade", "שדרוג חזותי", "Визуальные улучшения", "Ulepszenia wizualne", "Optische Aufwertung", "Amélioration visuelle", "Mejora visual"],
    ["RTL layout", "פריסת RTL", "Раскладка RTL", "Układ RTL", "RTL-Layout", "Disposition RTL", "Diseño RTL"],
    ["Price history", "היסטוריית מחירים", "История цен", "Historia cen", "Preisverlauf", "Historique des prix", "Historial de precios"],
    ["Close window", "סגור חלון", "Закрыть окно", "Zamknij okno", "Fenster schließen", "Fermer la fenêtre", "Cerrar ventana"],
  ]);
})();
