/**
 * GOG+ Hebrew translations dictionary v2.
 *
 * Three layers:
 *   - exact:   stable strings → direct replacement
 *   - patterns: regex with placeholders ({n}, {x})
 *   - selectors: CSS selectors mapped to fixed Hebrew labels
 *
 * We translate only stable navigation/UI strings — never user-generated
 * content, game titles, or developer/publisher names.
 */
// @ts-check

window.GOG_PLUS_TRANSLATIONS = {
  exact: {
    // ---- Top navigation ----
    "Store": "חנות",
    "New releases": "חדשים",
    "Bestsellers": "הנמכרים ביותר",
    "On sale now": "במבצע עכשיו",
    "Movies": "סרטים",
    "About": "אודות",
    "Community": "קהילה",
    "Support": "תמיכה",
    "Sign in": "התחברות",
    "Create account": "פתח חשבון",
    "Join GOG": "הצטרף ל-GOG",
    "Sign out": "התנתק",
    "Menu": "תפריט",
    "More": "עוד",
    "Search": "חיפוש",

    // ---- Cart ----
    "Your shopping cart is empty right now.": "עגלת הקניות שלך ריקה כרגע.",
    "Your cart is empty": "העגלה ריקה",
    "Go to checkout": "מעבר לתשלום",
    "Add to cart": "הוסף לעגלה",
    "Buy now": "קנה עכשיו",
    "Pre-order now": "הזמן מראש",
    "Owned": "ברשותך",
    "Free": "חינם",
    "Play for free": "שחק בחינם",
    "Browse bestsellers": "עיין בנמכרים ביותר",
    "Your wishlist": "רשימת המשאלות שלך",

    // ---- Account ----
    "Your account": "החשבון שלי",
    "Activity feed": "פיד פעילות",
    "Your profile": "הפרופיל שלי",
    "Wishlist": "רשימת משאלות",
    "Your Wallet": "הארנק שלי",
    "Reviews": "ביקורות",
    "Friends": "חברים",
    "Chat": "צ׳אט",
    "Redeem a code": "מימוש קוד",
    "Redeem code": "מימוש קוד",
    "Orders & settings": "הזמנות והגדרות",
    "Language & currency": "שפה ומטבע",
    "Color mode": "מצב תצוגה",
    "System mode": "מצב מערכת",
    "Dark mode": "מצב כהה",
    "Light mode": "מצב בהיר",
    "Apply changes": "החל שינויים",
    "Manage friends": "ניהול חברים",
    "Invite friends": "הזמן חברים",

    // ---- Wishlist & misc actions ----
    "Wishlisted": "ברשימת משאלות",
    "Remove": "הסר",
    "Move to wishlist": "העבר לרשימת משאלות",
    "Browse all games": "לכל המשחקים",
    "Browse the deals": "לכל המבצעים",
    "Browse Deals": "צפה במבצעים",
    "See more": "עוד",
    "Browse": "צפייה",
    "Read more": "קרא עוד",
    "Learn more": "מידע נוסף",
    "Vote now": "הצבע עכשיו",

    // ---- Categories ----
    "RPG": "תפקידים (RPG)",
    "Action": "אקשן",
    "Adventure": "הרפתקה",
    "Strategy": "אסטרטגיה",
    "Open world": "עולם פתוח",
    "Indie": "אינדי",
    "Shooters": "יורים",
    "Shooting": "ירי",
    "Platformers": "פלטפורמה",
    "Platformer": "פלטפורמה",
    "City builders": "בניית ערים",
    "City builder": "בניית ערים",
    "Highlights": "מומלצים",
    "Featured": "נבחרים",
    "Top Wishlisted (30 days)": "מובילי רשימת המשאלות (30 יום)",
    "News": "חדשות",

    // ---- Notifications & social ----
    "Your notifications": "ההתראות שלי",
    "There’s nothing to read yet": "אין התראות חדשות",
    "There's nothing to read yet": "אין התראות חדשות",
    "Clear all": "נקה הכל",
    "Friends list is currently empty": "רשימת החברים ריקה",
    "Online": "מחובר",
    "Offline": "לא מחובר",
    "Connect with friends": "התחבר עם חברים",

    // ---- Footer ----
    "Contact us": "צור קשר",
    "Career opportunities": "דרושים",
    "Submit your game": "הגש את המשחק שלך",
    "Blog": "בלוג",
    "Legal": "משפטי",
    "Privacy policy": "מדיניות פרטיות",
    "Our thanks": "תודתנו",
    "Imprint": "פרטי החברה",
    "All forums": "כל הפורומים",
    "General discussion forum": "פורום דיון כללי",
    "Forum replies": "תגובות בפורום",

    // ---- Status & badges ----
    "Now on sale": "במבצע",
    "Now available": "זמין עכשיו",
    "EARLY ACCESS": "גישה מוקדמת",
    "Coming soon": "בקרוב",
    "TBA": "טרם נקבע",
    "GOOD OLD GAME": "קלאסיקה",
    "Good Old Game": "קלאסיקה",
    "DLC": "תוסף (DLC)",
    "MOD": "מוד",
    "GOG GALAXY": "GOG GALAXY",
    "Download GOG Galaxy for Mac": "הורד GOG Galaxy ל-Mac",
    "Download GOG Galaxy for Windows": "הורד GOG Galaxy ל-Windows",
    "Discover GOG Galaxy": "גלה את GOG Galaxy",

    // ---- Search ----
    "No results found": "לא נמצאו תוצאות",
    "Try adjusting the terms of your search, you can search by game titles, publishers, developers and tags.":
      "נסה לכוון את מילות החיפוש — אפשר לחפש לפי שם משחק, מפרסם, מפתח ותגיות.",
    "Close, but not an exact hit": "קרוב, אבל לא בדיוק",
    "Recommended games from our store:": "מומלצים מהחנות שלנו:",

    // ---- GOG-specific concepts ----
    "GOG Patrons": "GOG Patrons",
    "GOG Preservation Program": "GOG Preservation Program",
    "GOG Dreamlist": "GOG Dreamlist",
    "Community wishlist": "רשימת משאלות קהילתית",
    "Hand-picking the best in gaming.": "אנו בוחרים בקפידה את מיטב המשחקים.",
    "Customer-first approach.": "הלקוח הוא הראשון.",
    "Gamer-friendly platform.": "פלטפורמה ידידותית לגיימרים.",

    // ---- Cart sub-states ----
    "votes": "הצבעות",
    "stories": "סיפורים",
    "Read stories": "קרא סיפורים",
    "BROWSE GAMES": "עיין במשחקים",
    "BROWSE MOVIES": "עיין בסרטים",

    // ---- Catalog filters and sorting (the redesigned store, inspected 2026-10-03) ----
    "Filters": "מסננים",
    "Filter": "סינון",
    "Sort": "מיון",
    "Sort by": "מיין לפי",
    "Sort by:": "מיין לפי:",
    "Genres": "ז'אנרים",
    "Tags": "תגיות",
    "Features": "תכונות",
    "Languages": "שפות",
    "Operating Systems": "מערכות הפעלה",
    "Price range": "טווח מחירים",
    "Release Date": "תאריך יציאה",
    "Release Status": "סטטוס יציאה",
    "Show only discounted": "הצג רק מוזלים",
    "Show only free games": "הצג רק משחקים חינמיים",
    "Hide DLCs and extras": "הסתר DLC ותוספות",
    "Show all tags": "הצג את כל התגיות",
    "in total": "בסך הכול",
    "Games for free": "משחקים בחינם",
    "Only on GOG": "רק ב-GOG",
    "Supported by GOG Patrons": "נתמך על ידי GOG Patrons",
    "DLCs not included": "ללא DLC",
    "Highest discounts": "ההנחות הגבוהות ביותר",
    "Bestselling (all time)": "הנמכרים ביותר (כל הזמנים)",
    "Bestselling (recently)": "הנמכרים ביותר (לאחרונה)",
    "Best new arrivals": "החדשים הטובים ביותר",
    "Best RPGs": "משחקי התפקידים הטובים ביותר",
    "Best Classics": "הקלאסיקות הטובות ביותר",
    "Title (A to Z)": "שם (A עד Z)",
    "Title (Z to A)": "שם (Z עד A)",
    "Price (from lowest)": "מחיר (מהנמוך)",
    "Price (from highest)": "מחיר (מהגבוה)",
    "Discount (from highest)": "הנחה (מהגבוהה)",
    "Rating (from highest)": "דירוג (מהגבוה)",
    "Release date (from newest)": "תאריך יציאה (מהחדש)",
    "Release date (from oldest)": "תאריך יציאה (מהישן)",
    "Date added to store (from newest)": "תאריך הוספה לחנות (מהחדש)",
    "Date added to store (from oldest)": "תאריך הוספה לחנות (מהישן)",

    // ---- Catalog feature names ----
    // Genre and tag NAMES ("Role-playing", "Story Rich", …) are deliberately not translated:
    // the extension reads them from the page (genre styling, tag suggestions, the facts
    // cache), and a Hebrew replacement would be stored as if it were the site's own value.
    "Cloud saves": "שמירות בענן",
    "Controller support": "תמיכה בבקר משחק",
    "Achievements": "הישגים",
    "Leaderboards": "טבלאות דירוג",
    "Overlay": "שכבת-על",
    "Single-player": "שחקן יחיד",
    "Multi-player": "רב-משתתפים",

    // ---- Home page ----
    "Browse deals": "עיינו במבצעים",
    "See all games": "ראו את כל המשחקים",
    "Coming Soon": "בקרוב",
    "SOON": "בקרוב",
    "Upcoming": "בקרוב",
    "Add to library": "הוסף לספרייה",
    "Explore our catalogue": "גלו את הקטלוג שלנו",
    "Explore great games and offers": "גלו משחקים והצעות מעולים",
    "Giveaway:": "מתנה:",
    "Preservation news": "חדשות השימור",
    "Become GOG Patron today": "הפכו ל-GOG Patron עוד היום",
    "Check GOG GALAXY": "בדקו את GOG GALAXY",
    "Classic": "קלאסי",
    "Discounted": "מוזל",
    "Early access": "גישה מוקדמת",
    "New arrivals": "הגעות חדשות",
    "Latest new releases": "היציאות האחרונות",
    "Browse all new releases": "עיינו בכל היציאות החדשות",
    "OWNED": "ברשותך",
    "IN LIBRARY": "בספרייה",
    "Your shopping cart": "עגלת הקניות שלך",
    "Currency": "מטבע",
    "Currency:": "מטבע:",
    "Language": "שפה",
    "Language:": "שפה:",
    "(audio, text)": "(שמע, טקסט)",
    "(text)": "(טקסט)",
  },

  /**
   * Each pattern is { re, fmt } — re is a RegExp, fmt may use $1, $2…
   * We only translate strings whose ENTIRE trimmed contents match.
   */
  patterns: [
    { re: /^(\d+)\s*reviews?$/, fmt: "$1 ביקורות" },
    { re: /^(\d+)\s*hours?\s*ago$/, fmt: "לפני $1 שעות" },
    { re: /^(\d+)\s*days?\s*ago$/, fmt: "לפני $1 ימים" },
    { re: /^(\d+)\s*minutes?\s*ago$/, fmt: "לפני $1 דקות" },
    { re: /^Up to\s*-(\d+)%$/, fmt: "עד $1%- הנחה" },
    { re: /^-(\d+)%$/, fmt: "$1%- הנחה" },
    { re: /^Release:\s*(.+)$/i, fmt: "השקה: $1" },
    { re: /^Coming soon:\s*(.+)$/i, fmt: "בקרוב: $1" },
    { re: /^(\d+)\+\s*deals up to\s*-(\d+)%$/i, fmt: "$1+ מבצעים עד $2%- הנחה" },
    { re: /^of\s+(\d+)\s+games in total$/i, fmt: "מתוך $1 משחקים בסך הכול" },
    { re: /^(\d+)\s*items? added$/i, fmt: "נוספו $1 פריטים" },
  ],

  selectors: [
    // Reserved for future targeted overrides
  ],
};
