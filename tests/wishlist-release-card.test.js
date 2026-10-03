import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetEnv, tick, state } from "./helpers/content-env.js";
import { wishlistPageHtml } from "./helpers/fixtures.js";

const Ics = () => window.GOGPlusIcs;
const Tools = () => window.GOGPlusWishlistTools;
const Card = () => window.GOGPlusShareCard;
const W = () => window.GOGPlusWishlistFeature;

const NOW = Date.parse("2026-10-03T12:00:00Z");
const row = (slug, extra = {}) => ({ slug, title: slug, price: null, currency: null, discountPct: 0, owned: false, tba: false, free: false, ...extra });

describe("buildReleaseCalendar", () => {
  it("writes an all-day event on each upcoming release date, with a reminder the morning before", () => {
    const ics = Ics().buildReleaseCalendar([{ slug: "big_game", title: "Big Game, Part 2", date: "2026-11-05" }], { now: NOW });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261105");
    expect(ics).toContain("DTEND;VALUE=DATE:20261106");
    expect(ics).toContain("SUMMARY:Out on GOG: Big Game\\, Part 2");
    expect(ics).toContain("UID:release-big_game-2026-11-05@gog-enhancer");
    expect(ics).toContain("TRIGGER:-PT15H");
    expect(ics).toContain("URL:https://www.gog.com/en/game/big_game");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });

  it("includes today, skips the past and malformed dates, and titles from the slug by default", () => {
    expect(Ics().buildReleaseCalendar([{ slug: "a", date: "2026-10-02" }, { slug: "b", date: "soon" }, { slug: "c", date: "" }, null], { now: NOW })).toBeNull();
    expect(Ics().buildReleaseCalendar([{ slug: "grim_fandango", date: "2026-10-03" }], { now: NOW })).toContain("Out on GOG: Grim Fandango");
    expect(Ics().buildReleaseCalendar([], { now: NOW })).toBeNull();
    expect(Ics().buildReleaseCalendar(undefined, { now: NOW })).toBeNull();
  });
});

describe("upcomingReleases", () => {
  const facts = {
    soon: { rd: "2026-10-20", title: "Soon!" },
    later: { rd: "2027-01-01" },
    out: { rd: "2020-01-01" },
    mine: { rd: "2026-12-12" },
    junk: { rd: "next year" },
  };
  const rows = [row("later", { title: "Later" }), row("soon", { title: "Soon row" }), row("out"), row("mine", { owned: true }), row("junk"), row("unknown"), row("soon")];

  it("lists only unowned games with a known future date, soonest first, once each", () => {
    expect(Tools().upcomingReleases(rows, facts, NOW)).toEqual([
      { slug: "soon", title: "Soon!", date: "2026-10-20" },
      { slug: "later", title: "Later", date: "2027-01-01" },
    ]);
  });

  it("counts a game releasing today", () => {
    expect(Tools().upcomingReleases([row("soon")], { soon: { rd: "2026-10-03" } }, NOW)).toHaveLength(1);
  });
});

describe("wishlistModel", () => {
  const ctx = { target: "USD", rates: {}, history: { cheap: [{ d: "2026-01-01", p: 9, c: "USD" }] } };
  const rows = [
    row("alpha", { title: "Alpha", price: 20, currency: "USD", discountPct: 50 }),
    row("cheap", { title: "Cheap", price: 9.5, currency: "USD", discountPct: 10 }),
    row("big", { title: "Big", price: 6, currency: "USD", discountPct: 80 }),
    row("owned", { title: "Owned", price: 5, currency: "USD", discountPct: 90, owned: true }),
    row("tba", { title: "TBA", tba: true }),
  ];

  it("summarises what is waiting, what it costs today and the best deals", () => {
    const m = Card().wishlistModel(rows, ctx, { upcoming: [{ title: "Soon", date: "2026-10-20" }] });
    expect(m.title).toBe("My GOG wishlist");
    expect(m.subtitle).toBe("4 games waiting"); // the owned one doesn't wait
    const byLabel = Object.fromEntries(m.stats.map((s) => [s.label, s.value]));
    expect(byLabel["on sale right now"]).toBe("3");
    expect(byLabel["to buy them all today"]).toBe("36 USD");
    expect(m.stats.some((s) => s.label === "saved by today's discounts")).toBe(true);
    const deals = m.lists.find((l) => l.title === "Biggest discounts");
    expect(deals.rows[0]).toEqual({ label: "Big", value: "-80% · 6 USD" });
    expect(deals.rows.map((r) => r.label)).not.toContain("Owned");
    expect(m.lists.find((l) => l.title === "Coming soon").rows).toEqual([{ label: "Soon", value: "2026-10-20" }]);
  });

  it("leaves out lists that would be empty and copes with an empty wishlist", () => {
    const m = Card().wishlistModel([], { target: "USD" });
    expect(m.subtitle).toBe("0 games waiting");
    expect(m.lists).toEqual([]);
    expect(m.stats[1].value).toBe("—");
    expect(Card().wishlistModel([row("one")], { target: "USD" }).subtitle).toBe("1 game waiting");
  });

  it("lays out as a card with its title and numbers", () => {
    const m = Card().wishlistModel(rows, ctx, {});
    const text = Card().layout(m).filter((o) => o.type === "text").map((o) => o.text);
    expect(text).toContain("My GOG wishlist");
    expect(text).toContain("36 USD");
  });
});

describe("the wishlist page's export buttons", () => {
  const ROWS = [
    { slug: "alpha", title: "Alpha", price: "20.00", discount: 50 },
    { slug: "beta", title: "Beta", price: "5.00" },
    { slug: "gamma", title: "Gamma", price: "8.00", discount: 75 },
  ];
  let created;
  let clicked;
  const bar = () => document.getElementById("gog-plus-wlfilters");
  const exportBtn = (kind) => bar().querySelector(`button[data-wl-export="${kind}"]`);

  beforeEach(() => {
    resetEnv({ path: "/en/account/wishlist", settings: { wishlistFilters: true, targetCurrency: "USD" } });
    [...document.body.children].forEach((c) => {
      if (!c.classList.contains("gog-plus-toasts")) c.remove();
    });
    document.body.insertAdjacentHTML("afterbegin", wishlistPageHtml(ROWS));
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

  it("offers a release-date calendar and a share card", () => {
    expect(exportBtn("releases").textContent).toBe("Release dates (.ics)");
    expect(exportBtn("png").textContent).toBe("Share card (PNG)");
  });

  it("saves the release dates it learned from game pages, and says how many games it has no date for", async () => {
    const day = new Date(Date.now() + 20 * 86400e3).toISOString().slice(0, 10);
    state.settings.gameFacts = { alpha: { title: "Alpha!", rd: day } };
    exportBtn("releases").click();
    await tick();
    expect(clicked[0]).toMatch(/^gog-wishlist-releases-\d{4}-\d{2}-\d{2}\.ics$/);
    const ics = await created[0].text();
    expect(ics).toContain("SUMMARY:Out on GOG: Alpha!");
    expect(document.querySelector(".gog-plus-toast").textContent).toContain("1 release saved — 2 games have no date yet");
  });

  it("explains itself when it has no dates", () => {
    exportBtn("releases").click();
    expect(created).toHaveLength(0);
    expect(document.querySelector(".gog-plus-toast").textContent).toContain("No upcoming release dates known");
  });

  it("downloads the share card as a PNG", async () => {
    const toPng = vi.spyOn(Card(), "toPng").mockResolvedValue(new Blob(["png"], { type: "image/png" }));
    exportBtn("png").click();
    await tick();
    expect(toPng).toHaveBeenCalledTimes(1);
    expect(toPng.mock.calls[0][0].title).toBe("My GOG wishlist");
    expect(clicked[0]).toMatch(/^gog-wishlist-\d{4}-\d{2}-\d{2}\.png$/);
    expect(created[0].type).toBe("image/png");
  });

  it("says so when the image can't be made", async () => {
    vi.spyOn(Card(), "toPng").mockRejectedValue(new Error("no canvas"));
    exportBtn("png").click();
    await tick();
    expect(document.querySelector(".gog-plus-toast").textContent).toContain("Couldn't make the image");
    expect(created).toHaveLength(0);
  });
});
