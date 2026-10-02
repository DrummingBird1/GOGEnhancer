import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// content.js boots itself on import, so every test gets a fresh module graph
// (and a fresh document) to boot against. Literal paths, in manifest order.
async function bootContent() {
  // The previous test's content.js is still attached to the shared document;
  // left alone it would keep reacting to this test's DOM changes too.
  window.GOGPlusContentState?.observers.forEach((o) => o.disconnect());
  globalThis.__resetChromeStores();
  globalThis.__chromeListeners.onMessage.length = 0;
  vi.resetModules();
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
  await import("../extension/content/native-theme.js");
  await import("../extension/content/state.js");
  await import("../extension/content/utils.js");
  await import("../extension/content/features/currency.js");
  await import("../extension/content/features/card-badges.js");
  await import("../extension/content/features/misc.js");
  await import("../extension/content/features/wishlist.js");
  await import("../extension/content/features/game-page.js");
  await import("../extension/content/features/keyboard-nav.js");
  await import("../extension/content/content.js");
  // Let boot's settings read resolve and run its first pass (a few promise
  // hops) — short of the 250ms debounce, so no second pass sneaks in.
  await vi.advanceTimersByTimeAsync(50);
}

const html = document.documentElement;
const setSync = (items) => new Promise((r) => chrome.storage.sync.set(items, r));
const themeClasses = () => [...html.classList].filter((c) => c.startsWith("gog-plus-theme--"));

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
  html.removeAttribute("style");
  html.className = "";
  window.history.replaceState({}, "", "/en/games");
});
afterEach(() => {
  // Detach this test's content.js from the shared document right away: once
  // the next test starts resetting the DOM, a still-attached observer would
  // schedule a debounced pass onto the NEW test's fake clock.
  window.GOGPlusContentState?.observers.forEach((o) => o.disconnect());
  vi.useRealTimers();
  window.history.replaceState({}, "", "/");
});

describe("diagnostics message", () => {
  it("answers 'gog-plus-diagnose' with the adapter's report and ignores other messages", async () => {
    document.body.innerHTML = `<main><a href="/en/game/a"><img src="a.png"></a></main>`;
    await bootContent();
    const listener = globalThis.__chromeListeners.onMessage[0];

    const respond = vi.fn();
    listener({ type: "gog-plus-diagnose" }, {}, respond);
    expect(respond).toHaveBeenCalledTimes(1);
    expect(respond.mock.calls[0][0]).toMatchObject({
      pageType: "store",
      path: "/en/games",
      cards: expect.objectContaining({ withImage: expect.any(Number) }),
    });

    const other = vi.fn();
    listener({ type: "something-else" }, {}, other);
    listener(undefined, {}, other);
    expect(other).not.toHaveBeenCalled();
  });
});

describe("native theme", () => {
  function paint(bg, text) {
    html.style.backgroundColor = bg;
    document.body.style.color = text;
  }

  it("samples the page on a dark site and writes the --gp-* tokens", async () => {
    paint("rgb(20, 20, 24)", "rgb(235, 235, 240)");
    await bootContent();
    await setSync({ theme: "native" });
    await vi.advanceTimersByTimeAsync(0);
    expect(themeClasses()).toEqual(["gog-plus-theme--native"]);
    expect(html.style.getPropertyValue("--gp-bg")).toBe("rgb(20, 20, 24)");
    expect(html.style.getPropertyValue("--gp-text")).toBe("rgb(235, 235, 240)");
  });

  it("adds the light base class on a light site", async () => {
    paint("rgb(250, 250, 250)", "rgb(20, 20, 20)");
    await bootContent();
    await setSync({ theme: "native" });
    await vi.advanceTimersByTimeAsync(0);
    expect(themeClasses().sort()).toEqual(["gog-plus-theme--light", "gog-plus-theme--native"]);
  });

  it("falls back quietly when the page can't be sampled", async () => {
    await bootContent();
    await setSync({ theme: "native" });
    await vi.advanceTimersByTimeAsync(0);
    expect(themeClasses()).toEqual(["gog-plus-theme--native"]);
    expect(html.style.getPropertyValue("--gp-bg")).toBe("");
  });

  it("switching away clears the sampled tokens; custom colours still apply and clear too", async () => {
    paint("rgb(20, 20, 24)", "rgb(235, 235, 240)");
    await bootContent();
    await setSync({ theme: "native" });
    await vi.advanceTimersByTimeAsync(0);
    expect(html.style.getPropertyValue("--gp-text")).not.toBe("");

    await setSync({ customThemeColors: { magenta: "#111111", cyan: "#222222", bg: "#333333" } });
    await setSync({ theme: "custom" });
    await vi.advanceTimersByTimeAsync(0);
    expect(themeClasses()).toEqual(["gog-plus-theme--custom"]);
    expect(html.style.getPropertyValue("--gp-magenta")).toBe("#111111");
    expect(html.style.getPropertyValue("--gp-text")).toBe(""); // native's tokens are gone

    await setSync({ theme: "neon" });
    await vi.advanceTimersByTimeAsync(0);
    expect(themeClasses()).toEqual(["gog-plus-theme--neon"]);
    expect(html.style.getPropertyValue("--gp-magenta")).toBe("");
  });
});

describe("client-side navigation", () => {
  it("removes the previous game's panel when the route changes to another page", async () => {
    window.history.replaceState({}, "", "/en/game/old_game");
    document.body.innerHTML = `<main><aside id="gog-plus-gamepanel" data-slug="old_game"></aside></main>`;
    await bootContent();
    expect(document.getElementById("gog-plus-gamepanel")).not.toBeNull();

    window.history.pushState({}, "", "/en/games");
    await vi.advanceTimersByTimeAsync(1100);
    expect(document.getElementById("gog-plus-gamepanel")).toBeNull();
  });

  it("keeps the panel when the route changes to the same game (e.g. a query string)", async () => {
    window.history.replaceState({}, "", "/en/game/old_game");
    document.body.innerHTML = `<main><aside id="gog-plus-gamepanel" data-slug="old_game"></aside></main>`;
    await bootContent();
    window.history.pushState({}, "", "/en/game/old_game?pp=abc");
    await vi.advanceTimersByTimeAsync(1100);
    expect(document.getElementById("gog-plus-gamepanel")).not.toBeNull();
  });

  it("removes the wishlist filter bar when leaving the wishlist", async () => {
    window.history.replaceState({}, "", "/en/account/wishlist");
    document.body.innerHTML = `<main><div id="gog-plus-wlfilters"></div></main>`;
    await bootContent();
    window.history.pushState({}, "", "/en/games");
    await vi.advanceTimersByTimeAsync(1100);
    expect(document.getElementById("gog-plus-wlfilters")).toBeNull();
  });
});

describe("mutation observer", () => {
  // detect() runs once per processAll pass, so its call count is a direct
  // measure of how many passes the observer triggered.
  const passes = () => vi.spyOn(window.GOGPlusCurrency, "detect");

  it("picks up <main> appearing after boot (the page rendered late)", async () => {
    await bootContent(); // no <main> yet
    const spy = passes();
    document.body.innerHTML = `<main id="late"><a href="/en/game/a"><img src="a.png"></a></main>`;
    await vi.advanceTimersByTimeAsync(400);
    expect(spy).toHaveBeenCalled();
  });

  it("keeps reacting after the app swaps <main> for a new node", async () => {
    document.body.innerHTML = `<main id="first"></main>`;
    await bootContent();
    const spy = passes();

    document.body.innerHTML = `<main id="second"></main>`;
    await vi.advanceTimersByTimeAsync(400);
    expect(spy).toHaveBeenCalledTimes(1);

    document.getElementById("second").appendChild(document.createElement("div"));
    await vi.advanceTimersByTimeAsync(400);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("reacts to changes inside <main>", async () => {
    document.body.innerHTML = `<header id="h"></header><main id="m"></main>`;
    await bootContent();
    const spy = passes();
    document.getElementById("m").appendChild(document.createElement("section"));
    await vi.advanceTimersByTimeAsync(400);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("ignores header churn outside <main> (e.g. a ticking countdown)", async () => {
    document.body.innerHTML = `<header id="h"><span id="tick"></span></header><main id="m"></main>`;
    await bootContent();
    const spy = passes();
    for (let i = 0; i < 5; i++) {
      document.getElementById("tick").textContent = `00:0${i}`;
      await vi.advanceTimersByTimeAsync(400);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("treats everything as relevant when the page has no <main> at all", async () => {
    document.body.innerHTML = `<div id="x"></div>`;
    await bootContent();
    const spy = passes();
    document.getElementById("x").appendChild(document.createElement("span"));
    await vi.advanceTimersByTimeAsync(400);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
