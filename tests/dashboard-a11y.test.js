import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/dom-safety.js");
await import("../extension/lib/currency-format.js");
await import("../extension/lib/genres.js");
await import("../extension/lib/purchases.js");
await import("../extension/lib/ics.js");
await import("../extension/lib/markdown-export.js");
await import("../extension/lib/game-status.js");
await import("../extension/lib/attachments.js");
await import("../extension/lib/achievements.js");
await import("../extension/lib/deals.js");
await import("../extension/lib/lang-names.js");
await import("../extension/lib/library-tools.js");
await import("../extension/content/toasts.js");
await import("../extension/content/announce.js");
await import("../extension/tags/state.js");
await import("../extension/tags/a11y.js");
await import("../extension/tags/features/tag-management.js");
await import("../extension/tags/features/games-list.js");
await import("../extension/tags/features/filter-builder.js");

const state = window.GOGPlusTagsState;
const A = () => window.GOGPlusTagsA11y;
const M = () => window.GOGPlusTagsManagement;
const $ = (id) => document.getElementById(id);
const key = (el, k, init = {}) => {
  const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(e);
  return e;
};
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));
const pills = () => [...$("tagList").querySelectorAll(".tag-pill")];

beforeEach(() => {
  globalThis.__resetChromeStores();
  Object.assign(state, {
    allTags: { a: ["rpg", "retro"], b: ["rpg"], c: ["indie"] },
    allNotes: {}, allHistory: {}, allStatus: {}, allGenres: {}, allFacts: {}, allOwned: {}, tagColors: {}, tagOrder: [],
    searchTerm: "", activeTag: null, preferredLanguages: [], uiLanguage: "en",
  });
  document.body.innerHTML = `
    <input id="search"><button id="filterBuilderBtn" aria-expanded="false">Filters</button>
    <div id="filterBuilderPopover" class="filter-builder-popover" role="dialog" hidden></div>
    <span id="counts"></span><div id="gameList"></div><div id="tagList" role="list"></div>`;
  window.GOGPlusAnnounce?.reset();
});

describe("a11y helpers", () => {
  it("focusables skips hidden, disabled and tabindex=-1 elements", () => {
    const box = document.createElement("div");
    box.innerHTML = `<button id="a">a</button><button disabled>b</button><button tabindex="-1">c</button><div hidden><button>d</button></div><input type="hidden"><a href="#x" id="e">e</a>`;
    expect(A().focusables(box).map((e) => e.id)).toEqual(["a", "e"]);
  });

  it("trapFocus wraps Tab at both ends and calls onEscape", () => {
    const box = document.createElement("div");
    box.innerHTML = `<button id="first">1</button><button id="mid">2</button><button id="last">3</button>`;
    document.body.appendChild(box);
    const onEscape = vi.fn();
    const release = A().trapFocus(box, { onEscape });
    $("last").focus();
    expect(key(box, "Tab").defaultPrevented).toBe(true);
    expect(document.activeElement.id).toBe("first");
    expect(key(box, "Tab", { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement.id).toBe("last");
    $("mid").focus();
    expect(key(box, "Tab").defaultPrevented).toBe(false); // in the middle: the browser moves on
    key(box, "Escape");
    expect(onEscape).toHaveBeenCalled();
    release();
    $("last").focus();
    expect(key(box, "Tab").defaultPrevented).toBe(false); // released
  });

  it("menu gives roles, focuses the first item, moves with arrows, and returns focus on Escape", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    const menu = document.createElement("div");
    menu.innerHTML = `<button id="m1">One</button><button id="m2">Two</button><button id="m3">Three</button>`;
    document.body.appendChild(menu);
    const close = A().menu(menu, opener);
    expect(menu.getAttribute("role")).toBe("menu");
    expect(menu.querySelectorAll('[role="menuitem"]')).toHaveLength(3);
    expect(opener.getAttribute("aria-haspopup")).toBe("menu");
    expect(opener.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement.id).toBe("m1");
    key(menu, "ArrowDown");
    expect(document.activeElement.id).toBe("m2");
    key(menu, "End");
    expect(document.activeElement.id).toBe("m3");
    key(menu, "ArrowDown"); // wraps
    expect(document.activeElement.id).toBe("m1");
    key(menu, "ArrowUp"); // wraps back
    expect(document.activeElement.id).toBe("m3");
    key(menu, "Home");
    expect(document.activeElement.id).toBe("m1");
    key(menu, "Escape");
    expect(menu.isConnected).toBe(false);
    expect(opener.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(opener);
    expect(typeof close).toBe("function");
  });

  it("Tab closes a menu without stealing focus back", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    const menu = document.createElement("div");
    menu.innerHTML = `<button>One</button>`;
    document.body.appendChild(menu);
    A().menu(menu, opener);
    key(menu, "Tab");
    expect(menu.isConnected).toBe(false);
    expect(document.activeElement).not.toBe(opener);
  });

  it("announce speaks through the page's live region", async () => {
    A().announce("hello");
    await tick(80);
    expect($("gog-plus-announcer").getAttribute("aria-live")).toBe("polite");
    expect($("gog-plus-announcer").textContent).toBe("hello");
  });
});

describe("the tag list", () => {
  it("is a list of focusable, labelled items", () => {
    M().renderTagList();
    expect(pills()).toHaveLength(3);
    const first = pills()[0];
    expect(first.getAttribute("role")).toBe("listitem");
    expect(first.tabIndex).toBe(0);
    expect(first.getAttribute("aria-label")).toMatch(/^rpg, 2 games\./);
    expect(pills().find((p) => p.dataset.tag === "indie").getAttribute("aria-label")).toMatch(/^indie, 1 game\./);
  });

  it("Enter filters by the focused tag and marks it current", () => {
    M().renderTagList();
    key(pills()[0], "Enter");
    expect(state.activeTag).toBe("rpg");
    expect(pills()[0].getAttribute("aria-current")).toBe("true");
    key(pills()[0], "Enter");
    expect(state.activeTag).toBeNull();
  });

  it("arrow keys move focus between tags", () => {
    M().renderTagList();
    pills()[0].focus();
    key(pills()[0], "ArrowDown");
    expect(document.activeElement).toBe(pills()[1]);
    key(pills()[1], "ArrowUp");
    expect(document.activeElement).toBe(pills()[0]);
    key(pills()[0], "ArrowUp"); // nothing above — stays
    expect(document.activeElement).toBe(pills()[0]);
  });

  it("Alt+Down moves a tag down, keeps focus on it, saves the order and announces it", async () => {
    M().renderTagList();
    const first = pills()[0].dataset.tag;
    key(pills()[0], "ArrowDown", { altKey: true });
    await tick(20);
    expect(pills()[1].dataset.tag).toBe(first);
    expect(document.activeElement.dataset.tag).toBe(first);
    expect(state.tagOrder).toEqual(pills().map((p) => p.dataset.tag));
    expect((await new Promise((r) => chrome.storage.local.get("tagOrder", r))).tagOrder).toEqual(state.tagOrder);
    await tick(80);
    expect($("gog-plus-announcer").textContent).toBe(`${first} moved to position 2 of 3`);
  });

  it("Alt+Up moves it up, and does nothing at the top or bottom", async () => {
    M().renderTagList();
    expect(await M().moveTag(pills()[0].dataset.tag, -1)).toBe(false);
    const last = pills()[2].dataset.tag;
    expect(await M().moveTag(last, 1)).toBe(false);
    key(pills()[2], "ArrowUp", { altKey: true });
    await tick(20);
    expect(pills()[1].dataset.tag).toBe(last);
  });

  it("keys pressed on the buttons inside a tag are left to those buttons", () => {
    M().renderTagList();
    const btn = pills()[0].querySelector(".tag-pill-menu");
    key(btn, "ArrowDown");
    expect(state.tagOrder).toEqual([]);
  });
});

describe("the tag action menu and colour picker", () => {
  it("opens as a keyboard-operable menu on the ⋯ button", () => {
    M().renderTagList();
    const opener = pills()[0].querySelector(".tag-pill-menu");
    opener.focus();
    opener.click();
    const menu = $("tagActionMenu");
    expect(menu.getAttribute("role")).toBe("menu");
    expect(menu.querySelectorAll('[role="menuitem"]').length).toBe(3);
    expect(document.activeElement.textContent).toBe("Rename…");
    key(menu, "Escape");
    expect($("tagActionMenu")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("the colour picker is a dialog that traps focus and Escape returns it to the swatch", () => {
    M().renderTagList();
    const swatch = pills()[0].querySelector(".tag-pill-swatch");
    swatch.focus();
    swatch.click();
    const picker = $("tagColorPicker");
    expect(picker.getAttribute("role")).toBe("dialog");
    expect(picker.getAttribute("aria-label")).toBe("Colour for rpg");
    expect(picker.contains(document.activeElement)).toBe(true);
    const items = A().focusables(picker);
    items[items.length - 1].focus();
    key(picker, "Tab");
    expect(document.activeElement).toBe(items[0]);
    key(picker, "Escape");
    expect($("tagColorPicker")).toBeNull();
    expect(document.activeElement).toBe(swatch);
  });
});

describe("the filter builder", () => {
  it("opens as a dialog, focuses its first chip, and Escape closes it and returns focus to the button", () => {
    const FB = window.GOGPlusTagsFilterBuilder;
    $("filterBuilderBtn").focus();
    FB.toggleFilterBuilder();
    const pop = $("filterBuilderPopover");
    expect(pop.hidden).toBe(false);
    expect($("filterBuilderBtn").getAttribute("aria-expanded")).toBe("true");
    expect(pop.contains(document.activeElement)).toBe(true);
    key(pop, "Escape");
    expect(pop.hidden).toBe(true);
    expect($("filterBuilderBtn").getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe($("filterBuilderBtn"));
  });
});

describe("the page itself", () => {
  const html = readFileSync(resolve(__dirname, "../extension/tags/tags.html"), "utf8");

  it("has a skip link, landmarks, a labelled toolbar and live counts", () => {
    expect(html).toContain('<a class="skip-link" href="#gameList">');
    expect(html).toContain("<main");
    expect(html).toContain('role="toolbar" aria-label=');
    expect(html).toMatch(/id="counts" role="status" aria-live="polite"/);
    expect(html).toMatch(/id="filterBuilderBtn"[^>]*aria-expanded="false"[^>]*aria-controls="filterBuilderPopover"/);
    expect(html).toMatch(/id="filterBuilderPopover"[^>]*role="dialog"/);
  });

  it("loads the announcer and the helpers before the code that uses them", () => {
    const order = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
    expect(order.indexOf("../content/announce.js")).toBeGreaterThan(-1);
    expect(order.indexOf("a11y.js")).toBeLessThan(order.indexOf("features/tag-management.js"));
    expect(order.indexOf("../content/announce.js")).toBeLessThan(order.indexOf("a11y.js"));
  });
});
