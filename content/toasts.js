/**
 * GOG+ toast notifications.
 *
 * Used to provide visual feedback when settings change while the user
 * is on a GOG page (so they know the change took effect).
 *
 * Usage:
 *   window.GOGPlusToasts.show("Hebrew translations enabled");
 *   window.GOGPlusToasts.show("Refund badge off", { variant: "muted" });
 */

(() => {
  "use strict";

  let host = null;

  function ensureHost() {
    if (host) return host;
    host = document.createElement("div");
    host.className = "gog-plus-toasts";
    document.body.appendChild(host);
    return host;
  }

  function show(message, opts = {}) {
    const { variant = "default", duration = 2400 } = opts;
    ensureHost();
    const el = document.createElement("div");
    el.className = `gog-plus-toast gog-plus-toast--${variant}`;
    el.textContent = message;
    host.appendChild(el);

    requestAnimationFrame(() => el.classList.add("gog-plus-toast--in"));

    setTimeout(() => {
      el.classList.remove("gog-plus-toast--in");
      el.classList.add("gog-plus-toast--out");
      setTimeout(() => el.remove(), 250);
    }, duration);
  }

  window.GOGPlusToasts = { show };
})();
