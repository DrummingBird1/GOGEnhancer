import { describe, it, expect, beforeEach, afterEach } from "vitest";

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
const { ensureGamePagePanel } = window.GOGPlusGamePage;

const REQS = `
  <h1>Cool Game</h1>
  <section>System requirements
    <div>Minimum</div><div>Memory: 4 GB RAM</div>
    <div>Recommended</div><div>Memory: 16 GB RAM</div>
  </section>`;

function setMemory(value) {
  Object.defineProperty(navigator, "deviceMemory", { value, configurable: true });
}

const rows = () => [...document.querySelectorAll(".gog-plus-sysreq-row")].map((r) => r.textContent);
const section = () => [...document.querySelectorAll(".gog-plus-gp-section")].find((s) => s.querySelector(".gog-plus-sysreq-row"));

beforeEach(() => {
  globalThis.__resetChromeStores();
  window.history.replaceState({}, "", "/en/game/cool_game");
  document.body.innerHTML = `<main>${REQS}</main>`;
  state.settings = {
    ...window.GOG_PLUS_DEFAULTS,
    priceHistoryTracking: false,
    priceCompareTable: false,
    refundTimer: false,
    itadCompare: false,
    customTags: false,
    sysReqCheck: true,
  };
  setMemory(8);
});
afterEach(() => {
  delete navigator.deviceMemory;
  window.history.replaceState({}, "", "/");
});

describe("system check section in the game panel", () => {
  it("compares the page's RAM requirements with the browser's reported memory", async () => {
    await ensureGamePagePanel("cool_game");
    expect(rows()).toEqual([
      "Minimum: 4 GB — ✓ this device meets it",
      "Recommended: 16 GB — ? can't tell from the browser",
    ]);
    expect(section().textContent).toContain("RAM only");
    expect(section().textContent).toContain("reports at least 8 GB");
  });

  it("treats modern browsers that report more than 8 GB as a floor, not a cap-free exact figure", async () => {
    setMemory(32);
    await ensureGamePagePanel("cool_game");
    expect(rows()).toEqual([
      "Minimum: 4 GB — ✓ this device meets it",
      "Recommended: 16 GB — ✓ this device meets it",
    ]);
    expect(section().textContent).toContain("reports at least 32 GB");
  });

  it("flags a requirement the device can't meet", async () => {
    setMemory(2);
    await ensureGamePagePanel("cool_game");
    expect(rows()[0]).toContain("✗ this device falls short");
    expect(section().querySelector(".is-below")).not.toBeNull();
    expect(section().textContent).toContain("about 2 GB");
  });

  it("says so when the browser doesn't report memory at all", async () => {
    delete navigator.deviceMemory;
    await ensureGamePagePanel("cool_game");
    expect(rows()[0]).toContain("can't tell");
    expect(section().textContent).toContain("doesn't report how much memory");
  });

  it("is absent when turned off", async () => {
    state.settings.sysReqCheck = false;
    await ensureGamePagePanel("cool_game");
    expect(section()).toBeUndefined();
    expect(document.getElementById("gog-plus-gamepanel")).not.toBeNull();
  });

  it("is absent when the page has no parsable requirements", async () => {
    document.body.innerHTML = `<main><h1>Cool Game</h1><p>No specs here.</p></main>`;
    await ensureGamePagePanel("cool_game");
    expect(section()).toBeUndefined();
  });

  it("still mounts the panel on a page whose title isn't an h1 (falls back to <main>)", async () => {
    document.body.innerHTML = `<main><div>${REQS.replace("<h1>Cool Game</h1>", "")}</div></main>`;
    await ensureGamePagePanel("cool_game");
    expect(document.getElementById("gog-plus-gamepanel")).not.toBeNull();
    expect(rows()).toHaveLength(2);
  });
});
