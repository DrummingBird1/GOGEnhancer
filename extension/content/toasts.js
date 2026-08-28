/**
 * GOG+ toast notifications.
 *
 * Used to provide visual feedback when settings change while the user
 * is on a GOG page (so they know the change took effect), and — since the
 * tag dashboard also loads this module — for confirming actions there too
 * (e.g. an "Undo" action after deleting a tag, replacing a blocking
 * confirm() dialog with a reversible one).
 *
 * Usage:
 *   window.GOGPlusToasts.show("Hebrew translations enabled");
 *   window.GOGPlusToasts.show("Refund badge off", { variant: "muted" });
 *   window.GOGPlusToasts.show("Tag deleted", {
 *     duration: 5000,
 *     action: { label: "Undo", onClick: () => restoreTag() },
 *   });
 */
// @ts-check

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
    const { variant = "default", duration = 2400, action } = opts;
    ensureHost();
    const el = document.createElement("div");
    el.className = `gog-plus-toast gog-plus-toast--${variant}`;

    const text = document.createElement("span");
    text.className = "gog-plus-toast-text";
    text.textContent = message;
    el.appendChild(text);

    const dismiss = () => {
      el.classList.remove("gog-plus-toast--in");
      el.classList.add("gog-plus-toast--out");
      setTimeout(() => el.remove(), 250);
    };

    let dismissTimer = setTimeout(dismiss, duration);

    if (action?.label && typeof action.onClick === "function") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gog-plus-toast-action";
      btn.textContent = action.label;
      btn.addEventListener("click", () => {
        clearTimeout(dismissTimer);
        action.onClick();
        dismiss();
      });
      el.appendChild(btn);
      // Give the user time to actually click it, rather than the default
      // glance-and-gone duration.
      clearTimeout(dismissTimer);
      dismissTimer = setTimeout(dismiss, Math.max(duration, 4000));
    }

    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add("gog-plus-toast--in"));
  }

  window.GOGPlusToasts = { show };
})();
