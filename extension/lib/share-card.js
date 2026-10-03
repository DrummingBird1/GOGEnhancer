/**
 * GOG+ share cards — a PNG you can post: your year in games ("Wrapped") or a
 * collector card. Drawn locally on a <canvas>; nothing is uploaded and no
 * image is fetched (so the card never taints the canvas or leaks a request).
 *
 * The drawing is split in two so it can be tested without a canvas:
 *   layout(model)  → a list of plain draw operations (pure)
 *   render(ctx, ops) → replays them on any CanvasRenderingContext2D
 *
 * Model: { title, subtitle, accent, stats: [{ label, value }],
 *          lists: [{ title, rows: [{ label, value }] }], footer }
 */
// @ts-check

(() => {
  "use strict";

  const WIDTH = 1080;
  const HEIGHT = 1350;
  const PAD = 80;

  /**
   * @typedef {{ type: "rect", x: number, y: number, w: number, h: number, fill: string, radius?: number }
   *   | { type: "text", text: string, x: number, y: number, font: string, fill: string, align?: "left" | "right" | "center" }
   *   | { type: "gradient", stops: Array<[number, string]> }} Op
   * @typedef {{ label: string, value: string }} Row
   * @typedef {{
   *   title: string, subtitle?: string, accent?: string,
   *   stats: Row[], lists?: Array<{ title: string, rows: Row[] }>, footer?: string
   * }} CardModel
   */

  const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

  /**
   * Cuts text to fit a rough width (average glyph ≈ 0.55 em), with an ellipsis.
   * @param {string} text @param {number} px font size @param {number} maxWidth
   */
  function fit(text, px, maxWidth) {
    const max = Math.max(4, Math.floor(maxWidth / (px * 0.55)));
    return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
  }

  /**
   * @param {CardModel} model
   * @returns {Op[]}
   */
  function layout(model) {
    const accent = /^#[0-9a-f]{3,8}$/i.test(model.accent || "") ? /** @type {string} */ (model.accent) : "#00f0ff";
    /** @type {Op[]} */
    const ops = [{ type: "gradient", stops: [[0, "#0a0612"], [1, "#1d0d3a"]] }];

    ops.push({ type: "rect", x: 0, y: 0, w: WIDTH, h: 14, fill: accent });
    ops.push({ type: "text", text: "GOG ENHANCER", x: PAD, y: 110, font: `700 26px ${FONT}`, fill: accent });
    ops.push({ type: "text", text: fit(model.title, 84, WIDTH - PAD * 2), x: PAD, y: 230, font: `800 84px ${FONT}`, fill: "#f4eaff" });
    if (model.subtitle) {
      ops.push({ type: "text", text: fit(model.subtitle, 34, WIDTH - PAD * 2), x: PAD, y: 290, font: `400 34px ${FONT}`, fill: "rgba(244,234,255,0.7)" });
    }

    // Big numbers, two per row.
    let y = 380;
    const stats = model.stats.slice(0, 6);
    stats.forEach((s, i) => {
      const col = i % 2;
      const x = PAD + col * ((WIDTH - PAD * 2) / 2);
      if (col === 0 && i > 0) y += 190;
      ops.push({ type: "rect", x: x - 10, y: y - 70, w: (WIDTH - PAD * 2) / 2 - 20, h: 160, fill: "rgba(255,255,255,0.05)", radius: 18 });
      ops.push({ type: "text", text: fit(s.value, 64, (WIDTH - PAD * 2) / 2 - 60), x: x + 14, y: y + 18, font: `800 64px ${FONT}`, fill: accent });
      ops.push({ type: "text", text: fit(s.label, 26, (WIDTH - PAD * 2) / 2 - 60), x: x + 14, y: y + 62, font: `400 26px ${FONT}`, fill: "rgba(244,234,255,0.7)" });
    });
    y += 190;

    for (const list of (model.lists || []).slice(0, 2)) {
      if (!list.rows.length) continue;
      y += 50;
      ops.push({ type: "text", text: list.title.toUpperCase(), x: PAD, y, font: `700 24px ${FONT}`, fill: accent });
      for (const row of list.rows.slice(0, 4)) {
        y += 46;
        ops.push({ type: "text", text: fit(row.label, 30, 620), x: PAD, y, font: `400 30px ${FONT}`, fill: "#f4eaff" });
        ops.push({ type: "text", text: row.value, x: WIDTH - PAD, y, font: `700 30px ${FONT}`, fill: "#f4eaff", align: "right" });
      }
    }

    ops.push({ type: "text", text: model.footer || "Made locally in my browser with GOG Enhancer", x: PAD, y: HEIGHT - 70, font: `400 24px ${FONT}`, fill: "rgba(244,234,255,0.5)" });
    return ops;
  }

  /**
   * @param {any} ctx a CanvasRenderingContext2D
   * @param {Op[]} ops
   */
  function render(ctx, ops) {
    for (const op of ops) {
      if (op.type === "gradient") {
        const g = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
        for (const [at, color] of op.stops) g.addColorStop(at, color);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      } else if (op.type === "rect") {
        ctx.fillStyle = op.fill;
        if (op.radius && typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(op.x, op.y, op.w, op.h, op.radius);
          ctx.fill();
        } else {
          ctx.fillRect(op.x, op.y, op.w, op.h);
        }
      } else {
        ctx.font = op.font;
        ctx.fillStyle = op.fill;
        ctx.textAlign = op.align || "left";
        ctx.fillText(op.text, op.x, op.y);
      }
    }
  }

  /**
   * Draws the card onto a new canvas and returns it as a PNG.
   * @param {CardModel} model
   * @returns {Promise<Blob>}
   */
  function toPng(model) {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.reject(new Error("Canvas isn't available in this browser."));
    render(ctx, layout(model));
    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't make the image."))), "image/png");
    });
  }

  /* ---------------- models from the library statistics ---------------- */

  /** @param {number} n @param {string} cur */
  const money = (n, cur) => `${n.toFixed(0)} ${cur}`;

  /**
   * @param {ReturnType<typeof window.GOGPlusLibraryTools.wrappedStats>} w
   * @param {{ saved?: number }} [extra]
   * @returns {CardModel}
   */
  function wrappedModel(w, extra = {}) {
    return {
      title: `${w.year} in games`,
      subtitle: w.topGenre ? `Mostly ${w.topGenre}` : "My GOG year",
      stats: [
        { label: "games bought", value: String(w.bought) },
        { label: "spent", value: money(w.spent, w.currency) },
        { label: "games finished", value: String(w.finished) },
        { label: extra.saved ? "saved vs list price" : "average per game", value: extra.saved ? money(extra.saved, w.currency) : money(w.averagePaid, w.currency) },
      ],
      lists: [
        { title: "Top tags", rows: w.topTags.map((t) => ({ label: t.tag, value: String(t.count) })) },
        {
          title: "Standouts",
          rows: [
            ...(w.priciest ? [{ label: `Priciest: ${w.priciest.title}`, value: money(w.priciest.paid, w.currency) }] : []),
            ...(w.cheapest ? [{ label: `Cheapest: ${w.cheapest.title}`, value: money(w.cheapest.paid, w.currency) }] : []),
          ],
        },
      ],
    };
  }

  /**
   * @param {ReturnType<typeof window.GOGPlusLibraryTools.collectorCard>} c
   * @returns {CardModel}
   */
  function collectorModel(c) {
    return {
      title: "My GOG collection",
      subtitle: c.oldest ? `Oldest: ${c.oldest.title} (${c.oldest.year})` : undefined,
      stats: [
        { label: "games owned", value: String(c.owned) },
        { label: "“Good Old Games” (15+ years)", value: c.classicPct === null ? "—" : `${c.classicPct}%` },
      ],
      lists: [
        { title: "By decade", rows: Object.entries(c.byDecade).sort().map(([d, n]) => ({ label: d, value: String(n) })) },
        { title: "Favourite genres", rows: c.topGenres.map((g) => ({ label: g.genre, value: String(g.count) })) },
      ],
    };
  }

  /**
   * A card for the wishlist page: how many games, what they cost today, the
   * best deals, and what's coming. Built from the same rows the page's own
   * tools use, so the numbers match what the bar above the list shows.
   * @param {Array<{ slug: string | null, title: string, price: number | null, currency: string | null, discountPct: number, owned: boolean, tba: boolean, free: boolean }>} rows
   * @param {{ target?: string, rates?: Record<string, number>, history?: Record<string, any[]> }} ctx
   * @param {{ upcoming?: Array<{ title: string, date: string }> }} [extra]
   * @returns {CardModel}
   */
  function wishlistModel(rows, ctx, extra = {}) {
    const Tools = window.GOGPlusWishlistTools;
    const open = rows.filter((r) => !r.owned);
    const t = Tools.totals(open, ctx);
    const cur = t.currency || ctx.target || "";
    /** @param {{ price: number | null, currency: string | null }} r */
    const priceOf = (r) => {
      if (r.price == null) return "—";
      const v = Tools.toTarget(r.price, r.currency, ctx);
      return v == null ? `${r.price.toFixed(2)} ${r.currency || ""}`.trim() : money(v, cur);
    };
    const best = open
      .filter((r) => r.discountPct > 0 && r.price != null)
      .sort((a, b) => b.discountPct - a.discountPct)
      .slice(0, 5)
      .map((r) => ({ label: r.title, value: `-${r.discountPct}% · ${priceOf(r)}` }));
    const lows = open
      .filter((r) => r.price != null && Tools.nearLow(/** @type {any} */ (r), ctx))
      .slice(0, 5)
      .map((r) => ({ label: r.title, value: `${priceOf(r)} · near its low` }));
    const coming = (extra.upcoming || []).slice(0, 5).map((u) => ({ label: u.title, value: u.date }));
    return {
      title: "My GOG wishlist",
      subtitle: `${open.length} game${open.length === 1 ? "" : "s"} waiting`,
      stats: [
        { label: "on sale right now", value: String(t.onSale) },
        { label: "to buy them all today", value: t.priced ? money(t.total, cur) : "—" },
        ...(t.saving > 0 ? [{ label: "saved by today's discounts", value: money(t.saving, cur) }] : []),
      ],
      lists: [
        // The card has room for two lists: deals first, then what's coming, else what's near its low.
        { title: "Biggest discounts", rows: best },
        { title: "Coming soon", rows: coming },
        { title: "Near their lowest price", rows: lows },
      ].filter((l) => l.rows.length),
    };
  }

  const api = { WIDTH, HEIGHT, fit, layout, render, toPng, wrappedModel, collectorModel, wishlistModel };
  if (typeof window !== "undefined") window.GOGPlusShareCard = api;
  if (typeof self !== "undefined") self.GOGPlusShareCard = api;
})();
