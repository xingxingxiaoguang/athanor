import { LabError } from './errors.mjs';
import { packHistory, packFrames } from './history-storage.mjs';

export const PARTICLE_UNITS = { status: 'enum', position: 'effect pixels; includes visual offset', basePosition: 'effect pixels; before visual offset', velocity: 'pixels/second; physical, excludes visual offset derivative', age: 'seconds', age01: 'normalized lifetime', simulationAge: 'seconds; exact analytic or last complete 120 Hz force tick', opacity: 'coverage 0..1', scale: 'texture pixel multipliers [x,y]', rotation: 'radians', tint: 'Color32 integer; RGBA bytes, JS signed representation', blend: 'declared dither/soft/additive', tintMode: 'declared multiply/replace', texture: 'resource/frame identity, dimensions and pivot in pixels', offset: 'visual displacement pixels', data: 'author-defined JSON', contact: 'declared phase/contact count/last stable event ID; analytic floor only' };
export const SOURCE_UNITS = { position: 'effect pixels; source origin', velocity: 'pixels/second; source origin translation', rotation: 'unwrapped radians', angularVelocity: 'radians/second', space: 'coordinate space; effect only', derivative: 'declared method/temporal side/discontinuities or explicit numerical estimate metadata' };
export const BODY_UNITS = { status: 'pending/alive/expired; declared half-open life', position: 'effect pixels; transformed pivot', velocity: 'pixels/second; pivot trajectory', rotation: 'unwrapped source radians', angularVelocity: 'source radians/second', scale: 'nonnegative geometry multipliers [x,y]', scaleVelocity: 'multipliers/second [x,y]', flipX: 'static local x reflection', opacity: 'coverage 0..1', depth: 'author-declared ordering; larger drawn later', matrix: 'Canvas-order [a,b,c,d,tx,ty], local to effect', matrixVelocity: 'time derivative of local-to-effect matrix, per second', localBounds: 'declared local [x,y,width,height] or null; not pixel-inferred', bounds: 'transformed declared quad and effect-space AABB, or null; not silhouette', anchors: 'declared named effect positions and chain-rule velocities', data: 'author-defined finite JSON', space: 'effect', derivative: 'source provenance and scale/opacity/depth channel discontinuities' };
export const CONTACT_UNITS = { time: 'effect seconds; solver event time, not nearest output frame', age: 'parent particle seconds', position: 'effect pixels; physical contact point before visual offset', normal: 'unit vector into free space', velocityBefore: 'pixels/second', velocityAfter: 'pixels/second; null for kill', ordinal: 'zero-based contact count per parent copy', precision: 'double-precision ballistic time bracket in parent age seconds; timeErrorMax in seconds', id: 'stable layer/parent/collider/ordinal tuple identity', response: 'bounce/settle/stop/kill', data: 'parent author-defined JSON' };
export const TRAIL_UNITS = { velocity: 'optional physical pixels/second; interpolated trim velocity only when both endpoints declare it, not a new physics sample', time: 'requested effect seconds per retained point', simulationTime: 'actual motion clock; force tracks hold the last complete 120 Hz tick', position: 'effect pixels; declared render or physical position', s: 'normalized retained polyline arc length, oldest 0 to head 1', time01: 'normalized retained time span, oldest 0 to head 1', ageSeconds: 'observation time minus point time, seconds', historyAge: 'head time minus point time, seconds; freezes during fade', lengthPx: 'sampled connected polyline pixels; gaps excluded', breakBefore: 'no segment connects the preceding point', interpolated: 'true for pixel-limit trim on sampled segment; not a new physics sample' };
export const PROBE_FIELDS = [...new Set([...Object.keys(PARTICLE_UNITS), ...Object.keys(SOURCE_UNITS), ...Object.keys(BODY_UNITS)])];

const mismatch = (message) => { throw new LabError('CONTRACT_MISMATCH', `observe(): ${message}`, { recovery: 'Inspect core/particle, core/motion, core/contact, core/trail or core/body for the optional particle/source/contact/trail/body protocols. Return finite JSON data and stable unique identities; leave unsupported internals undeclared.' }); };
function portable(value, path) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) { value.forEach((v, i) => portable(v, `${path}[${i}]`)); return; }
  if (value && Object.getPrototypeOf(value) === Object.prototype) { for (const [k, v] of Object.entries(value)) if (v !== undefined) portable(v, `${path}.${k}`); return; }
  mismatch(`${path} must be plain finite JSON data`);
}
export function normalizeObservation(input) {
  const kinds = ['particles', 'sources', 'contacts', 'trails', 'bodies'];
  if (!input || !kinds.some((k) => Array.isArray(input[k])) || Object.keys(input).some((k) => !kinds.includes(k)) || kinds.some((k) => input[k] !== undefined && !Array.isArray(input[k]))) mismatch('expected particle/source/contact/trail/body observation arrays; declare at least one supported kind');
  portable(input, 'observation');
  const groups = new Set();
  for (const group of input.particles ?? []) {
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
  const sources = new Set();
  if ((input.sources?.length ?? 0) > 64) mismatch('at most 64 declared sources are supported per run');
  for (const source of input.sources ?? []) {
    if (source.kind !== 'SourceObservation' || typeof source.id !== 'string' || !source.id || sources.has(source.id)) mismatch('sources require kind SourceObservation and unique stable nonempty string IDs');
    sources.add(source.id);
    if (source.space !== 'effect') mismatch('source observations require effect space; other spaces need explicit conversion');
    for (const field of ['position', 'velocity']) if (!Array.isArray(source[field]) || source[field].length !== 2 || !source[field].every(Number.isFinite)) mismatch(`source ${field} must be a finite [x,y]`);
    for (const field of ['rotation', 'angularVelocity']) if (!Number.isFinite(source[field])) mismatch(`source ${field} must be finite`);
    if (!source.derivative || typeof source.derivative.method !== 'string') mismatch('source derivative method must be declared');
  }
  const contactGroups = new Set(), eventIds = new Set(); let eventCount = 0;
  const vector = (v) => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite);
  const bodyIds = new Set();
  if ((input.bodies?.length ?? 0) > 64) mismatch('at most 64 declared bodies are supported');
  for (const b of input.bodies ?? []) {
    if (b.kind !== 'BodyObservation' || typeof b.id !== 'string' || !b.id || bodyIds.has(b.id) || b.space !== 'effect') mismatch('bodies require BodyObservation, unique string IDs and effect space');
    bodyIds.add(b.id);
    if (!['pending','alive','expired'].includes(b.status) || !vector(b.position) || !vector(b.velocity) || !vector(b.scale) || !vector(b.scaleVelocity) || b.scale.some(v => v < 0)) mismatch('body status/position/velocity/scale is invalid');
    if (!Number.isFinite(b.born) || b.born < 0 || (b.end !== null && !(Number.isFinite(b.end) && b.end > b.born))) mismatch('body born/end must declare a finite ordered interval or null end');
    if (![b.rotation,b.angularVelocity,b.depth].every(Number.isFinite) || !(b.opacity >= 0 && b.opacity <= 1) || typeof b.flipX !== 'boolean' || !b.derivative || typeof b.derivative.method !== 'string') mismatch('body transform/provenance must be finite and declared');
    if (![b.matrix,b.matrixVelocity].every(m => Array.isArray(m) && m.length === 6 && m.every(Number.isFinite))) mismatch('body matrices must contain six finite coefficients');
    if (b.localBounds !== null && (!Array.isArray(b.localBounds) || b.localBounds.length !== 4 || !b.localBounds.every(Number.isFinite) || b.localBounds[2] < 0 || b.localBounds[3] < 0)) mismatch('body localBounds must be a finite nonnegative rectangle or null');
    if (b.bounds !== null && (!Array.isArray(b.bounds?.corners) || b.bounds.corners.length !== 4 || !b.bounds.corners.every(vector) || !Array.isArray(b.bounds.rect) || b.bounds.rect.length !== 4 || !b.bounds.rect.every(Number.isFinite) || b.bounds.rect[2] < 0 || b.bounds.rect[3] < 0)) mismatch('body bounds require four finite corners and an AABB');
    if (!b.anchors || Object.getPrototypeOf(b.anchors) !== Object.prototype || Object.keys(b.anchors).length > 64 || Object.values(b.anchors).some(a => !vector(a.position) || !vector(a.velocity))) mismatch('body anchors require named finite position/velocity pairs');
  }
  for (const group of input.contacts ?? []) {
    if (group.kind !== 'ContactObservation' || typeof group.id !== 'string' || !group.id || contactGroups.has(group.id) || !Array.isArray(group.parents) || !Array.isArray(group.events)) mismatch('contact groups require unique IDs, parents and complete events');
    contactGroups.add(group.id);
    if (new Set(group.parents).size !== group.parents.length || group.parents.some((id) => typeof id !== 'string' || !id)) mismatch('contact parents must have stable unique string IDs');
    eventCount += group.events.length; if (eventCount > 10000) mismatch('at most 10000 declared contact events per run');
    for (const event of group.events) {
      if (event.kind !== 'contact' || typeof event.id !== 'string' || !event.id || eventIds.has(event.id) || event.layer !== group.id || !group.parents.includes(event.particle)) mismatch('contact event identity/parent does not match the declared group');
      eventIds.add(event.id);
      if (!Number.isFinite(event.time) || !Number.isFinite(event.age) || event.age < 0 || !Number.isInteger(event.ordinal) || event.ordinal < 0) mismatch('contact events need finite time/age and nonnegative ordinal');
      if (!vector(event.position) || !vector(event.normal) || Math.abs(Math.hypot(...event.normal) - 1) > 1e-6 || !vector(event.velocityBefore) || (event.velocityAfter !== null && !vector(event.velocityAfter))) mismatch('contact positions, unit normals and velocities must be finite');
      if (!['bounce', 'stop', 'kill', 'settle'].includes(event.response) || !event.precision || typeof event.precision.method !== 'string' || !vector(event.precision.ageBracket) || !(event.precision.timeTolerance > 0) || !(event.precision.timeErrorMax >= 0)) mismatch('contact response/precision is invalid');
    }
  }
  const trailGroups = new Set(); let retainedPoints = 0;
  for (const group of input.trails ?? []) {
    if (group.kind !== 'TrailObservation' || typeof group.id !== 'string' || !group.id || trailGroups.has(group.id) || !Array.isArray(group.tracks) || !Array.isArray(group.states) || group.tracks.length > 256 || group.states.length !== group.tracks.length) mismatch('trails require unique group IDs, <=256 stable track descriptors and one state per track');
    trailGroups.add(group.id); const ids = new Set();
    for (const track of group.tracks) {
      if (typeof track.id !== 'string' || !track.id || ids.has(track.id) || track.space !== 'effect' || !Number.isFinite(track.born) || !Number.isFinite(track.end) || track.end < track.born) mismatch('trail tracks need stable IDs, effect space and finite ordered lifetime');
      ids.add(track.id);
    }
    const seen = new Set();
    for (const state of group.states) {
      if (!ids.has(state.id) || seen.has(state.id) || !['pending','alive','fading','expired'].includes(state.phase) || !Array.isArray(state.points) || !(state.opacity >= 0 && state.opacity <= 1) || !(state.lengthPx >= 0)) mismatch('trail state identity/phase/geometry does not match its descriptors');
      seen.add(state.id); retainedPoints += state.points.length; let previous = -Infinity;
      for (const p of state.points) {
        if (!vector(p.position) || !Number.isFinite(p.time) || p.time < previous || !Number.isFinite(p.simulationTime) || !['s','time01','ageSeconds','historyAge','distancePx'].every(k => Number.isFinite(p[k])) || typeof p.breakBefore !== 'boolean' || typeof p.interpolated !== 'boolean') mismatch('trail points require ordered time, finite positions/clocks/coordinates and explicit breaks/interpolation');
        previous = p.time;
      }
    }
  }
  if (retainedPoints > 10000) mismatch('at most 10000 retained trail points per observed frame');
  return JSON.parse(JSON.stringify({ ...input, ...(input.bodies ? { bodies: [...input.bodies].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) } : {}) }));
}

export function observationSeries(frames) {
  if (!frames.length || frames.every((f) => f.observation === undefined)) return null;
  const first = frames[0].observation;
  if (!first) mismatch('observer must be available at every saved time');
  const groups = first.particles ?? [], sourceLayers = (first.sources ?? []).map(({ id, space }) => ({ id, space })), sourceSignature = JSON.stringify(sourceLayers), contactLayers = first.contacts ?? [], contactSignature = JSON.stringify(contactLayers);
  const trailLayers = (first.trails ?? []).map(({ id, tracks }) => ({ id, tracks })), trailSignature = JSON.stringify(trailLayers);
  const bodyDescriptors = observation => (observation.bodies ?? []).map(({id,space,born,end,localBounds}) => ({id,space,born,end,localBounds}));
  const bodyLayers = bodyDescriptors(first), bodySignature = JSON.stringify(bodyLayers);
  const layers = groups.map(({ id, births }) => ({ id, births })), signature = JSON.stringify(layers);
  for (const frame of frames) {
    if (!frame.observation || JSON.stringify((frame.observation.particles ?? []).map(({ id, births }) => ({ id, births }))) !== signature) mismatch('group identities and birth attributes must remain stable across a run; use states for changing values');
    if (JSON.stringify((frame.observation.sources ?? []).map(({ id, space }) => ({ id, space }))) !== sourceSignature) mismatch('source identities/spaces must remain stable at every saved time');
    if (JSON.stringify((frame.observation.trails ?? []).map(({ id, tracks }) => ({ id, tracks }))) !== trailSignature) mismatch('trail groups/track descriptors must remain stable across a run');
    if (JSON.stringify(frame.observation.contacts ?? []) !== contactSignature) mismatch('contact parent/event tables must remain immutable across the run; use contact.observe(emitter), not an accumulated callback list');
    if (JSON.stringify(bodyDescriptors(frame.observation)) !== bodySignature) mismatch('body identities/lifetimes/local bounds must remain stable across a run; use states/data for changing values');
  }
  const result = packHistory({ version: 1, layers, ...(sourceLayers.length ? { sourceLayers } : {}), ...(trailLayers.length ? { trailLayers } : {}), ...(contactLayers.length ? { contactLayers } : {}), ...(bodyLayers.length ? { bodyLayers } : {}), frames: frames.map((f, index) => ({ index, t: f.t, simulationTime: f.simulationTime, localTime: f.localTime, particles: (f.observation.particles ?? []).map(({ id, states }) => ({ id, states })), ...(sourceLayers.length ? { sources: f.observation.sources } : {}), ...(bodyLayers.length ? { bodies: f.observation.bodies } : {}), ...(trailLayers.length ? { trails: (f.observation.trails ?? []).map(({id,states}) => ({id,states})) } : {}) })) });
  const stored=packFrames(result),storedBytes=Buffer.byteLength(JSON.stringify(stored));
  if (storedBytes > 16_000_000) throw new LabError('BUDGET_EXCEEDED', 'Stored observations exceed 16 MB after lossless packing',{details:{storedBytes,storedLimit:16_000_000},recovery:'Reduce declared groups/sources or particle count; no state is silently dropped.'});
  return stored;
}
