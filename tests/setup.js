// Minimal chrome.* shim for the extension code that runs under happy-dom.
// The real APIs are callback-based; the GOGPlusStorage wrapper promisifies.
import { vi } from "vitest";

const stores = { sync: {}, local: {} };
const onChangedListeners = [];
const runtimeListeners = {
  onInstalled: [],
  onStartup: [],
  onMessage: [],
};
const alarmListeners = [];
const commandListeners = [];

const fire = (changes, area) => {
  for (const fn of onChangedListeners) fn(changes, area);
};

const createArea = (name) => ({
  get(keysOrDefaults, cb) {
    const store = stores[name];
    let result = {};
    if (keysOrDefaults == null) {
      result = { ...store };
    } else if (typeof keysOrDefaults === "string") {
      if (keysOrDefaults in store) result[keysOrDefaults] = store[keysOrDefaults];
    } else if (Array.isArray(keysOrDefaults)) {
      for (const k of keysOrDefaults) {
        if (k in store) result[k] = store[k];
      }
    } else {
      for (const [k, def] of Object.entries(keysOrDefaults)) {
        result[k] = k in store ? store[k] : def;
      }
    }
    cb(result);
  },
  set(items, cb) {
    const changes = {};
    for (const [k, v] of Object.entries(items)) {
      changes[k] = { oldValue: stores[name][k], newValue: v };
      stores[name][k] = v;
    }
    fire(changes, name);
    if (cb) cb();
  },
  remove(keys, cb) {
    const arr = Array.isArray(keys) ? keys : [keys];
    for (const k of arr) delete stores[name][k];
    if (cb) cb();
  },
  clear(cb) {
    stores[name] = {};
    if (cb) cb();
  },
  getBytesInUse(keys, cb) {
    const store = stores[name];
    const subset =
      keys == null
        ? store
        : Object.fromEntries(
            (Array.isArray(keys) ? keys : [keys])
              .filter((k) => k in store)
              .map((k) => [k, store[k]])
          );
    cb(JSON.stringify(subset).length);
  },
});

globalThis.chrome = {
  storage: {
    sync: createArea("sync"),
    local: createArea("local"),
    onChanged: {
      addListener: (fn) => onChangedListeners.push(fn),
      removeListener: (fn) => {
        const i = onChangedListeners.indexOf(fn);
        if (i >= 0) onChangedListeners.splice(i, 1);
      },
    },
  },
  runtime: {
    sendMessage: () => {},
    lastError: null,
    getURL: (p) => "chrome-extension://test-id/" + p,
    getManifest: () => ({ version: "2.9.0" }),
    openOptionsPage: vi.fn(),
    onMessage: { addListener: (fn) => runtimeListeners.onMessage.push(fn) },
    onInstalled: { addListener: (fn) => runtimeListeners.onInstalled.push(fn) },
    onStartup: { addListener: (fn) => runtimeListeners.onStartup.push(fn) },
  },
  alarms: {
    create: vi.fn(),
    onAlarm: { addListener: (fn) => alarmListeners.push(fn) },
  },
  action: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
    setTitle: vi.fn(),
  },
  notifications: {
    create: vi.fn(),
  },
  tabs: {
    create: vi.fn(),
    query: vi.fn((_q, cb) => cb([{ id: 1 }])),
    reload: vi.fn(),
  },
  commands: {
    onCommand: { addListener: (fn) => commandListeners.push(fn) },
  },
};

// Exposes every listener registered by extension code via addListener, so
// tests can fire them directly (chrome.alarms.onAlarm, runtime.onInstalled,
// runtime.onMessage, etc.) — these never fire on their own under happy-dom.
globalThis.__chromeListeners = {
  alarm: alarmListeners,
  command: commandListeners,
  ...runtimeListeners,
};

// Test helper: reset both areas between tests
globalThis.__resetChromeStores = () => {
  stores.sync = {};
  stores.local = {};
  onChangedListeners.length = 0;
};
