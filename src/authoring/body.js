// Programmatic bodies reuse motion.source's clock/derivative contract and the
// core Painter's forward/inverse pixel mapping. No new material or actor rig.
import { source as stationary } from './motion.js';
import { secondsSignal } from './signals.js';
import { transformPoint, transformVector } from './affine.js';
import { identity, point, finite, positive, alpha, count, choice, fail } from './contract.js';

const vec = (v, path) => { if (!Array.isArray(v) || v.length !== 2) fail(path, 'expected two numbers or seconds signals'); return v.map((x, i) => secondsSignal(x, `${path}[${i}]`)); };
const pair = (f, t, side) => f.map(g => g(t, side));
function requireBody(b) { if (b?.kind !== 'Body' || typeof b.sample !== 'function') fail('body', 'expected body.create()'); return b; }
function json(value, path = 'body.data', seen = new Set(), depth = 0) {
  if (depth > 16) fail(path, 'JSON nesting exceeds 16', 'BUDGET_EXCEEDED');
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number') return finite(value, path);
  if (!value || (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) || seen.has(value)) fail(path, 'expected acyclic plain finite JSON data');
  seen.add(value); count(Object.keys(value).length, path);
  const out = Array.isArray(value) ? value.map((v, i) => json(v, `${path}[${i}]`, seen, depth + 1)) : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, json(v, `${path}.${k}`, seen, depth + 1)]));
  seen.delete(value); return out;
}
function checkedMatrix(m) { m.forEach(v => finite(v, 'body.matrix')); return m; }
function pointState(state, local, localVelocity = [0, 0]) {
  const position = transformPoint(state.matrix, local), v = transformPoint(state.matrixVelocity, local), extra = transformVector(state.matrix, localVelocity);
  const velocity = v.map((x, i) => x + extra[i]); point(position, 'body.anchor.position'); point(velocity, 'body.anchor.velocity');
  return { position, velocity };
}

export function create({ id, source = stationary(), scale = 1, pivot = [0, 0], flipX = false, opacity = 1, depth = 0, born = 0, end = null, bounds = null, anchors = {}, data = null, side = 'right' } = {}) {
  if (typeof id !== 'string' || !id) fail('body.id', 'expected a stable nonempty string');
  if (source?.kind !== 'SourceTrajectory' || typeof source.sample !== 'function' || source.space !== 'effect') fail('body.source', 'expected an effect-space SourceTrajectory; reuse motion.source/pathSource or a body/orbit anchor');
  point(pivot, 'body.pivot'); if (typeof flipX !== 'boolean') fail('body.flipX', 'expected boolean');
  positive(born, 'body.born', true); if (end !== null && !(finite(end, 'body.end') > born)) fail('body.end', 'expected end > born, or null for no declared end');
  choice(side, ['left', 'right', 'error'], 'body.side');
  if (bounds !== null && (!Array.isArray(bounds) || bounds.length !== 4)) fail('body.bounds', 'expected local [x,y,width,height] or null');
  if (bounds) { bounds.forEach(v => finite(v, 'body.bounds')); positive(bounds[2], 'body.bounds.width', true); positive(bounds[3], 'body.bounds.height', true); }
  if (!anchors || Object.getPrototypeOf(anchors) !== Object.prototype) fail('body.anchors', 'expected a name → local [x,y] channel map');
  count(Object.keys(anchors).length, 'body.anchors', 64);
  const named = Object.entries(anchors).map(([name, p]) => { identity(name, 'body.anchor.name'); return [name, vec(p, `body.anchors.${name}`)]; });
  const size = vec(Array.isArray(scale) ? scale : [scale, scale], 'body.scale'), coverage = secondsSignal(opacity, 'body.opacity'), z = secondsSignal(depth, 'body.depth');
  const localBounds = bounds ? [...bounds] : null, center = [...pivot];
  const evaluate = (time, { side: direction = side, data: includeData = true } = {}) => {
    finite(time, 'body.time'); choice(direction, ['left', 'right', 'error'], 'body.side');
    const q = source.sample(time, { side: direction }), ss = pair(size, time, direction), a = coverage(time, direction), zz = z(time, direction);
    point(q.position, 'body.source.position'); point(q.velocity, 'body.source.velocity'); finite(q.rotation, 'body.source.rotation'); finite(q.angularVelocity, 'body.source.angularVelocity');
    if (!q.derivative || typeof q.derivative.method !== 'string') fail('body.source.derivative', 'source must declare its derivative method; use motion.source or motion.sampledSource');
    const scales = ss.map(v => positive(v.value, 'body.scale', true)), rates = ss.map(v => finite(v.derivative, 'body.scaleVelocity'));
    const c = Math.cos(q.rotation), s = Math.sin(q.rotation), f = flipX ? -1 : 1, [sx, sy] = scales, [vx, vy] = rates, w = q.angularVelocity;
    const linear = [c * sx * f, s * sx * f, -s * sy, c * sy];
    const derivative = [f * (c * vx - s * w * sx), f * (s * vx + c * w * sx), -s * vy - c * w * sy, c * vy - s * w * sy];
    const p = transformVector(linear, center), v = transformVector(derivative, center);
    const matrix = checkedMatrix([...linear, q.position[0] - p[0], q.position[1] - p[1]]), matrixVelocity = checkedMatrix([...derivative, q.velocity[0] - v[0], q.velocity[1] - v[1]]);
    const state = { id, space: 'effect', time, born, end, status: time < born ? 'pending' : end !== null && time >= end ? 'expired' : 'alive', position: [...q.position], velocity: [...q.velocity], rotation: q.rotation, angularVelocity: q.angularVelocity,
      scale: scales, scaleVelocity: rates, flipX, opacity: alpha(a.value, 'body.opacity'), depth: finite(zz.value, 'body.depth'), matrix, matrixVelocity, localBounds: localBounds ? [...localBounds] : null, bounds: null, anchors: {}, data: null,
      derivative: { method: 'composed-body', side: direction, source: q.derivative, channels: [...ss, a, zz].flatMap((v, i) => v.discontinuity ? [{ channel: ['scaleX', 'scaleY', 'opacity', 'depth'][i], kind: v.discontinuity }] : []) } };
    if (localBounds) {
      const [x, y, width, height] = localBounds, corners = [[x, y], [x + width, y], [x + width, y + height], [x, y + height]].map(p => point(transformPoint(matrix, p), 'body.bounds.corners'));
      const xs = corners.map(p => p[0]), ys = corners.map(p => p[1]), minX = Math.min(...xs), minY = Math.min(...ys);
      state.bounds = { corners, rect: [minX, minY, finite(Math.max(...xs) - minX, 'body.bounds.width'), finite(Math.max(...ys) - minY, 'body.bounds.height')] };
    }
    state.anchors = Object.fromEntries(named.map(([name, axes]) => { const p = pair(axes, time, direction); return [name, pointState(state, p.map(v => v.value), p.map(v => v.derivative))]; }));
    state.data = includeData ? json(typeof data === 'function' ? data(time, state) : data) : null;
    return state;
  };
  return { kind: 'Body', id, space: 'effect', sample: evaluate };
}

export function sample(value, time, options) { return requireBody(value).sample(time, options); }

/** Real attachment position and its chain-rule velocity, with independent
 * rigid emission orientation. Birth-domain scaling is not implicitly inherited. */
export function anchor(value, { name, point: local = [0, 0], rotation = 0 } = {}) {
  const b = requireBody(value), axes = vec(local, 'body.anchor.point'), angle = secondsSignal(rotation, 'body.anchor.rotation');
  if (name !== undefined) identity(name, 'body.anchor.name');
  return { kind: 'SourceTrajectory', space: 'effect', sample(time, options = {}) {
    // An attachment is a geometric query. Artist data may itself consume hit
    // records resolved from this anchor; evaluating it here creates a cycle.
    const state = sample(b, time, { ...options, data: false }), side = options.side ?? state.derivative.side, a = angle(time, side);
    let at;
    if (name !== undefined) { if (!Object.hasOwn(state.anchors, name)) fail('body.anchor.name', `unknown named anchor '${name}'`, 'RESOURCE_NOT_FOUND'); at = state.anchors[name]; }
    else { const p = pair(axes, time, side); at = pointState(state, p.map(v => v.value), p.map(v => v.derivative)); }
    return { position: [...at.position], velocity: [...at.velocity], rotation: finite(state.rotation + a.value, 'body.anchor.rotation'), angularVelocity: finite(state.angularVelocity + a.derivative, 'body.anchor.angularVelocity'), space: 'effect',
      derivative: { method: 'composed-body-anchor', body: state.derivative, orientation: { side, discontinuity: a.discontinuity }, attachment: { body: state.id, name: name ?? null } } };
  } };
}

/** Compose Painter's existing forward/inverse maps without changing its
 * shared buffers or the caller's placement/fade. Filled shapes remain filled. */
export function draw(painter, value, time, { draw: render } = {}) {
  const state = sample(value, time);
  if (typeof render !== 'function') fail('body.draw.draw', 'provide draw(localPainter, state)');
  if (state.status !== 'alive' || !state.opacity || state.scale.some(s => s === 0)) return state;
  const m = state.matrix, det = m[0] * m[3] - m[1] * m[2];
  if (!Number.isFinite(det) || !det) fail('body.draw.matrix', 'transform is not numerically invertible; use representable nonzero scales');
  const p = Object.create(painter);
  p.fade = painter.fade * state.opacity;
  p.toX = (x, y) => painter.toX(...transformPoint(m, [x, y]));
  p.toY = (x, y) => painter.toY(...transformPoint(m, [x, y]));
  const inverse = (sx, sy) => { const x = painter.fromX(sx, sy) - m[4], y = painter.fromY(sx, sy) - m[5]; return [(m[3] * x - m[2] * y) / det, (-m[1] * x + m[0] * y) / det]; };
  p.fromX = (sx, sy) => inverse(sx, sy)[0]; p.fromY = (sx, sy) => inverse(sx, sy)[1];
  // Painter.rect's integer-cell fast path leaves holes under scaling. Reuse
  // its general inverse-mapped fill here; legacy Painter stays unchanged.
  p.rect = (x, y, w, h, c, a = 1) => p.shade(x, y, x + w, y + h, (lx, ly, out) => { if (lx >= x && lx < x + w && ly >= y && ly < y + h) { out.c = c; out.a = a; } });
  p.place = p.reset = () => fail('body.draw.painter', 'placement belongs to the shared body; edit its source/scale instead');
  render(p, state); return state;
}

export function drawAll(painter, items, time) {
  if (!Array.isArray(items)) fail('body.drawAll.items', 'expected [{body,draw}]'); count(items.length, 'body.drawAll.items', 64);
  const ids = new Set(), ordered = items.map(item => {
    const state = sample(item.body, time); if (ids.has(state.id)) fail('body.drawAll.id', 'duplicate body identity'); ids.add(state.id); return { ...item, state };
  }).sort((a, b) => a.state.depth - b.state.depth || (a.state.id < b.state.id ? -1 : a.state.id > b.state.id ? 1 : 0));
  return ordered.map(item => draw(painter, item.body, time, { draw: item.draw }));
}

export function observe(value, time) { return { kind: 'BodyObservation', ...sample(value, time) }; }
