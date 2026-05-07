/**
 * GOG+ options page logic v2.
 *
 * Uses window.GOGPlusStorage abstraction (loaded as separate script).
 * Handles: region presets, manual rate edits, VAT, force-run jobs,
 * data export/import, CSV tag export, danger-zone resets.
 */

const $ = (id) => document.getElementById(id);

const PRESETS = {
  il: { targetCurrency: "ILS", vatPercent: 18, vatLabel: "כולל מע״מ" },
  eu: { targetCurrency: "EUR", vatPercent: 20, vatLabel: "incl. VAT" },
  uk: { targetCurrency: "GBP", vatPercent: 20, vatLabel: "incl. VAT" },
  pl: { targetCurrency: "PLN", vatPercent: 23, vatLabel: "z VAT" },
  us: { targetCurrency: "USD", vatPercent: 0, vatLabel: "" },
};

const DEFAULTS = {
  targetCurrency: "ILS",
  rates: { ILS: 3.65, EUR: 0.92, GBP: 0.79, PLN: 4.0, RUB: 92.0 },
  ratesUpdatedAt: 0,
  vatPercent: 18,
  vatLabel: "כולל מע״מ",
  regionPreset: "il",
  modsUpdatedAt: 0,
  wishlistCacheUpdatedAt: 0,
  tags: {},
  notes: {},
  priceHistory: {},
};

let saveStatusTimer = null;
function flashSaved() {
  const el = $("saveStatus");
  if (!el) return;
  el.classList.remove("dim");
  el.textContent = "Saved.";
  clearTimeout(saveStatusTimer);
  saveStatusTimer = setTimeout(() => {
    el.classList.add("dim");
    el.textContent = "Saved automatically.";
  }, 1400);
}

async function load() {
  const s = await window.GOGPlusStorage.get(DEFAULTS);

  // Rate inputs
  ["ILS", "EUR", "GBP", "PLN", "RUB"].forEach((c) => {
    const inp = $(`rate-${c}`);
    if (inp && s.rates[c] !== undefined) inp.value = s.rates[c];
  });
  $("vatPercent").value = s.vatPercent ?? 18;
  $("vatLabel").value = s.vatLabel ?? "";

  // Active region preset
  document.querySelectorAll(".preset").forEach((b) => {
    b.classList.toggle("active", b.dataset.preset === s.regionPreset);
  });

  // Rate status
  const rs = $("rateStatus");
  if (s.ratesUpdatedAt) {
    const ageH = Math.round((Date.now() - s.ratesUpdatedAt) / 3600000);
    rs.textContent =
      ageH < 1
        ? "Rates updated just now."
        : `Rates updated ${ageH < 24 ? `${ageH}h` : `${Math.round(ageH / 24)}d`} ago.`;
    rs.classList.toggle("fresh", ageH < 1);
  } else {
    rs.textContent = "Using bundled fallback rates. Click refresh.";
    rs.classList.remove("fresh");
  }

  // Background sync statuses
  $("status-fx").textContent = formatTimeSince(s.ratesUpdatedAt);
  $("status-mods").textContent = formatTimeSince(s.modsUpdatedAt);
  $("status-wl").textContent = formatTimeSince(s.wishlistCacheUpdatedAt);

  // Data stats
  const tagsCount = Object.values(s.tags).reduce((a, b) => a + (b?.length || 0), 0);
  const notesCount = Object.values(s.notes).filter(Boolean).length;
  const histGames = Object.keys(s.priceHistory).length;
  const histPoints = Object.values(s.priceHistory).reduce(
    (a, b) => a + (b?.length || 0),
    0
  );
  $("dataStats").textContent =
    `${tagsCount} tag(s) across ${Object.keys(s.tags).length} game(s) · ` +
    `${notesCount} note(s) · ` +
    `${histPoints} price snapshot(s) for ${histGames} game(s)`;
}

function formatTimeSince(ts) {
  if (!ts) return "never";
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 60 / 24)}d ago`;
}

function bind() {
  // Region presets
  document.querySelectorAll(".preset").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.preset;
      document.querySelectorAll(".preset").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      if (PRESETS[key]) {
        await window.GOGPlusStorage.set({
          ...PRESETS[key],
          regionPreset: key,
        });
      } else {
        await window.GOGPlusStorage.set({ regionPreset: "custom" });
      }
      flashSaved();
      load();
    });
  });

  // Rate inputs
  ["ILS", "EUR", "GBP", "PLN", "RUB"].forEach((c) => {
    const inp = $(`rate-${c}`);
    if (!inp) return;
    inp.addEventListener("change", async () => {
      const v = parseFloat(inp.value);
      if (Number.isNaN(v) || v <= 0) return;
      const { rates = DEFAULTS.rates } = await window.GOGPlusStorage.get({
        rates: DEFAULTS.rates,
      });
      rates[c] = v;
      await window.GOGPlusStorage.set({ rates });
      flashSaved();
    });
  });

  $("vatPercent").addEventListener("change", async () => {
    let v = parseFloat($("vatPercent").value);
    if (Number.isNaN(v) || v < 0) v = 0;
    if (v > 40) v = 40;
    $("vatPercent").value = v;
    await window.GOGPlusStorage.set({ vatPercent: v });
    flashSaved();
  });

  $("vatLabel").addEventListener("change", async () => {
    await window.GOGPlusStorage.set({ vatLabel: $("vatLabel").value });
    flashSaved();
  });

  // Force jobs
  $("refreshRates").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "force-fx-refresh" }, () => setTimeout(load, 400));
  });
  $("forceFx").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "force-fx-refresh" }, () => setTimeout(load, 400));
  });
  $("forceMods").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "force-mods-refresh" }, () => setTimeout(load, 400));
  });
  $("forceWl").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "force-wishlist-refresh" }, () => setTimeout(load, 400));
  });

  // Export everything
  $("exportAll").addEventListener("click", async () => {
    const sync = await new Promise((r) => chrome.storage.sync.get(null, r));
    const local = await new Promise((r) => chrome.storage.local.get(null, r));
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), version: 2, sync, local }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gog-plus-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // Import
  $("importAll").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || (!data.sync && !data.local)) throw new Error("invalid format");
      if (!confirm("Import will OVERWRITE current settings. Continue?")) return;
      if (data.sync) await new Promise((r) => chrome.storage.sync.set(data.sync, r));
      if (data.local) await new Promise((r) => chrome.storage.local.set(data.local, r));
      flashSaved();
      load();
      alert("Imported successfully.");
    } catch (err) {
      alert("Import failed: " + err.message);
    } finally {
      e.target.value = "";
    }
  });

  // Tags → CSV
  $("exportTagsCsv").addEventListener("click", async () => {
    const { tags = {}, notes = {} } = await window.GOGPlusStorage.get({
      tags: {},
      notes: {},
    });
    const rows = [["slug", "tags", "note"]];
    const slugs = new Set([...Object.keys(tags), ...Object.keys(notes)]);
    for (const slug of slugs) {
      const t = (tags[slug] || []).join("; ");
      const n = (notes[slug] || "").replace(/"/g, '""').replace(/\r?\n/g, " ");
      rows.push([slug, `"${t.replace(/"/g, '""')}"`, `"${n}"`]);
    }
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gog-plus-tags-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // Dangerous resets
  $("clearHistory").addEventListener("click", async () => {
    if (!confirm("Clear ALL price history? This cannot be undone.")) return;
    await window.GOGPlusStorage.set({ priceHistory: {} });
    flashSaved();
    load();
  });
  $("clearTags").addEventListener("click", async () => {
    if (!confirm("Clear ALL tags and notes? This cannot be undone.")) return;
    await window.GOGPlusStorage.set({ tags: {}, notes: {} });
    flashSaved();
    load();
  });
  $("clearAll").addEventListener("click", async () => {
    if (!confirm("RESET EVERYTHING (settings, tags, notes, history)? This cannot be undone.")) return;
    if (!confirm("Are you really sure? Type-style confirmation.")) return;
    await new Promise((r) => chrome.storage.sync.clear(r));
    await new Promise((r) => chrome.storage.local.clear(r));
    flashSaved();
    setTimeout(() => location.reload(), 500);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  load();
  bind();
});
