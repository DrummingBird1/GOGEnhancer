import { describe, it, expect } from "vitest";

await import("../extension/lib/ics.js");

const Ics = window.GOGPlusIcs;
const NOW = Date.parse("2026-10-02T12:00:00Z");

describe("escapeText", () => {
  it("escapes backslash, semicolon, comma and newlines per RFC 5545", () => {
    expect(Ics.escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    expect(Ics.escapeText("plain")).toBe("plain");
  });
});

describe("fold", () => {
  it("leaves short lines alone", () => {
    expect(Ics.fold("SUMMARY:short")).toBe("SUMMARY:short");
  });

  it("folds long lines at 75 octets with a leading space on continuations", () => {
    const line = "DESCRIPTION:" + "x".repeat(200);
    const folded = Ics.fold(line);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(2);
    expect(new TextEncoder().encode(parts[0]).length).toBeLessThanOrEqual(75);
    for (const p of parts.slice(1)) {
      expect(p.startsWith(" ")).toBe(true);
      expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
    }
    // Unfolding restores the original exactly.
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });

  it("never splits a multi-byte character across lines", () => {
    const line = "SUMMARY:" + "עברית".repeat(30);
    const folded = Ics.fold(line);
    for (const p of folded.split("\r\n")) {
      expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
    }
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
});

describe("buildRefundCalendar", () => {
  it("builds one all-day event on the day the 30-day window closes", () => {
    const ics = Ics.buildRefundCalendar({ cool_game: { date: "2026-09-20" } }, { now: NOW });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("UID:refund-cool_game@gog-enhancer");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261020"); // 2026-09-20 + 30 days
    expect(ics).toContain("DTEND;VALUE=DATE:20261021");
    expect(ics).toContain("SUMMARY:GOG refund window closes: Cool Game");
    expect(ics).toContain("DTSTAMP:20261002T120000Z");
    expect(ics).toContain("https://www.gog.com/en/game/cool_game");
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics.split("BEGIN:VEVENT")).toHaveLength(2);
  });

  it("accepts the legacy bare-string purchase shape", () => {
    const ics = Ics.buildRefundCalendar({ old_game: "2026-09-25" }, { now: NOW });
    expect(ics).toContain("DTSTART;VALUE=DATE:20261025");
  });

  it("skips windows that already closed, but keeps one that closes today", () => {
    const ics = Ics.buildRefundCalendar(
      { closed: { date: "2026-08-01" }, today: { date: "2026-09-02" }, open: { date: "2026-09-30" } },
      { now: NOW }
    );
    expect(ics).not.toContain("refund-closed@");
    expect(ics).toContain("refund-today@"); // 2026-09-02 + 30d = 2026-10-02
    expect(ics).toContain("refund-open@");
  });

  it("returns null when there is nothing to put in the calendar", () => {
    expect(Ics.buildRefundCalendar({}, { now: NOW })).toBeNull();
    expect(Ics.buildRefundCalendar({ closed: { date: "2026-01-01" } }, { now: NOW })).toBeNull();
    expect(Ics.buildRefundCalendar(null, { now: NOW })).toBeNull();
  });

  it("ignores unparseable entries", () => {
    expect(Ics.buildRefundCalendar({ a: { date: "not a date" }, b: { nope: 1 }, c: "" }, { now: NOW })).toBeNull();
  });

  it("uses the supplied title function and escapes it", () => {
    const ics = Ics.buildRefundCalendar(
      { x: { date: "2026-09-30" } },
      { now: NOW, titleOf: () => "Half-Life, Part 2; Episode 1" }
    );
    expect(ics).toContain("SUMMARY:GOG refund window closes: Half-Life\\, Part 2\\; Episode 1");
  });

  it("honours a custom refund length and uses CRLF line endings throughout", () => {
    const ics = Ics.buildRefundCalendar({ g: { date: "2026-09-30" } }, { now: NOW, refundDays: 14 });
    expect(ics).toContain("DTSTART;VALUE=DATE:20261014");
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });
});

describe("buildOfferCalendar", () => {
  const now = Date.parse("2026-10-02T12:00:00Z");
  const end = Date.parse("2026-10-07T06:59:59Z");

  it("writes one timed event per running offer, with day-before and two-hours-before reminders", () => {
    const ics = Ics.buildOfferCalendar([{ slug: "the_witcher_3", title: "The Witcher 3, GOTY", endsAt: end }], { now });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART:20261007T065959Z");
    expect(ics).toContain("DTEND:20261007T071459Z");
    expect(ics).toContain("SUMMARY:GOG offer ends: The Witcher 3\\, GOTY");
    expect(ics).toContain("UID:offer-the_witcher_3-" + end + "@gog-enhancer");
    expect(ics).toContain("TRIGGER:-P1D");
    expect(ics).toContain("TRIGGER:-PT2H");
    expect(ics).toContain("URL:https://www.gog.com/en/game/the_witcher_3");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });

  it("skips offers that already ended or have no usable end, and titles from the slug by default", () => {
    expect(Ics.buildOfferCalendar([{ slug: "a", endsAt: now - 1 }, { slug: "b", endsAt: NaN }, null], { now })).toBeNull();
    expect(Ics.buildOfferCalendar([], { now })).toBeNull();
    expect(Ics.buildOfferCalendar(undefined, { now })).toBeNull();
    expect(Ics.buildOfferCalendar([{ slug: "grim_fandango", endsAt: end }], { now })).toContain("GOG offer ends: Grim Fandango");
    expect(Ics.buildOfferCalendar([{ slug: "x", endsAt: Date.now() + 3600e3 }])).toContain("BEGIN:VEVENT");
  });
});
