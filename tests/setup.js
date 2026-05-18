// Minimal chrome.* shim for the extension code that runs under happy-dom.
// The real APIs are callback-based; the GOGPlusStorage wrapper promisifies.

const stores = { sync: {}, local: {} };
const onChangedListeners = [];

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
    onMessage: { addListener: () => {} },
  },
};

// Test helper: reset both areas between tests
globalThis.__resetChromeStores = () => {
  stores.sync = {};
  stores.local = {};
  onChangedListeners.length = 0;
};
