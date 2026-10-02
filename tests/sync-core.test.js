import { describe, it, expect } from "vitest";

await import("../extension/lib/sync-core.js");

const Sync = window.GOGPlusSyncCore;
const DAY = 24 * 60 * 60 * 1000;

const snap = (data = {}, meta = {}) => ({ data, meta });

describe("stampChanges", () => {
  it("stamps added and modified keys, and tombstones removed ones", () => {
    const meta = {};
    const added = Sync.stampChanges("tags", {}, { a: ["x"] }, meta, 100);
    expect(added).toEqual({ "tags:a": { t: 100 } });

    const edited = Sync.stampChanges("tags", { a: ["x"] }, { a: ["x", "y"] }, added, 200);
    expect(edited["tags:a"]).toEqual({ t: 200 });

    const removed = Sync.stampChanges("tags", { a: ["x"] }, {}, edited, 300);
    expect(removed["tags:a"]).toEqual({ t: 300, del: true });
  });

  it("returns null when nothing a sync cares about changed", () => {
    expect(Sync.stampChanges("tags", { a: ["x"] }, { a: ["x"] }, {}, 1)).toBeNull();
    expect(Sync.stampChanges("tags", undefined, undefined, {}, 1)).toBeNull();
    // Same content, different key order — not a change.
    expect(
      Sync.stampChanges("purchaseLog", { a: { date: "d", price: 1 } }, { a: { price: 1, date: "d" } }, {}, 1)
    ).toBeNull();
  });

  it("only touches the keys that changed and never mutates its input", () => {
    const meta = { "tags:keep": { t: 5 } };
    const out = Sync.stampChanges("tags", { keep: ["a"], b: [] }, { keep: ["a"], b: ["z"] }, meta, 9);
    expect(out["tags:keep"]).toEqual({ t: 5 });
    expect(out["tags:b"]).toEqual({ t: 9 });
    expect(meta).toEqual({ "tags:keep": { t: 5 } });
  });

  it("stamps tagOrder as one unit", () => {
    expect(Sync.stampChanges("tagOrder", ["a"], ["b", "a"], {}, 7)).toEqual({ "tagOrder:_": { t: 7 } });
    expect(Sync.stampChanges("tagOrder", ["a"], ["a"], {}, 7)).toBeNull();
  });

  it("ignores datasets that merge by union instead", () => {
    expect(Sync.stampChanges("priceHistory", {}, { a: [] }, {}, 1)).toBeNull();
    expect(Sync.stampChanges("achievements", {}, { x: "d" }, {}, 1)).toBeNull();
    expect(Sync.stampChanges("theme", "a", "b", {}, 1)).toBeNull();
  });
});

describe("mergeSnapshots — records", () => {
  it("unions keys that only one side has", () => {
    const local = snap({ tags: { a: ["x"] } }, { "tags:a": { t: 10 } });
    const remote = snap({ tags: { b: ["y"] } }, { "tags:b": { t: 20 } });
    const m = Sync.mergeSnapshots(local, remote, { now: 1000 });
    expect(m.data.tags).toEqual({ a: ["x"], b: ["y"] });
    expect(m.meta).toEqual({ "tags:a": { t: 10 }, "tags:b": { t: 20 } });
    expect(m.localChanged).toBe(true);
    expect(m.remoteChanged).toBe(true);
  });

  it("the newer edit wins a conflict", () => {
    const local = snap({ notes: { a: "old" } }, { "notes:a": { t: 10 } });
    const remote = snap({ notes: { a: "new" } }, { "notes:a": { t: 20 } });
    const m = Sync.mergeSnapshots(local, remote, { now: 1000 });
    expect(m.data.notes.a).toBe("new");
    expect(m.localChanged).toBe(true);
    expect(m.remoteChanged).toBe(false);
  });

  it("a newer delete beats an older value, and the tombstone is kept", () => {
    const local = snap({ tags: {} }, { "tags:a": { t: 30, del: true } });
    const remote = snap({ tags: { a: ["x"] } }, { "tags:a": { t: 10 } });
    const m = Sync.mergeSnapshots(local, remote, { now: 1000 });
    expect(m.data.tags).toEqual({});
    expect(m.meta["tags:a"]).toEqual({ t: 30, del: true });
    expect(m.remoteChanged).toBe(true);
    expect(m.localChanged).toBe(false);
  });

  it("a newer value beats an older delete", () => {
    const local = snap({ tags: {} }, { "tags:a": { t: 10, del: true } });
    const remote = snap({ tags: { a: ["back"] } }, { "tags:a": { t: 20 } });
    const m = Sync.mergeSnapshots(local, remote, { now: 1000 });
    expect(m.data.tags.a).toEqual(["back"]);
    expect(m.meta["tags:a"]).toEqual({ t: 20 });
  });

  it("a side that has never seen a key does not delete it", () => {
    const fresh = snap({ tags: {} }, {});
    const library = snap({ tags: { a: ["x"] } }, { "tags:a": { t: 50 } });
    expect(Sync.mergeSnapshots(fresh, library, { now: 1000 }).data.tags).toEqual({ a: ["x"] });
    expect(Sync.mergeSnapshots(library, fresh, { now: 1000 }).data.tags).toEqual({ a: ["x"] });
  });

  it("values with no timestamp (pre-sync data) lose to anything stamped, and survive alone", () => {
    const local = snap({ notes: { a: "legacy" } }, {});
    const remote = snap({ notes: { a: "stamped" } }, { "notes:a": { t: 5 } });
    expect(Sync.mergeSnapshots(local, remote, { now: 1000 }).data.notes.a).toBe("stamped");
    expect(Sync.mergeSnapshots(local, snap(), { now: 1000 }).data.notes.a).toBe("legacy");
  });

  it("breaks a timestamp tie the same way regardless of argument order", () => {
    const a = snap({ notes: { x: "apple" } }, { "notes:x": { t: 10 } });
    const b = snap({ notes: { x: "banana" } }, { "notes:x": { t: 10 } });
    const ab = Sync.mergeSnapshots(a, b, { now: 1000 });
    const ba = Sync.mergeSnapshots(b, a, { now: 1000 });
    expect(ab.data.notes.x).toBe(ba.data.notes.x);
  });

  it("on a tie, a value beats a delete (never silently lose data)", () => {
    const a = snap({ notes: {} }, { "notes:x": { t: 10, del: true } });
    const b = snap({ notes: { x: "kept" } }, { "notes:x": { t: 10 } });
    expect(Sync.mergeSnapshots(a, b, { now: 1000 }).data.notes.x).toBe("kept");
    expect(Sync.mergeSnapshots(b, a, { now: 1000 }).data.notes.x).toBe("kept");
  });

  it("two tombstones keep the tombstone", () => {
    const a = snap({ notes: {} }, { "notes:x": { t: 10, del: true } });
    const b = snap({ notes: {} }, { "notes:x": { t: 10, del: true } });
    expect(Sync.mergeSnapshots(a, b, { now: 1000 }).meta["notes:x"]).toEqual({ t: 10, del: true });
  });

  it("drops tombstones older than 90 days", () => {
    const now = 200 * DAY;
    const old = snap({ tags: {} }, { "tags:gone": { t: now - 91 * DAY, del: true } });
    const fresh = snap({ tags: {} }, { "tags:recent": { t: now - 10 * DAY, del: true } });
    const m = Sync.mergeSnapshots(old, fresh, { now });
    expect(m.meta["tags:gone"]).toBeUndefined();
    expect(m.meta["tags:recent"]).toEqual({ t: now - 10 * DAY, del: true });
  });

  it("merges every record dataset, not just tags", () => {
    const local = snap({ purchaseLog: { a: { date: "2026-01-01" } }, gameStatus: { a: "playing" }, priceAlerts: { a: { threshold: 5 } }, tagColors: { rpg: "#fff" } }, {});
    const m = Sync.mergeSnapshots(local, snap(), { now: 1 });
    expect(m.data.purchaseLog.a.date).toBe("2026-01-01");
    expect(m.data.gameStatus.a).toBe("playing");
    expect(m.data.priceAlerts.a.threshold).toBe(5);
    expect(m.data.tagColors.rpg).toBe("#fff");
  });

  it("does not call identical content a change just because key order differs", () => {
    const a = snap({ purchaseLog: { x: { date: "d", price: 1 }, y: { date: "e" } } }, {});
    const b = snap({ purchaseLog: { y: { date: "e" }, x: { price: 1, date: "d" } } }, {});
    const m = Sync.mergeSnapshots(a, b, { now: 1 });
    expect(m.localChanged).toBe(false);
    expect(m.remoteChanged).toBe(false);
  });
});

describe("mergeSnapshots — whole-value, history, achievements", () => {
  it("tagOrder: the newer value wins as a unit; an empty never-edited list loses", () => {
    const local = snap({ tagOrder: ["a", "b"] }, { "tagOrder:_": { t: 5 } });
    const remote = snap({ tagOrder: ["b", "a"] }, { "tagOrder:_": { t: 9 } });
    expect(Sync.mergeSnapshots(local, remote, { now: 100 }).data.tagOrder).toEqual(["b", "a"]);

    expect(Sync.mergeSnapshots(snap({ tagOrder: [] }), local, { now: 100 }).data.tagOrder).toEqual(["a", "b"]);
    expect(Sync.mergeSnapshots(snap(), snap(), { now: 100 }).data.tagOrder).toEqual([]);
  });

  it("an explicitly emptied tagOrder (stamped) beats an older non-empty one", () => {
    const cleared = snap({ tagOrder: [] }, { "tagOrder:_": { t: 20 } });
    const old = snap({ tagOrder: ["a"] }, { "tagOrder:_": { t: 5 } });
    expect(Sync.mergeSnapshots(cleared, old, { now: 100 }).data.tagOrder).toEqual([]);
  });

  it("priceHistory is unioned, de-duplicated, sorted and capped to the newest entries", () => {
    const e = (d, p, c = "USD") => ({ d, p, c });
    const local = snap({ priceHistory: { a: [e("2026-01-01", 10), e("2026-01-03", 8)] } });
    const remote = snap({ priceHistory: { a: [e("2026-01-01", 10), e("2026-01-02", 9)], b: [e("2026-01-01", 1)] } });
    const m = Sync.mergeSnapshots(local, remote, { now: 1 });
    expect(m.data.priceHistory.a.map((x) => x.d)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
    expect(m.data.priceHistory.b).toHaveLength(1);

    const capped = Sync.mergeSnapshots(local, remote, { now: 1, historyMax: 2 });
    expect(capped.data.priceHistory.a.map((x) => x.d)).toEqual(["2026-01-02", "2026-01-03"]);
  });

  it("priceHistory skips malformed entries", () => {
    const m = Sync.mergeSnapshots(snap({ priceHistory: { a: [null, 5, { d: "2026-01-01", p: 1, c: "USD" }] } }), snap(), { now: 1 });
    expect(m.data.priceHistory.a).toHaveLength(1);
  });

  it("achievements are unioned and the earliest unlock wins", () => {
    const local = snap({ achievements: { first: "2026-03-01", only_local: "2026-02-01" } });
    const remote = snap({ achievements: { first: "2026-01-15", only_remote: "2026-04-01" } });
    expect(Sync.mergeSnapshots(local, remote, { now: 1 }).data.achievements).toEqual({
      first: "2026-01-15",
      only_local: "2026-02-01",
      only_remote: "2026-04-01",
    });
  });
});

describe("mergeSnapshots — convergence", () => {
  it("is idempotent: merging the result with either input changes nothing", () => {
    const local = snap({ tags: { a: ["x"] }, notes: { a: "n" } }, { "tags:a": { t: 5 }, "notes:a": { t: 6 } });
    const remote = snap({ tags: { a: ["y"], b: ["z"] } }, { "tags:a": { t: 9 }, "tags:b": { t: 2 } });
    const m1 = Sync.mergeSnapshots(local, remote, { now: 1000 });
    const merged = snap(m1.data, m1.meta);
    const m2 = Sync.mergeSnapshots(merged, remote, { now: 1000 });
    expect(m2.localChanged).toBe(false);
    expect(m2.data).toEqual(m1.data);
    expect(Sync.mergeSnapshots(local, merged, { now: 1000 }).remoteChanged).toBe(false);
  });

  it("two devices editing independently converge to identical state (simulated)", () => {
    // Small deterministic PRNG so a failure is reproducible.
    let seed = 12345;
    const rnd = (n) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    const slugs = ["a", "b", "c", "d"];

    for (let trial = 0; trial < 200; trial++) {
      const devices = [snap({ tags: {}, notes: {} }, {}), snap({ tags: {}, notes: {} }, {})];
      let clock = 1;
      const edit = (dev) => {
        const key = rnd(2) ? "tags" : "notes";
        const slug = slugs[rnd(slugs.length)];
        const before = dev.data[key];
        const after = { ...before };
        if (rnd(4) === 0) delete after[slug];
        else after[slug] = key === "tags" ? [`t${rnd(5)}`] : `n${rnd(5)}`;
        const meta = Sync.stampChanges(key, before, after, dev.meta, clock++);
        dev.data = { ...dev.data, [key]: after };
        if (meta) dev.meta = meta;
      };
      const syncPair = () => {
        const m = Sync.mergeSnapshots(devices[0], devices[1], { now: clock });
        for (const d of devices) {
          d.data = { ...d.data, ...m.data };
          d.meta = m.meta;
        }
      };

      for (let step = 0; step < 12; step++) {
        edit(devices[rnd(2)]);
        if (rnd(3) === 0) syncPair();
      }
      syncPair();
      expect(devices[0].data.tags).toEqual(devices[1].data.tags);
      expect(devices[0].data.notes).toEqual(devices[1].data.notes);
      expect(devices[0].meta).toEqual(devices[1].meta);
    }
  });
});

describe("snapshot files", () => {
  it("round-trips through toSnapshotFile / parseSnapshotFile", () => {
    const stored = { tags: { a: ["x"] }, notes: { a: "n" }, ignoredKey: 1 };
    const meta = { "tags:a": { t: 5 } };
    const file = Sync.toSnapshotFile(stored, meta, { now: 42, device: "laptop" });
    expect(file).toMatchObject({ format: "gog-enhancer-sync", schema: 1, exportedAt: 42, device: "laptop" });
    expect(file.data.ignoredKey).toBeUndefined();
    expect(file.data.tagOrder).toEqual([]);
    expect(file.data.priceHistory).toEqual({});

    const parsed = Sync.parseSnapshotFile(JSON.stringify(file));
    expect(parsed.data.tags).toEqual({ a: ["x"] });
    expect(parsed.meta).toEqual(meta);
  });

  it("rejects text that isn't a sync file, with a clear message", () => {
    expect(() => Sync.parseSnapshotFile("{not json")).toThrow(/valid JSON/);
    expect(() => Sync.parseSnapshotFile("{}")).toThrow(/doesn't look like/);
    expect(() => Sync.parseSnapshotFile(JSON.stringify({ format: "other", data: {} }))).toThrow(/doesn't look like/);
    expect(() => Sync.parseSnapshotFile("null")).toThrow(/doesn't look like/);
  });

  it("refuses a file written by a newer schema instead of misreading it", () => {
    const text = JSON.stringify({ format: "gog-enhancer-sync", schema: 99, data: {}, meta: {} });
    expect(() => Sync.parseSnapshotFile(text)).toThrow(/newer version/);
    expect(() => Sync.parseSnapshotFile(JSON.stringify({ format: "gog-enhancer-sync", data: {} }))).toThrow(/newer version/);
  });

  it("tolerates a missing or malformed meta block", () => {
    const text = JSON.stringify({ format: "gog-enhancer-sync", schema: 1, data: { tags: {} } });
    expect(Sync.parseSnapshotFile(text).meta).toEqual({});
  });
});
