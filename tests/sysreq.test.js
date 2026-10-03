import { describe, it, expect } from "vitest";

await import("../extension/lib/sysreq.js");

const { parseRamGB, parseRequirements, fromTable, compareRam, summarize } = window.GOGPlusSysReq;

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

describe("parseRamGB — label and value on separate lines (the site's table)", () => {
  it("reads a value that sits on the next line after its label", () => {
    expect(parseRamGB("Memory:\n4 GB RAM")).toBe(4);
    expect(parseRamGB("Memory:\n8 GB")).toBe(8);
  });

  it("still won't let video memory on a later line leak in", () => {
    expect(parseRamGB("Video Memory:\n2 GB")).toBeNull();
  });
});

describe("fromTable", () => {
  it("takes the memory row from each tier", () => {
    expect(
      fromTable({
        minimum: { "System:": "Windows 7", "Memory:": "4 GB RAM", "Graphics:": "1024 MB" },
        recommended: { "Memory:": "8 GB RAM" },
      })
    ).toEqual({ minimum: { ramGB: 4 }, recommended: { ramGB: 8 } });
  });

  it("accepts a RAM label and a bare value", () => {
    expect(fromTable({ minimum: { "RAM:": "2 GB" }, recommended: {} })).toEqual({
      minimum: { ramGB: 2 },
      recommended: null,
    });
  });

  it("ignores graphics/video memory rows and non-memory labels", () => {
    expect(
      fromTable({ minimum: { "Graphics:": "2 GB", "Video memory:": "2 GB", "Storage:": "50 GB" }, recommended: {} })
    ).toBeNull();
  });

  it("is null when neither tier has a usable memory row", () => {
    expect(fromTable({ minimum: {}, recommended: {} })).toBeNull();
    expect(fromTable({ minimum: { "Memory:": "plenty" }, recommended: {} })).toBeNull();
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

describe("parseStorageGB / compareProfile", () => {
  const SR = window.GOGPlusSysReq;
  it("reads disk space in GB, MB and TB", () => {
    expect(SR.parseStorageGB("50 GB available space")).toBe(50);
    expect(SR.parseStorageGB("512MB")).toBe(0.5);
    expect(SR.parseStorageGB("1,5 TB")).toBe(1536);
    expect(SR.parseStorageGB("lots")).toBeNull();
  });

  const table = {
    minimum: { "OS:": "Windows 10", "Processor:": "Intel i5", "Memory:": "8 GB RAM", "Graphics:": "GTX 660", "Storage:": "50 GB available space" },
    recommended: { "Memory:": "16 GB RAM", "Storage:": "100 GB available space" },
  };
  it("compares memory and disk exactly and lists the rest beside the user's own words", () => {
    const rows = SR.compareProfile(table, { ramGB: 16, storageGB: 60, os: "Windows 11", cpu: "Ryzen 5", gpu: "RTX 3060" });
    expect(rows.find((r) => r.tier === "Minimum" && r.item === "RAM")).toMatchObject({ status: "ok", required: "8 GB", yours: "16 GB" });
    expect(rows.find((r) => r.tier === "Recommended" && r.item === "RAM")).toMatchObject({ status: "ok" });
    expect(rows.find((r) => r.tier === "Minimum" && r.item === "Storage")).toMatchObject({ status: "ok", yours: "60 GB free" });
    expect(rows.find((r) => r.tier === "Recommended" && r.item === "Storage")).toMatchObject({ status: "below" });
    expect(rows.find((r) => r.item === "GPU")).toMatchObject({ status: "info", required: "GTX 660", yours: "RTX 3060" });
    expect(rows.find((r) => r.item === "CPU")).toMatchObject({ status: "info", yours: "Ryzen 5" });
    expect(rows.find((r) => r.item === "OS")).toMatchObject({ status: "info", yours: "Windows 11" });
  });
  it("flags too little memory and skips what the user left blank", () => {
    const rows = SR.compareProfile(table, { ramGB: 4, storageGB: 0, os: "", cpu: "", gpu: "" });
    expect(rows).toEqual([expect.objectContaining({ tier: "Minimum", item: "RAM", status: "below" }), expect.objectContaining({ tier: "Recommended", item: "RAM", status: "below" })]);
  });
  it("returns nothing without a profile", () => {
    expect(SR.compareProfile(table, null)).toEqual([]);
  });
});
