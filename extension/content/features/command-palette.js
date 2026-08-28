/**
 * GOG+ command palette — Ctrl/Cmd+K opens a quick-action overlay on
 * gog.com, similar to the palette pattern in GitHub/Slack/Notion. Surfaces
 * actions that already exist behind menus (the extension already has
 * Alt+G / Alt+Shift+G / Alt+Shift+H as chrome.commands shortcuts for the
 * three most common toggles — see manifest.json — this complements those
 * with a discoverable, searchable list of everything else).
 */
// @ts-check

(() => {
  "use strict";

  const state = window.GOGPlusContentState;

  const ACTIONS = [
    {
      id: "open-options",
      label: "Open Advanced Options",
      hint: "Settings, rates, data export",
      run: () => chrome.runtime.openOptionsPage(),
    },
    {
      id: "open-tags",
      label: "Open Tag Dashboard",
      hint: "Your tagged games, stats, exports",
      run: () => chrome.runtime.sendMessage({ type: "open-tag-dashboard" }),
    },
    {
      id: "toggle-enabled",
      label: () => (state.settings.enabled ? "Turn off GOG Enhancer" : "Turn on GOG Enhancer"),
      hint: "Master on/off switch",
      run: () => window.GOGPlusStorage.set({ enabled: !state.settings.enabled }),
    },
    {
      id: "toggle-currency",
      label: () =>
        state.settings.currencyConverter ? "Turn off currency conversion" : "Turn on currency conversion",
      hint: "Show/hide converted prices",
      run: () =>
        window.GOGPlusStorage.set({ currencyConverter: !state.settings.currencyConverter }),
    },
    {
      id: "toggle-hebrew",
      label: () =>
        state.settings.hebrewTranslations ? "Turn off Hebrew translations" : "Turn on Hebrew translations",
      hint: "Translate stable nav & UI strings",
      run: () =>
        window.GOGPlusStorage.set({ hebrewTranslations: !state.settings.hebrewTranslations }),
    },
    {
      id: "refresh-rates",
      label: "Refresh exchange rates now",
      hint: "Force-fetch from frankfurter.app",
      run: () => chrome.runtime.sendMessage({ type: "force-fx-refresh" }),
    },
    {
      id: "refresh-mods",
      label: "Refresh mods list now",
      hint: "Force-rescan gog.com/en/mods",
      run: () => chrome.runtime.sendMessage({ type: "force-mods-refresh" }),
    },
    {
      id: "reload-tab",
      label: "Reload this tab",
      hint: "",
      run: () => location.reload(),
    },
  ];

  let overlay = null;
  let listEl = null;
  let inputEl = null;
  let filtered = ACTIONS;
  let activeIndex = 0;

  function resolveLabel(action) {
    return typeof action.label === "function" ? action.label() : action.label;
  }

  function render() {
    listEl.innerHTML = "";
    filtered.forEach((action, i) => {
      const li = document.createElement("li");
      li.className = "gog-plus-palette-item" + (i === activeIndex ? " is-active" : "");
      li.dataset.index = String(i);

      const label = document.createElement("span");
      label.className = "gog-plus-palette-item-label";
      label.textContent = resolveLabel(action);
      li.appendChild(label);

      const hint = resolveLabel({ label: action.hint });
      if (hint) {
        const hintEl = document.createElement("span");
        hintEl.className = "gog-plus-palette-item-hint";
        hintEl.textContent = hint;
        li.appendChild(hintEl);
      }

      li.addEventListener("mouseenter", () => {
        activeIndex = i;
        render();
      });
      li.addEventListener("click", () => runActive());
      listEl.appendChild(li);
    });
  }

  function runActive() {
    const action = filtered[activeIndex];
    if (!action) return;
    close();
    try {
      action.run();
    } catch (err) {
      console.error("[GOG+] command palette action failed", err);
    }
  }

  function open() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "gog-plus-palette-overlay";
    overlay.innerHTML = `
      <div class="gog-plus-palette" role="dialog" aria-modal="true" aria-label="GOG Enhancer quick actions">
        <div class="gog-plus-palette-inputrow">
          <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.6" />
            <line x1="13" y1="13" x2="18" y2="18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
          <input type="text" class="gog-plus-palette-input" placeholder="Search GOG Enhancer actions…" autocomplete="off" spellcheck="false" />
        </div>
        <ul class="gog-plus-palette-list"></ul>
      </div>
    `;
    document.body.appendChild(overlay);
    inputEl = overlay.querySelector(".gog-plus-palette-input");
    listEl = overlay.querySelector(".gog-plus-palette-list");

    filtered = ACTIONS;
    activeIndex = 0;
    render();

    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) close();
    });
    inputEl.addEventListener("input", () => {
      const q = inputEl.value.trim().toLowerCase();
      filtered = !q
        ? ACTIONS
        : ACTIONS.filter((a) => resolveLabel(a).toLowerCase().includes(q));
      activeIndex = 0;
      render();
    });
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
        render();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        render();
      } else if (e.key === "Enter") {
        e.preventDefault();
        runActive();
      }
    });

    requestAnimationFrame(() => {
      overlay.classList.add("gog-plus-palette-overlay--in");
      inputEl.focus();
    });
  }

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    inputEl = null;
    listEl = null;
  }

  document.addEventListener("keydown", (e) => {
    if (!state.settings.enabled) return;
    const isToggleCombo = (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k";
    if (isToggleCombo) {
      e.preventDefault();
      overlay ? close() : open();
      return;
    }
    if (e.key === "Escape" && overlay) close();
  });

  window.GOGPlusCommandPalette = { open, close };
})();
