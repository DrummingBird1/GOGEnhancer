/**
 * GOG+ card-badge feature: refund/mod/lowest-price badges, tag-colour dot,
 * era-aware + genre-aware cover theming, and the hover quick-look tooltip
 * on every game card. Pulled out of the former single-file content.js
 * during the v2.8.0 module split.
 *
 * applyCardBadges() is CLAUDE.md's own documented "hot zone" — regression
 * coverage lives in tests/apply-card-badges.test.js. Read that file's
 * comments before touching the cover-host resolution logic below.
 */

(() => {
  "use strict";

  const state = window.GOGPlusContentState;
  const { escapeHtml } = window.GOGPlusDomSafety;
  const { symbolFor } = window.GOGPlusCurrencyFormat;
  const { matchGenrePattern } = window.GOGPlusGenres;
  const { slugFromHref } = window.GOGPlusContentUtils;

  // Build the quick-look HTML stamped on each game card as data-gog-plus-tip.
  // Shows price-history stats + a mini sparkline + the user's tags. Returns "" for
  // cards with no data so we don't clutter every fresh card with an empty tooltip.
  function buildQuickLookHtml(slug) {
    const ph = state.settings.priceHistory?.[slug];
    const tags = state.settings.tags?.[slug] || [];
    if ((!ph || !ph.length) && !tags.length) return "";
    const title = slug.split("_").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
    let body = `<strong>${escapeHtml(title)}</strong>`;
    if (ph && ph.length) {
      const prices = ph.map((e) => e.p);
      const minP = Math.min(...prices);
      const latest = ph[ph.length - 1];
      const sym = symbolFor(latest.c || "USD");
      const minIdx = prices.indexOf(minP);
      const isAtLow = latest.p === minP;
      body += `<br><span class="gog-plus-ql-row"><em>Current:</em> ${sym}${latest.p.toFixed(2)}${isAtLow ? " ⭐" : ""}</span>`;
      body += `<span class="gog-plus-ql-row"><em>All-time low:</em> ${sym}${minP.toFixed(2)} <span class="gog-plus-ql-dim">(${ph[minIdx].d})</span></span>`;
      body += `<span class="gog-plus-ql-row"><em>Snapshots:</em> ${ph.length}</span>`;
      body += `<span class="gog-plus-ql-row"><em>Last visit:</em> ${latest.d}</span>`;
      if (ph.length >= 2) body += buildMiniSparkline(ph);
    }
    if (tags.length) {
      const chips = tags.map((t) => `<span class="gog-plus-ql-tag">${escapeHtml(t)}</span>`).join("");
      body += `<div class="gog-plus-ql-tags">${chips}</div>`;
    }
    return body;
  }

  // Inline SVG sparkline for the quick-look tooltip — last 10 snapshots,
  // single-line stroke, currentColor so theme picks the hue.
  function buildMiniSparkline(history) {
    const points = history.slice(-10);
    const prices = points.map((e) => e.p);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = maxP - minP || 1;
    const W = 120, H = 22, PAD = 2;
    const pts = points.map((e, i) => {
      const x = PAD + (i / (points.length - 1)) * (W - PAD * 2);
      const y = PAD + (H - PAD * 2) - ((e.p - minP) / range) * (H - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `<svg class="gog-plus-ql-mini-spark" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" aria-hidden="true"><path d="M${pts.join(" L")}" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }

  function applyCardBadges(root = document) {
    // Tighter selector: skip cards we already processed, and only consider
    // anchors that have an image AND aren't tiny carousel previews.
    const cards = root.querySelectorAll('a[href*="/game/"]:not(.gog-plus-card-done)');
    const seenSlugs = new Set();
    cards.forEach((card) => {
      const img = card.querySelector("img, picture");
      if (!img) return;

      // Many GOG cards are duplicate anchors (cover-link + body-link wrap the
      // same product). De-dupe per slug so we don't stamp twice.
      const slug = slugFromHref(card.getAttribute("href"));
      if (!slug) return;
      if (seenSlugs.has(slug)) return;

      // Find a SAFE host for the absolute-positioned strip: the smallest
      // ancestor of the cover image that is NOT the card itself.
      // GOG's carousel/preview overlays already use positioned ancestors,
      // so modifying the card root explodes their layout.
      let host = img.parentElement;
      if (!host || host === card) return;

      // Walk up at most 2 levels until we find a wrapper that is clearly
      // a cover wrapper (smaller than the card). Stop before reaching the card.
      const cardRect = card.getBoundingClientRect();
      let hops = 0;
      while (host && host !== card && hops < 3) {
        const r = host.getBoundingClientRect();
        const isCoverSized =
          r.width > 0 && r.height > 0 &&
          r.width <= cardRect.width * 0.75 &&
          r.height <= cardRect.height * 0.95;
        if (isCoverSized) break;
        host = host.parentElement;
        hops++;
      }
      if (!host || host === card) return;

      seenSlugs.add(slug);
      card.classList.add("gog-plus-card-done");
      card.classList.add("gog-plus-card");
      if (state.settings.richTooltips) {
        const ql = buildQuickLookHtml(slug);
        if (ql) card.dataset.gogPlusTip = ql;
      }

      // Mark the chosen cover host so CSS scopes badges to it.
      host.classList.add("gog-plus-cover-host");
      // Ensure positioning context exists WITHOUT !important.
      const computedPos = getComputedStyle(host).position;
      if (computedPos === "static") {
        host.style.position = "relative";
      }

      // Era-aware styling — applied to the cover host, not the whole card.
      const isClassic = !!card.querySelector(
        '[class*="good-old-game"], [class*="goodOldGame"]'
      ) || /good old game/i.test(card.textContent || "");
      if (isClassic && state.settings.designInjection) {
        host.classList.add("gog-plus-cover--classic");
      }
      if (/cyberpunk|witcher/i.test(slug) && state.settings.designInjection) {
        host.classList.add("gog-plus-cover--neon");
      }
      if (state.settings.designInjection) {
        // Prefer the real genre read off the game's own page (cached on
        // visit — see maybeRecordGameGenre) over the franchise/keyword
        // regex fallback (matchGenrePattern), which only recognizes titles
        // hand-listed in GENRE_PATTERNS.
        const genre = (state.settings.gameGenres && state.settings.gameGenres[slug]) || matchGenrePattern(slug);
        if (genre) {
          host.classList.add(`gog-plus-cover--genre-${genre}`);
        }
      }

      const strip = document.createElement("div");
      strip.className = "gog-plus-badges";

      if (state.settings.refundBadge) {
        const b = document.createElement("span");
        b.className = "gog-plus-badge gog-plus-badge-refund";
        b.innerHTML = `<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
          <path d="M6 1L1 4v3c0 2.5 2 4.5 5 5 3-.5 5-2.5 5-5V4L6 1z"
            fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
          <path d="M4 6l1.5 1.5L8 5" fill="none" stroke="currentColor" stroke-width="1.4"
            stroke-linecap="round" stroke-linejoin="round"/>
        </svg>30-day refund`;
        if (state.settings.richTooltips) {
          b.dataset.gogPlusTip =
            "<strong>30-day refund</strong><br>GOG offers a money-back guarantee within 30 days, no questions asked.";
        } else {
          b.title = "30-day money-back guarantee";
        }
        strip.appendChild(b);
      }

      if (
        state.settings.modIndicator &&
        Array.isArray(state.settings.modsList) &&
        state.settings.modsList.includes(slug)
      ) {
        const m = document.createElement("span");
        m.className = "gog-plus-badge gog-plus-badge-mod";
        m.textContent = "★ MOD";
        if (state.settings.richTooltips) {
          m.dataset.gogPlusTip =
            "<strong>★ One-click Mods</strong><br>This game has GOG-curated mods that install with a single click.";
        } else {
          m.title = "One-click Mods available";
        }
        strip.appendChild(m);
      }

      // Historical-low badge (#06). Uses the preloaded price-history cache — no
      // async read in the hot path. Mirrors the "at low" logic already used by
      // the hover quick-look: the game is flagged when its latest recorded
      // snapshot equals the lowest we've ever recorded, over >=2 snapshots.
      if (state.settings.lowestPriceBadge && state.settings.priceHistory) {
        const ph = state.settings.priceHistory[slug];
        if (Array.isArray(ph) && ph.length >= 2) {
          const prices = ph.map((e) => e.p);
          const minP = Math.min(...prices);
          const latest = ph[ph.length - 1];
          if (latest.p === minP) {
            const lo = document.createElement("span");
            lo.className = "gog-plus-badge gog-plus-badge-low";
            lo.textContent = "💎 Low";
            if (state.settings.richTooltips) {
              lo.dataset.gogPlusTip = `<strong>💎 Tracked all-time low</strong><br>This is the lowest price recorded here (${symbolFor(
                latest.c || "USD"
              )}${minP.toFixed(2)}), across ${ph.length} snapshots.`;
            } else {
              lo.title = "At its tracked all-time low";
            }
            strip.appendChild(lo);
          }
        }
      }

      if (strip.childNodes.length) {
        host.appendChild(strip);
        host.classList.add("gog-plus-cover-host--has-badges");
      }

      // Tag-colour dot (#04). A small corner marker on cards you've tagged,
      // tinted with the first tag that has a colour. Removed + re-added on the
      // storage-change path (see the onChange cleanup), so it can't duplicate.
      if (state.settings.customTags && state.settings.tags) {
        const slugTags = state.settings.tags[slug];
        if (Array.isArray(slugTags) && slugTags.length) {
          const dot = document.createElement("span");
          dot.className = "gog-plus-tag-dot";
          const colored = slugTags.find(
            (t) =>
              state.settings.tagColors?.[t] &&
              /^#[0-9a-f]{3,8}$/i.test(state.settings.tagColors[t])
          );
          if (colored) dot.style.setProperty("--gog-plus-tag-dot", state.settings.tagColors[colored]);
          const names = slugTags.join(", ");
          if (state.settings.richTooltips) {
            dot.dataset.gogPlusTip = `<strong>Your tags</strong><br>${escapeHtml(names)}`;
          } else {
            dot.title = `Tags: ${names}`;
          }
          host.appendChild(dot);
          host.classList.add("gog-plus-cover-host--has-tagdot");
        }
      }
    });
  }

  window.GOGPlusCardBadges = {
    buildQuickLookHtml,
    buildMiniSparkline,
    applyCardBadges,
  };
})();
