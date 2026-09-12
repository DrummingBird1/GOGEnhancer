import { describe, it, expect, beforeEach, vi } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/i18n.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/migrations.js");
await import("../extension/lib/game-status.js");

function fixtureHtml() {
  return `
    <span id="heroVersion"></span>
    <input type="search" id="settingsSearch">
    <span id="settingsSearchEmpty" hidden>No settings match "<span id="settingsSearchEmptyTerm"></span>".</span>
    <main class="page">
      <div class="card">
        <div class="presets" id="presets">
          <button class="preset" data-preset="il"><span>Israel</span></button>
          <button class="preset" data-preset="eu"><span>EU</span></button>
          <button class="preset" data-preset="custom"><span>Custom</span></button>
        </div>
      </div>
      <div class="card">
        <div id="rateStatus"></div>
        <input id="rate-ILS" type="number">
        <input id="rate-EUR" type="number">
        <input id="rate-GBP" type="number">
        <input id="rate-PLN" type="number">
        <input id="rate-RUB" type="number">
        <button id="refreshRates">refresh</button>
        <input id="vatPercent" type="number">
        <input id="vatLabel" type="text">
      </div>
      <div class="card">
        <div class="theme-picker" id="themePicker">
          <button class="theme-swatch" data-theme="neon"></button>
          <button class="theme-swatch" data-theme="classic"></button>
          <button class="theme-swatch" data-theme="auto"></button>
          <button class="theme-swatch" data-theme="highcontrast"></button>
          <button class="theme-swatch" data-theme="custom"></button>
        </div>
        <div class="custom-theme-editor" id="customThemeEditor" hidden>
          <input type="color" id="customColorMagenta" value="#c64fff">
          <input type="color" id="customColorCyan" value="#00f0ff">
          <input type="color" id="customColorBg" value="#0a0612">
        </div>
        <input type="checkbox" id="dyslexiaFont">
        <select id="uiLanguage">
          <option value="en">English</option>
          <option value="he">Hebrew</option>
        </select>
      </div>
      <div class="card">
        <span id="status-fx"></span>
        <button id="forceFx">force</button>
        <span id="status-mods"></span>
        <button id="forceMods">force</button>
        <span id="status-wl"></span>
        <button id="forceWl">force</button>
        <span id="status-digest"></span>
        <button id="forceDigest">force</button>
      </div>
      <div class="card">
        <div id="dataStats"></div>
        <button id="exportAll">export</button>
        <button id="exportAllEncrypted">export encrypted</button>
        <button id="importAll">import</button>
        <input type="file" id="importFile" hidden>
        <button id="exportTagsCsv">export csv</button>
        <button id="importTagsCsv">import csv</button>
        <input type="file" id="importTagsCsvFile" hidden>
        <button id="clearHistory">clear history</button>
        <button id="clearTags">clear tags</button>
        <button id="clearAll">reset everything</button>
      </div>
      <div class="card">
        <input type="checkbox" id="debugLogging">
        <input type="checkbox" id="desktopNotifications">
        <input type="checkbox" id="wishlistPriceAlerts">
        <input type="number" id="wishlistAlertPercent">
        <input type="number" id="historyMaxEntries">
        <input type="number" id="monthlyBudgetAmount">
        <select id="monthlyBudgetCurrency">
          <option value="ILS">ILS</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
          <option value="RUB">RUB</option>
          <option value="PLN">PLN</option>
          <option value="USD">USD</option>
        </select>
      </div>
    </main>
    <footer class="page-footer">
      <span id="footerVersion">v2.4</span>
      <span id="saveStatus"></span>
    </footer>
  `;
}

async function bootOptions() {
  document.body.innerHTML = fixtureHtml();
  await import("../extension/options/options.js");
  document.dispatchEvent(new Event("DOMContentLoaded"));
  await new Promise((r) => setTimeout(r, 0));
}

const ORIGINAL_GET_MANIFEST = chrome.runtime.getManifest;

beforeEach(() => {
  globalThis.__resetChromeStores();
  vi.resetModules();
  vi.restoreAllMocks();
  chrome.runtime.getManifest = ORIGINAL_GET_MANIFEST;
  chrome.runtime.sendMessage = vi.fn((_msg, cb) => cb && cb());
  window.confirm = vi.fn(() => true);
  window.alert = vi.fn();
  window.prompt = vi.fn(() => "RESET");
  if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => "blob:mock");
  else vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  window.location.reload = vi.fn();
});

// Real PBKDF2 (250k iterations) takes tens-to-low-hundreds of ms depending on
// the machine, unlike everything else in this file — a fixed setTimeout is
// too flaky across CI runners, so the encrypted-backup tests poll instead.
async function waitUntil(predicate, { timeout = 3000, interval = 10 } = {}) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) throw new Error("waitUntil: timed out");
    await new Promise((r) => setTimeout(r, interval));
  }
}

describe("load()", () => {
  it("populates rate inputs, VAT fields, and marks the active preset", async () => {
    await new Promise((r) =>
      chrome.storage.sync.set(
        { rates: { ILS: 3.7 }, vatPercent: 22, vatLabel: "incl. tax", regionPreset: "eu" },
        r
      )
    );
    await bootOptions();
    expect(document.getElementById("rate-ILS").value).toBe("3.7");
    expect(document.getElementById("vatPercent").value).toBe("22");
    expect(document.getElementById("vatLabel").value).toBe("incl. tax");
    const active = document.querySelector(".preset.active");
    expect(active.dataset.preset).toBe("eu");
  });

  it("shows the bundled-rates message when rates were never fetched", async () => {
    await bootOptions();
    expect(document.getElementById("rateStatus").textContent).toContain("bundled fallback");
  });

  it("flags a failed refresh on the rate status line", async () => {
    await new Promise((r) =>
      chrome.storage.sync.set({ lastFxError: "timeout", ratesUpdatedAt: Date.now() }, r)
    );
    await bootOptions();
    const el = document.getElementById("rateStatus");
    expect(el.classList.contains("has-error")).toBe(true);
    expect(el.textContent).toContain("timeout");
  });

  it("marks the active theme swatch and applies the theme class to <html>", async () => {
    await new Promise((r) => chrome.storage.sync.set({ theme: "classic" }, r));
    await bootOptions();
    expect(document.querySelector('.theme-swatch[data-theme="classic"]').classList.contains("active")).toBe(true);
    expect(document.documentElement.classList.contains("gog-plus-theme--classic")).toBe(true);
  });

  it("resolves the auto theme against prefers-color-scheme", async () => {
    window.matchMedia = vi.fn(() => ({ matches: false })); // not light -> neon
    await new Promise((r) => chrome.storage.sync.set({ theme: "auto" }, r));
    await bootOptions();
    expect(document.documentElement.classList.contains("gog-plus-theme--neon")).toBe(true);
  });

  it("applies custom theme colors as inline vars and reveals the editor", async () => {
    await new Promise((r) =>
      chrome.storage.sync.set(
        { theme: "custom", customThemeColors: { magenta: "#111111", cyan: "#222222", bg: "#333333" } },
        r
      )
    );
    await bootOptions();
    expect(document.documentElement.classList.contains("gog-plus-theme--custom")).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--accent-magenta")).toBe("#111111");
    expect(document.documentElement.style.getPropertyValue("--accent-cyan")).toBe("#222222");
    expect(document.documentElement.style.getPropertyValue("--bg-base")).toBe("#333333");
    expect(document.getElementById("customThemeEditor").hidden).toBe(false);
    expect(document.getElementById("customColorMagenta").value).toBe("#111111");
  });

  it("hides the custom theme editor and clears inline vars for a non-custom theme", async () => {
    await new Promise((r) => chrome.storage.sync.set({ theme: "neon" }, r));
    await bootOptions();
    expect(document.getElementById("customThemeEditor").hidden).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--accent-magenta")).toBe("");
  });

  it("picking a custom color persists customThemeColors and re-applies live", async () => {
    await new Promise((r) => chrome.storage.sync.set({ theme: "custom" }, r));
    await bootOptions();
    document.getElementById("customColorMagenta").value = "#abcdef";
    document.getElementById("customColorMagenta").dispatchEvent(new Event("input"));
    await new Promise((r) => setTimeout(r, 0));
    expect(document.documentElement.style.getPropertyValue("--accent-magenta")).toBe("#abcdef");
    const s = await new Promise((r) => chrome.storage.sync.get(["customThemeColors"], r));
    expect(s.customThemeColors.magenta).toBe("#abcdef");
  });

  it("switching swatches away from custom re-fetches saved colors before hiding the editor", async () => {
    await new Promise((r) =>
      chrome.storage.sync.set({ theme: "custom", customThemeColors: { magenta: "#000", cyan: "#000", bg: "#000" } }, r)
    );
    await bootOptions();
    document.querySelector('.theme-swatch[data-theme="neon"]').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.getElementById("customThemeEditor").hidden).toBe(true);
    expect(document.documentElement.classList.contains("gog-plus-theme--neon")).toBe(true);
  });

  it("toggling dyslexia-friendly font persists it and applies the html class", async () => {
    await bootOptions();
    expect(document.documentElement.classList.contains("gog-plus-dyslexia-font")).toBe(false);
    document.getElementById("dyslexiaFont").checked = true;
    document.getElementById("dyslexiaFont").dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    expect(document.documentElement.classList.contains("gog-plus-dyslexia-font")).toBe(true);
    const s = await new Promise((r) => chrome.storage.sync.get(["dyslexiaFont"], r));
    expect(s.dyslexiaFont).toBe(true);
  });

  it("loads a saved dyslexiaFont=true into the checkbox and html class on boot", async () => {
    await new Promise((r) => chrome.storage.sync.set({ dyslexiaFont: true }, r));
    await bootOptions();
    expect(document.getElementById("dyslexiaFont").checked).toBe(true);
    expect(document.documentElement.classList.contains("gog-plus-dyslexia-font")).toBe(true);
  });

  it("summarizes tags/notes/price-history counts in dataStats", async () => {
    await new Promise((r) =>
      chrome.storage.local.set(
        {
          tags: { hades: ["roguelike", "favorite"], stardew_valley: ["cozy"] },
          notes: { hades: "great game" },
          priceHistory: { hades: [{ d: "2026-01-01", p: 10, c: "USD" }] },
        },
        r
      )
    );
    await bootOptions();
    const text = document.getElementById("dataStats").textContent;
    expect(text).toContain("3 tag(s) across 2 game(s)");
    expect(text).toContain("1 note(s)");
    expect(text).toContain("1 price snapshot(s) for 1 game(s)");
  });

  it("sets hero and footer version text from the manifest", async () => {
    chrome.runtime.getManifest = () => ({ version: "9.9.9" });
    await bootOptions();
    expect(document.getElementById("heroVersion").textContent).toBe("v9.9.9");
    expect(document.getElementById("footerVersion").textContent).toBe("v9.9.9");
  });
});

describe("region presets", () => {
  it("applies a known preset's currency/VAT and marks it active", async () => {
    await bootOptions();
    document.querySelector('.preset[data-preset="eu"]').click();
    await new Promise((r) => setTimeout(r, 0));
    const s = await new Promise((r) =>
      chrome.storage.sync.get(["targetCurrency", "vatPercent", "regionPreset"], r)
    );
    expect(s.targetCurrency).toBe("EUR");
    expect(s.vatPercent).toBe(20);
    expect(s.regionPreset).toBe("eu");
  });

  it("falls back to 'custom' for an unrecognized preset key", async () => {
    await bootOptions();
    document.querySelector('.preset[data-preset="custom"]').click();
    await new Promise((r) => setTimeout(r, 0));
    const s = await new Promise((r) => chrome.storage.sync.get(["regionPreset"], r));
    expect(s.regionPreset).toBe("custom");
  });
});

describe("rate inputs, VAT, and other simple fields", () => {
  it("writes a single edited rate back into the merged rates object", async () => {
    await new Promise((r) => chrome.storage.sync.set({ rates: { ILS: 3.65, EUR: 0.9 } }, r));
    await bootOptions();
    const inp = document.getElementById("rate-ILS");
    inp.value = "4.0";
    inp.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    const s = await new Promise((r) => chrome.storage.sync.get(["rates"], r));
    expect(s.rates.ILS).toBe(4);
    expect(s.rates.EUR).toBe(0.9); // untouched
  });

  it("ignores a non-numeric or non-positive rate edit", async () => {
    await new Promise((r) => chrome.storage.sync.set({ rates: { ILS: 3.65 } }, r));
    await bootOptions();
    const inp = document.getElementById("rate-ILS");
    inp.value = "-5";
    inp.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    const s = await new Promise((r) => chrome.storage.sync.get(["rates"], r));
    expect(s.rates.ILS).toBe(3.65);
  });

  it("clamps VAT percent into [0, 40]", async () => {
    await bootOptions();
    const inp = document.getElementById("vatPercent");
    inp.value = "500";
    inp.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    expect(inp.value).toBe("40");
  });

  it("clamps wishlistAlertPercent into [1, 90]", async () => {
    await bootOptions();
    const inp = document.getElementById("wishlistAlertPercent");
    inp.value = "0";
    inp.dispatchEvent(new Event("change"));
    expect(inp.value).toBe("1");
  });

  it("clamps historyMaxEntries into [10, 500]", async () => {
    await bootOptions();
    const inp = document.getElementById("historyMaxEntries");
    inp.value = "5000";
    inp.dispatchEvent(new Event("change"));
    expect(inp.value).toBe("500");
  });

  it("persists checkbox toggles", async () => {
    await bootOptions();
    const el = document.getElementById("desktopNotifications");
    el.checked = true;
    el.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    const s = await new Promise((r) => chrome.storage.sync.get(["desktopNotifications"], r));
    expect(s.desktopNotifications).toBe(true);
  });

  it("persists a uiLanguage change and re-applies i18n", async () => {
    await bootOptions();
    const sel = document.getElementById("uiLanguage");
    sel.value = "he";
    sel.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    // uiLanguage is a sync key per storage.js
    const sy = await new Promise((r) => chrome.storage.sync.get(["uiLanguage"], r));
    expect(sy.uiLanguage).toBe("he");
  });
});

describe("theme swatches", () => {
  it("clicking a swatch persists the theme and updates the live preview class", async () => {
    await bootOptions();
    document.querySelector('.theme-swatch[data-theme="classic"]').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.documentElement.classList.contains("gog-plus-theme--classic")).toBe(true);
    const s = await new Promise((r) => chrome.storage.sync.get(["theme"], r));
    expect(s.theme).toBe("classic");
  });
});

describe("force-refresh buttons", () => {
  it("forceFx sends a force-fx-refresh message", async () => {
    await bootOptions();
    document.getElementById("forceFx").click();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { type: "force-fx-refresh" },
      expect.any(Function)
    );
  });

  it("forceMods sends a force-mods-refresh message", async () => {
    await bootOptions();
    document.getElementById("forceMods").click();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { type: "force-mods-refresh" },
      expect.any(Function)
    );
  });

  it("forceWl sends a force-wishlist-refresh message", async () => {
    await bootOptions();
    document.getElementById("forceWl").click();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { type: "force-wishlist-refresh" },
      expect.any(Function)
    );
  });
});

describe("export everything (JSON)", () => {
  it("builds a JSON blob containing both storage areas", async () => {
    await new Promise((r) => chrome.storage.sync.set({ vatPercent: 18 }, r));
    await new Promise((r) => chrome.storage.local.set({ tags: { hades: ["x"] } }, r));
    await bootOptions();
    document.getElementById("exportAll").click();
    await new Promise((r) => setTimeout(r, 0));
    expect(URL.createObjectURL).toHaveBeenCalled();
    const blob = URL.createObjectURL.mock.calls[0][0];
    const text = await blob.text();
    const parsed = JSON.parse(text);
    expect(parsed.sync.vatPercent).toBe(18);
    expect(parsed.local.tags.hades).toEqual(["x"]);
  });
});

describe("monthly spending budget", () => {
  it("loads a configured budget into the amount and currency fields", async () => {
    await new Promise((r) =>
      chrome.storage.sync.set({ monthlyBudget: { amount: 75, currency: "EUR" } }, r)
    );
    await bootOptions();
    expect(document.getElementById("monthlyBudgetAmount").value).toBe("75");
    expect(document.getElementById("monthlyBudgetCurrency").value).toBe("EUR");
  });

  it("defaults to 0/ILS when no budget is set", async () => {
    await bootOptions();
    expect(document.getElementById("monthlyBudgetAmount").value).toBe("0");
    expect(document.getElementById("monthlyBudgetCurrency").value).toBe("ILS");
  });

  it("saves a positive amount as {amount, currency}", async () => {
    await bootOptions();
    document.getElementById("monthlyBudgetCurrency").value = "GBP";
    document.getElementById("monthlyBudgetAmount").value = "40";
    document.getElementById("monthlyBudgetAmount").dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    const s = await new Promise((r) => chrome.storage.sync.get(["monthlyBudget"], r));
    expect(s.monthlyBudget).toEqual({ amount: 40, currency: "GBP" });
  });

  it("saves null (budget off) when the amount is 0", async () => {
    await new Promise((r) =>
      chrome.storage.sync.set({ monthlyBudget: { amount: 40, currency: "GBP" } }, r)
    );
    await bootOptions();
    document.getElementById("monthlyBudgetAmount").value = "0";
    document.getElementById("monthlyBudgetAmount").dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    const s = await new Promise((r) => chrome.storage.sync.get(["monthlyBudget"], r));
    expect(s.monthlyBudget).toBeNull();
  });

  it("clamps a negative or non-numeric amount to 0", async () => {
    await bootOptions();
    document.getElementById("monthlyBudgetAmount").value = "-5";
    document.getElementById("monthlyBudgetAmount").dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    expect(document.getElementById("monthlyBudgetAmount").value).toBe("0");
    const s = await new Promise((r) => chrome.storage.sync.get(["monthlyBudget"], r));
    expect(s.monthlyBudget).toBeNull();
  });
});

describe("encrypted backup export/import", () => {
  it("encrypts the export into a password-protected envelope, distinct from the plain export", async () => {
    window.prompt = vi.fn(() => "hunter2");
    await new Promise((r) => chrome.storage.sync.set({ vatPercent: 18 }, r));
    await bootOptions();
    document.getElementById("exportAllEncrypted").click();
    await waitUntil(() => URL.createObjectURL.mock.calls.length > 0);
    const blob = URL.createObjectURL.mock.calls[0][0];
    const text = await blob.text();
    const envelope = JSON.parse(text);
    expect(envelope.format).toBe("gog-enhancer-encrypted-backup");
    expect(envelope.salt).toBeTruthy();
    expect(envelope.iv).toBeTruthy();
    expect(envelope.ciphertext).toBeTruthy();
    // The plaintext settings must not appear anywhere in the exported file
    // (checking for the "18" value itself isn't meaningful — a random
    // base64 ciphertext coincidentally contains that 2-digit substring more
    // often than not).
    expect(text).not.toContain("vatPercent");
  });

  it("does nothing when the password prompt is cancelled", async () => {
    window.prompt = vi.fn(() => null);
    await bootOptions();
    document.getElementById("exportAllEncrypted").click();
    await new Promise((r) => setTimeout(r, 20));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("round-trips through export and import with the correct password", async () => {
    window.prompt = vi.fn(() => "correct horse battery staple");
    await new Promise((r) => chrome.storage.sync.set({ vatPercent: 31 }, r));
    await bootOptions();
    document.getElementById("exportAllEncrypted").click();
    await waitUntil(() => URL.createObjectURL.mock.calls.length > 0);
    const encryptedText = await URL.createObjectURL.mock.calls[0][0].text();

    await new Promise((r) => chrome.storage.sync.set({ vatPercent: 0 }, r));
    const file = new File([encryptedText], "backup.json", { type: "application/json" });
    const input = document.getElementById("importFile");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change"));
    await waitUntil(() => window.alert.mock.calls.length > 0);

    const s = await new Promise((r) => chrome.storage.sync.get(["vatPercent"], r));
    expect(s.vatPercent).toBe(31);
    expect(window.alert).toHaveBeenCalledWith("Imported successfully.");
  });

  it("shows an error instead of importing when the password is wrong", async () => {
    window.prompt = vi.fn(() => "the-right-password");
    await new Promise((r) => chrome.storage.sync.set({ vatPercent: 31 }, r));
    await bootOptions();
    document.getElementById("exportAllEncrypted").click();
    await waitUntil(() => URL.createObjectURL.mock.calls.length > 0);
    const encryptedText = await URL.createObjectURL.mock.calls[0][0].text();

    window.prompt = vi.fn(() => "a-wrong-password");
    const file = new File([encryptedText], "backup.json", { type: "application/json" });
    const input = document.getElementById("importFile");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change"));
    await waitUntil(() => window.alert.mock.calls.length > 0);
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Wrong password"));
  });

  it("does nothing when the decrypt password prompt is cancelled", async () => {
    window.prompt = vi.fn(() => "some-password");
    await bootOptions();
    document.getElementById("exportAllEncrypted").click();
    await waitUntil(() => URL.createObjectURL.mock.calls.length > 0);
    const encryptedText = await URL.createObjectURL.mock.calls[0][0].text();

    window.prompt = vi.fn(() => null);
    window.alert.mockClear();
    const file = new File([encryptedText], "backup.json", { type: "application/json" });
    const input = document.getElementById("importFile");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 100));
    expect(window.alert).not.toHaveBeenCalled();
  });
});

describe("tags CSV export/import", () => {
  it("exports tags, notes, and play status as CSV rows", async () => {
    await new Promise((r) =>
      chrome.storage.local.set(
        {
          tags: { hades: ["roguelike", "fun"] },
          notes: { hades: 'has "quotes"' },
          gameStatus: { hades: "playing" },
        },
        r
      )
    );
    await bootOptions();
    document.getElementById("exportTagsCsv").click();
    await new Promise((r) => setTimeout(r, 0));
    const blob = URL.createObjectURL.mock.calls[0][0];
    const text = await blob.text();
    expect(text).toContain("slug,tags,note,status");
    expect(text).toContain("hades");
    expect(text).toContain("roguelike; fun");
    expect(text).toContain('""quotes""');
    expect(text).toContain("playing");
  });

  it("imports a CSV file, merging tags and play status with existing ones", async () => {
    await new Promise((r) => chrome.storage.local.set({ tags: { hades: ["existing"] } }, r));
    await bootOptions();
    const csv =
      "slug,tags,note,status\n" +
      'hades,"roguelike; fun",a note,playing\n' +
      "stardew_valley,cozy,,backlog\n";
    const file = new File([csv], "tags.csv", { type: "text/csv" });
    const input = document.getElementById("importTagsCsvFile");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 20));
    const s = await new Promise((r) => chrome.storage.local.get(["tags", "notes", "gameStatus"], r));
    expect(s.tags.hades.sort()).toEqual(["existing", "fun", "roguelike"]);
    expect(s.tags.stardew_valley).toEqual(["cozy"]);
    expect(s.notes.hades).toBe("a note");
    expect(s.gameStatus.hades).toBe("playing");
    expect(s.gameStatus.stardew_valley).toBe("backlog");
  });

  it("ignores an unrecognized status value instead of storing garbage", async () => {
    await bootOptions();
    const csv = "slug,tags,note,status\nhades,,,not-a-real-status\n";
    const file = new File([csv], "tags.csv", { type: "text/csv" });
    const input = document.getElementById("importTagsCsvFile");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 20));
    const s = await new Promise((r) => chrome.storage.local.get(["gameStatus"], r));
    expect(s.gameStatus.hades).toBeUndefined();
  });

  it("doesn't overwrite an existing play status silently", async () => {
    await new Promise((r) => chrome.storage.local.set({ gameStatus: { hades: "finished" } }, r));
    await bootOptions();
    const csv = "slug,tags,note,status\nhades,,,backlog\n";
    const file = new File([csv], "tags.csv", { type: "text/csv" });
    const input = document.getElementById("importTagsCsvFile");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 20));
    const s = await new Promise((r) => chrome.storage.local.get(["gameStatus"], r));
    expect(s.gameStatus.hades).toBe("finished");
  });

  it("rejects a CSV missing the required slug column", async () => {
    await bootOptions();
    const csv = "tags,note\nroguelike,hi\n";
    const file = new File([csv], "bad.csv", { type: "text/csv" });
    const input = document.getElementById("importTagsCsvFile");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 20));
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("CSV import failed"));
  });
});

describe("full JSON import", () => {
  it("writes both areas and runs the migration pass", async () => {
    await bootOptions();
    const payload = JSON.stringify({
      version: 2,
      sync: { vatPercent: 25 },
      local: { tags: { hades: ["x"] } },
    });
    const file = new File([payload], "backup.json", { type: "application/json" });
    const input = document.getElementById("importFile");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 20));
    const s = await new Promise((r) => chrome.storage.sync.get(["vatPercent"], r));
    expect(s.vatPercent).toBe(25);
    expect(window.alert).toHaveBeenCalledWith("Imported successfully.");
  });

  it("aborts without confirmation and shows an error for malformed JSON", async () => {
    await bootOptions();
    const file = new File(["not json"], "backup.json", { type: "application/json" });
    const input = document.getElementById("importFile");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 20));
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Import failed"));
  });

  it("does nothing when the user cancels the overwrite confirmation", async () => {
    window.confirm = vi.fn(() => false);
    await new Promise((r) => chrome.storage.sync.set({ vatPercent: 18 }, r));
    await bootOptions();
    const payload = JSON.stringify({ version: 2, sync: { vatPercent: 99 } });
    const file = new File([payload], "backup.json", { type: "application/json" });
    const input = document.getElementById("importFile");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 20));
    const s = await new Promise((r) => chrome.storage.sync.get(["vatPercent"], r));
    expect(s.vatPercent).toBe(18);
  });
});

describe("danger zone", () => {
  it("clearHistory wipes priceHistory after confirmation", async () => {
    await new Promise((r) =>
      chrome.storage.local.set({ priceHistory: { hades: [{ d: "x", p: 1, c: "USD" }] } }, r)
    );
    await bootOptions();
    document.getElementById("clearHistory").click();
    await new Promise((r) => setTimeout(r, 0));
    const s = await new Promise((r) => chrome.storage.local.get(["priceHistory"], r));
    expect(s.priceHistory).toEqual({});
  });

  it("clearHistory does nothing when the confirmation is declined", async () => {
    window.confirm = vi.fn(() => false);
    await new Promise((r) => chrome.storage.local.set({ priceHistory: { hades: [1] } }, r));
    await bootOptions();
    document.getElementById("clearHistory").click();
    await new Promise((r) => setTimeout(r, 0));
    const s = await new Promise((r) => chrome.storage.local.get(["priceHistory"], r));
    expect(s.priceHistory).toEqual({ hades: [1] });
  });

  it("clearTags wipes tags and notes after confirmation", async () => {
    await new Promise((r) =>
      chrome.storage.local.set({ tags: { hades: ["x"] }, notes: { hades: "n" } }, r)
    );
    await bootOptions();
    document.getElementById("clearTags").click();
    await new Promise((r) => setTimeout(r, 0));
    const s = await new Promise((r) => chrome.storage.local.get(["tags", "notes"], r));
    expect(s.tags).toEqual({});
    expect(s.notes).toEqual({});
  });

  it("clearAll requires both a confirm and the exact RESET phrase", async () => {
    await new Promise((r) => chrome.storage.sync.set({ vatPercent: 18 }, r));
    await bootOptions();
    document.getElementById("clearAll").click();
    await new Promise((r) => setTimeout(r, 0));
    const s = await new Promise((r) => chrome.storage.sync.get(["vatPercent"], r));
    expect(s.vatPercent).toBeUndefined();
  });

  it("clearAll also best-effort deletes the note-attachments IndexedDB", async () => {
    const spy = vi.spyOn(indexedDB, "deleteDatabase");
    await bootOptions();
    document.getElementById("clearAll").click();
    await new Promise((r) => setTimeout(r, 0));
    expect(spy).toHaveBeenCalledWith("gog-plus-attachments");
  });

  it("clearAll leaves data untouched when the typed phrase doesn't match", async () => {
    window.prompt = vi.fn(() => "reset"); // wrong case
    await new Promise((r) => chrome.storage.sync.set({ vatPercent: 18 }, r));
    await bootOptions();
    document.getElementById("clearAll").click();
    await new Promise((r) => setTimeout(r, 0));
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("didn't match"));
    const s = await new Promise((r) => chrome.storage.sync.get(["vatPercent"], r));
    expect(s.vatPercent).toBe(18);
  });
});

describe("settings search", () => {
  it("hides cards that don't match the free-text query", async () => {
    await bootOptions();
    const input = document.getElementById("settingsSearch");
    input.value = "israel";
    input.dispatchEvent(new Event("input"));
    const cards = document.querySelectorAll("main.page > .card");
    expect(cards[0].hidden).toBe(false); // presets card has visible text "Israel"
    expect(cards[1].hidden).toBe(true); // rates card has no matching visible text
  });

  it("shows the empty-state message when nothing matches", async () => {
    await bootOptions();
    const input = document.getElementById("settingsSearch");
    input.value = "zzz_no_such_setting";
    input.dispatchEvent(new Event("input"));
    expect(document.getElementById("settingsSearchEmpty").hidden).toBe(false);
    expect(document.getElementById("settingsSearchEmptyTerm").textContent).toBe(
      "zzz_no_such_setting"
    );
  });

  it("clearing the search shows every card again and hides the empty message", async () => {
    await bootOptions();
    const input = document.getElementById("settingsSearch");
    input.value = "zzz_no_such_setting";
    input.dispatchEvent(new Event("input"));
    input.value = "";
    input.dispatchEvent(new Event("input"));
    const cards = document.querySelectorAll("main.page > .card");
    cards.forEach((c) => expect(c.hidden).toBe(false));
    expect(document.getElementById("settingsSearchEmpty").hidden).toBe(true);
  });
});
