// Generalizes fire/_lib.sparkAt's analytic flight + bracketed floor crossing
// and core/sim's SPARK/GRIT/BRAND/Bits bounce, settle and landing responses.
// core/sim is adapted from Sprite Fusion's open-source pixel art VFX,
// MIT License, Copyright (c) 2026 Hugo Duprez (https://www.spritefusion.com/pixel-art-vfx).
// Legacy implementations and their attribution are retained unchanged.
import { ballistic } from './motion.js';
import { identity, finite, positive, point, choice, count, fail } from './contract.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') return JSON.stringify(finite(value, 'contact.data'));
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && Object.getPrototypeOf(value) === Object.prototype) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  fail('contact.data', 'events/data must contain only finite plain JSON values');
}

export function floor({ id = 'floor', y = 0, response = 'bounce', restitution = .45, tangentRetention = .7, settleSpeed = 3, maxEvents = 32, timeTolerance = 1e-8 } = {}) {
  identity(id, 'contact.floor.id'); finite(y, 'contact.floor.y'); choice(response, ['bounce', 'stop', 'kill'], 'contact.floor.response');
  positive(restitution, 'contact.floor.restitution', true); finite(tangentRetention, 'contact.floor.tangentRetention'); positive(settleSpeed, 'contact.floor.settleSpeed', true);
  count(maxEvents, 'contact.floor.maxEvents', 64); if (!maxEvents) fail('contact.floor.maxEvents', 'expected 1..64'); positive(timeTolerance, 'contact.floor.timeTolerance');
  return { kind: 'ContactFloor', id, y, response, restitution, tangentRetention, settleSpeed, maxEvents, timeTolerance };
}

// Vertical ballistic velocity has at most one turning time. Split there so a
// down/up excursion cannot tunnel through a floor merely because both ends
// lie above it. Each bracket uses the existing analytic ballistic kernel.
function arrival(position, velocity, acceleration, drag, duration, collider) {
  const verticalDrag = typeof drag === 'number' ? drag : drag[1], ay = acceleration[1], vy = velocity[1];
  const turn = vy * ay < 0 ? (verticalDrag ? Math.log1p(-verticalDrag * vy / ay) / verticalDrag : -vy / ay) : Infinity;
  const cuts = [0, ...(turn > 0 && turn < duration ? [turn] : []), duration];
  const evaluate = (age) => ballistic({ position, velocity, acceleration, drag, age });
  for (let i = 1; i < cuts.length; i++) {
    let lo = cuts[i - 1], hi = cuts[i];
    if (evaluate((lo + hi) / 2).velocity[1] <= 0 || evaluate(hi).position[1] < collider.y) continue;
    if (evaluate(lo).position[1] === collider.y) return { age: lo, bracket: [lo, lo] };
    for (let iteration = 0; iteration < 64; iteration++) {
      const mid = (lo + hi) / 2; if (mid === lo || mid === hi) break;
      if (evaluate(mid).position[1] < collider.y) lo = mid; else hi = mid;
    }
    if (hi - lo > collider.timeTolerance) fail('contact.trace.precision', 'contact time bracket exceeds the explicit tolerance', 'BUDGET_EXCEEDED', 'Use a representable timeTolerance; the solver never silently reduces precision.');
    return { age: hi, bracket: [lo, hi] };
  }
  return null;
}

export function trace({ position, velocity, acceleration = [0, 0], drag = 0, born = 0, life, floor: collider, layer = 'effect', particle: particleId = 'body', copy = null, randomId = particleId, data = null }) {
  if (collider?.kind !== 'ContactFloor') fail('contact.trace.floor', 'expected contact.floor()');
  identity(layer, 'contact.trace.layer'); identity(particleId, 'contact.trace.particle'); identity(randomId, 'contact.trace.randomId'); finite(born, 'contact.trace.born'); positive(life, 'contact.trace.life');
  if (life > 12) fail('contact.trace.life', 'contact tracks are limited to 12 seconds per particle', 'BUDGET_EXCEEDED');
  // Validate the same units/axis drag as ballistic, even if no collision occurs.
  ballistic({ position, velocity, acceleration, drag, age: 0 }); canonical(data);
  if (position[1] > collider.y) fail('contact.trace.position', 'birth starts below the floor', 'CONTRACT_MISMATCH', 'Place the birth at or above the declared floor. Initial penetration is not silently projected.');
  const segments = [{ at: 0, position: [...position], velocity: [...velocity], phase: 'flight' }], contacts = [];
  let cursor = 0, current = segments[0], killedAge = null;
  while (cursor < life) {
    const hit = arrival(current.position, current.velocity, acceleration, drag, life - cursor, collider);
    if (!hit) break;
    const age = cursor + hit.age;
    if (age >= life) break; // Death wins at the exact half-open lifetime boundary.
    if (contacts.length && age <= cursor) fail('contact.trace.time', 'successive contact times are indistinguishable', 'BUDGET_EXCEEDED', 'Increase settleSpeed or change the motion; no artificial pixel offset/time step is inserted.');
    if (contacts.length >= collider.maxEvents) fail('contact.trace.events', 'contact count exceeds maxEvents', 'BUDGET_EXCEEDED', 'Choose a larger explicit maxEvents (up to 64) or a resting threshold; events are never silently dropped.');
    const before = ballistic({ position: current.position, velocity: current.velocity, acceleration, drag, age: hit.age });
    point(before.position, 'contact.event.position'); point(before.velocity, 'contact.event.velocityBefore');
    let response = collider.response, after = response === 'kill' ? null : response === 'stop' ? [0, 0] : [before.velocity[0] * collider.tangentRetention, -Math.abs(before.velocity[1]) * collider.restitution];
    if (response === 'bounce' && Math.abs(after[1]) <= collider.settleSpeed) { response = 'settle'; after = [0, 0]; }
    if (after) point(after, 'contact.event.velocityAfter');
    const ordinal = contacts.length, position = [before.position[0], collider.y];
    const ageBracket = hit.bracket.map((t) => cursor + t);
    // Parent-age rounding can widen OR collapse the segment bracket. Retain
    // both widths so a collapsed pair does not claim an exact root.
    const timeErrorMax = Math.max(hit.bracket[1] - hit.bracket[0], ageBracket[1] - ageBracket[0]);
    if (timeErrorMax > collider.timeTolerance) fail('contact.trace.precision', 'parent-age contact bracket exceeds the explicit tolerance', 'BUDGET_EXCEEDED', 'Use a representable timeTolerance; segment offsets cannot silently widen the reported bracket.');
    const event = { id: `contact:${JSON.stringify([layer, particleId, collider.id, ordinal])}`, kind: 'contact', layer, particle: particleId, copy, randomId, collider: collider.id, ordinal,
      time: finite(born + age, 'contact.event.time'), age, position, normal: [0, -1], velocityBefore: before.velocity, velocityAfter: after, response, data: clone(data),
      precision: { method: 'analytic-ballistic-bracket', timeTolerance: collider.timeTolerance, ageBracket, timeErrorMax } };
    contacts.push(event); cursor = age;
    current = { at: age, position: [...position], velocity: after ?? before.velocity, phase: response === 'kill' ? 'killed' : response === 'stop' || response === 'settle' ? 'resting' : 'flight' };
    segments.push(current);
    if (current.phase !== 'flight') { if (current.phase === 'killed') killedAge = age; break; }
  }
  return { kind: 'ContactTrack', contactEvents: contacts, sample(age) {
    positive(age, 'contact.sample.age', true);
    const elapsed = Math.min(age, life); let segment = segments[0];
    for (const candidate of segments) { if (candidate.at > elapsed) break; segment = candidate; }
    const q = segment.phase === 'flight' ? ballistic({ position: segment.position, velocity: segment.velocity, acceleration, drag, age: elapsed - segment.at }) : { position: [...segment.position], velocity: [...segment.velocity] };
    point(q.position, 'contact.sample.position'); point(q.velocity, 'contact.sample.velocity');
    const occurred = contacts.filter((event) => event.age <= elapsed);
    return { ...q, alive: age < life && segment.phase !== 'killed', simulationAge: killedAge !== null && elapsed >= killedAge ? killedAge : elapsed, killedAge: killedAge !== null && elapsed >= killedAge ? killedAge : null,
      contact: { phase: age >= life ? 'expired' : segment.phase, count: occurred.length, lastEventId: occurred.at(-1)?.id ?? null } };
  } };
}

export function events(system, { from, to } = {}) {
  if (!['Emitter', 'ContactTrack'].includes(system?.kind) || !Array.isArray(system.contactEvents)) fail('contact.events.system', 'this object has no contact track', 'CAPABILITY_UNSUPPORTED', 'Use emitter motion.contact or contact.trace; hidden legacy callbacks do not imply stable events.');
  if (from !== undefined) finite(from, 'contact.events.from'); if (to !== undefined) finite(to, 'contact.events.to');
  if (from !== undefined && to !== undefined && from > to) fail('contact.events.interval', 'expected from <= to');
  return system.contactEvents.filter((event) => (from === undefined || event.time >= from) && (to === undefined || event.time < to)).map(clone);
}

export function births({ id, events: input, count: amount = 1, delay = 0, select = () => true }) {
  identity(id, 'contact.births.id'); positive(delay, 'contact.births.delay', true);
  if (!Array.isArray(input) || typeof select !== 'function') fail('contact.births.events', 'expected events array and a pure select callback');
  const unique = new Map(), result = [];
  for (const event of input) {
    if (typeof event?.id !== 'string' || !event.id || event.kind !== 'contact') fail('contact.births.event', 'expected complete stable contact events');
    identity(event.layer, 'contact.births.event.layer'); identity(event.particle, 'contact.births.event.particle'); identity(event.collider, 'contact.births.event.collider'); count(event.ordinal, 'contact.births.event.ordinal');
    const signature = canonical(event);
    if (unique.has(event.id)) { if (unique.get(event.id) !== signature) fail('contact.births.event.id', 'same event ID has conflicting payload'); continue; }
    unique.set(event.id, signature); finite(event.time, 'contact.births.event.time'); point(event.position, 'contact.births.event.position'); point(event.normal, 'contact.births.event.normal');
    if (!select(event)) continue;
    const n = typeof amount === 'function' ? amount(event) : amount; count(n, 'contact.births.count'); count(result.length + n, 'contact.births.total');
    for (let index = 0; index < n; index++) result.push({ id: `${id}:${JSON.stringify([event.id, index])}`, randomId: `${id}:${JSON.stringify([event.layer, event.randomId ?? event.particle, event.collider, event.ordinal, index])}`,
      index, born: event.time + delay, position: [...event.position], normal: [...event.normal], space: 'effect', copy: event.copy, parentEvent: event.id, parentParticle: event.particle, event: clone(event) });
  }
  return result.sort((a, b) => a.born - b.born || a.id.localeCompare(b.id));
}

export function observe(system) {
  const declared = events(system);
  if (system.kind !== 'Emitter') fail('contact.observe.system', 'declare an emitter so parent IDs are explicit even when no impact occurs');
  return { kind: 'ContactObservation', id: system.id, parents: system.births.map((b) => b.id), events: declared };
}
