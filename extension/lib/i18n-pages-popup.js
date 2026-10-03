/**
 * The popup's rows (see i18n-pages.js) — only what has no data-i18n key of its
 * own: the failure banner, the digest, the rate strip, a few labels.
 * Order: he, ru, pl, de, fr, es.
 */
// @ts-check

(() => {
  "use strict";

  /** @type {any} */ (window).GOGPlusPageI18n?.add([
    ["Enable GOG Enhancer", "הפעל את GOG Enhancer", "Включить GOG Enhancer", "Włącz GOG Enhancer", "GOG Enhancer aktivieren", "Activer GOG Enhancer", "Activar GOG Enhancer"],
    ["Something on gog.com isn't working", "משהו ב-gog.com לא עובד", "Что-то на gog.com не работает", "Coś na gog.com nie działa", "Etwas auf gog.com funktioniert nicht", "Quelque chose ne fonctionne pas sur gog.com", "Algo de gog.com no funciona"],
    ["{} stopped working on a gog.com page. The rest of the extension still works.", "{1} הפסיק לעבוד בדף של gog.com. שאר התוסף ממשיך לעבוד.", "{1} перестало работать на странице gog.com. Остальные функции расширения работают.", "{1} przestało działać na stronie gog.com. Reszta rozszerzenia nadal działa.", "{1} funktioniert auf einer gog.com-Seite nicht mehr. Der Rest der Erweiterung läuft weiter.", "{1} a cessé de fonctionner sur une page de gog.com. Le reste de l'extension fonctionne toujours.", "{1} dejó de funcionar en una página de gog.com. El resto de la extensión sigue funcionando."],
    ["Report on GitHub", "דווחו ב-GitHub", "Сообщить на GitHub", "Zgłoś na GitHubie", "Auf GitHub melden", "Signaler sur GitHub", "Informar en GitHub"],
    ["Dismiss", "סגור", "Скрыть", "Zamknij", "Schließen", "Ignorer", "Descartar"],
    ["The report has no web addresses or personal data. \"Report on GitHub\" only opens a page with it filled in — you choose whether to send it.", "בדוח אין כתובות אינטרנט או מידע אישי. \"דווחו ב-GitHub\" רק פותח דף עם הדוח ממולא — אתם בוחרים אם לשלוח.", "В отчёте нет веб-адресов и личных данных. «Сообщить на GitHub» лишь открывает страницу с заполненным отчётом — отправлять его или нет, решаете вы.", "Raport nie zawiera adresów internetowych ani danych osobowych. „Zgłoś na GitHubie” tylko otwiera stronę z wypełnionym raportem — to Ty decydujesz, czy go wysłać.", "Der Bericht enthält keine Webadressen oder persönlichen Daten. „Auf GitHub melden“ öffnet nur eine Seite mit dem ausgefüllten Bericht — du entscheidest, ob du ihn sendest.", "Le rapport ne contient ni adresses web ni données personnelles. « Signaler sur GitHub » ouvre seulement une page pré-remplie — vous décidez de l'envoyer ou non.", "El informe no contiene direcciones web ni datos personales. «Informar en GitHub» solo abre una página con él rellenado: tú decides si lo envías."],
    ["Using bundled rates · click ↻ to refresh", "משתמש בשערים מובנים · לחצו על ↻ לרענון", "Используются встроенные курсы · нажмите ↻ для обновления", "Używane są wbudowane kursy · kliknij ↻, aby odświeżyć", "Mitgelieferte Kurse in Gebrauch · ↻ zum Aktualisieren", "Taux intégrés utilisés · cliquez sur ↻ pour actualiser", "Se usan los tipos incluidos · pulsa ↻ para actualizar"],
    ["{} · {}", "{1} · {2}", "{1} · {2}", "{1} · {2}", "{1} · {2}", "{1} · {2}", "{1} · {2}"],
    ["just updated", "עודכן הרגע", "только что обновлено", "właśnie zaktualizowano", "gerade aktualisiert", "à l'instant", "recién actualizado"],
    ["⚠ refresh failed", "⚠ הרענון נכשל", "⚠ не удалось обновить", "⚠ odświeżenie nie powiodło się", "⚠ Aktualisierung fehlgeschlagen", "⚠ échec de l'actualisation", "⚠ falló la actualización"],
    ["{n}h ago", "לפני {1} שע׳", "{1} ч назад", "{1} godz. temu", "vor {1} Std.", "il y a {1} h", "hace {1} h"],
    ["{n}d ago", "לפני {1} ימים", "{1} дн. назад", "{1} dni temu", "vor {1} Tg.", "il y a {1} j", "hace {1} d"],
    ["Off (USD only)", "כבוי (USD בלבד)", "Выкл. (только USD)", "Wyłączone (tylko USD)", "Aus (nur USD)", "Désactivé (USD seulement)", "Desactivado (solo USD)"],
    ["VAT estimator", "מעריך מע״מ", "Оценка НДС", "Szacowanie VAT", "MwSt.-Schätzung", "Estimation de la TVA", "Estimador de IVA"],
    ["Refresh exchange rates now", "רענן שערי חליפין עכשיו", "Обновить курсы валют сейчас", "Odśwież kursy walut teraz", "Wechselkurse jetzt aktualisieren", "Actualiser les taux de change maintenant", "Actualizar los tipos de cambio ahora"],
    ["Show gog.com without GOG Enhancer's styling — features keep working.", "הצג את gog.com בלי העיצוב של GOG Enhancer — התכונות ממשיכות לעבוד.", "Показывать gog.com без оформления GOG Enhancer — функции продолжают работать.", "Pokaż gog.com bez stylizacji GOG Enhancer — funkcje nadal działają.", "gog.com ohne das Styling von GOG Enhancer anzeigen — die Funktionen laufen weiter.", "Afficher gog.com sans le style de GOG Enhancer — les fonctions continuent de marcher.", "Mostrar gog.com sin el estilo de GOG Enhancer: las funciones siguen funcionando."],
    ["No glow, blur or animation.", "בלי זוהר, טשטוש או אנימציה.", "Без свечения, размытия и анимации.", "Bez poświaty, rozmycia i animacji.", "Kein Leuchten, Weichzeichnen oder Animationen.", "Sans halo, flou ni animation.", "Sin brillo, desenfoque ni animación."],
    ["Sort, near-my-low filter, totals, export.", "מיון, מסנן \"קרוב למחיר הנמוך שלי\", סכומים, ייצוא.", "Сортировка, фильтр «около моего минимума», итоги, экспорт.", "Sortowanie, filtr „blisko mojego minimum”, sumy, eksport.", "Sortieren, Filter „nahe meinem Tiefstpreis“, Summen, Export.", "Tri, filtre « proche de mon plus bas », totaux, export.", "Ordenar, filtro «cerca de mi mínimo», totales, exportar."],
    ["Sort a page, hide owned games, compare, save searches.", "מיון דף, הסתרת משחקים שכבר יש לכם, השוואה, שמירת חיפושים.", "Сортировка страницы, скрытие имеющихся игр, сравнение, сохранение поиска.", "Sortowanie strony, ukrywanie posiadanych gier, porównywanie, zapisywanie wyszukiwań.", "Seite sortieren, besessene Spiele ausblenden, vergleichen, Suchen speichern.", "Trier une page, masquer les jeux possédés, comparer, enregistrer des recherches.", "Ordenar una página, ocultar juegos que ya tienes, comparar, guardar búsquedas."],
    ["Save this week's digest as a web page you can keep or send", "שמרו את סיכום השבוע כדף אינטרנט שאפשר לשמור או לשלוח", "Сохранить сводку этой недели как веб-страницу, которую можно хранить или отправить", "Zapisz podsumowanie tego tygodnia jako stronę internetową, którą możesz zachować lub wysłać", "Wochenrückblick als Webseite speichern, die du aufbewahren oder senden kannst", "Enregistrer le résumé de la semaine comme page web à garder ou à envoyer", "Guardar el resumen de esta semana como una página web que puedes conservar o enviar"],
    ["Save as page", "שמירה כדף", "Сохранить как страницу", "Zapisz jako stronę", "Als Seite speichern", "Enregistrer en page", "Guardar como página"],
    ["⏰ refund closes in {n}d", "⏰ חלון ההחזר נסגר בעוד {1} ימים", "⏰ возврат закрывается через {1} дн.", "⏰ zwrot kończy się za {1} dni", "⏰ Rückgabe endet in {1} Tg.", "⏰ remboursement possible encore {1} j", "⏰ el reembolso termina en {1} d"],
    ["🔔 {} — alert hit", "🔔 {1} — ההתראה הופעלה", "🔔 {1} — сработало оповещение", "🔔 {1} — alert zadziałał", "🔔 {1} — Alarm ausgelöst", "🔔 {1} — alerte déclenchée", "🔔 {1} — alerta activada"],
    ["📉 -{n}% off peak", "📉 ‎-{1}% מהשיא", "📉 -{1}% от пика", "📉 -{1}% od szczytu", "📉 -{1} % unter Höchstpreis", "📉 -{1} % sous le pic", "📉 -{1} % del máximo"],
    ["⏳ offer ends in under a day", "⏳ ההצעה מסתיימת בעוד פחות מיום", "⏳ предложение закончится менее чем через день", "⏳ oferta kończy się za mniej niż dobę", "⏳ Angebot endet in weniger als einem Tag", "⏳ l'offre se termine dans moins d'un jour", "⏳ la oferta termina en menos de un día"],
    ["⏳ offer ends in {n}d", "⏳ ההצעה מסתיימת בעוד {1} ימים", "⏳ предложение закончится через {1} дн.", "⏳ oferta kończy się za {1} dni", "⏳ Angebot endet in {1} Tg.", "⏳ l'offre se termine dans {1} j", "⏳ la oferta termina en {1} d"],
    ["Copied ✓", "הועתק ✓", "Скопировано ✓", "Skopiowano ✓", "Kopiert ✓", "Copié ✓", "Copiado ✓"],
    ["…and {n} more change{} — see the full changelog", "…ועוד {1} שינויים — ראו את יומן השינויים המלא", "…и ещё {1} {1#изменение|изменения|изменений} — см. полный список изменений", "…i jeszcze {1} {1#zmiana|zmiany|zmian} — zobacz pełną listę zmian", "…und {1} weitere Änderung(en) — siehe das vollständige Änderungsprotokoll", "…et {1} autre(s) changement(s) — voir le journal complet des modifications", "…y {1} cambio(s) más — consulta el registro de cambios completo"],
    ["Couldn't copy", "לא ניתן להעתיק", "Не удалось скопировать", "Nie udało się skopiować", "Kopieren nicht möglich", "Copie impossible", "No se pudo copiar"],
    ["Buy Me a Coffee", "קנו לי קפה", "Угостить кофе", "Postaw mi kawę", "Spendiere mir einen Kaffee", "Offrez-moi un café", "Invítame a un café"],
    ["🧡 Coffee", "🧡 קפה", "🧡 Кофе", "🧡 Kawa", "🧡 Kaffee", "🧡 Café", "🧡 Café"],
  ]);
})();
