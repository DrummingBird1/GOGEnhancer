import { describe, it, expect } from "vitest";

await import("../extension/lib/notify-policy.js");

const N = window.GOGPlusNotifyPolicy;
const at = (h, m = 0) => new Date(2026, 9, 2, h, m);
const item = (o = {}) => ({ id: "a", kind: "price-alert", title: "Price alert — Game", message: "msg", t: 1, ...o });

describe("quiet hours", () => {
  it("parses clock times strictly", () => {
    expect(N.parseClock("08:30")).toBe(510);
    expect(N.parseClock("8:05")).toBe(485);
    expect(N.parseClock("24:00")).toBeNull();
    expect(N.parseClock("12:60")).toBeNull();
    expect(N.parseClock("noon")).toBeNull();
    expect(N.parseClock("")).toBeNull();
    expect(N.parseClock(undefined)).toBeNull();
  });

  it("handles a window that wraps midnight", () => {
    const q = { enabled: true, from: "22:00", to: "08:00" };
    expect(N.inQuietHours(at(23), q)).toBe(true);
    expect(N.inQuietHours(at(3), q)).toBe(true);
    expect(N.inQuietHours(at(7, 59), q)).toBe(true);
    expect(N.inQuietHours(at(8), q)).toBe(false);
    expect(N.inQuietHours(at(12), q)).toBe(false);
    expect(N.inQuietHours(at(22), q)).toBe(true);
    expect(N.inQuietHours(at(21, 59), q)).toBe(false);
  });

  it("handles a same-day window", () => {
    const q = { enabled: true, from: "13:00", to: "15:00" };
    expect(N.inQuietHours(at(14), q)).toBe(true);
    expect(N.inQuietHours(at(15), q)).toBe(false);
    expect(N.inQuietHours(at(12, 59), q)).toBe(false);
  });

  it("is never quiet when disabled, empty or invalid", () => {
    expect(N.inQuietHours(at(23), { enabled: false, from: "22:00", to: "08:00" })).toBe(false);
    expect(N.inQuietHours(at(23), { enabled: true, from: "22:00", to: "22:00" })).toBe(false);
    expect(N.inQuietHours(at(23), { enabled: true, from: "bad", to: "08:00" })).toBe(false);
    expect(N.inQuietHours(at(23), null)).toBe(false);
    expect(N.inQuietHours(at(23), undefined)).toBe(false);
  });
});

describe("thresholds", () => {
  it("filters drops that are too small, prices that are too high, and non-lows", () => {
    expect(N.passesThresholds(item({ dropPct: 10 }), { notifyMinDiscount: 20 })).toBe(false);
    expect(N.passesThresholds(item({ dropPct: 30 }), { notifyMinDiscount: 20 })).toBe(true);
    expect(N.passesThresholds(item({ price: 30 }), { notifyMaxPrice: 20 })).toBe(false);
    expect(N.passesThresholds(item({ price: 15 }), { notifyMaxPrice: 20 })).toBe(true);
    expect(N.passesThresholds(item({ atLow: false }), { notifyOnlyAtLow: true })).toBe(false);
    expect(N.passesThresholds(item({ atLow: true }), { notifyOnlyAtLow: true })).toBe(true);
  });

  it("never filters items that carry no deal data, and defaults to letting everything through", () => {
    const refund = item({ kind: "refund" });
    expect(N.passesThresholds(refund, { notifyMinDiscount: 50, notifyMaxPrice: 1, notifyOnlyAtLow: true })).toBe(true);
    expect(N.passesThresholds(item({ dropPct: 1, price: 999, atLow: false }), {})).toBe(true);
  });
});

describe("delivery", () => {
  const quiet = { enabled: true, from: "22:00", to: "08:00" };
  it("sends immediately unless quiet hours or daily mode say otherwise", () => {
    expect(N.deliveryFor(at(12), { notifyMode: "instant", quietHours: quiet })).toBe("send");
    expect(N.deliveryFor(at(23), { notifyMode: "instant", quietHours: quiet })).toBe("queue");
    expect(N.deliveryFor(at(12), { notifyMode: "daily", quietHours: quiet })).toBe("queue");
    expect(N.deliveryFor(at(12), {})).toBe("send");
  });

  it("flushes a queue once the quiet window is over", () => {
    expect(N.shouldFlush(at(9), { quietHours: quiet }, 3)).toBe(true);
    expect(N.shouldFlush(at(23), { quietHours: quiet }, 3)).toBe(false);
    expect(N.shouldFlush(at(9), { quietHours: quiet }, 0)).toBe(false);
  });
});

describe("queue", () => {
  it("de-duplicates by id and caps its length, dropping the oldest", () => {
    let q = [];
    q = N.enqueue(q, item({ id: "x" }));
    expect(N.enqueue(q, item({ id: "x" }))).toBe(q);
    for (let i = 0; i < 5; i++) q = N.enqueue(q, item({ id: `y${i}` }), 3);
    expect(q.map((i) => i.id)).toEqual(["y2", "y3", "y4"]);
  });

  it("folds a queue into one notification", () => {
    expect(N.summarize([])).toBeNull();
    expect(N.summarize([item({ title: "Only one", message: "m" })])).toEqual({ title: "Only one", message: "m", count: 1 });
    const many = Array.from({ length: 6 }, (_, i) => item({ id: `i${i}`, title: `Price alert — Game ${i}` }));
    const s = N.summarize(many);
    expect(s.title).toBe("6 GOG alerts");
    expect(s.message).toBe("Game 0 · Game 1 · Game 2 · Game 3 +2 more");
    expect(N.summarize([item({ title: "No dash" }), item({ id: "b", title: "Other" })]).message).toBe("No dash · Other");
  });
});

describe("tag alerts", () => {
  const tagAlerts = { rpg: { threshold: 10, currency: "USD" }, cheap: { threshold: 0, currency: "USD" }, euro: { threshold: 5, currency: "EUR" } };
  const tags = { a: ["rpg"], b: ["rpg", "euro"], c: ["rpg"], d: ["cheap"], e: ["euro"], f: [], g: ["rpg"] };
  const history = {
    a: [{ d: "1", p: 30, c: "USD" }, { d: "2", p: 9, c: "USD" }],
    b: [{ d: "1", p: 12, c: "USD" }],
    c: [{ d: "1", p: 40, c: "EUR" }],
    d: [{ d: "1", p: 1, c: "USD" }],
    e: [{ d: "1", p: 8, c: "USD" }],
    g: [],
  };
  const rates = { EUR: 0.5 };

  it("finds games whose latest price is at or under their tag's threshold", () => {
    const hits = N.tagAlertHits(tagAlerts, tags, history, rates);
    expect(hits.map((h) => h.slug).sort()).toEqual(["a", "e"]);
    expect(hits.find((h) => h.slug === "a")).toMatchObject({ tag: "rpg", price: 9, threshold: 10, currency: "USD" });
    // e: 8 USD = 4 EUR ≤ 5 EUR
    expect(hits.find((h) => h.slug === "e").price).toBeCloseTo(4);
  });

  it("reports a game once even when several tags match, and ignores unusable alerts and rates", () => {
    const hits = N.tagAlertHits({ rpg: { threshold: 100, currency: "USD" }, euro: { threshold: 100, currency: "EUR" } }, { b: ["rpg", "euro"] }, history, rates);
    expect(hits).toHaveLength(1);
    expect(N.tagAlertHits({ rpg: { threshold: 100, currency: "XXX" } }, { a: ["rpg"] }, history, rates)).toEqual([]);
    expect(N.tagAlertHits(tagAlerts, tags, history, {})).not.toContainEqual(expect.objectContaining({ slug: "c" }));
    expect(N.tagAlertHits(undefined, undefined, undefined, undefined)).toEqual([]);
  });

  it("skips tags without alerts or with a zero threshold", () => {
    expect(N.tagAlertHits(tagAlerts, { d: ["cheap"] }, history, rates)).toEqual([]);
    expect(N.tagAlertHits(tagAlerts, { a: ["unknown"] }, history, rates)).toEqual([]);
  });
});

describe("webhook", () => {
  it("accepts only https URLs", () => {
    expect(N.sanitizeWebhookUrl(" https://discord.com/api/webhooks/1/abc ")).toBe("https://discord.com/api/webhooks/1/abc");
    expect(N.sanitizeWebhookUrl("http://example.com/hook")).toBeNull();
    expect(N.sanitizeWebhookUrl("javascript:alert(1)")).toBeNull();
    expect(N.sanitizeWebhookUrl("not a url")).toBeNull();
    expect(N.sanitizeWebhookUrl("")).toBeNull();
  });

  it("names the origin to request permission for", () => {
    expect(N.webhookOrigin("https://hooks.example.com:8443/a/b?c=1")).toBe("https://hooks.example.com:8443/*");
  });

  it("uses Discord's shape for Discord and a plain JSON elsewhere, and sends only the notification text", () => {
    const n = { title: "Price alert", message: "Now $5" };
    expect(N.webhookPayload("https://discord.com/api/webhooks/1/x", n)).toEqual({ content: "**Price alert**\nNow $5" });
    expect(N.webhookPayload("https://canary.discordapp.com/api/webhooks/1/x", n).content).toContain("Price alert");
    expect(N.webhookPayload("https://hooks.example.com/x", n)).toEqual({ source: "gog-enhancer", title: "Price alert", message: "Now $5", text: "**Price alert**\nNow $5" });
    expect(N.webhookPayload("https://discord.com/x", { title: "t", message: "m".repeat(5000) }).content.length).toBe(1900);
  });
});
