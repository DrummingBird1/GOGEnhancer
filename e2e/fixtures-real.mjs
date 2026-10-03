// "Real structure" fixtures — the markup SHAPES recorded from the live site on
// 2026-10-02 (structure only: tags, class names, attributes, sizes — no
// content). They exist because the synthetic pages in fixtures.mjs were
// guesses, and the live site turned out to differ in ways that mattered:
//
//   home / catalog  new Angular app, custom elements, `selenium-id` hooks,
//                   ~19 hero <main>s on the home page and none on the catalog,
//                   vertical tiles whose cover spans the full tile width
//   game page       still AngularJS; prices are a bare "2.99" with the symbol
//                   printed by CSS and the currency named only on <body>; the
//                   page's single <main> is a hidden modal; JSON-LD quotes a
//                   DIFFERENT currency than the one displayed

const cover = (hue) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="255" height="118"><rect width="255" height="118" fill="hsl(${hue} 60% 40%)"/></svg>`
  );

const baseCss = `
  body{margin:0;background:rgb(24,24,32);color:rgb(232,232,240);font-family:Inter,Arial,sans-serif}
  header{position:fixed;top:0;left:0;right:0;height:60px;box-sizing:border-box;padding:14px 24px;background:rgb(16,16,22);z-index:100}
  a{color:inherit;text-decoration:none}
  img{display:block;width:100%;height:100%;object-fit:cover}
  button.buy{padding:10px 22px;border:0;border-radius:4px;background:rgb(120,60,230);color:#fff}
  store-picture, picture { display: contents }
  .app__container { max-width: 1100px; margin: 0 auto; padding: 76px 16px 16px }
  .product-tile { display: block; width: 255px; color: inherit; text-decoration: none }
  .product-tile__image-wrapper { width: 255px; height: 118px; overflow: hidden }
  .product-tile__info { padding: 8px 0 }
  .grid { display: grid; grid-template-columns: repeat(3, 255px); gap: 18px; padding: 0 }
  price-value, product-price, price-discount { display: inline-block }
  .base-value { text-decoration: line-through; margin-right: 6px; opacity: .7 }
  main.big-spot-v2__content { display: block; height: 70px; margin: 8px 0; background: rgb(40,40,52) }
`;

const tile = (slug, title, hue, base, final) => `
  <product-tile class="ng-star-inserted">
    <a class="product-tile product-tile--grid" href="https://www.gog.com/en/game/${slug}">
      <div class="product-tile__image-wrapper">
        <store-picture><picture><img alt="" src="${cover(hue)}"></picture></store-picture>
      </div>
      <div class="product-tile__info">
        <div class="product-tile__title"><product-title class="small"><span>${title}</span></product-title></div>
        <div class="product-tile__footer"><div class="product-tile__price-info">
          <product-price selenium-id="productPrice">
            ${base ? `<price-discount selenium-id="productPriceDiscount">-${Math.round((1 - final / base) * 100)}%</price-discount>` : ""}
            <price-value selenium-id="productPriceValue">${base ? `<span class="base-value">$${base}</span>` : ""}<span class="final-value">$${final}</span></price-value>
          </product-price>
        </div></div>
      </div>
    </a>
  </product-tile>`;

export const REAL_TILES = [
  ["gris", "GRIS", 200, "14.99", "2.99"],
  ["hades", "Hades", 340, null, "24.99"],
  ["cuphead", "Cuphead", 20, "19.99", "9.99"],
];

export const realTile = tile;

export function homeReal() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Welcome to GOG.com</title><style>${baseCss}</style></head>
  <body><header><span id="clock">00:00</span> GOG.COM</header>
  <app-root ng-version="17.3.0"><div class="wrapper"><div class="app__container"><router-outlet></router-outlet>
    <app-page>
      <main class="big-spot-v2__content"><h2>Hero one</h2></main>
      <main class="big-spot-v2__content"><h2>Hero two</h2></main>
      <main class="big-spot-v2__content"><h2>Hero three</h2></main>
      <products-section><div id="slot" class="grid">${REAL_TILES.map((t) => tile(...t)).join("")}</div></products-section>
    </app-page></div></div></app-root></body></html>`;
}

export function catalogReal() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Best Video games, DRM-free | GOG.COM</title><style>${baseCss}</style></head>
  <body><header><span id="clock">00:00</span> GOG.COM</header>
  <app-root ng-version="17.3.0"><div class="wrapper"><div class="app__container"><router-outlet></router-outlet>
    <app-page><h1 class="page-header">PC games / All Games</h1>
      <catalog><catalog-content id="Catalog"><div class="catalog__content"><paginated-products-grid>
        <div class="paginated-products-grid grid">${REAL_TILES.map((t) => tile(...t)).join("")}</div>
      </paginated-products-grid></div></catalog-content></catalog>
    </app-page></div></div></app-root></body></html>`;
}

export function gameReal() {
  return `<!doctype html><html lang="en" id="pageTop" ng-app="gog" class="ng-scope"><head><meta charset="utf-8"><title>GRIS 80% off | GOG.COM</title>
  <meta property="og:title" content="GRIS 80% off | GOG.COM">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"GRIS","offers":{"@type":"Offer","price":"2.95","priceCurrency":"EUR"}}</script>
  <style>${baseCss}
    ._price::before { content: "$ " }
    ._price::after { content: " $"; display: none }
    .gog-patrons-modal { display: none }
    .layout-container { max-width: 1100px; margin: 0 auto }
  </style></head>
  <body class="productcard _prices-in-usd _price-currency-symbol-before user-logged-in">
  <header><span id="clock">00:00</span> GOG.COM</header>
  <div class="gog-patrons-modal"><main class="gog-patrons-modal__patrons-container"><h2>Patrons</h2></main></div>
  <div class="layout ng-scope"><div class="layout-container">
    <div class="productcard-basics hide-when-content-is-expanded">
      <h1 class="productcard-basics__title" selenium-id="ProductTitle">GRIS</h1>
      <aside><div id="buybox" class="product-actions-price product-actions-price--discounted" selenium-id="ProductActionsBody">
        <span class="product-actions-price__discount ng-binding" selenium-id="ProductPriceDiscount">-80%</span>
        <span class="product-actions-price__base-amount _price ng-binding" selenium-id="ProductBasePrice">14.99</span>
        <span class="product-actions-price__final-amount _price ng-binding" selenium-id="ProductFinalPrice">2.99</span>
      </div><button class="buy add-to-cart-button" selenium-id="AddToCartButton">Add to cart</button></aside>
    </div>
    <div class="details"><div selenium-id="ProductGenres"><span>Genre:</span> <a href="/en/games?genres=role-playing">Role-playing</a></div></div>
    <div class="content-summary-section"><div class="title"><div class="title__underline-text">System requirements</div></div>
      <div class="system-requirements table"><div class="table-header">
        <div class="system-requirements__minimum-header">Minimum system requirements:</div>
        <div class="system-requirements__recommended-header">Recommended system requirements:</div></div>
        <div class="table__row"><div class="table__row-label system-requirements__label">System:</div><div class="table__row-content system-requirements__minimum">Windows 7</div><div class="table__row-content system-requirements__recommended">Windows 10</div></div>
        <div class="table__row"><div class="table__row-label system-requirements__label">Memory:</div><div class="table__row-content system-requirements__minimum">4 GB RAM</div><div class="table__row-content system-requirements__recommended">16 GB RAM</div></div>
      </div>
      <div class="system-requirements table show-on-small-screens ng-hide" style="display:none"><div class="table__row"><div class="system-requirements__label">Memory:</div><div class="system-requirements__minimum">99 GB RAM</div></div></div>
    </div>
  </div></div></body></html>`;
}

// ---- v4: shapes recorded on 2026-10-03 from a signed-in session -----------
// (structure only). What they add to the ones above:
//   catalog tile   `.product-label--owned` ("IN LIBRARY") inside an owned tile
//   game page      `PromoEndDate[timer]`, `LowestPriceBeforeDiscount`,
//                  `DetailsLanguages`, `ProductTags`, `CriticsReviews`, the
//                  HowLongToBeat section, `.owned-status`, review articles
//   wishlist       legacy rows `.product-row--wishlist` with ALWAYS-present
//                  state flags hidden by CSS, plus the header's own
//                  wishlist-looking menu tiles that must not be counted

const ownedLabel =
  '<product-label class="product-tile__release-label--grid"><div class="product-label product-label--owned"><span class="product-label__text">IN LIBRARY</span></div></product-label>';

const tileV4 = (slug, title, hue, base, final, owned) =>
  tile(slug, title, hue, base, final).replace("</store-picture>", `</store-picture>${owned ? ownedLabel : ""}`);

export const V4_TILES = [
  ["alpha_game", "Alpha Game", 200, "40.00", "20.00", false],
  ["beta_game", "Beta Game", 340, null, "5.00", false],
  ["gamma_game", "Gamma Game", 20, "32.00", "8.00", true],
  ["delta_game", "Delta Game", 100, "20.00", "15.00", false],
];

export function catalogV4() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Best Video games, DRM-free | GOG.COM</title><style>${baseCss}</style></head>
  <body><header><span id="clock">00:00</span> GOG.COM</header>
  <app-root ng-version="17.3.0"><div class="wrapper"><div class="app__container"><router-outlet></router-outlet>
    <app-page><h1 class="page-header">PC games / All Games</h1>
      <catalog><catalog-content id="Catalog"><div class="catalog__content"><paginated-products-grid>
        <div class="paginated-products-grid grid">${V4_TILES.map((t) => tileV4(...t)).join("")}</div>
      </paginated-products-grid></div></catalog-content></catalog>
    </app-page></div></div></app-root></body></html>`;
}

const rowV4 = (slug, title, price, discount, owned) => `
  <div class="product-row-wrapper">
    <div class="product-state-holder product-row product-row--wishlist product-row--has-card" gog-product="1">
      <div class="product-row__price"><div class="price-btn"><span class="price-btn__text">
        <span class="price-btn__text--owned product-state__is-owned" style="display:${owned ? "inline" : "none"}">Owned</span>
        <span class="product-state__is-tba" style="display:none">TBA</span>
        <span class="product-state__is-free" style="display:none">Free</span>
        ${price ? `<span class="_price product-state__price">${price}</span>` : ""}
      </span></div></div>
      <a class="product-row__link" href="/en/game/${slug}" style="display:block">
        ${discount ? `<div class="product-row__discount product-state__discount"><span class="price-text--discount"><span>${discount}</span></span></div>` : ""}
        <div class="product-row__title">${title}</div>
      </a>
    </div>
  </div>`;

export function wishlistV4() {
  return `<!doctype html><html lang="en" ng-app="gog" class="ng-scope"><head><meta charset="utf-8"><title>Wishlist | GOG.COM</title>
  <style>${baseCss}
    ._price::before { content: "$ " }
    .product-row-wrapper { display: block; padding: 6px 0; border-bottom: 1px solid #333 }
  </style></head>
  <body class="_prices-in-usd user-logged-in">
  <header><span id="clock">00:00</span> GOG.COM
    <div class="menu-v3__games-grid">
      <a class="menu-v3__games-tile" href="/en/game/menu_one">menu one</a>
      <a class="menu-v3__games-tile" href="/en/game/menu_two">menu two</a>
    </div>
  </header>
  <div class="layout ng-scope"><div class="layout-container" style="padding-top:70px">
    <div class="list cf account__products list--rows"><div class="list-inner">
      ${rowV4("slow_game", "Slow Game", "20.00", 0, false)}
      ${rowV4("deal_game", "Deal Game", "8.00", 75, false)}
      ${rowV4("mine_game", "Mine Game", null, 0, true)}
      ${rowV4("cheap_game", "Cheap Game", "5.00", 50, false)}
    </div></div>
  </div></div></body></html>`;
}

export function gameV4({ productId = null, title = "Alpha Game" } = {}) {
  const ends = new Date(Date.now() + 2 * 86400e3);
  const timer = `${ends.toISOString().slice(0, 19).replace("T", " ")}.000000+00:00`;
  const tick = '<svg class="ic-svg details__languages-icon details__languages-icon--tick"><use xlink:href="#check_tick"></use></svg>';
  return `<!doctype html><html lang="en" id="pageTop" ng-app="gog" class="ng-scope"><head><meta charset="utf-8"><title>Alpha Game 50% off | GOG.COM</title>
  <meta property="og:title" content="Alpha Game 50% off | GOG.COM">
  <script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: title, ...(productId ? { sku: productId } : {}), releaseDate: "2015-05-19T00:00:00+02:00" })}</script>
  <style>${baseCss}
    ._price::before { content: "$ " }
    .gog-patrons-modal { display: none }
    .layout-container { max-width: 1100px; margin: 0 auto }
  </style></head>
  <body class="productcard _prices-in-usd _price-currency-symbol-before user-logged-in">
  <header><span id="clock">00:00</span> GOG.COM</header>
  <div class="layout ng-scope"><div class="layout-container">
    ${productId ? `<div card-product="${productId}"></div>` : ""}
    <div class="productcard-basics hide-when-content-is-expanded">
      <h1 class="productcard-basics__title" selenium-id="ProductTitle">${title}</h1>
      <div class="productcard-rating"><p class="rating productcard-rating__score--version-a">4.8/5</p><p class="rating productcard-rating__details">( 2848 Reviews )</p></div>
      <aside><div id="ProductActionsBody" class="product-actions-body" selenium-id="ProductActionsBody">
        <div class="product-actions-price product-actions-price--discounted">
          <span class="product-actions-price__base-amount _price" selenium-id="ProductBasePrice">49.99</span>
          <span class="product-actions-price__final-amount _price" selenium-id="ProductFinalPrice">24.99</span>
        </div>
        <div class="product-actions__lowest-price-before-discount" selenium-id="LowestPriceBeforeDiscount"> Lowest price in the last 30 days before discount: <span class="_price">24.99</span></div>
        <div class="product-actions__promo-end-date" selenium-id="PromoEndDate" timer="${timer}"><span class="product-actions__time">soon</span></div>
      </div><button class="buy add-to-cart-button" selenium-id="AddToCartButton">Add to cart</button></aside>
    </div>
    <div class="owned-status" style="display:none"><span class="owned-status__label">in library</span></div>
    <div class="details">
      <div selenium-id="ProductGenres"><span>Genre:</span> <a href="/en/games?genres=role-playing">Role-playing</a></div>
      <div class="table__row details__row" selenium-id="ProductTags"><div class="details__category">Tags:</div><div class="details__content">
        <a href="/games/x" class="details__link details__link--tag"><span class="details__link-text">Adventure</span><span>, </span></a>
        <a href="/games/y" class="details__link details__link--tag"><span class="details__link-text">Fantasy</span><span>, </span></a></div></div>
      <div class="table__row details__row details__row--first" selenium-id="DetailsLanguages"><div class="details__category">Languages</div><div class="details__content details__languages-row">
        <div class="details__languages-row--cell details__languages-row--language-name">English</div>
        <div class="details__languages-row--cell details__languages-row--audio-support">${tick}</div>
        <div class="details__languages-row--cell details__languages-row--text-support">${tick}</div>
      </div></div>
    </div>
    <div class="content-summary-item" id="HowLongToBeatSection"><div class="howlongtobeat-section"><div class="howlongtobeat-wrapper">
      <div class="howlongtobeat-box"><span class="howlongtobeat-box__time">100 h</span><span class="howlongtobeat-box__name">Main</span></div>
    </div></div></div>
    <div selenium-id="ReviewsList"><div class="reviews__main-col">
      <article class="review__item"><span class="review__stars"><span class="rati__star is-full"></span><span class="rati__star is-full"></span><span class="rati__star is-full"></span><span class="rati__star is-full"></span><span class="rati__star is-full"></span></span><span class="review__profile-verified-owner">Verified owner</span></article>
      <article class="review__item"><span class="review__stars"><span class="rati__star is-full"></span><span class="rati__star is-empty"></span></span></article>
    </div></div>
  </div></div></body></html>`;
}
