import { describe, it, expect, beforeEach, vi } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/content/state.js");
await import("../extension/content/features/command-palette.js");

const state = window.GOGPlusContentState;
const Palette = window.GOGPlusCommandPalette;

function ctrlK(target = document) {
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true })
  );
}

function key(overlay, key, extra = {}) {
  overlay
    .querySelector(".gog-plus-palette-input")
    .dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...extra }));
}

beforeEach(() => {
  globalThis.__resetChromeStores();
  vi.clearAllMocks();
  document.body.innerHTML = "";
  state.settings = { ...window.GOG_PLUS_DEFAULTS, enabled: true };
  Palette.close();
  window.location.reload = vi.fn();
  // open() schedules its "just opened" class + focus via rAF; run it
  // synchronously so it can't fire after a later test's close() has
  // already nulled out the module-level `overlay` reference.
  window.requestAnimationFrame = (cb) => cb();
});

describe("opening and closing", () => {
  it("Ctrl+K opens the overlay with every action listed", () => {
    ctrlK();
    const overlay = document.querySelector(".gog-plus-palette-overlay");
    expect(overlay).not.toBeNull();
    expect(overlay.querySelectorAll(".gog-plus-palette-item").length).toBe(8);
  });

  it("Cmd (metaKey) also toggles the palette", () => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true, cancelable: true })
    );
    expect(document.querySelector(".gog-plus-palette-overlay")).not.toBeNull();
  });

  it("does nothing when the extension is disabled", () => {
    state.settings.enabled = false;
    ctrlK();
    expect(document.querySelector(".gog-plus-palette-overlay")).toBeNull();
  });

  it("Ctrl+K again closes an already-open palette", () => {
    ctrlK();
    ctrlK();
    expect(document.querySelector(".gog-plus-palette-overlay")).toBeNull();
  });

  it("Escape closes the palette", () => {
    ctrlK();
    const overlay = document.querySelector(".gog-plus-palette-overlay");
    key(overlay, "Escape");
    expect(document.querySelector(".gog-plus-palette-overlay")).toBeNull();
  });

  it("clicking the overlay backdrop (not the dialog) closes it", () => {
    ctrlK();
    const overlay = document.querySelector(".gog-plus-palette-overlay");
    overlay.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(document.querySelector(".gog-plus-palette-overlay")).toBeNull();
  });

  it("open() is a no-op if already open (no duplicate overlays)", () => {
    Palette.open();
    Palette.open();
    expect(document.querySelectorAll(".gog-plus-palette-overlay").length).toBe(1);
  });
});

describe("filtering", () => {
  it("narrows the list by free-text match against the label", () => {
    ctrlK();
    const overlay = document.querySelector(".gog-plus-palette-overlay");
    const input = overlay.querySelector(".gog-plus-palette-input");
    input.value = "hebrew";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const items = overlay.querySelectorAll(".gog-plus-palette-item-label");
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain("Hebrew");
  });

  it("resolves dynamic labels (on/off phrasing) against live settings", () => {
    state.settings.enabled = true;
    ctrlK();
    let overlay = document.querySelector(".gog-plus-palette-overlay");
    expect(overlay.textContent).toContain("Turn off GOG Enhancer");
    Palette.close();

    state.settings.enabled = false;
    // toggle-enabled would be filtered by the disabled gate on open(), so
    // re-enable just to inspect the palette's own state-reading logic —
    // resolveLabel() reads state.settings live regardless of the outer gate.
    state.settings.enabled = true;
    state.settings.currencyConverter = false;
    ctrlK();
    overlay = document.querySelector(".gog-plus-palette-overlay");
    expect(overlay.textContent).toContain("Turn on currency conversion");
  });
});

describe("keyboard navigation", () => {
  it("ArrowDown/ArrowUp move the active item and clamp at the ends", () => {
    ctrlK();
    const overlay = document.querySelector(".gog-plus-palette-overlay");
    key(overlay, "ArrowUp"); // already at 0, should clamp
    expect(overlay.querySelector(".gog-plus-palette-item.is-active").dataset.index).toBe("0");
    key(overlay, "ArrowDown");
    expect(overlay.querySelector(".gog-plus-palette-item.is-active").dataset.index).toBe("1");
  });

  it("hovering an item makes it active", () => {
    ctrlK();
    const overlay = document.querySelector(".gog-plus-palette-overlay");
    const third = overlay.querySelectorAll(".gog-plus-palette-item")[2];
    third.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    expect(overlay.querySelector(".gog-plus-palette-item.is-active").dataset.index).toBe("2");
  });
});

describe("running an action", () => {
  it("Enter runs the active action and closes the palette", async () => {
    ctrlK();
    const overlay = document.querySelector(".gog-plus-palette-overlay");
    const input = overlay.querySelector(".gog-plus-palette-input");
    input.value = "reload this tab";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    key(overlay, "Enter");
    expect(document.querySelector(".gog-plus-palette-overlay")).toBeNull();
    expect(window.location.reload).toHaveBeenCalled();
  });

  it("clicking an item runs it", async () => {
    ctrlK();
    const overlay = document.querySelector(".gog-plus-palette-overlay");
    const item = [...overlay.querySelectorAll(".gog-plus-palette-item")].find((li) =>
      li.textContent.includes("Open Advanced Options")
    );
    item.click();
    expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
  });

  it("toggle-enabled flips the enabled setting in storage", async () => {
    state.settings.enabled = true;
    ctrlK();
    const overlay = document.querySelector(".gog-plus-palette-overlay");
    const input = overlay.querySelector(".gog-plus-palette-input");
    input.value = "turn off gog enhancer";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    key(overlay, "Enter");
    await new Promise((r) => setTimeout(r, 0));
    const s = await new Promise((r) => chrome.storage.sync.get(["enabled"], r));
    expect(s.enabled).toBe(false);
  });

  it("a thrown action error is caught rather than propagating", async () => {
    window.location.reload = vi.fn(() => {
      throw new Error("boom");
    });
    ctrlK();
    const overlay = document.querySelector(".gog-plus-palette-overlay");
    const input = overlay.querySelector(".gog-plus-palette-input");
    input.value = "reload this tab";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(() => key(overlay, "Enter")).not.toThrow();
    expect(window.location.reload).toHaveBeenCalled();
  });
});
