// Pixel-center inverse sampling generalizes Painter.sprite and the library's
// rotated/squeezed sprites. Pixels, pivot and lifecycle clock stay independent.
import { identity, count, point, finite, positive, choice, color, alpha, fail } from './contract.js';

export function rgba({ id, w, h, data, pivot = [w / 2, h / 2] }) {
  identity(id, 'texture.id'); count(w, 'texture.w', 480); count(h, 'texture.h', 480);
  if (!w || !h) fail('texture.size', 'dimensions must be positive');
  point(pivot, 'texture.pivot');
  if (!data || data.length !== w * h * 4) fail('texture.data', 'expected straight RGBA bytes, exactly w*h*4');
  for (const v of data) if (!Number.isInteger(v) || v < 0 || v > 255) fail('texture.data', 'expected bytes in 0..255');
  return { kind: 'Texture', id, w, h, pivot: [...pivot], data: new Uint8Array(data) };
}

export function ascii({ id, rows, palette, pivot }) {
  if (!Array.isArray(rows) || !rows.length || !rows.every((r) => typeof r === 'string' && /^[\x20-\x7e]*$/.test(r) && r.length === rows[0].length)) fail('texture.rows', 'expected nonempty equal-width ASCII strings');
  const w = rows[0].length, h = rows.length, data = new Uint8Array(w * h * 4);
  count(w, 'texture.w', 480); count(h, 'texture.h', 480);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.' || ch === ' ') return;
    const c = color(palette?.[ch], `texture.palette.${ch}`), i = (y * w + x) * 4;
    data.set([c & 255, (c >>> 8) & 255, (c >>> 16) & 255, c >>> 24], i);
  }));
  return rgba({ id, w, h, data, pivot });
}

export function sheet({ id, image, frameSize, pivots }) {
  identity(id, 'texture.sheet.id'); check(image); point(frameSize, 'texture.sheet.frameSize');
  const [w, h] = frameSize;
  if (![w, h].every((v) => Number.isInteger(v) && v > 0) || image.w % w || image.h % h) fail('texture.sheet.frameSize', 'positive integer frame dimensions must divide the atlas exactly');
  const n = image.w / w * (image.h / h); count(n, 'texture.sheet.frames', 1024);
  if (pivots && pivots.length !== n) fail('texture.sheet.pivots', 'one pivot per frame is required');
  return Array.from({ length: n }, (_, index) => {
    const x = index % (image.w / w) * w, y = Math.floor(index / (image.w / w)) * h, data = new Uint8Array(w * h * 4);
    for (let row = 0; row < h; row++) data.set(image.data.subarray(((y + row) * image.w + x) * 4, ((y + row) * image.w + x + w) * 4), row * w * 4);
    return rgba({ id: `${id}/${index}`, w, h, data, pivot: pivots?.[index] });
  });
}

function check(value) {
  if (value?.kind !== 'Texture' || !value.data || value.data.length !== value.w * value.h * 4) fail('texture', 'expected a Texture from rgba/ascii/sheet');
  return value;
}

export function sequence({ id, frames, mode = 'lifetime', fps = 12, loop = false }) {
  identity(id, 'texture.sequence.id'); choice(mode, ['lifetime', 'fps'], 'texture.sequence.mode'); positive(fps, 'texture.sequence.fps');
  if (typeof loop !== 'boolean') fail('texture.sequence.loop', 'expected boolean');
  if (!Array.isArray(frames) || !frames.length) fail('texture.sequence.frames', 'expected at least one frame');
  count(frames.length, 'texture.sequence.frames', 1024); frames.forEach(check);
  return { kind: 'TextureSequence', id, frames: [...frames], mode, fps, loop };
}

export function frame(resource, { age = 0, age01 = 0, frameOffset = 0 } = {}) {
  positive(age, 'texture.frame.age', true); alpha(age01, 'texture.frame.age01');
  if (!Number.isInteger(frameOffset)) fail('texture.frame.frameOffset', 'offset is an integer number of frames');
  if (resource?.kind !== 'TextureSequence') return { index: 0, texture: check(resource) };
  const n = resource.frames.length;
  const raw = (resource.mode === 'lifetime' ? Math.min(n - 1, Math.floor(age01 * n)) : Math.floor(age * resource.fps + 1e-9)) + frameOffset;
  const index = resource.loop ? ((raw % n) + n) % n : Math.max(0, Math.min(n - 1, raw));
  return { index, texture: resource.frames[index] };
}

export function draw(p, resource, { position = [0, 0], scale = 1, rotation = 0, opacity = 1, tint = '#fff', tintMode = 'multiply', blend = 'dither', age = 0, age01 = 0, frameOffset = 0 } = {}) {
  point(position, 'texture.draw.position'); finite(rotation, 'texture.draw.rotation'); alpha(opacity, 'texture.draw.opacity');
  choice(tintMode, ['multiply', 'replace'], 'texture.draw.tintMode'); choice(blend, ['dither', 'soft', 'additive'], 'texture.draw.blend');
  const c = color(tint, 'texture.draw.tint'), [sx, sy] = typeof scale === 'number' ? [scale, scale] : point(scale, 'texture.draw.scale');
  finite(sx, 'texture.draw.scaleX'); finite(sy, 'texture.draw.scaleY');
  const selected = frame(resource, { age, age01, frameOffset }), tex = selected.texture;
  if (!sx || !sy || !opacity) return selected;
  const cs = Math.cos(rotation), sn = Math.sin(rotation), [px, py] = tex.pivot;
  const corners = [[0, 0], [tex.w, 0], [0, tex.h], [tex.w, tex.h]].map(([u, v]) => {
    const x = (u - px) * sx, y = (v - py) * sy;
    return [position[0] + x * cs - y * sn, position[1] + x * sn + y * cs];
  });
  p.each(Math.min(...corners.map((q) => q[0])), Math.min(...corners.map((q) => q[1])), Math.max(...corners.map((q) => q[0])), Math.max(...corners.map((q) => q[1])), (x, y, screenX, screenY) => {
    const dx = x - position[0], dy = y - position[1], u = Math.floor((dx * cs + dy * sn) / sx + px + 1e-10), v = Math.floor((-dx * sn + dy * cs) / sy + py + 1e-10);
    if (u < 0 || v < 0 || u >= tex.w || v >= tex.h) return;
    const i = (v * tex.w + u) * 4, a = tex.data[i + 3] / 255 * opacity * (c >>> 24) / 255;
    if (!a) return;
    const channels = [0, 8, 16].map((shift, j) => tintMode === 'replace' ? (c >>> shift) & 255 : Math.round(tex.data[i + j] * ((c >>> shift) & 255) / 255));
    const ink = (255 << 24) | channels[0] | (channels[1] << 8) | (channels[2] << 16);
    if (blend === 'soft') p.blendPx(screenX, screenY, ink, a);
    else if (blend === 'additive') p.add(screenX, screenY, ink, a);
    else p.put(screenX, screenY, ink, a);
  });
  return selected;
}
