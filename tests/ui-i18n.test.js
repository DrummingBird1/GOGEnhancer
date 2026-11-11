import { describe, it, expect, beforeEach, vi } from "vitest";

// The extension's own text inside gog.com pages, in the interface language.
await import("../extension/lib/defaults.js");
await import("../extension/lib/i18n-pages.js");
await import("../extension/lib/i18n-pages-content.js");
await import("../extension/content/state.js");
await import("../extension/content/ui-i18n.js");

const state = window.GOGPlusContentState;
const tick = (ms = 80) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("GOGPlusUiI18n", () => {
  it("translates the extension's own elements and nothing else", async () => {
    state.settings = { ...window.GOG_PLUS_DEFAULTS, uiLanguage: "he" };
    document.body.innerHTML = `
      <button class="buy">Add to cart</button>
      <aside id="gog-plus-gamepanel" class="gog-plus-gamepanel"><h3>Deal check</h3><button>Copy clean link</button>
        <span class="gog-plus-tag-chip" data-no-i18n>Backlog</span></aside>`;
    window.GOGPlusUiI18n.init();
    await tick();
    expect(document.querySelector("h3").textContent).toBe("בדיקת מבצע");
    expect(document.querySelector("#gog-plus-gamepanel button").textContent).toBe("העתקת קישור נקי");
    expect(document.querySelector(".buy").textContent).toBe("Add to cart"); // the site's own
    expect(document.querySelector(".gog-plus-tag-chip").textContent).toBe("Backlog"); // the user's own
  });

  it("translates what the extension draws later, including text with numbers and amounts", async () => {
    state.settings = { ...window.GOG_PLUS_DEFAULTS, uiLanguage: "de" };
    window.GOGPlusUiI18n.init();
    const el = document.createElement("div");
    el.className = "gog-plus-bar";
    el.textContent = "Showing 5 of 48";
    document.body.appendChild(el);
    const p = document.createElement("p");
    p.className = "gog-plus-deal-line";
    p.textContent = "Advertised: −50% off the list price of $49.99";
    document.body.appendChild(p);
    await tick();
    expect(el.textContent).toBe("5 von 48 angezeigt");
    expect(p.textContent).toBe("Beworben: −50% auf den Listenpreis von $49.99");
  });

  it("does nothing in English", async () => {
    state.settings = { ...window.GOG_PLUS_DEFAULTS, uiLanguage: "en" };
    document.body.innerHTML = '<div class="gog-plus-x">Deal check</div>';
    window.GOGPlusUiI18n.init();
    await tick();
    expect(document.querySelector(".gog-plus-x").textContent).toBe("Deal check");
  });

  it("tx() translates one string, and leaves an unknown one as it is", () => {
    state.settings = { ...window.GOG_PLUS_DEFAULTS, uiLanguage: "fr" };
    expect(window.GOGPlusUiI18n.tx("Wait for a sale")).toBe("Attendre une promo");
    expect(window.GOGPlusUiI18n.tx("Some string with no row")).toBe("Some string with no row");
  });
});
