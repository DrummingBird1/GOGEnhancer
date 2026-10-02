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
