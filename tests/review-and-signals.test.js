import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetEnv, getLocal, tick, state } from "./helpers/content-env.js";
import { gamePageHtml } from "./helpers/fixtures.js";

const R = () => window.GOGPlusReviewTools;
const S = () => window.GOGPlusSiteSignals;
const REVIEWS = [
  { stars: 5, verified: true },
  { stars: 4, verified: false },
  { stars: 2, verified: true },
  { stars: 1, verified: false },
  { stars: 3, verified: true },
];
const hiddenCount = () => document.querySelectorAll(".gog-plus-review-hidden").length;
const starBtn = (v) => document.querySelector(`#gog-plus-reviewbar button[data-stars="${v}"]`);

describe("review filter", () => {
  beforeEach(() => {
    resetEnv({ path: "/en/game/x", bodyClass: "productcard" });
    document.body.innerHTML = gamePageHtml({ reviews: REVIEWS });
    R().applyReviewFilter();
  });

  it("mounts above the first review, once", () => {
    R().applyReviewFilter();
    expect(document.querySelectorAll("#gog-plus-reviewbar")).toHaveLength(1);
    expect(document.querySelector(".reviews__main-col").firstElementChild.id).toBe("gog-plus-reviewbar");
    expect(document.getElementById("gog-plus-review-status").textContent).toBe("Showing 5 of 5 loaded · average 3.0★");
  });

  it("shows only reviews with the chosen number of stars", () => {
    starBtn("5").click();
    expect(hiddenCount()).toBe(4);
    expect(starBtn("5").getAttribute("aria-pressed")).toBe("true");
    expect(starBtn("all").getAttribute("aria-pressed")).toBe("false");
    expect(document.getElementById("gog-plus-review-status").textContent).toBe("Showing 1 of 5 loaded · average 5.0★");
    starBtn("low").click();
    expect(hiddenCount()).toBe(3); // 2★ and 1★ stay
    starBtn("all").click();
    expect(hiddenCount()).toBe(0);
  });

  it("can restrict to verified owners, combined with stars", () => {
    const box = document.getElementById("gog-plus-review-verified");
    box.checked = true;
    box.dispatchEvent(new Event("change"));
    expect(hiddenCount()).toBe(2);
    starBtn("3").click();
    expect(hiddenCount()).toBe(4);
    expect(document.getElementById("gog-plus-review-status").textContent).toContain("Showing 1 of 5");
  });

  it("says when nothing matches", () => {
    starBtn("5").click();
    const box = document.getElementById("gog-plus-review-verified");
    box.checked = true;
    box.dispatchEvent(new Event("change"));
    starBtn("4").click();
    expect(document.getElementById("gog-plus-review-status").textContent).toBe("Showing 0 of 5 loaded");
  });

  it("re-applies to reviews the site loads later", () => {
    starBtn("5").click();
    document.querySelector(".reviews__main-col").insertAdjacentHTML("beforeend", '<article class="review__item"><span class="review__stars"><span class="rati__star is-full"></span></span></article>');
    R().applyReviewFilter();
    expect(hiddenCount()).toBe(5); // the new 1★ review is hidden by the 5★ filter
  });

  it("goes away off game pages and when switched off", () => {
    state.settings.reviewTools = false;
    R().applyReviewFilter();
    expect(document.getElementById("gog-plus-reviewbar")).toBeNull();
    expect(hiddenCount()).toBe(0);
    state.settings.reviewTools = true;
    R().applyReviewFilter();
    window.history.replaceState({}, "", "/en/games");
    R().applyReviewFilter();
    expect(document.getElementById("gog-plus-reviewbar")).toBeNull();
  });

  it("does nothing on a page without reviews", () => {
    document.body.innerHTML = gamePageHtml();
    R().applyReviewFilter();
    expect(document.getElementById("gog-plus-reviewbar")).toBeNull();
  });
});

describe("sale radar", () => {
  beforeEach(() => {
    resetEnv({ path: "/en", settings: { seasonRadar: true } });
    vi.spyOn(chrome.runtime, "sendMessage").mockImplementation(() => {});
    chrome.runtime.sendMessage.mockClear();
    document.body.innerHTML = "<h2>8000+ deals up to -95%</h2>";
  });

  it("reports a store-wide sale headline once", () => {
    S().reportSaleBanner();
    S().reportSaleBanner();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: "sale-radar", text: "8000+ deals up to -95%" });
  });

  it("stays quiet when off, off the home page, or without a banner", () => {
    state.settings.seasonRadar = false;
    S().reportSaleBanner();
    state.settings.seasonRadar = true;
    window.history.replaceState({}, "", "/en/games");
    S().reportSaleBanner();
    window.history.replaceState({}, "", "/en");
    document.body.innerHTML = "<h2>New releases</h2>";
    S().reportSaleBanner();
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it("swallows a failure to reach the extension", () => {
    chrome.runtime.sendMessage.mockImplementation(() => {
      throw new Error("Extension context invalidated");
    });
    document.body.innerHTML = "<h2>Winter Sale</h2>";
    expect(() => S().reportSaleBanner()).not.toThrow();
  });
});

describe("share links", () => {
  async function linkFor(pack) {
    return window.GOGPlusPack.encodeShare(window.GOGPlusPack.buildPack(pack, "Friend's RPGs"));
  }
  const src = { slugs: ["a", "b"], tags: { a: ["rpg"], b: ["rpg", "co-op"] }, notes: { a: "private" }, purchaseLog: {}, tagColors: { rpg: "#ff0000" } };

  beforeEach(() => resetEnv({ path: "/en/games" }));

  it("asks before importing, then merges tags without touching what the user has", async () => {
    state.settings.tags = { a: ["mine"] };
    await window.GOGPlusStorage.set({ tags: { a: ["mine"] }, tagColors: { rpg: "#00ff00" } });
    window.location.hash = `#gogplus-pack=${await linkFor(src)}`;
    await S().checkPackLink();
    const overlay = document.querySelector(".gog-plus-modal-overlay");
    expect(overlay.textContent).toContain("Friend's RPGs");
    expect(overlay.textContent).toContain("2 tags on 2 games");
    expect(window.location.hash).toBe(""); // taken out of the address bar
    expect(await getLocal("tags")).toEqual({ tags: { a: ["mine"] } }); // nothing imported yet
    [...overlay.querySelectorAll("button")].find((b) => b.textContent === "Import").click();
    await tick(10);
    const { tags, tagColors } = await window.GOGPlusStorage.get(["tags", "tagColors"]);
    expect(tags).toEqual({ a: ["mine", "rpg"], b: ["rpg", "co-op"] });
    expect(tagColors).toEqual({ rpg: "#00ff00" }); // an existing colour is kept
    expect(document.querySelector(".gog-plus-toast").textContent).toContain("Imported 3 tags");
    expect(document.querySelector(".gog-plus-modal-overlay")).toBeNull();
    expect(JSON.stringify(tags)).not.toContain("private");
  });

  it("does nothing if the user declines", async () => {
    window.location.hash = `#gogplus-pack=${await linkFor(src)}`;
    await S().checkPackLink();
    [...document.querySelectorAll(".gog-plus-modal-overlay button")].find((b) => b.textContent === "No thanks").click();
    await tick(5);
    expect(await getLocal("tags")).toEqual({});
    expect(document.querySelector(".gog-plus-modal-overlay")).toBeNull();
  });

  it("does not stack a second prompt while one is open", async () => {
    const hash = `#gogplus-pack=${await linkFor(src)}`;
    window.location.hash = hash;
    await S().checkPackLink();
    window.location.hash = hash;
    await S().checkPackLink();
    expect(document.querySelectorAll(".gog-plus-modal-overlay")).toHaveLength(1);
  });

  it("reports a damaged link instead of importing anything", async () => {
    window.location.hash = "#gogplus-pack=j.@@@";
    await S().checkPackLink();
    expect(document.querySelector(".gog-plus-modal-overlay")).toBeNull();
    expect(document.querySelector(".gog-plus-toast").textContent).toMatch(/damaged/);
  });

  it("says when a shared pack has no tags, and ignores unrelated hashes", async () => {
    window.location.hash = `#gogplus-pack=${await linkFor({ ...src, tags: {} })}`;
    await S().checkPackLink();
    expect(document.querySelector(".gog-plus-toast").textContent).toContain("no tags");
    window.location.hash = "#something-else";
    await S().checkPackLink();
    expect(window.location.hash).toBe("#something-else");
  });
});
