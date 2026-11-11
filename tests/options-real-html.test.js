import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The other options tests use a hand-written page that already contains the rate boxes, so
// they could not notice the real page never building them. This one boots the real markup.
await import("../extension/lib/defaults.js");
await import("../extension/lib/i18n.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/migrations.js");
await import("../extension/lib/game-status.js");
await import("../extension/lib/backup-crypto.js");

describe("the real options page", () => {
  it("builds one rate box per currency and fills the budget currency list on load", async () => {
    const html = readFileSync(resolve(__dirname, "../extension/options/options.html"), "utf8");
    document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, "");
    vi.resetModules();
    await import("../extension/options/options.js");
    document.dispatchEvent(new Event("DOMContentLoaded"));
    const codes = window.GOG_PLUS_CURRENCIES.RATE_CODES;
    await vi.waitFor(() => expect(document.querySelectorAll("#rateGrid input").length).toBe(codes.length));
    expect(codes.length).toBe(24);
    for (const c of codes) expect(document.getElementById(`rate-${c}`)).not.toBeNull();
    // loaded values reach the boxes
    await vi.waitFor(() => expect(document.getElementById("rate-ILS").value).not.toBe(""));
    expect(document.getElementById("monthlyBudgetCurrency").options.length).toBeGreaterThan(20);
  });
});
