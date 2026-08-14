import { describe, it, expect, beforeEach } from "vitest";

// See tests/content-internals.test.js for why the full dependency chain is
// imported here (content.js's own bootstrap needs it).
await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/dom-safety.js");
await import("../extension/lib/currency-format.js");
await import("../extension/lib/genres.js");
await import("../extension/content/translations.js");
await import("../extension/content/currency-detection.js");
await import("../extension/content/price-history.js");
await import("../extension/content/tooltips.js");
await import("../extension/content/toasts.js");
await import("../extension/content/content.js");

const { applyCardBadges, __setSettingsForTest } = window.GOGPlusContentInternals;
const DEFAULTS = window.GOG_PLUS_DEFAULTS;

// applyCardBadges() is CLAUDE.md's own documented "hot zone": the badge strip
// must never land on the card root itself (GOG's carousel/preview overlays
// use the nearest positioned ancestor, so making the card `position:relative`
// explodes their layout), and duplicate cover-link/body-link anchors for the
// same game must only be stamped once.
//
// Caveat: happy-dom has no real layout engine — getBoundingClientRect()
// always returns an all-zero rect, and getComputedStyle().position reports
// "" (not the CSS-initial "static") for anything without an explicit inline
// value. That makes the function's "is this ancestor cover-sized" rect check
// unobservable here — it always evaluates to "not cover-sized", so the walk
// always climbs its full 3 hops. The tests below are built around that: they
// verify the two invariants that ARE observable under happy-dom (never the
// card root; static promotes to relative, non-static is left alone) using
// fixtures with a known hop count and explicit starting position values.

beforeEach(() => {
  document.body.innerHTML = "";
  __setSettingsForTest({
    ...DEFAULTS,
    richTooltips: false,
    designInjection: false,
    customTags: false,
    refundBadge: true,
    modIndicator: false,
  });
});

// img.parentElement, +3 more climbs (the loop always runs its full 3 hops
// under happy-dom's always-zero rects) lands exactly on this wrapper — i.e.
// NOT the <a class="card"> itself — so applyCardBadges should treat it as a
// valid host. (3 levels of plain div between the host and the img is what
// makes the arithmetic land here; see the hop trace this was verified
// against before writing these fixtures.)
function deepCardHtml(slug, hostId) {
  return `
    <a class="card" href="/game/${slug}">
      <div id="${hostId}" style="position:static">
        <div><div><div>
          <img src="cover.png">
        </div></div></div>
      </div>
    </a>
  `;
}

describe("applyCardBadges — hot zone regressions", () => {
  it("never stamps the card root itself when img is a direct child (host resolves to the card)", () => {
    document.body.innerHTML = `
      <a class="card" href="/game/shallow_slug">
        <img src="cover.png">
      </a>
    `;
    applyCardBadges(document.body);

    const card = document.querySelector("a.card");
    expect(card.classList.contains("gog-plus-card-done")).toBe(false);
    expect(card.classList.contains("gog-plus-cover-host")).toBe(false);
    expect(card.style.position).toBe("");
    expect(document.querySelector(".gog-plus-badges")).toBe(null);
  });

  it("stamps a genuine ancestor host, never the card, for a normally-nested card", () => {
    document.body.innerHTML = deepCardHtml("deep_slug", "host-target");
    applyCardBadges(document.body);

    const card = document.querySelector("a.card");
    const host = document.getElementById("host-target");

    expect(card.classList.contains("gog-plus-card-done")).toBe(true);
    // The badge host is the ancestor, not the card.
    expect(card.classList.contains("gog-plus-cover-host")).toBe(false);
    expect(host.classList.contains("gog-plus-cover-host")).toBe(true);
    expect(host.querySelector(".gog-plus-badges")).not.toBe(null);
    expect(card.querySelector(":scope > .gog-plus-badges")).toBe(null);
  });

  it("de-dupes by slug: two duplicate anchors (cover-link + body-link) only get one badge strip", () => {
    document.body.innerHTML =
      deepCardHtml("dup_slug", "host-a") + deepCardHtml("dup_slug", "host-b");
    applyCardBadges(document.body);

    expect(document.querySelectorAll(".gog-plus-badges").length).toBe(1);
    // Only the first anchor processed should carry the "done" marker+host class.
    const hostA = document.getElementById("host-a");
    const hostB = document.getElementById("host-b");
    const stamped = [hostA, hostB].filter((h) => h.classList.contains("gog-plus-cover-host"));
    expect(stamped.length).toBe(1);
  });

  it("promotes an explicitly-static host to position:relative", () => {
    document.body.innerHTML = deepCardHtml("static_slug", "host-target");
    applyCardBadges(document.body);

    expect(document.getElementById("host-target").style.position).toBe("relative");
  });

  it("never overrides a host that's already explicitly positioned (carousel/preview overlay guard)", () => {
    document.body.innerHTML = `
      <a class="card" href="/game/absolute_slug">
        <div id="host-target" style="position:absolute">
          <div><div><div>
            <img src="cover.png">
          </div></div></div>
        </div>
      </a>
    `;
    applyCardBadges(document.body);

    const host = document.getElementById("host-target");
    // Confirms the function actually reached the position-check code path
    // (didn't just bail out early for an unrelated reason).
    expect(host.classList.contains("gog-plus-cover-host")).toBe(true);
    // Must stay exactly as authored — CLAUDE.md: reparenting position here
    // collapses GOG's own carousel/preview overlays.
    expect(host.style.position).toBe("absolute");
  });

  it("only renders the refund badge when refundBadge is enabled", () => {
    __setSettingsForTest({ ...DEFAULTS, refundBadge: true, modIndicator: false });
    document.body.innerHTML = deepCardHtml("refund_slug", "host-target");
    applyCardBadges(document.body);
    expect(document.querySelector(".gog-plus-badge-refund")).not.toBe(null);
    expect(document.querySelector(".gog-plus-badge-mod")).toBe(null);
  });

  it("skips a card whose anchor has no image at all", () => {
    document.body.innerHTML = `<a class="card" href="/game/no_img_slug"></a>`;
    applyCardBadges(document.body);
    const card = document.querySelector("a.card");
    expect(card.classList.contains("gog-plus-card-done")).toBe(false);
  });

  it("skips an anchor whose href has no recognizable /game/ slug", () => {
    document.body.innerHTML = `
      <a class="card" href="/wishlist">
        <div><div><div>
          <img src="cover.png">
        </div></div></div>
      </a>
    `;
    applyCardBadges(document.body);
    expect(document.querySelector(".gog-plus-badges")).toBe(null);
  });
});
