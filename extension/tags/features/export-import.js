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
      purchaseDate: state.allPurchases[slug] || null,
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
        state.allPurchases[g.slug] = g.purchaseDate;
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
    purchaseDate: state.allPurchases[slug] || null,
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
  const rows = [["slug", "tags", "note"]];
  const slugs = new Set([...Object.keys(state.allTags), ...Object.keys(state.allNotes)]);
  for (const slug of slugs) {
    const t = (state.allTags[slug] || []).join("; ");
    const n = (state.allNotes[slug] || "").replace(/"/g, '""').replace(/\r?\n/g, " ");
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
}

  window.GOGPlusTagsExportImport = {
    exportPack,
    importPackFromFile,
    exportSingleGame,
    exportCsv,
  };
})();
