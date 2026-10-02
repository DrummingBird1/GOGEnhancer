/**
 * GOG+ system-requirements check (RAM only).
 *
 * A browser can't read your CPU or GPU model, and can't see your disk — but
 * Chrome does expose a coarse memory figure, navigator.deviceMemory. That is
 * enough to answer one honest question: "does this game's RAM requirement
 * look OK for this machine?" This module is pure text/number logic; the game
 * page feeds it the page text and the reported memory.
 *
 * navigator.deviceMemory is deliberately blurry: it is rounded DOWN to a power
 * of two, and browsers cap it (historically at 8; current Chromium reports
 * higher values, e.g. 32 on a 32 GB machine, but the cap is not documented
 * and has changed before). A report of 4 means "somewhere in [4, 8)"; a
 * report of 8 or more means "at least that much". compareRam() therefore
 * never calls a requirement unmet when the report might be a cap — it
 * returns "maybe"/"unknown" instead of pretending to certainty.
 */
// @ts-check

(() => {
  "use strict";

  /** @typedef {{ ramGB: number | null }} Tier */
  /** @typedef {{ minimum: Tier | null, recommended: Tier | null }} Requirements */
  /** @typedef {"ok" | "below" | "maybe" | "unknown"} RamStatus */

  // "Memory: 8 GB RAM", "RAM 4096 MB", "Memory8 GB" (adjacent elements with no
  // whitespace between them). The lookbehinds reject the letter-before case
  // ("VRAM", "program") and explicit video/graphics memory.
  const RAM_LABEL_RE =
    /(?<![a-z])(?<!video\s)(?<!graphics\s)(?<!gpu\s)(?:memory|ram)[^\d]{0,24}(\d+(?:[.,]\d+)?)\s*(gb|mb)/i;
  // "8 GB RAM", "8GB of RAM"
  const RAM_SUFFIX_RE = /(\d+(?:[.,]\d+)?)\s*(gb|mb)\s*(?:of\s*)?ram\b/i;
  const MAX_PLAUSIBLE_GB = 256;

  /**
   * @param {string} segment
   * @returns {number | null} gigabytes
   */
  function parseRamGB(segment) {
    const m = segment.match(RAM_LABEL_RE) || segment.match(RAM_SUFFIX_RE);
    if (!m) return null;
    let n = parseFloat(m[1].replace(",", "."));
    if (!Number.isFinite(n)) return null;
    if (m[2].toLowerCase() === "mb") n /= 1024;
    n = Math.round(n * 100) / 100;
    return n > 0 && n <= MAX_PLAUSIBLE_GB ? n : null;
  }

  /**
   * Pulls the minimum / recommended RAM out of a game page's text. Anchored on
   * a "System requirements" heading so an unrelated "Recommended games"
   * carousel or a review mentioning "memory" can't be mistaken for a
   * requirement. Returns null when there is no such block or no RAM figure.
   * @param {string} text
   * @returns {Requirements | null}
   */
  function parseRequirements(text) {
    const start = text.search(/system requirements/i);
    if (start < 0) return null;
    const block = text.slice(start, start + 4000);
    const minIdx = block.search(/\bminimum\b/i);
    const recIdx = block.search(/\brecommended\b/i);

    /** @param {number} from @param {number} other */
    const segment = (from, other) =>
      from < 0 ? null : block.slice(from, other > from ? other : undefined);

    const minSeg = segment(minIdx, recIdx);
    const recSeg = segment(recIdx, minIdx);
    const minRam = minSeg ? parseRamGB(minSeg) : null;
    const recRam = recSeg ? parseRamGB(recSeg) : null;
    if (minRam === null && recRam === null) return null;
    return {
      minimum: minRam === null ? null : { ramGB: minRam },
      recommended: recRam === null ? null : { ramGB: recRam },
    };
  }

  /**
   * Same result as parseRequirements(), but from the site's own requirements
   * table (label → cell text, per tier — see GOGPlusGogDom.readSystemRequirements)
   * instead of guessing at page text. Exact, so preferred when it's there.
   * @param {{ minimum: Record<string, string>, recommended: Record<string, string> }} table
   * @returns {Requirements | null}
   */
  function fromTable(table) {
    /** @param {Record<string, string>} cells @returns {number | null} */
    const ram = (cells) => {
      for (const [label, text] of Object.entries(cells)) {
        if (!/^\s*(memory|ram)\b/i.test(label)) continue;
        const gb = parseRamGB(`${label} ${text}`);
        if (gb !== null) return gb;
      }
      return null;
    };
    const min = ram(table.minimum);
    const rec = ram(table.recommended);
    if (min === null && rec === null) return null;
    return {
      minimum: min === null ? null : { ramGB: min },
      recommended: rec === null ? null : { ramGB: rec },
    };
  }

  /**
   * @param {number | null | undefined} requiredGB
   * @param {number | null | undefined} reportedGB navigator.deviceMemory
   * @returns {RamStatus}
   */
  function compareRam(requiredGB, reportedGB) {
    if (!requiredGB || !reportedGB) return "unknown";
    if (reportedGB >= requiredGB) return "ok";
    // At or past the old cap a report is only a floor ("at least N"), so a
    // bigger requirement is unknowable.
    if (reportedGB >= 8) return "unknown";
    // Rounded down to a power of two: real RAM is somewhere in [reported, 2×reported).
    if (requiredGB >= reportedGB * 2) return "below";
    return "maybe";
  }

  /**
   * Rows ready to render, one per tier that has a RAM figure.
   * @param {Requirements} req
   * @param {number | null | undefined} reportedGB
   * @returns {Array<{ label: string, requiredGB: number, status: RamStatus }>}
   */
  function summarize(req, reportedGB) {
    /** @type {Array<{ label: string, requiredGB: number, status: RamStatus }>} */
    const rows = [];
    for (const [label, tier] of /** @type {const} */ ([
      ["Minimum", req.minimum],
      ["Recommended", req.recommended],
    ])) {
      if (tier && tier.ramGB !== null) {
        rows.push({ label, requiredGB: tier.ramGB, status: compareRam(tier.ramGB, reportedGB) });
      }
    }
    return rows;
  }

  const api = { parseRamGB, parseRequirements, fromTable, compareRam, summarize };
  if (typeof window !== "undefined") window.GOGPlusSysReq = api;
  if (typeof self !== "undefined") self.GOGPlusSysReq = api;
})();
