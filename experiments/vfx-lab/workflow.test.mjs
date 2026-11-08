import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync, execFile } from 'node:child_process';
import { LAB, RECORDS, execute } from './lab.mjs';
import { invoke } from './invoke.mjs';
import { decodePNG } from '../../tools/lib/png.mjs';
import { createLabServer } from './server.mjs';

const hash = b => createHash('sha256').update(b).digest('hex');
const fixture = () => {
  const name = `window-${randomUUID().slice(0, 8)}`;
  mkdirSync(join(LAB, 'drafts'), { recursive: true });
  return { id: `draft/${name}`, file: join(LAB, 'drafts', name + '.js') };
};
const source = (size = [288, 192], release = 0.2, origin = [15, 15]) => `export const meta={name:'Window fixture',size:${JSON.stringify(size)},origin:${JSON.stringify(origin)},duration:1,options:{seed:4}};export const events={release:${release}};export function draw(p,t){if(t>=1)return;p.rect(-2,-2,4,4,Math.abs(t-0.3)<.001?0xff00ff00:0xff0000ff);p.light(5,0,0xffffffff,.008);}`;
const clean = run => rmSync(join(RECORDS, run), { recursive: true, force: true });

test('one frozen window returns every short-peak frame in bounded native pages without current source', async () => {
  const f = fixture(), runs = [];
  try {
    writeFileSync(f.file, source());
    const rendered = await invoke('render', { id: f.id, background: 'black' }); runs.push(rendered.run);
    const manifestBefore = readFileSync(rendered.manifest); rmSync(f.file);
    const p = await invoke('probe', { run: rendered.run, view: 'color', window: { event: 'release', from: -0.2, to: 0.2 } }); runs.push(p.run);
    assert.equal(p.samples.length, 13); assert.equal(p.pages.length, 2); assert.equal(p.pixelScale, 1);
    assert.deepEqual(p.samples.map(s => s.sourceIndex), Array.from({ length: 13 }, (_, i) => i));
    assert.equal(p.window.omittedPositions.length, 0); assert.equal(p.playback.viewed, false);
    const cells = p.pages.flatMap(page => {
      assert(page.width <= 1120 && page.height <= 1024); assert.equal(hash(readFileSync(page.image)), page.sha256);
      const png = decodePNG(readFileSync(page.image));
      return page.cells.map(c => {
        assert.deepEqual([c.frameRect.w, c.frameRect.h], [288, 192]);
        const index = (c.frameRect.y + 15) * png.width * 4 + (c.frameRect.x + 15) * 4;
        assert.deepEqual([...png.data.subarray(index, index + 4)], p.samples[c.sampleIndex].sourceIndex === 9 ? [0, 255, 0, 255] : [255, 0, 0, 255]);
        return c.sampleIndex;
      });
    });
    assert.deepEqual(cells.sort((a, b) => a - b), Array.from({ length: 13 }, (_, i) => i));
    assert.equal(hash(readFileSync(p.playback.file)), p.playback.sha256);
    assert.match(readFileSync(p.playback.file, 'utf8'), /Previous frame/); assert.match(readFileSync(p.playback.file, 'utf8'), /requestAnimationFrame/);
    assert.deepEqual(readFileSync(rendered.manifest), manifestBefore);
    const light = await invoke('probe', { run: rendered.run, view: 'light', at: { times: [0.3] }, layout: {} }); runs.push(light.run);
    const page = decodePNG(readFileSync(light.image)), rect = light.pages[0].cells[0].frameRect;
    const pixel = (x, y) => [...page.data.subarray((y * page.width + x) * 4, (y * page.width + x) * 4 + 4)];
    assert.deepEqual(pixel(rect.x + 20, rect.y + 15), [2, 2, 2, 255]); assert.deepEqual(pixel(rect.x + 21, rect.y + 15), [0, 0, 0, 255]);
    await assert.rejects(invoke('probe', { run: rendered.run, window: { from: 0, to: 0.3 }, layout: { maxWidth: 500, columns: 2 } }), { code: 'BUDGET_EXCEEDED' });
  } finally { rmSync(f.file, { force: true }); runs.forEach(clean); }
});

test('aligned windows preserve different FPS/event clocks, report repeats/gaps, and thin only on explicit request', async () => {
  const f = fixture(), runs = [];
  try {
    writeFileSync(f.file, source([24, 24], 0.2)); const a = await invoke('render', { id: f.id, fps: 12 }); runs.push(a.run);
    writeFileSync(f.file, source([24, 24], 0.3, [17, 16])); const b = await invoke('render', { id: f.id, fps: 30 }); runs.push(b.run);
    const p = await invoke('compare', { runs: [a.run, b.run], event: 'release', window: { from: -0.4, to: 0.3 } }); runs.push(p.run);
    assert.equal(p.alignment, 'event'); assert(p.samples.some(s => s.clamped)); assert(p.samples.some(s => s.duplicateOf !== null));
    const inside = b.frames ?? JSON.parse(readFileSync(b.manifest)).frames;
    for (const frame of inside.filter(f => f.t - 0.3 >= -0.4 && f.t - 0.3 <= 0.3)) assert(p.samples.some(s => s.run === b.run && s.sourceIndex === frame.index));
    assert(p.differingConditions.includes('fps')); assert(p.differingConditions.includes('origin'));
    const sparse = await invoke('compare', { runs: [a.run, b.run], event: 'release', window: { from: -0.1, to: 0.3, every: 3 } }); runs.push(sparse.run);
    assert(sparse.window.omittedPositions.length); assert(sparse.samples.length < p.samples.length);
    const manifest = JSON.parse(readFileSync(a.manifest)); manifest.frames.splice(2, 2); writeFileSync(a.manifest, JSON.stringify(manifest));
    const gap = await invoke('probe', { run: a.run, window: { from: 0, to: 0.5 } }); runs.push(gap.run);
    assert.equal(gap.window.gaps[0].gaps[0].estimatedMissingSamples, 2);
    await assert.rejects(invoke('probe', { run: b.run, window: { from: 1.1, to: 1.2 } }), { code: 'SAMPLING_INSUFFICIENT' });
    await assert.rejects(invoke('compare', { runs: [a.run, b.run], window: { from: 0.2, to: 0.1 } }), { code: 'INVALID_INPUT' });
    await assert.rejects(invoke('probe', { run: b.run, at: { times: [0.1] }, window: { from: 0, to: 0.3 } }), { code: 'INVALID_INPUT' });
  } finally { rmSync(f.file, { force: true }); runs.forEach(clean); }
});

test('default particle probes find active late births while explicit IDs and birth-order retain inactive states', async () => {
  const f = fixture(); let run;
  try {
    writeFileSync(f.file, `import{particle,schedule}from'../../../src/authoring/index.js';export const meta={name:'Active fixture',size:[32,32],origin:[16,16],duration:1,options:{seed:1}};const e=particle.emitter({id:'pieces',births:[...schedule.burst({id:'early',at:0,count:2}),...schedule.burst({id:'late',at:.6,count:2})],initial:{life:.2,velocity:[0,0]}});export function draw(p,t){particle.draw(p,e,t,{draw:(p,s)=>p.px(...s.position,0xffffffff)})}export function observe(t){return{particles:[particle.observe(e,t)]}}`);
    run = (await invoke('render', { id: f.id })).run;
    const active = await invoke('probe', { run, view: 'particles', at: { times: [0.7] }, limit: 1 });
    assert.equal(active.births[0].id, 'late/0'); assert.equal(active.samples[0].states[0].status, 'alive'); assert.equal(active.selection.omittedActive, 1);
    const first = await invoke('probe', { run, view: 'particles', at: { times: [0.7] }, limit: 1, selection: 'birth-order' });
    assert.equal(first.births[0].id, 'early/0'); assert.equal(first.samples[0].states[0].status, 'expired');
    const explicit = await invoke('probe', { run, view: 'particles', at: { times: [0.7] }, particles: ['early/1'] }); assert.equal(explicit.samples[0].states[0].status, 'expired');
    const order = await invoke('probe', { run, view: 'particles', at: { times: [0.7, 0.1] }, limit: 1 }); assert.equal(order.births[0].id, 'late/0');
    const empty = await invoke('probe', { run, view: 'particles', at: { times: [0.9] } }); assert.equal(empty.births.length, 0); assert.equal(empty.samples[0].counts[0].expired, 4);
  } finally { rmSync(f.file, { force: true }); if (run) clean(run); }
});

test('automatic history records exact tool outcomes and explicit selection survives a newer run', async () => {
  const f = fixture(), runs = [];
  try {
    writeFileSync(f.file, source([24, 24])); const a = await invoke('render', { id: f.id }); runs.push(a.run);
    const view = await invoke('probe', { run: a.run, window: { from: 0.1, to: 0.3 } }); runs.push(view.run);
    const selected = await invoke('history', { action: 'select', run: a.run, reason: 'Preserve the short green peak', evidence: [view.callRef] });
    assert.equal(selected.decision.selectedRun, a.run); assert.equal(selected.decision.evidence[0], view.callRef);
    const b = await invoke('render', { id: f.id, note: 'New run is not automatically selected' }); runs.push(b.run);
    const v = await invoke('validate', { run: a.run }); assert.equal(v.passed, true);
    const e = await invoke('export', { run: a.run, validationRef: v.validationRef });
    const history = await invoke('history', { id: f.id, callLimit: 60 }); assert.equal(history.decision.selectedRun, a.run);
    assert.equal(history.calls.items.filter(c => c.callRef === a.callRef).length, 1); assert(history.calls.items.some(c => c.references?.validationRef === v.validationRef)); assert(history.calls.items.some(c => c.references?.directory === e.directory));
    const raw = await invoke('history', { callRef: view.callRef }); assert.deepEqual(raw.call.result.samples, view.samples); assert.deepEqual(raw.call.arguments, { run: a.run, window: { from: 0.1, to: 0.3 } }); assert.equal(raw.runs.length, 0); assert.equal(raw.calls, undefined);
    const failure = await invoke('history', { action: 'select', run: a.run, reason: 'bad evidence', evidence: [b.callRef] }).catch(e => e);
    assert.equal(failure.code, 'CONTRACT_MISMATCH'); const failed = await invoke('history', { callRef: failure.callRef }); assert.equal(failed.call.status, 'failed'); assert.equal(failed.call.error.code, failure.code);
    assert.equal((await invoke('history', { id: f.id })).decision.selectedRun, a.run);
    const recordPath = join(RECORDS, 'calls', `${view.callRef}.json`), before = readFileSync(recordPath);
    try {
      writeFileSync(recordPath, '{damaged');
      assert((await invoke('history', { id: f.id })).calls.skipped.some(c => c.callRef === view.callRef));
      await assert.rejects(invoke('history', { callRef: view.callRef }), { code: 'CONTRACT_MISMATCH' });
    } finally { writeFileSync(recordPath, before); }
  } finally { rmSync(f.file, { force: true }); runs.forEach(clean); }
});

test('invalid JSON and an actually interrupted CLI retain recoverable original public call records', async () => {
  const malformed = spawnSync(process.execPath, [join(LAB, 'cli.mjs'), 'render', '{invalid'], { encoding: 'utf8' });
  const err = JSON.parse(malformed.stdout).error; assert.equal(err.code, 'INVALID_INPUT');
  const raw = await invoke('history', { callRef: err.callRef }); assert.equal(raw.call.arguments.rawInput, '{invalid'); assert.equal(raw.call.error.message, err.message);
  const f = fixture();
  try {
    writeFileSync(f.file, 'process.exit(7);');
    const interrupted = await invoke('render', { id: f.id }).catch(e => e);
    assert.equal(interrupted.code, 'TOOL_PROCESS_FAILED'); assert(interrupted.callRef);
    const call = (await invoke('history', { callRef: interrupted.callRef })).call;
    assert.equal(call.status, 'interrupted'); assert.deepEqual(call.arguments, { id: f.id }); assert.equal(call.error.code, 'TOOL_PROCESS_FAILED');
  } finally { rmSync(f.file, { force: true }); }
});

test('ordinary JavaScript primitive throws retain their original diagnostic and completed failed record', async () => {
  const f = fixture();
  try {
    for (const expression of ["'ORIGINAL_DRAW_FAILURE'", 'null', "Object.freeze(new Error('FROZEN_DRAW_FAILURE'))"]) {
      writeFileSync(f.file, `export const meta={name:'Throw fixture',size:[16,16],origin:[8,8],duration:.2,options:{}};export function draw(){throw ${expression}}`);
      const err = await invoke('render', { id: f.id }).catch(e => e);
      const expected = expression === 'null' ? 'null' : expression.includes('FROZEN') ? 'FROZEN_DRAW_FAILURE' : 'ORIGINAL_DRAW_FAILURE';
      assert.equal(err.message, expected); assert.equal(err.code, 'TOOL_ERROR');
      const call = (await invoke('history', { callRef: err.callRef })).call;
      assert.equal(call.status, 'failed'); assert.equal(call.error.message, expected); assert.equal(call.error.callRef, err.callRef);
    }
  } finally { rmSync(f.file, { force: true }); }
});

test('import-time SDK construction preserves the original parameter diagnostic and author call site',async()=>{
 const f=fixture();try{writeFileSync(f.file,`import{gather}from'../../../src/authoring/index.js';export const meta={name:'Bad payload',size:[16,16],origin:[8,8],duration:.2};const values=gather.records({id:'bad',events:[{id:'one',target:'arm',time:0,position:[0,0],data:{bank:undefined}}]});export function draw(){}`);
 const err=await invoke('render',{id:f.id}).catch(e=>e);assert.equal(err.path,'gather.events[one].data.bank');assert.equal(err.code,'CONTRACT_MISMATCH');assert.match(err.recovery,/authoring API/);assert.equal(err.details.location.file,f.file);assert(!err.message.includes('Cannot load effect'));
 }finally{rmSync(f.file,{force:true});}
});

test('source capture input is independent of stdin EOF while retaining exact source and real import syntax', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'athanor-parser-test-'));
  const snapshot = { 'effect.js': `// import 'fake-comment';\nimport { x } from './helper.js';\nexport const label = '潮汐 \\u2728';\nexport const text = "import 'fake-string'";`, 'helper.js': 'export const x=1;' };
  try {
    const input = join(directory, 'input.json'); writeFileSync(input, JSON.stringify({ snapshot }));
    const output = await new Promise((resolve, reject) => {
      const child = execFile(process.execPath, ['--experimental-vm-modules', '--no-warnings', join(LAB, 'source-parser.mjs'), '--parse-worker', input], { timeout: 3000 }, (error, stdout) => error ? reject(error) : resolve(JSON.parse(stdout)));
      // Deliberately do not close stdin: a worker waiting for EOF will hang.
      child.stdin.on('error', () => {}); child.stdin.write('unused open input');
    });
    assert.deepEqual(output.snapshot, snapshot); assert.deepEqual(output.dependencies, { 'effect.js': ['./helper.js'], 'helper.js': [] });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('HTTP serves the same native pages/player and MCP returns every page rather than just the first', async () => {
  const f = fixture(), runs = []; let server;
  try {
    writeFileSync(f.file, source()); const a = await invoke('render', { id: f.id }); runs.push(a.run);
    server = createLabServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(base + '/api/call', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'probe', arguments: { run: a.run, window: { from: 0, to: 0.4 } } }) });
    const result = (await response.json()).result; runs.push(result.run); assert.equal(result.pages.length, 2); assert(result.callRef);
    const html = await (await fetch(base + result.playback.urlPath)).text(); assert.match(html, /Loop window/); assert.match(html, new RegExp(a.run));
    // Transport checks only; actual encoding/decoding belongs to animation.test.
    for (const [extension, type, bytes] of [['mp4', 'video/mp4', Buffer.from('transport fixture')], ['gif', 'image/gif', Buffer.from('GIF89a')]]) {
      const name = `transport.${extension}`;
      writeFileSync(join(RECORDS, a.run, name), bytes);
      const media = await fetch(`${base}/artifacts/${a.run}/${name}`);
      assert.equal(media.status, 200); assert.equal(media.headers.get('content-type'), type);
      assert.deepEqual(Buffer.from(await media.arrayBuffer()), bytes);
    }
    const messages = [{ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'fx_probe', arguments: { run: a.run, window: { from: 0, to: 0.4 } } } }];
    const stdout = await new Promise((resolve, reject) => { const child = execFile(process.execPath, [join(LAB, 'mcp.mjs')], { maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => err ? reject(err) : resolve(stdout)); child.stdin.end(messages.map(m => JSON.stringify(m)).join('\n') + '\n'); });
    const rpc = stdout.trim().split('\n').map(s => JSON.parse(s)).find(r => r.id === 2).result; runs.push(rpc.structuredContent.run);
    assert.equal(rpc.content.filter(c => c.type === 'image').length, 2); assert.equal(rpc.structuredContent.pages.length, 2); assert(rpc.structuredContent.callRef);
  } finally { if (server) await new Promise(resolve => server.close(resolve)); rmSync(f.file, { force: true }); runs.forEach(clean); }
});
