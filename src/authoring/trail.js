// Generalizes core/shapes.trail's past-time queries, arcane-missiles' retained
// history/post-hit fade, and path.strip's continuous nearest-centerline paint.
// arcane-missiles adapts Sprite Fusion energy bolt, MIT, (c) 2026 Hugo Duprez.
// No velocity-streak extrapolation or frame-dependent ring buffer is used.
import { finite, positive, point, count, choice, fail, color, alpha } from './contract.js';
import { track as particleTrack } from './particle.js';
import { stroke } from './strip.js';
const clone = (x) => JSON.parse(JSON.stringify(x));
const stringId = (x, path) => { if (typeof x !== 'string' || !x) fail(path, 'expected a stable nonempty string ID'); return x; };

export function history(track, { id = track?.id, length = { seconds: .4 }, stepSeconds = 1 / 120, death = { mode: 'fade', seconds: .2 }, maxSamples = 2048 } = {}) {
  stringId(id, 'trail.id');
  if (!track || typeof track.sample !== 'function') fail('trail.track', 'expected {sample(time),born,end,space?}');
  finite(track.born, 'trail.track.born'); finite(track.end, 'trail.track.end');
  if (track.end < track.born || track.end - track.born > 12) fail('trail.track.end', 'expected a closed track of 0..12 seconds');
  if ((track.space ?? 'effect') !== 'effect') fail('trail.track.space', 'history requires effect coordinates; convert explicitly', 'CAPABILITY_UNSUPPORTED');
  const keys = Object.keys(length ?? {}); if (keys.length !== 1 || !['seconds', 'pixels'].includes(keys[0])) fail('trail.length', 'choose exactly one of {seconds} or {pixels}');
  const mode = keys[0]; positive(length[mode], `trail.length.${mode}`); positive(stepSeconds, 'trail.stepSeconds');
  if (track.born + stepSeconds === track.born) fail('trail.stepSeconds', 'step is not representable at this birth time');
  count(maxSamples, 'trail.maxSamples', 4096); if (maxSamples < 2) fail('trail.maxSamples', 'expected 2..4096');
  choice(death?.mode, ['fade', 'shrink', 'clear'], 'trail.death.mode');
  if (death.mode === 'fade') positive(death.seconds, 'trail.death.seconds');
  if (mode === 'pixels' && death.mode === 'shrink') fail('trail.death.mode', 'pixel-length history requires fade or clear after death', 'CAPABILITY_UNSUPPORTED', 'Use a time-length shrink window, or freeze pixel-length geometry and fade it explicitly.');
  const knots = (track.knots ?? []).map((k) => {
    finite(k.time, 'trail.knot.time'); choice(k.kind, ['corner', 'break'], 'trail.knot.kind');
    if (k.time < track.born || k.time > track.end) fail('trail.knot.time', 'outside the track interval'); return { ...k };
  }).sort((a, b) => a.time - b.time);
  const config = { id, born: track.born, end: track.end, space: 'effect', parent: clone(track.parent ?? null), positionMode: track.positionMode ?? 'custom', length: { ...length }, stepSeconds, death: { ...death }, maxSamples, knots };
  return { kind: 'HistoryTrail', id, config, track };
}

export function emitter(system, { id = system?.id, position = 'render', ends = {}, ...options } = {}) {
  if (system?.kind !== 'Emitter') fail('trail.emitter', 'expected particle.emitter()'); stringId(id, 'trail.id');
  count(system.births.length, 'trail.emitter.tracks', 256);
  const tracks = system.births.map((b) => history(particleTrack(system, b.id, { position, ...(ends[b.id] === undefined ? {} : { end: ends[b.id] }) }), { ...options, id: `${id}:${JSON.stringify([system.id, b.id])}` }));
  return { kind: 'TrailSet', id, tracks };
}
const members = (value) => {
  if (value?.kind === 'HistoryTrail') return [value];
  if (value?.kind === 'TrailSet') return value.tracks;
  fail('trail', 'expected trail.history() or trail.emitter()');
};
function interpolate(a, b, u) {
  const lerp = (x, y) => x + (y - x) * u;
  const result = { ...b, time: lerp(a.time, b.time), simulationTime: lerp(a.simulationTime, b.simulationTime), position: a.position.map((x, i) => lerp(x, b.position[i])), interpolated: true, source: 'polyline-trim', breakBefore: true };
  delete result.velocity;
  if (a.velocity && b.velocity) result.velocity = a.velocity.map((x, i) => lerp(x, b.velocity[i]));
  return result;
}
function one(history, time, budget) {
  const c = history.config, { born, end, stepSeconds, length, death } = c;
  const state = { id: c.id, parent: c.parent, space: c.space, positionMode: c.positionMode, phase: 'pending', opacity: 0, points: [], lengthPx: 0, sampleCount: 0, window: null };
  if (time < born) return state;
  const expire = death.mode === 'clear' ? end : end + (death.mode === 'fade' ? death.seconds : length.seconds);
  if (time >= expire) return { ...state, phase: 'expired' };
  const head = Math.min(time, end), from = length.seconds !== undefined ? Math.max(born, (death.mode === 'shrink' ? time : head) - length.seconds) : born;
  if (from > head) return { ...state, phase: 'expired' };
  const times = new Map([[from, 'boundary'], [head, 'boundary']]);
  const first = Math.max(0, Math.ceil((from - born) / stepSeconds)), last = Math.floor((head - born) / stepSeconds);
  if (last - first + 1 > c.maxSamples) fail('trail.sample', 'fixed temporal grid exceeds maxSamples', 'BUDGET_EXCEEDED', 'Increase the explicit budget, shorten the time window, or choose a coarser stepSeconds; no automatic decimation occurs.');
  for (let k = first; k <= last; k++) { const t = born + k * stepSeconds; if (t >= from && t <= head && !times.has(t)) times.set(t, 'grid'); }
  for (const knot of c.knots) if (knot.time >= from && knot.time <= head && times.get(knot.time) !== 'break') times.set(knot.time, knot.kind);
  count(times.size, 'trail.sample', c.maxSamples); budget.samples += times.size;
  count(budget.samples, 'trail.sample.total', 20000);
  let points = [], gap = true;
  for (const [t, source] of [...times].sort((a, b) => a[0] - b[0])) {
    const q = history.track.sample(t);
    if (q === null) { gap = true; continue; }
    if (!q || typeof q !== 'object') fail('trail.track.sample', 'expected {position,simulationTime?,velocity?} or null for a gap');
    point(q.position, 'trail.track.position'); if (q.velocity !== undefined) point(q.velocity, 'trail.track.velocity');
    const simulationTime = q.simulationTime ?? t; finite(simulationTime, 'trail.track.simulationTime');
    points.push({ time: t, simulationTime, position: [...q.position], ...(q.velocity ? { velocity: [...q.velocity] } : {}), source, interpolated: false, breakBefore: gap || source === 'break' || q.breakBefore === true }); gap = false;
  }
  if (length.pixels !== undefined) {
    let distance = 0;
    for (let i = points.length - 1; i > 0; i--) {
      const a = points[i - 1], b = points[i]; if (b.breakBefore) continue;
      const d = Math.hypot(b.position[0] - a.position[0], b.position[1] - a.position[1]);
      if (d > 0 && distance + d >= length.pixels) {
        const u = Math.max(0, Math.min(1, 1 - (length.pixels - distance) / d));
        points = u === 0 ? points.slice(i - 1) : u === 1 ? points.slice(i) : [interpolate(a, b, u), ...points.slice(i)];
        break;
      }
      distance += d;
    }
  }
  let lengthPx = 0;
  points = points.map((p, i) => { if (i && !p.breakBefore) lengthPx += Math.hypot(p.position[0] - points[i - 1].position[0], p.position[1] - points[i - 1].position[1]); return { ...p, distancePx: lengthPx }; });
  const span = (points.at(-1)?.time ?? head) - (points[0]?.time ?? head);
  points = points.map((p) => ({ ...p, s: lengthPx ? p.distancePx / lengthPx : 0, time01: span ? (p.time - points[0].time) / span : 0, ageSeconds: time - p.time, historyAge: head - p.time }));
  budget.points += points.length; count(budget.points, 'trail.sample.points', 10000);
  return { ...state, phase: time < end ? 'alive' : 'fading', opacity: time < end || death.mode !== 'fade' ? 1 : Math.max(0, 1 - (time - end) / death.seconds),
    points, lengthPx, sampleCount: times.size, window: { from: points[0]?.time ?? from, to: head, sampledFrom: from }, sampling: { stepSeconds, anchor: born, cornerTimesIncluded: true, representation: 'fixed-time sampled polyline; no spatial error guarantee' } };
}
export function sample(value, time, { tracks } = {}) {
  finite(time, 'trail.time'); const all = members(value), ids = new Set(all.map((h) => h.id));
  for (const id of tracks ?? []) if (!ids.has(id)) fail('trail.tracks', `unknown trail '${id}'`, 'RESOURCE_NOT_FOUND');
  const selected = all.filter((h) => !tracks || tracks.includes(h.id)), budget = { samples: 0, points: 0 };
  return { kind: 'TrailFrame', id: value.id, time, trails: selected.map((h) => one(h, time, budget)), evaluationCount: budget.samples, pointCount: budget.points };
}
function context(a, b, u, state) {
  const mix = (key) => a[key] + (b[key] - a[key]) * u;
  return { id: state.id, parent: state.parent, position: a.position.map((x, i) => x + (b.position[i] - x) * u), time: mix('time'), s: mix('s'), time01: mix('time01'), ageSeconds: mix('ageSeconds'), historyAge: mix('historyAge'), distancePx: mix('distancePx') };
}
export function draw(p, value, time, { width = 2, color: paint = '#fff', alpha: opacity = 1, filter } = {}) {
  const frame = value?.kind === 'TrailFrame' ? value : sample(value, time);
  const results = [];
  for (const state of frame.trails) {
    if (!state.points.length || state.opacity <= 0 || (filter && !filter(state))) continue;
    results.push(stroke(p, state.points, { newest: true, width: (q) => typeof width === 'function' ? width({ ...q, id: state.id, parent: state.parent }) : width,
      shade: ({ a, b, u, across }, out) => { const q = context(a, b, u, state); out.c = color(typeof paint === 'function' ? paint(q, across) : paint, 'trail.draw.color'); out.a = state.opacity * alpha(typeof opacity === 'function' ? opacity(q, across) : opacity, 'trail.draw.alpha'); } }));
  }
  return { frame, drawing: results };
}
export function observe(value, time, options) {
  const frame = sample(value, time, options), selected = new Set(frame.trails.map((t) => t.id));
  return { kind: 'TrailObservation', id: value.id, tracks: members(value).filter((h) => selected.has(h.id)).map((h) => clone(h.config)), states: frame.trails };
}
