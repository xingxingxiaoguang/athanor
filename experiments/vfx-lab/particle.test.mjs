import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { particle, texture, material, domain, schedule, motion, curve } from '../../src/authoring/index.js';
import { createFrame, painterFor, hex } from '../../src/core/index.js';
import { fly, flyV } from '../../src/core/particles.js';
import { drift, firePuff, smokePuff, spark, ember } from '../../src/fx/fire/_lib.js';
import { mote, streak } from '../../src/fx/arcane/_lib.js';
import { invoke } from './invoke.mjs';
import { execute, LAB, RECORDS } from './lab.mjs';

const close = (a, b, epsilon = 1e-8) => assert(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const closeVector = (a, b) => a.forEach((v, i) => close(v, b[i]));
const draw = (fn) => { const f = createFrame(40, 40), p = painterFor(f).place(20, 20); fn(p); return f; };
const dot = texture.ascii({ id: 'dot', rows: ['#'], palette: { '#': '#fff' }, pivot: [0, 0] });

test('generalized analytic motion retains library fly/flyV and fire drift code paths including axis drag', () => {
  for (const drag of [0, 0.8, 4]) {
    const q = motion.ballistic({ position: [3, -7], velocity: [41, -12], acceleration: [0, 67], drag, age: .73 });
    closeVector(q.position, fly(3, -7, 41, -12, .73, 67, drag)); closeVector(q.velocity, flyV(41, -12, .73, 67, drag));
  }
  const q = motion.ballistic({ position: [3, -7], velocity: [41, -12], acceleration: [-4, -16], drag: [1.6, 1.2], age: .73 });
  const original = drift(3, -7, 41, -12, .73, -4, -16, 1.6, 1.2);
  closeVector([...q.position, ...q.velocity], original);
});

test('cycle schedules retain overlapping copies and repeat appearance without conflating particle identity', () => {
  const births = schedule.cycle({ id: 'curl', period: 1, count: 5, start: 0, end: 3, lifeMax: 2.3, seed: 7 });
  const e = particle.emitter({ id: 'loop', seed: 7, births, domain: domain.circle({ id: 'source', radius: 5 }), initial: { life: 2.3, velocity: [2, -1], scale: [.5, 1.5] }, material: { texture: dot } });
  const a = particle.sample(e, .35), b = particle.sample(e, 1.35);
  assert(a.length >= 10, 'lifetimes longer than 2 periods retain at least 2 live copies per slot');
  assert.equal(a.length, b.length); assert.equal(new Set(a.map((s) => s.id)).size, a.length);
  const signature = (states) => states.map((s) => [s.birth.randomId, s.age, ...s.position, ...s.scale]).sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1]);
  signature(a).forEach((s, i) => { assert.equal(s[0], signature(b)[i][0]); closeVector(s.slice(1), signature(b)[i].slice(1)); });
  assert.deepEqual(draw((p) => particle.draw(p, e, .35)).color, draw((p) => particle.draw(p, e, 1.35)).color);
  assert.throws(() => particle.emitter({ id: 'bad', births, initial: { life: 2.31 } }), /lifeMax/);
  const resident = particle.emitter({ id: 'fixed', births: schedule.resident({ id: 'fixed', start: .2, end: .8, count: 3 }) });
  assert.equal(particle.sample(resident, .199).length, 0); assert.equal(particle.sample(resident, .2).length, 3); assert.equal(particle.sample(resident, .8).length, 0);
});

test('birth domain, direction, transforms and source velocity inheritance are separate', () => {
  const e = particle.emitter({ id: 'inward', births: schedule.burst({ id: 'born', at: .2, count: 20 }), seed: 4,
    domain: domain.circle({ id: 'rim', radius: 10 }), measure: 'boundary', direction: { mode: 'inward' },
    transform: (t) => ({ position: [t * 10, 3], rotation: Math.PI / 2, velocity: [10, 0] }), inheritVelocity: .5,
    initial: { life: 1, speed: 20 },
  });
  for (const birth of e.births) { const d = [birth.position[0] - 2, birth.position[1] - 3]; close(Math.hypot(...d), 10); closeVector(birth.velocity, [-d[0] * 2 + 5, -d[1] * 2]); }
  const sector = domain.sector({ id: 'fan', radius: 10, innerRadius: 4, angle: 0, spread: Math.PI / 2 });
  const points = domain.sample({ domain: sector, count: 1000 });
  assert(points.every((p) => Math.abs(Math.atan2(p.position[1], p.position[0])) <= Math.PI / 4 && Math.hypot(...p.position) >= 4));
  close(points.reduce((s, p) => s + p.position[0] ** 2 + p.position[1] ** 2, 0) / 1000, 58, 3);
  assert.throws(() => particle.emitter({ id: 'no-normal', births: [{ id: 'p', born: 0 }], domain: sector, direction: { mode: 'normal' }, initial: { speed: 1 } }), { code: 'CAPABILITY_UNSUPPORTED' });
});

test('birth attribute channels survive reordering/material changes and support explicit correlations', () => {
  const births = schedule.burst({ id: 'chips', at: 0, count: 4 }), region = domain.rectangle({ id: 'plate', x: -5, y: -3, w: 10, h: 6 });
  const config = { id: 'chips', seed: 8, births, domain: region,
    initial: { data: (c) => ({ heat: c.rand('heat') }), life: (c) => .5 + c.data.heat, scale: (c) => 1 + c.data.heat, speed: [8, 19], spin: [-3, 4] } };
  const a = particle.emitter(config), b = particle.emitter({ ...config, births: [{ id: 'extra', born: 0 }, ...[...births].reverse()], textures: [{ texture: dot, weight: 2 }], material: { tint: '#f80' } });
  for (const q of a.births) { const r = b.births.find((s) => s.id === q.id); for (const field of ['position', 'velocity', 'life', 'scale', 'spin', 'data']) assert.deepEqual(q[field], r[field]); close(q.scale - q.life, .5); }
  const correlated = particle.emitter({ ...config, initial: (c) => ({ life: 1, speed: 0, scale: 1 + Math.abs(c.position[0]) }) });
  for (const q of correlated.births) close(q.scale, 1 + Math.abs(q.position[0]));
});

test('force queries are seek/order independent, use fixed ticks and keep visual offsets out of velocity', () => {
  const settings = { position: [2, 3], velocity: [4, -5], acceleration: [2, 10], drag: [1, 2], age: .375 };
  const exact = motion.ballistic(settings), ticked = motion.integrate({ ...settings, acceleration: [0, 0], forces: [() => [2, 10]] });
  closeVector(exact.position, ticked.position); closeVector(exact.velocity, ticked.velocity);
  assert.equal(motion.integrate({ ...settings, age: .379 }).simulationAge, .375);
  const e = particle.emitter({ id: 'forces', births: [{ id: 'a', born: 0 }], initial: { life: 1, velocity: [5, 0] },
    motion: { forces: [motion.radial({ strength: -10, tangential: 25 }), motion.attract({ target: [3, -2], startAge: .2 })], offset: (s) => [Math.sin(s.age * 10) * 3, 0] },
  });
  const a = particle.sample(e, .6); particle.sample(e, .9); particle.sample(e, .1); assert.deepEqual(particle.sample(e, .6), a);
  close(a[0].position[0] - a[0].basePosition[0], Math.sin(6) * 3);
  const kill = motion.integrate({ position: [0, 0], velocity: [10, 0], age: 1, kill: (s) => s.position[0] >= 2 });
  assert.equal(kill.alive, false); assert(kill.killedAge >= .2 && kill.killedAge <= .2 + 1 / 120); assert(kill.position[0] >= 2 && kill.position[0] < 2.1);
  assert.throws(() => motion.integrate({ ...settings, forces: [() => [Infinity, 0]] }), { code: 'CONTRACT_MISMATCH' });
});

test('texture axes/pivot/rotation/coverage use nearest source pixels and preserve RGBA asset bytes', () => {
  const tex = texture.rgba({ id: 'test', w: 2, h: 1, pivot: [0, 0], data: [255, 0, 0, 128, 0, 255, 0, 255] });
  const f = createFrame(12, 12), p = painterFor(f);
  texture.draw(p, tex, { position: [3, 3], scale: [2, 1], opacity: .5, blend: 'soft' });
  assert.equal(f.color[3 * 12 + 3] & 0xffffff, hex('#f00') & 0xffffff); assert.equal(f.color[3 * 12 + 3] >>> 24, 64);
  assert.equal(f.color[3 * 12 + 4], f.color[3 * 12 + 3]); assert.equal(f.color[3 * 12 + 5] & 0xffffff, hex('#0f0') & 0xffffff);
  assert.deepEqual([...tex.data], [255, 0, 0, 128, 0, 255, 0, 255]);
  const rotation = createFrame(12, 12); texture.draw(painterFor(rotation), tex, { position: [6, 3], rotation: Math.PI / 2, blend: 'soft' });
  assert.equal(rotation.color[3 * 12 + 5] & 0xffffff, hex('#f00') & 0xffffff); assert.equal(rotation.color[4 * 12 + 5] & 0xffffff, hex('#0f0') & 0xffffff);
  const mirror = createFrame(12, 12); texture.draw(painterFor(mirror), tex, { position: [6, 3], scale: [-1, 1], blend: 'soft' });
  assert.equal(mirror.color[3 * 12 + 4] & 0xffffff, hex('#0f0') & 0xffffff);
  const separate = createFrame(12, 12); texture.draw(painterFor(separate), tex, { position: [3, 3], blend: 'additive' }); assert(!separate.color.some(Boolean)); assert(separate.light.some(Boolean));
  assert.throws(() => texture.ascii({ id: 'bad', rows: ['x'], palette: {} }), { code: 'CONTRACT_MISMATCH' });
});

test('lifetime/FPS sequences, weighted resources and finite-color lifecycle ramps have independent clocks', () => {
  const atlas = texture.ascii({ id: 'atlas', rows: ['RGB'], palette: { R: '#f00', G: '#0f0', B: '#00f' } });
  const frames = texture.sheet({ id: 'frames', image: atlas, frameSize: [1, 1] });
  const normalized = texture.sequence({ id: 'normal', frames }), timed = texture.sequence({ id: 'timed', frames, mode: 'fps', fps: 10, loop: true });
  assert.equal(texture.frame(normalized, { age01: .34 }).index, 1); assert.equal(texture.frame(normalized, { age01: 1 }).index, 2);
  assert.equal(texture.frame(timed, { age: .4 }).index, 1); assert.equal(texture.frame(timed, { age: .1, frameOffset: -2 }).index, 2);
  const colors = curve.color({ points: [[0, '#f00'], [.5, '#0f0'], [1, '#00f']] });
  assert.equal(colors.sample(.49), hex('#f00')); assert.equal(colors.sample(.5), hex('#0f0'));
  const e = particle.emitter({ id: 'weighted', births: schedule.burst({ id: 'weighted', at: 0, count: 1000 }), textures: [{ texture: frames[0], weight: 1 }, { texture: normalized, weight: 3 }], material: { tint: colors } });
  const selected = e.births.filter((b) => b.resource.id === 'normal').length; assert(selected > 700 && selected < 800);
  const s = particle.sample(e, .6)[0]; assert.equal(s.tint, hex('#0f0')); assert.equal(s.texture.index, s.texture.id === 'normal' ? 1 : 0);
});

test('public material adapters reuse exact library drawing and preserve Painter state/independent light', () => {
  const colors = ['#fff', '#fed', '#fc9', '#f84', '#c53', '#934', '#623', '#412', '#211'].map(hex);
  const s = { position: [0, 0], velocity: [80, -30], age01: .2, opacity: 1, tint: hex('#fc9') };
  const cases = [
    [(p) => material.fire(p, s, { colors, size: 4 }), (p) => firePuff(p, 0, 0, .8, 4, 0, colors)],
    [(p) => material.smoke(p, s, { size: 4 }), (p) => smokePuff(p, 0, 0, .8, 4)],
    [(p) => material.spark(p, s, { colors: colors.slice(0, 4) }), (p) => spark(p, 0, 0, 80, -30, .8, colors.slice(0, 4))],
    [(p) => material.ember(p, s, { colors: colors.slice(0, 4), size: 2 }), (p) => ember(p, 0, 0, .8, 2, colors.slice(0, 4), 0)],
    [(p) => material.mote(p, s), (p) => mote(p, 0, 0, 80, -30, s.tint, 1, .8)],
    [(p) => material.streak(p, s), (p) => streak(p, 0, 0, 80, -30, s.tint)],
  ];
  for (const [adapted, original] of cases) assert.deepEqual(draw(adapted), draw(original));
  const invisible = draw((p) => { p.fade = .7; p.lightK = .8; material.fire(p, { ...s, opacity: 0 }, { colors }); assert.equal(p.fade, .7); assert.equal(p.lightK, .8); });
  assert(!invisible.color.some(Boolean) && !invisible.light.some(Boolean));
});

test('public discovery exposes exact particle/texture/material contracts without implementation reads', async () => {
  for (const name of ['particle', 'texture', 'material']) {
    const result = await execute('inspect', { ref: { kind: 'operator', id: `core/${name}` } });
    assert.equal(typeof result.sections.contract, 'string'); assert.equal(typeof result.sections.example, 'string'); assert(!result.sections.source);
  }
  const resources = await execute('search', { query: '粒子' }); assert(resources.resources.some((r) => r.ref.id === 'core/particle'));
});

test('single-run saved probes survive current source failure; frozen off-grid probes preserve identities and source evidence', async () => {
  const name = `particle-${randomUUID().slice(0, 8)}`, file = join(LAB, 'drafts', `${name}.js`), runs = [];
  const source = `import {particle,schedule,texture} from '../../../src/authoring/index.js';
export const meta={name:'Particle test',desc:'Observed test',tags:['test'],size:[24,24],origin:[5,5],duration:.4,options:{seed:7}};
export const events={release:.1}; const tex=texture.ascii({id:'dot',rows:['#'],palette:{'#':'#f80'},pivot:[0,0]});
const system=particle.emitter({id:'chips',births:schedule.burst({id:'born',at:0,count:3}),initial:{life:.35,velocity:[10,0]},material:{texture:tex}});
export function draw(p,t){particle.draw(p,system,t)}; export function observe(t){const group=particle.observe(system,t);return {particles:[group,{...group,id:'second-group'}]}};`;
  mkdirSync(join(LAB, 'drafts'), { recursive: true }); writeFileSync(file, source);
  try {
    const run = await invoke('render', { id: `draft/${name}` }); runs.push(run.run); assert.equal(run.observation.layers[0].birthCount, 3);
    const bounded = await invoke('probe', { run: run.run, view: 'particles', at: { times: [.1] }, limit: 1 });
    assert.equal(bounded.selection.totalBirths, 6); assert.equal(bounded.selection.selectedBirths, 1); assert.equal(bounded.samples[0].states.length, 1); assert.equal(bounded.samples[0].states[0].layer, 'chips');
    const saved = await invoke('probe', { run: run.run, view: 'particles', at: { times: [.142] }, particles: ['born/1'], fields: ['position', 'velocity', 'texture'] });
    assert.equal(saved.representation, 'saved-observations'); close(saved.samples[0].actual, 4 / 30); close(saved.samples[0].states[0].position[0], 4 / 3, 1e-8); assert.equal(saved.births[0].id, 'born/1');
    writeFileSync(file, "throw new Error('CURRENT SOURCE MUST NOT EXECUTE');");
    const shading = await invoke('probe', { run: run.run, view: 'particles', layers: ['chips'], at: { times: [.1] }, particles: ['born/1'], fields: ['tint', 'blend', 'tintMode'] });
    assert.deepEqual(shading.samples[0].states[0], { layer: 'chips', id: 'born/1', status: 'alive', tint: -1, blend: 'dither', tintMode: 'multiply' });
    assert.match(shading.units.tint, /Color32/); assert.equal(shading.representation, 'saved-observations');
    const replayShading = await invoke('probe', { run: run.run, sampling: 'replay', view: 'particles', layers: ['chips'], at: { times: [.1] }, particles: ['born/1'], fields: ['tint', 'blend', 'tintMode'] });
    assert.deepEqual(replayShading.samples[0].states, shading.samples[0].states);
    const again = await invoke('probe', { run: run.run, view: 'particles', at: { times: [.142] }, particles: ['born/1'], fields: ['position', 'velocity', 'texture'] }); assert.deepEqual(saved.samples, again.samples);
    const replay = await invoke('probe', { run: run.run, sampling: 'replay', view: 'trajectory', at: { times: [.125, .25] }, particles: ['born/1'] }); assert.equal(replay.representation, 'frozen-source-replay'); assert.equal(replay.sourceDigest, run.sourceDigest); close(replay.samples[0].states[0].position[0], 1.25);
    const image = await invoke('probe', { run: run.run, view: 'light', at: { event: 'release', offsets: [-.2, 0, .5] } }); runs.push(image.run); assert.equal(image.samples[0].requested, -.1); assert.equal(image.samples[0].clamped, true); assert.equal(image.samples[2].clamped, true);
    assert.equal(JSON.parse(readFileSync(image.detailRef)).probeRef, image.probeRef);
    await assert.rejects(invoke('probe', { run: run.run, view: 'particles', particles: ['missing'] }), { code: 'RESOURCE_NOT_FOUND' });
    const obsFile = join(RECORDS, run.run, 'observations.json'), original = readFileSync(obsFile); writeFileSync(obsFile, original.toString().replace('"chips"', '"tampered"'));
    await assert.rejects(invoke('probe', { run: run.run, view: 'particles' }), { code: 'CONTRACT_MISMATCH' }); writeFileSync(obsFile, original);
    const child = await invoke('render', { run: run.run, fps: 60 }); runs.push(child.run);
    const common = await invoke('probe', { run: child.run, view: 'particles', at: { times: [4 / 30] }, particles: ['born/1'], fields: ['position', 'velocity', 'texture'] }); assert.deepEqual(common.samples[0].states, saved.samples[0].states);
    const validated = await invoke('validate', { run: run.run }); assert(validated.passed);
    const exported = await invoke('export', { run: run.run, validationRef: validated.validationRef }); assert.equal(exported.run, run.run);
  } finally { rmSync(file, { force: true }); runs.forEach((run) => rmSync(join(RECORDS, run), { recursive: true, force: true })); }
});

test('observation contract rejects moving birth identity and nonfinite data instead of fabricating evidence', async () => {
  const name = `observation-${randomUUID().slice(0, 8)}`, file = join(LAB, 'drafts', `${name}.js`);
  const base = `export const meta={name:'Invalid observation',desc:'test',tags:['test'],size:[16,16],origin:[8,8],duration:.1,options:{}};export function draw(p){p.px(0,0,0xffffffff)};`;
  try {
    writeFileSync(file, base + `export function observe(t){return {particles:[{kind:'ParticleObservation',id:'g',births:[{id:'a',born:t,life:1}],states:[{id:'a',status:'alive',position:[0,0]}]}]}}`);
    await assert.rejects(invoke('render', { id: `draft/${name}` }), /birth attributes must remain stable/);
    writeFileSync(file, base + `export function observe(t){return {particles:[{kind:'ParticleObservation',id:'g',births:[{id:'a',born:0,life:1}],states:[{id:'a',status:'alive',position:[NaN,0]}]}]}}`);
    await assert.rejects(invoke('render', { id: `draft/${name}` }), /finite JSON/);
    writeFileSync(file, base);
    const legacy = await invoke('render', { id: `draft/${name}` });
    try { await assert.rejects(invoke('probe', { run: legacy.run, view: 'particles' }), { code: 'CAPABILITY_UNSUPPORTED' }); }
    finally { rmSync(join(RECORDS, legacy.run), { recursive: true, force: true }); }
  } finally { rmSync(file, { force: true }); }
});
