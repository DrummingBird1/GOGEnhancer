/**
 * GOG+ tag-dashboard export/import: whole-library "tag pack" JSON
 * export/import, single-game JSON export, and CSV export. Pulled out of
 * the former single-file tags.js during the v2.8.0 module split.
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusTagsState;
  const { matchingSlugs, renderGames } = window.GOGPlusTagsGamesList;
  const { renderSaleHeatmap, renderStats, renderYearReview } = window.GOGPlusTagsStats;
  const { renderTagList } = window.GOGPlusTagsManagement;
  const { purchaseDateOf } = window.GOGPlusPurchases;

function exportPack() {
  const slugs = matchingSlugs();
  if (!slugs.length) {
    alert("No games match the current filter — nothing to export.");
    return;
  }
  const packName =
    prompt(
      `Name this pack (e.g. "RPG backlog 2026").\n\n` +
        `Will include ${slugs.length} game${slugs.length === 1 ? "" : "s"}.`,
      state.activeTag ? `${state.activeTag} pack` : `My GOG pack`
    );
  if (packName === null) return; // user cancelled
  const usedTagSet = new Set();
  const games = slugs.map((slug) => {
    const tags = state.allTags[slug] || [];
    tags.forEach((t) => usedTagSet.add(t));
    return {
      slug,
      tags,
      note: state.allNotes[slug] || "",
      purchaseDate: purchaseDateOf(state.allPurchases[slug]) || null,
    };
  });
  const usedColors = {};
  for (const t of usedTagSet) {
    if (state.tagColors[t]) usedColors[t] = state.tagColors[t];
  }
  const pack = {
    format: "gog-enhancer-tag-pack",
    formatVersion: 1,
    name: packName.trim() || "Untitled pack",
    exportedAt: new Date().toISOString(),
    gameCount: games.length,
    games,
    tagColors: usedColors,
  };
  const blob = new Blob([JSON.stringify(pack, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = pack.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  a.download = `gog-plus-pack-${safeName || "untitled"}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importPackFromFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const pack = JSON.parse(text);
    if (pack?.format !== "gog-enhancer-tag-pack") {
      throw new Error("Not a recognised tag pack (wrong format field).");
    }
    if (!Array.isArray(pack.games)) {
      throw new Error("Pack has no games array.");
    }
    const summary =
      `Import "${pack.name || "untitled"}"?\n\n` +
      `Pack contains ${pack.games.length} game${pack.games.length === 1 ? "" : "s"}.\n` +
      `Exported at ${pack.exportedAt || "unknown date"}.\n\n` +
      `Merge mode:\n` +
      `• Tags are added to your existing tags (no duplicates)\n` +
      `• Notes are only set if you don't already have one\n` +
      `• Purchase dates are only set if you don't already have one\n` +
      `• Tag colors are only set if you don't already have one\n\n` +
      `Nothing is overwritten.`;
    if (!confirm(summary)) return;

    let tagsAdded = 0;
    let notesAdded = 0;
    let purchasesAdded = 0;
    let colorsAdded = 0;
    for (const g of pack.games) {
      if (!g?.slug) continue;
      if (Array.isArray(g.tags) && g.tags.length) {
        const existing = new Set(state.allTags[g.slug] || []);
        const before = existing.size;
        for (const t of g.tags) existing.add(t);
        if (existing.size > before) {
          state.allTags[g.slug] = [...existing];
          tagsAdded += existing.size - before;
        }
      }
      if (g.note && !state.allNotes[g.slug]) {
        state.allNotes[g.slug] = g.note;
        notesAdded++;
      }
      if (g.purchaseDate && !state.allPurchases[g.slug]) {
        state.allPurchases[g.slug] = { date: g.purchaseDate };
        purchasesAdded++;
      }
    }
    if (pack.state.tagColors && typeof pack.state.tagColors === "object") {
      for (const [t, c] of Object.entries(pack.state.tagColors)) {
        if (!state.tagColors[t] && typeof c === "string" && /^#[0-9a-f]{3,8}$/i.test(c)) {
          state.tagColors[t] = c;
          colorsAdded++;
        }
      }
    }
    await window.GOGPlusStorage.set({
      tags: state.allTags,
      notes: state.allNotes,
      purchaseLog: state.allPurchases,
      tagColors: state.tagColors,
    });
    await renderStats();
    renderYearReview();
    renderSaleHeatmap();
    renderTagList();
    renderGames();
    alert(
      `Pack "${pack.name}" imported:\n` +
        `• ${tagsAdded} tag${tagsAdded === 1 ? "" : "s"} added\n` +
        `• ${notesAdded} note${notesAdded === 1 ? "" : "s"} added\n` +
        `• ${purchasesAdded} purchase date${purchasesAdded === 1 ? "" : "s"} added\n` +
        `• ${colorsAdded} tag color${colorsAdded === 1 ? "" : "s"} added`
    );
  } catch (err) {
    alert("Pack import failed: " + err.message);
  } finally {
    e.target.value = "";
  }
}

function exportSingleGame(slug) {
  const payload = {
    slug,
    exportedAt: new Date().toISOString(),
    tags: state.allTags[slug] || [],
    note: state.allNotes[slug] || "",
    purchaseDate: purchaseDateOf(state.allPurchases[slug]) || null,
    priceHistory: state.allHistory[slug] || [],
    tagColors: Object.fromEntries(
      (state.allTags[slug] || []).filter((t) => state.tagColors[t]).map((t) => [t, state.tagColors[t]])
    ),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gog-plus-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCsv() {
  const rows = [["slug", "tags", "note", "status"]];
  const slugs = new Set([
    ...Object.keys(state.allTags),
    ...Object.keys(state.allNotes),
    ...Object.keys(state.allStatus),
  ]);
  for (const slug of slugs) {
    const t = (state.allTags[slug] || []).join("; ");
    const n = (state.allNotes[slug] || "").replace(/"/g, '""').replace(/\r?\n/g, " ");
    const s = state.allStatus[slug] || "";
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
}

// Exports every wishlisted game with tracked price history as CSV — slug,
// title, latest recorded price, its currency, the tracked all-time low, and
// how far the latest price sits above that low. Built from the same
// wishlistSlugs + priceHistory data the "Wishlist value" stat card uses;
// wishlist items never visited on their own page have no price data and are
// skipped, same as that card.
function exportWishlistCsv() {
  const slugs = (state.allWishlistSlugs || []).filter((slug) => state.allHistory[slug]?.length);
  if (!slugs.length) {
    alert("No wishlisted games with tracked price history yet — visit a few game pages first.");
    return;
  }
  const rows = [["slug", "title", "latest_price", "currency", "all_time_low", "above_low_pct"]];
  for (const slug of slugs) {
    const hist = state.allHistory[slug];
    const latest = hist[hist.length - 1];
    const low = hist.reduce((a, e) => (e.p < a.p ? e : a), hist[0]);
    const abovePct = low.p > 0 ? Math.round(((latest.p - low.p) / low.p) * 100) : 0;
    rows.push([
      slug,
      `"${window.GOGPlusTagsGamesList.slugToTitle(slug).replace(/"/g, '""')}"`,
      latest.p.toFixed(2),
      latest.c,
      low.p.toFixed(2),
      String(abovePct),
    ]);
  }
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gog-plus-wishlist-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// A single self-contained, read-only HTML page snapshotting the currently
// filtered games — title, tags, notes, play status — for sharing outside
// the extension (Discord, a forum post, etc). No script, no external
// requests, no dependency on the extension being installed to view it.
function exportStaticHtml() {
  const { escapeHtml } = window.GOGPlusDomSafety;
  const slugs = matchingSlugs();
  if (!slugs.length) {
    alert("No games match the current filter — nothing to export.");
    return;
  }
  const { slugToTitle, renderMarkdown } = window.GOGPlusTagsGamesList;
  const title = state.activeTag ? `${state.activeTag} — GOG Enhancer library` : "My GOG Enhancer library";

  const rows = slugs
    .map((slug) => {
      const gTitle = slugToTitle(slug);
      const tags = state.allTags[slug] || [];
      const note = state.allNotes[slug] || "";
      const status = state.allStatus[slug] || "";
      const tagsHtml = tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join(" ");
      const noteHtml = note ? `<p class="note">${renderMarkdown(note)}</p>` : "";
      const statusHtml = status ? `<span class="status">${escapeHtml(status)}</span>` : "";
      return `
      <li class="game">
        <a href="https://www.gog.com/en/game/${encodeURIComponent(slug)}" target="_blank" rel="noopener">${escapeHtml(gTitle)}</a>${statusHtml}
        <div class="chips">${tagsHtml}</div>
        ${noteHtml}
      </li>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; background: #0a0612; color: #f4eaff; }
  h1 { font-size: 22px; margin: 0 0 6px; }
  .sub { color: rgba(244,234,255,0.6); font-size: 13px; margin: 0 0 24px; }
  ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 14px; }
  .game { border: 1px solid rgba(244,234,255,0.12); border-radius: 10px; padding: 14px 16px; }
  .game a { color: #00f0ff; text-decoration: none; font-weight: 700; font-size: 15px; }
  .game a:hover { text-decoration: underline; }
  .status { display: inline-block; margin-left: 8px; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; padding: 2px 8px; border-radius: 999px; background: rgba(198,79,255,0.15); color: #c64fff; vertical-align: middle; }
  .chips { margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap; }
  .chip { font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(244,234,255,0.2); color: rgba(244,234,255,0.8); }
  .note { margin: 8px 0 0; font-size: 13px; color: rgba(244,234,255,0.75); }
  footer { margin-top: 32px; font-size: 11px; color: rgba(244,234,255,0.4); }
  footer a { color: #00f0ff; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p class="sub">${slugs.length} game${slugs.length === 1 ? "" : "s"} · exported ${new Date().toISOString().slice(0, 10)} · read-only snapshot</p>
<ul>${rows}</ul>
<footer>Generated by <a href="https://github.com/DrummingBird1/GOGEnhancer" target="_blank" rel="noopener">GOG Enhancer</a>, an unofficial third-party GOG.com extension. Not affiliated with GOG sp. z o.o.</footer>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = (state.activeTag || "library").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  a.download = `gog-plus-${safeName || "library"}-${new Date().toISOString().slice(0, 10)}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

  window.GOGPlusTagsExportImport = {
    exportPack,
    importPackFromFile,
    exportSingleGame,
    exportCsv,
    exportWishlistCsv,
    exportStaticHtml,
  };
})();
