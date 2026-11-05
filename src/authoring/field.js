import { fbm } from '../core/math.js';
import { identity, point, finite, positive, fail } from './contract.js';

export function scalar({ id, space = 'effect', range, unit = 'unitless', sample }) {
  identity(id, 'field.id'); identity(space, 'field.space'); identity(unit, 'field.unit'); point(range, 'field.range');
  if (range[0] > range[1] || typeof sample !== 'function') fail('field.scalar', 'ordered range and sample(x,y,time) are required');
  return { kind: 'ScalarField', id, space, range: [...range], unit, sample(x, y, time = 0) {
    finite(x, 'field.x'); finite(y, 'field.y'); finite(time, 'field.time');
    const value = sample(x, y, time); finite(value, 'field.value');
    if (value < range[0] - 1e-9 || value > range[1] + 1e-9) fail('field.value', `value ${value} outside declared range [${range}]`);
    return value;
  } };
}
export function noise({ id, space = 'effect', scalePx = 16, seed = 1, octaves = 3 }) {
  positive(scalePx, 'field.noise.scalePx'); finite(seed, 'field.noise.seed');
  if (!Number.isInteger(octaves) || octaves < 1 || octaves > 8) fail('field.noise.octaves', 'expected integer in 1..8');
  return scalar({ id, space, range: [-1, 1], sample: (x, y) => fbm(x / scalePx, y / scalePx, seed, octaves) });
}
export function rank({ id, mask, score }) {
  identity(id, 'field.rank.id'); if (mask.kind !== 'Mask' || typeof score !== 'function') fail('field.rank', 'mask and score(x,y,index) required');
  const entries = [];
  mask.data.forEach((v, index) => { if (!v) return; const x = mask.origin[0] + index % mask.w + 0.5, y = mask.origin[1] + Math.floor(index / mask.w) + 0.5;
    entries.push({ index, score: finite(score(x, y, index), 'field.rank.score') }); });
  entries.sort((a, b) => a.score - b.score || a.index - b.index);
  const values = new Float64Array(mask.data.length).fill(NaN);
  entries.forEach(({ index }, i) => { values[index] = entries.length === 1 ? 0 : i / (entries.length - 1); });
  return { kind: 'RankField', id, space: mask.space, unit: 'rank01', range: [0, 1], grid: { w: mask.w, h: mask.h, origin: [...mask.origin], revision: mask.revision }, sample(x, y) {
    const ix = Math.floor(x - mask.origin[0]), iy = Math.floor(y - mask.origin[1]);
    return ix < 0 || iy < 0 || ix >= mask.w || iy >= mask.h ? NaN : values[iy * mask.w + ix];
  } };
}
export function arrival({ id, rank, start, end }) {
  identity(id, 'field.arrival.id'); finite(start, 'field.arrival.start'); finite(end, 'field.arrival.end');
  if (end <= start || rank.kind !== 'RankField') fail('field.arrival', 'requires a static RankField and end > start; arbitrary dynamic fronts have no assumed first-arrival inverse');
  return { kind: 'ArrivalField', id, space: rank.space, unit: 'seconds', range: [start, end], grid: rank.grid, firstArrival: true,
    sample(x, y) { const s = rank.sample(x, y); return Number.isFinite(s) ? start + s * (end - start) : Infinity; } };
}
