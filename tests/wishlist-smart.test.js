import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetEnv, tick, state } from "./helpers/content-env.js";
import { wishlistPageHtml } from "./helpers/fixtures.js";

const W = () => window.GOGPlusWishlistFeature;
const NOW = Date.now();

const ROWS = [
  { slug: "alpha", title: "Alpha", price: "20.00", discount: 50 },
  { slug: "beta", title: "Beta", price: "5.00" },
  { slug: "gamma", title: "Gamma", price: "8.00", discount: 75 },
  { slug: "delta", title: "Delta", owned: true },
  { slug: "eps", title: "Epsilon", tba: true },
];

const bar = () => document.getElementById("gog-plus-wlfilters");
const rowsBySlug = () => Object.fromEntries([...document.querySelectorAll(".product-row-wrapper")].map((w) => [w.querySelector("a").getAttribute("href").split("/").pop(), w]));
const orderOf = () =>
  [...document.querySelectorAll(".product-row-wrapper")]
    .map((w) => ({ s: w.querySelector("a").getAttribute("href").split("/").pop(), o: Number(w.style.order) }))
    .sort((a, b) => a.o - b.o)
    .map((x) => x.s);
const visible = () =>
  Object.entries(rowsBySlug())
    .filter(([, w]) => !w.classList.contains("gog-plus-wl-hidden") && !w.classList.contains("gog-plus-filtered-out"))
    .map(([s]) => s)
    .sort();
const sel = (key) => bar().querySelector(`select[data-wl="${key}"]`);
const change = (el, v) => {
  el.value = v;
  el.dispatchEvent(new Event("change"));
};
const pressed = (id) => bar().querySelector(`button[data-wl-filter="${id}"]`);

function mount(rows = ROWS) {
  [...document.body.children].forEach((c) => {
    if (!c.classList.contains("gog-plus-toasts")) c.remove();
  });
  document.body.insertAdjacentHTML("afterbegin", wishlistPageHtml(rows));
}

beforeEach(() => {
  resetEnv({ path: "/en/account/wishlist", settings: { wishlistFilters: true, targetCurrency: "USD" } });
  W()._smart.sort = "default";
  W()._smart.group = "none";
  W()._smart.filters.clear();
  state.settings.priceHistory = {
    alpha: [{ d: "2026-01-01", p: 20, c: "USD" }, { d: "2026-02-01", p: 40, c: "USD" }],
    beta: [{ d: "2026-01-01", p: 4, c: "USD" }],
  };
  mount();
});

describe("which cards count as wishlist rows", () => {
  it("counts real rows, never the header menu's tiles (the 'All 7' bug)", () => {
    W().ensureWishlistFilters();
    W().updateWishlistFilterCounts(bar());
    expect(bar().querySelector('button[data-f="all"] .gog-plus-wlfilter-count').textContent).toBe("5");
    expect(W().wishlistCards()).toHaveLength(5);
    expect(W().wishlistCards().every((c) => c.real)).toBe(true);
  });

  it("mounts the bar in the account list container, not <main>", () => {
    document.body.insertAdjacentHTML("afterbegin", "<main></main>");
    W().ensureWishlistFilters();
    expect(document.querySelector(".account__products").firstElementChild).toBe(bar());
  });

  it("filters real rows with bare-number prices by converting through the page currency", () => {
    W().ensureWishlistFilters();
    W().updateWishlistFilterCounts(bar());
    const count = (f) => bar().querySelector(`button[data-f="${f}"] .gog-plus-wlfilter-count`).textContent;
    expect(count("sale")).toBe("2");
    expect(count("under10")).toBe("2"); // beta 5, gamma 8
    expect(count("under25")).toBe("3"); // + alpha 20
    bar().querySelector('button[data-f="under10"]').click();
    expect(rowsBySlug().alpha.classList.contains("gog-plus-filtered-out")).toBe(true);
    expect(rowsBySlug().beta.classList.contains("gog-plus-filtered-out")).toBe(false);
  });

  it("converts another page currency to USD with the stored rates", () => {
    state.pageCurrency = { code: "ILS", symbol: "₪" };
    document.body.className = "_prices-in-ils";
    state.settings.rates = { ILS: 4 };
    mount([{ slug: "a", price: "30.00" }, { slug: "b", price: "60.00" }]);
    const cards = W().wishlistCards();
    expect(cards.map((c) => c.usd)).toEqual([7.5, 15]);
  });

  it("uses a game's recorded rating for the 'rated 4.5+' filter", () => {
    state.settings.gameFacts = { alpha: { rating: { score: 4.8, count: 10 } }, beta: { rating: { score: 3.0, count: 10 } } };
    W().ensureWishlistFilters();
    W().updateWishlistFilterCounts(bar());
    expect(bar().querySelector('button[data-f="rated45"] .gog-plus-wlfilter-count').textContent).toBe("1");
  });

  it("builds genre chips from the cached genre, once, without rebuilding them on every refresh", () => {
    state.settings.gameGenres = { alpha: "rpg", beta: "rpg" };
    W().ensureWishlistFilters();
    W().updateWishlistFilterCounts(bar());
    const chip = bar().querySelector('button[data-f="genre-rpg"]');
    expect(chip.querySelector(".gog-plus-wlfilter-count").textContent).toBe("2");
    W().updateWishlistFilterCounts(bar());
    expect(bar().querySelector('button[data-f="genre-rpg"]')).toBe(chip); // untouched: same node
    chip.click();
    expect(rowsBySlug().gamma.classList.contains("gog-plus-filtered-out")).toBe(true);
  });
});

describe("the smart row", () => {
  beforeEach(() => W().ensureWishlistFilters());

  it("is added to the bar, and its buttons are not quick filters", () => {
    expect(bar().querySelector(".gog-plus-wlsmart")).not.toBeNull();
    expect([...bar().querySelectorAll("button[data-f]")].map((b) => b.dataset.f)).toEqual(["all", "sale", "under10", "under25", "rated45"]);
  });

  it("is absent when wishlistSmart is off", () => {
    document.getElementById("gog-plus-wlfilters").remove();
    state.settings.wishlistSmart = false;
    W().ensureWishlistFilters();
    expect(bar().querySelector(".gog-plus-wlsmart")).toBeNull();
    W().applySmart(); // no-op
  });

  it("sorts rows with CSS order inside a flex list, without moving them", () => {
    const before = [...document.querySelectorAll(".product-row-wrapper")];
    change(sel("sort"), "discount");
    expect(orderOf().slice(0, 2)).toEqual(["gamma", "alpha"]);
    expect(document.querySelector(".list-inner").classList.contains("gog-plus-wl-ordered")).toBe(true);
    expect([...document.querySelectorAll(".product-row-wrapper")]).toEqual(before);
    change(sel("sort"), "price-asc");
    expect(orderOf().slice(0, 3)).toEqual(["beta", "gamma", "alpha"]);
    change(sel("sort"), "near-low");
    expect(orderOf()[0]).toBe("alpha"); // at its tracked low
    change(sel("sort"), "default");
    expect(document.querySelector(".list-inner").classList.contains("gog-plus-wl-ordered")).toBe(false);
    expect(rowsBySlug().alpha.style.order).toBe("");
  });

  it("filters to games near their tracked low, ending soon, and not owned", () => {
    pressed("near-low").click();
    expect(visible()).toEqual(["alpha"]);
    expect(pressed("near-low").getAttribute("aria-pressed")).toBe("true");
    pressed("near-low").click();
    expect(visible()).toHaveLength(5);

    state.settings.gameFacts = { gamma: { pe: new Date(NOW + 3600e3).toISOString() }, beta: { pe: new Date(NOW + 10 * 86400e3).toISOString() } };
    pressed("ending-soon").click();
    expect(visible()).toEqual(["gamma"]);
    pressed("ending-soon").click();

    pressed("hide-owned").click();
    expect(visible()).toEqual(["alpha", "beta", "eps", "gamma"]);
  });

  it("combines smart filters with the quick filters instead of fighting them", () => {
    bar().querySelector('button[data-f="sale"]').click();
    pressed("hide-owned").click();
    expect(visible()).toEqual(["alpha", "gamma"]);
    pressed("near-low").click();
    expect(visible()).toEqual(["alpha"]);
  });

  it("groups by first tag with headings that are updated in place, not rebuilt", () => {
    state.settings.tags = { alpha: ["rpg"], beta: ["rpg"], gamma: ["indie"] };
    change(sel("group"), "tag");
    const headings = () => [...document.querySelectorAll(".gog-plus-wl-group")];
    expect(headings().map((h) => h.textContent)).toEqual(["rpg · 2", "indie · 1", "Other · 2"]);
    const first = headings()[0];
    W().applySmart();
    expect(headings()[0]).toBe(first);
    expect(Number(headings()[0].style.order)).toBeLessThan(Number(rowsBySlug().alpha.style.order));
    change(sel("group"), "none");
    expect(headings()).toHaveLength(0);
  });

  it("removes a heading whose group disappeared", () => {
    state.settings.tags = { alpha: ["rpg"], gamma: ["indie"] };
    change(sel("group"), "tag");
    expect([...document.querySelectorAll(".gog-plus-wl-group")].map((h) => h.dataset.group)).toEqual(["indie", "rpg", "Other"]);
    state.settings.tags = { alpha: ["rpg"] };
    W().applySmart();
    expect([...document.querySelectorAll(".gog-plus-wl-group")].map((h) => h.dataset.group)).toEqual(["rpg", "Other"]);
  });

  it("shows a live total of what is visible, with the estimated saving", () => {
    W().applySmart();
    const total = bar().querySelector("[data-wl-total]");
    // Alpha 20 + Beta 5 + Gamma 8 (Delta is owned, Epsilon TBA) = 33
    expect(total.textContent).toBe("5 games · $33.00 to buy all · 2 on sale, saving about $44.00");
    pressed("hide-owned").click();
    expect(total.textContent).toContain("4 games");
    bar().querySelector('button[data-f="under10"]').click();
    W().applySmart();
    expect(total.textContent).toContain("2 games · $13.00 to buy all");
  });

  it("clears the total when the list is empty", () => {
    document.querySelector(".list-inner").replaceChildren();
    W().applySmart();
    expect(bar().querySelector("[data-wl-total]").textContent).toBe("");
  });
});

describe("export", () => {
  let created;
  let clicked;
  beforeEach(() => {
    W().ensureWishlistFilters();
    created = [];
    clicked = [];
    URL.createObjectURL = vi.fn((blob) => {
      created.push(blob);
      return "blob:test";
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
      clicked.push(this.download);
    });
  });
  const exportBtn = (kind) => bar().querySelector(`button[data-wl-export="${kind}"]`);

  it("downloads a CSV and a Markdown list of every row", async () => {
    exportBtn("csv").click();
    await tick();
    expect(clicked[0]).toMatch(/^gog-wishlist-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(created[0].type).toBe("text/csv");
    const csv = await created[0].text();
    expect(csv.split("\r\n")[0]).toBe("Title,Slug,Price,Currency,Discount %,Owned,Tracked low,Tags");
    expect(csv).toContain("Alpha,alpha,20.00,USD,50,,20.00,");
    exportBtn("md").click();
    await tick();
    expect(clicked[1]).toMatch(/\.md$/);
    expect(await created[1].text()).toContain("- [ ] [Alpha](https://www.gog.com/en/game/alpha) — 20.00 USD (-50%)");
  });

  it("writes a calendar of offers whose end date was seen on the game page", async () => {
    state.settings.gameFacts = { gamma: { title: "Gamma!", pe: new Date(NOW + 3 * 86400e3).toISOString() } };
    exportBtn("ics").click();
    await tick();
    expect(clicked[0]).toMatch(/\.ics$/);
    const ics = await created[0].text();
    expect(ics).toContain("SUMMARY:GOG offer ends: Gamma!");
  });

  it("explains when no offer end is known", () => {
    exportBtn("ics").click();
    expect(created).toHaveLength(0);
    expect(document.querySelector(".gog-plus-toast").textContent).toContain("No running offer end dates");
  });

  it("copies the games as lines for Trello's bulk add", async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    exportBtn("cards").click();
    await tick();
    expect(writeText).toHaveBeenCalled();
    const text = writeText.mock.calls[0][0];
    expect(text.split("\n")).toHaveLength(5);
    expect(text).toContain("Alpha — 20.00 USD (-50%)");
  });

  it("says so when the clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("no")) }, configurable: true });
    exportBtn("cards").click();
    await tick();
    expect(document.querySelector(".gog-plus-toast").textContent).toContain("clipboard");
  });

  it("does not export before the list has loaded", () => {
    document.querySelector(".list-inner").replaceChildren();
    exportBtn("csv").click();
    expect(created).toHaveLength(0);
    expect(document.querySelector(".gog-plus-toast").textContent).toContain("hasn't loaded");
  });
});

describe("live refresh", () => {
  it("re-applies sort and totals when Angular adds a row later", async () => {
    vi.useFakeTimers();
    try {
      W().ensureWishlistFilters();
      change(sel("sort"), "discount");
      await vi.advanceTimersByTimeAsync(900);
      const total = bar().querySelector("[data-wl-total]");
      expect(total.textContent).toContain("5 games");
      document.querySelector(".list-inner").insertAdjacentHTML(
        "beforeend",
        `<div class="product-row-wrapper"><div class="product-row product-row--wishlist" gog-product="9"><span class="_price product-state__price">1.00</span>
         <a class="product-row__link" href="/en/game/late"><div class="product-row__discount product-state__discount"><span>90</span></div><div class="product-row__title">Late</div></a></div></div>`
      );
      await vi.advanceTimersByTimeAsync(600);
      expect(total.textContent).toContain("6 games");
      expect(orderOf()[0]).toBe("late"); // biggest discount first
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("the converter leaves the extension's own UI alone", () => {
  it("does not append a conversion note to the filter bar's '< $10' label (but still converts the site's prices)", () => {
    state.settings.targetCurrency = "ILS";
    state.settings.rates = { ILS: 4 };
    state.settings.currencyConverter = true;
    W().ensureWishlistFilters();
    document.body.insertAdjacentHTML("beforeend", '<span id="site-price">$5.00</span>');
    window.GOGPlusCurrencyFeature.applyCurrencyConversion();
    expect(bar().querySelector(".gog-plus-conv-note")).toBeNull();
    expect(document.getElementById("site-price").querySelector(".gog-plus-conv-note")).not.toBeNull();
  });
});
