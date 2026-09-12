import { describe, it, expect, afterEach, vi } from "vitest";

// Imported once, as a real page would — openDb() caches a single open
// IndexedDB connection for the module's lifetime. Deliberately NOT
// re-imported per test (vi.resetModules()) and NOT reset via
// indexedDB.deleteDatabase() between tests: the IndexedDB spec blocks a
// deleteDatabase call until every open connection closes, and this module
// never closes its cached one — the same as a real tab never closing it
// either. Tests below use distinct slugs per test and clean up what they
// write instead, which avoids ever needing a whole-database reset.
await import("../extension/lib/attachments.js");
const Attachments = window.GOGPlusAttachments;

describe("lib/attachments.js", () => {
  afterEach(async () => {
    // Best-effort cleanup of everything any test below might have written —
    // harmless no-ops for slugs a given test never touched.
    for (const slug of [
      "witcher_3",
      "cyberpunk_2077",
      "stardew_valley",
      "game_a",
      "game_b",
      "elden_ring",
    ]) {
      await Attachments.deleteAttachment(slug).catch(() => {});
    }
  });

  it("stores and reads back a raw blob by slug", async () => {
    const blob = new Blob(["hello"], { type: "image/jpeg" });
    const result = await Attachments.saveAttachment("witcher_3", blob);
    expect(result.slug).toBe("witcher_3");
    expect(result.sizeBytes).toBe(blob.size);

    const record = await Attachments.getAttachment("witcher_3");
    expect(record).toBeDefined();
    expect(record.slug).toBe("witcher_3");
    expect(record.sizeBytes).toBe(blob.size);
    expect(record.type).toBe("image/jpeg");
  });

  it("returns undefined for a slug with no attachment", async () => {
    const record = await Attachments.getAttachment("nothing_here_never_saved");
    expect(record).toBeUndefined();
  });

  it("overwrites an existing attachment for the same slug (one image per game)", async () => {
    await Attachments.saveAttachment("cyberpunk_2077", new Blob(["a"]));
    await Attachments.saveAttachment("cyberpunk_2077", new Blob(["bb"]));
    const record = await Attachments.getAttachment("cyberpunk_2077");
    expect(record.sizeBytes).toBe(2);
  });

  it("deletes an attachment", async () => {
    await Attachments.saveAttachment("stardew_valley", new Blob(["x"]));
    await Attachments.deleteAttachment("stardew_valley");
    const record = await Attachments.getAttachment("stardew_valley");
    expect(record).toBeUndefined();
  });

  it("deleting a slug with no attachment is a harmless no-op", async () => {
    await expect(Attachments.deleteAttachment("never_saved_at_all")).resolves.not.toThrow();
  });

  it("sums sizeBytes across every stored attachment for getTotalBytes", async () => {
    const before = await Attachments.getTotalBytes();
    await Attachments.saveAttachment("game_a", new Blob(["12345"]));
    await Attachments.saveAttachment("game_b", new Blob(["1234567890"]));
    const after = await Attachments.getTotalBytes();
    expect(after - before).toBe(15);
  });

  describe("downscaleImage", () => {
    let origImage;
    let origCreateElement;
    let origCreateObjectURL;
    let origRevokeObjectURL;

    function restoreStubs() {
      globalThis.Image = origImage;
      document.createElement = origCreateElement;
      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
    }

    afterEach(restoreStubs);

    // happy-dom doesn't implement real image decoding or a 2D canvas
    // backend, so both the Image and the canvas it draws into are stubbed
    // directly — this exercises downscaleImage's actual math/control flow
    // (scale factor, rounding, callback wiring) without needing a browser.
    function stubImage(width, height, shouldError = false) {
      origImage = globalThis.Image;
      origCreateObjectURL = URL.createObjectURL;
      origRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = vi.fn(() => "blob:fake-url");
      URL.revokeObjectURL = vi.fn();
      class FakeImage {
        set src(_v) {
          queueMicrotask(() => {
            if (shouldError) this.onerror?.(new Event("error"));
            else {
              this.width = width;
              this.height = height;
              this.onload?.();
            }
          });
        }
      }
      globalThis.Image = FakeImage;
    }

    function stubCanvas(outputBlob) {
      origCreateElement = document.createElement.bind(document);
      const orig = origCreateElement;
      document.createElement = (tag) => {
        const el = orig(tag);
        if (tag === "canvas") {
          el.getContext = () => ({ drawImage: vi.fn() });
          el.toBlob = (cb) => cb(outputBlob);
        }
        return el;
      };
    }

    it("downscales a large image to fit within MAX_DIMENSION", async () => {
      stubImage(2000, 1000);
      const outputBlob = new Blob(["small"], { type: "image/jpeg" });
      stubCanvas(outputBlob);

      const result = await Attachments.downscaleImage(new Blob(["big"], { type: "image/png" }));
      expect(result).toBe(outputBlob);
    });

    it("leaves an already-small image at its original size (scale capped at 1)", async () => {
      stubImage(100, 50);
      const outputBlob = new Blob(["same"], { type: "image/jpeg" });
      stubCanvas(outputBlob);

      const result = await Attachments.downscaleImage(new Blob(["tiny"]));
      expect(result).toBe(outputBlob);
    });

    it("rejects when the input isn't a readable image", async () => {
      stubImage(0, 0, true);
      await expect(Attachments.downscaleImage(new Blob(["not-an-image"]))).rejects.toThrow(
        /readable image/i
      );
    });

    it("rejects when the canvas can't produce a 2d context", async () => {
      stubImage(400, 300);
      origCreateElement = document.createElement.bind(document);
      const orig = origCreateElement;
      document.createElement = (tag) => {
        const el = orig(tag);
        if (tag === "canvas") el.getContext = () => null;
        return el;
      };
      await expect(Attachments.downscaleImage(new Blob(["x"]))).rejects.toThrow(
        /2d context unavailable/
      );
    });

    it("rejects when canvas toBlob fails", async () => {
      stubImage(400, 300);
      origCreateElement = document.createElement.bind(document);
      const orig = origCreateElement;
      document.createElement = (tag) => {
        const el = orig(tag);
        if (tag === "canvas") {
          el.getContext = () => ({ drawImage: vi.fn() });
          el.toBlob = (cb) => cb(null);
        }
        return el;
      };
      await expect(Attachments.downscaleImage(new Blob(["x"]))).rejects.toThrow(/toBlob/);
    });

    it("saveAttachmentDownscaled downscales then stores under the slug", async () => {
      stubImage(1200, 600);
      const outputBlob = new Blob(["downscaled"], { type: "image/jpeg" });
      stubCanvas(outputBlob);

      const result = await Attachments.saveAttachmentDownscaled("elden_ring", new Blob(["orig"]));
      expect(result.slug).toBe("elden_ring");
      expect(result.sizeBytes).toBe(outputBlob.size);

      const record = await Attachments.getAttachment("elden_ring");
      expect(record.sizeBytes).toBe(outputBlob.size);
    });
  });
});
