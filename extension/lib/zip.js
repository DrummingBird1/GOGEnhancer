/**
 * GOG+ minimal ZIP writer — "store" method only (no compression), enough to
 * hand the user a folder of Markdown files as one download without bundling a
 * library. Names and text are UTF-8 (general-purpose flag bit 11), so Hebrew
 * and accented titles survive. Pure; returns bytes.
 *
 * Not a general-purpose zip library: no directories entries, no zip64 (files
 * and archive must stay under 4 GiB, which a notes vault never approaches).
 */
// @ts-check

(() => {
  "use strict";

  /** @type {Uint32Array | null} */
  let table = null;

  function crcTable() {
    if (table) return table;
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  }

  /** @param {Uint8Array} bytes @returns {number} unsigned CRC-32 */
  function crc32(bytes) {
    const t = crcTable();
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  /** MS-DOS date/time words for a Date (the zip format's only timestamp). */
  /** @param {Date} d */
  function dosDateTime(d) {
    const year = Math.max(1980, d.getFullYear());
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time, date };
  }

  /**
   * @param {Array<{ path: string, content: string | Uint8Array }>} files
   * @param {{ now?: Date }} [opts]
   * @returns {Uint8Array}
   */
  function buildZip(files, opts = {}) {
    const enc = new TextEncoder();
    const { time, date } = dosDateTime(opts.now || new Date());
    /** @type {Uint8Array[]} */
    const chunks = [];
    /** @type {Uint8Array[]} */
    const central = [];
    let offset = 0;

    for (const f of files) {
      const name = enc.encode(f.path.replace(/\\/g, "/").replace(/^\/+/, ""));
      const data = typeof f.content === "string" ? enc.encode(f.content) : f.content;
      const crc = crc32(data);

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true); // version needed
      local.setUint16(6, 0x0800, true); // UTF-8 names
      local.setUint16(8, 0, true); // stored
      local.setUint16(10, time, true);
      local.setUint16(12, date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);
      chunks.push(new Uint8Array(local.buffer), name, data);

      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true);
      cen.setUint16(4, 20, true); // version made by
      cen.setUint16(6, 20, true);
      cen.setUint16(8, 0x0800, true);
      cen.setUint16(10, 0, true);
      cen.setUint16(12, time, true);
      cen.setUint16(14, date, true);
      cen.setUint32(16, crc, true);
      cen.setUint32(20, data.length, true);
      cen.setUint32(24, data.length, true);
      cen.setUint16(28, name.length, true);
      cen.setUint32(42, offset, true);
      central.push(new Uint8Array(cen.buffer), name);

      offset += 30 + name.length + data.length;
    }

    const centralSize = central.reduce((n, c) => n + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);

    const all = [...chunks, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((n, c) => n + c.length, 0));
    let pos = 0;
    for (const c of all) {
      out.set(c, pos);
      pos += c.length;
    }
    return out;
  }

  const api = { crc32, buildZip };
  if (typeof window !== "undefined") window.GOGPlusZip = api;
  if (typeof self !== "undefined") self.GOGPlusZip = api;
})();
