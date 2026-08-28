import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/dom-safety.js");
await import("../extension/lib/currency-format.js");
await import("../extension/lib/genres.js");
await import("../extension/lib/game-status.js");
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

const state = window.GOGPlusContentState;
const { ensureWishlistFilters, updateWishlistFilterCounts, reportWishlistCount, applyWishlistFilter } =
  window.GOGPlusWishlistFeature;

function card({ slug, discountPct, price, rating }) {
  const a = document.createElement("a");
  a.setAttribute("href", `/en/game/${slug}`);
  const bits = [];
  if (discountPct != null) bits.push(`-${discountPct}%`);
  if (price != null) bits.push(`$${price.toFixed(2)}`);
  if (rating != null) bits.push(`${rating.toFixed(1)} 128 reviews`);
  a.textContent = bits.join(" ");
  return a;
}

function cardHtml({ slug, discountPct, price, rating }) {
  const bits = [];
  if (discountPct != null) bits.push(`-${discountPct}%`);
  if (price != null) bits.push(`$${price.toFixed(2)}`);
  if (rating != null) bits.push(`${rating.toFixed(1)} 128 reviews`);
  return `<a href="/en/game/${slug}">${bits.join(" ")}</a>`;
}

const FILTER_BAR_HTML = `
  <div id="gog-plus-wlfilters">
    <button data-f="all"><span class="gog-plus-wlfilter-count"></span></button>
    <button data-f="sale"><span class="gog-plus-wlfilter-count"></span></button>
    <button data-f="under10"><span class="gog-plus-wlfilter-count"></span></button>
    <button data-f="under25"><span class="gog-plus-wlfilter-count"></span></button>
    <button data-f="rated45"><span class="gog-plus-wlfilter-count"></span></button>
    <span id="gog-plus-wlfilters-genres"></span>
  </div>
`;

beforeEach(() => {
  globalThis.__resetChromeStores();
  vi.clearAllMocks();
  document.body.innerHTML = "";
  state.settings = { ...window.GOG_PLUS_DEFAULTS, wishlistFilters: true };
  state.pageCurrency = { code: "USD", symbol: "$" };
  state.observers = [];
  window.history.pushState({}, "", "/en/account/wishlist");
});

afterEach(() => {
  window.history.pushState({}, "", "/");
});

describe("ensureWishlistFilters", () => {
  it("does nothing when the wishlistFilters setting is off", () => {
    state.settings.wishlistFilters = false;
    document.body.innerHTML = "<main></main>";
    ensureWishlistFilters();
    expect(document.getElementById("gog-plus-wlfilters")).toBeNull();
  });

  it("does nothing off the wishlist page", () => {
    window.history.pushState({}, "", "/en/game/hades");
    document.body.innerHTML = "<main></main>";
    ensureWishlistFilters();
    expect(document.getElementById("gog-plus-wlfilters")).toBeNull();
  });

  it("is a no-op on a second call (idempotent)", () => {
    document.body.innerHTML = "<main></main>";
    ensureWishlistFilters();
    ensureWishlistFilters();
    expect(document.querySelectorAll("#gog-plus-wlfilters").length).toBe(1);
  });

  it("prepends a filter bar with all five filter buttons into the wishlist container", () => {
    document.body.innerHTML = "<main></main>";
    ensureWishlistFilters();
    const bar = document.getElementById("gog-plus-wlfilters");
    expect(bar).not.toBeNull();
    const ids = [...bar.querySelectorAll("button[data-f]")].map((b) => b.dataset.f);
    expect(ids).toEqual(["all", "sale", "under10", "under25", "rated45"]);
    expect(bar.querySelector('button[data-f="all"]').classList.contains("active")).toBe(true);
  });

  it("clicking a filter button marks it active and filters the cards", () => {
    document.body.innerHTML = "<main></main>";
    document.querySelector("main").appendChild(card({ slug: "hades", discountPct: 30 }));
    document.querySelector("main").appendChild(card({ slug: "stardew_valley" }));
    ensureWishlistFilters();
    const bar = document.getElementById("gog-plus-wlfilters");
    bar.querySelector('button[data-f="sale"]').click();
    expect(bar.querySelector('button[data-f="sale"]').classList.contains("active")).toBe(true);
    expect(bar.querySelector('button[data-f="all"]').classList.contains("active")).toBe(false);
    expect(document.querySelector('a[href*="hades"]').classList.contains("gog-plus-filtered-out")).toBe(false);
    expect(
      document.querySelector('a[href*="stardew_valley"]').classList.contains("gog-plus-filtered-out")
    ).toBe(true);
  });
});

describe("updateWishlistFilterCounts", () => {
  it("counts each bucket and de-dupes repeated cards for the same slug", () => {
    document.body.innerHTML = `
      <div id="host">
        ${cardHtml({ slug: "hades", discountPct: 25, price: 8 })}
        ${cardHtml({ slug: "hades", discountPct: 25, price: 8 })}
        ${cardHtml({ slug: "disco_elysium", price: 22 })}
        ${cardHtml({ slug: "cyberpunk_2077", price: 59, rating: 4.7 })}
      </div>
      ${FILTER_BAR_HTML}
    `;
    const bar = document.getElementById("gog-plus-wlfilters");
    updateWishlistFilterCounts(bar);

    const countOf = (f) => bar.querySelector(`button[data-f="${f}"] .gog-plus-wlfilter-count`).textContent;
    expect(countOf("all")).toBe("3"); // de-duped
    expect(countOf("sale")).toBe("1");
    expect(countOf("under10")).toBe("1");
    expect(countOf("under25")).toBe("2");
    expect(countOf("rated45")).toBe("1");
  });

  it("builds genre chips for recognized franchise slugs", () => {
    document.body.innerHTML = `
      <div id="host">${cardHtml({ slug: "resident_evil_2" })}</div>
      ${FILTER_BAR_HTML}
    `;
    const bar = document.getElementById("gog-plus-wlfilters");
    updateWishlistFilterCounts(bar);
    const genreHost = document.getElementById("gog-plus-wlfilters-genres");
    expect(genreHost.querySelector('button[data-f="genre-horror"]')).not.toBeNull();
  });
});

describe("applyWishlistFilter", () => {
  function setupCards() {
    document.body.innerHTML = "";
    document.body.appendChild(card({ slug: "hades", discountPct: 30, price: 8 }));
    document.body.appendChild(card({ slug: "disco_elysium", price: 22, rating: 4.8 }));
    document.body.appendChild(card({ slug: "stardew_valley", price: 30 }));
  }

  it("'all'-like unrecognized mode shows everything", () => {
    setupCards();
    applyWishlistFilter("all");
    document.querySelectorAll("a").forEach((a) => expect(a.classList.contains("gog-plus-filtered-out")).toBe(false));
  });

  it("'sale' shows only discounted cards", () => {
    setupCards();
    applyWishlistFilter("sale");
    expect(document.querySelector('a[href*="hades"]').classList.contains("gog-plus-filtered-out")).toBe(false);
    expect(
      document.querySelector('a[href*="stardew_valley"]').classList.contains("gog-plus-filtered-out")
    ).toBe(true);
  });

  it("'under10' filters by parsed USD price", () => {
    setupCards();
    applyWishlistFilter("under10");
    expect(document.querySelector('a[href*="hades"]').classList.contains("gog-plus-filtered-out")).toBe(false);
    expect(
      document.querySelector('a[href*="disco_elysium"]').classList.contains("gog-plus-filtered-out")
    ).toBe(true);
  });

  it("'rated45' filters by parsed rating", () => {
    setupCards();
    applyWishlistFilter("rated45");
    expect(
      document.querySelector('a[href*="disco_elysium"]').classList.contains("gog-plus-filtered-out")
    ).toBe(false);
    expect(document.querySelector('a[href*="hades"]').classList.contains("gog-plus-filtered-out")).toBe(true);
  });

  it("genre mode prefers a cached gameGenres entry over the regex fallback", () => {
    setupCards();
    state.settings.gameGenres = { stardew_valley: "rpg" };
    applyWishlistFilter("genre-rpg");
    expect(
      document.querySelector('a[href*="stardew_valley"]').classList.contains("gog-plus-filtered-out")
    ).toBe(false);
    expect(document.querySelector('a[href*="hades"]').classList.contains("gog-plus-filtered-out")).toBe(true);
  });
});

describe("reportWishlistCount", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("reports once the count is stable across two consecutive ticks", async () => {
    document.body.innerHTML = "";
    document.body.appendChild(card({ slug: "hades", discountPct: 20 }));
    document.body.appendChild(card({ slug: "disco_elysium" }));
    const spy = vi.spyOn(chrome.runtime, "sendMessage");

    reportWishlistCount();
    await vi.advanceTimersByTimeAsync(750); // tick 1: total=2, not stable yet (lastTotal was -1)
    expect(spy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(750); // tick 2: same total=2 -> stable
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wishlist-report", discountedCount: 1, total: 2 })
    );
  });

  it("bails out and reports after MAX_TICKS even if the count never stabilizes", async () => {
    document.body.innerHTML = "";
    const spy = vi.spyOn(chrome.runtime, "sendMessage");
    let n = 0;
    // Add one more card before every tick so the count never repeats.
    const grow = () => {
      n++;
      document.body.appendChild(card({ slug: `game_${n}` }));
    };
    grow();
    reportWishlistCount();
    for (let i = 0; i < 8; i++) {
      await vi.advanceTimersByTimeAsync(750);
      if (i < 7) grow();
    }
    expect(spy).toHaveBeenCalled();
  });

  it("a superseded call (a newer reportWishlistCount()) never fires its own report", async () => {
    document.body.innerHTML = "";
    document.body.appendChild(card({ slug: "hades" }));
    const spy = vi.spyOn(chrome.runtime, "sendMessage");

    reportWishlistCount(); // attempt #1
    await vi.advanceTimersByTimeAsync(10);
    reportWishlistCount(); // attempt #2 supersedes #1
    await vi.advanceTimersByTimeAsync(750 * 2);
    // Only attempt #2's report should have fired, exactly once.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("swallows a sendMessage failure instead of throwing", async () => {
    document.body.innerHTML = "";
    document.body.appendChild(card({ slug: "hades" }));
    vi.spyOn(chrome.runtime, "sendMessage").mockImplementation(() => {
      throw new Error("no receiving end");
    });
    reportWishlistCount();
    // If the try/catch around sendMessage were missing, this would reject
    // the test via an uncaught exception inside the timer tick.
    await vi.advanceTimersByTimeAsync(750 * 2);
  });
});
