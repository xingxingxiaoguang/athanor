import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { contact, particle, schedule, material } from '../../src/authoring/index.js';
import { createFrame, painterFor, fit } from '../../src/core/index.js';
import { sparkAt } from '../../src/fx/fire/_lib.js';
import { bead, WATER, Ripples } from '../../src/fx/water/_lib.js';
import { invoke } from './invoke.mjs';
import { LAB, RECORDS } from './lab.mjs';
import { normalizeObservation, observationSeries } from './observation.mjs';

const close = (a, b, epsilon = 1e-8) => assert(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
const vector = (a, b, epsilon) => { assert.equal(a.length, b.length); a.forEach((v, i) => close(v, b[i], epsilon)); };
const track = (extra = {}) => contact.trace({ position: [0, -10], velocity: [8, 0], acceleration: [0, 20], life: 3, floor: contact.floor({ restitution: .5, settleSpeed: 3 }), ...extra });

test('public discovery exposes contact composition and reusable water materials without source', async () => {
  const found = await invoke('search', { query: '二次发射' });
  assert(found.resources.some((r) => r.ref.id === 'core/contact'));
  const api = await invoke('inspect', { ref: { kind: 'operator', id: 'core/contact' } });
  assert.match(api.sections.contract, /contact.births/); assert(!api.sections.source);
  const water = await invoke('search', { query: 'waterDrop' });
  assert(water.resources.some((r) => r.ref.id === 'core/material'));
});

test('empty contact-only declarations are supported while changing event tables are rejected', () => {
  const emitter = particle.emitter({ id: 'silent', births: [], motion: { contact: contact.floor() } });
  const empty = normalizeObservation({ contacts: [contact.observe(emitter)] });
  const series = observationSeries([{ t: 0, observation: empty }, { t: 1, observation: empty }]);
  assert.deepEqual(series.contactLayers[0].events, []);
  const complete = normalizeObservation({ contacts: [{ kind: 'ContactObservation', id: 'effect', parents: ['body'], events: contact.events(track()) }] });
  const partial = structuredClone(complete); partial.contacts[0].events.pop();
  assert.throws(() => observationSeries([{ t: 0, observation: complete }, { t: 1, observation: partial }]), /immutable/);
  assert.throws(() => contact.events(particle.emitter({ id: 'legacy', births: [] })), { code: 'CAPABILITY_UNSUPPORTED' });
});

test('analytic contact reuses spark flight and captures a fast down/up excursion between frames', () => {
  const t = track({ position: [0, -20], velocity: [30, -80], acceleration: [0, 427], drag: 2.2 });
  const event = contact.events(t)[0]; assert(event.age > 0);
  for (const age of [.05, event.age * .8]) { const q = t.sample(age); vector([...q.position, ...q.velocity], sparkAt(0, -20, 30, -80, age)); }
  close(event.velocityAfter[0], event.velocityBefore[0] * .7); close(event.velocityAfter[1], -event.velocityBefore[1] * .5);
  const fast = track({ position: [0, -1], velocity: [0, 1000], acceleration: [0, -2000], life: 1, floor: contact.floor({ response: 'kill' }) });
  const first = contact.events(fast)[0]; close(first.age, 2 / (1000 + Math.sqrt(996000)), 1e-12);
  assert(first.age < 1 / 60); assert.equal(fast.sample(.1).alive, false);
  const rebounding = track({ position: [0, -36 / 7], velocity: [7, -1 / 3], acceleration: [0, 96], drag: .4, life: 3.5, floor: contact.floor({ restitution: .5, settleSpeed: 2 }) });
  for (const e of contact.events(rebounding)) {
    assert(e.precision.ageBracket[0] <= e.age && e.age <= e.precision.ageBracket[1]);
    assert(e.precision.timeErrorMax >= e.precision.ageBracket[1] - e.precision.ageBracket[0]);
    assert(e.precision.timeErrorMax > 0, 'nonzero segment uncertainty must survive parent-age rounding');
    assert(e.precision.timeErrorMax <= e.precision.timeTolerance);
  }
});

test('boundary contact, outgoing flight, settling, kill and exact lifetime ties have explicit order', () => {
  const t = track(), events = contact.events(t);
  vector(events.map((e) => e.age), [1, 2, 2.5]); assert.equal(events[2].response, 'settle');
  vector(t.sample(1).velocity, [5.6, -10]); assert.equal(t.sample(2.6).contact.phase, 'resting'); vector(t.sample(2.6).velocity, [0, 0]);
  assert.equal(contact.events(track({ life: 1 })).length, 0);
  const onFloor = track({ position: [0, 0], velocity: [0, 0] }); assert.equal(contact.events(onFloor)[0].age, 0); assert.equal(onFloor.sample(0).contact.phase, 'resting');
  const departing = track({ position: [0, 0], velocity: [0, -10], life: 2 }); close(contact.events(departing)[0].age, 1);
  const killed = track({ floor: contact.floor({ response: 'kill' }) }); assert.equal(contact.events(killed)[0].velocityAfter, null); assert.equal(killed.sample(1).alive, false); assert.equal(killed.sample(.5).killedAge, null);
  const stopped = track({ floor: contact.floor({ response: 'stop' }) }); vector(stopped.sample(1).velocity, [0, 0]);
  assert.throws(() => track({ position: [0, 1] }), /below the floor/);
  assert.throws(() => track({ floor: contact.floor({ maxEvents: 1, settleSpeed: 0 }) }), { code: 'BUDGET_EXCEEDED' });
});

test('secondary births deduplicate stable events and interval partitions without stateful consumers', () => {
  const t = track({ born: .2 }), all = contact.events(t);
  const a = contact.births({ id: 'dust', events: all, count: 2 });
  const b = contact.births({ id: 'dust', events: [...contact.events(t, { from: 0, to: 2.2 }), ...contact.events(t, { from: 2.2, to: 4 }), ...all], count: 2 });
  assert.deepEqual(a, b); assert.equal(new Set(a.map((b) => b.id)).size, 6);
  const first = contact.births({ id: 'rings', events: all, select: (e) => e.ordinal === 0, delay: .1 });
  assert.equal(first.length, 1); close(first[0].born, all[0].time + .1); assert.equal(first[0].parentEvent, all[0].id);
  assert.throws(() => contact.births({ id: 'bad', events: [all[0], { ...all[0], position: [99, 0] }] }), /conflicting payload/);
  all[0].position[0] = 99; assert.notEqual(contact.events(t)[0].position[0], 99);
});

test('contact identities survive parent order/material changes and retain cycle copy/random identities', () => {
  const births = schedule.burst({ id: 'parent', at: .1, count: 3, spread: .1 }), floor = contact.floor();
  const config = { id: 'metal', births, initial: { life: 2, velocity: (c) => [c.rand('vx', -10, 10), 0] }, transform: { position: [0, -10] }, motion: { acceleration: [0, 40], contact: floor } };
  const a = particle.emitter(config), b = particle.emitter({ ...config, births: [...births].reverse(), material: { tint: '#08f' } });
  assert.deepEqual(contact.events(a), contact.events(b));
  const childBirths = contact.births({ id: 'read-through', events: contact.events(a) });
  const child = particle.emitter({ id: 'children', births: childBirths, initial: { life: .2 } });
  const state = particle.sample(child, childBirths[0].born)[0];
  assert.deepEqual(state.birth.event, contact.events(a)[0]);
  assert.equal(state.birth.parentEvent, state.birth.event.id); assert.equal(state.data, null);
  const cyc = particle.emitter({ ...config, births: [{ id: 'p/copy/-1', randomId: 'p', copy: -1, born: -1 }, { id: 'p/copy/0', randomId: 'p', copy: 0, born: 0 }] });
  const children = contact.births({ id: 'child', events: contact.events(cyc), select: (e) => e.ordinal === 0 });
  assert.equal(children.length, 2); assert.notEqual(children[0].id, children[1].id); assert.equal(children[0].randomId, children[1].randomId);
  assert.deepEqual(children.map((b) => b.copy), [-1, 0]);
  const offset = particle.emitter({ ...config, motion: { ...config.motion, offset: () => [0, 7] } });
  const shifted = particle.sample(offset, .9)[0]; close(shifted.position[1] - shifted.basePosition[1], 7); assert(contact.events(offset).every((e) => e.position[1] === 0));
  assert.throws(() => particle.emitter({ ...config, motion: { ...config.motion, forces: [() => [0, 1]] } }), { code: 'CAPABILITY_UNSUPPORTED' });
  assert.throws(() => particle.emitter({ ...config, transform: { position: [0, -10], space: 'body' } }), { code: 'CAPABILITY_UNSUPPORTED' });
});

test('water materials directly match mature bead/ripple drawing and restore Painter state', () => {
  const draw = (fn) => { const f = createFrame(48, 40), p = painterFor(f).place(24, 20); fn(p); return f; }, C = fit(WATER, 8);
  const state = { position: [0, 0], velocity: [25, 30], age: .3, age01: .3, life: 1, opacity: 1 };
  assert.deepEqual(draw((p) => material.waterDrop(p, state)), draw((p) => bead(p, 0, 0, 25, 30, 2, C)));
  const old = new Ripples({ sy: .22 }); old.add(0, 0, 1, 18, 1); old.list[0].age = .3;
  assert.deepEqual(draw((p) => material.ripple(p, state, { glow: 1 })), draw((p) => old.draw(p, C)));
  draw((p) => { p.fade = .7; p.lightK = .4; material.ripple(p, { ...state, opacity: .5 }, { glow: .02 }); assert.equal(p.fade, .7); assert.equal(p.lightK, .4); });
});

test('public contacts freeze independently of current source and preserve births/events across FPS', async () => {
  const name = `contact-${randomUUID().slice(0, 8)}`, file = join(LAB, 'drafts', `${name}.js`), runs = [];
  mkdirSync(join(LAB, 'drafts'), { recursive: true });
  writeFileSync(file, `import {contact,particle,material} from '../../../src/authoring/index.js';
export const meta={name:'Contact fixture',desc:'Contact to ripple',tags:['test'],size:[40,40],origin:[20,22],duration:1,options:{seed:1,glow:0}};
const floor=contact.floor({response:'kill'});
const parent=particle.emitter({id:'drop',births:[{id:'drop/0',born:0,position:[0,-10]}],initial:{life:1},motion:{acceleration:[0,80],contact:floor}});
const child=particle.emitter({id:'rings',births:contact.births({id:'ring',events:contact.events(parent)}),initial:{life:.3}});
export function draw(p,t,o){particle.draw(p,parent,t,{draw:(p,s)=>material.waterDrop(p,s)});particle.draw(p,child,t,{draw:(p,s)=>material.ripple(p,s,{radius:8,glow:o.glow})})}
export function observe(t){return {particles:[particle.observe(parent,t),particle.observe(child,t)],contacts:[contact.observe(parent)]}}`);
  try {
    const a = await invoke('render', { id: `draft/${name}` }); runs.push(a.run); assert.equal(a.observation.contacts[0].eventCount, 1);
    const events = await invoke('probe', { run: a.run, view: 'contacts', window: { from: 0, to: 1 } });
    assert.equal(events.representation, 'saved-contact-events'); close(events.events[0].time, .5);
    assert.equal((await invoke('probe', { run: a.run, view: 'contacts', window: { from: 0, to: .5 } })).events.length, 0);
    assert.equal((await invoke('probe', { run: a.run, view: 'contacts', window: { from: .5, to: 1 } })).events.length, 1);
    const childState = await invoke('probe', { run: a.run, view: 'particles', layers: ['rings'], at: { times: [.6] }, fields: ['position', 'velocity', 'age'] });
    assert.equal(childState.births[0].parentEvent, events.events[0].id);
    const b = await invoke('render', { id: `draft/${name}`, fps: 60, options: { glow: .1 } }); runs.push(b.run);
    const other = await invoke('probe', { run: b.run, view: 'contacts' }); assert.deepEqual(events.events, other.events);
    rmSync(file);
    const replay = await invoke('probe', { run: a.run, view: 'contacts', sampling: 'replay' }); assert.deepEqual(replay.events, events.events);
    const saved = await invoke('probe', { run: a.run, view: 'contacts' }); assert.deepEqual(saved.events, events.events);
    const jumped = await invoke('probe', { run: a.run, view: 'particles', sampling: 'replay', layers: ['rings'], at: { times: [.61, .59, .61] } }); assert.deepEqual(jumped.samples[0].states, jumped.samples[2].states);
    const validated = await invoke('validate', { run: a.run }); assert(validated.passed, JSON.stringify(validated.errors));
    const exported = await invoke('export', { run: a.run, validationRef: validated.validationRef }); assert.equal(exported.run, a.run);
    await assert.rejects(invoke('probe', { run: a.run, view: 'contacts', at: { times: [.5] } }), { code: 'CAPABILITY_UNSUPPORTED' });
    await assert.rejects(invoke('probe', { run: a.run, view: 'contacts', particles: ['unknown'] }), { code: 'RESOURCE_NOT_FOUND' });
  } finally { rmSync(file, { force: true }); for (const id of runs) rmSync(join(RECORDS, id), { recursive: true, force: true }); }
});
