// The background service worker is stopped by the browser whenever it is idle
// and started again for the next event; it must keep nothing important only in
// memory. This kills it over and over and checks that, each time, it comes
// back, answers, keeps one set of alarms, and handles a failing exchange-rate
// service and its recovery.
//
//   node e2e/sw-reliability.mjs

import { startHarness } from "./harness.mjs";

const results = [];
function check(name, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${!ok && detail ? `\n      ${detail}` : ""}`);
}

const h = await startHarness({ extPath: new URL("../extension", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
const page = await h.context.newPage();
await page.goto(`chrome-extension://${h.extId}/options/options.html`);
const cdp = await h.context.newCDPSession(page);
await cdp.send("ServiceWorker.enable");

const send = (msg) => page.evaluate((m) => new Promise((r) => chrome.runtime.sendMessage(m, (res) => r({ res, err: chrome.runtime.lastError?.message || null }))), msg);
const stored = (area, key) => page.evaluate(([a, k]) => new Promise((r) => chrome.storage[a].get(k, (v) => r(v[k]))), [area, key]);
const setStore = (area, items) => page.evaluate(([a, i]) => new Promise((r) => chrome.storage[a].set(i, r)), [area, items]);
const alarms = () => page.evaluate(async () => (await chrome.alarms.getAll()).map((a) => a.name).sort());
async function killWorker() {
  await cdp.send("ServiceWorker.stopAllWorkers");
  await new Promise((r) => setTimeout(r, 600));
}

// Make sure it is up first.
const first = await send({ type: "force-wishlist-refresh" });
check("the worker answers a message", !first.err, first.err || "");
const baseline = await alarms();
check("it has its seven alarms", baseline.length === 7, baseline.join());

await setStore("local", { tags: { a_game: ["rpg"] }, notes: { a_game: "kept" }, priceHistory: { a_game: [{ d: "2026-10-01", p: 5, c: "USD" }] } });
await setStore("sync", { targetCurrency: "ILS", quietHours: { enabled: true, from: "00:00", to: "23:59" } });

let ok = 0;
let dupAlarms = 0;
for (let i = 0; i < 8; i++) {
  await killWorker();
  const r = await send({ type: "force-wishlist-refresh" });
  if (!r.err) ok++;
  const a = await alarms();
  if (a.length !== 7 || a.join() !== baseline.join()) dupAlarms++;
}
check("after 8 kills in a row the worker came back every time (8/8 answered)", ok === 8, `${ok}/8`);
check("…and the set of alarms never changed or doubled", dupAlarms === 0, `${dupAlarms} changes`);
const data = { tags: await stored("local", "tags"), notes: await stored("local", "notes"), hist: await stored("local", "priceHistory") };
check("…and no data was touched by the restarts", JSON.stringify(data.tags) === '{"a_game":["rpg"]}' && data.notes.a_game === "kept" && data.hist.a_game.length === 1);

// Exchange rates: a failing service, then recovery.
let mode = "fail";
await h.context.route("https://api.frankfurter.dev/**", (route) =>
  mode === "fail"
    ? route.fulfill({ status: 503, body: "down" })
    : route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify([{ base: "USD", quote: "ILS", rate: 3.9 }, { base: "USD", quote: "EUR", rate: 0.91 }, { base: "USD", quote: "GBP", rate: 0.79 }, { base: "USD", quote: "PLN", rate: 4.05 }, { base: "USD", quote: "RUB", rate: 88 }]) })
);
await setStore("sync", { rates: { ILS: 3.65, EUR: 0.92, GBP: 0.79, PLN: 4, RUB: 92 }, lastFxError: null, ratesUpdatedAt: 0 });
await killWorker();
await send({ type: "force-fx-refresh" });
await new Promise((r) => setTimeout(r, 1500));
let rates = await stored("sync", "rates");
let err = await stored("sync", "lastFxError");
check("a failing rate service: the old rates are kept and the error is recorded", rates.ILS === 3.65 && !!err, JSON.stringify({ rates, err }));
mode = "ok";
await killWorker();
await send({ type: "force-fx-refresh" });
await new Promise((r) => setTimeout(r, 1500));
rates = await stored("sync", "rates");
err = await stored("sync", "lastFxError");
const at = await stored("sync", "ratesUpdatedAt");
check("when it recovers, the new rates are stored, the error is cleared and the time is stamped", rates.ILS === 3.9 && rates.RUB === 88 && !err && at > 0, JSON.stringify({ rates, err, at }));

// A partial / garbage answer must not corrupt the rates.
await h.context.unroute("https://api.frankfurter.dev/**");
await h.context.route("https://api.frankfurter.dev/**", (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify([{ base: "USD", quote: "ILS", rate: -5 }, { base: "USD", quote: "EUR", rate: "abc" }, { nope: 1 }]) }));
await killWorker();
await send({ type: "force-fx-refresh" });
await new Promise((r) => setTimeout(r, 1500));
rates = await stored("sync", "rates");
check("a garbage answer (negative, text, missing fields) never replaces a good rate", rates.ILS === 3.9 && rates.EUR === 0.91, JSON.stringify(rates));

// Quiet hours: a message that would notify while quiet is held, and the hold survives a restart.
await setStore("local", { notifyQueue: [{ id: "x1", title: "t", message: "m", t: Date.now() }] });
await setStore("sync", { desktopNotifications: true, quietHours: { enabled: true, from: "00:00", to: "23:59" } });
await killWorker();
await send({ type: "force-flush" });
await new Promise((r) => setTimeout(r, 800));
const q = await stored("local", "notifyQueue");
check("during quiet hours a forced flush leaves the held notifications in the queue, across a restart", Array.isArray(q) && q.length === 1, JSON.stringify(q));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await h.cleanup();
process.exit(failed ? 1 : 0);
