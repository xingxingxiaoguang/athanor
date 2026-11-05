// A small PNG writer (RGBA, 8 bits per channel) on node:zlib, so the tools need no packages.

import { deflateSync, inflateSync } from "node:zlib";

const CRC = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c;
}
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4), body = Buffer.concat([Buffer.from(type, "ascii"), data]), crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Encode w x h RGBA bytes as a PNG buffer. */
export function encodePNG(w, h, rgba) {
  const stride = w * 4, raw = Buffer.alloc((stride + 1) * h);
  const src = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  for (let y = 0; y < h; y++) {
    const o = y * (stride + 1);
    raw[o] = 1; // Sub filter: pixel art has long runs, so differences compress well
    for (let x = 0; x < stride; x++) raw[o + 1 + x] = (src[y * stride + x] - (x >= 4 ? src[y * stride + x - 4] : 0)) & 255;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Read saved RGBA8 non-interlaced atlases without an external image package.
 * All five PNG filters are supported; palette/16-bit/interlaced assets are not. */
export function decodePNG(bytes) {
  const data = Buffer.from(bytes), signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!data.subarray(0, 8).equals(signature)) throw new Error("Invalid PNG signature");
  let width, height, ended = false; const chunks = [];
  for (let offset = 8; offset < data.length;) {
    if (offset + 12 > data.length) throw new Error("Truncated PNG chunk");
    const length = data.readUInt32BE(offset), end = offset + 12 + length;
    if (end > data.length) throw new Error("Truncated PNG payload");
    if (crc32(data.subarray(offset + 4, end - 4)) !== data.readUInt32BE(end - 4)) throw new Error("PNG checksum mismatch");
    const type = data.toString("ascii", offset + 4, offset + 8), payload = data.subarray(offset + 8, end - 4);
    if (type === "IHDR") {
      if (width !== undefined || length !== 13) throw new Error("Invalid PNG header");
      width = payload.readUInt32BE(0); height = payload.readUInt32BE(4);
      if (!width || !height || width * height > 32_000_000) throw new Error("PNG exceeds 32 million pixel decoding budget");
      if (payload[8] !== 8 || payload[9] !== 6 || payload[10] || payload[11] || payload[12]) throw new Error("Only RGBA8 non-interlaced saved atlases are supported");
    } else if (type === "IDAT") chunks.push(payload);
    else if (type === "IEND") { ended = true; break; }
    offset = end;
  }
  if (width === undefined || !ended || !chunks.length) throw new Error("Incomplete PNG");
  const stride = width * 4, size = (stride + 1) * height;
  const raw = inflateSync(Buffer.concat(chunks), { maxOutputLength: size });
  if (raw.length !== size) throw new Error("Unexpected PNG scanline size");
  const rgba = Buffer.alloc(width * height * 4);
  const paeth = (a, b, c) => { const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c); return da <= db && da <= dc ? a : db <= dc ? b : c; };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]; if (filter > 4) throw new Error("Unknown PNG filter");
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, a = x >= 4 ? rgba[i - 4] : 0, b = y ? rgba[i - stride] : 0, c = y && x >= 4 ? rgba[i - stride - 4] : 0;
      const predictor = filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : filter === 4 ? paeth(a, b, c) : 0;
      rgba[i] = (raw[y * (stride + 1) + 1 + x] + predictor) & 255;
    }
  }
  return { width, height, data: rgba };
}
