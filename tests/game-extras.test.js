import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { resetEnv, getLocal, tick, state } from "./helpers/content-env.js";
import { gamePageHtml } from "./helpers/fixtures.js";

const X = () => window.GOGPlusGameExtras;
const SLUG = "the_witcher_3";
const text = (el) => el?.textContent.replace(/\s+/g, " ").trim();

beforeEach(() => {
  resetEnv({ path: `/en/game/${SLUG}`, bodyClass: "productcard _prices-in-usd user-logged-in", settings: { targetCurrency: "ILS", taxEstimator: true, vatPercent: 18 } });
  state.settings.rates = { ILS: 4, EUR: 0.5 };
  document.body.innerHTML = gamePageHtml();
});
afterEach(() => vi.useRealTimers());

describe("Deal check", () => {
  it("compares the advertised discount with GOG's own 30-day low — the real Witcher 3 reading", () => {
    const s = X().renderDealSection(SLUG);
    const t = text(s);
    expect(t).toContain("Advertised: −50% off the list price of $49.99.");
    expect(t).toContain("≈ The same as the lowest price of the last 30 days ($24.99) — not cheaper than it was recently.");
    expect(t).toContain("the real saving is 0%");
    expect(s.querySelector(".is-ok")).not.toBeNull();
  });

  it("praises a price that beats the 30-day low and flags one above it", () => {
    document.body.innerHTML = gamePageHtml({ base: "20.00", final: "10.00", lowest: "20.00" });
    expect(text(X().renderDealSection(SLUG))).toContain("✓ Cheaper than the lowest price of the last 30 days ($20.00) — a real 50% drop.");
    document.body.innerHTML = gamePageHtml({ base: "20.00", final: "15.00", lowest: "10.00" });
    const s = X().renderDealSection(SLUG);
    expect(text(s)).toContain("✗ Higher than the 30-day low of $10.00.");
    expect(s.querySelector(".is-bad")).not.toBeNull();
  });

  it("only repeats the advertised discount without the 30-day figure, and shows nothing for an undiscounted game with no extras", () => {
    document.body.innerHTML = gamePageHtml({ lowest: null, promo: null, hours: [] });
    state.settings.currencyTable = false;
    const t = text(X().renderDealSection(SLUG));
    expect(t).toContain("Advertised: −50%");
    expect(t).not.toContain("30 days");
    document.body.innerHTML = gamePageHtml({ base: null, lowest: null, promo: null, hours: [] });
    expect(X().renderDealSection(SLUG)).toBeNull();
  });

  it("reports where the price sits against the user's own tracked history", () => {
    state.settings.priceHistory = { [SLUG]: [{ d: "2026-01-01", p: 30, c: "USD" }, { d: "2026-02-01", p: 20, c: "USD" }] };
    expect(text(X().renderDealSection(SLUG))).toContain("Your tracked low is $20.00 — this is 24.9% above it.");
    state.settings.priceHistory = { [SLUG]: [{ d: "2026-01-01", p: 30, c: "USD" }, { d: "2026-02-01", p: 25, c: "USD" }] };
    const s = X().renderDealSection(SLUG);
    expect(text(s)).toContain("✓ At your tracked low ($24.99, 2 snapshots).");
  });

  it("shows the offer countdown, tiered by urgency, and keeps it ticking", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T12:00:00Z")); // ~21h before 2026-10-07 06:59:59Z
    const s = X().renderDealSection(SLUG);
    const timer = s.querySelector(".gog-plus-deal-timer");
    expect(timer.className).toContain("is-urgent");
    expect(timer.textContent).toMatch(/^⏳ Offer ends in 18h/);
    document.body.appendChild(s);
    vi.advanceTimersByTime(60 * 1000);
    expect(timer.textContent).toMatch(/Offer ends in 18h \d+m|Offer ends in 17h/);
    vi.setSystemTime(new Date("2026-10-08T00:00:00Z"));
    vi.advanceTimersByTime(60 * 1000);
    expect(timer.className).toBe("gog-plus-deal-timer is-ended");
    expect(timer.querySelector("strong").textContent).toBe("ended");
  });

  it("shows a calm 'soon' tier a few days out and nothing once the offer has ended", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
    expect(X().renderDealSection(SLUG).querySelector(".gog-plus-deal-timer").className).toContain("is-soon");
    vi.setSystemTime(new Date("2026-10-09T00:00:00Z"));
    expect(X().renderDealSection(SLUG).querySelector(".gog-plus-deal-timer")).toBeNull();
  });

  it("stops the countdown's interval once the panel is gone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
    const clear = vi.spyOn(globalThis, "clearInterval");
    X().renderDealSection(SLUG); // never attached to the document
    vi.advanceTimersByTime(60 * 1000);
    expect(clear).toHaveBeenCalled();
  });

  it("works out the price per hour from GOG's own time-to-beat figures", () => {
    const t = text(X().renderDealSection(SLUG));
    expect(t).toContain("Per hour of play: $0.23 (Main, 108 h) · $0.16 (Main + Sides, 154.5 h) · $0.12 (Completionist, 213.5 h)");
  });

  it("falls back to the cached time-to-beat when the section isn't on the page", () => {
    document.body.innerHTML = gamePageHtml({ hours: [] });
    state.settings.gameFacts = { [SLUG]: { hours: { Main: "50 h" } } };
    expect(text(X().renderDealSection(SLUG))).toContain("$0.50 (Main, 50 h)");
  });

  it("lists the price in other currencies, with VAT only on the user's own", () => {
    const details = X().renderDealSection(SLUG).querySelector("details.gog-plus-currencies");
    const rows = [...details.querySelectorAll("tr")].map((r) => [...r.children].map((c) => c.textContent).join(" "));
    expect(rows).toContain("ILS ₪118 incl. 18% VAT"); // 24.99 × 4 × 1.18
    expect(rows.some((r) => /^EUR €12\.(49|50)$/.test(r))).toBe(true);
    expect(rows.some((r) => r.startsWith("USD"))).toBe(false); // the page's own currency is skipped
  });

  it("explains a game's sale rhythm from the visits it has recorded", () => {
    state.settings.priceHistory = {
      [SLUG]: [
        { d: "2026-01-01", p: 40, c: "USD", b: 40 },
        { d: "2026-01-10", p: 20, c: "USD", b: 40 },
        { d: "2026-02-01", p: 40, c: "USD", b: 40 },
        { d: "2026-03-10", p: 20, c: "USD", b: 40 },
        { d: "2026-04-01", p: 40, c: "USD", b: 40 },
        { d: "2026-05-09", p: 20, c: "USD", b: 40 },
      ],
    };
    const t = text(X().renderDealSection(SLUG));
    expect(t).toContain("On sale 3× in your tracked history, typically −50%, roughly every 59 days.");
    expect(t).toMatch(/Next one around .*2026 — a rough guess from your own visits\./);
  });

  it("says so when a tracked game has never been seen on sale", () => {
    state.settings.priceHistory = { [SLUG]: [{ d: "2026-01-01", p: 30, c: "USD" }, { d: "2026-02-01", p: 30, c: "USD" }] };
    expect(text(X().renderDealSection(SLUG))).toContain("No sale seen yet");
  });

  it("is skipped when every deal feature is off, or the page has no price", () => {
    for (const k of ["realDiscountCheck", "offerTimer", "pricePerHour", "currencyTable", "saleForecast"]) state.settings[k] = false;
    expect(X().renderDealSection(SLUG)).toBeNull();
    resetEnv({ path: `/en/game/${SLUG}`, bodyClass: "_prices-in-usd" });
    document.body.innerHTML = "<h1>x</h1>";
    expect(X().renderDealSection(SLUG)).toBeNull();
  });

  it("honours each toggle independently", () => {
    state.settings.offerTimer = false;
    state.settings.currencyTable = false;
    state.settings.pricePerHour = false;
    const s = X().renderDealSection(SLUG);
    expect(s.querySelector(".gog-plus-deal-timer")).toBeNull();
    expect(s.querySelector("details")).toBeNull();
    expect(text(s)).not.toContain("Per hour");
  });
});

describe("At a glance", () => {
  it("shows whether the user's language is supported, text and audio", () => {
    state.settings.preferredLanguages = ["Hebrew", "English"];
    document.body.innerHTML = gamePageHtml({ languages: [["English", true, true], ["Hebrew", false, true]] });
    const chips = [...X().renderFactsSection(SLUG).querySelectorAll(".gog-plus-lang-chip")].map((c) => [c.textContent, c.className]);
    expect(chips[0]).toEqual(["Hebrew: text ✓", "gog-plus-lang-chip is-yes"]);
    expect(chips[1][0]).toBe("English: text + audio ✓");
    expect(text(X().renderFactsSection(SLUG))).toContain("2 in total");
  });

  it("flags a missing language, defaulting to the UI language", () => {
    state.settings.uiLanguage = "he";
    document.body.innerHTML = gamePageHtml();
    const chip = X().renderFactsSection(SLUG).querySelector(".gog-plus-lang-chip");
    expect(chip.textContent).toBe("Hebrew: not supported");
    expect(chip.classList.contains("is-no")).toBe(true);
  });

  it("matches a language by its localised name and uses the cache when the table is not on the page", () => {
    state.settings.uiLanguage = "de";
    state.settings.gameFacts = { [SLUG]: { langs: { Deutsch: { a: false, t: true } } } };
    document.body.innerHTML = gamePageHtml({ languages: [] });
    expect(text(X().renderFactsSection(SLUG).querySelector(".gog-plus-lang-chip"))).toBe("German: text ✓");
  });

  it("summarises the reception", () => {
    document.body.innerHTML = gamePageHtml();
    expect(text(X().renderFactsSection(SLUG))).toContain("Reception: 4.8/5 from 2,848 user reviews · 95% of critics recommend");
  });

  it("lists what changed since the last visit, or says nothing did", () => {
    state.settings.gameFacts = { [SLUG]: { price: { p: 20, b: null, l: null, c: "USD" }, prev: { t: Date.parse("2026-09-20T00:00:00Z"), price: { p: 30, b: null, l: null, c: "USD" }, rating: null, criticsPct: null } } };
    const s = X().renderFactsSection(SLUG);
    expect(text(s)).toContain("Since your visit on");
    expect(s.querySelector(".gog-plus-changes li").textContent).toBe("Price dropped from 30.00 to 20.00 USD");
    state.settings.gameFacts = { [SLUG]: { price: { p: 20, b: null, l: null, c: "USD" }, prev: { t: 1, price: { p: 20, b: null, l: null, c: "USD" }, rating: null, criticsPct: null } } };
    expect(text(X().renderFactsSection(SLUG))).toContain("Nothing has changed since your visit");
  });

  it("is hidden when both features are off or there is nothing to say", () => {
    state.settings.languageMeter = false;
    state.settings.changesSinceVisit = false;
    expect(X().renderFactsSection(SLUG)).toBeNull();
    state.settings.languageMeter = true;
    document.body.innerHTML = "<h1>x</h1>";
    expect(X().renderFactsSection(SLUG)).toBeNull();
  });
});

describe("Your library", () => {
  it("says when the game is already owned", () => {
    document.body.innerHTML = gamePageHtml({ owned: true });
    expect(text(X().renderLibrarySection(SLUG))).toContain("✓ This game is already in your library.");
    document.body.innerHTML = gamePageHtml();
    state.settings.ownedSlugs = { [SLUG]: "2026-01-01" };
    expect(text(X().renderLibrarySection(SLUG))).toContain("already in your library");
  });

  it("warns when a pack overlaps with games already owned", () => {
    state.settings.ownedSlugs = { one: "x", two: "x" };
    state.settings.gameFacts = { one: { title: "One" } };
    document.body.innerHTML = gamePageHtml() + '<section><h3>This pack includes</h3><a href="/en/game/one">1</a><a href="/en/game/two">2</a><a href="/en/game/three">3</a></section>';
    const s = X().renderLibrarySection(SLUG);
    expect(text(s)).toContain("⚠ You already own 2 of the 3 games in this pack: One, Two.");
    expect(s.querySelector(".is-bad")).not.toBeNull();
  });

  it("links to similar games the user owns, via shared tags", () => {
    state.settings.ownedSlugs = { hades: "x", doom: "x" };
    state.settings.gameFacts = { [SLUG]: { tags: ["rpg", "fantasy"] }, hades: { title: "Hades", tags: ["rpg", "fantasy"] }, doom: { tags: ["fps"] } };
    const a = X().renderLibrarySection(SLUG).querySelector(".gog-plus-similar-link");
    expect(a.textContent).toBe("Hades");
    expect(a.getAttribute("href")).toBe("/en/game/hades");
    expect(a.title).toBe("Shared tags: rpg, fantasy");
  });

  it("offers GOG's own tags as one-click suggestions and adds one", async () => {
    document.body.innerHTML = gamePageHtml();
    state.settings.tags = { [SLUG]: ["adventure"] }; // already applied (case-insensitive)
    const s = X().renderLibrarySection(SLUG);
    const chips = [...s.querySelectorAll(".gog-plus-suggest-chip")];
    expect(chips.map((c) => c.textContent)).toEqual(["+ Fantasy", "+ Story Rich"]);
    chips[0].click();
    await tick(5);
    expect((await getLocal("tags")).tags[SLUG]).toEqual(["Fantasy"]);
    expect(chips[0].isConnected).toBe(false);
  });

  it("is hidden when it has nothing to say, and respects its toggles", () => {
    document.body.innerHTML = "<h1>x</h1>";
    state.settings.customTags = false;
    state.settings.similarOwned = false;
    expect(X().renderLibrarySection(SLUG)).toBeNull();
  });
});

describe("Compare & look up", () => {
  it("offers link-only buttons that open in a new tab without a referrer", () => {
    const s = X().renderLinksSection(SLUG);
    const links = [...s.querySelectorAll("a")];
    expect(links.map((a) => a.textContent)).toContain("Steam →");
    expect(links.every((a) => a.target === "_blank" && a.rel.includes("noopener") && a.href.startsWith("https://"))).toBe(true);
    expect(links[0].href).toContain(encodeURIComponent("The Witcher 3: Wild Hunt"));
  });
});
