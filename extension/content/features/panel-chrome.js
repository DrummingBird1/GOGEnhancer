/**
 * GOG+ panel chrome — the controls that let the user shape the game-page
 * panel: collapse a section, drag sections into their own order (or move
 * them with Alt+↑/↓), dock the panel beside the page on a wide screen, and
 * flip the whole injected look off and on again.
 *
 * Each section is built by game-page.js / game-extras.js as a plain
 * `<section class="gog-plus-gp-section">` with an `<h3>`; this module adds the
 * behaviour to it without the section needing to know. Collapsed state and
 * order are preferences (`panelCollapsed`, `panelOrder`, synced); they are
 * kept by section id, so a section that disappears (a feature switched off)
 * simply doesn't take part.
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusContentState;

  /** @param {Record<string, boolean>} next */
  function saveCollapsed(next) {
    state.settings.panelCollapsed = next;
    return window.GOGPlusStorage.set({ panelCollapsed: next });
  }

  /** @param {string[]} next */
  function saveOrder(next) {
    state.settings.panelOrder = next;
    return window.GOGPlusStorage.set({ panelOrder: next });
  }

  /** @param {Element} body @returns {HTMLElement[]} */
  const sectionsOf = (body) => /** @type {HTMLElement[]} */ (Array.from(body.querySelectorAll(":scope > [data-section-id]")));

  /**
   * @param {HTMLElement} section
   * @param {boolean} collapsed
   */
  function setCollapsed(section, collapsed) {
    section.classList.toggle("is-collapsed", collapsed);
    const btn = section.querySelector(":scope > h3 .gog-plus-gp-toggle");
    if (btn) {
      btn.setAttribute("aria-expanded", String(!collapsed));
      btn.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${section.dataset.sectionTitle || "section"}`);
      btn.textContent = collapsed ? "▸" : "▾";
    }
  }

  /**
   * Moves `section` one place up or down among its siblings and saves the order.
   * @param {HTMLElement} section
   * @param {-1 | 1} dir
   */
  function moveSection(section, dir) {
    const body = section.parentElement;
    if (!body) return;
    const sibs = sectionsOf(body);
    const i = sibs.indexOf(section);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sibs.length) return;
    if (dir < 0) body.insertBefore(section, sibs[j]);
    else body.insertBefore(sibs[j], section);
    saveOrder(sectionsOf(body).map((s) => /** @type {string} */ (s.dataset.sectionId)));
    /** @type {HTMLElement | null} */ (section.querySelector(":scope > h3 .gog-plus-gp-grip"))?.focus();
  }

  /**
   * Adds the collapse caret and the drag grip to one section.
   * @param {HTMLElement} section a `.gog-plus-gp-section` with an <h3>
   * @param {string} id stable id, used for the saved state
   */
  function decorate(section, id) {
    section.dataset.sectionId = id;
    const h3 = section.querySelector(":scope > h3");
    if (!h3) return;
    section.dataset.sectionTitle = (h3.textContent || id).replace(/\s+/g, " ").trim().slice(0, 40);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "gog-plus-gp-toggle";
    toggle.addEventListener("click", () => {
      const collapsed = !section.classList.contains("is-collapsed");
      setCollapsed(section, collapsed);
      saveCollapsed({ ...(state.settings.panelCollapsed || {}), [id]: collapsed });
    });

    const grip = document.createElement("button");
    grip.type = "button";
    grip.className = "gog-plus-gp-grip";
    grip.textContent = "⋮⋮";
    grip.title = "Drag to reorder (or Alt+↑ / Alt+↓)";
    grip.setAttribute("aria-label", `Reorder ${section.dataset.sectionTitle}: Alt+Up or Alt+Down`);
    grip.addEventListener("keydown", (e) => {
      if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      e.preventDefault();
      moveSection(section, e.key === "ArrowUp" ? -1 : 1);
    });
    // The section is only draggable while the grip is held, so selecting text
    // or using the inputs inside a section never starts a drag by accident.
    grip.addEventListener("pointerdown", () => (section.draggable = true));
    const release = () => (section.draggable = false);
    grip.addEventListener("pointerup", release);
    section.addEventListener("dragend", () => {
      release();
      section.classList.remove("is-dragging");
      section.parentElement?.querySelectorAll(".is-drop-target").forEach((el) => el.classList.remove("is-drop-target"));
    });
    section.addEventListener("dragstart", (e) => {
      section.classList.add("is-dragging");
      e.dataTransfer?.setData("text/plain", id);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    });
    section.addEventListener("dragover", (e) => {
      const dragging = section.parentElement?.querySelector(".is-dragging");
      if (!dragging || dragging === section) return;
      e.preventDefault();
      section.classList.add("is-drop-target");
    });
    section.addEventListener("dragleave", () => section.classList.remove("is-drop-target"));
    section.addEventListener("drop", (e) => {
      const body = section.parentElement;
      const dragging = /** @type {HTMLElement | null} */ (body?.querySelector(".is-dragging") || null);
      if (!body || !dragging || dragging === section) return;
      e.preventDefault();
      section.classList.remove("is-drop-target");
      const rect = section.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      body.insertBefore(dragging, after ? section.nextSibling : section);
      saveOrder(sectionsOf(body).map((s) => /** @type {string} */ (s.dataset.sectionId)));
    });

    h3.prepend(toggle);
    h3.append(grip);
    setCollapsed(section, !!state.settings.panelCollapsed?.[id]);
  }

  /**
   * Re-orders the decorated sections of a panel body to the user's saved
   * order. Sections the order doesn't mention keep their built position,
   * after the ones it does.
   * @param {Element} body
   */
  function applyOrder(body) {
    const order = state.settings.panelOrder || [];
    if (!order.length) return;
    const sections = sectionsOf(body);
    const rank = (/** @type {HTMLElement} */ s, /** @type {number} */ i) => {
      const k = order.indexOf(/** @type {string} */ (s.dataset.sectionId));
      return k >= 0 ? k : order.length + i;
    };
    sections
      .map((s, i) => ({ s, r: rank(s, i) }))
      .sort((a, b) => a.r - b.r)
      .forEach(({ s }) => body.appendChild(s));
  }

  /** The panel's own header buttons: dock, plain look, reset layout. */
  /** @param {HTMLElement} panel */
  function addHeaderTools(panel) {
    const header = panel.querySelector(".gog-plus-gp-header");
    if (!header || header.querySelector(".gog-plus-gp-tools")) return;
    const tools = document.createElement("span");
    tools.className = "gog-plus-gp-tools";

    /** @param {string} label @param {string} icon @param {() => void} fn @param {boolean} [pressed] */
    const tool = (label, icon, fn, pressed) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "gog-plus-gp-tool";
      b.textContent = icon;
      b.title = label;
      b.setAttribute("aria-label", label);
      if (pressed !== undefined) b.setAttribute("aria-pressed", String(pressed));
      b.addEventListener("click", fn);
      tools.appendChild(b);
    };

    tool("Dock this panel beside the page (wide screens)", "▤", () => {
      window.GOGPlusStorage.set({ panelSticky: !state.settings.panelSticky });
    }, !!state.settings.panelSticky);
    tool("Show the site without GOG Enhancer's styling", "◐", () => {
      window.GOGPlusStorage.set({ plainLook: true });
      window.GOGPlusToasts?.show("Plain look on — switch it back from the toolbar popup", { variant: "muted" });
    });
    tool("Reset section order and open every section", "↺", () => {
      state.settings.panelOrder = [];
      state.settings.panelCollapsed = {};
      window.GOGPlusStorage.set({ panelOrder: [], panelCollapsed: {} });
      // The panel was built with the old layout; build it again.
      const slug = panel.dataset.slug;
      panel.remove();
      if (slug) window.GOGPlusGamePage?.ensureGamePagePanel(slug);
    });
    header.appendChild(tools);
  }

  /** @param {HTMLElement} panel */
  function applyPanelMode(panel) {
    panel.classList.toggle("gog-plus-gamepanel--dock", !!state.settings.panelSticky);
  }

  window.GOGPlusPanelChrome = { decorate, applyOrder, addHeaderTools, applyPanelMode, moveSection, setCollapsed };
})();
