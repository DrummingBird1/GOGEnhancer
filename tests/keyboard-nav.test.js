import { describe, it, expect, beforeEach, vi } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/content/gog-dom.js");
await import("../extension/content/state.js");
await import("../extension/content/utils.js");
await import("../extension/content/features/keyboard-nav.js");

const state = window.GOGPlusContentState;
const Nav = window.GOGPlusKeyboardNav;

const card = (slug, { img = true } = {}) =>
  `<a href="/en/game/${slug}" id="${slug}">${img ? '<div class="gog-plus-cover-host"><img src="x.png"></div>' : "text only"}</a>`;

function press(key, opts = {}, target = document.body) {
  const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...opts });
  target.dispatchEvent(e);
  return e;
}

beforeEach(() => {
  document.body.innerHTML = "";
  state.settings = { ...window.GOG_PLUS_DEFAULTS, enabled: true, keyboardNav: true, customTags: true };
  window.GOGPlusToasts = { show: vi.fn() };
  window.GOGPlusCardBadges = { openQuickAddTag: vi.fn() };
  Element.prototype.scrollIntoView = vi.fn();
  Nav.init();
});

describe("navigableCards", () => {
  it("lists one entry per game, in order, skipping image-less duplicates", () => {
    document.body.innerHTML = card("a") + card("b", { img: false }) + card("a") + card("c");
    expect(Nav.navigableCards().map((x) => x.slug)).toEqual(["a", "c"]);
  });
});

describe("J / K", () => {
  beforeEach(() => {
    document.body.innerHTML = card("a") + card("b") + card("c");
  });

  it("j starts at the first card, then walks forward and stops at the end", () => {
    press("j");
    expect(document.activeElement.id).toBe("a");
    press("j");
    expect(document.activeElement.id).toBe("b");
    press("j");
    press("j");
    expect(document.activeElement.id).toBe("c");
  });

  it("k starts at the last card, then walks backward and stops at the start", () => {
    press("k");
    expect(document.activeElement.id).toBe("c");
    press("k");
    press("k");
    press("k");
    expect(document.activeElement.id).toBe("a");
  });

  it("moves a visible focus marker and scrolls the card into view", () => {
    press("j");
    press("j");
    expect(document.querySelectorAll(".gog-plus-kbd-focus")).toHaveLength(1);
    expect(document.getElementById("b").classList.contains("gog-plus-kbd-focus")).toBe(true);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("skips a card that can't take focus instead of getting stuck on it", () => {
    document.getElementById("b").focus = () => {}; // e.g. display:none
    press("j");
    press("j");
    expect(document.activeElement.id).toBe("c");
  });

  it("does nothing on a page with no cards", () => {
    document.body.innerHTML = "";
    expect(() => press("j")).not.toThrow();
  });

  it("prevents the default action only for keys it handles", () => {
    expect(press("j").defaultPrevented).toBe(true);
    expect(press("x").defaultPrevented).toBe(false);
  });
});

describe("when it must stay out of the way", () => {
  beforeEach(() => {
    document.body.innerHTML = card("a") + `<input id="box"><textarea id="ta"></textarea>`;
  });

  it("ignores keys typed into inputs and textareas", () => {
    press("j", {}, document.getElementById("box"));
    press("j", {}, document.getElementById("ta"));
    expect(document.activeElement.id).not.toBe("a");
  });

  it("ignores keys when a modifier is held", () => {
    press("j", { ctrlKey: true });
    press("j", { metaKey: true });
    press("j", { altKey: true });
    expect(document.activeElement.id).not.toBe("a");
  });

  it("is inert unless the user opted in", () => {
    state.settings.keyboardNav = false;
    press("j");
    expect(document.activeElement.id).not.toBe("a");
  });

  it("is inert when the whole extension is disabled", () => {
    state.settings.enabled = false;
    press("j");
    expect(document.activeElement.id).not.toBe("a");
  });

  it("is inert while the command palette is open", () => {
    document.body.insertAdjacentHTML("beforeend", `<div class="gog-plus-palette-overlay"></div>`);
    press("j");
    expect(document.activeElement.id).not.toBe("a");
  });

  it("init is idempotent — a second call doesn't double-handle keys", () => {
    Nav.init();
    Nav.init();
    document.body.innerHTML = card("a") + card("b");
    press("j");
    expect(document.activeElement.id).toBe("a");
  });
});

describe("T and ?", () => {
  it("t opens the quick-add popover for the focused card's cover host", () => {
    document.body.innerHTML = card("a");
    press("j");
    press("t");
    const [host, slug] = window.GOGPlusCardBadges.openQuickAddTag.mock.calls[0];
    expect(slug).toBe("a");
    expect(host.className).toBe("gog-plus-cover-host");
  });

  it("t does nothing when no card is focused, or custom tags are off, or there is no cover host", () => {
    document.body.innerHTML = card("a");
    press("t");
    expect(window.GOGPlusCardBadges.openQuickAddTag).not.toHaveBeenCalled();

    press("j");
    state.settings.customTags = false;
    press("t");
    expect(window.GOGPlusCardBadges.openQuickAddTag).not.toHaveBeenCalled();

    state.settings.customTags = true;
    document.body.innerHTML = `<a href="/en/game/z" id="z"><img src="x.png"></a>`;
    press("j");
    press("t");
    expect(window.GOGPlusCardBadges.openQuickAddTag).not.toHaveBeenCalled();
  });

  it("? shows the shortcut help", () => {
    press("?", { shiftKey: true });
    expect(window.GOGPlusToasts.show).toHaveBeenCalledWith(
      expect.stringContaining("J / K"),
      expect.anything()
    );
  });
});
