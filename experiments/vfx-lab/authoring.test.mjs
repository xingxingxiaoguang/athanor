import test from 'node:test';
import assert from 'node:assert/strict';
import { random, curve, path, domain, schedule, motion, mask, field, image, light } from '../../src/authoring/index.js';
import { createFrame, painterFor, hex } from '../../src/core/index.js';
import { writeFileSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { LAB, RECORDS, execute } from './lab.mjs';
import { invoke } from './invoke.mjs';

const close = (a, b, tolerance = 1e-8) => assert(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const square = (id = 'shell', space = 'effect') => mask.make({ id, w: 10, h: 8, origin: [-5, -4], space, test: () => true });

test('named channels and sample identities survive unrelated random calls and count changes', () => {
  const key = { seed: 7, layer: 'main', id: 4, channel: 'position' }, a = random.unit(key);
  random.unit({ ...key, channel: 'color' }); assert.equal(random.unit(key), a);
  assert.notEqual(random.unit({ ...key, layer: 'other' }), a);
  const circle = domain.circle({ id: 'rim', radius: 10 });
  const first = domain.sample({ domain: circle, measure: 'area', count: 20, seed: 7 });
  assert.deepEqual(domain.sample({ domain: circle, count: 50, seed: 7 }).slice(0, 20), first);
  const many = domain.sample({ domain: circle, count: 10000, seed: 7 });
  const meanR2 = many.reduce((sum, p) => sum + p.position[0] ** 2 + p.position[1] ** 2, 0) / many.length;
  assert(meanR2 > 48 && meanR2 < 52, `Area mean radius squared is ${meanR2}; expected ~50`);
  assert(first.every((p) => p.normal === undefined));
  assert.throws(() => domain.sample({ domain: circle, count: 10001 }), { code: 'BUDGET_EXCEEDED' });
});

test('arc-length samples, open endpoints, corner tangents and adaptive cubic approximation are explicit', () => {
  const line = path.polyline({ id: 'unequal', points: [[0, 0], [10, 0], [110, 0], [110, 0]] });
  for (let i = 0; i <= 4; i++) close(path.sample(line, i / 4).position[0], 27.5 * i);
  const corner = path.polyline({ id: 'corner', points: [[0, 0], [10, 0], [10, 10]] });
  assert.deepEqual(path.sample(corner, 0.5).tangent, [0, 1]);
  assert.deepEqual(path.sample(corner, 1).position, [10, 10]);
  const cubic = path.bezier({ id: 'curve', points: [[0, 0], [0, 20], [20, 20], [20, 0]], tolerancePx: 0.05 });
  close(path.sample(cubic, 0.5).position[0], 10, 0.1); close(path.sample(cubic, 0.5).position[1], 15, 0.1);
  assert.throws(() => path.polyline({ id: 'bad', points: [[1, 1], [1, 1]] }), { code: 'CONTRACT_MISMATCH' });
  assert.throws(() => path.sample(line, 2, { boundary: 'error' }), { code: 'CONTRACT_MISMATCH' });
  assert.throws(() => path.bezier({ id: 'budget', points: [[0, 0], [0, 100], [100, 100], [100, 0]], tolerancePx: 1e-9, maxDepth: 1 }), { code: 'BUDGET_EXCEEDED' });
});

test('continuous strip has no centerline holes and palette-only changes preserve coverage', () => {
  const route = path.bezier({ id: 'ribbon', points: [[2, 5], [12, 0], [18, 20], [28, 15]] });
  const draw = (color) => { const f = createFrame(32, 24); path.strip(painterFor(f), route, { color, width: (s) => 4 + Math.sin(s * Math.PI) * 2 }); return f; };
  const a = draw('#f80'), b = draw('#08f'); assert.deepEqual([...a.color].map(Boolean), [...b.color].map(Boolean));
  for (const { position: [x, y] } of path.resample(route, { spacingPx: 0.3 })) assert(a.color[Math.floor(y) * 32 + Math.floor(x)] >>> 24);
  assert.throws(() => draw('orange'), { code: 'CONTRACT_MISMATCH' });
});

test('curves preserve specified interpolation, units, limits and endpoint behavior', () => {
  const ramp = curve.scalar({ points: [[0, 0], [0.3, 2], [1, 0]], input: 'particle.age01', outputUnit: 'pixels' });
  close(ramp.sample(0.15), 1); assert.equal(ramp.sample(-1), 0); assert.equal(ramp.outputUnit, 'pixels');
  const hold = curve.scalar({ points: [[0, 0], [1, 1]], interpolation: 'hold' }); assert.equal(hold.sample(0.99), 0); assert.equal(hold.sample(1), 1);
  const smooth = curve.scalar({ points: [[0, 0], [1, 1]], interpolation: 'smooth' }); close(smooth.sample(0.25), 0.15625);
  const extended = curve.scalar({ points: [[0, 0], [1, 2]], limits: [0, 2], extrapolation: 'extend' });
  assert.throws(() => extended.sample(2), { code: 'CONTRACT_MISMATCH' });
  assert.throws(() => curve.scalar({ points: [[1, 0], [0, 2]] }), { code: 'CONTRACT_MISMATCH' });
  assert.throws(() => curve.scalar({ points: [[0, 0], [1, 1]], interpolation: 'bezier' }), { code: 'CONTRACT_MISMATCH' });
});

test('schedule is half-open and ballistic motion is analytical under drag, including near-zero drag', () => {
  const births = schedule.rate({ id: 'stream', start: 0.1, end: 0.6, rate: 10 }); assert.equal(births.length, 5); assert.equal(births[0].born, 0.1); assert.equal(births.at(-1).born, 0.5);
  assert.equal(schedule.alive([{ id: 'one', born: 0.1 }], 0.6, { life: 0.5 }).length, 0);
  const settings = { position: [2, 3], velocity: [4, -5], acceleration: [2, 10], age: 0.7 };
  const noDrag = motion.ballistic(settings), smallDrag = motion.ballistic({ ...settings, drag: 1e-12 });
  noDrag.position.forEach((v, i) => close(v, smallDrag.position[i]));
  const drag = motion.ballistic({ ...settings, drag: 2 }), e = Math.exp(-1.4), f = (1 - e) / 2;
  close(drag.position[0], 2 + 4 * f + 2 * (0.7 - f) / 2); close(drag.velocity[1], -5 * e + 10 * f);
});

test('mask operations and rank/arrival fields share coordinate contracts without guessing units', () => {
  const shell = square(), rim = mask.outline(shell); assert.equal(rim.data.reduce((a, b) => a + b), 32);
  const weighted = field.scalar({ id: 'density', range: [0, 1], sample: (x) => x > 0 ? 1 : 0 });
  assert(domain.sample({ domain: shell, count: 50, densityField: weighted }).every((p) => p.position[0] > 0));
  const ranked = field.rank({ id: 'left-right', mask: shell, score: (x, y) => x + y * 0.01 });
  const arrival = field.arrival({ id: 'burn', rank: ranked, start: 0.4, end: 1.2 });
  close(arrival.sample(-4.5, -3.5), 0.4); close(arrival.sample(4.5, 3.5), 1.2); assert.equal(arrival.sample(100, 100), Infinity);
  assert.throws(() => image.dissolve({ mask: square('other', 'body'), field: arrival, threshold: 0.7 }), { code: 'CONTRACT_MISMATCH' });
  const changedShape = mask.make({ ...shell, id: 'changed', test: (x) => x > 0 });
  assert.throws(() => image.dissolve({ mask: changedShape, field: arrival, threshold: 0.7 }), { code: 'CONTRACT_MISMATCH' });
  assert.throws(() => weighted.sample(NaN, 0), { code: 'CONTRACT_MISMATCH' });
  assert.throws(() => mask.make({ id: 'alpha', w: 2, h: 2, test: () => 0.5 }), { code: 'CONTRACT_MISMATCH' });
});

test('dissolve exposes actual regions, including dynamic-field additions at an unchanged threshold', () => {
  const source = square();
  const dynamic = field.scalar({ id: 'reversing', range: [-5, 5], sample: (x, y, t) => t === 0 ? x : -x });
  const previous = image.dissolve({ mask: source, field: dynamic, threshold: 0, edgeBand: 1, time: 0 });
  const current = image.dissolve({ mask: source, field: dynamic, threshold: 0, edgeBand: 1, time: 1, previous });
  assert.equal(current.removedMask.data.reduce((a, b) => a + b), 40); assert.equal(current.addedMask.data.reduce((a, b) => a + b), 40);
  assert.deepEqual(current.interval, [0, 1]);
  assert.equal(current.edgeMask.data.reduce((a, b) => a + b), 8);
  assert.throws(() => image.dissolve({ mask: source, field: dynamic, threshold: 0, time: 0, previous }), { code: 'CONTRACT_MISMATCH' });
});

test('first-arrival births are independent of fps/jumps and density edits retain particle identities', () => {
  const source = square(), rank = field.rank({ id: 'ranks', mask: source, score: (x, y) => x + y * 0.1 });
  const arrival = field.arrival({ id: 'times', rank, start: 0.2, end: 1 });
  const settings = { id: 'ash', mask: source, arrival, seed: 7 };
  const births = image.dissolveEvents(settings), sparse = image.dissolveEvents({ ...settings, density: 0.3 });
  assert.equal(new Set(births.map((b) => b.id)).size, 80); assert(sparse.every((b) => births.some((a) => a.id === b.id && a.born === b.born)));
  const collect = (fps) => { const ids = new Set(); for (let i = 0; i <= fps * 2; i++) for (const b of schedule.alive(births, i / fps, { life: 0.2 })) ids.add(b.id); return [...ids].sort(); };
  assert.deepEqual(collect(30), collect(240)); assert.deepEqual(collect(30), births.map((b) => b.id).sort());
  assert.deepEqual(image.dissolveEvents(settings), births);
  assert.throws(() => image.dissolveEvents({ ...settings, maxEvents: 10 }), { code: 'BUDGET_EXCEEDED' });
});

test('mask drawing and light share original art pixels and accept checked hex at the boundary', () => {
  const m = mask.make({ id: 'dot', w: 2, h: 2, origin: [1, 1], test: () => true });
  const frame = createFrame(4, 4), p = painterFor(frame);
  image.draw(p, m, { color: '#f80', alpha: 0.25, transparency: 'soft' });
  assert.equal(frame.color[5] & 0xffffff, hex('#f80') & 0xffffff); assert.equal(frame.color[5] >>> 24, 63);
  light.fromMask(p, m, { color: '#fff', intensity: 0.2 }); assert(frame.light[5] & 0xffffff);
  assert.throws(() => image.draw(p, m, { color: [255, 128, 0] }), { code: 'CONTRACT_MISMATCH' });
});

test('search survives ordinary helper modules and broken candidates (independent creator finding A-01)', async () => {
  const suffix = randomUUID().slice(0, 8), helper = join(LAB, 'drafts', `test-helper-${suffix}.js`), broken = join(LAB, 'drafts', `test-broken-${suffix}.js`);
  mkdirSync(join(LAB, 'drafts'), { recursive: true }); writeFileSync(helper, 'export const curve = u => u*u;'); writeFileSync(broken, 'export const meta = ;');
  try {
    const found = await execute('search', { query: '冰霜' }); assert(found.effects.some((e) => e.id === 'ice/frost-nova')); assert.equal(found.partial, true);
    assert(found.diagnostics.some((d) => d.id === `draft/test-helper-${suffix}`)); assert(found.diagnostics.some((d) => d.id === `draft/test-broken-${suffix}`));
  } finally { rmSync(helper); rmSync(broken); }
});

test('new SDK import closure freezes and replays after custom effect removal', async () => {
  const name = `test-${randomUUID().slice(0, 8)}`, file = join(LAB, 'drafts', `${name}.js`); const runs = [];
  writeFileSync(file, `import {path,curve} from '../../../src/authoring/index.js';\nexport const meta={name:'SDK fixture',desc:'Continuous ribbon integration fixture',tags:['test'],size:[32,32],origin:[0,0],duration:0.2,options:{seed:7}}; const route=path.polyline({id:'route',points:[[3,5],[20,20]]}); export function draw(p,t){if(t>=meta.duration)return;path.strip(p,route,{width:3,color:'#f80'})}`);
  try {
    const rendered = await invoke('render', { id: `draft/${name}` }); runs.push(rendered.run); assert.equal(rendered.replay.available, true);
    rmSync(file); const report = await invoke('validate', { run: rendered.run }); assert.equal(report.passed, true, JSON.stringify(report.errors)); assert.equal(report.coverage.seeds.length, 2);
    const replay = await invoke('render', { run: rendered.run }); runs.push(replay.run);
    assert.deepEqual(readFileSync(join(rendered.directory, 'color.png')), readFileSync(join(replay.directory, 'color.png')));
  } finally { rmSync(file, { force: true }); runs.forEach((run) => rmSync(join(RECORDS, run), { recursive: true, force: true })); }
});

test('module syntax errors point to editable source, while malformed argument JSON points to arguments', async () => {
  const name = `test-invalid-${randomUUID().slice(0, 8)}`, file = join(LAB, 'drafts', `${name}.js`);
  writeFileSync(file, 'export const meta = ;');
  try {
    await assert.rejects(invoke('inspect', { id: `draft/${name}` }), (error) => error.code === 'CONTRACT_MISMATCH' && error.path === file && /JavaScript syntax/.test(error.recovery));
  } finally { rmSync(file, { force: true }); }
  const invalid = await new Promise((resolve) => execFile(process.execPath, [join(LAB, 'cli.mjs'), 'inspect', '{'], (error, stdout) => resolve({ error, output: JSON.parse(stdout) })));
  assert.equal(invalid.error.code, 1); assert.equal(invalid.output.error.code, 'INVALID_INPUT'); assert.equal(invalid.output.error.path, 'arguments');
});

test('saved PNG reader handles wire fixtures for all five filters and preserves transparent RGB', async () => {
  const { decodePNG } = await import('../../tools/lib/png.mjs');
  const known = JSON.parse(readFileSync(join(LAB, 'fixtures/png-filters.json'), 'utf8'));
  for (const fixture of known.fixtures) {
    const png = Buffer.from(fixture.png, 'base64'), decoded = decodePNG(png);
    assert.equal(decoded.width, 2); assert.equal(decoded.height, 2); assert.deepEqual([...decoded.data], known.rgba, `PNG filter ${fixture.filter}`);
    const bad = Buffer.from(png); bad[40] ^= 1; assert.throws(() => decodePNG(bad), /checksum/);
  }
});

test('channel windows read frozen atlases without current source or a custom crop script', async () => {
  const name = `test-${randomUUID().slice(0, 8)}`, file = join(LAB, 'drafts', `${name}.js`), runs = [];
  writeFileSync(file, `export const meta={name:'Channels',desc:'Separated color/light observation fixture',tags:['test'],size:[16,16],origin:[8,8],duration:.2,options:{seed:1}};export function draw(p,t){if(t>=.2)return;p.px(0,0,0xff0000ff);p.light(1,0,0xff00ff00,.5);p.light(2,0,0xffffffff,.008)}`);
  try {
    const saved = await invoke('render', { id: `draft/${name}` }); runs.push(saved.run); rmSync(file);
    const { decodePNG } = await import('../../tools/lib/png.mjs');
    for (const channel of ['preview', 'color', 'light', 'combined']) {
      const view = await invoke('compare', { runs: [saved.run, saved.run], alignment: 'time', times: [.05], channel }); runs.push(view.run);
      assert.equal(view.channel, channel); assert.equal(view.representation, 'saved-images'); assert.equal(view.pixelScale, 1);
      const pixels = decodePNG(readFileSync(view.image));
      const pixel = (x, y) => [...pixels.data.subarray((y * pixels.width + x) * 4, (y * pixels.width + x) * 4 + 4)];
      if (channel === 'color') assert.deepEqual(pixel(16, 48), [255, 0, 0, 255]);
      if (channel === 'light') { assert.deepEqual(pixel(17, 48), [0, 127, 0, 255]); assert.deepEqual(pixel(18, 48), [2, 2, 2, 255]); assert.deepEqual(pixel(19, 48), [0, 0, 0, 255]); assert.equal(view.exposure, 1); assert.match(view.background, /black additive/); }
    }
    writeFileSync(join(saved.directory, 'color.png'), 'bad saved atlas');
    await assert.rejects(invoke('compare', { runs: [saved.run, saved.run], alignment: 'time', times: [.05], channel: 'color' }), (error) => error.code === 'CONTRACT_MISMATCH' && /saved color evidence/.test(error.message));
    await assert.rejects(execute('compare', { runs: [saved.run, saved.run], alignment: 'time', times: [.05], channel: 'layers' }), { code: 'INVALID_INPUT' });
    writeFileSync(join(saved.directory, 'preview.rgba'), 'truncated');
    await assert.rejects(invoke('compare', { runs: [saved.run, saved.run], alignment: 'time', times: [.05] }), (error) => error.code === 'CONTRACT_MISMATCH' && /buffer length/.test(error.message));
  } finally { rmSync(file, { force: true }); runs.forEach((run) => rmSync(join(RECORDS, run), { recursive: true, force: true })); }
});

test('polygon masks supply concave point-in-region scans while leaving vertices and cutouts editable', () => {
  const paper = mask.polygon({ id: 'concave', points: [[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]] });
  assert.deepEqual(paper.origin, [0, 0]); assert.equal(paper.w, 3); assert.equal(paper.h, 3);
  assert.deepEqual([...paper.data], [1, 1, 1, 1, 0, 0, 1, 0, 0]);
  const cut = mask.derive(paper, 'cut', (x, y, i) => !!paper.data[i] && y > 1); assert.equal(cut.data.reduce((a, b) => a + b), 2);
  const shifted = mask.polygon({ id: 'shifted', points: [[-1, -1], [1, -1], [1, 1], [-1, 1]] }); assert.deepEqual(shifted.origin, [-1, -1]); assert.deepEqual([...shifted.data], [1, 1, 1, 1]);
  assert.throws(() => mask.polygon({ id: 'bad', points: [[0, 0], [1, 1]] }), { code: 'CONTRACT_MISMATCH' });
});
