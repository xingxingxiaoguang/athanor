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

/** Decode straight pixel bytes without color conversion. Saved RGBA8 atlases
 * plus common RGB/gray/gray-alpha/indexed pixel art, all five PNG filters.
 * 16-bit, Adam7 and APNG are explicitly unsupported. */
export function decodePNG(bytes) {
  const data = Buffer.from(bytes), signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!data.subarray(0, 8).equals(signature)) throw new Error("Invalid PNG signature");
  let width, height, depth, typeCode, ended = false, palette, transparency; const chunks = [];
  for (let offset = 8; offset < data.length;) {
    if (offset + 12 > data.length) throw new Error("Truncated PNG chunk");
    const length = data.readUInt32BE(offset), end = offset + 12 + length;
    if (end > data.length) throw new Error("Truncated PNG payload");
    if (crc32(data.subarray(offset + 4, end - 4)) !== data.readUInt32BE(end - 4)) throw new Error("PNG checksum mismatch");
    const type = data.toString("ascii", offset + 4, offset + 8), payload = data.subarray(offset + 8, end - 4);
    if(offset===8&&type!=='IHDR')throw new Error('PNG must start with IHDR');
    if (type === "IHDR") {
      if (width !== undefined || length !== 13) throw new Error("Invalid PNG header");
      width = payload.readUInt32BE(0); height = payload.readUInt32BE(4);
      if (!width || !height || width * height > 64_000_000) throw new Error("PNG exceeds 64 million pixel decoding budget");
      depth=payload[8];typeCode=payload[9];
      const supported=(typeCode===0||typeCode===3)?[1,2,4,8].includes(depth):[2,4,6].includes(typeCode)&&depth===8;
      if(!supported||payload[10]||payload[11]||payload[12])throw new Error('Unsupported PNG encoding: use non-interlaced RGBA8/RGB8/gray8/gray-alpha8 or 1/2/4/8-bit gray/indexed PNG; 16-bit and Adam7 are unsupported');
    } else if(type==='PLTE'){
      if(palette||!length||length%3||length>768||chunks.length)throw new Error('Invalid PNG palette');palette=payload;
    } else if(type==='tRNS'){
      if(transparency||chunks.length)throw new Error('Invalid PNG transparency');transparency=payload;
    } else if(['acTL','fcTL','fdAT'].includes(type))throw new Error('APNG is unsupported; supply a declared PNG frame sequence');
    else if (type === "IDAT") chunks.push(payload);
    else if (type === "IEND") { ended = true; break; }
    offset = end;
  }
  if (width === undefined || !ended || !chunks.length) throw new Error("Incomplete PNG");
  if(typeCode===3&&(!palette||palette.length/3>2**depth))throw new Error('Indexed PNG requires a valid PLTE');
  if(transparency&&((typeCode===0&&transparency.length!==2)||(typeCode===2&&transparency.length!==6)||(typeCode===3&&transparency.length>palette.length/3)||[4,6].includes(typeCode)))throw new Error('Invalid PNG tRNS for its color type');
  const channels=({0:1,2:3,3:1,4:2,6:4})[typeCode],stride=Math.ceil(width*channels*depth/8),bpp=Math.max(1,Math.ceil(channels*depth/8)),size=(stride+1)*height;
  const raw = inflateSync(Buffer.concat(chunks), { maxOutputLength: size });
  if (raw.length !== size) throw new Error("Unexpected PNG scanline size");
  const pixels = Buffer.alloc(stride*height);
  const paeth = (a, b, c) => { const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c); return da <= db && da <= dc ? a : db <= dc ? b : c; };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]; if (filter > 4) throw new Error("Unknown PNG filter");
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, a = x >= bpp ? pixels[i - bpp] : 0, b = y ? pixels[i - stride] : 0, c = y && x >= bpp ? pixels[i - stride - bpp] : 0;
      const predictor = filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : filter === 4 ? paeth(a, b, c) : 0;
      pixels[i] = (raw[y * (stride + 1) + 1 + x] + predictor) & 255;
    }
  }
  if(typeCode===6)return {width,height,data:pixels};
  const rgba=Buffer.alloc(width*height*4),maximum=2**depth-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*stride+x*channels,o=(y*width+x)*4;
    if(typeCode===2){rgba[o]=pixels[i];rgba[o+1]=pixels[i+1];rgba[o+2]=pixels[i+2];rgba[o+3]=transparency&&[0,1,2].every(k=>pixels[i+k]===transparency.readUInt16BE(k*2))?0:255;}
    else if(typeCode===4){rgba[o]=rgba[o+1]=rgba[o+2]=pixels[i];rgba[o+3]=pixels[i+1];}
    else{
      const bit=x*depth,n=depth===8?pixels[y*stride+x]:(pixels[y*stride+(bit>>3)]>>(8-depth-(bit&7)))&maximum;
      if(typeCode===3){if(n*3>=palette.length)throw new Error('PNG palette index is out of range');rgba[o]=palette[n*3];rgba[o+1]=palette[n*3+1];rgba[o+2]=palette[n*3+2];rgba[o+3]=transparency?.[n]??255;}
      else {rgba[o]=rgba[o+1]=rgba[o+2]=Math.round(n*255/maximum);rgba[o+3]=transparency&&n===transparency.readUInt16BE(0)?0:255;}
    }
  }
  return { width, height, data: rgba };
}
