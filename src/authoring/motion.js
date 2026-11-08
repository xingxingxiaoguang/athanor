import { point, positive, finite, fail, choice, identity } from './contract.js';
import { sample } from './path.js';
import { simulation } from './integration.js';
import { secondsSignal } from './signals.js';

export function ballistic({ position, velocity, acceleration = [0, 0], drag = 0, age }) {
  point(position, 'motion.position'); point(velocity, 'motion.velocity'); point(acceleration, 'motion.acceleration'); positive(age, 'motion.age', true);
  const damping = typeof drag === 'number' ? [drag, drag] : point(drag, 'motion.drag'); damping.forEach((v) => positive(v, 'motion.drag', true));
  const axes = position.map((x, i) => {
    const k = damping[i], z = k * age, e = Math.exp(-z), f = k > 0 ? -Math.expm1(-z) / k : age;
    const g = k === 0 || z < 1e-4 ? age * age * (0.5 - z / 6 + z * z / 24 - z * z * z / 120) : (age - f) / k;
    return [x + velocity[i] * f + acceleration[i] * g, velocity[i] * e + acceleration[i] * f];
  });
  return { position: axes.map((a) => a[0]), velocity: axes.map((a) => a[1]) };
}
export function along(path, { age, duration, from = 0, to = 1, easing = (u) => u }) {
  finite(age, 'motion.along.age'); positive(duration, 'motion.along.duration'); finite(from, 'motion.along.from'); finite(to, 'motion.along.to');
  const u = easing(Math.max(0, Math.min(1, age / duration))); finite(u, 'motion.along.easing');
  if (u < 0 || u > 1) fail('motion.along.easing', 'path progress overshoot requires an explicit path boundary strategy');
  return sample(path, from + (to - from) * u, { boundary: 'error' });
}

const turn = ([x, y], angle) => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];

function sourceSampler(local, { parent, space = parent?.space ?? 'effect', side = 'right' }) {
  identity(space, 'motion.source.space'); choice(side, ['left', 'right', 'error'], 'motion.source.side');
  if (parent && (parent.kind !== 'SourceTrajectory' || typeof parent.sample !== 'function')) fail('motion.source.parent', 'expected a SourceTrajectory');
  if (parent && parent.space !== space) fail('motion.source.space', 'parent and child spaces differ; convert explicitly');
  return { kind: 'SourceTrajectory', space, side, sample(time, { side: direction = side } = {}) {
    finite(time, 'motion.source.time'); choice(direction, ['left', 'right', 'error'], 'motion.source.side');
    const q = local(time, direction);
    if (parent) {
      const p = parent.sample(time, { side: direction }), offset = turn(q.position, p.rotation), velocity = turn(q.velocity, p.rotation);
      q.position = offset.map((v, i) => p.position[i] + v);
      q.velocity = [p.velocity[0] + velocity[0] - p.angularVelocity * offset[1], p.velocity[1] + velocity[1] + p.angularVelocity * offset[0]];
      q.rotation += p.rotation; q.angularVelocity += p.angularVelocity;
      q.derivative = { ...q.derivative, parent: p.derivative };
    }
    point(q.position, 'motion.source.position'); point(q.velocity, 'motion.source.velocity');
    finite(q.rotation, 'motion.source.rotation'); finite(q.angularVelocity, 'motion.source.angularVelocity');
    return { ...q, space };
  } };
}

/** Lift shared source-at-birth motion into a reusable transform and velocity.
 * Translation + rotation compose by the rigid-transform chain rule. Legacy
 * fly/flyV and fire/_lib.burn remain unchanged (see implementation-map.md). */
export function source({ position = [0, 0], rotation = 0, parent, space, side = 'right' } = {}) {
  if (!Array.isArray(position) || position.length !== 2) fail('motion.source.position', 'expected [x,y], each a number or seconds-based scalar curve/signal');
  const axes = position.map((v, i) => secondsSignal(v, `motion.source.position[${i}]`)), angle = secondsSignal(rotation, 'motion.source.rotation');
  return sourceSampler((time, direction) => {
    const q = [...axes.map((fn) => fn(time, direction)), angle(time, direction)];
    return { position: [q[0].value, q[1].value], velocity: [q[0].derivative, q[1].derivative], rotation: q[2].value, angularVelocity: q[2].derivative,
      derivative: { method: 'analytic', side: direction, discontinuities: q.flatMap((v, i) => v.discontinuity ? [{ channel: ['x', 'y', 'rotation'][i], kind: v.discontinuity }] : []) } };
  }, { parent, space, side });
}

/** Arc-length geometry is reused directly; velocity is tangent * length * ds/dt.
 * Orientation is an independent channel: no fabricated angular derivative of
 * the piecewise-linear path tangent. */
export function pathSource(path, { progress, rotation = 0, parent, space = path?.space, side = 'right', boundary = path?.closed ? 'wrap' : 'clamp' } = {}) {
  if (path?.kind !== 'Path') fail('motion.pathSource.path', 'expected a Path');
  if (space !== path.space) fail('motion.pathSource.space', 'path space differs; convert explicitly');
  const distance = secondsSignal(progress, 'motion.pathSource.progress'), angle = secondsSignal(rotation, 'motion.pathSource.rotation');
  choice(boundary, ['clamp', 'wrap', 'error'], 'motion.pathSource.boundary');
  return sourceSampler((time, direction) => {
    const u = distance(time, direction), a = angle(time, direction), temporalSide = direction === 'left' ? -1 : 1;
    let q = sample(path, u.value, { boundary }), rate = u.derivative, corner = null;
    const epsilon = 8 * Number.EPSILON * Math.max(1, path.lengthPx), d = q.distancePx;
    let before, after;
    if (Math.abs(d) <= epsilon || Math.abs(d - path.lengthPx) <= epsilon) {
      if (boundary === 'wrap') { before = path.segments.at(-1).tangent; after = path.segments[0].tangent; }
      else if (d < path.lengthPx / 2) { before = boundary === 'clamp' ? [0, 0] : path.segments[0].tangent; after = path.segments[0].tangent; }
      else { before = path.segments.at(-1).tangent; after = boundary === 'clamp' ? [0, 0] : path.segments.at(-1).tangent; }
    } else {
      const i = path.segments.findIndex((s) => Math.abs(s.start - d) <= epsilon);
      if (i > 0) { before = path.segments[i - 1].tangent; after = path.segments[i].tangent; }
    }
    let tangent = q.tangent;
    const outside = u.value < 0 || u.value > 1;
    if (boundary === 'clamp' && outside) rate = 0;
    else if (before && rate !== 0) {
      const jump = boundary === 'wrap' && !path.closed && (d <= epsilon || Math.abs(d - path.lengthPx) <= epsilon);
      if (jump || Math.hypot(before[0] - after[0], before[1] - after[1]) > 1e-10) corner = jump ? 'jump' : 'corner';
      if (corner && direction === 'error') fail('motion.pathSource.progress', `${corner} at arc length ${q.s}: two-sided velocity does not exist`, 'CONTRACT_MISMATCH', 'Choose side:"left"/"right" for a temporal limit, or design a zero-speed stop at this vertex. PathSource does not smooth the geometry.');
      tangent = rate * temporalSide < 0 ? before : after;
      if (boundary === 'wrap' && rate * temporalSide < 0 && d <= epsilon) q = sample(path, 1, { boundary: 'clamp' });
    }
    return { position: q.position, velocity: tangent.map((v) => v * path.lengthPx * rate), rotation: a.value, angularVelocity: a.derivative,
      derivative: { method: 'analytic-polyline', side: direction, discontinuities: [u.discontinuity && { channel: 'progress', kind: u.discontinuity }, a.discontinuity && { channel: 'rotation', kind: a.discontinuity }, corner && { channel: 'path', kind: corner }].filter(Boolean) } };
  }, { parent, space, side });
}

/** Explicit, FPS-independent fallback for arbitrary pure position functions.
 * No general error bound or discontinuity detector is claimed. */
export function sampledSource({ sample: fn, stepSeconds, range, parent, space, side = 'right' }) {
  if (typeof fn !== 'function') fail('motion.sampledSource.sample', 'expected a pure time => {position,rotation?} callback');
  positive(stepSeconds, 'motion.sampledSource.stepSeconds'); point(range, 'motion.sampledSource.range');
  if (range[1] - range[0] < 2 * stepSeconds) fail('motion.sampledSource.range', 'range must span at least two explicit difference steps');
  const evaluate = (t) => { const q = fn(t); if (!q || typeof q !== 'object') fail('motion.sampledSource.sample', 'callback must return {position,rotation?}'); point(q.position, 'motion.sampledSource.position'); finite(q.rotation ?? 0, 'motion.sampledSource.rotation'); return { position: [...q.position], rotation: q.rotation ?? 0 }; };
  return sourceSampler((time, direction) => {
    if (time < range[0] || time > range[1]) fail('motion.sampledSource.time', 'outside the declared difference range');
    const h = stepSeconds, stencil = time - h < range[0] ? 'forward' : time + h > range[1] ? 'backward' : 'central';
    const lo = stencil === 'forward' ? time : time - h, hi = stencil === 'backward' ? time : time + h;
    if (!(lo < hi) || (stencil === 'central' && (!(lo < time) || !(time < hi)))) fail('motion.sampledSource.stepSeconds', 'difference samples collapse at this time in floating-point arithmetic', 'CONTRACT_MISMATCH', 'Increase stepSeconds until the difference times are distinct; output FPS is not a differentiation step.');
    const a = evaluate(lo), b = evaluate(hi), q = evaluate(time);
    return { ...q, velocity: b.position.map((v, i) => (v - a.position[i]) / (hi - lo)), angularVelocity: (b.rotation - a.rotation) / (hi - lo),
      derivative: { method: 'finite-difference', side: direction, stencil, stepSeconds: h, sampleTimes: [lo, hi], range: [...range], errorBound: null, discontinuities: 'unchecked' } };
  }, { parent, space, side });
}

/** Declare actual source state without manufacturing particle births. */
export function observeSource(trajectory, time, { id } = {}) {
  if (trajectory?.kind !== 'SourceTrajectory' || typeof trajectory.sample !== 'function') fail('motion.observeSource.source', 'expected a SourceTrajectory');
  if (typeof id !== 'string' || !id) fail('motion.observeSource.id', 'provide a stable nonempty string source ID');
  if (trajectory.space !== 'effect') fail('motion.observeSource.space', 'source observations currently require effect space', 'CAPABILITY_UNSUPPORTED', 'Explicitly convert the source to effect coordinates; the lab does not infer body/scene transforms.');
  return { kind: 'SourceObservation', id, ...trajectory.sample(time) };
}

// Force callbacks compose acceleration, rather than mixing frame-dependent
// position edits with velocity. Constant forces retain the analytic kernel.
export function radial({ center = [0, 0], strength = 0, tangential = 0, startAge = 0 } = {}) {
  if (typeof center !== 'function') point(center, 'motion.radial.center');
  finite(strength, 'motion.radial.strength'); finite(tangential, 'motion.radial.tangential'); positive(startAge, 'motion.radial.startAge', true);
  return (state) => {
    if (state.age < startAge) return [0, 0];
    const target = typeof center === 'function' ? center(state) : center; point(target, 'motion.radial.center');
    const dx = state.position[0] - target[0], dy = state.position[1] - target[1], r = Math.hypot(dx, dy);
    return r < 1e-9 ? [0, 0] : [(dx * strength - dy * tangential) / r, (dy * strength + dx * tangential) / r];
  };
}

export function attract({ target, stiffness = 60, damping = 10, startAge = 0 } = {}) {
  if (typeof target !== 'function') point(target, 'motion.attract.target');
  positive(stiffness, 'motion.attract.stiffness', true); positive(damping, 'motion.attract.damping', true); positive(startAge, 'motion.attract.startAge', true);
  return (state) => {
    if (state.age < startAge) return [0, 0];
    const q = typeof target === 'function' ? target(state) : target; point(q, 'motion.attract.target');
    return q.map((v, i) => (v - state.position[i]) * stiffness - state.velocity[i] * damping);
  };
}

export function integrate({ age, ...config }) {
  return simulation(config).sample(age);
}
