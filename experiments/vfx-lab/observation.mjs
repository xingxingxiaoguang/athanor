import { LabError } from './errors.mjs';

export const PARTICLE_UNITS = { status: 'enum', position: 'effect pixels; includes visual offset', basePosition: 'effect pixels; before visual offset', velocity: 'pixels/second; physical, excludes visual offset derivative', age: 'seconds', age01: 'normalized lifetime', simulationAge: 'seconds; exact analytic or last complete 120 Hz force tick', opacity: 'coverage 0..1', scale: 'texture pixel multipliers [x,y]', rotation: 'radians', tint: 'Color32 integer; RGBA bytes, JS signed representation', blend: 'declared dither/soft/additive', tintMode: 'declared multiply/replace', texture: 'resource/frame identity, dimensions and pivot in pixels', offset: 'visual displacement pixels', data: 'author-defined JSON' };
export const PROBE_FIELDS = Object.keys(PARTICLE_UNITS);

const mismatch = (message) => { throw new LabError('CONTRACT_MISMATCH', `observe(): ${message}`, { recovery: 'Inspect core/particle for the optional observation protocol. Return finite JSON data and stable unique group/birth identities; leave unsupported internals undeclared.' }); };
function portable(value, path) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) { value.forEach((v, i) => portable(v, `${path}[${i}]`)); return; }
  if (value && Object.getPrototypeOf(value) === Object.prototype) { for (const [k, v] of Object.entries(value)) if (v !== undefined) portable(v, `${path}.${k}`); return; }
  mismatch(`${path} must be plain finite JSON data`);
}
export function normalizeObservation(input) {
  if (!input || !Array.isArray(input.particles) || Object.keys(input).some((k) => k !== 'particles')) mismatch('expected {particles:[particle.observe(emitter,time), ...]}; other observation kinds are not implemented yet');
  portable(input, 'observation');
  const groups = new Set();
  for (const group of input.particles) {
    if (group.kind !== 'ParticleObservation' || typeof group.id !== 'string' || !group.id || groups.has(group.id)) mismatch('particle groups need unique nonempty string IDs and kind ParticleObservation');
    groups.add(group.id);
    if (!Array.isArray(group.births) || !Array.isArray(group.states) || group.births.length > 10000 || group.states.length !== group.births.length) mismatch('each group needs <=10000 births and exactly one state per birth');
    const births = new Set();
    for (const birth of group.births) {
      if (typeof birth.id !== 'string' || !birth.id || births.has(birth.id) || !Number.isFinite(birth.born) || !(birth.life > 0)) mismatch('births need unique string IDs, finite born seconds and positive life');
      births.add(birth.id);
    }
    const states = new Set();
    for (const state of group.states) {
      if (!births.has(state.id) || states.has(state.id) || !['pending', 'alive', 'expired', 'killed'].includes(state.status)) mismatch('state identity/status does not match the birth table');
      states.add(state.id);
      if (state.status === 'alive' && (!Array.isArray(state.position) || state.position.length !== 2 || !state.position.every(Number.isFinite))) mismatch('alive states require a finite position [x,y]');
    }
  }
  return JSON.parse(JSON.stringify(input));
}

export function observationSeries(frames) {
  if (!frames.length || frames.every((f) => f.observation === undefined)) return null;
  const groups = frames[0].observation?.particles;
  if (!groups) mismatch('observer must be available at every saved time');
  const layers = groups.map(({ id, births }) => ({ id, births })), signature = JSON.stringify(layers);
  for (const frame of frames) if (JSON.stringify(frame.observation?.particles.map(({ id, births }) => ({ id, births }))) !== signature) mismatch('group identities and birth attributes must remain stable across a run; use states for changing values');
  const result = { version: 1, layers, frames: frames.map((f, index) => ({ index, t: f.t, simulationTime: f.simulationTime, localTime: f.localTime, particles: f.observation.particles.map(({ id, states }) => ({ id, states })) })) };
  if (Buffer.byteLength(JSON.stringify(result)) > 16_000_000) throw new LabError('BUDGET_EXCEEDED', 'Particle observations exceed 16 MB; reduce declared observation groups or particle count. Samples and identities are never silently dropped.');
  return result;
}
