/**
 * GOG+ game-page extras — the v4 sections of the "GOG Enhancer insights"
 * panel: Deal check (is the discount real, when does it end, price per hour,
 * other currencies, sale rhythm), At a glance (languages, ratings, what
 * changed), Your library (already owned, bundle overlap, similar games you
 * own, suggested tags) and Open in… (link-only buttons).
 *
 * Every renderer returns a `<section class="gog-plus-gp-section">` or null
 * when it has nothing honest to say; game-page.js adds the collapse / reorder
 * chrome and decides the order. All text goes through textContent — page
 * data (titles, language names, tags) is never put in innerHTML.
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusContentState;
  const Dom = window.GOGPlusGogDom;
  const { symbolFor, formatPrice } = window.GOGPlusCurrencyFormat;

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

  /** @param {string} title @param {string} [since] */
  function sectionEl(title, since) {
    const wrap = el("section", "gog-plus-gp-section");
    const h3 = el("h3", "", `${title} `);
    if (since) h3.appendChild(el("span", "gog-plus-gp-since", since));
    wrap.appendChild(h3);
    return wrap;
  }

  /** @param {string} cls @param {string} text */
  const line = (cls, text) => el("p", `gog-plus-deal-line ${cls}`.trim(), text);

  /** @param {number} ms */
  const fmtDate = (ms) =>
    new Date(ms).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  /* ============== Deal check ============== */

  /** @param {string} raw */
  function timerRow(raw) {
    const Deals = window.GOGPlusDeals;
    const info = Deals.offerEndsIn(raw);
    if (!info || info.expired) return null;
    const p = el("p", "gog-plus-deal-timer");
    const left = el("strong", "", info.label);
    p.append("⏳ Offer ends in ", left, " ");
    p.appendChild(el("span", "gog-plus-gp-muted", `(${fmtDate(info.endsAt)})`));
    const paint = () => {
      const now = Deals.offerEndsIn(raw);
      if (!now || now.expired) {
        left.textContent = "ended";
        p.className = "gog-plus-deal-timer is-ended";
        return false;
      }
      left.textContent = now.label;
      p.className = `gog-plus-deal-timer${now.urgent ? " is-urgent" : now.soon ? " is-soon" : ""}`;
      return true;
    };
    paint();
    // One tick a minute while the panel is on screen; stops when it's gone.
    const timer = setInterval(() => {
      if (!p.isConnected || !paint()) clearInterval(timer);
    }, 60 * 1000);
    return p;
  }

  /**
   * @param {{ final: number | null, base: number | null, lowest30: number | null }} prices
   * @param {string} slug @param {string} cur
   * @returns {HTMLElement[]}
   */
  function realDiscountRows(prices, slug, cur) {
    const Deals = window.GOGPlusDeals;
    const sym = symbolFor(cur);
    /** @param {number} n */
    const money = (n) => `${sym}${n.toFixed(2)}`;
    /** @type {HTMLElement[]} */
    const rows = [];
    const final = /** @type {number} */ (prices.final);

    if (prices.base && prices.base > final) {
      const rd = Deals.realDiscount({ base: prices.base, final, lowest30: prices.lowest30 });
      if (rd) {
        rows.push(line("", `Advertised: −${rd.advertisedPct}% off the list price of ${money(prices.base)}.`));
        if (rd.vs30 === "better") {
          rows.push(line("is-good", `✓ Cheaper than the lowest price of the last 30 days (${money(/** @type {number} */ (rd.lowest30))}) — a real ${rd.effectivePct}% drop.`));
        } else if (rd.vs30 === "same") {
          rows.push(line("is-ok", `≈ The same as the lowest price of the last 30 days (${money(/** @type {number} */ (rd.lowest30))}) — not cheaper than it was recently.`));
        } else if (rd.vs30 === "worse") {
          rows.push(line("is-bad", `✗ Higher than the 30-day low of ${money(/** @type {number} */ (rd.lowest30))}.`));
        }
        if (rd.vs30 !== "unknown" && rd.inflationPts >= 10 && rd.lowest30) {
          rows.push(line("is-muted", `The “−${rd.advertisedPct}%” counts from ${money(prices.base)}, but the price was already ${money(rd.lowest30)} recently — the real saving is ${rd.effectivePct}%.`));
        }
      }
    }
    const pos = Deals.trackedPosition(final, state.settings.priceHistory?.[slug] || [], cur);
    if (pos && pos.count >= 2) {
      rows.push(
        line(
          pos.atLow ? "is-good" : "",
          pos.atLow
            ? `✓ At your tracked low (${money(pos.low)}, ${pos.count} snapshots).`
            : `Your tracked low is ${money(pos.low)} — this is ${pos.pctAboveLow}% above it.`
        )
      );
    }
    return rows;
  }

  const HOUR_LABELS = ["Main", "Main + Sides", "Completionist"];

  /**
   * @param {number} final @param {string} cur @param {string} slug
   * @returns {HTMLElement | null}
   */
  function pricePerHourRow(final, cur, slug) {
    const Deals = window.GOGPlusDeals;
    const table = Dom.readTimeToBeat() || state.settings.gameFacts?.[slug]?.hours;
    if (!table || !(final > 0)) return null;
    const sym = symbolFor(cur);
    const parts = [];
    for (const label of HOUR_LABELS) {
      const hours = Deals.parseHours(table[label]);
      const per = Deals.pricePerHour(final, hours);
      if (per !== null) parts.push(`${sym}${per.toFixed(2)} (${label}, ${table[label]})`);
    }
    return parts.length ? line("", `Per hour of play: ${parts.join(" · ")}`) : null;
  }

  /**
   * @param {number} final @param {string} cur
   * @returns {HTMLElement | null}
   */
  function currencyTable(final, cur) {
    const s = state.settings;
    const codes = [...new Set([s.targetCurrency, ...Object.keys(s.rates || {}), "USD"])].filter((c) => c && c !== "none");
    const rows = window.GOGPlusDeals.convertAll(final, cur, s.rates || {}, codes, {
      taxEstimator: s.taxEstimator,
      vatPercent: s.vatPercent,
      vatCurrencies: [s.targetCurrency],
    });
    if (!rows.length) return null;
    const details = el("details", "gog-plus-currencies");
    details.appendChild(el("summary", "", "Price in other currencies"));
    const table = el("table", "gog-plus-currencies-table");
    for (const r of rows) {
      const tr = el("tr");
      tr.append(el("th", "", r.code), el("td", "", formatPrice(r.value, r.code)));
      if (r.code === s.targetCurrency && s.taxEstimator && s.vatPercent > 0) {
        tr.appendChild(el("td", "gog-plus-gp-muted", `incl. ${s.vatPercent}% VAT`));
      }
      table.appendChild(tr);
    }
    details.appendChild(table);
    return details;
  }

  /** @param {string} slug @returns {HTMLElement | null} */
  function forecastRow(slug) {
    const hist = state.settings.priceHistory?.[slug] || [];
    if (hist.length < 2) return null;
    const st = window.GOGPlusDeals.saleStats(hist);
    if (!st.count) {
      return line("is-muted", "No sale seen yet in your tracked history — keep visiting to learn this game's rhythm.");
    }
    let text = `On sale ${st.count}× in your tracked history${st.avgDepthPct ? `, typically −${st.avgDepthPct}%` : ""}`;
    if (st.medianGapDays) text += `, roughly every ${st.medianGapDays} days`;
    text += ".";
    if (st.nextExpected) {
      text += ` Next one around ${new Date(`${st.nextExpected}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} — a rough guess from your own visits.`;
    }
    return line("", text);
  }

  /**
   * @param {string} slug
   * @returns {HTMLElement | null}
   */
  function renderDealSection(slug) {
    const s = state.settings;
    if (!(s.realDiscountCheck || s.offerTimer || s.pricePerHour || s.currencyTable || s.saleForecast)) return null;
    const prices = Dom.readGamePrices();
    if (prices.final == null) return null;
    const cur = prices.currency || state.pageCurrency.code;
    const wrap = sectionEl("Deal check");
    const before = wrap.childNodes.length;

    if (s.offerTimer) {
      const raw = Dom.promoEndRaw();
      const row = raw ? timerRow(raw) : null;
      if (row) wrap.appendChild(row);
    }
    if (s.realDiscountCheck) realDiscountRows(prices, slug, cur).forEach((r) => wrap.appendChild(r));
    if (s.pricePerHour) {
      const row = pricePerHourRow(prices.final, cur, slug);
      if (row) wrap.appendChild(row);
    }
    if (s.saleForecast) {
      const row = forecastRow(slug);
      if (row) wrap.appendChild(row);
    }
    if (s.currencyTable) {
      const row = currencyTable(prices.final, cur);
      if (row) wrap.appendChild(row);
    }
    return wrap.childNodes.length > before ? wrap : null;
  }

  /* ============== At a glance ============== */

  /** @param {string} slug @returns {Record<string, {audio: boolean, text: boolean}> | null} */
  function languagesFor(slug) {
    const live = Dom.readLanguages();
    if (live) return live;
    const cached = state.settings.gameFacts?.[slug]?.langs;
    if (!cached) return null;
    /** @type {Record<string, {audio: boolean, text: boolean}>} */
    const out = {};
    for (const [k, v] of Object.entries(cached)) out[k] = { audio: !!v.a, text: !!v.t };
    return out;
  }

  /** @param {string} slug @returns {HTMLElement | null} */
  function languageRow(slug) {
    const table = languagesFor(slug);
    if (!table) return null;
    const Names = window.GOGPlusLangNames;
    const wanted = Names.preferredNames(state.settings.preferredLanguages, state.settings.uiLanguage);
    const p = el("p", "gog-plus-lang-row");
    p.appendChild(el("span", "gog-plus-lang-label", "Languages:"));
    for (const name of wanted) {
      const key = Names.findLanguage(table, name);
      const support = key ? table[key] : null;
      const chip = el("span", `gog-plus-lang-chip ${support ? "is-yes" : "is-no"}`);
      if (!support) chip.textContent = `${name}: not supported`;
      else {
        const how = [support.text ? "text" : "", support.audio ? "audio" : ""].filter(Boolean).join(" + ");
        chip.textContent = `${name}: ${how || "listed"} ✓`;
      }
      p.appendChild(chip);
    }
    p.appendChild(el("span", "gog-plus-gp-muted", `${Object.keys(table).length} in total`));
    return p;
  }

  /** @returns {HTMLElement | null} */
  function ratingRow() {
    const rating = Dom.readRating();
    const critics = Dom.readCriticsPct();
    if (!rating && critics == null) return null;
    const parts = [];
    if (rating) parts.push(`${rating.score}/5 from ${rating.count.toLocaleString()} user reviews`);
    if (critics != null) parts.push(`${critics}% of critics recommend`);
    return line("", `Reception: ${parts.join(" · ")}`);
  }

  /** @param {string} slug @returns {HTMLElement | null} */
  function changesRow(slug) {
    const facts = state.settings.gameFacts?.[slug];
    if (!facts?.prev) return null;
    const changes = window.GOGPlusKnowledge.changesSince(facts);
    const when = new Date(facts.prev.t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (!changes.length) return line("is-muted", `Nothing has changed since your visit on ${when}.`);
    const p = el("div", "gog-plus-changes");
    p.appendChild(el("p", "gog-plus-deal-line", `Since your visit on ${when}:`));
    const ul = el("ul");
    for (const c of changes) ul.appendChild(el("li", "", c));
    p.appendChild(ul);
    return p;
  }

  /** @param {string} slug @returns {HTMLElement | null} */
  function renderFactsSection(slug) {
    const s = state.settings;
    if (!(s.languageMeter || s.changesSinceVisit)) return null;
    const wrap = sectionEl("At a glance");
    const before = wrap.childNodes.length;
    if (s.languageMeter) {
      const row = languageRow(slug);
      if (row) wrap.appendChild(row);
    }
    const rating = ratingRow();
    if (rating) wrap.appendChild(rating);
    if (s.changesSinceVisit) {
      const row = changesRow(slug);
      if (row) wrap.appendChild(row);
    }
    return wrap.childNodes.length > before ? wrap : null;
  }

  /* ============== Your library ============== */

  /** @param {string} slug @param {string} tag */
  async function addTag(slug, tag) {
    const { tags: cur = {} } = await window.GOGPlusStorage.get({ tags: {} });
    cur[slug] = cur[slug] || [];
    if (!cur[slug].includes(tag)) cur[slug].push(tag);
    state.settings.tags = cur;
    await window.GOGPlusStorage.set({ tags: cur });
  }

  /**
   * What this game's pack structure means for your library: for a pack, which
   * of its games you already own (from GOG's product API, cached); for a game,
   * whether a pack you own already contains it. Falls back to the page-text
   * heuristic when the lookup is off or hasn't answered yet.
   * @param {HTMLElement} wrap @param {string} slug @param {Record<string, any>} ownedMap
   */
  function packSection(wrap, slug, ownedMap) {
    const s = state.settings;
    const Deals = window.GOGPlusDeals;
    const info = s.packInfo?.[slug];
    const known = Deals.packInfoFresh(info);
    if (!known && s.packContents) {
      // Asks once, then the panel is rebuilt when the answer is stored.
      void window.GOGPlusKnowledge.ensurePackInfo(slug).catch(() => {});
    }

    /** @type {Array<{ slug: string, title: string }>} */
    let children = known ? info.children : [];
    if (!known) {
      children = Dom.bundleSlugs(slug).map((x) => ({ slug: x, title: s.gameFacts?.[x]?.title || window.GOGPlusLibraryTools.titleFromSlug(x) }));
    }
    if (children.length) {
      const ov = Deals.packOverlap(children, ownedMap);
      const names = (list) => list.slice(0, 5).map((c) => c.title).join(", ") + (list.length > 5 ? "…" : "");
      if (ov.allOwned) {
        wrap.appendChild(line("is-bad", `⚠ You already own all ${ov.total} games in this pack.`));
      } else if (ov.owned.length) {
        wrap.appendChild(line("is-bad", `⚠ You already own ${ov.owned.length} of the ${ov.total} games in this pack: ${names(ov.owned)}.`));
      } else if (known) {
        wrap.appendChild(line("is-good", `This pack has ${ov.total} games — none of them are in your library yet.`));
      }
      if (known) {
        const p = el("p", "gog-plus-pack-list");
        p.appendChild(el("span", "gog-plus-lang-label", "In this pack:"));
        for (const c of children) {
          const a = /** @type {HTMLAnchorElement} */ (el("a", "gog-plus-similar-link", `${ownedMap[c.slug] ? "✓ " : ""}${c.title}`));
          a.href = `/en/game/${encodeURIComponent(c.slug)}`;
          p.appendChild(a);
        }
        wrap.appendChild(p);
      }
    }

    if (!ownedMap[slug]) {
      const via = Deals.ownedPacksContaining(slug, s.packInfo, ownedMap);
      if (via.length) {
        const names = via.map((x) => s.gameFacts?.[x]?.title || window.GOGPlusLibraryTools.titleFromSlug(x)).join(", ");
        wrap.appendChild(line("is-good", `✓ Already in your library through ${names}.`));
      }
    }
  }

  /**
   * @param {string} slug
   * @returns {HTMLElement | null}
   */
  function renderLibrarySection(slug) {
    const s = state.settings;
    const wrap = sectionEl("Your library");
    const before = wrap.childNodes.length;
    const ownedMap = s.ownedSlugs || {};

    if (Dom.isGameOwned() === true || ownedMap[slug]) {
      wrap.appendChild(line("is-good", "✓ This game is already in your library."));
    }

    packSection(wrap, slug, ownedMap);

    if (s.similarOwned) {
      const similar = window.GOGPlusLibraryTools.similarOwned(slug, {
        ownedSlugs: ownedMap,
        gameFacts: s.gameFacts,
        tags: s.tags,
      });
      if (similar.length) {
        const p = el("p", "gog-plus-similar");
        p.appendChild(el("span", "gog-plus-lang-label", "Similar games you own:"));
        for (const g of similar) {
          const a = /** @type {HTMLAnchorElement} */ (el("a", "gog-plus-similar-link", g.title));
          a.href = `/en/game/${encodeURIComponent(g.slug)}`;
          a.title = `Shared tags: ${g.shared.join(", ")}`;
          p.appendChild(a);
        }
        wrap.appendChild(p);
      }
    }

    // Suggested tags: GOG's own tags for this game, minus what is already applied.
    if (s.customTags) {
      const mine = new Set((s.tags?.[slug] || []).map((t) => t.toLowerCase()));
      const suggestions = (s.gameFacts?.[slug]?.tags || Dom.readProductTags()).filter((t) => !mine.has(t.toLowerCase())).slice(0, 8);
      if (suggestions.length) {
        const p = el("p", "gog-plus-suggest");
        p.appendChild(el("span", "gog-plus-lang-label", "Suggested tags:"));
        for (const t of suggestions) {
          const b = /** @type {HTMLButtonElement} */ (el("button", "gog-plus-suggest-chip", `+ ${t}`));
          b.type = "button";
          b.addEventListener("click", async () => {
            await addTag(slug, t);
            b.remove();
            window.GOGPlusToasts?.show(`Tag added: ${t}`);
          });
          p.appendChild(b);
        }
        wrap.appendChild(p);
      }
    }
    return wrap.childNodes.length > before ? wrap : null;
  }

  /* ============== Open in… ============== */

  /**
   * @param {string} slug
   * @returns {HTMLElement | null}
   */
  function renderLinksSection(slug) {
    const title = Dom.gameTitle() || slug.replace(/_/g, " ");
    const links = window.GOGPlusLinks.openInLinks(title, slug);
    if (!links.length) return null;
    const wrap = sectionEl("Compare & look up", "links only — nothing is sent until you click");
    const row = el("div", "gog-plus-open-links");
    for (const l of links) {
      const a = /** @type {HTMLAnchorElement} */ (el("a", "gog-plus-itad-btn", `${l.label} →`));
      a.href = l.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      row.appendChild(a);
    }
    wrap.appendChild(row);
    return wrap;
  }

  window.GOGPlusGameExtras = {
    renderDealSection,
    renderFactsSection,
    renderLibrarySection,
    renderLinksSection,
    _internals: { timerRow, realDiscountRows, pricePerHourRow, currencyTable, forecastRow, languageRow, ratingRow, changesRow },
  };
})();
