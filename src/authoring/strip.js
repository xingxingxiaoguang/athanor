// Lifted from path.strip's nearest-centerline rasterizer. Retains round caps
// and union joins, without miter spikes or repeated alpha at segment joints.
import { positive } from './contract.js';
export function stroke(painter, input, { width, shade, newest = false }) {
  const points = input.map((p) => ({ ...p, width: positive(typeof width === 'function' ? width(p) : width, 'strip.width', true) }));
  const segments = points.slice(1).flatMap((b, i) => b.breakBefore || Math.hypot(b.position[0] - points[i].position[0], b.position[1] - points[i].position[1]) === 0 ? [] : [{ a: points[i], b }]);
  const radius = Math.max(0, ...points.map((p) => p.width)) / 2;
  if (!radius || !segments.length) return { segments: 0 };
  const x0 = Math.min(...points.map((p) => p.position[0])) - radius, y0 = Math.min(...points.map((p) => p.position[1])) - radius;
  const x1 = Math.max(...points.map((p) => p.position[0])) + radius, y1 = Math.max(...points.map((p) => p.position[1])) + radius;
  painter.shade(x0, y0, x1, y1, (x, y, out) => {
    let best = Infinity, hit;
    for (const { a, b } of segments) {
      const dx = b.position[0] - a.position[0], dy = b.position[1] - a.position[1], len2 = dx * dx + dy * dy;
      const u = Math.max(0, Math.min(1, ((x - a.position[0]) * dx + (y - a.position[1]) * dy) / len2));
      const ex = x - a.position[0] - dx * u, ey = y - a.position[1] - dy * u, r = (a.width + (b.width - a.width) * u) / 2;
      const d = r > 0 ? Math.hypot(ex, ey) / r : Infinity;
      if (d < best || (newest && d === best && d !== Infinity)) { best = d; hit = { a, b, u, across: ((dx * ey - dy * ex) < 0 ? -1 : 1) * d }; }
    }
    if (best <= 1 && hit) shade(hit, out);
  });
  return { segments: segments.length, bounds: [x0, y0, x1, y1] };
}
