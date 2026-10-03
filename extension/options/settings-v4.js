/**
 * GOG+ options page: the v4 settings — game-page tools, catalog / wishlist /
 * library tools, notifications (quiet hours, daily digest, thresholds, tag
 * alerts, the optional webhook), "My PC", and the look-and-feel extras
 * (colour-vision palette, text size, calm mode, plain look, dock, profiles).
 *
 * The cards are built here, from the lists below, instead of being hand-written
 * into options.html: every row is "a storage key, a label, a control", and
 * writing them as data keeps the load / bind code from being copied 40 times.
 * The script runs as soon as it loads (the page's scripts sit at the end of
 * <body>, so the DOM is there) rather than on DOMContentLoaded, so the new
 * cards exist before options.js builds its settings search over the page.
 *
 * Nothing here talks to the network. The one exception the page offers — the
 * optional webhook — only stores an https URL and asks the BROWSER for
 * permission to reach that single origin; the posting itself happens in the
 * service worker, and only the text of a notification is ever sent.
 */

(() => {
  "use strict";

  /** The page's controls are looked up by id and used as inputs, buttons, … — typed loosely on purpose. */
  const $ = /** @type {(id: string) => any} */ ((id) => document.getElementById(id));
  const Storage = () => window.GOGPlusStorage;

  /* ---------- tiny DOM builders ---------- */

  /**
   * @param {string} tag @param {string} [cls] @param {string} [text]
   * @returns {HTMLElement}
   */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /** @param {string} title @param {string} sub */
  function textBlock(title, sub) {
    const box = el("span", "dev-toggle-text");
    box.append(el("span", "dev-toggle-title", title), el("span", "dev-toggle-sub", sub));
    return box;
  }

  /** @param {string} id @param {string} title @param {string} sub */
  function toggle(id, title, sub) {
    const label = el("label", "dev-toggle");
    const input = /** @type {HTMLInputElement} */ (el("input"));
    input.type = "checkbox";
    input.id = id;
    label.append(input, textBlock(title, sub));
    return label;
  }

  /** @param {string} title @param {string} sub @param {...HTMLElement} controls */
  function row(title, sub, ...controls) {
    const r = el("div", "dev-row");
    const text = el("div", "dev-toggle-text");
    text.append(el("span", "dev-toggle-title", title), el("span", "dev-toggle-sub", sub));
    const box = el("div", "dev-num-suffixed");
    box.append(...controls);
    r.append(text, box);
    return r;
  }

  /** @param {string} id @param {Array<[string, string]>} options */
  function select(id, options) {
    const s = /** @type {HTMLSelectElement} */ (el("select", "dev-select"));
    s.id = id;
    for (const [v, t] of options) {
      const o = /** @type {HTMLOptionElement} */ (el("option", "", t));
      o.value = v;
      s.appendChild(o);
    }
    return s;
  }

  /** @param {string} id @param {Record<string, string>} [attrs] */
  function input(id, attrs = {}) {
    const i = /** @type {HTMLInputElement} */ (el("input", "dev-num"));
    i.id = id;
    for (const [k, v] of Object.entries(attrs)) i.setAttribute(k, v);
    return i;
  }

  /** @param {string} title @param {string} sub @param {HTMLElement[]} body */
  function card(title, sub, body) {
    const c = el("section", "card");
    c.append(el("h2", "", title), el("p", "card-sub", sub), ...body);
    return c;
  }

  function flash() {
    const s = $("saveStatus");
    if (!s) return;
    s.textContent = "Saved ✓";
    setTimeout(() => (s.textContent = "Saved automatically."), 1400);
  }

  /* ---------- the settings, as data ---------- */

  /** [key, title, description] — plain on/off switches. */
  const GAME_TOGGLES = /** @type {Array<[string, string, string]>} */ ([
    ["realDiscountCheck", "Is the discount real?", "Compares the advertised “−50%” with GOG's own “lowest price in the last 30 days” figure and with the prices you've seen yourself, and says when a sale isn't cheaper than it recently was."],
    ["offerTimer", "Offer countdown", "How long the current offer has left, on the game page and as a badge on cards of games you've opened (inside the last 3 days)."],
    ["pricePerHour", "Price per hour of play", "Divides the price by GOG's own time-to-beat figures."],
    ["currencyTable", "Price in other currencies", "A small table of the price in every currency the extension has a rate for."],
    ["saleForecast", "Sale rhythm", "How often a game has been on sale in YOUR recorded visits, and a rough guess for the next one. Needs a few visits to say anything."],
    ["languageMeter", "Language check", "Shows whether the game supports your language (text and audio)."],
    ["changesSinceVisit", "What changed since your last visit", "Price, discount, rating and review count — compared with the last time you opened the page."],
    ["reviewTools", "Review filter", "A star / verified-owner filter above the user reviews. Filters only the reviews the page has loaded."],
    ["similarOwned", "Similar games you own", "Links to games in your library that share tags with this one."],
    ["openInLinks", "“Open in…” links", "Link-only buttons to IsThereAnyDeal, Steam, PCGamingWiki, HowLongToBeat and SteamDB. Nothing is sent until you click one."],
  ]);

  const LIBRARY_TOGGLES = /** @type {Array<[string, string, string]>} */ ([
    ["ownershipLearning", "Learn what's in my library", "Reads the site's own “IN LIBRARY” labels as you browse, so the extension knows which games you own — it powers hiding owned games, the library statistics and the “already own” warnings. Stored on this device."],
    ["catalogTools", "Catalog tools", "A bar above the catalog: sort this page, hide or dim owned games, hide games you're not interested in, compare games side by side, tag several at once, save searches."],
    ["hideNotInterested", "Hide “not interested” games", "Keeps games you've hidden out of catalogs and carousels. Turn off to see them again (they stay marked)."],
    ["endlessCatalog", "Endless scrolling in catalogs", "When you reach the end of the 48 games on a catalog page, the next page is added below it. Asks GOG's own catalog API (catalog.gog.com) for it — the same call the site makes — and only continues a list it can match to the one on screen. Off by default."],
    ["packContents", "Warn about packs that overlap my library", "On a game page, asks GOG's product API (api.gog.com) once what the game contains (only its numeric id is sent) so a pack that includes games you already own can say so. The answer is remembered for 30 days."],
    ["wishlistSmart", "Smart wishlist", "Sort by discount or closeness to your tracked low, filter “near my low” / “ending soon”, group by tag, a live total, and CSV / Markdown / calendar export."],
  ]);

  const APPEARANCE_TOGGLES = /** @type {Array<[string, string, string]>} */ ([
    ["calmMode", "Calm mode", "No glow, blur or animation in anything GOG Enhancer adds."],
    ["plainLook", "Plain look", "Turns off all of GOG Enhancer's styling so gog.com looks like itself. The features keep working."],
    ["panelSticky", "Dock the game panel", "On wide screens (1700 px and up) keeps the insights panel beside the page instead of in the flow."],
  ]);

  const PALETTES = /** @type {Array<[string, string]>} */ ([
    ["default", "Default (green / amber / pink)"],
    ["deuteranopia", "Red-green friendly (deuteranopia)"],
    ["protanopia", "Red-green friendly (protanopia)"],
    ["tritanopia", "Blue-yellow friendly (tritanopia)"],
    ["high-contrast", "High contrast"],
  ]);

  /* ---------- builders for the bigger pieces ---------- */

  function buildMyPc() {
    const fields = /** @type {Array<[string, string, string, string]>} */ ([
      ["myPcRam", "Memory (GB)", "number", "16"],
      ["myPcStorage", "Free disk space (GB)", "number", "200"],
      ["myPcVram", "Video memory (GB) — informational", "number", "8"],
      ["myPcOs", "Operating system", "text", "Windows 11"],
      ["myPcCpu", "Processor", "text", "Ryzen 5 5600"],
      ["myPcGpu", "Graphics card", "text", "RTX 3060"],
    ]);
    const grid = el("div", "mypc-grid");
    for (const [id, label, type, ph] of fields) {
      const wrap = el("label", "mypc-field");
      wrap.append(el("span", "", label));
      const i = input(id, { type, placeholder: ph });
      if (type === "number") {
        i.min = "0";
        i.step = "1";
      }
      wrap.appendChild(i);
      grid.appendChild(wrap);
    }
    return grid;
  }

  function buildTagAlerts() {
    const wrap = el("div", "tagalerts");
    wrap.id = "tagAlertsList";
    const add = el("div", "tagalert-add");
    const tag = input("tagAlertTag", { type: "text", placeholder: "tag name", list: "tagAlertTagOptions", maxlength: "40" });
    const list = el("datalist");
    list.id = "tagAlertTagOptions";
    const amount = input("tagAlertAmount", { type: "number", min: "0", step: "0.01", placeholder: "10.00" });
    const cur = select("tagAlertCurrency", ["USD", "EUR", "GBP", "ILS", "PLN", "RUB"].map((c) => [c, c]));
    const btn = /** @type {HTMLButtonElement} */ (el("button", "ghost", "Add tag alert"));
    btn.type = "button";
    btn.id = "tagAlertAdd";
    add.append(tag, list, amount, cur, btn);
    const box = el("div");
    box.append(wrap, add);
    return box;
  }

  function buildWebhook() {
    const box = el("div", "webhook-box");
    box.append(
      toggle(
        "webhookEnabled",
        "Also send notifications to my own webhook",
        "Opt-in. When a notification fires, its title and message are POSTed to the https URL below (a Discord webhook, ntfy, or any endpoint that accepts JSON). Only that text is sent — never your tags, notes, history or library. You choose the URL; the browser asks your permission for that one address."
      )
    );
    const r = el("div", "webhook-row");
    const url = input("webhookUrl", { type: "url", placeholder: "https://discord.com/api/webhooks/…", autocomplete: "off", spellcheck: "false" });
    url.classList.remove("dev-num");
    url.classList.add("webhook-url");
    const save = /** @type {HTMLButtonElement} */ (el("button", "primary", "Save & allow access"));
    save.type = "button";
    save.id = "webhookSave";
    const test = /** @type {HTMLButtonElement} */ (el("button", "ghost", "Send a test"));
    test.type = "button";
    test.id = "webhookTest";
    r.append(url, save, test);
    const status = el("p", "card-sub");
    status.id = "webhookStatus";
    status.setAttribute("role", "status");
    box.append(r, status);
    return box;
  }

  function buildProfiles() {
    const P = window.GOGPlusSettingsProfiles;
    const box = el("div", "profile-row");
    const sel = select("settingsProfile", [["", "Choose a profile…"], ...Object.entries(P.PROFILES).map(/** @returns {[string, string]} */ ([id, p]) => [id, p.label])]);
    const btn = /** @type {HTMLButtonElement} */ (el("button", "ghost", "Apply"));
    btn.type = "button";
    btn.id = "settingsProfileApply";
    const hint = el("span", "card-sub");
    hint.id = "settingsProfileHint";
    box.append(el("span", "dev-toggle-title", "Settings profile"), sel, btn, hint);
    return box;
  }

  /* ---------- assembling the page ---------- */

  function build() {
    const main = document.querySelector("main.page");
    if (!main || $("v4GameCard")) return false;

    const lookCard = $("themePicker")?.closest(".card");
    if (lookCard) {
      const extra = el("div", "look-extras");
      extra.append(
        row("Colour-vision palette", "Redefines the good / warning / bad colours in everything GOG Enhancer adds.", select("palette", PALETTES)),
        row("Text size of the extension's UI", "Scales the panel, bars and dialogs (not gog.com itself).", input("uiScale", { type: "range", min: "0.8", max: "1.6", step: "0.05" }), el("span", "dev-num-suffix", "")),
        ...APPEARANCE_TOGGLES.map(([k, t, s]) => toggle(k, t, s)),
        buildProfiles()
      );
      const tour = /** @type {HTMLButtonElement} */ (el("button", "ghost", "Replay the v4 tour"));
      tour.type = "button";
      tour.id = "replayTour";
      extra.appendChild(tour);
      lookCard.appendChild(extra);
    }

    const game = card("Game page tools", "What the insights panel on a game's page can tell you. Every section can also be collapsed or dragged into your own order from the panel itself.", [
      ...GAME_TOGGLES.map(([k, t, s]) => toggle(k, t, s)),
      row("Languages I care about", "Comma-separated, e.g. “Hebrew, English”. Empty = your interface language.", input("preferredLanguages", { type: "text", placeholder: "Hebrew, English" })),
    ]);
    game.id = "v4GameCard";

    const mypc = card("My PC", "Optional. Describe your machine and the system check compares memory and disk space exactly; the processor, graphics card and OS are shown next to each game's requirements but never judged. Browsers can't read your hardware, so nothing here is detected — it is only what you type, stored on this device.", [buildMyPc()]);

    const library = card("Catalog, wishlist & library", "Tools for the pages that list many games, and what the extension learns about your library.", [
      ...LIBRARY_TOGGLES.map(([k, t, s]) => toggle(k, t, s)),
      row("Owned games in catalogs", "What the catalog bar does with games you already own (you can also switch it there).", select("ownedDisplay", [["show", "Show"], ["dim", "Dim"], ["hide", "Hide"]])),
      row("Catalog grid", "Compact fits more games on a screen.", select("catalogDensity", [["normal", "Normal"], ["compact", "Compact"]])),
      row("Games to finish per month", "Optional goal for the dashboard. 0 = no goal.", input("monthlyGoal", { type: "number", min: "0", max: "60", step: "1" })),
    ]);

    const notif = card("Notification rules", "How the notifications you've enabled (Developer & diagnostics → Desktop notifications) behave. Quiet hours and the daily digest hold alerts back instead of dropping them.", [
      row("Delivery", "Instantly as they happen, or one summary a day.", select("notifyMode", [["instant", "Instantly"], ["daily", "One summary a day"]])),
      toggle("quietEnabled", "Quiet hours", "Alerts that arrive during these hours wait, then arrive together when they end."),
      row("Quiet from / to", "24-hour clock; a window that crosses midnight is fine.", input("quietFrom", { type: "time" }), input("quietTo", { type: "time" })),
      row("Smallest drop worth an alert", "Ignore price drops smaller than this percentage. 0 = off.", input("notifyMinDiscount", { type: "number", min: "0", max: "90", step: "1" }), el("span", "dev-num-suffix", "%")),
      row("Only prices up to", "Ignore alerts above this price, in your target currency. 0 = off.", input("notifyMaxPrice", { type: "number", min: "0", step: "1" })),
      toggle("notifyOnlyAtLow", "Only at the tracked low", "Alert only when the price is the lowest you've recorded for that game."),
      toggle("seasonRadar", "Season radar", "Notify when gog.com's home page advertises a store-wide sale. It reads the page's headline when you visit, so it can only notice while you browse."),
      el("h3", "card-subhead", "Alerts by tag"),
      el("p", "card-sub", "One threshold for every game with a tag — e.g. any “co-op” game under 10. Checked daily, from the prices you've recorded."),
      buildTagAlerts(),
      el("h3", "card-subhead", "Webhook"),
      buildWebhook(),
    ]);

    const anchor = $("syncCard");
    const before = anchor || main.lastElementChild;
    for (const c of [game, mypc, library, notif]) main.insertBefore(c, before);
    return true;
  }

  /* ---------- load / bind ---------- */

  const SIMPLE_CHECKS = [...GAME_TOGGLES, ...LIBRARY_TOGGLES, ...APPEARANCE_TOGGLES].map(([k]) => k).concat(["notifyOnlyAtLow", "seasonRadar", "webhookEnabled"]);
  const SIMPLE_SELECTS = ["palette", "ownedDisplay", "catalogDensity", "notifyMode"];
  const SIMPLE_NUMBERS = /** @type {Array<[string, number, number, boolean]>} */ ([
    // key, min, max, integer
    ["uiScale", 0.8, 1.6, false],
    ["monthlyGoal", 0, 60, true],
    ["notifyMinDiscount", 0, 90, true],
    ["notifyMaxPrice", 0, 100000, false],
  ]);
  const PC_FIELDS = /** @type {Array<[string, string, boolean]>} */ ([
    ["myPcRam", "ramGB", true],
    ["myPcStorage", "storageGB", true],
    ["myPcVram", "vramGB", true],
    ["myPcOs", "os", false],
    ["myPcCpu", "cpu", false],
    ["myPcGpu", "gpu", false],
  ]);

  async function load() {
    const s = await Storage().get([
      ...SIMPLE_CHECKS, ...SIMPLE_SELECTS, ...SIMPLE_NUMBERS.map((n) => n[0]),
      "preferredLanguages", "myPc", "quietHours", "tagAlerts", "webhookUrl", "targetCurrency", "tags", "theme",
    ]);
    for (const k of SIMPLE_CHECKS) if ($(k)) /** @type {HTMLInputElement} */ ($(k)).checked = !!s[k];
    for (const k of SIMPLE_SELECTS) if ($(k)) /** @type {HTMLSelectElement} */ ($(k)).value = s[k];
    for (const [k] of SIMPLE_NUMBERS) if ($(k)) /** @type {HTMLInputElement} */ ($(k)).value = String(s[k]);
    if ($("preferredLanguages")) /** @type {HTMLInputElement} */ ($("preferredLanguages")).value = (s.preferredLanguages || []).join(", ");
    for (const [id, key] of PC_FIELDS) if ($(id)) /** @type {HTMLInputElement} */ ($(id)).value = s.myPc?.[key] ? String(s.myPc[key]) : "";
    const q = s.quietHours || {};
    if ($("quietEnabled")) /** @type {HTMLInputElement} */ ($("quietEnabled")).checked = !!q.enabled;
    if ($("quietFrom")) /** @type {HTMLInputElement} */ ($("quietFrom")).value = q.from || "22:00";
    if ($("quietTo")) /** @type {HTMLInputElement} */ ($("quietTo")).value = q.to || "08:00";
    if ($("webhookUrl")) /** @type {HTMLInputElement} */ ($("webhookUrl")).value = s.webhookUrl || "";
    renderTagAlerts(s.tagAlerts || {}, s.tags || {}, s.targetCurrency);
    renderProfileHint();
  }

  /** @param {Record<string, {threshold: number, currency: string}>} alerts @param {Record<string, string[]>} tags @param {string} cur */
  function renderTagAlerts(alerts, tags, cur) {
    const host = $("tagAlertsList");
    if (!host) return;
    host.replaceChildren();
    const names = Object.keys(alerts).sort((a, b) => a.localeCompare(b));
    if (!names.length) host.appendChild(el("p", "card-sub", "No tag alerts yet."));
    for (const name of names) {
      const a = alerts[name];
      const r = el("div", "tagalert-row");
      r.append(el("strong", "", name), el("span", "", `at or under ${a.threshold} ${a.currency}`));
      const rm = /** @type {HTMLButtonElement} */ (el("button", "ghost-mini", "remove"));
      rm.type = "button";
      rm.dataset.remove = name;
      rm.addEventListener("click", async () => {
        const { tagAlerts = {} } = await Storage().get(["tagAlerts"]);
        delete tagAlerts[name];
        await Storage().set({ tagAlerts });
        flash();
        load();
      });
      r.appendChild(rm);
      host.appendChild(r);
    }
    const dl = $("tagAlertTagOptions");
    if (dl) {
      dl.replaceChildren();
      const all = new Set(Object.values(tags).flat());
      for (const t of [...all].sort()) {
        const o = /** @type {HTMLOptionElement} */ (el("option"));
        o.value = t;
        dl.appendChild(o);
      }
    }
    if ($("tagAlertCurrency") && cur && cur !== "none") /** @type {HTMLSelectElement} */ ($("tagAlertCurrency")).value = cur;
  }

  async function renderProfileHint() {
    const hint = $("settingsProfileHint");
    if (!hint) return;
    const all = await Storage().get(window.GOGPlusSettingsProfiles.PROFILE_KEYS);
    const id = window.GOGPlusSettingsProfiles.matchingProfile(all);
    hint.textContent = id ? `Current settings match “${window.GOGPlusSettingsProfiles.PROFILES[id].label}”.` : "Your settings are custom.";
  }

  function bind() {
    for (const k of SIMPLE_CHECKS) {
      $(k)?.addEventListener("change", async () => {
        await Storage().set({ [k]: /** @type {HTMLInputElement} */ ($(k)).checked });
        flash();
        renderProfileHint();
      });
    }
    for (const k of SIMPLE_SELECTS) {
      $(k)?.addEventListener("change", async () => {
        await Storage().set({ [k]: /** @type {HTMLSelectElement} */ ($(k)).value });
        flash();
        renderProfileHint();
      });
    }
    for (const [k, min, max, integer] of SIMPLE_NUMBERS) {
      $(k)?.addEventListener("change", async () => {
        const inputEl = /** @type {HTMLInputElement} */ ($(k));
        let v = integer ? parseInt(inputEl.value, 10) : parseFloat(inputEl.value);
        if (!Number.isFinite(v)) v = k === "uiScale" ? 1 : 0;
        v = Math.min(max, Math.max(min, v));
        inputEl.value = String(v);
        await Storage().set({ [k]: v });
        flash();
        renderProfileHint();
      });
    }

    $("preferredLanguages")?.addEventListener("change", async () => {
      const names = /** @type {HTMLInputElement} */ ($("preferredLanguages")).value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 8);
      await Storage().set({ preferredLanguages: names });
      flash();
    });

    const savePc = async () => {
      /** @type {Record<string, any>} */
      const pc = {};
      let any = false;
      for (const [id, key, numeric] of PC_FIELDS) {
        const raw = /** @type {HTMLInputElement} */ ($(id)).value.trim();
        const v = numeric ? Math.max(0, parseFloat(raw) || 0) : raw.slice(0, 80);
        pc[key] = v;
        if (v) any = true;
      }
      await Storage().set({ myPc: any ? pc : null });
      flash();
    };
    for (const [id] of PC_FIELDS) $(id)?.addEventListener("change", savePc);

    const saveQuiet = async () => {
      await Storage().set({
        quietHours: {
          enabled: /** @type {HTMLInputElement} */ ($("quietEnabled")).checked,
          from: /** @type {HTMLInputElement} */ ($("quietFrom")).value || "22:00",
          to: /** @type {HTMLInputElement} */ ($("quietTo")).value || "08:00",
        },
      });
      flash();
    };
    for (const id of ["quietEnabled", "quietFrom", "quietTo"]) $(id)?.addEventListener("change", saveQuiet);

    $("tagAlertAdd")?.addEventListener("click", async () => {
      const tag = /** @type {HTMLInputElement} */ ($("tagAlertTag")).value.trim().slice(0, 40);
      const threshold = parseFloat(/** @type {HTMLInputElement} */ ($("tagAlertAmount")).value);
      if (!tag || !(threshold > 0)) return;
      const { tagAlerts = {} } = await Storage().get(["tagAlerts"]);
      tagAlerts[tag] = { threshold, currency: /** @type {HTMLSelectElement} */ ($("tagAlertCurrency")).value };
      await Storage().set({ tagAlerts });
      /** @type {HTMLInputElement} */ ($("tagAlertTag")).value = "";
      /** @type {HTMLInputElement} */ ($("tagAlertAmount")).value = "";
      flash();
      load();
    });

    $("webhookSave")?.addEventListener("click", saveWebhook);
    $("webhookTest")?.addEventListener("click", testWebhook);

    $("settingsProfileApply")?.addEventListener("click", async () => {
      const id = /** @type {HTMLSelectElement} */ ($("settingsProfile")).value;
      const settings = window.GOGPlusSettingsProfiles.applyProfile(id);
      if (!settings) return;
      await Storage().set(settings);
      flash();
      load();
    });

    $("replayTour")?.addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("tour/tour.html") });
    });
  }

  /** @param {string} msg @param {boolean} [isError] */
  function webhookSay(msg, isError = false) {
    const s = $("webhookStatus");
    if (!s) return;
    s.textContent = msg;
    s.classList.toggle("has-error", isError);
  }

  async function saveWebhook() {
    const Policy = window.GOGPlusNotifyPolicy;
    const raw = /** @type {HTMLInputElement} */ ($("webhookUrl")).value.trim();
    if (!raw) {
      await Storage().set({ webhookUrl: "", webhookEnabled: false });
      /** @type {HTMLInputElement} */ ($("webhookEnabled")).checked = false;
      webhookSay("Webhook removed.");
      return;
    }
    const url = Policy.sanitizeWebhookUrl(raw);
    if (!url) {
      webhookSay("That doesn't look like an https URL. Webhooks must use https so the message isn't sent in the clear.", true);
      return;
    }
    let granted = false;
    try {
      granted = await chrome.permissions.request({ origins: [Policy.webhookOrigin(url)] });
    } catch (err) {
      webhookSay(`The browser refused the permission request: ${err instanceof Error ? err.message : err}`, true);
      return;
    }
    if (!granted) {
      webhookSay("Permission wasn't granted, so the webhook can't be used. Nothing was saved.", true);
      return;
    }
    await Storage().set({ webhookUrl: url });
    flash();
    webhookSay(`Saved. Notifications will be posted to ${new URL(url).origin}. Press “Send a test” to check it.`);
  }

  async function testWebhook() {
    webhookSay("Sending…");
    try {
      const res = await chrome.runtime.sendMessage({ type: "webhook-test" });
      webhookSay(res?.ok ? "The test message was delivered." : `The test failed: ${res?.error || "no response"}`, !res?.ok);
    } catch (err) {
      webhookSay(`The test failed: ${err instanceof Error ? err.message : err}`, true);
    }
  }

  function init() {
    if (!build()) return;
    bind();
    load();
    Storage().onChange(({ key }) => {
      if (["tags", "tagAlerts", "targetCurrency"].includes(key)) load();
    });
  }

  // See the header: this must run before options.js builds its search index.
  // The page's scripts sit at the end of <body>, so its content is already
  // parsed even while readyState is still "loading".
  if (document.querySelector("main.page")) init();
  else document.addEventListener("DOMContentLoaded", init, { once: true });

  window.GOGPlusSettingsV4 = { init, build, load, saveWebhook, testWebhook };
})();
