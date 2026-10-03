/**
 * GOG+ options page: the privacy dashboard. Shows, from the extension's own
 * records on this device:
 *
 *   • what it contacted (the local request log written by lib/net.js),
 *   • what it keeps, by kind and size, with a button to forget what it learned
 *     about your library and one to delete everything,
 *   • any extra site access the browser has granted it (the optional webhook
 *     origin), with a way to take it back.
 *
 * Nothing here is sent anywhere; it only reads what the extension already
 * stored.
 */

(() => {
  "use strict";

  /** The page's controls are looked up by id and used as inputs, buttons, … — typed loosely on purpose. */
  const $ = /** @type {(id: string) => any} */ ((id) => document.getElementById(id));
  const View = () => window.GOGPlusPrivacyView;
  const Net = () => window.GOGPlusNet;

  /**
   * @param {string[]} headers
   * @param {Array<Array<string | { text: string, cls?: string }>>} rows
   * @param {string} [caption]
   */
  function table(headers, rows, caption) {
    const t = document.createElement("table");
    t.className = "priv-table";
    if (caption) {
      const c = document.createElement("caption");
      c.className = "sr-only";
      c.textContent = caption;
      t.appendChild(c);
    }
    const head = document.createElement("tr");
    for (const h of headers) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = h;
      head.appendChild(th);
    }
    const thead = document.createElement("thead");
    thead.appendChild(head);
    t.appendChild(thead);
    const body = document.createElement("tbody");
    for (const r of rows) {
      const tr = document.createElement("tr");
      for (const cell of r) {
        const td = document.createElement("td");
        if (typeof cell === "string") td.textContent = cell;
        else {
          td.textContent = cell.text;
          if (cell.cls) td.className = cell.cls;
        }
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }
    t.appendChild(body);
    return t;
  }

  /** @param {string} id @param {string} text */
  function note(id, text) {
    const host = $(id);
    if (!host) return;
    host.replaceChildren();
    const p = document.createElement("p");
    p.className = "card-sub";
    p.textContent = text;
    host.appendChild(p);
  }

  /* ---------------- what it contacted ---------------- */

  async function renderNet() {
    const host = $("privNet");
    if (!host) return;
    const { netLog = [] } = await window.GOGPlusStorage.get({ netLog: [] });
    if (!netLog.length) {
      note("privNet", "Nothing yet. Every request the extension makes is listed here — with the host and path, never what you searched for.");
      return;
    }
    const summary = Net().summarize(netLog).map((r) => [
      r.host,
      View().purpose({ kind: r.kind, host: r.host }),
      String(r.count),
      { text: String(r.failed), cls: r.failed ? "priv-bad" : "" },
      View().ago(r.last),
    ]);
    host.replaceChildren(table(["Address", "What for", "Requests", "Failed", "Last"], summary, "Addresses the extension contacted"));

    const details = document.createElement("details");
    const s = document.createElement("summary");
    s.textContent = "The most recent requests";
    details.appendChild(s);
    details.appendChild(
      table(
        ["When", "What for", "Request", "Result"],
        View()
          .recentRows(netLog)
          .map((r) => [r.when, r.what, r.where, { text: r.result, cls: r.ok ? "" : "priv-bad" }]),
        "Recent requests"
      )
    );
    host.appendChild(details);
  }

  /* ---------------- what it keeps ---------------- */

  /** @param {string[] | null} keys @returns {Promise<number>} */
  const bytesIn = (keys) =>
    new Promise((resolve) => chrome.storage.local.getBytesInUse(keys, (n) => resolve(chrome.runtime.lastError ? 0 : n || 0)));

  async function renderStore() {
    const host = $("privStore");
    if (!host) return;
    const all = await new Promise((r) => chrome.storage.local.get(null, r));
    const keys = Object.keys(all);
    /** @type {Record<string, number>} */
    const byKey = {};
    await Promise.all(keys.map(async (k) => (byKey[k] = await bytesIn([k]))));
    const { rows, total } = View().groupSizes(byKey, keys);
    if (!rows.length) {
      note("privStore", "Nothing is stored on this device yet.");
      return;
    }
    host.replaceChildren(
      table(
        ["Kind", "Size"],
        [...rows.map((r) => [r.label, View().formatBytes(r.bytes)]), [{ text: "Total on this device", cls: "priv-total" }, { text: View().formatBytes(total), cls: "priv-total" }]],
        "Data kept on this device"
      )
    );
  }

  /* ---------------- extra site access ---------------- */

  async function renderPerms() {
    const host = $("privPerms");
    if (!host) return;
    if (!chrome.permissions?.getAll) {
      note("privPerms", "This browser doesn't report extra site access.");
      return;
    }
    const granted = await chrome.permissions.getAll();
    const base = new Set(chrome.runtime.getManifest().host_permissions || []);
    const extra = (granted.origins || []).filter((o) => !base.has(o));
    if (!extra.length) {
      note("privPerms", "None. The extension only has access to the sites listed above; the optional webhook permission is asked for only if you set a webhook up.");
      return;
    }
    host.replaceChildren();
    for (const origin of extra) {
      const row = document.createElement("div");
      row.className = "priv-perm";
      const label = document.createElement("span");
      label.textContent = origin;
      const revoke = document.createElement("button");
      revoke.type = "button";
      revoke.className = "ghost";
      revoke.textContent = "Take this access back";
      revoke.addEventListener("click", async () => {
        await chrome.permissions.remove({ origins: [origin] });
        await renderPerms();
      });
      row.append(label, revoke);
      host.appendChild(row);
    }
    const hint = document.createElement("p");
    hint.className = "card-sub";
    hint.textContent = "This is the address you gave as a webhook. Taking the access back stops notifications from being sent there until you allow it again.";
    host.appendChild(hint);
  }

  /* ---------------- actions ---------------- */

  async function clearLog() {
    await window.GOGPlusStorage.set({ netLog: [] });
    await renderNet();
  }

  async function forgetLearned() {
    if (
      !window.confirm(
        "Forget what GOG Enhancer learned about your library?\n\nThis removes the list of games it saw marked as yours, the facts it read from game pages (ratings, languages, last prices) and the cached pack contents. It will be learned again as you browse. Your tags, notes, price history and lists are not touched."
      )
    ) {
      return;
    }
    await new Promise((r) => chrome.storage.local.remove(View().LEARNED_KEYS, () => r(undefined)));
    await renderStore();
  }

  async function render() {
    await Promise.all([renderNet(), renderStore(), renderPerms()]);
  }

  async function init() {
    if (!$("privNet")) return;
    $("privClearLog")?.addEventListener("click", clearLog);
    $("privForget")?.addEventListener("click", forgetLearned);
    // The deletion itself (with its confirmations) is the "Reset everything" button above.
    $("privDeleteAll")?.addEventListener("click", () => $("clearAll")?.click());
    window.GOGPlusStorage.onChange(({ key }) => {
      if (key === "netLog") renderNet();
    });
    await render();
  }

  window.GOGPlusPrivacySection = { init, render, renderNet, renderStore, renderPerms, clearLog, forgetLearned };

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
