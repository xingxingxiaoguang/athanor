import { finite, positive, identity, point, choice, fail, color, alpha } from './contract.js';

export function polyline({ id, points, closed = false, space = 'effect' }) {
  identity(id, 'path.id'); identity(space, 'path.space');
  if (!Array.isArray(points) || points.length < 2) fail('path.points', 'at least two points are required');
  const cleaned = [];
  points.forEach((p, i) => { point(p, `path.points[${i}]`); if (!cleaned.length || Math.hypot(p[0] - cleaned.at(-1)[0], p[1] - cleaned.at(-1)[1]) > 1e-9) cleaned.push([...p]); });
  if (closed && cleaned.length > 1 && Math.hypot(cleaned[0][0] - cleaned.at(-1)[0], cleaned[0][1] - cleaned.at(-1)[1]) > 1e-9) cleaned.push([...cleaned[0]]);
  const segments = []; let lengthPx = 0;
  for (let i = 1; i < cleaned.length; i++) {
    const a = cleaned[i - 1], b = cleaned[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!length) continue;
    segments.push({ a, b, start: lengthPx, length, tangent: [(b[0] - a[0]) / length, (b[1] - a[1]) / length] }); lengthPx += length;
  }
  if (!lengthPx) fail('path.points', 'all points coincide; tangent and arc length are undefined');
  return { kind: 'Path', id, space, closed, points: cleaned, segments, lengthPx };
}

export function bezier({ id, points, tolerancePx = 0.25, maxDepth = 12, space = 'effect' }) {
  if (!Array.isArray(points) || points.length !== 4) fail('path.bezier.points', 'expected four cubic control points');
  points.forEach((p, i) => point(p, `path.bezier.points[${i}]`)); positive(tolerancePx, 'path.bezier.tolerancePx');
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 16) fail('path.bezier.maxDepth', 'expected integer in 1..16');
  const out = [[...points[0]]], mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  function split(a, b, c, d, depth) {
    const chord = Math.hypot(d[0] - a[0], d[1] - a[1]);
    const polygon = Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1]) + Math.hypot(d[0] - c[0], d[1] - c[1]);
    // Flatness must also bound sideways displacement, not only length error.
    const distance = (p) => chord ? Math.abs((d[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (d[1] - a[1])) / chord : Math.hypot(p[0] - a[0], p[1] - a[1]);
    if (polygon - chord <= tolerancePx && Math.max(distance(b), distance(c)) <= tolerancePx) { out.push([...d]); return; }
    if (depth >= maxDepth) fail('path.bezier', 'subdivision budget exhausted before tolerance was reached', 'BUDGET_EXCEEDED');
    const ab = mid(a, b), bc = mid(b, c), cd = mid(c, d), abc = mid(ab, bc), bcd = mid(bc, cd), center = mid(abc, bcd);
    split(a, ab, abc, center, depth + 1); split(center, bcd, cd, d, depth + 1);
  }
  split(...points, 0);
  return { ...polyline({ id, points: out, space }), tolerancePx, source: 'cubic-bezier' };
}

export function sample(path, s, { boundary = path.closed ? 'wrap' : 'clamp' } = {}) {
  if (path.kind !== 'Path') fail('path.sample.path', 'expected Path'); finite(s, 'path.sample.s'); choice(boundary, ['clamp', 'wrap', 'error'], 'path.sample.boundary');
  if (boundary === 'error' && (s < 0 || s > 1)) fail('path.sample.s', 'outside normalized arc length [0,1]');
  s = boundary === 'wrap' ? ((s % 1) + 1) % 1 : Math.max(0, Math.min(1, s));
  const distancePx = s * path.lengthPx;
  // At a corner the outgoing segment defines the tangent; the final endpoint
  // uses the final incoming segment. No artificial outward normal is inferred.
  let lo = 0, hi = path.segments.length - 1;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (path.segments[mid].start + path.segments[mid].length <= distancePx) lo = mid + 1; else hi = mid; }
  const seg = path.segments[lo], u = (distancePx - seg.start) / seg.length, [tx, ty] = seg.tangent;
  return { position: [seg.a[0] + (seg.b[0] - seg.a[0]) * u, seg.a[1] + (seg.b[1] - seg.a[1]) * u], tangent: [tx, ty], normal: [-ty, tx], s, distancePx, space: path.space };
}

export function resample(path, { spacingPx = 1, from = 0, to = 1 } = {}) {
  positive(spacingPx, 'path.resample.spacingPx'); finite(from, 'path.from'); finite(to, 'path.to');
  if (from < 0 || to > 1 || from > to) fail('path.interval', 'expected 0 <= from <= to <= 1; split a wrapped interval explicitly');
  const n = Math.max(1, Math.ceil((to - from) * path.lengthPx / spacingPx));
  if (n > 10000) fail('path.resample', 'sample budget 10000 exceeded', 'BUDGET_EXCEEDED');
  return Array.from({ length: n + 1 }, (_, i) => sample(path, from + (to - from) * i / n, { boundary: 'clamp' }));
}

/** One continuous nearest-centerline strip, rather than a row of particle discs. */
export function strip(painter, path, { from = 0, to = 1, width = 2, color: paint = '#fff', alpha: opacity = 1, spacingPx = 1 } = {}) {
  if (from === to) return { segments: 0 };
  const points = resample(path, { spacingPx, from, to }).map((p) => ({ ...p, width: positive(typeof width === 'function' ? width(p.s) : width, 'path.strip.width', true) }));
  const radius = Math.max(...points.map((p) => p.width)) / 2;
  if (!radius) return { segments: 0 };
  const x0 = Math.min(...points.map((p) => p.position[0])) - radius, y0 = Math.min(...points.map((p) => p.position[1])) - radius;
  const x1 = Math.max(...points.map((p) => p.position[0])) + radius, y1 = Math.max(...points.map((p) => p.position[1])) + radius;
  const segments = points.slice(1).map((b, i) => ({ a: points[i], b }));
  painter.shade(x0, y0, x1, y1, (x, y, out) => {
    let best = Infinity, along = 0, across = 0;
    for (const { a, b } of segments) {
      const dx = b.position[0] - a.position[0], dy = b.position[1] - a.position[1], len2 = dx * dx + dy * dy;
      const u = Math.max(0, Math.min(1, ((x - a.position[0]) * dx + (y - a.position[1]) * dy) / (len2 || 1)));
      const ex = x - a.position[0] - dx * u, ey = y - a.position[1] - dy * u, r = (a.width + (b.width - a.width) * u) / 2;
      const d = r > 0 ? Math.hypot(ex, ey) / r : Infinity;
      if (d < best) { best = d; along = a.s + (b.s - a.s) * u; across = ((dx * ey - dy * ex) < 0 ? -1 : 1) * d; }
    }
    if (best > 1) return;
    out.c = color(typeof paint === 'function' ? paint(along, across) : paint, 'path.strip.color');
    out.a = alpha(typeof opacity === 'function' ? opacity(along, across) : opacity, 'path.strip.alpha');
  });
  return { segments: segments.length, bounds: [x0, y0, x1, y1] };
}
