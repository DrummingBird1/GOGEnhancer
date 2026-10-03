import { describe, it, expect, beforeEach, vi } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/net.js");

const Net = () => window.GOGPlusNet;
const getLog = async () => (await window.GOGPlusStorage.get({ netLog: [] })).netLog;
const flush = async () => {
  await Net().record({ kind: "flush", host: "", path: "", status: null, ok: true });
  await getLog();
};

beforeEach(() => {
  globalThis.__resetChromeStores();
  globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ hello: "world" }) }));
});

describe("allowed / describe", () => {
  it("allows only https on the declared hosts", () => {
    expect(Net().allowed("https://catalog.gog.com/v1/catalog?limit=1")).toBe(true);
    expect(Net().allowed("https://api.gog.com/v2/games/1")).toBe(true);
    expect(Net().allowed("https://www.cheapshark.com/api/1.0/deals")).toBe(true);
    expect(Net().allowed("http://catalog.gog.com/v1/catalog")).toBe(false);
    expect(Net().allowed("https://evil.example/v1/catalog")).toBe(false);
    expect(Net().allowed("https://catalog.gog.com.evil.example/x")).toBe(false);
    expect(Net().allowed("not a url")).toBe(false);
  });

  it("describes a URL as host + path with no query", () => {
    expect(Net().describe("https://www.cheapshark.com/api/1.0/deals?title=Secret+Game")).toEqual({
      host: "www.cheapshark.com",
      path: "/api/1.0/deals",
    });
    expect(Net().describe("nope")).toEqual({ host: "", path: "" });
  });
});

describe("request", () => {
  it("sends no cookies and no referrer, and logs host + path without the query", async () => {
    const res = await Net().request("compare", "https://www.cheapshark.com/api/1.0/deals?title=Secret+Game");
    expect(res.ok).toBe(true);
    const init = globalThis.fetch.mock.calls[0][1];
    expect(init.credentials).toBe("omit");
    expect(init.referrerPolicy).toBe("no-referrer");
    await flush();
    const log = await getLog();
    expect(log[0]).toMatchObject({ kind: "compare", host: "www.cheapshark.com", path: "/api/1.0/deals", status: 200, ok: true });
    expect(JSON.stringify(log)).not.toContain("Secret");
  });

  it("refuses a destination that isn't on the list — and never calls fetch", async () => {
    await expect(Net().request("x", "https://tracker.example/pixel")).rejects.toThrow(/not an allowed destination/);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    await flush();
    const log = await getLog();
    expect(log[0]).toMatchObject({ host: "tracker.example", ok: false });
    expect(log[0].error).toContain("blocked");
  });

  it("logs a failed request and rethrows", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(Net().request("fx", "https://api.frankfurter.app/latest")).rejects.toThrow("Failed to fetch");
    await flush();
    const log = await getLog();
    expect(log[0]).toMatchObject({ kind: "fx", ok: false, status: null });
    expect(log[0].error).toContain("Failed to fetch");
  });
});

describe("getJson", () => {
  it("returns the parsed body", async () => {
    expect(await Net().getJson("catalog", "https://catalog.gog.com/v1/catalog?limit=1")).toEqual({ hello: "world" });
  });

  it("returns null on HTTP errors, bad JSON, blocked hosts and network failures", async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    expect(await Net().getJson("catalog", "https://catalog.gog.com/v1/catalog")).toBeNull();
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => { throw new Error("bad"); } }));
    expect(await Net().getJson("catalog", "https://catalog.gog.com/v1/catalog")).toBeNull();
    expect(await Net().getJson("x", "https://evil.example/")).toBeNull();
    globalThis.fetch = vi.fn(async () => { throw new Error("offline"); });
    expect(await Net().getJson("catalog", "https://catalog.gog.com/v1/catalog")).toBeNull();
  });
});

describe("the log", () => {
  it("is capped at LOG_MAX entries, newest kept", async () => {
    for (let i = 0; i < Net().LOG_MAX + 15; i++) {
      await Net().record({ kind: "fx", host: "api.frankfurter.app", path: `/${i}`, status: 200, ok: true });
    }
    const log = await getLog();
    expect(log).toHaveLength(Net().LOG_MAX);
    expect(log[log.length - 1].path).toBe(`/${Net().LOG_MAX + 14}`);
  });

  it("records a webhook by host only — the path of a webhook is a secret token", async () => {
    await Net().recordWebhook("discord.com", 204, true);
    const log = await getLog();
    expect(log[0]).toMatchObject({ kind: "webhook", host: "discord.com", path: "", status: 204 });
  });

  it("summarizes per host: count, failures, last seen", () => {
    const rows = Net().summarize([
      { t: 1, kind: "fx", host: "api.frankfurter.app", ok: true },
      { t: 5, kind: "fx", host: "api.frankfurter.app", ok: false },
      { t: 3, kind: "catalog", host: "catalog.gog.com", ok: true },
    ]);
    expect(rows[0]).toMatchObject({ host: "api.frankfurter.app", count: 2, failed: 1, last: 5 });
    expect(rows[1]).toMatchObject({ host: "catalog.gog.com", count: 1, failed: 0 });
    expect(Net().summarize(undefined)).toEqual([]);
  });
});
