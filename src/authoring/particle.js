// Generalizes core/particles (birth/age/analytic motion), fire/_lib (source at
// birth, independent cooling/shape, phase transitions), and arcane/_lib
// (velocity-facing marks). Reference platform mechanisms are compared in the
// implementation map; its editor/config format is deliberately not required.
import { identity, finite, positive, point, choice, color, alpha, count, fail } from './contract.js';
import * as random from './random.js';
import * as domain from './domain.js';
import * as motion from './motion.js';
import * as texture from './texture.js';

function number(spec, context, channel, fallback) {
  if (spec === undefined) return fallback;
  let value = spec;
  if (typeof spec === 'function') value = spec(context);
  else if (Array.isArray(spec)) {
    point(spec, `particle.initial.${channel}`);
    if (spec[1] < spec[0]) fail(`particle.initial.${channel}`, 'range must be [min,max]');
    value = context.rand(channel, spec[0], spec[1]);
  }
  return finite(value, `particle.initial.${channel}`);
}
function transformAt(transform, time) {
  const value = typeof transform === 'function' ? transform(time) : transform ?? {};
  const { position = [0, 0], rotation = 0, velocity = [0, 0] } = value;
  point(position, 'particle.transform.position'); finite(rotation, 'particle.transform.rotation'); point(velocity, 'particle.transform.velocity');
  return { position: [...position], rotation, velocity: [...velocity] };
}
function rotate(v, angle) { const c = Math.cos(angle), s = Math.sin(angle); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; }
function directionOf(config, place, context) {
  if (typeof config === 'function') { const q = config({ ...context, ...place }); point(q, 'particle.direction'); const n = Math.hypot(...q); if (!n) fail('particle.direction', 'direction cannot be zero'); return q.map((v) => v / n); }
  const { mode = 'angle', angle = mode === 'angle' ? -Math.PI / 2 : 0, spread = 0, center = [0, 0] } = config ?? {};
  choice(mode, ['angle', 'outward', 'inward', 'normal', 'tangent'], 'particle.direction.mode'); positive(spread, 'particle.direction.spread', true); finite(angle, 'particle.direction.angle'); point(center, 'particle.direction.center');
  let base;
  if (mode === 'angle') base = angle;
  else if (mode === 'normal' || mode === 'tangent') {
    if (!place[mode]) fail('particle.direction', `${mode} is unavailable on this birth domain/measure; choose a direction callback or a supported boundary`, 'CAPABILITY_UNSUPPORTED');
    base = Math.atan2(place[mode][1], place[mode][0]) + angle;
  } else {
    const dx = place.position[0] - center[0], dy = place.position[1] - center[1];
    if (Math.hypot(dx, dy) < 1e-9) fail('particle.direction', 'radial direction is undefined at center; provide an angle or callback');
    base = Math.atan2(dy, dx) + (mode === 'inward' ? Math.PI : 0) + angle;
  }
  const a = base + context.rand('direction', -spread / 2, spread / 2);
  return [Math.cos(a), Math.sin(a)];
}

export function emitter({ id, births, seed = 1, domain: region, measure = 'area', direction, transform, inheritVelocity = 0, initial = {}, textures, motion: movement = {}, material = {} }) {
  if (typeof id !== 'string' || !id) fail('particle.id', 'expected a nonempty string group ID');
  finite(seed, 'particle.seed');
  if (!movement || !material || typeof movement !== 'object' || typeof material !== 'object') fail('particle', 'motion and material must be objects');
  if (movement.forces && (!Array.isArray(movement.forces) || movement.forces.some((f) => typeof f !== 'function'))) fail('particle.motion.forces', 'expected pure force callbacks');
  for (const name of ['kill', 'offset', 'trajectory']) if (movement[name] !== undefined && typeof movement[name] !== 'function') fail(`particle.motion.${name}`, 'expected a pure callback');
  if (textures !== undefined && !Array.isArray(textures)) fail('particle.textures', 'expected weighted texture entries');
  if (!Array.isArray(births)) fail('particle.births', 'expected birth records from schedule or image.dissolveEvents');
  count(births.length, 'particle.births');
  const ids = new Set(); births.forEach((b) => { if (typeof b.id !== 'string' || !b.id) fail('particle.birth.id', 'expected a nonempty string birth ID'); finite(b.born, 'particle.birth.born'); if (ids.has(b.id)) fail('particle.birth.id', 'duplicate birth identity'); ids.add(b.id); });
  const randomIds = [...new Set(births.filter((b) => !b.position).map((b) => b.randomId ?? b.id))];
  const places = region ? domain.sample({ domain: region, measure, seed, count: randomIds.length, ids: randomIds, channel: `emitter/${id}/position` }) : null;
  const byId = places ? new Map(randomIds.map((key, index) => [key, places[index]])) : null;
  let totalWeight = 0;
  const resources = textures?.map(({ texture: resource, weight = 1 }) => {
    texture.frame(resource); positive(weight, 'particle.textures.weight'); totalWeight += weight;
    return { resource, until: totalWeight };
  });
  if (resources && !resources.length) fail('particle.textures', 'weighted resource list cannot be empty');
  finite(totalWeight, 'particle.textures.totalWeight');
  const records = births.map((birth, index) => {
    const key = { seed, layer: id, id: birth.randomId ?? birth.id }, rand = (channel, min = 0, max = 1) => random.range({ ...key, channel }, min, max);
    const place = birth.position ? { position: point(birth.position, 'particle.birth.position'), normal: birth.normal, tangent: birth.tangent } : byId?.get(birth.randomId ?? birth.id) ?? { position: [0, 0] };
    const source = transformAt(transform, birth.born);
    const context = { birth, index, rand, seed, data: null, ...place, source };
    const attrs = typeof initial === 'function' ? initial(context) : initial;
    if (!attrs || typeof attrs !== 'object') fail('particle.initial', 'expected an attribute object or callback returning one');
    context.data = typeof attrs.data === 'function' ? attrs.data(context) : attrs.data ?? null;
    const offset = rotate(place.position, source.rotation);
    const life = positive(number(attrs.life, context, 'life', birth.life ?? 1), 'particle.initial.life');
    if (birth.lifeMax !== undefined && life > birth.lifeMax) fail('particle.initial.life', 'exceeds schedule.cycle lifeMax; increase the explicit overlap window');
    let velocity;
    if (attrs.velocity !== undefined) velocity = point(typeof attrs.velocity === 'function' ? attrs.velocity(context) : attrs.velocity, 'particle.initial.velocity');
    else {
      const speed = number(attrs.speed, context, 'speed', 0), unit = speed === 0 ? [0, 0] : directionOf(direction, place, context);
      velocity = unit.map((v) => v * speed);
    }
    velocity = rotate(velocity, source.rotation);
    const inheritance = number(inheritVelocity, context, 'inheritVelocity', 0);
    velocity = velocity.map((v, i) => v + source.velocity[i] * inheritance);
    const scale = number(attrs.scale, context, 'scale', 1), scaleY = number(attrs.scaleY, context, 'scaleY', 1), opacity = alpha(number(attrs.opacity, context, 'opacity', 1), 'particle.initial.opacity');
    const resource = resources?.find((r) => rand('texture', 0, totalWeight) < r.until)?.resource ?? material.texture ?? null;
    const frameOffset = number(attrs.frameOffset, context, 'frameOffset', 0);
    if (!Number.isInteger(frameOffset)) fail('particle.initial.frameOffset', 'use an integer or callback returning an integer frame offset');
    return { ...birth, index: birth.index ?? index, position: offset.map((v, i) => v + source.position[i]), velocity, life, scale, scaleY, opacity,
      rotation: number(attrs.rotation, context, 'rotation', 0) + source.rotation, spin: number(attrs.spin, context, 'spin', 0), frameOffset,
      data: context.data, resource, emitterPosition: source.position, space: region?.space ?? birth.space ?? 'effect' };
  });
  return { kind: 'Emitter', id, seed, births: records, movement, material };
}

function value(spec, state, fallback) {
  if (spec === undefined) return fallback;
  if (typeof spec === 'function') return spec(state);
  if (spec?.kind === 'ScalarCurve' || spec?.kind === 'ColorCurve') {
    if (spec.input === 'path.s') fail('particle.material.curve', 'path.s has no implicit mapping to particle age; use a callback');
    return spec.sample(spec.input === 'particle.age01' ? state.age01 : state.time);
  }
  return spec;
}
function stateAt(system, birth, time) {
  const age = time - birth.born;
  if (age < 0) return { id: birth.id, status: 'pending', born: birth.born, life: birth.life };
  if (age >= birth.life) return { id: birth.id, status: 'expired', born: birth.born, life: birth.life };
  const { movement: m, material: mat } = system, base = { id: birth.id, index: birth.index, born: birth.born, life: birth.life, age, age01: age / birth.life, time, birth, data: birth.data };
  let q;
  if (m.trajectory) {
    q = m.trajectory(base); point(q.position, 'particle.motion.trajectory.position'); point(q.velocity, 'particle.motion.trajectory.velocity');
    q = { ...q, alive: q.alive ?? true, simulationAge: age };
  } else if ((m.forces?.length ?? 0) || m.kill) q = motion.integrate({ ...birth, age, acceleration: m.acceleration, drag: m.drag, forces: m.forces, kill: m.kill, birth });
  else q = { ...motion.ballistic({ ...birth, age, acceleration: m.acceleration, drag: m.drag }), alive: true, simulationAge: age };
  if (!q.alive) return { id: birth.id, status: 'killed', born: birth.born, life: birth.life, killedAge: q.killedAge ?? q.simulationAge, position: q.position, velocity: q.velocity };
  const offset = m.offset ? m.offset({ ...base, ...q }) : [0, 0]; point(offset, 'particle.motion.offset');
  const state = { ...base, status: 'alive', position: q.position.map((v, i) => v + offset[i]), basePosition: q.position, velocity: q.velocity, simulationAge: q.simulationAge, offset };
  state.scale = [birth.scale * finite(value(mat.scale, state, 1), 'particle.material.scale'), birth.scale * birth.scaleY * finite(value(mat.scaleY ?? mat.scale, state, 1), 'particle.material.scaleY')];
  state.rotation = birth.rotation + birth.spin * age + finite(value(mat.rotation, state, 0), 'particle.material.rotation');
  if (mat.alignVelocity) state.rotation += Math.atan2(q.velocity[1], q.velocity[0]);
  state.opacity = alpha(birth.opacity * finite(value(mat.opacity, state, 1), 'particle.material.opacity'), 'particle.opacity');
  state.tint = color(value(mat.tint, state, '#fff'), 'particle.material.tint');
  state.blend = choice(value(mat.blend, state, 'dither'), ['dither', 'soft', 'additive'], 'particle.material.blend');
  state.tintMode = choice(mat.tintMode ?? 'multiply', ['multiply', 'replace'], 'particle.material.tintMode');
  const resource = typeof mat.texture === 'function' ? mat.texture(state) : birth.resource;
  const selected = resource ? texture.frame(resource, { ...state, frameOffset: birth.frameOffset }) : null;
  state.sprite = selected?.texture ?? null;
  state.texture = selected ? { id: resource.id, frameId: selected.texture.id, index: selected.index, size: [selected.texture.w, selected.texture.h], pivot: selected.texture.pivot } : null;
  return state;
}

export function sample(system, time, { includeInactive = false } = {}) {
  if (system?.kind !== 'Emitter') fail('particle', 'expected emitter() result'); finite(time, 'particle.time');
  const states = system.births.map((birth) => stateAt(system, birth, time));
  return includeInactive ? states : states.filter((s) => s.status === 'alive');
}

export function draw(p, system, time, { draw: custom, filter } = {}) {
  const states = sample(system, time);
  for (const s of states) {
    if (filter && !filter(s)) continue;
    if (custom) custom(p, s);
    else {
      if (!s.sprite) fail('particle.draw.texture', 'provide material.texture, weighted textures, or a custom draw(p,state) callback');
      texture.draw(p, s.sprite, s);
    }
  }
  return states;
}

export function observe(system, time) {
  return { kind: 'ParticleObservation', id: system.id,
    births: system.births.map(({ resource, ...birth }) => ({ ...birth, textureId: typeof resource === 'function' ? null : resource?.id ?? null })),
    states: sample(system, time, { includeInactive: true }).map(({ sprite, birth, ...state }) => state),
  };
}
