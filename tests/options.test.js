import { describe, it, expect, beforeEach, vi } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/i18n.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/migrations.js");

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
        </div>
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
      </div>
      <div class="card">
        <div id="dataStats"></div>
        <button id="exportAll">export</button>
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
    const s = await new Promise((r) => chrome.storage.local.get(["uiLanguage"], r));
    // uiLanguage is a sync key per storage.js — read from sync instead
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

describe("tags CSV export/import", () => {
  it("exports tags and notes as CSV rows", async () => {
    await new Promise((r) =>
      chrome.storage.local.set(
        { tags: { hades: ["roguelike", "fun"] }, notes: { hades: 'has "quotes"' } },
        r
      )
    );
    await bootOptions();
    document.getElementById("exportTagsCsv").click();
    await new Promise((r) => setTimeout(r, 0));
    const blob = URL.createObjectURL.mock.calls[0][0];
    const text = await blob.text();
    expect(text).toContain("slug,tags,note");
    expect(text).toContain("hades");
    expect(text).toContain("roguelike; fun");
    expect(text).toContain('""quotes""');
  });

  it("imports a CSV file, merging tags with existing ones", async () => {
    await new Promise((r) => chrome.storage.local.set({ tags: { hades: ["existing"] } }, r));
    await bootOptions();
    const csv = "slug,tags,note\nhades,\"roguelike; fun\",a note\nstardew_valley,cozy,\n";
    const file = new File([csv], "tags.csv", { type: "text/csv" });
    const input = document.getElementById("importTagsCsvFile");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 20));
    const s = await new Promise((r) => chrome.storage.local.get(["tags", "notes"], r));
    expect(s.tags.hades.sort()).toEqual(["existing", "fun", "roguelike"]);
    expect(s.tags.stardew_valley).toEqual(["cozy"]);
    expect(s.notes.hades).toBe("a note");
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
