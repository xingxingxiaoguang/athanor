// Half-open rectangles and consistent color/soft-alpha/light clipping are
// extracted from src/fx/weather/_lib.js:box/clip/pass and core/act.js:actBounds.
// Weather helpers retain their Sprite Fusion / Hugo Duprez / MIT attribution.
// This workbench crop is a final output window in canvas space, not a moving
// emitter bound or the weather helper's transformed effect-local rectangle.
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canvas } from '../../tools/lib/fxlib.mjs';
import { LabError } from './errors.mjs';

export function resolveBounds(fx) {
  const value = fx.mod.authoring?.bounds, [w, h] = fx.meta.size;
  const bad = (message, path = 'authoring.bounds') => { throw new LabError('CONTRACT_MISMATCH', message, { path, recovery: "Edit the module's authoring.bounds: {mode:'asset'|'viewport', rect?:[x,y,width,height]}. Canvas coordinates start at [0,0]; omit rect to use meta.size. Inspect core/effect." }); };
  if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value))) bad('bounds must be an object');
  if (value && Object.keys(value).some(k => !['mode', 'rect'].includes(k))) bad('Unknown bounds field');
  const mode = value?.mode ?? 'asset';
  if (value && !['asset', 'viewport'].includes(value.mode)) bad('bounds.mode must be asset or viewport', 'authoring.bounds.mode');
  const rect = value?.rect === undefined ? [0, 0, w, h] : value.rect;
  if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isInteger) || rect[0] < 0 || rect[1] < 0 || rect[2] < 1 || rect[3] < 1 || rect[0] + rect[2] > w || rect[1] + rect[3] > h) bad('bounds.rect must be an integer [x,y,width,height] inside meta.size with positive extent', 'authoring.bounds.rect');
  return { mode, declared: value !== undefined, space: 'canvas', rect: [...rect], canvasSize: [w, h], clipping: mode === 'viewport' ? 'discard-outside-rect' : 'none',
    placement: 'Fixed output window; effect flip/angle changes the artwork inside it, not this rectangle.',
    colorPolicy: mode === 'viewport' ? 'intentional-crop' : 'error', lightPolicy: mode === 'viewport' ? 'intentional-crop' : value === undefined ? 'legacy-warning-rgb-sum-above-90' : 'error-any-nonzero-rgb' };
}

// Post-raster crop also covers mature helpers that write C/L directly. Pixels
// inside the window are never reblended, resampled or intensity-adjusted.
export function cropFrame(frame, bounds) {
  if (bounds.mode !== 'viewport') return frame;
  const [x, y, w, h] = bounds.rect, ox = frame.ox ?? 0, oy = frame.oy ?? 0;
  for (let row = 0; row < frame.h; row++) {
    const a = row * frame.w, b = a + frame.w, sy = row + oy;
    if (sy < y || sy >= y + h) { frame.color.fill(0, a, b); frame.light.fill(0, a, b); }
    else {
      const left = Math.max(0, Math.min(frame.w, x - ox)), right = Math.max(0, Math.min(frame.w, x + w - ox));
      frame.color.fill(0, a, a + left); frame.light.fill(0, a, a + left);
      frame.color.fill(0, a + right, b); frame.light.fill(0, a + right, b);
    }
  }
  return frame;
}

export function cropPreview(rgba, width, height, ox, oy, bounds) {
  if (bounds.mode !== 'viewport') return rgba;
  const [x, y, w, h] = bounds.rect;
  for (let j = 0; j < width * height; j++) {
    const sx = j % width + ox, sy = Math.floor(j / width) + oy;
    if (sx < x || sx >= x + w || sy < y || sy >= y + h) rgba.fill(0, j * 4, j * 4 + 4);
  }
  return rgba;
}

export function inspectFrameBounds(frame, size, margin, bounds) {
  const width = size[0] + 2 * margin, height = size[1] + 2 * margin;
  const [bx, by, bw, bh] = bounds.rect;
  const state = () => ({ pixels: 0, brightPixels: 0, box: [Infinity, Infinity, -Infinity, -Infinity], sides: { left: 0, right: 0, top: 0, bottom: 0 }, touchesScanBoundary: false });
  const color = state(), light = state();
  for (let i = 0; i < width * height; i++) {
    const x = i % width - margin, y = Math.floor(i / width) - margin;
    if (x >= bx && x < bx + bw && y >= by && y < by + bh) continue;
    for (const [group, visible, bright] of [[color, frame.color[i] >>> 24, 0], [light, frame.light[i] & 0xffffff, (frame.light[i] & 255) + ((frame.light[i] >>> 8) & 255) + ((frame.light[i] >>> 16) & 255) > 90]]) {
      if (!visible) continue;
      group.pixels++; if (bright) group.brightPixels++;
      group.box[0] = Math.min(group.box[0], x); group.box[1] = Math.min(group.box[1], y); group.box[2] = Math.max(group.box[2], x + 1); group.box[3] = Math.max(group.box[3], y + 1);
      if (x < bx) group.sides.left++; if (x >= bx + bw) group.sides.right++;
      if (y < by) group.sides.top++; if (y >= by + bh) group.sides.bottom++;
      if (x === -margin || x === size[0] + margin - 1 || y === -margin || y === size[1] + margin - 1) group.touchesScanBoundary = true;
    }
  }
  const result = group => { const { box, ...rest } = group; return { ...rest, rect: group.pixels ? [box[0], box[1], box[2] - box[0], box[3] - box[1]] : null }; };
  return { color: result(color), light: result(light) };
}

export function boundaryPages(candidates, size, margin, bounds, directory) {
  const width = size[0] + margin * 2, height = size[1] + margin * 2, pages = [];
  for (const candidate of candidates) for (const channel of ['color', 'light']) {
    if (!candidate.location[channel].pixels) continue;
    const pixels = new Uint8Array(width * height * 4), values = candidate.frame[channel];
    values.forEach((c, i) => { pixels[i * 4] = c & 255; pixels[i * 4 + 1] = (c >>> 8) & 255; pixels[i * 4 + 2] = (c >>> 16) & 255; pixels[i * 4 + 3] = channel === 'color' ? c >>> 24 : c & 0xffffff ? 255 : 0; });
    const sheet = canvas(width + 16, height + 48, channel === 'light' ? [0, 0, 0, 255] : [12, 11, 16, 255]);
    sheet.text(`UNCLIPPED ${channel.toUpperCase()} / SEED ${candidate.location.seed}`, 8, 6, 2);
    sheet.text(`${candidate.location.time.toFixed(3)}S / MARGIN ${margin} / NATIVE`, 8, 22, 2);
    sheet.paste(pixels, width, height, 8, 40);
    const bytes = sheet.png(), image = join(directory, `bounds-${pages.length + 1}.png`); writeFileSync(image, bytes);
    pages.push({ image, width: width + 16, height: height + 48, sha256: createHash('sha256').update(bytes).digest('hex'), channel, seed: candidate.location.seed, time: candidate.location.time, actualTime: candidate.location.actualTime, pixelScale: 1,
      representation: 'unclipped-frozen-raster' , frameRect: { x: 8, y: 40, w: width, h: height }, canvasOffset: [-margin, -margin], declaredRectInPage: [8 + margin + bounds.rect[0], 40 + margin + bounds.rect[1], ...bounds.rect.slice(2)], annotations: 'Text/gutter only; raster pixels have no overlay. Light uses black at exposure 1.' });
  }
  return pages;
}
