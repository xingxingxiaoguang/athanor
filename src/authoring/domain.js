import { identity, positive, finite, count, choice, fail } from './contract.js';
import { unit } from './random.js';
import { sample as samplePath } from './path.js';
import { at } from './mask.js';

export function circle({ id, x = 0, y = 0, radius, space = 'effect' }) {
  identity(id, 'domain.id'); finite(x, 'domain.x'); finite(y, 'domain.y'); positive(radius, 'domain.radius');
  return { kind: 'CircleDomain', id, x, y, radius, space };
}
export function rectangle({ id, x = 0, y = 0, w, h, space = 'effect' }) {
  identity(id, 'domain.id'); finite(x, 'domain.x'); finite(y, 'domain.y'); positive(w, 'domain.w'); positive(h, 'domain.h');
  return { kind: 'RectangleDomain', id, x, y, w, h, space };
}
export function point({ id, position = [0, 0], space = 'effect' }) {
  identity(id, 'domain.id');
  if (!Array.isArray(position) || position.length !== 2) fail('domain.position', 'expected [x,y]');
  position.forEach((v) => finite(v, 'domain.position'));
  return { kind: 'PointDomain', id, position: [...position], space };
}
export function sector({ id, radius, innerRadius = 0, angle = 0, spread = Math.PI / 2, space = 'effect' }) {
  identity(id, 'domain.id'); positive(radius, 'domain.radius'); positive(innerRadius, 'domain.innerRadius', true); finite(angle, 'domain.angle'); positive(spread, 'domain.spread');
  if (innerRadius >= radius || spread > Math.PI * 2) fail('domain.sector', 'requires innerRadius < radius and spread <= 2*pi');
  return { kind: 'SectorDomain', id, radius, innerRadius, angle, spread, space };
}
export function sample({ domain, measure = 'area', count: n, seed = 1, channel = 'position', densityField, ids }) {
  count(n, 'domain.count'); choice(measure, ['area', 'boundary'], 'domain.measure'); identity(channel, 'domain.channel');
  if (!domain || !['Mask', 'Path', 'CircleDomain', 'RectangleDomain', 'PointDomain', 'SectorDomain'].includes(domain.kind)) fail('domain', 'expected Mask, Path or an authored domain');
  if (ids && (!Array.isArray(ids) || ids.length !== n || new Set(ids).size !== n)) fail('domain.ids', 'expected one unique stable identity per sample');
  ids?.forEach((id) => identity(id, 'domain.ids'));
  if (['PointDomain', 'SectorDomain'].includes(domain.kind) && measure !== 'area') fail('domain.measure', 'point and sector currently support area sampling only', 'CAPABILITY_UNSUPPORTED');
  if (domain.kind === 'Path' && measure !== 'boundary') fail('domain.measure', 'an open/closed path samples arc length with boundary, not enclosed area');
  if (densityField && domain.kind !== 'Mask') fail('domain.densityField', 'weighted density currently supports Mask domains only', 'CAPABILITY_UNSUPPORTED');
  if (densityField && (densityField.space !== domain.space || densityField.range[0] < 0)) fail('domain.densityField', 'density must be non-negative and in the domain space');
  let weighted, total = 0;
  if (domain.kind === 'Mask') {
    weighted = [];
    domain.data.forEach((v, index) => {
      if (!v) return;
      const x = domain.origin[0] + index % domain.w + 0.5, y = domain.origin[1] + Math.floor(index / domain.w) + 0.5;
      if (measure === 'boundary' && [at(domain, x - 1, y), at(domain, x + 1, y), at(domain, x, y - 1), at(domain, x, y + 1)].every(Boolean)) return;
      const weight = densityField ? densityField.sample(x, y, 0) : 1;
      finite(weight, 'domain.densityField.value'); if (weight < 0) fail('domain.densityField.value', 'density cannot be negative');
      if (weight > 0) { total += weight; weighted.push({ x, y, cumulative: total, index }); }
    });
    if (n && !total) fail('domain', 'no positive-density pixels in requested measure', 'EMPTY_DOMAIN');
  }
  return Array.from({ length: n }, (_, i) => {
    const key = { seed, layer: domain.id, id: ids?.[i] ?? i, channel }, u = unit(key), v = unit({ ...key, channel: `${channel}/secondary` });
    const result = { id: `${domain.id}/${ids?.[i] ?? i}`, index: i, space: domain.space };
    if (domain.kind === 'PointDomain') return { ...result, position: [...domain.position] };
    if (domain.kind === 'SectorDomain') {
      const angle = domain.angle + (u - 0.5) * domain.spread, r = Math.sqrt(domain.innerRadius ** 2 + v * (domain.radius ** 2 - domain.innerRadius ** 2));
      return { ...result, position: [Math.cos(angle) * r, Math.sin(angle) * r] };
    }
    if (domain.kind === 'Path') return { ...result, ...samplePath(domain, u) };
    if (domain.kind === 'CircleDomain') {
      const angle = u * Math.PI * 2, r = domain.radius * (measure === 'area' ? Math.sqrt(v) : 1), normal = [Math.cos(angle), Math.sin(angle)];
      return { ...result, position: [domain.x + normal[0] * r, domain.y + normal[1] * r], ...(measure === 'boundary' ? { normal, tangent: [-normal[1], normal[0]] } : {}) };
    }
    if (domain.kind === 'RectangleDomain') {
      if (measure === 'area') return { ...result, position: [domain.x + u * domain.w, domain.y + v * domain.h] };
      const s = u * 2 * (domain.w + domain.h);
      const edge = s < domain.w ? [s, 0, 0, -1] : s < domain.w + domain.h ? [domain.w, s - domain.w, 1, 0] : s < 2 * domain.w + domain.h ? [2 * domain.w + domain.h - s, domain.h, 0, 1] : [0, 2 * (domain.w + domain.h) - s, -1, 0];
      return { ...result, position: [domain.x + edge[0], domain.y + edge[1]], normal: edge.slice(2), tangent: [-edge[3], edge[2]] };
    }
    const target = u * total; let lo = 0, hi = weighted.length - 1;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (weighted[mid].cumulative <= target) lo = mid + 1; else hi = mid; }
    const pixel = weighted[lo]; return { ...result, position: [pixel.x, pixel.y], pixelIndex: pixel.index };
  });
}
