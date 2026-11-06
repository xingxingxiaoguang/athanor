import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { curve, motion, path, particle, domain, schedule } from '../../src/authoring/index.js';
import { invoke } from './invoke.mjs';
import { LAB, RECORDS } from './lab.mjs';

const close = (a, b, epsilon = 1e-8) => assert(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
const vector = (a, b, epsilon) => { assert.equal(a.length, b.length); a.forEach((v, i) => close(v, b[i], epsilon)); };
const linear = (points, outputUnit = 'unitless') => curve.scalar({ points, outputUnit });

test('scalar derivatives preserve values and declare clamp, hold jumps and one-sided corners', () => {
  const c = linear([[0, 0], [1, 2], [2, 1]]);
  close(c.derivative(.4), 2); close(c.derivative(-1), 0);
  assert.throws(() => c.derivative(0), /two-sided/);
  assert.equal(c.at(0).derivative, 2); assert.equal(c.at(2).derivative, 0);
  assert.throws(() => c.derivative(1), /corner/);
  assert.equal(c.derivative(1, { side: 'left' }), 2); assert.equal(c.derivative(1, { side: 'right' }), -1);
  const smooth = curve.scalar({ points: [[0, 0], [2, 10]], interpolation: 'smooth' });
  close(smooth.derivative(1), 7.5); assert.equal(smooth.derivative(0), 0); assert.equal(smooth.derivative(2), 0);
  const hold = curve.scalar({ points: [[0, 3], [1, 7], [2, 2]], interpolation: 'hold' });
  assert.equal(hold.sample(1), 7); assert.equal(hold.at(1, { side: 'left' }).value, 3);
  assert.equal(hold.at(1).discontinuity, 'jump'); assert.throws(() => hold.derivative(1), /jump/);
  assert.equal(hold.at(2, { side: 'left' }).value, 7); assert.equal(hold.at(2).value, 2);
  const bounded = curve.scalar({ points: [[0, 2], [1, 5]], extrapolation: 'error' });
  assert.equal(bounded.derivative(1), 3); assert.throws(() => bounded.at(1.1), /outside/);
  const extended = curve.scalar({ points: [[0, 2], [1, 5]], interpolation: 'hold', extrapolation: 'extend' });
  assert.equal(extended.derivative(2), 3); assert.equal(extended.at(2).value, 8);
});

test('shared envelopes compose values and product/affine derivatives without division by zero', () => {
  const open = curve.scalar({ points: [[.68, 0], [1.15, 1]], interpolation: 'smooth' });
  const closeGate = curve.scalar({ points: [[1.7, 1], [2.2, 0]], interpolation: 'smooth' });
  const gate = curve.combine({ operation: 'product', values: [open, closeGate] });
  const angle = curve.affine(gate, { scale: -.75, offset: -Math.PI / 2 - .23, outputUnit: 'radians' });
  for (const t of [-1, 0, .8, 1, 1.15, 1.6, 1.9, 2.2, 3]) {
    close(gate.sample(t), open.sample(t) * closeGate.sample(t));
    close(angle.derivative(t), -.75 * (open.derivative(t) * closeGate.sample(t) + open.sample(t) * closeGate.derivative(t)));
  }
  const sum = curve.combine({ values: [gate, gate, 3] }); close(sum.derivative(.9), 2 * gate.derivative(.9));
  const zero = curve.combine({ operation: 'product', values: [linear([[0, 0], [2, 2]]), 0] }); assert.equal(zero.derivative(0), 0);
  assert.throws(() => curve.combine({ values: [gate, curve.scalar({ points: [[0, 0], [1, 1]], input: 'particle.age01' })] }), /clocks differ/);
});

test('hierarchical source transforms include moving pivots and angular point velocities', () => {
  const x = linear([[-1, -10], [3, 30]], 'pixels'), rotation = linear([[-1, -.4], [3, 1.2]], 'radians');
  const pivot = motion.source({ position: [x, -20], rotation });
  const tip = motion.source({ parent: pivot, position: [31, 0] });
  for (const t of [-.5, .3, 1.4, 2.8]) {
    const q = tip.sample(t), a = .4 * t;
    vector(q.position, [10 * t + 31 * Math.cos(a), -20 + 31 * Math.sin(a)]);
    vector(q.velocity, [10 - .4 * 31 * Math.sin(a), .4 * 31 * Math.cos(a)]); close(q.angularVelocity, .4);
    const h = .00001, before = tip.sample(t - h), after = tip.sample(t + h);
    vector(q.velocity, after.position.map((v, i) => (v - before.position[i]) / (2 * h)), 1e-6);
  }
  assert.deepEqual(tip.sample(.3), tip.sample(.3));
  assert.throws(() => motion.source({ position: [curve.scalar({ input: 'path.s', points: [[0, 0], [1, 1]] }), 0] }), /seconds/);
  assert.throws(() => motion.source({ parent: pivot, space: 'body' }), /spaces differ/);
});

test('path sources apply arc-length/time units, reverse temporal sides and endpoint stops', () => {
  const route = path.polyline({ id: 'elbow', points: [[0, 0], [10, 0], [10, 30]] });
  const progress = linear([[-1, -1], [2, 2]]), routeSource = motion.pathSource(route, { progress });
  vector(routeSource.sample(.1).velocity, [40, 0]); vector(routeSource.sample(.5).velocity, [0, 40]);
  vector(routeSource.sample(.25).velocity, [0, 40]); vector(routeSource.sample(.25, { side: 'left' }).velocity, [40, 0]);
  vector(routeSource.sample(.25 + 1e-11, { side: 'left' }).velocity, [0, 40]);
  assert.throws(() => routeSource.sample(.25, { side: 'error' }), /two-sided/);
  vector(routeSource.sample(1).velocity, [0, 0]); vector(routeSource.sample(1, { side: 'left' }).velocity, [0, 40]);
  vector(routeSource.sample(-.1).velocity, [0, 0]);
  const reverse = motion.pathSource(route, { progress: linear([[-1, 1.25], [2, -1.75]]) });
  vector(reverse.sample(0).velocity, [-40, 0]); vector(reverse.sample(0, { side: 'left' }).velocity, [0, -40]);
  const still = motion.pathSource(route, { progress: .25, side: 'error' }); vector(still.sample(0).velocity, [0, 0]);
  const closed = path.polyline({ id: 'closed', closed: true, points: [[0, 0], [10, 0], [10, 10]] });
  const loop = motion.pathSource(closed, { progress });
  vector(loop.sample(0, { side: 'left' }).position, [0, 0]); assert.throws(() => loop.sample(0, { side: 'error' }), /corner/);
});

test('arbitrary-function fallback states its fixed seconds step and unavailable error guarantee', () => {
  const source = motion.sampledSource({ sample: (t) => ({ position: [Math.sin(t), t * t], rotation: t * .3 }), range: [0, 2], stepSeconds: .0001 });
  for (const t of [.01, .4, 1.3, 1.99]) {
    const q = source.sample(t); vector(q.velocity, [Math.cos(t), 2 * t], 1e-7);
    assert.equal(q.derivative.stencil, 'central'); assert.equal(q.derivative.errorBound, null);
    assert.equal(q.derivative.discontinuities, 'unchecked');
  }
  assert.equal(source.sample(0).derivative.stencil, 'forward'); assert.equal(source.sample(2).derivative.stencil, 'backward');
  assert.throws(() => source.sample(-.01), /outside/); assert.throws(() => motion.sampledSource({ sample: () => ({}), range: [0, 1], stepSeconds: 1 }), /span/);
  const saved = source.sample(.4); source.sample(1.9); source.sample(.1); assert.deepEqual(source.sample(.4), saved);
});

test('derivative overflow and unrepresentable difference steps give actionable numeric errors', () => {
  assert.throws(() => curve.scalar({ points: [[0, 0], [Number.MIN_VALUE, 1]] }).derivative(0, { side: 'right' }), /finite/);
  const tooSmall = motion.sampledSource({ sample: (t) => ({ position: [t, 0] }), range: [0, 2], stepSeconds: 1e-20 });
  assert.throws(() => tooSmall.sample(1), (error) => error.path === 'motion.sampledSource.stepSeconds' && /Increase stepSeconds/.test(error.recovery));
  const source = motion.sampledSource({ sample: (t) => ({ position: [t, 0] }), range: [0, 2], stepSeconds: .01 });
  assert.deepEqual(source.sample(1).derivative.sampleTimes, [.99, 1.01]);
});

test('emitter birth snapshots expose origin and rotating-domain velocities, keeping explicit transforms compatible', () => {
  const source = motion.source({ position: [linear([[-1, -5], [1, 5]]), 0], rotation: linear([[-1, -2], [1, 2]]) });
  const e = particle.emitter({ id: 'rotating', births: [{ id: 'p', born: 0 }], domain: domain.point({ id: 'tip', position: [3, 4] }), transform: source, inheritVelocity: .5, initial: { life: 2 } });
  vector(e.births[0].position, [3, 4]); vector(e.births[0].velocity, [-1.5, 3]);
  vector(e.births[0].source.pointVelocity, [-3, 6]); assert.equal(e.births[0].source.angularVelocity, 2);
  vector(particle.sample(e, 1)[0].position, [1.5, 7]);
  const old = particle.emitter({ id: 'old', births: [{ id: 'p', born: 0 }], transform: () => ({ position: [2, 3], velocity: [8, -1] }), inheritVelocity: .25, initial: { velocity: [1, 2] } });
  vector(old.births[0].velocity, [3, 1.75]);
  assert.throws(() => particle.emitter({ id: 'wrong-space', births: [{ id: 'p', born: 0 }], transform: motion.source({ space: 'body' }), domain: domain.point({ id: 'p' }) }), /spaces differ/);
});

test('new source contracts are discoverable through public search/inspect', async () => {
  const found = await invoke('search', { query: '源轨迹' }); assert(found.resources.some((r) => r.ref.id === 'core/motion')); assert(found.recipes.some((r) => r.id === 'source-kinematics'));
  const api = await invoke('inspect', { ref: { kind: 'operator', id: 'core/motion' } });
  assert.match(api.sections.contract, /pathSource/); assert.match(api.sections.contract, /stepSeconds/); assert(!api.sections.source);
});

test('source births replay after source deletion and preserve common-time state across output FPS/material edits', async () => {
  const name = `source-${randomUUID().slice(0, 8)}`, file = join(LAB, 'drafts', `${name}.js`), runs = [];
  mkdirSync(join(LAB, 'drafts'), { recursive: true });
  writeFileSync(file, `import {curve,motion,particle,schedule,texture} from '../../../src/authoring/index.js';
export const meta={name:'Source replay',desc:'test',tags:['test'],size:[40,40],origin:[15,30],duration:.5,options:{seed:1,tint:'#f80'}};
const source=motion.source({position:[curve.scalar({points:[[0,0],[.5,10]],interpolation:'smooth'}),-10],rotation:curve.scalar({points:[[0,0],[.5,1]],interpolation:'smooth'})});
const tip=motion.source({parent:source,position:[3,0]}); const tex=texture.ascii({id:'dot',rows:['#'],palette:{'#':'#fff'}});
function make(o){return particle.emitter({id:'moving',births:schedule.rate({id:'birth',start:.1,end:.3,rate:20}),transform:tip,inheritVelocity:.7,initial:{life:.15},material:{texture:tex,tint:o.tint}})}
export function draw(p,t,o){particle.draw(p,make(o),t)}export function observe(t,o){return {particles:[particle.observe(make(o),t)]}}`);
  try {
    const a = await invoke('render', { id: `draft/${name}`, fps: 30 }); runs.push(a.run);
    const b = await invoke('render', { id: `draft/${name}`, fps: 60, options: { tint: '#08f' } }); runs.push(b.run);
    const args = { view: 'particles', particles: ['birth/0', 'birth/1'], at: { times: [.2] }, fields: ['position', 'velocity', 'age01'] };
    const first = await invoke('probe', { ...args, run: a.run }), second = await invoke('probe', { ...args, run: b.run });
    assert.deepEqual(first.births, second.births); assert.deepEqual(first.samples[0].states, second.samples[0].states); assert(first.births[0].source.derivative.parent);
    rmSync(file);
    const replay = await invoke('probe', { ...args, run: a.run, sampling: 'replay', at: { times: [.219, .173, .219] } }); assert.equal(replay.representation, 'frozen-source-replay'); assert.deepEqual(replay.samples[0].states, replay.samples[2].states);
    const validated = await invoke('validate', { run: a.run }); assert(validated.passed);
    const exported = await invoke('export', { run: a.run, validationRef: validated.validationRef }); assert.equal(exported.run, a.run);
  } finally { rmSync(file, { force: true }); for (const id of runs) rmSync(join(RECORDS, id), { recursive: true, force: true }); }
});

test('actual source-only probes separate a stopped pivot from rotating tips without witness particles', async () => {
  const name = `observed-source-${randomUUID().slice(0, 8)}`, file = join(LAB, 'drafts', `${name}.js`), runs = [];
  writeFileSync(file, `import {curve,motion} from '../../../src/authoring/index.js';
export const meta={name:'Actual sources',desc:'No witness particles',tags:['test'],size:[40,40],origin:[15,30],duration:.4,options:{seed:1}};
const root=motion.source({position:[curve.scalar({points:[[0,0],[.1,1],[.3,1],[.4,2]],interpolation:'smooth'}),-10],rotation:curve.scalar({points:[[0,0],[.4,1.2]]})});
const tip=motion.source({parent:root,position:[6,0]});
export function draw(p,t){if(t<.4){const s=tip.sample(t);p.px(...s.position,0xffffffff)}}
export function observe(t){return {sources:[motion.observeSource(root,t,{id:'root'}),motion.observeSource(tip,t,{id:'tip'})]}}`);
  try {
    const a = await invoke('render', { id: `draft/${name}` }); runs.push(a.run);
    assert.deepEqual(a.observation.layers, []); assert.deepEqual(a.observation.sources.map((s) => s.id), ['root', 'tip']);
    const saved = await invoke('probe', { run: a.run, view: 'sources', at: { times: [.2] } });
    assert.equal(saved.selection.totalSources, 2); assert(!saved.births); assert.match(saved.units.angularVelocity, /radians\/second/);
    vector(saved.samples[0].states[0].velocity, [0, 0]); close(saved.samples[0].states[0].angularVelocity, 3);
    vector(saved.samples[0].states[1].velocity, [-18 * Math.sin(.6), 18 * Math.cos(.6)]);
    const detail = JSON.parse(readFileSync(saved.detailRef)); assert.equal(detail.probeRef, saved.probeRef);
    const b = await invoke('render', { id: `draft/${name}`, fps: 60 }); runs.push(b.run);
    const other = await invoke('probe', { run: b.run, view: 'sources', at: { times: [.2] } }); assert.deepEqual(saved.samples[0].states, other.samples[0].states);
    rmSync(file);
    const again = await invoke('probe', { run: a.run, view: 'sources', at: { times: [.2] } }); assert.deepEqual(again.samples, saved.samples);
    const replay = await invoke('probe', { run: a.run, view: 'sources', sampling: 'replay', at: { times: [.219, .173, .219] } }); assert.deepEqual(replay.samples[0].states, replay.samples[2].states);
    assert.equal(replay.sourceDigest, a.sourceDigest);
    const limited = await invoke('probe', { run: a.run, view: 'sources', limit: 1, at: { times: [.2] } }); assert.equal(limited.selection.omittedSources, 1);
    await assert.rejects(invoke('probe', { run: a.run, view: 'sources', particles: ['fake'] }), { code: 'CAPABILITY_UNSUPPORTED' });
    await assert.rejects(invoke('probe', { run: a.run, view: 'sources', fields: ['age01'] }), { code: 'CAPABILITY_UNSUPPORTED' });
    await assert.rejects(invoke('probe', { run: a.run, view: 'sources', layers: ['unknown'] }), { code: 'RESOURCE_NOT_FOUND' });
    await assert.rejects(invoke('probe', { run: a.run, view: 'particles' }), { code: 'CAPABILITY_UNSUPPORTED' });
    const legacy = await invoke('render', { id: 'lab/cinder-orbit' }); runs.push(legacy.run);
    await assert.rejects(invoke('probe', { run: legacy.run, view: 'sources' }), { code: 'CAPABILITY_UNSUPPORTED' });
    const validated = await invoke('validate', { run: a.run }); assert(validated.passed);
    const exported = await invoke('export', { run: a.run, validationRef: validated.validationRef }); assert.equal(exported.run, a.run);
  } finally { rmSync(file, { force: true }); for (const id of runs) rmSync(join(RECORDS, id), { recursive: true, force: true }); }
});

test('declared sources reject changing identities, invalid states and unsupported coordinate spaces', async () => {
  assert.throws(() => motion.observeSource(motion.source({ space: 'body' }), 0, { id: 'body' }), { code: 'CAPABILITY_UNSUPPORTED' });
  const name = `invalid-source-${randomUUID().slice(0, 8)}`, file = join(LAB, 'drafts', `${name}.js`);
  const header = `import {motion} from '../../../src/authoring/index.js';export const meta={name:'Source identity',desc:'test',tags:['test'],size:[16,16],origin:[8,8],duration:.1,options:{}};const s=motion.source();export function draw(p){p.px(0,0,0xffffffff)}`;
  try {
    writeFileSync(file, header + `export function observe(t){return {sources:[motion.observeSource(s,t,{id:t>0?'changed':'initial'})]}}`);
    await assert.rejects(invoke('render', { id: `draft/${name}` }), /source identities/);
    writeFileSync(file, header + `export function observe(t){return {sources:[{...motion.observeSource(s,t,{id:'source'}),angularVelocity:NaN}]}}`);
    await assert.rejects(invoke('render', { id: `draft/${name}` }), /finite JSON/);
  } finally { rmSync(file, { force: true }); }
});
