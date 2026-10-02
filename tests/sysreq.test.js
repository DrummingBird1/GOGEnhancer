import { describe, it, expect } from "vitest";

await import("../extension/lib/sysreq.js");

const { parseRamGB, parseRequirements, compareRam, summarize } = window.GOGPlusSysReq;

describe("parseRamGB", () => {
  it("reads the common label shapes", () => {
    expect(parseRamGB("Memory: 8 GB RAM")).toBe(8);
    expect(parseRamGB("RAM: 16GB")).toBe(16);
    expect(parseRamGB("8 GB RAM")).toBe(8);
    expect(parseRamGB("8GB of RAM")).toBe(8);
    expect(parseRamGB("Memory8 GB")).toBe(8); // adjacent elements, no whitespace
  });

  it("converts MB and handles comma decimals", () => {
    expect(parseRamGB("RAM: 4096 MB")).toBe(4);
    expect(parseRamGB("Memory: 512 MB")).toBe(0.5);
    expect(parseRamGB("Memory: 1,5 GB")).toBe(1.5);
  });

  it("does not mistake video memory for system RAM", () => {
    expect(parseRamGB("Video Memory: 2 GB")).toBeNull();
    expect(parseRamGB("VRAM: 4 GB")).toBeNull();
    expect(parseRamGB("Graphics memory 6 GB")).toBeNull();
    expect(parseRamGB("2 GB VRAM")).toBeNull();
  });

  it("picks the system RAM figure when both appear", () => {
    expect(parseRamGB("Memory: 8 GB RAM, Video Memory: 2 GB")).toBe(8);
  });

  it("rejects missing and implausible values", () => {
    expect(parseRamGB("Storage: 50 GB")).toBeNull();
    expect(parseRamGB("RAM: 0 GB")).toBeNull();
    expect(parseRamGB("RAM: 9999 GB")).toBeNull();
    expect(parseRamGB("")).toBeNull();
  });
});

describe("parseRequirements", () => {
  const page = `
    Some intro text. Recommended games you may like: Memory 99 GB (not a requirement)
    System requirements
    Minimum
    OS: Windows 10
    Memory: 4 GB RAM
    Video Memory: 1 GB
    Recommended
    OS: Windows 11
    Memory: 16 GB RAM
  `;

  it("reads both tiers, anchored on the System requirements heading", () => {
    // Text before the heading (the unrelated "Memory 99 GB") must be ignored.
    expect(parseRequirements(page)).toEqual({
      minimum: { ramGB: 4 },
      recommended: { ramGB: 16 },
    });
  });

  it("works when Recommended is listed before Minimum", () => {
    const flipped = `System requirements Recommended Memory: 16 GB RAM Minimum Memory: 4 GB RAM`;
    expect(parseRequirements(flipped)).toEqual({
      minimum: { ramGB: 4 },
      recommended: { ramGB: 16 },
    });
  });

  it("handles a page with only a minimum", () => {
    expect(parseRequirements("System requirements Minimum Memory: 2 GB RAM")).toEqual({
      minimum: { ramGB: 2 },
      recommended: null,
    });
  });

  it("handles a page with only a recommended tier", () => {
    expect(parseRequirements("System requirements Recommended Memory: 8 GB RAM")).toEqual({
      minimum: null,
      recommended: { ramGB: 8 },
    });
  });

  it("returns null without a heading, without tiers, or without any RAM figure", () => {
    expect(parseRequirements("Minimum Memory: 4 GB RAM")).toBeNull();
    expect(parseRequirements("System requirements Memory: 4 GB RAM")).toBeNull();
    expect(parseRequirements("System requirements Minimum OS: Windows 10")).toBeNull();
  });
});

describe("compareRam", () => {
  it("ok when the reported memory covers the requirement", () => {
    expect(compareRam(4, 8)).toBe("ok");
    expect(compareRam(8, 8)).toBe("ok");
    expect(compareRam(2, 4)).toBe("ok");
  });

  it("below when even the top of the rounding bucket falls short", () => {
    expect(compareRam(8, 2)).toBe("below"); // 2 means [2,4) — 8 is out of reach
    expect(compareRam(4, 2)).toBe("below");
  });

  it("maybe when the requirement sits inside the rounding bucket", () => {
    expect(compareRam(6, 4)).toBe("maybe"); // 4 means [4,8) — could be 6 or 7
    expect(compareRam(3, 2)).toBe("maybe");
  });

  it("unknown when the report is at or past the historical cap, and with missing data", () => {
    expect(compareRam(16, 8)).toBe("unknown");
    expect(compareRam(64, 32)).toBe("unknown"); // newer browsers report more, but the cap isn't documented
    expect(compareRam(16, null)).toBe("unknown");
    expect(compareRam(null, 8)).toBe("unknown");
    expect(compareRam(0, 8)).toBe("unknown");
    expect(compareRam(8, undefined)).toBe("unknown");
  });
});

describe("summarize", () => {
  it("emits one row per tier that has a RAM figure", () => {
    const rows = summarize({ minimum: { ramGB: 4 }, recommended: { ramGB: 16 } }, 8);
    expect(rows).toEqual([
      { label: "Minimum", requiredGB: 4, status: "ok" },
      { label: "Recommended", requiredGB: 16, status: "unknown" },
    ]);
  });

  it("skips tiers with no figure", () => {
    expect(summarize({ minimum: null, recommended: { ramGB: 8 } }, 8)).toEqual([
      { label: "Recommended", requiredGB: 8, status: "ok" },
    ]);
    expect(summarize({ minimum: null, recommended: null }, 8)).toEqual([]);
    expect(summarize({ minimum: { ramGB: null }, recommended: null }, 8)).toEqual([]);
  });
});
