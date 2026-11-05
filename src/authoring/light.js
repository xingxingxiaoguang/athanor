import { color, positive, fail, finite } from './contract.js';

export function fromMask(painter, source, { color: paint, intensity = 0.2, radius = 0 } = {}) {
  if (source.kind !== 'Mask') fail('light.fromMask.mask', 'expected Mask'); positive(radius, 'light.fromMask.radius', true);
  if (radius > 0 && radius < 1) fail('light.fromMask.radius', 'use 0 for single-pixel light or radius >= 1 for radial glow');
  source.data.forEach((v, i) => {
    if (!v) return;
    const x = source.origin[0] + i % source.w + 0.5, y = source.origin[1] + Math.floor(i / source.w) + 0.5;
    const c = color(typeof paint === 'function' ? paint(x, y, i) : paint, 'light.fromMask.color');
    const k = finite(typeof intensity === 'function' ? intensity(x, y, i) : intensity, 'light.fromMask.intensity'); positive(k, 'light.fromMask.intensity', true);
    if (radius) painter.glow(x, y, radius, c, k); else painter.light(x, y, c, k);
  });
}
