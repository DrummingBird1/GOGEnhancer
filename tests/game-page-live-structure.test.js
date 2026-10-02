import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Game-page behaviour against the markup shapes recorded from the live site
// (2026-10-02): bare-number prices with CSS-printed symbols, the genre hook,
// and the requirements table.

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/dom-safety.js");
await import("../extension/lib/currency-format.js");
await import("../extension/lib/genres.js");
await import("../extension/lib/game-status.js");
await import("../extension/lib/sysreq.js");
await import("../extension/content/gog-dom.js");
await import("../extension/content/translations.js");
await import("../extension/content/currency-detection.js");
await import("../extension/content/price-history.js");
await import("../extension/content/tooltips.js");
await import("../extension/content/toasts.js");
await import("../extension/content/state.js");
await import("../extension/content/utils.js");
await import("../extension/content/features/currency.js");
await import("../extension/content/features/card-badges.js");
await import("../extension/content/features/misc.js");
await import("../extension/content/features/wishlist.js");
await import("../extension/content/features/game-page.js");

const state = window.GOGPlusContentState;
const { maybeRecordPriceHistory, maybeRecordGameGenre, ensureGamePagePanel } = window.GOGPlusGamePage;
const getLocal = (keys) => new Promise((r) => chrome.storage.local.get(keys, r));

beforeEach(() => {
  globalThis.__resetChromeStores();
  window.history.replaceState({}, "", "/en/game/gris");
  document.body.className = "productcard _prices-in-usd _price-currency-symbol-before";
  state.settings = {
    ...window.GOG_PLUS_DEFAULTS,
    priceHistoryTracking: true,
    priceCompareTable: false,
    refundTimer: false,
    itadCompare: false,
    customTags: false,
    sysReqCheck: true,
  };
  state.pageCurrency = { code: "USD", symbol: "$" };
});
afterEach(() => {
  document.body.className = "";
  window.history.replaceState({}, "", "/");
});

describe("price-history recording from a bare-number price", () => {
  it("records the FINAL price (not the base) in the page's declared currency", async () => {
    document.body.innerHTML = `
      <div class="product-actions-price product-actions-price--discounted">-80%14.992.99
        <span class="product-actions-price__base-amount" selenium-id="ProductBasePrice">14.99</span>
        <span class="product-actions-price__final-amount" selenium-id="ProductFinalPrice">2.99</span>
      </div>`;
    await maybeRecordPriceHistory("gris");
    const { priceHistory } = await getLocal("priceHistory");
    expect(priceHistory.gris).toHaveLength(1);
    expect(priceHistory.gris[0]).toMatchObject({ p: 2.99, c: "USD" });
  });

  it("reads a European decimal comma through the declared currency", async () => {
    document.body.className = "_prices-in-eur";
    state.pageCurrency = { code: "EUR", symbol: "€" };
    document.body.innerHTML = `<span class="x__final-amount" selenium-id="ProductFinalPrice">2,99</span>`;
    await maybeRecordPriceHistory("gris");
    const { priceHistory } = await getLocal("priceHistory");
    expect(priceHistory.gris[0]).toMatchObject({ p: 2.99, c: "EUR" });
  });

  it("still works on a page whose price carries its symbol in the text (new design)", async () => {
    document.body.className = "";
    document.body.innerHTML = `<price-value><span class="final-value">$24.99</span></price-value>`;
    await maybeRecordPriceHistory("gris");
    const { priceHistory } = await getLocal("priceHistory");
    expect(priceHistory.gris[0]).toMatchObject({ p: 24.99, c: "USD" });
  });

  it("records nothing when there is no price, or when tracking is off", async () => {
    document.body.innerHTML = `<p>no price</p>`;
    await maybeRecordPriceHistory("gris");
    expect((await getLocal("priceHistory")).priceHistory).toBeUndefined();

    state.settings.priceHistoryTracking = false;
    document.body.innerHTML = `<span selenium-id="ProductFinalPrice">2.99</span>`;
    await maybeRecordPriceHistory("gris");
    expect((await getLocal("priceHistory")).priceHistory).toBeUndefined();
  });
});

describe("genre from the site's own hook", () => {
  it("maps the first recognisable genre link to a card bucket and caches it", async () => {
    document.body.innerHTML = `<div selenium-id="ProductGenres"><span>Genre:</span><a>Adventure</a><a>Role-playing</a></div>`;
    await maybeRecordGameGenre("gris");
    expect((await getLocal("gameGenres")).gameGenres).toEqual({ gris: "rpg" });
  });

  it("falls back to the 'Genre:' text hunt when the hook isn't present", async () => {
    document.body.innerHTML = `<div><span>Genre:</span> <a href="/x">Horror</a></div>`;
    await maybeRecordGameGenre("hollow");
    expect((await getLocal("gameGenres")).gameGenres).toEqual({ hollow: "horror" });
  });

  it("caches nothing for genres it doesn't map", async () => {
    document.body.innerHTML = `<div selenium-id="ProductGenres"><a>Adventure</a></div>`;
    await maybeRecordGameGenre("gris");
    expect((await getLocal("gameGenres")).gameGenres).toBeUndefined();
  });
});

describe("system check from the requirements table", () => {
  const reqTable = `
    <div class="system-requirements table">
      <div class="table__row"><div class="system-requirements__label">Memory:</div>
        <div class="system-requirements__minimum">4 GB RAM</div>
        <div class="system-requirements__recommended">16 GB RAM</div></div>
    </div>`;
  const rows = () => [...document.querySelectorAll(".gog-plus-sysreq-row")].map((r) => r.textContent);

  beforeEach(() => {
    Object.defineProperty(navigator, "deviceMemory", { value: 8, configurable: true });
  });
  afterEach(() => delete navigator.deviceMemory);

  it("uses the table's rows even when the page text has no 'System requirements' heading", async () => {
    document.body.innerHTML = `<h1 class="productcard-basics__title">Gris</h1>${reqTable}`;
    await ensureGamePagePanel("gris");
    expect(rows()).toEqual([
      "Minimum: 4 GB — ✓ this device meets it",
      "Recommended: 16 GB — ? can't tell from the browser",
    ]);
  });

  it("falls back to reading page text when there is no table", async () => {
    document.body.innerHTML = `<h1 class="productcard-basics__title">Gris</h1>
      <section>System requirements Minimum Memory: 2 GB RAM</section>`;
    await ensureGamePagePanel("gris");
    expect(rows()).toEqual(["Minimum: 2 GB — ✓ this device meets it"]);
  });
});
