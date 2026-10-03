import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetEnv, getLocal, tick, state } from "./helpers/content-env.js";
import { gridHtml } from "./helpers/fixtures.js";

const Cat = () => window.GOGPlusCatalog;

const TILES = [
  { slug: "alpha", title: "Alpha", price: "$20.00", base: "$40.00", discount: 50 },
  { slug: "beta", title: "Beta", price: "$5.00" },
  { slug: "gamma", title: "Gamma", price: "$8.00", base: "$32.00", discount: 75, owned: true },
  { slug: "delta", title: "Delta", price: "$15.00", base: "$20.00", discount: 25 },
];

function mount(tiles = TILES) {
  // Keep the toast host (toasts.js holds a reference to it for the whole run).
  [...document.body.children].forEach((c) => {
    if (!c.classList.contains("gog-plus-toasts")) c.remove();
  });
  document.body.insertAdjacentHTML("afterbegin", gridHtml(tiles));
  // happy-dom has no layout, so the badge feature finds no cover host; the
  // catalog controls live in it, so mark the cover wrappers the way it would.
  document.querySelectorAll(".product-tile__image-wrapper").forEach((e) => e.classList.add("gog-plus-cover-host"));
}

const order = () => [...document.querySelectorAll("product-tile")].map((t) => t.style.order || "");
const slugsByOrder = () =>
  [...document.querySelectorAll("product-tile")]
    .map((t) => ({ slug: t.querySelector("a").getAttribute("href").split("/").pop(), o: Number(t.style.order) }))
    .sort((a, b) => a.o - b.o)
    .map((x) => x.slug);
const hidden = () => [...document.querySelectorAll("product-tile.gog-plus-tile-hidden")].map((t) => t.querySelector("a").getAttribute("href").split("/").pop());
const select = (id) => /** @type {HTMLSelectElement} */ (document.getElementById(id));
const change = (el, value) => {
  el.value = value;
  el.dispatchEvent(new Event("change"));
};
const btn = (text) => [...document.querySelectorAll("#gog-plus-catbar button, .gog-plus-compare-tray button, .gog-plus-modal-overlay button")].find((b) => b.textContent.trim() === text);

beforeEach(() => {
  resetEnv({ path: "/en/games?order=desc:trending" });
  state.settings.priceHistory = { beta: [{ d: "2026-01-01", p: 4, c: "USD" }, { d: "2026-02-01", p: 5, c: "USD" }] };
  mount();
});

describe("the bar", () => {
  it("mounts above the grid on catalog pages, once", () => {
    Cat().applyCatalog();
    Cat().applyCatalog();
    const bars = document.querySelectorAll("#gog-plus-catbar");
    expect(bars).toHaveLength(1);
    expect(bars[0].nextElementSibling).toBe(document.querySelector(".paginated-products-grid"));
    expect(bars[0].getAttribute("role")).toBe("toolbar");
  });

  it("re-mounts when the site swaps the grid out", () => {
    Cat().applyCatalog();
    const first = document.getElementById("gog-plus-catbar");
    mount();
    Cat().applyCatalog();
    const second = document.getElementById("gog-plus-catbar");
    expect(second).not.toBe(first);
    expect(document.querySelectorAll("#gog-plus-catbar")).toHaveLength(1);
  });

  it("is absent on other pages and when the feature is off", () => {
    Cat().applyCatalog();
    state.settings.catalogTools = false;
    Cat().applyCatalog();
    expect(document.getElementById("gog-plus-catbar")).toBeNull();
    state.settings.catalogTools = true;
    window.history.replaceState({}, "", "/en/game/alpha");
    Cat().applyCatalog();
    expect(document.getElementById("gog-plus-catbar")).toBeNull();
  });

  it("says what it is showing", () => {
    Cat().applyCatalog();
    expect(document.getElementById("gog-plus-cat-status").textContent).toBe("Showing 4 of 4");
  });
});

describe("local sort", () => {
  beforeEach(() => Cat().applyCatalog());

  it("re-orders the tiles with CSS order, never moving them in the DOM", () => {
    const before = [...document.querySelectorAll("product-tile")].map((t) => t.querySelector("a").href);
    change(select("gog-plus-cat-sort"), "discount");
    expect(slugsByOrder()).toEqual(["gamma", "alpha", "delta", "beta"]);
    expect([...document.querySelectorAll("product-tile")].map((t) => t.querySelector("a").href)).toEqual(before);
  });

  it("sorts by price, by closeness to the tracked low, and by title", () => {
    change(select("gog-plus-cat-sort"), "price-asc");
    expect(slugsByOrder()).toEqual(["beta", "gamma", "delta", "alpha"]);
    change(select("gog-plus-cat-sort"), "price-desc");
    expect(slugsByOrder()).toEqual(["alpha", "delta", "gamma", "beta"]);
    change(select("gog-plus-cat-sort"), "near-low");
    expect(slugsByOrder()[0]).toBe("beta"); // the only one with history
    change(select("gog-plus-cat-sort"), "title");
    expect(slugsByOrder()).toEqual(["alpha", "beta", "delta", "gamma"]);
  });

  it("restores the site's order by clearing the CSS order", () => {
    change(select("gog-plus-cat-sort"), "discount");
    change(select("gog-plus-cat-sort"), "default");
    expect(order()).toEqual(["", "", "", ""]);
  });

  it("keeps the chosen sort when the site re-renders its tiles", () => {
    change(select("gog-plus-cat-sort"), "price-asc");
    mount();
    Cat().applyCatalog();
    expect(slugsByOrder()).toEqual(["beta", "gamma", "delta", "alpha"]);
  });
});

describe("owned games", () => {
  beforeEach(() => Cat().applyCatalog());

  it("dims or hides games the site labels 'IN LIBRARY'", () => {
    state.settings.ownedDisplay = "dim";
    Cat().applyCatalog();
    expect(document.querySelectorAll(".gog-plus-tile-dim")).toHaveLength(1);
    state.settings.ownedDisplay = "hide";
    Cat().applyCatalog();
    expect(hidden()).toEqual(["gamma"]);
    expect(document.getElementById("gog-plus-cat-status").textContent).toBe("Showing 3 of 4");
    state.settings.ownedDisplay = "show";
    Cat().applyCatalog();
    expect(hidden()).toEqual([]);
    expect(document.querySelectorAll(".gog-plus-tile-dim")).toHaveLength(0);
  });

  it("also uses the learned set for tiles without the label", () => {
    state.settings.ownedSlugs = { beta: "2026-01-01" };
    state.settings.ownedDisplay = "hide";
    Cat().applyCatalog();
    expect(hidden().sort()).toEqual(["beta", "gamma"]);
  });

  it("changes through the bar are saved as preferences", async () => {
    change(select("gog-plus-cat-owned"), "hide");
    change(select("gog-plus-cat-density"), "compact");
    await tick();
    const { sync } = { sync: await new Promise((r) => chrome.storage.sync.get(["ownedDisplay", "catalogDensity"], r)) };
    expect(sync).toEqual({ ownedDisplay: "hide", catalogDensity: "compact" });
  });

  it("applies the compact grid class", () => {
    state.settings.catalogDensity = "compact";
    Cat().applyCatalog();
    expect(document.querySelector(".paginated-products-grid").classList.contains("gog-plus-grid--compact")).toBe(true);
  });
});

describe("not interested", () => {
  beforeEach(() => Cat().applyCatalog());

  it("hides a game from its tile control, with an undo", async () => {
    document.querySelector('product-tile .gog-plus-tilectl-hide').click();
    await tick();
    expect(hidden()).toEqual(["alpha"]);
    expect(state.settings.notInterested.alpha).toBeTruthy();
    expect(document.getElementById("gog-plus-cat-hidden").textContent).toBe("Show 1 hidden");
    expect(document.getElementById("gog-plus-cat-status").textContent).toContain("1 hidden as not interested");
    document.querySelector(".gog-plus-toast-action").click();
    await tick();
    expect(hidden()).toEqual([]);
    expect(state.settings.notInterested).toEqual({});
  });

  it("can show hidden games again from the bar and hide them once more", async () => {
    state.settings.notInterested = { beta: "2026-01-01" };
    Cat().applyCatalog();
    expect(hidden()).toEqual(["beta"]);
    state.settings.hideNotInterested = false;
    Cat().applyCatalog();
    expect(hidden()).toEqual([]);
    expect(document.getElementById("gog-plus-cat-hidden").textContent).toBe("Hide not-interested again");
  });

  it("keeps a hidden game hidden in the home page's carousels too", () => {
    window.history.replaceState({}, "", "/en");
    state.settings.notInterested = { beta: "2026-01-01" };
    Cat().applyCatalog();
    expect(hidden()).toEqual(["beta"]);
    expect(document.getElementById("gog-plus-catbar")).toBeNull();
  });
});

describe("tracked-only filter", () => {
  it("keeps only games with recorded price history", () => {
    Cat().applyCatalog();
    const box = document.querySelector("#gog-plus-catbar .gog-plus-bar-check input");
    box.checked = true;
    box.dispatchEvent(new Event("change"));
    expect(hidden().sort()).toEqual(["alpha", "delta", "gamma"]);
    expect(document.getElementById("gog-plus-cat-status").textContent).toBe("Showing 1 of 4");
  });
});

describe("tile controls", () => {
  it("adds one control box per tile, only inside the cover host, and never duplicates it", () => {
    Cat().applyCatalog();
    Cat().applyCatalog();
    expect(document.querySelectorAll(".gog-plus-tilectl")).toHaveLength(4);
    expect(document.querySelector(".product-tile__image-wrapper > .gog-plus-tilectl")).not.toBeNull();
    expect(document.querySelector("a.product-tile > .gog-plus-tilectl")).toBeNull();
  });

  it("does not touch tiles that have no cover host", () => {
    document.querySelectorAll(".gog-plus-cover-host").forEach((e) => e.classList.remove("gog-plus-cover-host"));
    Cat().applyCatalog();
    expect(document.querySelectorAll(".gog-plus-tilectl")).toHaveLength(0);
  });

  it("clicking a control does not follow the card's link", () => {
    Cat().applyCatalog();
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    document.querySelector(".gog-plus-tilectl-hide").dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});

describe("select mode and bulk actions", () => {
  beforeEach(() => Cat().applyCatalog());

  it("shows selection boxes only in select mode", () => {
    const pick = () => document.querySelector(".gog-plus-tilectl-select");
    expect(pick().hidden).toBe(true);
    btn("Select games").click();
    expect(pick().hidden).toBe(false);
    expect(document.getElementById("gog-plus-cat-selection")).not.toBeNull();
    btn("Done selecting").click();
    expect(document.getElementById("gog-plus-cat-selection")).toBeNull();
    expect(pick().hidden).toBe(true);
  });

  it("tags the selected games in one write", async () => {
    btn("Select games").click();
    const picks = document.querySelectorAll(".gog-plus-tilectl-select");
    picks[0].click();
    picks[1].click();
    expect(document.getElementById("gog-plus-cat-selcount").textContent).toBe("2 selected");
    expect(document.querySelectorAll(".gog-plus-tile-selected")).toHaveLength(2);
    document.getElementById("gog-plus-cat-tag").value = "  weekend  ";
    btn("Tag").click();
    await tick(5);
    const { tags } = await getLocal("tags");
    expect(tags).toEqual({ alpha: ["weekend"], beta: ["weekend"] });
  });

  it("hides the selected games as not interested", async () => {
    btn("Select games").click();
    document.querySelectorAll(".gog-plus-tilectl-select")[2].click();
    btn("Not interested").click();
    await tick(5);
    expect(hidden()).toEqual(["gamma"]);
    expect(Object.keys((await getLocal("notInterested")).notInterested)).toEqual(["gamma"]);
  });

  it("ignores an empty tag", async () => {
    btn("Select games").click();
    document.querySelectorAll(".gog-plus-tilectl-select")[0].click();
    document.getElementById("gog-plus-cat-tag").value = "   ";
    btn("Tag").click();
    await tick(5);
    expect(await getLocal("tags")).toEqual({});
  });
});

describe("comparison", () => {
  beforeEach(() => Cat().applyCatalog());

  it("needs two games before it can compare, and caps at four", () => {
    const cmp = () => document.querySelectorAll(".gog-plus-tilectl-compare");
    cmp()[0].click();
    expect(document.getElementById("gog-plus-compare-tray").textContent).toContain("Comparing 1/4");
    expect(btn("Compare").disabled).toBe(true);
    cmp()[1].click();
    expect(btn("Compare").disabled).toBe(false);
    cmp()[2].click();
    cmp()[3].click();
    mount([...TILES, { slug: "eps", price: "$1.00" }]);
    Cat().applyCatalog();
    document.querySelectorAll(".gog-plus-tilectl-compare")[4].click();
    expect(document.getElementById("gog-plus-compare-tray").textContent).toContain("Comparing 4/4");
    expect(document.querySelector(".gog-plus-toast").textContent).toContain("up to 4");
  });

  it("opens a side-by-side table from data already on hand", () => {
    state.settings.gameFacts = { alpha: { title: "Alpha", rating: { score: 4.5, count: 10 }, hours: { Main: "10 h" } } };
    document.querySelectorAll(".gog-plus-tilectl-compare")[0].click();
    document.querySelectorAll(".gog-plus-tilectl-compare")[2].click();
    btn("Compare").click();
    const overlay = document.querySelector(".gog-plus-modal-overlay");
    expect(overlay.getAttribute("role")).toBe("dialog");
    const rows = [...overlay.querySelectorAll("tr")].map((r) => [...r.children].map((c) => c.textContent));
    expect(rows[0]).toEqual(["", "Alpha", "Gamma"]);
    expect(rows.find((r) => r[0] === "Price now")).toEqual(["Price now", "20.00 USD", "In library"]);
    expect(rows.find((r) => r[0] === "Rating")).toEqual(["Rating", "4.5/5 (10)", "—"]);
    expect(overlay.querySelector("a").getAttribute("href")).toBe("/en/game/alpha");
  });

  it("draws a price-history chart for games that have history, in the target currency", () => {
    state.settings.targetCurrency = "USD";
    state.settings.priceHistory = { alpha: [{ d: "2026-01-01", p: 30, c: "USD" }, { d: "2026-02-01", p: 20, c: "USD" }], gamma: [{ d: "2026-01-10", p: 8, c: "USD" }, { d: "2026-02-10", p: 9, c: "USD" }] };
    document.querySelectorAll(".gog-plus-tilectl-compare")[0].click();
    document.querySelectorAll(".gog-plus-tilectl-compare")[2].click();
    btn("Compare").click();
    const svg = document.querySelector(".gog-plus-compare-chart svg");
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.querySelectorAll("polyline")).toHaveLength(2);
    expect(document.querySelector(".gog-plus-compare-legend").textContent).toContain("Alpha");
  });

  it("shows no chart when none of the games has two snapshots", () => {
    document.querySelectorAll(".gog-plus-tilectl-compare")[1].click();
    document.querySelectorAll(".gog-plus-tilectl-compare")[2].click();
    state.settings.priceHistory = {};
    btn("Compare").click();
    expect(document.querySelector(".gog-plus-compare-chart")).toBeNull();
  });

  it("closes with the button, Escape or a click on the backdrop", () => {
    document.querySelectorAll(".gog-plus-tilectl-compare")[0].click();
    document.querySelectorAll(".gog-plus-tilectl-compare")[1].click();
    const open = () => btn("Compare").click();
    open();
    btn("Close").click();
    expect(document.querySelector(".gog-plus-modal-overlay")).toBeNull();
    open();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.querySelector(".gog-plus-modal-overlay")).toBeNull();
    open();
    document.querySelector(".gog-plus-modal-overlay").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(document.querySelector(".gog-plus-modal-overlay")).toBeNull();
  });

  it("clearing the tray removes it", () => {
    document.querySelectorAll(".gog-plus-tilectl-compare")[0].click();
    btn("Clear").click();
    expect(document.getElementById("gog-plus-compare-tray")).toBeNull();
    expect(document.querySelector(".gog-plus-tilectl-compare.is-on")).toBeNull();
  });

  it("compares the selected games from the bulk row", () => {
    btn("Select games").click();
    const picks = document.querySelectorAll(".gog-plus-tilectl-select");
    picks[0].click();
    picks[3].click();
    btn("Compare").click();
    expect(document.querySelector(".gog-plus-modal-overlay")).not.toBeNull();
    expect(Cat()._state.selected.size).toBe(0);
  });
});

describe("saved searches", () => {
  it("offers to save a catalog URL, then lists, opens and removes it", async () => {
    Cat().applyCatalog();
    const prompt = (window.prompt = vi.fn(() => "Trending RPGs"));
    btn("Save this search").click();
    await tick(5);
    expect(prompt).toHaveBeenCalled();
    expect(state.settings.catalogPresets).toEqual({ "Trending RPGs": "/en/games?order=desc:trending" });
    expect((await getLocal("catalogPresets")).catalogPresets["Trending RPGs"]).toBeTruthy();
    // the bar was rebuilt: now it shows the saved search as current and offers to remove it
    expect(select("gog-plus-cat-presets").value).toBe("/en/games?order=desc:trending");
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { ...window.location, assign, pathname: "/en/games", search: "?order=desc:trending" }, configurable: true });
    change(select("gog-plus-cat-presets"), "/en/games?order=desc:trending");
    expect(assign).toHaveBeenCalledWith("/en/games?order=desc:trending");
    btn("Remove this search").click();
    await tick(5);
    expect(state.settings.catalogPresets).toEqual({});
  });

  it("does nothing if the name prompt is cancelled", async () => {
    Cat().applyCatalog();
    window.prompt = vi.fn(() => null);
    btn("Save this search").click();
    await tick(5);
    expect(state.settings.catalogPresets).toEqual({});
  });

  it("does not offer to save a page that is not a catalog search", () => {
    window.history.replaceState({}, "", "/en/games?order=desc:trending");
    Cat().applyCatalog();
    expect(btn("Save this search")).toBeTruthy();
  });
});

describe("switching the feature off", () => {
  it("clears everything it added", () => {
    Cat().applyCatalog();
    change(select("gog-plus-cat-sort"), "discount");
    state.settings.ownedDisplay = "dim";
    Cat().applyCatalog();
    document.querySelectorAll(".gog-plus-tilectl-compare")[0].click();
    state.settings.catalogTools = false;
    Cat().applyCatalog();
    expect(document.getElementById("gog-plus-catbar")).toBeNull();
    expect(document.getElementById("gog-plus-compare-tray")).toBeNull();
    expect(document.querySelectorAll(".gog-plus-tilectl")).toHaveLength(0);
    expect(document.querySelectorAll(".gog-plus-tile-dim")).toHaveLength(0);
    expect(order()).toEqual(["", "", "", ""]);
  });

  it("reacts to data written elsewhere", () => {
    Cat().applyCatalog();
    state.settings.notInterested = { delta: "2026-01-01" };
    document.dispatchEvent(new CustomEvent("gog-plus:data", { detail: { key: "notInterested" } }));
    expect(hidden()).toEqual(["delta"]);
    state.settings.catalogPresets = { x: "/en/games" };
    document.dispatchEvent(new CustomEvent("gog-plus:data", { detail: { key: "catalogPresets" } }));
    expect(select("gog-plus-cat-presets")).not.toBeNull();
    document.dispatchEvent(new CustomEvent("gog-plus:data", { detail: { key: "somethingElse" } }));
  });
});
