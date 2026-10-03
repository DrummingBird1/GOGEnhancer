import { describe, it, expect, beforeEach, vi } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/sync-core.js");
await import("../extension/lib/folder-sync-core.js");

// Stand-in for options.js's real PBKDF2/AES-GCM helpers (covered in
// options.test.js) so these tests can assert on the sync flow, not the crypto.
window.GOGPlusBackupCrypto = {
  ENCRYPTED_BACKUP_FORMAT: "enc-test",
  encryptBackup: async (text, pass) => ({ format: "enc-test", pass, body: text }),
  decryptBackup: async (env, pass) => {
    if (env.pass !== pass) throw new Error("Wrong password, or the file is corrupted.");
    return env.body;
  },
};

await import("../extension/options/folder-sync.js");
const Sync = window.GOGPlusFolderSync;
const FILE = Sync.FILE_NAME;

const getLocal = (keys) => new Promise((r) => chrome.storage.local.get(keys, r));
const setLocal = (items) => new Promise((r) => chrome.storage.local.set(items, r));

function makeDir({ files = {}, permission = "granted" } = {}) {
  const fs = { ...files };
  const dir = {
    kind: "directory",
    name: "SyncFolder",
    __fs: fs,
    __writes: 0,
    queryPermission: vi.fn(async () => permission),
    requestPermission: vi.fn(async () => (permission === "prompt" ? "granted" : permission)),
    getFileHandle: vi.fn(async (name, opts) => {
      if (!(name in fs)) {
        if (!opts?.create) throw Object.assign(new Error("not found"), { name: "NotFoundError" });
        fs[name] = "";
      }
      return {
        getFile: async () => ({ text: async () => fs[name] }),
        createWritable: async () => {
          let buf = "";
          return {
            write: async (t) => (buf += t),
            close: async () => {
              fs[name] = buf;
              dir.__writes++;
            },
          };
        },
      };
    }),
  };
  return dir;
}

const fileText = (obj) => JSON.stringify(obj);
const remoteFile = (data, meta = {}) =>
  fileText({ format: "gog-enhancer-sync", schema: 1, exportedAt: 1, device: "", data, meta });

let memoryHandle;
beforeEach(() => {
  globalThis.__resetChromeStores();
  memoryHandle = undefined;
  Sync.store.get = async () => memoryHandle;
  Sync.store.set = async (h) => (memoryHandle = h);
  Sync.store.clear = async () => (memoryHandle = undefined);
  Sync.ui.askPassphrase = vi.fn(() => "pw");
  delete window.showDirectoryPicker;
});

describe("syncNow", () => {
  it("refuses to run before a folder is chosen", async () => {
    await expect(Sync.syncNow()).rejects.toThrow(/Choose a sync folder first/);
  });

  it("creates the file on first sync and uploads this browser's library", async () => {
    memoryHandle = makeDir();
    await setLocal({ tags: { a: ["x"] }, syncMeta: { "tags:a": { t: 10 } } });
    const r = await Sync.syncNow();
    expect(r).toEqual({ pulled: false, pushed: true, created: true });
    const written = JSON.parse(memoryHandle.__fs[FILE]);
    expect(written.format).toBe("gog-enhancer-sync");
    expect(written.data.tags).toEqual({ a: ["x"] });
    expect(written.meta["tags:a"]).toEqual({ t: 10 });
    expect((await getLocal("lastFolderSyncAt")).lastFolderSyncAt).toBeGreaterThan(0);
  });

  it("merges both ways and writes this browser's data and timestamps in ONE storage call", async () => {
    memoryHandle = makeDir({ files: { [FILE]: remoteFile({ tags: { b: ["y"] } }, { "tags:b": { t: 20 } }) } });
    await setLocal({ tags: { a: ["x"] }, syncMeta: { "tags:a": { t: 10 } } });
    const spy = vi.spyOn(chrome.storage.local, "set");
    const r = await Sync.syncNow();
    expect(r).toEqual({ pulled: true, pushed: true, created: false });

    const local = await getLocal(["tags", "syncMeta"]);
    expect(local.tags).toEqual({ a: ["x"], b: ["y"] });
    expect(local.syncMeta).toEqual({ "tags:a": { t: 10 }, "tags:b": { t: 20 } });
    // Exactly one write carried both the data and syncMeta (+ the later lastFolderSyncAt one).
    const dataWrites = spy.mock.calls.filter(([items]) => "tags" in items);
    expect(dataWrites).toHaveLength(1);
    expect("syncMeta" in dataWrites[0][0]).toBe(true);

    expect(JSON.parse(memoryHandle.__fs[FILE]).data.tags).toEqual({ a: ["x"], b: ["y"] });
  });

  it("only pulls when the file is ahead, and leaves the file alone", async () => {
    memoryHandle = makeDir({ files: { [FILE]: remoteFile({ notes: { a: "from file" } }, { "notes:a": { t: 99 } }) } });
    const r = await Sync.syncNow();
    expect(r).toEqual({ pulled: true, pushed: false, created: false });
    expect(memoryHandle.__writes).toBe(0);
    expect((await getLocal("notes")).notes).toEqual({ a: "from file" });
  });

  it("is a no-op the second time: nothing re-written", async () => {
    memoryHandle = makeDir();
    await setLocal({ tags: { a: ["x"] }, syncMeta: { "tags:a": { t: 10 } } });
    await Sync.syncNow();
    const writesAfterFirst = memoryHandle.__writes;
    const r = await Sync.syncNow();
    expect(r).toEqual({ pulled: false, pushed: false, created: false });
    expect(memoryHandle.__writes).toBe(writesAfterFirst);
  });

  it("asks for folder permission when it has lapsed, and fails clearly when refused", async () => {
    memoryHandle = makeDir({ permission: "prompt" });
    await Sync.syncNow();
    expect(memoryHandle.requestPermission).toHaveBeenCalled();

    memoryHandle = makeDir({ permission: "denied" });
    await expect(Sync.syncNow()).rejects.toThrow(/Permission to use the sync folder was not granted/);
    expect(memoryHandle.__writes).toBe(0);
  });

  it("explains when the file isn't a GOG Enhancer sync file, without touching it", async () => {
    memoryHandle = makeDir({ files: { [FILE]: "hello, I'm not JSON" } });
    await expect(Sync.syncNow()).rejects.toThrow(/valid JSON/);
    expect(memoryHandle.__fs[FILE]).toBe("hello, I'm not JSON");

    memoryHandle = makeDir({ files: { [FILE]: JSON.stringify({ some: "other file" }) } });
    await expect(Sync.syncNow()).rejects.toThrow(/doesn't look like/);
  });

  it("rethrows unexpected file-system errors instead of treating them as 'no file yet'", async () => {
    memoryHandle = makeDir();
    memoryHandle.getFileHandle = vi.fn(async () => {
      throw Object.assign(new Error("disk on fire"), { name: "NotReadableError" });
    });
    await expect(Sync.syncNow()).rejects.toThrow(/disk on fire/);
  });

  describe("encryption", () => {
    it("decrypts an encrypted file with one prompt, merges, and writes it back encrypted", async () => {
      const inner = remoteFile({ tags: { b: ["y"] } }, { "tags:b": { t: 20 } });
      memoryHandle = makeDir({ files: { [FILE]: JSON.stringify({ format: "enc-test", pass: "pw", body: inner }) } });
      await setLocal({ tags: { a: ["x"] }, syncMeta: { "tags:a": { t: 10 } } });
      const r = await Sync.syncNow();
      expect(r.pushed).toBe(true);
      expect(Sync.ui.askPassphrase).toHaveBeenCalledTimes(1);
      const out = JSON.parse(memoryHandle.__fs[FILE]);
      expect(out.format).toBe("enc-test");
      expect(JSON.parse(out.body).data.tags).toEqual({ a: ["x"], b: ["y"] });
    });

    it("cancelling the passphrase leaves both sides exactly as they were", async () => {
      const inner = remoteFile({ tags: { b: ["y"] } }, { "tags:b": { t: 20 } });
      const original = JSON.stringify({ format: "enc-test", pass: "pw", body: inner });
      memoryHandle = makeDir({ files: { [FILE]: original } });
      await setLocal({ tags: { a: ["x"] } });
      Sync.ui.askPassphrase = vi.fn(() => null);
      await expect(Sync.syncNow()).rejects.toThrow(/no passphrase was given/);
      expect(memoryHandle.__fs[FILE]).toBe(original);
      expect((await getLocal("tags")).tags).toEqual({ a: ["x"] });
    });

    it("a wrong passphrase fails without changing anything", async () => {
      const original = JSON.stringify({ format: "enc-test", pass: "right", body: remoteFile({}) });
      memoryHandle = makeDir({ files: { [FILE]: original } });
      Sync.ui.askPassphrase = vi.fn(() => "wrong");
      await expect(Sync.syncNow()).rejects.toThrow(/Wrong password/);
      expect(memoryHandle.__fs[FILE]).toBe(original);
    });

    it("turning encryption on encrypts a plaintext file right away, even with nothing else to push", async () => {
      memoryHandle = makeDir({ files: { [FILE]: remoteFile({}) } });
      await setLocal({ syncEncrypt: true });
      const r = await Sync.syncNow();
      expect(r.pushed).toBe(true);
      expect(Sync.ui.askPassphrase).toHaveBeenCalledWith(expect.stringContaining("Choose a passphrase"));
      expect(JSON.parse(memoryHandle.__fs[FILE]).format).toBe("enc-test");
    });

    it("creating an encrypted file and cancelling the passphrase writes nothing", async () => {
      memoryHandle = makeDir();
      await setLocal({ syncEncrypt: true });
      Sync.ui.askPassphrase = vi.fn(() => "");
      await expect(Sync.syncNow()).rejects.toThrow(/no passphrase given/);
      expect(memoryHandle.__fs[FILE]).toBeUndefined();
    });

    it("never downgrades an encrypted file to plaintext, even if this browser's setting is off", async () => {
      const inner = remoteFile({ notes: { a: "n" } }, { "notes:a": { t: 5 } });
      memoryHandle = makeDir({ files: { [FILE]: JSON.stringify({ format: "enc-test", pass: "pw", body: inner }) } });
      await setLocal({ syncEncrypt: false, tags: { z: ["new"] }, syncMeta: { "tags:z": { t: 50 } } });
      await Sync.syncNow();
      expect(JSON.parse(memoryHandle.__fs[FILE]).format).toBe("enc-test");
    });
  });
});

describe("handle store (IndexedDB)", () => {
  it("persists, returns and clears a handle", async () => {
    // Use the real implementation, not the in-memory stand-in.
    const real = await (async () => {
      vi.resetModules();
      delete window.GOGPlusFolderSync;
      await import("../extension/options/folder-sync.js");
      return window.GOGPlusFolderSync.store;
    })();
    expect(await real.get()).toBeUndefined();
    await real.set({ kind: "directory", name: "Folder" });
    expect(await real.get()).toEqual({ kind: "directory", name: "Folder" });
    await real.clear();
    expect(await real.get()).toBeUndefined();
  });
});

describe("helpers", () => {
  it("describeResult covers every outcome", () => {
    const d = (o) => Sync.describeResult({ pulled: false, pushed: false, created: false, ...o });
    expect(d({ created: true, pushed: true })).toMatch(/Created the sync file/);
    expect(d({ pulled: true, pushed: true })).toMatch(/both updated/);
    expect(d({ pulled: true })).toMatch(/Updated this browser/);
    expect(d({ pushed: true })).toMatch(/Updated the sync file/);
    expect(d({})).toBe("Already in sync.");
  });

  it("formatAgo is human-readable", () => {
    const now = Date.now();
    expect(Sync.formatAgo(0)).toBe("Never");
    expect(Sync.formatAgo(now)).toBe("just now");
    expect(Sync.formatAgo(now - 5 * 60000)).toBe("5 min ago");
    expect(Sync.formatAgo(now - 3 * 3600000)).toBe("3h ago");
    expect(Sync.formatAgo(now - 49 * 3600000)).toBe("2d ago");
  });

  it("isSupported reflects showDirectoryPicker", () => {
    expect(Sync.isSupported()).toBe(false);
    window.showDirectoryPicker = () => {};
    expect(Sync.isSupported()).toBe(true);
  });
});

describe("chooseFolder / forget", () => {
  it("chooseFolder saves the handle and the folder name", async () => {
    const dir = makeDir();
    window.showDirectoryPicker = vi.fn(async () => dir);
    expect(await Sync.chooseFolder()).toBe("SyncFolder");
    expect(memoryHandle).toBe(dir);
    expect(window.showDirectoryPicker).toHaveBeenCalledWith(expect.objectContaining({ mode: "readwrite" }));
    expect((await getLocal("syncFolderName")).syncFolderName).toBe("SyncFolder");
  });

  it("chooseFolder explains when the browser has no folder picker", async () => {
    await expect(Sync.chooseFolder()).rejects.toThrow(/can't pick a folder/);
  });

  it("forget clears the handle and folder name", async () => {
    memoryHandle = makeDir();
    await setLocal({ syncFolderName: "SyncFolder", lastFolderSyncAt: 5 });
    await Sync.forget();
    expect(memoryHandle).toBeUndefined();
    const l = await getLocal(["syncFolderName", "lastFolderSyncAt"]);
    expect(l).toEqual({ syncFolderName: "", lastFolderSyncAt: 0 });
  });
});

describe("page wiring (init)", () => {
  const fixture = `
    <section id="syncCard">
      <p id="syncUnsupported" hidden></p>
      <span id="syncFolderName"></span><span id="syncLast"></span>
      <input type="checkbox" id="syncEncrypt">
      <button id="syncChoose"></button><button id="syncNow"></button><button id="syncForget"></button>
      <p id="syncResult"></p>
    </section>`;
  const $ = (id) => document.getElementById(id);
  const settle = () => new Promise((r) => setTimeout(r, 15));

  beforeEach(() => {
    document.body.innerHTML = fixture;
    window.confirm = vi.fn(() => true);
  });

  it("does nothing on a page without the sync card", async () => {
    document.body.innerHTML = "";
    await expect(Sync.init()).resolves.toBeUndefined();
  });

  it("says so, and disables Choose, when the browser can't pick folders", async () => {
    await Sync.init();
    expect($("syncUnsupported").hidden).toBe(false);
    expect($("syncChoose").disabled).toBe(true);
    expect($("syncNow").disabled).toBe(true);
  });

  it("choose → sync → forget, end to end", async () => {
    const dir = makeDir();
    window.showDirectoryPicker = vi.fn(async () => dir);
    await Sync.init();
    expect($("syncFolderName").textContent).toBe("None chosen");
    expect($("syncNow").disabled).toBe(true);

    $("syncChoose").click();
    await settle();
    expect($("syncFolderName").textContent).toBe("SyncFolder");
    expect($("syncResult").textContent).toMatch(/Folder "SyncFolder" chosen/);
    expect($("syncNow").disabled).toBe(false);

    $("syncNow").click();
    await settle();
    expect($("syncResult").textContent).toMatch(/Created the sync file/);
    expect($("syncLast").textContent).toBe("just now");

    $("syncForget").click();
    await settle();
    expect($("syncResult").textContent).toBe("Stopped syncing.");
    expect($("syncFolderName").textContent).toBe("None chosen");
    expect($("syncNow").disabled).toBe(true);
  });

  it("shows an error when a sync fails, and re-enables the buttons", async () => {
    memoryHandle = makeDir({ permission: "denied" });
    await setLocal({ syncFolderName: "SyncFolder" });
    window.showDirectoryPicker = vi.fn();
    await Sync.init();
    $("syncNow").click();
    await settle();
    expect($("syncResult").textContent).toMatch(/not granted/);
    expect($("syncResult").classList.contains("has-error")).toBe(true);
    expect($("syncNow").disabled).toBe(false);
  });

  it("closing the folder picker is not an error", async () => {
    window.showDirectoryPicker = vi.fn(async () => {
      throw Object.assign(new Error("closed"), { name: "AbortError" });
    });
    await Sync.init();
    $("syncChoose").click();
    await settle();
    expect($("syncResult").textContent).toBe("");
    expect($("syncResult").classList.contains("has-error")).toBe(false);
  });

  it("keeps the sync file when the user declines 'Stop syncing'", async () => {
    memoryHandle = makeDir();
    await setLocal({ syncFolderName: "SyncFolder" });
    window.showDirectoryPicker = vi.fn();
    window.confirm = vi.fn(() => false);
    await Sync.init();
    $("syncForget").click();
    await settle();
    expect(memoryHandle).toBeDefined();
    expect((await getLocal("syncFolderName")).syncFolderName).toBe("SyncFolder");
  });

  it("persists the encrypt checkbox", async () => {
    window.showDirectoryPicker = vi.fn();
    await Sync.init();
    $("syncEncrypt").checked = true;
    $("syncEncrypt").dispatchEvent(new Event("change"));
    await settle();
    expect((await getLocal("syncEncrypt")).syncEncrypt).toBe(true);
  });

  it("non-Error rejections are still shown", async () => {
    window.showDirectoryPicker = vi.fn(async () => {
      throw "plain string failure";
    });
    await Sync.init();
    $("syncChoose").click();
    await settle();
    expect($("syncResult").textContent).toBe("plain string failure");
  });
});
