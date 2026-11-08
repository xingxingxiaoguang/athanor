// Projection convention adapted from fx/arcane/arcane-orb.js ring(): common
// center, flattened circle, picture roll and sin(angle)>0 near half. Original
// energy-orb art: Sprite Fusion, MIT / Copyright (c) 2026 Hugo Duprez.
// This is an affine plane convention, not the black-hole shader's lensing.
import * as body from './body.js';
import { secondsSignal } from './signals.js';
import { transformPoint, transformVector } from './affine.js';
import { stroke } from './strip.js';
import { finite, positive, choice, count, point, fail, color, alpha } from './contract.js';
const TAU = Math.PI * 2;
const valueAt = (v, q) => typeof v === 'function' ? v(q) : v;
function requireOrbit(o) { if (o?.kind !== 'ProjectedOrbit') fail('orbit', 'expected orbit.create()'); return o; }

export function create({ id, body: parent, radius, aspect = .3, roll = 0, center = [0, 0] } = {}) {
  if (typeof id !== 'string' || !id) fail('orbit.id', 'expected stable nonempty string');
  if (parent?.kind !== 'Body') fail('orbit.body', 'provide the shared body.create() instance');
  if (!Array.isArray(center) || center.length !== 2) fail('orbit.center', 'expected local [x,y] seconds channels');
  const channels = [radius, aspect, roll, ...center].map((v, i) => secondsSignal(v, `orbit.${['radius', 'aspect', 'roll', 'center.x', 'center.y'][i]}`));
  return { kind: 'ProjectedOrbit', id, body: parent, parameters(time, options) {
    const state = body.sample(parent, time, options), side = options?.side ?? state.derivative.side, q = channels.map(fn => fn(time, side));
    positive(q[0].value, 'orbit.radius', true); finite(q[1].value, 'orbit.aspect');
    q.forEach(v => { finite(v.value, 'orbit.channel'); finite(v.derivative, 'orbit.channel.derivative'); });
    return { state, q, side };
  } };
}
function at(o, params, angle, rate = 0) {
  finite(angle, 'orbit.angle'); finite(rate, 'orbit.angle.derivative');
  if (Math.abs(angle) > 1e9) fail('orbit.angle', 'angle magnitude exceeds stable seam-query range; reduce whole turns explicitly');
  const { state: s, q } = params, [r, aspect, roll, cx, cy] = q.map(v => v.value), [dr, da, dw, vx, vy] = q.map(v => v.derivative);
  const phase = ((angle % TAU) + TAU) % TAU, ca = Math.cos(phase), sa = phase === 0 || phase === Math.PI ? 0 : Math.sin(phase), c = Math.cos(roll), sn = Math.sin(roll);
  const x = ca * r, y = sa * r * aspect, dx = ca * dr - sa * r * rate, dy = sa * (dr * aspect + r * da) + ca * r * aspect * rate;
  const local = [cx + c * x - sn * y, cy + sn * x + c * y];
  const speed = [vx + c * dx - sn * dy - dw * (sn * x + c * y), vy + sn * dx + c * dy + dw * (c * x - sn * y)];
  const position = transformPoint(s.matrix, local), v = transformPoint(s.matrixVelocity, local), extra = transformVector(s.matrix, speed), velocity = v.map((n, i) => n + extra[i]);
  const derivativeAngle = transformVector(s.matrix, [c * (-sa * r) - sn * (ca * r * aspect), sn * (-sa * r) + c * (ca * r * aspect)]), length = Math.hypot(...derivativeAngle);
  point(position, 'orbit.position'); point(velocity, 'orbit.velocity'); finite(length, 'orbit.tangent');
  const relativeDepth = finite(sa * r, 'orbit.relativeDepth');
  return { orbit: o.id, body: s.id, position, velocity, angle, relativeDepth, depth: finite(s.depth + relativeDepth, 'orbit.depth'), near: phase > 0 && phase < Math.PI, space: 'effect', opacity: s.opacity, status: s.status,
    ...(length > 1e-9 ? { tangent: derivativeAngle.map(v => v / length) } : {}) };
}
export function sample(value, time, { angle = 0, side } = {}) {
  const o = requireOrbit(value), params = o.parameters(time, side ? { side } : undefined), q = secondsSignal(angle, 'orbit.angle')(time, params.side);
  return at(o, params, finite(q.value, 'orbit.angle'), finite(q.derivative, 'orbit.angle.derivative'));
}

/** Angle intervals split exactly at each half-plane seam before rasterizing. */
export function arcs(value, time, { fromAngle = 0, toAngle = TAU, spacingPx = 1, side = 'all' } = {}) {
  const o = requireOrbit(value); finite(fromAngle, 'orbit.fromAngle'); finite(toAngle, 'orbit.toAngle'); positive(spacingPx, 'orbit.spacingPx'); choice(side, ['all', 'near', 'far'], 'orbit.side');
  if (toAngle < fromAngle || toAngle - fromAngle > TAU + 1e-12) fail('orbit.interval', 'expected 0 <= angle span <= 2π; split a longer arc explicitly');
  if (Math.max(Math.abs(fromAngle), Math.abs(toAngle)) > 1e9) fail('orbit.interval', 'angle magnitude exceeds stable seam-query range; reduce whole turns explicitly');
  const params = o.parameters(time), state = params.state, r = params.q[0].value;
  if (toAngle === fromAngle || !r || state.status !== 'alive' || !state.opacity || state.scale.some(v => !v)) return [];
  // Frobenius norm bounds the matrix's stretch; angular derivative magnitude
  // is bounded by radius*max(1,abs(aspect)). No screen arc-length clock implied.
  const stretch = Math.hypot(...state.matrix.slice(0, 4)), bound = finite(r * Math.max(1, Math.abs(params.q[1].value)) * stretch, 'orbit.sampling.bound');
  const cuts = [fromAngle];
  for (let k = Math.floor(fromAngle / Math.PI) + 1; k * Math.PI < toAngle; k++) cuts.push(k * Math.PI);
  cuts.push(toAngle); const out = []; let total = 0;
  for (let i = 1; i < cuts.length; i++) {
    const a = cuts[i - 1], b = cuts[i], near = Math.sin((a + b) / 2) > 0;
    if (side !== 'all' && near !== (side === 'near')) continue;
    const n = Math.max(1, Math.ceil((b - a) * bound / spacingPx)); count(total += n + 1, 'orbit.samples', 4096);
    out.push({ id: JSON.stringify([o.id, i - 1]), near, fromAngle: a, toAngle: b, samples: Array.from({ length: n + 1 }, (_, j) => at(o, params, a + (b - a) * j / n)) });
  }
  return out;
}

export function draw(painter, value, time, { side = 'all', fromAngle = 0, toAngle = TAU, spacingPx = 1, width = 1, color: paint = '#fff', alpha: coverage = 1, light = 0 } = {}) {
  const pieces = arcs(value, time, { side, fromAngle, toAngle, spacingPx });
  return pieces.map(arc => stroke(painter, arc.samples, { width: p => positive(valueAt(width, { ...p, near: arc.near }), 'orbit.width', true), shade: ({ a, b, u, across }, out) => {
    const q = { ...a, position: a.position.map((v, i) => v + (b.position[i] - v) * u), angle: a.angle + (b.angle - a.angle) * u, depth: a.depth + (b.depth - a.depth) * u, near: arc.near, across };
    out.c = color(valueAt(paint, q), 'orbit.color'); out.a = alpha(valueAt(coverage, q), 'orbit.alpha') * a.opacity; out.k = positive(valueAt(light, q), 'orbit.light', true) * out.a;
  } }));
}

/** Attach an emitter to the same projected point used by sample/arcs/draw.
 * Emission rotation is explicit and independent of the ellipse tangent. */
export function source(value, { angle = 0, rotation = 0 } = {}) {
  const o = requireOrbit(value), phase = secondsSignal(angle, 'orbit.angle'), turn = secondsSignal(rotation, 'orbit.source.rotation');
  return { kind: 'SourceTrajectory', space: 'effect', sample(time, options) {
    const params = o.parameters(time, options), g = phase(time, params.side), a = turn(time, params.side), q = at(o, params, g.value, g.derivative), b = params.state;
    return { position: q.position, velocity: q.velocity, rotation: finite(b.rotation + a.value, 'orbit.source.rotation'), angularVelocity: finite(b.angularVelocity + a.derivative, 'orbit.source.angularVelocity'), space: 'effect',
      derivative: { method: 'composed-projected-orbit', body: b.derivative, channels: params.q.map(v => v.discontinuity), angle: g.discontinuity, orientation: a.discontinuity,
        projection: { orbit: o.id, body: b.id, angle: q.angle, near: q.near, relativeDepth: q.relativeDepth } } };
  } };
}
