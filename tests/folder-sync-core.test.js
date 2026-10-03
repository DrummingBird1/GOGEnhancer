import { describe, it, expect, beforeEach, vi } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/sync-core.js");

// Stand-in for lib/backup-crypto.js's real PBKDF2/AES-GCM (covered elsewhere)
window.GOGPlusBackupCrypto = {
  ENCRYPTED_BACKUP_FORMAT: "enc-test",
  encryptBackup: async (text, pass) => ({ format: "enc-test", pass, body: text }),
  decryptBackup: async (env, pass) => {
    if (env.pass !== pass) throw new Error("Wrong password, or the file is corrupted.");
    return env.body;
  },
};
await import("../extension/lib/folder-sync-core.js");

const Core = window.GOGPlusFolderSyncCore;
const FILE = Core.FILE_NAME;
const getLocal = (keys) => new Promise((r) => chrome.storage.local.get(keys, r));
const setLocal = (items) => new Promise((r) => chrome.storage.local.set(items, r));
const setSync = (items) => new Promise((r) => chrome.storage.sync.set(items, r));

function makeDir({ files = {}, permission = "granted" } = {}) {
  const fs = { ...files };
  const dir = {
    kind: "directory",
    name: "SyncFolder",
    __fs: fs,
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
          return { write: async (t) => (buf += t), close: async () => (fs[name] = buf) };
        },
      };
    }),
    removeEntry: vi.fn(async (name) => {
      delete fs[name];
    }),
    entries: async function* () {
      for (const name of Object.keys(fs)) yield [name, {}];
    },
  };
  return dir;
}

const remoteFile = (data, meta = {}) => JSON.stringify({ format: "gog-enhancer-sync", schema: 1, exportedAt: 1, device: "", data, meta });
let handle;
const store = { get: async () => handle, set: async (h) => (handle = h), clear: async () => (handle = undefined) };

beforeEach(() => {
  globalThis.__resetChromeStores();
  handle = undefined;
});

describe("conflicts found by a sync", () => {
  it("records records both browsers changed since the last sync, then lets the user overrule the winner", async () => {
    handle = makeDir({ files: { [FILE]: remoteFile({ tags: { a: ["theirs"] } }, { "tags:a": { t: 300 } }) } });
    await setLocal({
      tags: { a: ["mine"] },
      syncMeta: { "tags:a": { t: 200 } },
      syncBaseMeta: { "tags:a": { t: 100 } }, // the point both sides last agreed
    });
    await Core.syncNow({ store });
    const { syncConflicts, tags } = await getLocal(["syncConflicts", "tags"]);
    expect(tags.a).toEqual(["theirs"]); // newest wins
    expect(syncConflicts).toEqual([expect.objectContaining({ key: "tags", id: "a", local: ["mine"], remote: ["theirs"], kept: "remote" })]);
    expect(syncConflicts[0].t).toBeGreaterThan(0);

    await Core.resolveConflict(syncConflicts[0], "local");
    expect((await getLocal(["tags"])).tags.a).toEqual(["mine"]);
    expect((await getLocal(["syncConflicts"])).syncConflicts).toEqual([]);
  });

  it("finds no conflicts on a first sync, and keeps the base for the next one", async () => {
    handle = makeDir({ files: { [FILE]: remoteFile({ tags: { a: ["theirs"] } }, { "tags:a": { t: 300 } }) } });
    await setLocal({ tags: { a: ["mine"] }, syncMeta: { "tags:a": { t: 200 } } });
    await Core.syncNow({ store });
    expect((await getLocal(["syncConflicts"])).syncConflicts).toBeUndefined();
    expect((await getLocal(["syncBaseMeta"])).syncBaseMeta).toEqual({ "tags:a": { t: 300 } });
  });

  it("dismissing a conflict by choosing the side that already won changes no data", async () => {
    const c = { key: "notes", id: "x", local: "L", remote: "R", kept: "remote", t: 5 };
    await setLocal({ notes: { x: "R" }, syncConflicts: [c, { ...c, id: "y" }] });
    await Core.resolveConflict(c, "remote");
    expect((await getLocal(["notes"])).notes).toEqual({ x: "R" });
    expect((await getLocal(["syncConflicts"])).syncConflicts.map((x) => x.id)).toEqual(["y"]);
  });

  it("can restore a record the other side deleted", async () => {
    const c = { key: "notes", id: "x", local: "mine", remote: undefined, kept: "remote", t: 5 };
    await setLocal({ notes: {}, syncConflicts: [c] });
    await Core.resolveConflict(c, "local");
    expect((await getLocal(["notes"])).notes).toEqual({ x: "mine" });
    // and delete one the other side edited
    const d = { key: "notes", id: "x", local: undefined, remote: "theirs", kept: "remote", t: 6 };
    await setLocal({ notes: { x: "theirs" }, syncConflicts: [d] });
    await Core.resolveConflict(d, "local");
    expect((await getLocal(["notes"])).notes).toEqual({});
  });
});

describe("non-interactive sync (the service worker)", () => {
  it("asks for nothing: a folder that isn't chosen, a permission that must be re-granted, a passphrase", async () => {
    await expect(Core.syncNow({ store, interactive: false })).rejects.toMatchObject({ code: "no-folder" });
    handle = makeDir({ permission: "prompt" });
    await expect(Core.syncNow({ store, interactive: false })).rejects.toMatchObject({ name: "SyncNeedsInteraction", code: "permission" });
    expect(handle.requestPermission).not.toHaveBeenCalled();
    handle = makeDir({ files: { [FILE]: JSON.stringify({ format: "enc-test", pass: "pw", body: remoteFile({}) }) } });
    await expect(Core.syncNow({ store, interactive: false })).rejects.toMatchObject({ code: "passphrase" });
  });

  it("asks only when it may", async () => {
    handle = makeDir({ permission: "prompt" });
    await Core.syncNow({ store, interactive: true });
    expect(handle.requestPermission).toHaveBeenCalled();
    handle = makeDir({ permission: "denied" });
    await expect(Core.syncNow({ store, interactive: true })).rejects.toThrow(/not granted/);
  });
});

describe("autoSync", () => {
  beforeEach(async () => {
    handle = makeDir();
    await setLocal({ syncFolderName: "SyncFolder", tags: { a: ["x"] }, syncMeta: { "tags:a": { t: 1 } } });
  });

  it("does nothing unless switched on and a folder is chosen", async () => {
    expect(await Core.autoSync({ store })).toEqual({ ran: false, reason: "off" });
    await setLocal({ autoSync: true, syncFolderName: "" });
    expect(await Core.autoSync({ store })).toEqual({ ran: false, reason: "off" });
  });

  it("syncs when due, and not again within the minimum gap", async () => {
    await setLocal({ autoSync: true });
    const first = await Core.autoSync({ store, now: 1_000_000_000 });
    expect(first).toMatchObject({ ran: true, result: { created: true, pushed: true } });
    expect(await Core.autoSync({ store, now: Date.now() + 1000 })).toEqual({ ran: false, reason: "recent" });
  });

  it("reports what stopped it instead of throwing", async () => {
    await setLocal({ autoSync: true });
    handle = makeDir({ permission: "prompt" });
    expect(await Core.autoSync({ store, interactive: false })).toEqual({ ran: false, reason: "permission" });
    handle.getFileHandle = vi.fn(async () => {
      throw new Error("disk on fire");
    });
    handle.queryPermission = async () => "granted";
    expect(await Core.autoSync({ store, interactive: false })).toEqual({ ran: false, reason: "disk on fire" });
  });
});

describe("dated backups", () => {
  const NOW = Date.parse("2026-10-02T10:00:00Z");

  beforeEach(async () => {
    handle = makeDir();
    await setSync({ theme: "neon" });
    await setLocal({
      tags: { a: ["x"] },
      webhookUrl: "https://discord.com/api/webhooks/1/secret",
      webhookEnabled: true,
      syncFolderName: "SyncFolder",
      notifyQueue: [{ id: "q" }],
    });
  });

  it("writes today's backup without per-browser items or the webhook secret", async () => {
    const r = await Core.writeBackup({ store, now: NOW });
    expect(r.file).toBe("gog-enhancer-backup-2026-10-02.json");
    const body = JSON.parse(handle.__fs[r.file]);
    expect(body.format).toBe("gog-enhancer-backup");
    expect(body.data.tags).toEqual({ a: ["x"] });
    expect(body.data.theme).toBe("neon");
    for (const k of ["webhookUrl", "webhookEnabled", "syncFolderName", "notifyQueue"]) expect(body.data[k]).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("secret");
    expect((await getLocal(["lastAutoBackupAt"])).lastAutoBackupAt).toBe(NOW);
  });

  it("keeps only the newest N dated backups, and never touches other files", async () => {
    handle = makeDir({
      files: {
        [FILE]: "{}",
        "notes.txt": "mine",
        "gog-enhancer-backup-2026-09-28.json": "{}",
        "gog-enhancer-backup-2026-09-29.json": "{}",
        "gog-enhancer-backup-2026-09-30.json": "{}",
        "gog-enhancer-backup-2026-10-01.json.enc": "{}",
      },
    });
    const r = await Core.writeBackup({ store, now: NOW, keep: 3 });
    // keep=3 counts today's new file: 10-02, 10-01 (.enc) and 09-30 stay
    expect(r.removed.sort()).toEqual(["gog-enhancer-backup-2026-09-28.json", "gog-enhancer-backup-2026-09-29.json"]);
    expect(Object.keys(handle.__fs).sort()).toEqual(["gog-enhancer-backup-2026-09-30.json", "gog-enhancer-backup-2026-10-01.json.enc", "gog-enhancer-backup-2026-10-02.json", FILE, "notes.txt"]);
  });

  it("keeps going when an old backup can't be deleted", async () => {
    handle = makeDir({ files: { "gog-enhancer-backup-2026-09-01.json": "{}" } });
    handle.removeEntry = vi.fn(async () => {
      throw new Error("locked");
    });
    const r = await Core.writeBackup({ store, now: NOW, keep: 1 });
    expect(r.removed).toEqual([]);
    expect(r.file).toBe("gog-enhancer-backup-2026-10-02.json");
  });

  it("encrypts when the sync file is set to be encrypted, and needs a passphrase to do it", async () => {
    await setLocal({ syncEncrypt: true });
    await expect(Core.writeBackup({ store, now: NOW })).rejects.toMatchObject({ code: "passphrase" });
    await expect(Core.writeBackup({ store, now: NOW, askPassphrase: () => "" })).rejects.toThrow(/cancelled/);
    const r = await Core.writeBackup({ store, now: NOW, askPassphrase: async () => "pw" });
    expect(r.file).toBe("gog-enhancer-backup-2026-10-02.json.enc");
    expect(JSON.parse(handle.__fs[r.file])).toMatchObject({ format: "enc-test", pass: "pw" });
  });

  it("needs a chosen folder", async () => {
    handle = undefined;
    await expect(Core.writeBackup({ store })).rejects.toMatchObject({ code: "no-folder" });
  });

  it("clamps how many it keeps", async () => {
    handle = makeDir({ files: { "gog-enhancer-backup-2026-09-01.json": "{}", "gog-enhancer-backup-2026-09-02.json": "{}" } });
    await setLocal({ autoBackupKeep: 0 });
    const r = await Core.writeBackup({ store, now: NOW, keep: 0 });
    expect(r.removed).toHaveLength(2); // at least one is always kept: today's
  });
});

describe("autoBackup", () => {
  beforeEach(async () => {
    handle = makeDir();
    await setLocal({ syncFolderName: "SyncFolder", tags: {} });
  });

  it("runs once a day when on, and says why when it does not", async () => {
    expect(await Core.autoBackup({ store })).toEqual({ ran: false, reason: "off" });
    await setLocal({ autoBackup: true });
    const NOW = Date.parse("2026-10-02T10:00:00Z");
    expect((await Core.autoBackup({ store, now: NOW })).ran).toBe(true);
    expect(await Core.autoBackup({ store, now: NOW + 3600e3 })).toEqual({ ran: false, reason: "recent" });
    expect((await Core.autoBackup({ store, now: NOW + 25 * 3600e3 })).ran).toBe(true);
  });

  it("reports what stopped it", async () => {
    await setLocal({ autoBackup: true });
    handle = makeDir({ permission: "prompt" });
    expect(await Core.autoBackup({ store, interactive: false })).toEqual({ ran: false, reason: "permission" });
    handle = makeDir();
    handle.getFileHandle = async () => {
      throw new Error("nope");
    };
    expect(await Core.autoBackup({ store })).toEqual({ ran: false, reason: "nope" });
  });
});

describe("describeResult", () => {
  it("says what happened in plain words", () => {
    expect(Core.describeResult({ created: true, pulled: false, pushed: true })).toMatch(/Created/);
    expect(Core.describeResult({ created: false, pulled: true, pushed: true })).toMatch(/both/);
    expect(Core.describeResult({ created: false, pulled: true, pushed: false })).toMatch(/Updated this browser/);
    expect(Core.describeResult({ created: false, pulled: false, pushed: true })).toMatch(/sync file/);
    expect(Core.describeResult({ created: false, pulled: false, pushed: false })).toBe("Already in sync.");
  });
});
