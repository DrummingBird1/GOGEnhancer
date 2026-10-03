/**
 * GOG+ tag dashboard: the Library hub — what the extension can do with the
 * whole collection once it knows what is in it. A monthly "finished" goal,
 * what the sales saved you, a backlog roulette weighted by what you'd probably
 * enjoy, a yearly "Wrapped" and a collector card (each downloadable as a PNG),
 * exports for Obsidian / Sheets / Notion / Trello, a share link for your tags,
 * and the folder-sync status line (the dashboard syncs by itself on open when
 * the browser lets it).
 *
 * Everything is computed locally by lib/library-tools.js and lib/deals.js from
 * data already in storage; the only I/O is files the user downloads and text
 * they copy. The PNG cards are drawn on a canvas — nothing is uploaded.
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusTagsState;
  const { $ } = window.GOGPlusTagsConstants;

  /** @param {string} tag @param {string} [cls] @param {string} [text] @returns {HTMLElement} */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /** @param {string} label @param {() => void | Promise<void>} fn @param {string} [cls] */
  function button(label, fn, cls = "ghost") {
    const b = /** @type {HTMLButtonElement} */ (el("button", cls, label));
    b.type = "button";
    b.addEventListener("click", () => {
      Promise.resolve(fn()).catch((err) => say(err instanceof Error ? err.message : String(err), true));
    });
    return b;
  }

  /** Everything the library tools need, shaped like the storage keys. */
  function libraryData() {
    return {
      tags: state.allTags,
      notes: state.allNotes,
      gameStatus: state.allStatus,
      purchaseLog: state.allPurchases,
      priceHistory: state.allHistory,
      ownedSlugs: state.allOwned,
      gameFacts: state.allFacts,
      gameGenres: state.allGenres,
      statusDates: state.statusDates,
      rates: state.rates,
      wishlistSlugs: state.allWishlistSlugs,
    };
  }

  const target = () => (state.targetCurrency && state.targetCurrency !== "none" ? state.targetCurrency : "USD");
  const sym = () => window.GOGPlusCurrencyFormat.symbolFor(target());

  /** @param {Blob} blob @param {string} name */
  function downloadBlob(name, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** @param {string} text */
  async function copy(text) {
    await navigator.clipboard.writeText(text);
  }

  /** Reports to the hub's one status line. @param {string} msg @param {boolean} [isError] */
  function say(msg, isError = false) {
    const s = $("hubStatus");
    if (!s) return;
    s.textContent = msg;
    s.classList.toggle("has-error", isError);
  }

  const today = () => new Date().toISOString().slice(0, 10);

  /* ---------------- goal ---------------- */

  /** @returns {HTMLElement | null} */
  function goalCard() {
    if (!(state.monthlyGoal > 0)) return null;
    const p = window.GOGPlusLibraryTools.monthlyProgress({ statusDates: state.statusDates, goal: state.monthlyGoal });
    const card = el("div", "hub-card");
    card.appendChild(el("h3", "", "Finished this month"));
    card.appendChild(el("p", "hub-big", `${p.finished} of ${p.goal}`));
    const bar = el("div", "hub-bar");
    const fill = el("div", "hub-bar-fill");
    fill.style.width = `${p.pct}%`;
    bar.appendChild(fill);
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuenow", String(p.pct));
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    card.appendChild(bar);
    card.appendChild(
      el("p", "hub-sub", `${p.daysLeft} day${p.daysLeft === 1 ? "" : "s"} left · ${p.finished >= p.goal ? "goal reached 🎉" : p.onTrack ? "on track" : "a little behind"}`)
    );
    return card;
  }

  /* ---------------- savings ---------------- */

  /** @returns {HTMLElement | null} */
  function savingsCard() {
    const s = window.GOGPlusDeals.savingsSummary({
      purchaseLog: state.allPurchases,
      priceHistory: state.allHistory,
      rates: state.rates,
      target: target(),
    });
    if (!s.rows.length) return null;
    const card = el("div", "hub-card");
    card.appendChild(el("h3", "", "What the sales saved you"));
    card.appendChild(el("p", "hub-big", `≈ ${sym()}${s.total.toFixed(0)}`));
    const thisYear = String(new Date().getFullYear());
    card.appendChild(
      el("p", "hub-sub", `${s.byYear[thisYear] ? `${sym()}${s.byYear[thisYear].toFixed(0)} in ${thisYear} · ` : ""}${s.rows.length} purchase${s.rows.length === 1 ? "" : "s"} with a price paid, against the highest list price you've seen. An estimate.`)
    );
    return card;
  }

  /* ---------------- roulette ---------------- */

  function rouletteCard() {
    const card = el("div", "hub-card");
    card.appendChild(el("h3", "", "Backlog roulette"));
    const out = el("div", "hub-roulette");
    out.id = "hubRoulette";
    const spin = () => {
      const L = window.GOGPlusLibraryTools;
      const slugs = Object.entries(state.allStatus).filter(([, s]) => s === "backlog").map(([slug]) => slug);
      out.replaceChildren();
      if (!slugs.length) {
        out.appendChild(el("p", "hub-sub", "Nothing is marked “backlog” yet — set a play status on a game and it joins the roulette."));
        return;
      }
      const pick = L.weightedPick(L.backlogWeights(slugs, libraryData()));
      if (!pick) return;
      const a = /** @type {HTMLAnchorElement} */ (el("a", "hub-pick", pick.title));
      a.href = `https://www.gog.com/en/game/${encodeURIComponent(pick.slug)}`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      out.append(a, el("p", "hub-sub", pick.why.length ? `More likely because: ${pick.why.join(", ")}` : "Picked at random"));
      out.appendChild(
        button("Start playing it", async () => {
          const next = { ...state.allStatus, [pick.slug]: "playing" };
          state.allStatus = next;
          await window.GOGPlusStorage.set({ gameStatus: next });
          window.GOGPlusTagsGamesList.renderGames();
          say(`${pick.title} is now marked as playing.`);
          spin();
        })
      );
    };
    card.append(button("Spin", spin, "primary"), out);
    return card;
  }

  /* ---------------- Wrapped ---------------- */

  /** @returns {HTMLElement} */
  function wrappedCard() {
    const L = window.GOGPlusLibraryTools;
    const card = el("div", "hub-card hub-card--wide");
    card.appendChild(el("h3", "", "Your year in games"));
    const thisYear = new Date().getFullYear();
    const years = new Set([thisYear]);
    for (const raw of Object.values(state.allPurchases)) {
      const d = typeof raw === "string" ? raw : /** @type {any} */ (raw)?.date;
      if (d) years.add(Number(d.slice(0, 4)));
    }
    const sel = /** @type {HTMLSelectElement} */ (el("select", "toolbar-select"));
    sel.id = "hubWrappedYear";
    for (const y of [...years].filter(Number.isFinite).sort((a, b) => b - a)) {
      const o = /** @type {HTMLOptionElement} */ (el("option", "", String(y)));
      o.value = String(y);
      sel.appendChild(o);
    }
    const body = el("div", "hub-wrapped");
    body.id = "hubWrapped";
    /** @returns {{ w: any, saved: number }} */
    const compute = () => {
      const year = Number(sel.value);
      const w = L.wrappedStats(libraryData(), year, { target: target() });
      const saved = window.GOGPlusDeals.savingsSummary({ purchaseLog: state.allPurchases, priceHistory: state.allHistory, rates: state.rates, target: target() }).byYear[String(year)] || 0;
      return { w, saved };
    };
    const text = (/** @type {any} */ w, /** @type {number} */ saved) =>
      [
        `${w.year} in games`,
        `${w.bought} games bought, ${sym()}${w.spent.toFixed(0)} spent${saved > 0 ? `, about ${sym()}${saved.toFixed(0)} saved on sales` : ""}`,
        `${w.finished} finished${w.topGenre ? `, mostly ${w.topGenre}` : ""}`,
        w.topTags.length ? `Top tags: ${w.topTags.map((/** @type {any} */ t) => `${t.tag} (${t.count})`).join(", ")}` : "",
        w.priciest ? `Priciest: ${w.priciest.title} (${sym()}${w.priciest.paid.toFixed(0)})` : "",
      ].filter(Boolean).join("\n");
    const paint = () => {
      const { w, saved } = compute();
      body.replaceChildren();
      const grid = el("div", "hub-stats");
      for (const [label, value] of [
        ["bought", String(w.bought)],
        ["spent", `${sym()}${w.spent.toFixed(0)}`],
        ["finished", String(w.finished)],
        ["saved on sales", saved > 0 ? `${sym()}${saved.toFixed(0)}` : "—"],
      ]) {
        const s = el("div", "hub-stat");
        s.append(el("strong", "", value), el("span", "", label));
        grid.appendChild(s);
      }
      body.appendChild(grid);
      if (w.topTags.length) body.appendChild(el("p", "hub-sub", `Top tags: ${w.topTags.map((/** @type {any} */ t) => `${t.tag} (${t.count})`).join(", ")}`));
      const actions = el("div", "hub-actions");
      actions.append(
        button("Download card (PNG)", async () => {
          const blob = await window.GOGPlusShareCard.toPng(window.GOGPlusShareCard.wrappedModel(w, { saved }));
          downloadBlob(`gog-wrapped-${w.year}.png`, blob);
          say("Saved the card as an image — it was drawn on this device, nothing was uploaded.");
        }),
        button("Copy as text", async () => {
          await copy(text(w, saved));
          say("Copied.");
        })
      );
      body.appendChild(actions);
    };
    sel.addEventListener("change", paint);
    card.append(sel, body);
    paint();
    return card;
  }

  /* ---------------- collector card ---------------- */

  /** @returns {HTMLElement} */
  function collectorCardEl() {
    const c = window.GOGPlusLibraryTools.collectorCard(libraryData());
    const card = el("div", "hub-card");
    card.appendChild(el("h3", "", "Collector card"));
    if (!c.owned) {
      card.appendChild(el("p", "hub-sub", "The extension learns your library from the “IN LIBRARY” labels while you browse gog.com signed in. Browse the catalog and this fills in."));
      return card;
    }
    card.appendChild(el("p", "hub-big", `${c.owned} games`));
    card.appendChild(
      el("p", "hub-sub", c.classicPct === null ? "Open game pages to learn release years." : `${c.classicPct}% are at least 15 years old (“Good Old Games”) — from ${c.yearsKnown} with a known year.`)
    );
    const decades = Object.entries(c.byDecade).sort();
    if (decades.length) {
      const max = Math.max(...decades.map(([, n]) => n));
      const chart = el("div", "hub-decades");
      for (const [d, n] of decades) {
        const row = el("div", "hub-decade");
        const bar = el("span", "hub-decade-bar");
        bar.style.width = `${Math.max(6, Math.round((n / max) * 100))}%`;
        row.append(el("span", "hub-decade-label", d), bar, el("span", "hub-decade-n", String(n)));
        chart.appendChild(row);
      }
      card.appendChild(chart);
    }
    card.appendChild(
      button("Download card (PNG)", async () => {
        downloadBlob("gog-collection.png", await window.GOGPlusShareCard.toPng(window.GOGPlusShareCard.collectorModel(c)));
        say("Saved the card as an image.");
      })
    );
    return card;
  }

  /* ---------------- exports ---------------- */

  /** @returns {HTMLElement} */
  function exportsCard() {
    const card = el("div", "hub-card hub-card--wide");
    card.appendChild(el("h3", "", "Take your library elsewhere"));
    card.appendChild(el("p", "hub-sub", "Files and clipboard text only — nothing is sent anywhere."));
    const row = el("div", "hub-actions");
    row.append(
      button("Obsidian vault (.zip)", () => {
        const files = window.GOGPlusLibraryTools.obsidianFiles(libraryData());
        const zip = window.GOGPlusZip.buildZip(files);
        downloadBlob(`gog-enhancer-vault-${today()}.zip`, new Blob([/** @type {BlobPart} */ (zip)], { type: "application/zip" }));
        say(`Exported ${files.length - 1} notes. Unzip into your Obsidian vault.`);
      }),
      button("Spreadsheet / Notion (.csv)", () => {
        downloadBlob(`gog-enhancer-library-${today()}.csv`, new Blob([window.GOGPlusExportFormats.libraryCsv(libraryData())], { type: "text/csv" }));
        say("Exported a CSV — open it in Sheets or Excel, or import it into a Notion database.");
      }),
      button("Copy for Trello", async () => {
        const lines = window.GOGPlusExportFormats.trelloLines(libraryData(), { status: "backlog" }) || window.GOGPlusExportFormats.trelloLines(libraryData());
        await copy(lines);
        say(`Copied ${lines ? lines.split("\n").length : 0} lines — paste them into Trello's “add multiple cards” box.`);
      }),
      button("Copy a link to my tags", async () => {
        const slugs = Object.keys(state.allTags).filter((s) => (state.allTags[s] || []).length);
        if (!slugs.length) {
          say("Tag some games first — the link carries your tags.", true);
          return;
        }
        const Pack = window.GOGPlusPack;
        const pack = Pack.buildPack({ slugs, tags: state.allTags, notes: {}, purchaseLog: {}, tagColors: state.tagColors }, "My tags");
        const url = Pack.shareUrl(await Pack.encodeShare(pack));
        await copy(url);
        say(`Copied a link with ${slugs.length} tagged games${url.length > 8000 ? " — it is long, so some chat apps may cut it off" : ""}. Whoever opens it with GOG Enhancer is asked before anything is imported; notes and purchases are never in it.`);
      })
    );
    card.appendChild(row);
    return card;
  }

  /* ---------------- sync row ---------------- */

  /**
   * @param {{ ran: boolean, reason?: string, result?: any } | null} sync
   * @param {{ ran: boolean, reason?: string, result?: any } | null} backup
   * @param {number} conflicts
   * @returns {HTMLElement | null}
   */
  function syncRow(sync, backup, conflicts) {
    if (!state.syncFolderName) return null;
    const row = el("div", "hub-sync");
    const msg = el("span", "");
    if (sync?.ran) msg.textContent = `Synced with “${state.syncFolderName}” ${sync.result?.pulled ? "— pulled newer data from it" : "— up to date"}.`;
    else if (sync?.reason === "permission") msg.textContent = `Sync paused: the browser needs you to re-allow the folder “${state.syncFolderName}”.`;
    else if (sync?.reason === "passphrase") msg.textContent = "Sync paused: the sync file is encrypted — press Sync now to enter its passphrase.";
    else if (sync?.reason === "recent") msg.textContent = `Synced a moment ago with “${state.syncFolderName}”.`;
    else if (sync?.reason && sync.reason !== "off") msg.textContent = `Sync failed: ${sync.reason}`;
    else msg.textContent = `Sync folder: “${state.syncFolderName}”.`;
    row.appendChild(msg);
    if (backup?.ran) row.appendChild(el("span", "hub-sub", ` Backup written: ${backup.result.file}.`));
    row.appendChild(
      button("Sync now", async () => {
        say("Syncing…");
        const core = window.GOGPlusFolderSyncCore;
        const r = await core.syncNow({ askPassphrase: (m) => window.prompt(m), interactive: true });
        say(core.describeResult(r));
        if (r.pulled) await window.GOGPlusTagsBoot?.refresh();
      })
    );
    if (conflicts) {
      row.appendChild(button(`${conflicts} sync conflict${conflicts === 1 ? "" : "s"} to review`, () => chrome.runtime.openOptionsPage()));
    }
    return row;
  }

  /* ---------------- assembly ---------------- */

  /**
   * @param {{ sync?: any, backup?: any, conflicts?: number }} [info] the last auto-sync outcome
   */
  function renderHub(info = {}) {
    const host = $("libraryHub");
    if (!host) return;
    host.replaceChildren();
    const head = el("div", "hub-head");
    head.appendChild(el("h2", "", "Library hub"));
    const status = el("p", "hub-status");
    status.id = "hubStatus";
    status.setAttribute("role", "status");
    head.appendChild(status);
    host.appendChild(head);
    const sync = syncRow(info.sync || null, info.backup || null, info.conflicts || 0);
    if (sync) host.appendChild(sync);
    const grid = el("div", "hub-grid");
    for (const c of [goalCard(), savingsCard(), rouletteCard(), collectorCardEl(), wrappedCard(), exportsCard()]) if (c) grid.appendChild(c);
    host.appendChild(grid);
  }

  /**
   * Syncs and backs up on open when the browser allows it without asking, then
   * redraws the hub with what happened.
   */
  async function runAutoSync() {
    const core = window.GOGPlusFolderSyncCore;
    const sync = await core.autoSync({ interactive: false });
    const backup = await core.autoBackup({ interactive: false });
    const { syncConflicts = [] } = await window.GOGPlusStorage.get(["syncConflicts"]);
    if (sync.ran && sync.result?.pulled) await window.GOGPlusTagsBoot?.refresh();
    renderHub({ sync, backup, conflicts: syncConflicts.length });
  }

  window.GOGPlusTagsLibraryHub = { renderHub, runAutoSync, libraryData, _internals: { goalCard, savingsCard, rouletteCard, wrappedCard, collectorCardEl, exportsCard, syncRow } };
})();
