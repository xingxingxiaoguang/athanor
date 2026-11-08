// Distance propagation composes the library's inherited fracture distance,
// path arc-length queries and immutable secondary births. Geometry/material
// remain independent; projection never becomes the propagation clock.
import { fractureBranches } from '../core/branching.js';
import { Rng, TAU } from '../core/math.js';
import { polyline, sample } from './path.js';
import { scalar } from './curve.js';
import { identity, finite, positive, point, count, choice, alpha, fail } from './contract.js';

const key = (...parts) => JSON.stringify(parts);
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function requireNetwork(value) {
  if (value?.kind !== 'PropagationNetwork') fail('propagation.network', 'expected a PropagationNetwork');
  return value;
}
function locate(branch, distancePx) {
  const path = branch.path, d = Math.max(0, Math.min(path.lengthPx, distancePx));
  let lo = 0, hi = path.segments.length - 1;
  while (lo < hi) { const m = (lo + hi) >>> 1; if (path.segments[m].start + path.segments[m].length <= d) lo = m + 1; else hi = m; }
  const seg = path.segments[lo], u = (d - seg.start) / seg.length;
  const a = branch.projected[lo], b = branch.projected[lo + 1], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return { sourcePosition: [seg.a[0] + (seg.b[0] - seg.a[0]) * u, seg.a[1] + (seg.b[1] - seg.a[1]) * u],
    position: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u],
    ...(length > 1e-9 ? { tangent: [(b[0] - a[0]) / length, (b[1] - a[1]) / length], normal: [-(b[1] - a[1]) / length, (b[0] - a[0]) / length] } : {}) };
}

/** Explicit tree/forest attachment in design pixels, before any projection. */
export function network({ id, branches, space = 'effect', project = p => p } = {}) {
  identity(id, 'propagation.id'); identity(space, 'propagation.space');
  if (!Array.isArray(branches)) fail('propagation.branches', 'expected an array of explicitly identified branches');
  if (typeof project !== 'function') fail('propagation.project', 'expected a pure point projection');
  count(branches.length, 'propagation.branches');
  const input = new Map(), result = new Map(); let points = 0;
  for (const b of branches) {
    identity(b?.id, 'propagation.branch.id');
    const token = key(b.id);
    if (input.has(token)) fail('propagation.branch.id', 'duplicate branch identity');
    if (!Array.isArray(b.points)) fail('propagation.branch.points', 'expected [x,y] points');
    points += b.points.length; count(points, 'propagation.points'); input.set(token, b);
  }
  // Iterative parent traversal also handles a long authored chain without
  // depending on the JavaScript recursion limit.
  for (const token of [...input.keys()].sort(order)) {
    const pending = [], visiting = new Set(); let current = token;
    while (!result.has(current)) {
      if (visiting.has(current)) fail('propagation.branch.parentId', 'cycle in branch attachment');
      const b = input.get(current);
      if (!b) fail('propagation.branch.parentId', 'parent not found; supply an explicit branch id');
      visiting.add(current); pending.push(b);
      if (b.parentId === undefined || b.parentId === null) break;
      identity(b.parentId, 'propagation.branch.parentId'); current = key(b.parentId);
    }
    for (const b of pending.reverse()) {
      const parentId = b.parentId ?? null, parent = parentId === null ? null : result.get(key(parentId));
      if (b.attachVertex !== undefined && b.attachPx !== undefined) fail('propagation.branch.attachment', 'choose attachVertex or attachPx, not both');
      let attachPx = positive(b.attachPx ?? 0, 'propagation.branch.attachPx', true);
      if (b.attachVertex !== undefined) {
        if (!parent) fail('propagation.branch.attachVertex', 'vertex attachment requires a parent');
        count(b.attachVertex, 'propagation.branch.attachVertex', parent.path.points.length - 1);
        attachPx = b.attachVertex === parent.path.points.length - 1 ? parent.path.lengthPx : parent.path.segments[b.attachVertex].start;
      }
      const path = polyline({ id: key(id, b.id), points: b.points, space: 'design' });
      finite(path.lengthPx, 'propagation.branch.lengthPx');
      if (!parent && attachPx !== 0) fail('propagation.branch.attachPx', 'root attachment must be zero');
      if (parent) {
        if (attachPx > parent.path.lengthPx + 1e-7) fail('propagation.branch.attachPx', 'attachment exceeds parent local length');
        const at = sample(parent.path, Math.min(1, attachPx / parent.path.lengthPx)).position;
        if (Math.hypot(at[0] - path.points[0][0], at[1] - path.points[0][1]) > 1e-6) fail('propagation.branch.points[0]', 'child must start at its parent attachment in design space');
      }
      const projected = path.points.map(p => [...point(project([...p], b.id), 'propagation.project.output')]);
      projected.forEach((p, i) => { if (i) finite(Math.hypot(p[0] - projected[i - 1][0], p[1] - projected[i - 1][1]), 'propagation.project.segment'); });
      const startPx = parent ? parent.startPx + Math.min(attachPx, parent.path.lengthPx) : 0;
      result.set(key(b.id), { id: b.id, parentId, attachPx, startPx, endPx: finite(startPx + path.lengthPx, 'propagation.branch.endPx'), path, projected });
    }
  }
  const list = [...result.values()].sort((a, b) => order(key(a.id), key(b.id)));
  return { kind: 'PropagationNetwork', id, space, branches: list, maxDistancePx: list.reduce((m, b) => Math.max(m, b.endPx), 0) };
}

/** The mature ice walk, including its RNG order and two levels of forks. */
export function fractures({ id, seed = 1, origin = [0, 0], arms = 7, inside, stepPx = [1.6, 2.6], steps = 18, fork = .16, angle, spread = TAU, space = 'effect', project } = {}) {
  identity(id, 'propagation.id'); point(origin, 'propagation.origin');
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) fail('propagation.seed', 'expected an unsigned 32-bit integer (legacy Rng maps zero to one)');
  count(arms, 'propagation.arms', 100); count(steps, 'propagation.steps', 100); alpha(fork, 'propagation.fork');
  if (!Array.isArray(stepPx) || stepPx.length !== 2) fail('propagation.stepPx', 'expected [min,max] positive design-pixel steps');
  stepPx.forEach(v => positive(v, 'propagation.stepPx')); if (stepPx[0] > stepPx[1]) fail('propagation.stepPx', 'min exceeds max');
  finite(spread, 'propagation.spread'); if (spread < 0 || spread > TAU) fail('propagation.spread', 'expected radians in [0,2π]');
  if (angle !== undefined) finite(angle, 'propagation.angle');
  if (typeof inside !== 'function') fail('propagation.inside', 'supply a pure design-space containment test');
  let budget = 0;
  const generated = fractureBranches(new Rng(seed), (x, y) => {
    const v = inside(x, y); if (typeof v !== 'boolean') fail('propagation.inside.output', 'expected boolean'); return v;
  }, ...origin, arms, { step: stepPx, len: steps, fork, a0: angle, spread }, () => count(++budget, 'propagation.generatedPoints'));
  return network({ id, space, project, branches: generated.map(b => ({ ...b, points: b.points.map(p => p.slice(0, 2)) })) });
}

/** Fixed local-distance lattice; greedy screen-space clearance in stable order. */
export function sites(value, { spacingPx = 10, offsetPx = 0, minDistancePx = 0, maxDistancePx = value?.maxDistancePx, minGapPx = 0, limit = 10000, select = () => true } = {}) {
  const net = requireNetwork(value);
  positive(spacingPx, 'propagation.sites.spacingPx'); positive(offsetPx, 'propagation.sites.offsetPx', true);
  positive(minDistancePx, 'propagation.sites.minDistancePx', true); positive(maxDistancePx, 'propagation.sites.maxDistancePx', true);
  positive(minGapPx, 'propagation.sites.minGapPx', true); count(limit, 'propagation.sites.limit');
  if (minDistancePx > maxDistancePx) fail('propagation.sites.interval', 'minimum distance exceeds maximum');
  if (typeof select !== 'function') fail('propagation.sites.select', 'expected a pure site predicate');
  const candidates = []; let budget = 0;
  for (const b of net.branches) {
    const end = Math.min(b.path.lengthPx, maxDistancePx - b.startPx);
    // Tolerance is in design pixels, not lattice indices: an index epsilon
    // would grow into whole pixels when spacing is very large.
    const first = Math.max(0, Math.ceil((Math.max(0, minDistancePx - b.startPx) - offsetPx - 1e-9) / spacingPx));
    const last = Math.floor((end - offsetPx + 1e-9) / spacingPx);
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) fail('propagation.sites.spacingPx', 'lattice index exceeds safe integer precision', 'BUDGET_EXCEEDED');
    if (last < first) continue;
    count(budget += last - first + 1, 'propagation.sites.candidates');
    for (let i = first; i <= last; i++) {
      const localDistancePx = Math.min(b.path.lengthPx, offsetPx + i * spacingPx), distancePx = b.startPx + localDistancePx;
      const site = { id: `site:${key(net.id, b.id, localDistancePx)}`, branchId: b.id, parentId: b.parentId, index: i, localDistancePx, distancePx, space: net.space, ...locate(b, localDistancePx) };
      const selected = select(site); if (typeof selected !== 'boolean') fail('propagation.sites.select.output', 'expected boolean');
      if (selected) candidates.push(site);
    }
  }
  candidates.sort((a, b) => a.distancePx - b.distancePx || order(a.id, b.id));
  const accepted = [], cells = new Map();
  for (const s of candidates) {
    if (accepted.length === limit) break;
    const [x, y] = s.position, gx = Math.floor(x / minGapPx), gy = Math.floor(y / minGapPx);
    if (minGapPx) {
      // Refuse numerically unrepresentable grid coordinates rather than looping
      // forever when adding one no longer changes a floating-point integer.
      if (!Number.isSafeInteger(gx) || !Number.isSafeInteger(gy)) fail('propagation.sites.minGapPx', 'clearance grid exceeds safe integer precision');
      let close = false;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++)
        for (const q of cells.get(key(gx + dx, gy + dy)) ?? []) if (Math.hypot(x - q.position[0], y - q.position[1]) < minGapPx) close = true;
      if (close) continue;
      const cell = key(gx, gy); if (!cells.has(cell)) cells.set(cell, []); cells.get(cell).push(s);
    }
    accepted.push(s);
  }
  return accepted;
}

function inverse(front, direction) {
  choice(direction, ['outward', 'inward'], 'propagation.direction');
  if (front?.kind !== 'ScalarCurve' || front.input !== 'scene.seconds' || front.outputUnit !== 'pixels' || front.extrapolation !== 'clamp')
    fail('propagation.front', 'expected a clamped scene.seconds → pixels ScalarCurve', 'CONTRACT_MISMATCH', 'Use curve.scalar({input:"scene.seconds",outputUnit:"pixels",points:[[start,0],[end,distance]]}); decreasing points require direction:"inward".');
  const c = scalar(front), sign = direction === 'outward' ? 1 : -1;
  for (let i = 0; i < c.points.length; i++) {
    positive(c.points[i][0], 'propagation.front.time', true); positive(c.points[i][1], 'propagation.front.distance', true);
    if (i && sign * (c.points[i][1] - c.points[i - 1][1]) < 0) fail('propagation.front.points', 'front must be monotone in its declared direction; split grow/retreat into separate fronts');
  }
  return d => {
    positive(d, 'propagation.distancePx', true);
    if (sign * (d - c.points[0][1]) <= 0) return c.points[0][0];
    for (let i = 1; i < c.points.length; i++) {
      const [t0, d0] = c.points[i - 1], [t1, d1] = c.points[i];
      if (sign * (d - d1) > 0) continue;
      if (d === d1 || c.interpolation === 'hold') return t1;
      const u = (d - d0) / (d1 - d0);
      if (c.interpolation === 'linear') return t0 + (t1 - t0) * u;
      let lo = 0, hi = 1;
      for (let k = 0; k < 48; k++) { const m = (lo + hi) / 2; if (m * m * (3 - 2 * m) < u) lo = m; else hi = m; }
      return t0 + (t1 - t0) * (lo + hi) / 2;
    }
    return Infinity; // Not reached in the explicitly declared knot interval.
  };
}

export function arrival(front, distancePx, { direction = 'outward' } = {}) { return inverse(front, direction)(distancePx); }

/** First crossing records feed schedule.alive or particle.emitter unchanged. */
export function births({ id, sites: samples, front, direction = 'outward', delay = 0, count: copies = 1 } = {}) {
  identity(id, 'propagation.births.id'); positive(delay, 'propagation.births.delay', true); count(copies, 'propagation.births.count');
  if (!Array.isArray(samples)) fail('propagation.births.sites', 'expected sites array');
  count(samples.length, 'propagation.births.sites'); const at = inverse(front, direction), seen = new Set(), out = [];
  for (const s of samples) {
    identity(s?.id, 'propagation.site.id'); identity(s.space, 'propagation.site.space'); point(s.position, 'propagation.site.position');
    if (seen.has(key(s.id))) fail('propagation.site.id', 'duplicate site identity'); seen.add(key(s.id));
    const reachedAt = at(s.distancePx); if (!Number.isFinite(reachedAt)) continue;
    count(out.length + copies, 'propagation.births.records');
    for (let i = 0; i < copies; i++) {
      const stable = `propagation:${key(id, s.id, i)}`;
      out.push({ id: stable, randomId: stable, index: i, born: finite(reachedAt + delay, 'propagation.births.born'), reachedAt, position: [...s.position],
        ...(s.tangent ? { tangent: [...s.tangent] } : {}), ...(s.normal ? { normal: [...s.normal] } : {}), space: s.space,
        site: { ...s, position: [...s.position], ...(s.sourcePosition ? { sourcePosition: [...s.sourcePosition] } : {}), ...(s.tangent ? { tangent: [...s.tangent] } : {}), ...(s.normal ? { normal: [...s.normal] } : {}) } });
    }
  }
  return out.sort((a, b) => a.born - b.born || order(a.id, b.id));
}

/** Clip every segment in inherited design distance, then interpolate projection. */
export function segments(value, { fromPx = 0, toPx = value?.maxDistancePx } = {}) {
  const net = requireNetwork(value); finite(fromPx, 'propagation.segments.fromPx'); finite(toPx, 'propagation.segments.toPx');
  const out = [];
  for (const b of net.branches) for (let i = 0; i < b.path.segments.length; i++) {
    const s = b.path.segments[i], start = b.startPx + s.start, end = start + s.length;
    const lo = Math.max(start, fromPx), hi = Math.min(end, toPx); if (hi <= lo) continue;
    const a = b.projected[i], z = b.projected[i + 1], mix = d => a.map((v, j) => v + (z[j] - v) * ((d - start) / s.length));
    out.push({ id: key(net.id, b.id, i), branchId: b.id, parentId: b.parentId, a: mix(lo), b: mix(hi), fromPx: lo, toPx: hi, space: net.space });
  }
  return out;
}
