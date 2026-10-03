/**
 * GOG+ options page logic v2.
 *
 * Uses window.GOGPlusStorage abstraction (loaded as separate script).
 * Handles: region presets, manual rate edits, VAT, force-run jobs,
 * data export/import, CSV tag export, danger-zone resets.
 */

/** The page's controls are looked up by id and used as inputs, buttons, … — typed loosely on purpose. */
const $ = /** @type {(id: string) => any} */ ((id) => document.getElementById(id));
/** @type {(selector: string) => NodeListOf<HTMLElement>} */
const $$ = (selector) => document.querySelectorAll(selector);

const PRESETS = {
  il: { targetCurrency: "ILS", vatPercent: 18, vatLabel: "כולל מע״מ" },
  eu: { targetCurrency: "EUR", vatPercent: 20, vatLabel: "incl. VAT" },
  uk: { targetCurrency: "GBP", vatPercent: 20, vatLabel: "incl. VAT" },
  pl: { targetCurrency: "PLN", vatPercent: 23, vatLabel: "z VAT" },
  us: { targetCurrency: "USD", vatPercent: 0, vatLabel: "" },
  // v4: national VAT rates inside the euro area (the "EU" preset keeps the
  // 20% many countries share) and Russia — currencies the rate table has.
  de: { targetCurrency: "EUR", vatPercent: 19, vatLabel: "inkl. MwSt." },
  fr: { targetCurrency: "EUR", vatPercent: 20, vatLabel: "TTC" },
  es: { targetCurrency: "EUR", vatPercent: 21, vatLabel: "IVA incl." },
  it: { targetCurrency: "EUR", vatPercent: 22, vatLabel: "IVA incl." },
  nl: { targetCurrency: "EUR", vatPercent: 21, vatLabel: "incl. btw" },
  ru: { targetCurrency: "RUB", vatPercent: 20, vatLabel: "с НДС" },
};

const DEFAULTS = window.GOG_PLUS_DEFAULTS;

// Encrypted-backup helpers (PBKDF2 + AES-256-GCM) live in lib/backup-crypto.js
// since v4 — the folder sync, the automatic backups and this page all use the
// same envelope. folder-sync.js and the tag dashboard find them on
// window.GOGPlusBackupCrypto.
const { ENCRYPTED_BACKUP_FORMAT, encryptBackup, decryptBackup } = window.GOGPlusBackupCrypto;

// customColors, when the resolved theme is "custom": {magenta, cyan, bg}.
// Applied as inline custom properties on <html> so no CSS class covers the
// "custom" case — the swatch classes above only style each theme's picker
// button, not the live page. Inline style always wins the cascade, so
// switching AWAY from "custom" must explicitly clear these or a class-based
// theme picked next would be silently overridden.
function applyThemeClassToHtml(theme, customColors) {
  // Strip any prior gog-plus-theme--* class so themes don't compose,
  // then add the current one. "neon" is the CSS default so the class
  // is harmless; we still add it for consistency with content.js.
  // "auto" isn't a real CSS variant — same resolution as content.js.
  // "native" means "match gog.com's own look", which only exists on gog.com —
  // on this page it follows the system light/dark preference like "auto".
  const html = document.documentElement;
  [...html.classList]
    .filter((c) => c.startsWith("gog-plus-theme--"))
    .forEach((c) => html.classList.remove(c));
  let resolved = theme || "neon";
  if (resolved === "auto" || resolved === "native") {
    resolved = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "neon";
  }
  html.classList.add(`gog-plus-theme--${resolved}`);
  if (resolved === "custom" && customColors) {
    html.style.setProperty("--accent-magenta", customColors.magenta);
    html.style.setProperty("--accent-cyan", customColors.cyan);
    html.style.setProperty("--bg-base", customColors.bg);
  } else {
    html.style.removeProperty("--accent-magenta");
    html.style.removeProperty("--accent-cyan");
    html.style.removeProperty("--bg-base");
  }
}

/** The text of a dialog (confirm / alert / prompt) in the page's language — see lib/i18n-pages.js. */
const tx = (/** @type {string} */ s) => window.GOGPlusPageI18n?.tx(s) ?? s;

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
  window.GOGPlusI18n?.apply(s.uiLanguage || "en");
  if ($("uiLanguage")) $("uiLanguage").value = s.uiLanguage || "en";

  // Rate inputs
  ["ILS", "EUR", "GBP", "PLN", "RUB"].forEach((c) => {
    const inp = $(`rate-${c}`);
    if (inp && s.rates[c] !== undefined) inp.value = s.rates[c];
  });
  $("vatPercent").value = s.vatPercent ?? 18;
  $("vatLabel").value = s.vatLabel ?? "";

  // Active region preset
  $$(".preset").forEach((b) => {
    b.classList.toggle("active", b.dataset.preset === s.regionPreset);
  });

  // Rate status
  const rs = $("rateStatus");
  rs.classList.remove("fresh", "has-error");
  if (s.lastFxError) {
    const ageStr = s.ratesUpdatedAt
      ? formatTimeSince(s.ratesUpdatedAt)
      : "never refreshed";
    rs.textContent = `Last refresh failed: ${s.lastFxError} · rates ${ageStr}`;
    rs.classList.add("has-error");
  } else if (s.ratesUpdatedAt) {
    const ageH = Math.round((Date.now() - s.ratesUpdatedAt) / 3600000);
    rs.textContent =
      ageH < 1
        ? "Rates updated just now."
        : `Rates updated ${ageH < 24 ? `${ageH}h` : `${Math.round(ageH / 24)}d`} ago.`;
    rs.classList.toggle("fresh", ageH < 1);
  } else {
    rs.textContent = "Using bundled fallback rates. Click refresh.";
  }

  // Debug toggle
  if ($("debugLogging")) $("debugLogging").checked = !!s.debugLogging;
  if ($("desktopNotifications")) $("desktopNotifications").checked = !!s.desktopNotifications;
  if ($("wishlistPriceAlerts")) $("wishlistPriceAlerts").checked = !!s.wishlistPriceAlerts;
  if ($("wishlistAlertPercent")) $("wishlistAlertPercent").value = s.wishlistAlertPercent ?? 20;
  if ($("historyMaxEntries")) $("historyMaxEntries").value = s.historyMaxEntries ?? 100;
  if ($("monthlyBudgetAmount")) $("monthlyBudgetAmount").value = s.monthlyBudget?.amount ?? 0;
  if ($("monthlyBudgetCurrency")) $("monthlyBudgetCurrency").value = s.monthlyBudget?.currency ?? "ILS";

  // Active theme swatch + live preview on the options page itself
  const activeTheme = s.theme || "neon";
  applyThemeClassToHtml(activeTheme, s.customThemeColors);
  $$(".theme-swatch").forEach((b) => {
    b.classList.toggle("active", b.dataset.theme === activeTheme);
  });
  if ($("customThemeEditor")) $("customThemeEditor").hidden = activeTheme !== "custom";
  const cc = s.customThemeColors;
  if ($("customColorMagenta")) $("customColorMagenta").value = cc?.magenta || "#c64fff";
  if ($("customColorCyan")) $("customColorCyan").value = cc?.cyan || "#00f0ff";
  if ($("customColorBg")) $("customColorBg").value = cc?.bg || "#0a0612";
  if ($("dyslexiaFont")) $("dyslexiaFont").checked = !!s.dyslexiaFont;
  document.documentElement.classList.toggle("gog-plus-dyslexia-font", !!s.dyslexiaFont);
  document.documentElement.classList.toggle("gog-plus-calm", !!s.calmMode);
  [...document.documentElement.classList]
    .filter((c) => c.startsWith("gog-plus-palette--"))
    .forEach((c) => document.documentElement.classList.remove(c));
  if (s.palette && s.palette !== "default") document.documentElement.classList.add(`gog-plus-palette--${s.palette}`);

  // Background sync statuses
  $("status-fx").textContent = formatTimeSince(s.ratesUpdatedAt);
  $("status-mods").textContent = formatTimeSince(s.modsUpdatedAt);
  $("status-wl").textContent = formatTimeSince(s.wishlistCacheUpdatedAt);
  if ($("status-digest")) $("status-digest").textContent = formatTimeSince(s.weeklyDigest?.generatedAt);

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

// Minimal RFC4180-ish CSV parser. Handles quoted fields, embedded commas,
// escaped double-quotes ("") and CRLF/LF line endings.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else {
        cell += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\r") { /* ignore */ }
      else if (c === "\n") {
        row.push(cell);
        rows.push(row);
        row = []; cell = "";
      } else {
        cell += c;
      }
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
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
  $$(".preset").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.preset;
      $$(".preset").forEach((b) => b.classList.remove("active"));
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

  $("debugLogging").addEventListener("change", async () => {
    await window.GOGPlusStorage.set({ debugLogging: $("debugLogging").checked });
    flashSaved();
  });

  $("desktopNotifications").addEventListener("change", async () => {
    await window.GOGPlusStorage.set({
      desktopNotifications: $("desktopNotifications").checked,
    });
    flashSaved();
  });

  $("wishlistPriceAlerts").addEventListener("change", async () => {
    await window.GOGPlusStorage.set({
      wishlistPriceAlerts: $("wishlistPriceAlerts").checked,
    });
    flashSaved();
  });

  $("wishlistAlertPercent").addEventListener("change", async () => {
    let v = parseInt($("wishlistAlertPercent").value, 10);
    if (!Number.isFinite(v)) v = 20;
    v = Math.min(90, Math.max(1, v));
    $("wishlistAlertPercent").value = v;
    await window.GOGPlusStorage.set({ wishlistAlertPercent: v });
    flashSaved();
  });

  if ($("uiLanguage")) {
    $("uiLanguage").addEventListener("change", async () => {
      const lang = $("uiLanguage").value;
      await window.GOGPlusStorage.set({ uiLanguage: lang });
      window.GOGPlusI18n?.apply(lang);
      flashSaved();
    });
  }

  $("historyMaxEntries").addEventListener("change", async () => {
    let v = parseInt($("historyMaxEntries").value, 10);
    if (!Number.isFinite(v)) v = 100;
    v = Math.min(500, Math.max(10, v));
    $("historyMaxEntries").value = v;
    await window.GOGPlusStorage.set({ historyMaxEntries: v });
    flashSaved();
  });

  const saveMonthlyBudget = async () => {
    let amount = parseFloat($("monthlyBudgetAmount").value);
    if (!Number.isFinite(amount) || amount < 0) amount = 0;
    $("monthlyBudgetAmount").value = amount;
    const currency = $("monthlyBudgetCurrency").value;
    await window.GOGPlusStorage.set({
      monthlyBudget: amount > 0 ? { amount, currency } : null,
    });
    flashSaved();
  };
  $("monthlyBudgetAmount").addEventListener("change", saveMonthlyBudget);
  $("monthlyBudgetCurrency").addEventListener("change", saveMonthlyBudget);

  // Theme swatches — live preview on the options page, then persist.
  $$(".theme-swatch").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const theme = btn.dataset.theme;
      $$(".theme-swatch").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const { customThemeColors } = await window.GOGPlusStorage.get({ customThemeColors: null });
      applyThemeClassToHtml(theme, customThemeColors);
      if ($("customThemeEditor")) $("customThemeEditor").hidden = theme !== "custom";
      await window.GOGPlusStorage.set({ theme });
      flashSaved();
    });
  });

  // Custom theme color pickers — persist as one object so a partial pick
  // never leaves the other two colors undefined.
  const saveCustomColors = async () => {
    const colors = {
      magenta: $("customColorMagenta").value,
      cyan: $("customColorCyan").value,
      bg: $("customColorBg").value,
    };
    applyThemeClassToHtml("custom", colors);
    await window.GOGPlusStorage.set({ customThemeColors: colors });
    flashSaved();
  };
  ["customColorMagenta", "customColorCyan", "customColorBg"].forEach((id) => {
    if ($(id)) $(id).addEventListener("input", saveCustomColors);
  });

  if ($("dyslexiaFont")) {
    $("dyslexiaFont").addEventListener("change", async () => {
      const on = $("dyslexiaFont").checked;
      document.documentElement.classList.toggle("gog-plus-dyslexia-font", on);
      await window.GOGPlusStorage.set({ dyslexiaFont: on });
      flashSaved();
    });
  }

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
  $("forceDigest").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "force-digest-refresh" }, () => setTimeout(load, 400));
  });

  // Items that describe THIS browser (its sync folder, queues) or are secrets
  // (the webhook address) — never written into a backup file and never taken
  // from one. A backup that carried them could be shared by accident, or point
  // a second browser at a folder it has no access to.
  const PER_BROWSER_KEYS = [
    "syncFolderName", "lastFolderSyncAt", "syncBaseMeta", "syncConflicts", "autoSync", "autoBackup",
    "lastAutoBackupAt", "webhookUrl", "webhookEnabled", "notifyQueue", "tourSeen", "netLog", "failureLog", "failureSeenAt",
  ];
  const withoutPerBrowser = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !PER_BROWSER_KEYS.includes(k)));
  const readAreas = async () => ({
    sync: withoutPerBrowser(await new Promise((r) => chrome.storage.sync.get(null, r))),
    local: withoutPerBrowser(await new Promise((r) => chrome.storage.local.get(null, r))),
  });

  // Export everything
  $("exportAll").addEventListener("click", async () => {
    const { sync, local } = await readAreas();
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

  // Export everything, password-protected. Same payload shape as exportAll
  // above, wrapped in an AES-GCM envelope — see the encryptBackup() doc
  // comment for why salt/IV travel in plaintext but the password never does.
  $("exportAllEncrypted").addEventListener("click", async () => {
    const password = prompt(
      tx(
        "Choose a password to encrypt this backup with.\n\n" +
          "There is no way to recover a lost password — the file is useless without it."
      )
    );
    if (!password) return;
    const { sync, local } = await readAreas();
    const plaintext = JSON.stringify({ exportedAt: new Date().toISOString(), version: 2, sync, local });
    const envelope = await encryptBackup(plaintext, password);
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gog-plus-export-encrypted-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // Import — handles both the plain JSON shape above and the encrypted
  // envelope transparently (detected via the `format` field), so there's
  // only one Import button for the user to remember.
  $("importAll").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      let data = JSON.parse(text);
      if (data?.format === ENCRYPTED_BACKUP_FORMAT) {
        const password = prompt(tx("This backup is encrypted. Enter the password to decrypt it."));
        if (!password) return;
        data = JSON.parse(await decryptBackup(data, password));
      }
      if (!data || (!data.sync && !data.local)) throw new Error("invalid format");
      if (!confirm(tx("Import will OVERWRITE current settings. Continue?"))) return;
      const setArea = (area, items) =>
        new Promise((resolve, reject) => {
          area.set(items, () => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(undefined);
          });
        });
      // Which folder this browser syncs to (and when it last did), its webhook
      // and queues belong to THIS browser — a backup from another device must
      // not claim a folder this one has no access to, or replace a webhook.
      if (data.sync) await setArea(chrome.storage.sync, withoutPerBrowser(data.sync));
      if (data.local) await setArea(chrome.storage.local, withoutPerBrowser(data.local));
      // The import may come from an older version of the extension (e.g. a
      // pre-v2 export where tags/notes still lived in sync) — run the same
      // migration pass an upgrade would, instead of loading the old shape as-is.
      await window.GOGPlusMigrations.run();
      flashSaved();
      load();
      alert(tx("Imported successfully."));
    } catch (err) {
      alert(tx("Import failed: " + err.message));
    } finally {
      e.target.value = "";
    }
  });

  // Tags ← CSV
  $("importTagsCsv").addEventListener("click", () => $("importTagsCsvFile").click());
  $("importTagsCsvFile").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) throw new Error(tx("Empty CSV."));
      // Header row check (case-insensitive); accept any column order.
      const header = rows[0].map((c) => c.trim().toLowerCase());
      const slugIdx = header.indexOf("slug");
      const tagsIdx = header.indexOf("tags");
      const noteIdx = header.indexOf("note");
      const statusIdx = header.indexOf("status");
      if (slugIdx === -1) throw new Error(tx("CSV needs a 'slug' column."));

      const validStatusIds = new Set(window.GOGPlusGameStatus.STATUSES.map((s) => s.id));
      const incomingTags = {};
      const incomingNotes = {};
      const incomingStatus = {};
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const slug = (row[slugIdx] || "").trim();
        if (!slug) continue;
        if (tagsIdx >= 0 && row[tagsIdx]) {
          incomingTags[slug] = row[tagsIdx]
            .split(";")
            .map((t) => t.trim())
            .filter(Boolean);
        }
        if (noteIdx >= 0 && row[noteIdx]) {
          incomingNotes[slug] = row[noteIdx];
        }
        if (statusIdx >= 0 && row[statusIdx]) {
          const s = row[statusIdx].trim().toLowerCase();
          if (validStatusIds.has(s)) incomingStatus[slug] = s;
        }
      }

      const tagCount = Object.values(incomingTags).reduce((a, b) => a + b.length, 0);
      const noteCount = Object.keys(incomingNotes).length;
      const statusCount = Object.keys(incomingStatus).length;
      const mode = confirm(
        tx(
          `Import ${tagCount} tag(s) across ${Object.keys(incomingTags).length} game(s), ` +
            `${noteCount} note(s), and ${statusCount} play status(es).\n\n` +
            `OK = merge (add to existing without losing current).\n` +
            `Cancel = abort.`
        )
      );
      if (!mode) return;

      const { tags = {}, notes = {}, gameStatus = {} } = await window.GOGPlusStorage.get({
        tags: {},
        notes: {},
        gameStatus: {},
      });
      for (const [slug, arr] of Object.entries(incomingTags)) {
        tags[slug] = Array.from(new Set([...(tags[slug] || []), ...arr]));
      }
      for (const [slug, note] of Object.entries(incomingNotes)) {
        // Don't clobber existing non-empty notes silently
        if (!notes[slug]) notes[slug] = note;
      }
      for (const [slug, status] of Object.entries(incomingStatus)) {
        // Don't clobber an existing status silently
        if (!gameStatus[slug]) gameStatus[slug] = status;
      }
      await window.GOGPlusStorage.set({ tags, notes, gameStatus });
      flashSaved();
      load();
      alert(tx(`Imported. Tags now span ${Object.keys(tags).length} game(s).`));
    } catch (err) {
      alert(tx("CSV import failed: " + err.message));
    } finally {
      e.target.value = "";
    }
  });

  // Tags → CSV
  $("exportTagsCsv").addEventListener("click", async () => {
    const { tags = {}, notes = {}, gameStatus = {} } = await window.GOGPlusStorage.get({
      tags: {},
      notes: {},
      gameStatus: {},
    });
    const rows = [["slug", "tags", "note", "status"]];
    const slugs = new Set([...Object.keys(tags), ...Object.keys(notes), ...Object.keys(gameStatus)]);
    for (const slug of slugs) {
      const t = (tags[slug] || []).join("; ");
      const n = (notes[slug] || "").replace(/"/g, '""').replace(/\r?\n/g, " ");
      const s = gameStatus[slug] || "";
      rows.push([slug, `"${t.replace(/"/g, '""')}"`, `"${n}"`, s]);
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
    if (!confirm(tx("Clear ALL price history? This cannot be undone."))) return;
    await window.GOGPlusStorage.set({ priceHistory: {} });
    flashSaved();
    load();
  });
  $("clearTags").addEventListener("click", async () => {
    if (!confirm(tx("Clear ALL tags and notes? This cannot be undone."))) return;
    await window.GOGPlusStorage.set({ tags: {}, notes: {} });
    flashSaved();
    load();
  });
  $("clearAll").addEventListener("click", async () => {
    if (
      !confirm(
        tx(
          "RESET EVERYTHING?\n\nThis wipes all settings, tags, notes, price history, " +
            "and refund-window entries from both sync and local storage. Cannot be undone."
        )
      )
    ) {
      return;
    }
    const phrase = prompt(tx("Type RESET (uppercase, no quotes) to confirm:"));
    if (phrase !== "RESET") {
      if (phrase !== null) alert(tx("Phrase didn't match. Nothing was deleted."));
      return;
    }
    await new Promise((r) => chrome.storage.sync.clear(() => r(undefined)));
    if (chrome.runtime.lastError) console.error("[GOG+] reset sync.clear failed:", chrome.runtime.lastError.message);
    await new Promise((r) => chrome.storage.local.clear(() => r(undefined)));
    if (chrome.runtime.lastError) console.error("[GOG+] reset local.clear failed:", chrome.runtime.lastError.message);
    // Note image attachments (lib/attachments.js) live in IndexedDB, not
    // chrome.storage — not cleared by the two calls above. Best-effort,
    // fire-and-forget: deleteDatabase blocks until every open connection to
    // it closes, which could be forever if e.g. the tag dashboard is open in
    // another tab, and this reset flow shouldn't hang on that.
    try {
      indexedDB.deleteDatabase("gog-plus-attachments");
    } catch (_) {
      // Non-fatal — the rest of the reset already succeeded.
    }
    flashSaved();
    setTimeout(() => location.reload(), 500);
  });
}

// Filters the settings cards by free-text match against each card's
// visible content (heading + row labels + descriptions) — the page has
// grown to ~9 cards and keeps growing, so a quick way to jump to the right
// one beats scrolling. Whole cards are shown/hidden rather than individual
// rows: simpler, and every card here is already a coherent single topic.
function bindSettingsSearch() {
  const input = $("settingsSearch");
  if (!input) return;
  const cards = Array.from($$("main.page > .card"));
  const emptyMsg = $("settingsSearchEmpty");
  const emptyTerm = $("settingsSearchEmptyTerm");

  input.addEventListener("input", () => {
    const term = input.value.trim().toLowerCase();
    let anyVisible = false;
    cards.forEach((card) => {
      const match = !term || (card.textContent || "").toLowerCase().includes(term);
      card.hidden = !match;
      if (match) anyVisible = true;
    });
    if (emptyMsg) {
      emptyMsg.hidden = !term || anyVisible;
      if (emptyTerm) emptyTerm.textContent = input.value.trim();
    }
  });
}

document.addEventListener(
  "DOMContentLoaded",
  () => {
    load();
    bind();
    bindSettingsSearch();
    const heroVersion = $("heroVersion");
    if (heroVersion) heroVersion.textContent = `v${chrome.runtime.getManifest().version}`;
    const footerVersion = $("footerVersion");
    if (footerVersion) footerVersion.textContent = `v${chrome.runtime.getManifest().version}`;
  },
  // { once: true } isn't just tidiness — without it, a test harness that
  // re-imports this module against the same long-lived `document` (as
  // options.test.js's bootOptions() does via vi.resetModules()) accumulates
  // one listener per import. Every later DOMContentLoaded dispatch then
  // re-runs *every* earlier test's bind(), attaching duplicate click/change
  // listeners to the current test's fresh elements — silently harmless for
  // loose `toHaveBeenCalled()` assertions, but it multiplies real side
  // effects (multiple alerts, multiple decrypt attempts) once a test checks
  // something stricter. DOMContentLoaded only ever fires once on a real
  // page anyway, so this changes nothing about production behavior.
  { once: true }
);
