// Synthetic gog.com pages for the end-to-end run. They are NOT copies of the
// real site — they are two deliberately different markup shapes that give the
// extension real layout, real computed styles and a real DOM to work against:
//
//   "legacy"   the class names the extension was originally written against
//   "variant"  no recognisable class names at all (obfuscated), prices split
//              across child elements, a header that ticks, an h1 in the site
//              header ahead of the game title — i.e. the things a redesign is
//              most likely to change
//
// If the extension's selectors only worked against the legacy shape, the
// variant pages would show it.

const cover = (hue) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="124"><rect width="220" height="124" fill="hsl(${hue} 60% 40%)"/></svg>`
  );

const GAMES = [
  ["the_witcher_3_wild_hunt", "The Witcher 3", "19.99", 12],
  ["cyberpunk_2077", "Cyberpunk 2077", "29.99", 280],
  ["stardew_valley", "Stardew Valley", "9.99", 110],
];

const baseCss = `
  body{margin:0;background:rgb(24,24,32);color:rgb(232,232,240);font-family:Inter,Arial,sans-serif}
  header{padding:14px 24px;background:rgb(16,16,22)}
  .grid{display:grid;grid-template-columns:repeat(3,220px);gap:20px;padding:24px}
  a{color:inherit;text-decoration:none}
  img{display:block;width:100%;height:100%;object-fit:cover}
  button.buy{padding:10px 22px;border:0;border-radius:4px;background:rgb(120,60,230);color:#fff}
`;

export function storeLegacy() {
  const cards = GAMES.map(
    ([slug, title, price, hue], i) => `
    <a class="product-tile" href="/en/game/${slug}">
      <div class="product-tile__cover" style="width:220px;height:124px;overflow:hidden"><img alt="" src="${cover(hue)}"></div>
      <div class="product-tile__info"><div class="product-tile__title">${title}</div>
      <div class="product-tile__price"><span class="price-text">${i === 2 ? "<i>$</i><b>" + price + "</b>" : "$" + price}</span></div></div>
    </a>`
  ).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Games - GOG.com</title><style>${baseCss}</style></head>
  <body><header><span id="clock">00:00</span> GOG.COM</header><main><div class="grid">${cards}</div></main></body></html>`;
}

export function storeVariant() {
  const cards = GAMES.map(
    ([slug, title, price, hue]) => `
    <a class="c-9f3a" href="/en/game/${slug}">
      <div class="c-7b21" style="width:220px;height:124px;overflow:hidden"><picture><img alt="" src="${cover(hue)}"></picture></div>
      <div class="c-0d4e"><div class="c-55aa">${title}</div>
      <div class="c-91cc"><span class="c-1a2b"><i>$</i><b>${price}</b></span></div></div>
    </a>`
  ).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Games - GOG.com</title><style>${baseCss}</style></head>
  <body><header><span id="clock">00:00</span> GOG.COM</header><main role="main"><div class="grid">${cards}</div></main></body></html>`;
}

const REQUIREMENTS = `
  <section class="c-sys">System requirements
    <div>Minimum</div><div>OS: Windows 10</div><div>Memory: 4 GB RAM</div><div>Video Memory: 1 GB</div>
    <div>Recommended</div><div>Memory: 16 GB RAM</div>
  </section>`;

export function gameLegacy() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Cool Game on GOG.com</title>
  <meta property="og:title" content="Cool Game on GOG.com"><style>${baseCss}</style></head>
  <body><header><span id="clock">00:00</span> GOG.COM</header><main>
    <h1 class="productcard-basics__title">Cool Game</h1>
    <div class="product-actions-price"><span class="product-actions-price__final-amount">$24.99</span></div>
    <button class="buy add-to-cart-button">Add to cart</button>
    ${REQUIREMENTS}
  </main></body></html>`;
}

export function gameVariant() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Cool Game on GOG.com</title>
  <meta property="og:title" content="Cool Game on GOG.com"><style>${baseCss}</style></head>
  <body><header><h1 class="c-logo">GOG.COM</h1><span id="clock">00:00</span></header><main role="main">
    <h1 class="c-title">Cool Game</h1>
    <div class="c-buybox"><span class="c-amt"><i>$</i><b>24.99</b></span></div>
    <button class="buy c-primary">Add to cart</button>
    ${REQUIREMENTS}
  </main></body></html>`;
}
