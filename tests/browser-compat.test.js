import { describe, it, expect, afterEach, vi } from "vitest";

describe("lib/browser-compat.js", () => {
  const originalChrome = globalThis.chrome;

  afterEach(() => {
    globalThis.chrome = originalChrome;
    delete globalThis.browser;
  });

  it("leaves an existing chrome namespace untouched (the normal Chrome/Chromium case)", async () => {
    vi.resetModules();
    const sentinel = { ...originalChrome, __sentinel: true };
    globalThis.chrome = sentinel;
    await import("../extension/lib/browser-compat.js");
    expect(globalThis.chrome).toBe(sentinel);
  });

  it("aliases chrome to browser when only browser is present (Firefox-style)", async () => {
    vi.resetModules();
    delete globalThis.chrome;
    const fakeBrowser = { runtime: { id: "firefox-fake" } };
    globalThis.browser = fakeBrowser;
    await import("../extension/lib/browser-compat.js");
    expect(globalThis.chrome).toBe(fakeBrowser);
  });

  it("leaves chrome undefined when neither chrome nor browser is present", async () => {
    vi.resetModules();
    delete globalThis.chrome;
    delete globalThis.browser;
    await import("../extension/lib/browser-compat.js");
    expect(globalThis.chrome).toBeUndefined();
  });
});
