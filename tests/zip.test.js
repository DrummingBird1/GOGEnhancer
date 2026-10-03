import { describe, it, expect } from "vitest";

await import("../extension/lib/zip.js");

const Z = window.GOGPlusZip;
const dv = (u8) => new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

describe("crc32", () => {
  it("matches the standard check values", () => {
    expect(Z.crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(Z.crc32(new Uint8Array())).toBe(0);
    expect(Z.crc32(new TextEncoder().encode("a"))).toBe(0xe8b7be43);
  });
});

describe("buildZip", () => {
  const files = [
    { path: "GOG/a.md", content: "hello" },
    { path: "/GOG\\עברית.md", content: new Uint8Array([1, 2, 3]) },
  ];
  const zip = Z.buildZip(files, { now: new Date(2026, 9, 2, 12, 30, 20) });
  const view = dv(zip);

  it("starts with a local header and ends with an end-of-central-directory record", () => {
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 8, true)).toBe(2); // entries on this disk
    expect(view.getUint16(end + 10, true)).toBe(2); // total entries
  });

  it("stores each file's bytes verbatim, with its CRC and UTF-8 flag", () => {
    const nameLen = view.getUint16(26, true);
    expect(view.getUint16(6, true) & 0x0800).toBe(0x0800);
    expect(new TextDecoder().decode(zip.slice(30, 30 + nameLen))).toBe("GOG/a.md");
    expect(new TextDecoder().decode(zip.slice(30 + nameLen, 30 + nameLen + 5))).toBe("hello");
    expect(view.getUint32(14, true)).toBe(Z.crc32(new TextEncoder().encode("hello")));
    expect(view.getUint32(18, true)).toBe(5);
    expect(view.getUint32(22, true)).toBe(5);
  });

  it("normalises separators and leading slashes, and encodes non-ASCII names", () => {
    const text = new TextDecoder().decode(zip);
    expect(text).toContain("GOG/עברית.md");
    expect(text).not.toContain("/GOG\\");
  });

  it("points the central directory at the right offsets", () => {
    const end = zip.length - 22;
    const centralOffset = view.getUint32(end + 16, true);
    expect(view.getUint32(centralOffset, true)).toBe(0x02014b50);
    const firstLocal = view.getUint32(centralOffset + 42, true);
    expect(firstLocal).toBe(0);
    // second entry: header offset = 30 + name + data of the first file
    const nameLen1 = view.getUint16(centralOffset + 28, true);
    const second = centralOffset + 46 + nameLen1;
    expect(view.getUint32(second + 42, true)).toBe(30 + 8 + 5);
  });

  it("encodes the timestamp as DOS date/time", () => {
    expect(view.getUint16(10, true)).toBe((12 << 11) | (30 << 5) | 10);
    expect(view.getUint16(12, true)).toBe(((2026 - 1980) << 9) | (10 << 5) | 2);
  });

  it("builds an empty archive and uses the clock by default", () => {
    const empty = Z.buildZip([]);
    expect(empty.length).toBe(22);
    expect(dv(empty).getUint32(0, true)).toBe(0x06054b50);
    expect(Z.buildZip([{ path: "x", content: "y" }]).length).toBeGreaterThan(22);
  });
});
