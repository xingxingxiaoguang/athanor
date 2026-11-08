import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { propagation, curve, particle, schedule } from '../../src/authoring/index.js';
import { fractures, drawFractures } from '../../src/fx/ice/_lib.js';
import { Rng, createFrame, painterFor, fit } from '../../src/core/index.js';
import fixtures from './propagation-fixtures.mjs';
import { apiResources, inspectApi } from './contracts.mjs';
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const close = (a, b, tolerance = 1e-8) => assert(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const ramp = (points, interpolation = 'linear') => curve.scalar({ input: 'scene.seconds', outputUnit: 'pixels', points, interpolation });
const branches = () => [
  { id: 'trunk', points: [[0, 0], [10, 0], [20, 0]] },
  { id: 'branch', parentId: 'trunk', attachPx: 5, points: [[5, 0], [5, 10]] },
  { id: 'tip', parentId: 'branch', attachPx: 6, points: [[5, 6], [8, 10]] },
];

test('extracted ice walk retains 16 original geometries, RNG tails and 64 native color/light rasters', () => {
  for (const f of fixtures) {
    const R = new Rng(f.seed), lines = fractures(R, (x, y) => x * x / 10404 + y * y / 8100 < 1, 0, 0, 7, f.opts);
    assert.equal(hash(lines), f.geometry); assert.equal(lines.length, f.branches);
    assert.deepEqual(Array.from({ length: 4 }, () => R.next()), f.following);
    [0, 10, 35, 80].forEach((reach, i) => {
      const frame = createFrame(240, 200); drawFractures(painterFor(frame), lines, reach, fit(['#152235', '#6480a0', '#d4f0fa'], 8), { ox: 120, oy: 100 });
      assert.equal(hash({ color: [...frame.color], light: [...frame.light] }), f.pixels[i]);
    });
  }
});

test('explicit inherited distances survive projection and parent reordering without inventing topology', () => {
  const a = propagation.network({ id: 'tree', branches: branches(), project: ([x, y]) => [2 * x, .25 * y] });
  const b = propagation.network({ id: 'tree', branches: branches().reverse(), project: ([x, y]) => [2 * x, .25 * y] });
  assert.deepEqual(a, b); const tip = a.branches.find(b => b.id === 'tip'); close(tip.startPx, 11); close(tip.endPx, 16);
  const site = propagation.sites(a, { spacingPx: 5 }).find(s => s.branchId === 'branch' && s.localDistancePx === 5);
  assert.deepEqual(site.position, [10, 1.25]); assert.deepEqual(site.sourcePosition, [5, 5]); close(site.distancePx, 10);
  const equalPosition = propagation.network({ id: 'forest', branches: [{ id: 0, points: [[0, 0], [1, 0]] }, { id: 1, points: [[0, 0], [0, 1]] }] });
  assert(equalPosition.branches.every(b => b.parentId === null));
});

test('fractures exposes fork ancestry and the same mature geometry with bounded generation', () => {
  const n = propagation.fractures({ id: 'ice', seed: 731, arms: 7, inside: (x, y) => x * x / 10404 + y * y / 8100 < 1, stepPx: [3, 5], steps: 24, fork: .12, angle: .24 });
  const old = fractures(new Rng(731), (x, y) => x * x / 10404 + y * y / 8100 < 1, 0, 0, 7, { step: [3, 5], len: 24, fork: .12, a0: .24 });
  assert.deepEqual(n.branches.map(b => b.path.points).map(hash).sort(), old.map(p => p.map(q => q.slice(0, 2))).map(hash).sort());
  assert(n.branches.some(b => b.parentId !== null));
  for (const b of n.branches.filter(b => b.parentId !== null)) {
    const parent = n.branches.find(q => q.id === b.parentId); close(b.startPx, parent.startPx + b.attachPx);
  }
  assert.throws(() => propagation.fractures({ id: 'budget', arms: 100, steps: 100, fork: 1, inside: () => true }), { code: 'BUDGET_EXCEEDED', path: 'propagation.generatedPoints' });
  assert.throws(() => propagation.fractures({ id: 'bad', inside: () => 1 }), { path: 'propagation.inside.output' });
});

test('fixed-distance site lattice, deterministic greedy clearance and identity are independent of list order/material', () => {
  const a = propagation.network({ id: 'tree', branches: branches() }), b = propagation.network({ id: 'tree', branches: branches().reverse() });
  const opts = { spacingPx: 2, offsetPx: 1, minGapPx: 3, minDistancePx: 2, limit: 8 };
  const sites = propagation.sites(a, opts); assert.deepEqual(sites, propagation.sites(b, opts));
  assert.deepEqual(propagation.sites(a, { ...opts, limit: 4 }), sites.slice(0, 4));
  for (const s of sites) for (const t of sites) if (s.id !== t.id) assert(Math.hypot(s.position[0] - t.position[0], s.position[1] - t.position[1]) >= 3);
  const dense = propagation.sites(a, { spacingPx: 2 }), sparse = propagation.sites(a, { spacingPx: 4 });
  for (const s of sparse) assert(dense.some(q => q.id === s.id && q.distancePx === s.distancePx));
  assert.throws(() => propagation.sites(a, { spacingPx: .0001, limit: 1 }), { code: 'BUDGET_EXCEEDED' });
  assert.throws(() => propagation.sites(a, { minGapPx: 1e-20 }), { path: 'propagation.sites.minGapPx' });
  const short = propagation.network({ id: 'short', branches: [{ id: 'line', points: [[0, 0], [10, 0]] }] });
  assert.deepEqual(propagation.sites(short, { spacingPx: 1e12, offsetPx: 11 }), []);
  assert.deepEqual(propagation.sites(short, { spacingPx: 1e12, minDistancePx: 1 }), []);
});

test('front inversion has first-crossing plateau/hold/smooth/retreat semantics and bounded smooth error', () => {
  const linear = ramp([[.5, 0], [1, 10], [2, 10], [3, 20]]);
  close(propagation.arrival(linear, 10), 1); close(propagation.arrival(linear, 15), 2.5);
  assert.equal(propagation.arrival(linear, 21), Infinity);
  close(propagation.arrival(ramp([[0, 0], [1, 10]], 'hold'), 1), 1);
  const smooth = ramp([[.3, 0], [2.3, 100]], 'smooth');
  for (const d of [0, .001, 15, 50, 99.999, 100]) { const t = propagation.arrival(smooth, d); close(smooth.sample(t), d, 2e-11); }
  const retreat = ramp([[3, 20], [4, 0]], 'smooth'); close(propagation.arrival(retreat, 10, { direction: 'inward' }), 3.5);
  assert.throws(() => propagation.arrival(retreat, 10), { path: 'propagation.front.points' });
  assert.throws(() => propagation.arrival(curve.scalar({ points: [[0, 0], [1, 20]] }), 10), { path: 'propagation.front' });
  assert.throws(() => propagation.arrival(ramp([[0, 0], [1, 10], [2, 5]]), 4), { path: 'propagation.front.points' });
});

test('secondary births preserve cause/space/identity, skip unreached sites and drive the real emitter under jumps', () => {
  const n = propagation.network({ id: 'tree', branches: branches(), project: ([x, y]) => [x, .5 * y] });
  const sites = propagation.sites(n, { spacingPx: 5 }), front = ramp([[.2, 0], [1.2, 10]]);
  const settings = { id: 'buds', sites, front, count: 2, delay: .1 }, births = propagation.births(settings);
  assert(births.length > 0 && births.length < sites.length * 2);
  assert(births.every(b => b.born >= .3 && b.site.distancePx <= 10));
  const emitter = particle.emitter({ id: 'buds', seed: 7, births, initial: { life: .4, velocity: [0, -3] } });
  const before = particle.observe(emitter, .9); particle.observe(emitter, .1); particle.observe(emitter, 1.4); assert.deepEqual(particle.observe(emitter, .9), before);
  const again = propagation.births({ ...settings, sites: [...sites].reverse(), delay: .2 });
  assert.deepEqual(again.map(b => b.id).sort(), births.map(b => b.id).sort());
  const all = fps => { const ids = new Set(); for (let i = 0; i <= 2 * fps; i++) for (const q of schedule.alive(births, i / fps, { life: .4 })) ids.add(q.id); return [...ids].sort(); };
  assert.deepEqual(all(12), all(240));
  const original = births[0].position[0]; sites.find(s => s.id === births[0].site.id).position[0] = 999; assert.equal(births[0].position[0], original);
  assert.throws(() => propagation.births({ ...settings, sites: [sites[0], sites[0]] }), { path: 'propagation.site.id' });
  assert.throws(() => propagation.births({ ...settings, delay: -.1 }), { path: 'propagation.births.delay' });
});

test('segment clipping respects parent arrival, fractional front/tail and shared projection without bridges', () => {
  const n = propagation.network({ id: 'tree', branches: branches(), project: ([x, y]) => [x * 2, y * .5] });
  assert(propagation.segments(n, { toPx: 4.9 }).every(s => s.branchId === 'trunk'));
  const branch = propagation.segments(n, { fromPx: 6, toPx: 7.5 }).find(s => s.branchId === 'branch');
  assert.deepEqual(branch.a, [10, .5]); assert.deepEqual(branch.b, [10, 1.25]); close(branch.fromPx, 6); close(branch.toPx, 7.5);
  assert.deepEqual(propagation.segments(n, { toPx: -1 }), []);
  assert.deepEqual(propagation.segments(n, { fromPx: 8, toPx: 7 }), []);
  const collapsed = propagation.network({ id: 'flat', branches: [{ id: 'v', points: [[0, 0], [0, 10]] }], project: () => [1, 1] });
  assert.equal(propagation.sites(collapsed, { spacingPx: 5 })[1].tangent, undefined);
});

test('topology/coordinates/budgets reject actionable errors rather than guessing a repaired graph', () => {
  const make = branches => propagation.network({ id: 'bad', branches });
  assert.throws(() => make([{ id: 'x', parentId: 'x', points: [[0, 0], [1, 1]] }]), { path: 'propagation.branch.parentId' });
  assert.throws(() => make([{ id: 'x', parentId: 'missing', points: [[0, 0], [1, 1]] }]), { path: 'propagation.branch.parentId' });
  assert.throws(() => make([...branches(), branches()[0]]), { path: 'propagation.branch.id' });
  assert.throws(() => make(branches().map(b => b.id === 'branch' ? { ...b, attachPx: 21 } : b)), { path: 'propagation.branch.attachPx' });
  assert.throws(() => make(branches().map(b => b.id === 'branch' ? { ...b, attachPx: 7 } : b)), { path: 'propagation.branch.points[0]' });
  assert.throws(() => make([{ id: 'x', points: Array.from({ length: 10001 }, (_, i) => [i, 0]) }]), { code: 'BUDGET_EXCEEDED' });
  assert.throws(() => make([{ id: 'x', points: [[-1e308, 0], [1e308, 0]] }]), { path: 'propagation.branch.lengthPx' });
  assert.throws(() => propagation.network({ id: 'overflow', branches: [{ id: 'x', points: [[0, 0], [10, 0]] }], project: ([x, y]) => [x ? 1e308 : -1e308, y] }), { path: 'propagation.project.segment' });
  assert.throws(() => propagation.network({ id: 'norm-overflow', branches: [{ id: 'x', points: [[0, 0], [10, 0]] }], project: ([x]) => x ? [1.5e308, 1.5e308] : [0, 0] }), { path: 'propagation.project.segment' });
  assert.deepEqual(propagation.sites(make([])), []);
});

test('public distance-propagation discovery returns directed contracts and mechanism composition', () => {
  assert(apiResources('分叉 到达').some(r => r.ref.id === 'core/propagation'));
  const c = inspectApi({ id: 'core/propagation' });
  assert.match(c.sections.contract, /minGapPx/); assert.match(c.sections.example, /particle.emitter/); assert.equal(c.sections.source, undefined);
});
