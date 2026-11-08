// Pure choreography adapter over core/act's held drawings and core/rig's IK.
// Held-pose timing is adapted from Hollow Crown, MIT, (c) 2026 rehan-remade;
// see core/act.js. No legacy act playback, target simulation or editor is copied.
import { lerpPose } from '../core/act.js';
import { STAND, skeleton, posed } from '../core/rig.js';
import * as body from './body.js';
import * as motion from './motion.js';
import { finite, positive, count, point, choice, fail } from './contract.js';

const near = (a, b) => Math.abs(a - b) <= 8 * Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
const sideOf = side => choice(side, ['left', 'right', 'error'], 'action.side');
const requireClock = c => { if (c?.kind !== 'ActionClock') fail('action.clock', 'expected action.clock()'); return c; };
const requireAction = a => { if (a?.kind !== 'Action') fail('action', 'expected action.create()'); return a; };

/** Playback seconds -> local action seconds, with exact inserted hold intervals.
 * This is an immutable map: seeking never replays callbacks or integrates dt. */
export function clock({ from = 0, to, rate = 1, holds = [] } = {}) {
  finite(from, 'action.clock.from'); finite(to, 'action.clock.to'); positive(rate, 'action.clock.rate');
  if (!(to > from)) fail('action.clock.to', 'expected to > from');
  if (!Array.isArray(holds)) fail('action.clock.holds', 'expected [{at,duration}]'); count(holds.length, 'action.clock.holds', 256);
  let delay = 0;
  const stops = holds.map(h => {
    finite(h.at, 'action.clock.hold.at'); positive(h.duration, 'action.clock.hold.duration');
    if (h.at < from || h.at > to) fail('action.clock.hold.at', 'outside [from,to]'); return { ...h };
  }).sort((a, b) => a.at - b.at).map((h, i, all) => {
    if (i && near(h.at, all[i - 1].at)) fail('action.clock.holds', 'duplicate hold time; combine its durations explicitly');
    const start = finite((h.at - from) / rate + delay, 'action.clock.hold.start'); delay += h.duration;
    const end = finite(start + h.duration, 'action.clock.hold.end');
    if (!(end > start) || near(start, end)) fail('action.clock.hold.duration', 'hold interval collapses at the clock boundary precision; increase its duration');
    return { at: h.at, start, end };
  });
  const duration = positive((to - from) / rate + delay, 'action.clock.duration');
  const at = (local, { edge = 'after' } = {}) => {
    finite(local, 'action.clock.at'); choice(edge, ['before', 'after'], 'action.clock.edge');
    if (local < from || local > to) fail('action.clock.at', 'outside [from,to]');
    return (local - from) / rate + stops.reduce((sum, h) => sum + (h.at < local && !near(h.at, local) || near(h.at, local) && edge === 'after' ? h.end - h.start : 0), 0);
  };
  return { kind: 'ActionClock', from, to, rate, duration, holds: stops.map(h => ({ ...h })), at,
    sample(playback, { side = 'right' } = {}) {
      finite(playback, 'action.clock.playback'); sideOf(side);
      let elapsed = 0, local, localRate = rate, frozen = false, boundary = near(playback, 0) || near(playback, duration) ? 'range-edge' : null;
      for (const h of stops) {
        const atStart = near(playback, h.start), atEnd = near(playback, h.end);
        if (atStart || atEnd) { boundary = 'hold-edge'; local = h.at; }
        const inside = (!atStart && !atEnd && playback > h.start && playback < h.end) || atStart && side !== 'left' || atEnd && side === 'left';
        if (inside) { local = h.at; localRate = 0; frozen = true; break; }
        if (playback >= h.end || near(playback, h.end)) elapsed += h.end - h.start;
      }
      if (local === undefined) local = from + (playback - elapsed) * rate;
      if (playback < 0 || near(playback, 0) && side === 'left') { local = from; localRate = 0; frozen = false; boundary = near(playback, 0) ? 'range-edge' : null; }
      if (playback > duration || near(playback, duration) && side !== 'left') { local = to; localRate = 0; boundary = near(playback, duration) ? 'range-edge' : null; frozen = false; }
      if (side === 'error' && (boundary || near(playback, 0) || near(playback, duration))) fail('action.clock.playback', 'clock rate has a one-sided boundary', 'CONTRACT_MISMATCH', 'Choose side:left/right; inserted holds have zero local rate and do not manufacture crossing velocity.');
      return { playback, local: Math.max(from, Math.min(to, local)), localRate, frozen, phase: playback < 0 ? 'pending' : playback >= duration ? 'ended' : 'active', boundary,
        poseSide: frozen || playback > duration ? 'right' : side };
    } };
}

/** Map event/birth times to playback; life is deliberately left in playback
 * seconds. Convert an action-local end explicitly by supplying end. */
export function retime(value, births, { edge = 'after', endEdge = 'after' } = {}) {
  const c = requireClock(value); if (!Array.isArray(births)) fail('action.retime.births', 'expected a birth table'); count(births.length, 'action.retime.births');
  return births.map(b => {
    const born = c.at(b.born, { edge }), out = { ...b, born, actionBorn: b.born };
    if (b.end !== undefined) { out.end = c.at(b.end, { edge: endEdge }); out.life = positive(out.end - born, 'action.retime.life'); out.actionEnd = b.end; }
    return out;
  });
}

const ease = (u, how) => how === 'line' ? [u, 1] : how === 'in' ? [u * u, 2 * u] : how === 'out' ? [1 - (1 - u) ** 2, 2 * (1 - u)] : [u * u * (3 - 2 * u), 6 * u * (1 - u)];
function trackOf(poses) {
  if (!Array.isArray(poses) || !poses.length) fail('action.poses', 'expected nonempty [localSeconds,pose,arrival?] keys'); count(poses.length, 'action.poses', 512);
  return poses.map((key, i) => {
    if (!Array.isArray(key) || key.length < 2 || key.length > 3) fail('action.poses', 'expected [localSeconds,pose,arrival?]');
    const [time, pose, how = 'smooth'] = key; finite(time, 'action.poses.time'); choice(how, ['smooth', 'line', 'in', 'out', 'snap'], 'action.poses.arrival');
    if (i && !(time > poses[i - 1][0])) fail('action.poses.time', 'keys must be strictly increasing');
    if (!pose || Object.getPrototypeOf(pose) !== Object.prototype) fail('action.poses.pose', 'expected a plain pose object');
    for (const [k, v] of Object.entries(pose)) { if (typeof v === 'number') finite(v, `action.poses.${k}`); else if (!['string', 'boolean'].includes(typeof v)) fail(`action.poses.${k}`, 'expected number, string or boolean'); }
    return [time, { ...pose }, how];
  });
}
function poseState(track, time, side) {
  // Compare temporal limits at an exact key/12 Hz drawing boundary. The old
  // poseAt epsilon is intentionally replaced by an ULP-sized boundary check.
  let index = track.findIndex((k, i) => i < track.length - 1 && (time < track[i + 1][0] && !near(time, track[i + 1][0]) || near(time, track[i + 1][0]) && side === 'left'));
  if (time < track[0][0] || near(time, track[0][0]) && side === 'left') index = -1;
  if (index < 0) return { pose: { ...STAND, x: 0, y: 0, ...(time <= track[0][0] ? track[0][1] : track.at(-1)[1]) }, velocity: [0, 0] };
  const [t0, a] = track[index], [t1, b, how] = track[index + 1], span = t1 - t0;
  if (how === 'snap') return { pose: { ...STAND, x: 0, y: 0, ...a }, velocity: [0, 0] };
  const tick = (time - t0) * 12, rounded = Math.round(tick), exact = near(tick, rounded);
  const cell = exact ? rounded - (side === 'left' && rounded > 0 ? 1 : 0) : Math.floor(tick);
  const held = Math.max(0, Math.min(1, cell / 12 / span)), u = Math.max(0, Math.min(1, (time - t0) / span));
  const p = lerpPose(a, b, ease(held, how)[0]), [e, d] = ease(u, how);
  p.x = (a.x ?? 0) + ((b.x ?? 0) - (a.x ?? 0)) * e; p.y = (a.y ?? 0) + ((b.y ?? 0) - (a.y ?? 0)) * e;
  return { pose: p, velocity: ['x', 'y'].map(k => ((b[k] ?? 0) - (a[k] ?? 0)) * d / span) };
}

export function create({ id, clock: timing, poses, source = motion.source(), scale = 1, flipX = false, bounds = null, end = null } = {}) {
  const c = requireClock(timing), track = trackOf(poses); positive(scale, 'action.scale');
  if (source?.kind !== 'SourceTrajectory' || source.space !== 'effect' || typeof source.sample !== 'function') fail('action.source', 'expected an effect-space source sampled in local action seconds');
  if (typeof flipX !== 'boolean') fail('action.flipX', 'expected boolean');
  const sign = flipX ? -1 : 1, cache = new Map();
  const stateAt = (playback, side = 'right') => {
    sideOf(side); const key = `${playback}:${side}`; if (cache.has(key)) return cache.get(key);
    const time = c.sample(playback, { side }), p = poseState(track, time.local, time.poseSide);
    const lt = c.sample(playback, { side: 'left' }), rt = c.sample(playback, { side: 'right' });
    const left = poseState(track, lt.local, lt.poseSide).pose, right = poseState(track, rt.local, rt.poseSide).pose;
    const changed = [...new Set([...Object.keys(left), ...Object.keys(right)])].filter(k => typeof left[k] === 'number' && typeof right[k] === 'number' ? !near(left[k], right[k]) : left[k] !== right[k]);
    const jump = changed;
    if (side === 'error' && jump.length) fail('action.pose', 'held drawing or snap key has no crossing derivative', 'CONTRACT_MISMATCH', 'Choose side:left/right. Limbs are held drawings with zero between-step local velocity; a pose jump is not a finite launch speed.');
    const skel = skeleton(p.pose); for (const v of Object.values(skel.joints)) v.forEach(n => finite(n, 'action.joints'));
    const result = { ...p, time, skeleton: skel, jump }; if (cache.size >= 32) cache.clear(); cache.set(key, result); return result;
  };
  const root = { kind: 'SourceTrajectory', space: 'effect', sample(playback, { side = 'right' } = {}) {
    const s = stateAt(playback, side), t = s.time, q = source.sample(t.local, { side: t.poseSide }), angle = q.rotation, cs = Math.cos(angle), sn = Math.sin(angle);
    const xy = [(s.pose.x ?? 0) * scale * sign, (s.pose.y ?? 0) * scale], v = [s.velocity[0] * scale * sign * t.localRate, s.velocity[1] * scale * t.localRate];
    const offset = [xy[0] * cs - xy[1] * sn, xy[0] * sn + xy[1] * cs], w = q.angularVelocity * t.localRate;
    return { position: q.position.map((n, i) => n + offset[i]), velocity: [q.velocity[0] * t.localRate + v[0] * cs - v[1] * sn - w * offset[1], q.velocity[1] * t.localRate + v[0] * sn + v[1] * cs + w * offset[0]], rotation: angle, angularVelocity: w, space: 'effect',
      derivative: { method: 'action-clock-chain-rule', clock: t, source: q.derivative, poseJump: [...s.jump], limbVelocity: 'zero-between-held-drawings' } };
  } };
  const jointNames = Object.keys(skeleton(STAND).joints), anchors = Object.fromEntries(jointNames.map(name => [name, [0, 1].map(axis => ({ kind: 'ScalarSignal', input: 'scene.seconds', at(t, { side = 'right' } = {}) { const s = stateAt(t, side); return { value: s.skeleton.joints[name][axis], derivative: 0, discontinuity: s.jump.length ? 'held-pose-jump' : null }; } }))]));
  const subject = body.create({ id, source: root, scale, flipX, anchors, bounds, end, data: (t, b) => { const s = stateAt(t, b.derivative.side); return { clock: s.time, pose: s.pose, joints: s.skeleton.joints, poseJump: s.jump }; } });
  return { kind: 'Action', id, clock: c, body: subject };
}

export function sample(value, playback, options) { return body.sample(requireAction(value).body, playback, options); }
export function observe(value, playback) { return body.observe(requireAction(value).body, playback); }

/** Offset is in actor-local axes; toward selects a projected joint direction.
 * Reflection changes both the position and facing, once. */
export function anchor(value, { joint = 'handN', offset = [0, 0], toward, rotation = 0 } = {}) {
  const a = requireAction(value); point(offset, 'action.anchor.offset'); finite(rotation, 'action.anchor.rotation');
  const names = Object.keys(skeleton(STAND).joints);
  if (!names.includes(joint) || toward !== undefined && !names.includes(toward)) fail('action.anchor.joint', `expected one of ${names.join(', ')}`, 'RESOURCE_NOT_FOUND');
  return { kind: 'SourceTrajectory', space: 'effect', sample(t, options = {}) {
    const s = sample(a, t, options), p = s.anchors[joint], m = s.matrix, dm = s.matrixVelocity;
    let direction = [m[0], m[1]];
    if (toward !== undefined) direction = s.anchors[toward].position.map((v, i) => v - p.position[i]);
    if (Math.hypot(...direction) < 1e-10) fail('action.anchor.toward', 'projected direction is zero; choose another joint or omit toward');
    return { position: [p.position[0] + m[0] * offset[0] + m[2] * offset[1], p.position[1] + m[1] * offset[0] + m[3] * offset[1]], velocity: [p.velocity[0] + dm[0] * offset[0] + dm[2] * offset[1], p.velocity[1] + dm[1] * offset[0] + dm[3] * offset[1]], rotation: Math.atan2(direction[1], direction[0]) + rotation, angularVelocity: s.angularVelocity, space: 'effect',
      derivative: { method: 'held-rig-anchor', body: s.derivative, attachment: { action: a.id, joint, toward: toward ?? null }, poseJump: s.data.poseJump, limbVelocity: 'zero-between-held-drawings' } };
  } };
}

/** A custom renderer gets the very same pose/joints/time as attachments.
 * Omit draw to reuse the stock shaded rig; palette/shape remain replaceable. */
export function draw(painter, value, playback, { draw: render } = {}) {
  const a = requireAction(value);
  if (render !== undefined && typeof render !== 'function') fail('action.draw.draw', 'expected draw(localPainter,state)');
  return body.draw(painter, a.body, playback, { draw(p, state) {
    if (render) return render(p, state);
    const pixels = posed(state.data.pose);
    for (let i = 0; i < pixels.n; i++) p.rect(pixels.xs[i], pixels.ys[i], 1, 1, pixels.color[i]);
  } });
}
