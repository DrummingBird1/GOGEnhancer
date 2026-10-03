// Markup shaped like what the live gog.com served on 2026-10-02 (structure
// only — see content/gog-dom-facts.js for the observations they encode).
// happy-dom has no layout or CSS, so "hidden" state flags are simply absent.

/** One catalog tile (the new Angular app's <product-tile>). */
export function tileHtml({ slug, title = slug, discount = 0, price = "$10.00", base = null, owned = false } = {}) {
  return `
  <product-tile>
    <a class="product-tile product-tile--grid" href="https://www.gog.com/en/game/${slug}" selenium-id="productTile">
      <div class="product-tile__image-wrapper">
        <store-picture><picture><img src="https://images.gog.test/${slug}.jpg" alt=""></picture></store-picture>
        <product-label class="product-tile__release-label--grid">${
          owned ? '<div class="product-label product-label--owned"><span class="product-label__text">IN LIBRARY</span></div>' : ""
        }</product-label>
      </div>
      <div class="product-tile__info">
        <div class="product-tile__title"><product-title><span>${title}</span></product-title></div>
        <div class="product-tile__footer">
          <product-price>
            ${discount ? `<price-discount>-${discount}%</price-discount>` : ""}
            <price-value>${base ? `<span class="base-value">${base}</span>` : ""}<span class="final-value">${price}</span></price-value>
          </product-price>
        </div>
      </div>
    </a>
  </product-tile>`;
}

export const gridHtml = (tiles) => `<div class="catalog"><div class="paginated-products-grid grid">${tiles.map(tileHtml).join("")}</div></div>`;

/** A wishlist row on the legacy account page. */
export function wishlistRowHtml({ slug, title = slug, price = null, discount = 0, owned = false, tba = false, free = false } = {}) {
  return `
  <div class="product-row-wrapper">
    <div class="product-state-holder product-row product-row--wishlist product-row--has-card" gog-product="1">
      <div class="product-row__price product-row__alignment"><div class="price-btn"><span class="price-btn__text">
        ${owned ? '<span class="price-btn__text--owned product-state__is-owned">Owned</span>' : ""}
        ${tba ? '<span class="product-state__is-tba">TBA</span>' : ""}
        ${free ? '<span class="product-state__is-free">Free</span>' : ""}
        ${price != null ? `<span class="_price product-state__price">${price}</span>` : ""}
      </span></div></div>
      <a class="product-row__link" href="/en/game/${slug}">
        <div class="product-row__picture"><img class="product-row__img" src="x.jpg" alt=""></div>
        ${discount ? `<div class="product-row__discount product-state__discount"><span class="price-text--discount"><span>${discount}</span></span></div>` : ""}
        <div class="product-row__text"><div class="product-row__content"><div class="product-row__content-in">
          <div class="product-row__title">${title}</div>
          <div class="product-row__info"><div class="product-row__date">2026</div><div class="product-row__genre">RPG</div></div>
        </div></div></div>
      </a>
    </div>
  </div>`;
}

export const wishlistPageHtml = (rows) => `
  <header><a class="menu-v3__games-tile" href="/en/game/menu_tile_one">menu</a><a class="menu-v3__games-tile" href="/en/game/menu_tile_two">menu</a></header>
  <section class="account__products list--rows"><div class="list-inner">${rows.map(wishlistRowHtml).join("")}</div></section>`;

/** A game page's insights-relevant markup. */
export function gamePageHtml({
  title = "The Witcher 3: Wild Hunt",
  final = "24.99",
  base = "49.99",
  lowest = "24.99",
  promo = "2026-10-07 09:59:59.000000+03:00",
  owned = false,
  languages = [["English", true, true]],
  rating = "4.8/5",
  reviewCount = 2848,
  critics = 95,
  hours = [["Main", "108 h"], ["Main + Sides", "154.5 h"], ["Completionist", "213.5 h"]],
  tags = ["Adventure", "Fantasy", "Story Rich"],
  year = 2015,
  reviews = [],
} = {}) {
  const tick = '<svg class="ic-svg details__languages-icon details__languages-icon--tick"><use xlink:href="#check_tick"></use></svg>';
  return `
  <h1 class="productcard-basics__title" selenium-id="ProductTitle">${title}</h1>
  <script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: title, releaseDate: `${year}-05-19T00:00:00+02:00` })}</script>
  <div class="productcard-rating"><p class="rating productcard-rating__score--version-a">${rating}</p><p class="rating productcard-rating__details">( ${reviewCount} Reviews )</p></div>
  <div id="ProductActionsBody" selenium-id="ProductActionsBody">
    <div class="product-actions-price product-actions-price--discounted">
      ${base ? `<span class="product-actions-price__base-amount _price" selenium-id="ProductBasePrice">${base}</span>` : ""}
      <span class="product-actions-price__final-amount _price" selenium-id="ProductFinalPrice">${final}</span>
    </div>
    ${lowest ? `<div class="product-actions__lowest-price-before-discount" selenium-id="LowestPriceBeforeDiscount"> Lowest price in the last 30 days before discount: <span class="_price">${lowest}</span></div>` : ""}
    ${promo ? `<div class="product-actions__promo-end-date" selenium-id="PromoEndDate" timer="${promo}"><span class="product-actions__offer-ends-in" selenium-id="OfferEndsIn">Offer ends on: </span><span class="product-actions__time">07/10/2026 09:59 EEST</span></div>` : ""}
  </div>
  ${owned ? '<div class="owned-status"><span class="owned-status__label">in library</span></div>' : ""}
  <div class="content-summary-item__title" selenium-id="CriticsReviews">Critics reviews <span class="circle-score__text"> ${critics} <span class="circle-score__text-percentage">%</span></span></div>
  <div class="content-summary-item" id="HowLongToBeatSection"><div class="howlongtobeat-section"><div class="howlongtobeat-wrapper">
    ${hours.map(([n, t]) => `<div class="howlongtobeat-box"><span class="howlongtobeat-box__time">${t}</span><span class="howlongtobeat-box__name">${n}</span></div>`).join("")}
  </div></div></div>
  <div class="table__row details__row" selenium-id="ProductTags"><div class="details__category">Tags:</div><div class="details__content">${tags
    .map((t) => `<a href="/games/x" class="details__link details__link--tag"><span class="details__link-text">${t}</span><span>, </span></a>`)
    .join("")}</div></div>
  <div class="table__row details__row details__row--first" selenium-id="DetailsLanguages"><div class="details__category">Languages</div><div class="details__content details__languages-row">
    ${languages
      .map(
        ([name, audio, text]) => `<div class="details__languages-row--cell details__languages-row--language-name">${name}</div>
      <div class="details__languages-row--cell details__languages-row--audio-support">${audio ? tick : ""}</div>
      <div class="details__languages-row--cell details__languages-row--text-support">${text ? tick : ""}</div>`
      )
      .join("")}
  </div></div>
  <div selenium-id="ReviewsList"><div class="reviews__main-col">${reviews
    .map(
      ({ stars, verified }) => `<article class="review__item"><span class="review__stars">${[1, 2, 3, 4, 5]
        .map((i) => `<span class="rati__star ${i <= stars ? "is-full" : "is-empty"}"></span>`)
        .join("")}</span>${verified ? '<span class="review__profile-verified-owner">Verified owner</span>' : ""}</article>`
    )
    .join("")}</div></div>`;
}
