/**
 * GOG+ review tools — a small filter above the user-review list on a game
 * page: show only 5 / 4 / 3 / 1–2 star reviews, or only reviews by verified
 * owners, with the average of what is loaded.
 *
 * The site loads a handful of reviews at a time, so this only ever filters
 * (and averages) the reviews currently on the page — it says so — and it
 * never fetches more. Filtering is a class on each review; nothing is moved
 * or removed.
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusContentState;
  const Dom = window.GOGPlusGogDom;

  /** @type {"all" | "5" | "4" | "3" | "low"} */
  let stars = "all";
  let verifiedOnly = false;

  /** @param {number} n @param {string} f */
  const matches = (n, f) => (f === "all" ? true : f === "low" ? n >= 1 && n <= 2 : n === Number(f));

  /**
   * @param {Element} node @param {string} text
   */
  function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }

  function buildBar() {
    const bar = document.createElement("div");
    bar.id = "gog-plus-reviewbar";
    bar.className = "gog-plus-reviewbar";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "GOG Enhancer review filter");

    const label = document.createElement("span");
    label.className = "gog-plus-gp-muted";
    label.textContent = "Filter the reviews on this page:";
    bar.appendChild(label);

    for (const [value, text] of /** @type {const} */ ([
      ["all", "All"],
      ["5", "5★"],
      ["4", "4★"],
      ["3", "3★"],
      ["low", "1–2★"],
    ])) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "gog-plus-bar-btn";
      b.dataset.stars = value;
      b.textContent = text;
      b.addEventListener("click", () => {
        stars = value;
        applyReviewFilter();
      });
      bar.appendChild(b);
    }

    const owners = document.createElement("label");
    owners.className = "gog-plus-bar-check";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.id = "gog-plus-review-verified";
    box.addEventListener("change", () => {
      verifiedOnly = box.checked;
      applyReviewFilter();
    });
    owners.append(box, " Verified owners only");
    bar.appendChild(owners);

    const status = document.createElement("span");
    status.className = "gog-plus-bar-status";
    status.id = "gog-plus-review-status";
    status.setAttribute("role", "status");
    bar.appendChild(status);
    return bar;
  }

  /** Mounts the bar (once per review list) and applies the filter. Idempotent. */
  function applyReviewFilter() {
    if (!state.settings.reviewTools || Dom.pageType() !== "game") {
      document.getElementById("gog-plus-reviewbar")?.remove();
      document.querySelectorAll(".gog-plus-review-hidden").forEach((e) => e.classList.remove("gog-plus-review-hidden"));
      return;
    }
    const reviews = Dom.readReviews();
    if (!reviews.length) return;
    const mount = Dom.reviewsMount();
    if (!mount) return;

    let bar = document.getElementById("gog-plus-reviewbar");
    if (!bar || bar.parentElement !== mount) {
      bar?.remove();
      bar = buildBar();
      mount.insertBefore(bar, mount.firstChild);
    }
    bar.querySelectorAll("button[data-stars]").forEach((b) => {
      const on = /** @type {HTMLElement} */ (b).dataset.stars === stars;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    const box = /** @type {HTMLInputElement | null} */ (bar.querySelector("#gog-plus-review-verified"));
    if (box && box.checked !== verifiedOnly) box.checked = verifiedOnly;

    let shown = 0;
    let sum = 0;
    for (const r of reviews) {
      const ok = matches(r.stars, stars) && (!verifiedOnly || r.verified);
      r.el.classList.toggle("gog-plus-review-hidden", !ok);
      if (ok) {
        shown++;
        sum += r.stars;
      }
    }
    const status = bar.querySelector("#gog-plus-review-status");
    if (status) {
      setText(status, `Showing ${shown} of ${reviews.length} loaded${shown ? ` · average ${(sum / shown).toFixed(1)}★` : ""}`);
    }
  }

  window.GOGPlusReviewTools = {
    applyReviewFilter,
    _state: {
      reset() {
        stars = "all";
        verifiedOnly = false;
      },
    },
  };
})();
