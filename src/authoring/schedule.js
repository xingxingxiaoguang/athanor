import { identity, finite, positive, count, fail } from './contract.js';
import { unit } from './random.js';

export function burst({ id, at, count: n, spread = 0 }) {
  identity(id, 'schedule.id'); finite(at, 'schedule.at'); positive(spread, 'schedule.spread', true); count(n, 'schedule.count');
  return Array.from({ length: n }, (_, index) => ({ id: `${id}/${index}`, index, born: at + (n > 1 ? spread * index / (n - 1) : 0) }));
}
export function rate({ id, start, end, rate }) {
  identity(id, 'schedule.id'); finite(start, 'schedule.start'); finite(end, 'schedule.end'); positive(rate, 'schedule.rate');
  if (end < start) fail('schedule.interval', 'end must be >= start');
  const n = Math.ceil((end - start) * rate - 1e-9); count(Math.max(0, n), 'schedule.count');
  return Array.from({ length: Math.max(0, n) }, (_, index) => ({ id: `${id}/${index}`, index, born: start + index / rate }));
}
export function alive(births, time, { life }) {
  finite(time, 'schedule.time'); if (!Array.isArray(births)) fail('schedule.births', 'expected birth records');
  return births.flatMap((birth) => {
    const lifetime = positive(typeof life === 'function' ? life(birth) : life, 'schedule.life'), age = time - finite(birth.born, 'schedule.birth.born');
    return age >= 0 && age < lifetime ? [{ ...birth, age, life: lifetime, age01: age / lifetime }] : [];
  });
}

// Materialize the overlapping live copies used by core/particles.cycle and
// fire/_lib.looped, with distinct copy IDs and repeatable per-slot attributes.
export function cycle({ id, period, count: n, seed = 1, start = 0, end, lifeMax }) {
  identity(id, 'schedule.id'); positive(period, 'schedule.period'); count(n, 'schedule.count');
  finite(start, 'schedule.start'); finite(end, 'schedule.end'); positive(lifeMax, 'schedule.lifeMax');
  if (end < start) fail('schedule.interval', 'end must be >= start');
  const births = [];
  for (let index = 0; index < n; index++) {
    const randomId = `${id}/${index}`, phase = unit({ seed, layer: id, id: index, channel: 'phase' }) * period;
    const first = Math.floor((start - lifeMax - phase) / period) + 1, last = Math.ceil((end - phase) / period) - 1;
    count(births.length + Math.max(0, last - first + 1), 'schedule.births');
    for (let copy = first; copy <= last; copy++) births.push({ id: `${id}/${index}/copy/${copy}`, randomId, index, copy, born: phase + copy * period, lifeMax });
  }
  return births.sort((a, b) => a.born - b.born || a.index - b.index);
}

export function resident({ id, start, end, count: n }) {
  finite(start, 'schedule.start'); finite(end, 'schedule.end'); positive(end - start, 'schedule.resident.life');
  return burst({ id, at: start, count: n }).map((birth) => ({ ...birth, life: end - start }));
}

/** Join immutable start/end birth tables without rebuilding a life map in
 * every artwork. Generalizes resident's end-start and ice/endBy's cutoff. */
export function until(births, ends, { match = b => b.id, offset = 0 } = {}) {
  if (!Array.isArray(births) || !Array.isArray(ends)) fail('schedule.until', 'expected start and end birth arrays');
  count(births.length, 'schedule.until.births'); count(ends.length, 'schedule.until.ends'); finite(offset, 'schedule.until.offset');
  if (typeof match !== 'function') fail('schedule.until.match', 'expected a pure common-identity callback');
  const stops = new Map(), token = b => JSON.stringify(identity(match(b), 'schedule.until.match.output'));
  for (const e of ends) {
    const id = token(e); if (stops.has(id)) fail('schedule.until.ends', 'duplicate end match; choose one end per identity explicitly');
    stops.set(id, finite(e.born, 'schedule.until.end.born'));
  }
  const ids = new Set();
  return births.map(b => {
    identity(b.id, 'schedule.until.birth.id'); if (ids.has(JSON.stringify(b.id))) fail('schedule.until.birth.id', 'duplicate birth identity'); ids.add(JSON.stringify(b.id));
    const id = token(b); if (!stops.has(id)) fail('schedule.until.match', `no end for ${id}`, 'RESOURCE_NOT_FOUND', 'Provide a matching end birth, or explicitly filter unmatched starts. No lifetime is silently guessed.');
    const end = finite(stops.get(id) + offset, 'schedule.until.end'), life = positive(end - finite(b.born, 'schedule.until.birth.born'), 'schedule.until.life');
    return { ...b, end, life };
  });
}
