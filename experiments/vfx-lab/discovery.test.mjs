import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../../tools/lib/fxlib.mjs';
import { TOOLS } from './definitions.mjs';
import { execute } from './lab.mjs';
import { invoke } from './invoke.mjs';
import { createLabServer } from './server.mjs';

const exec = promisify(execFile), cli = join(ROOT, 'experiments/vfx-lab/cli.mjs');
test('bare CLI discovery finishes without stdin EOF, stays short, and supports exact one/all definitions', async () => {
  const bare = JSON.parse((await exec(process.execPath, [cli, 'tools'], { timeout: 5000 })).stdout).result;
  assert.equal(bare.tools.length, TOOLS.length); assert(Buffer.byteLength(JSON.stringify(bare)) < 2200);
  assert(bare.tools.every(t => !t.inputSchema && t.summary)); assert(bare.callRef);
  const one = await invoke('tools', { name: 'probe' });
  assert.deepEqual(one.tools, [TOOLS.find(t => t.name === 'fx_probe')]);
  for (const name of ['export','fx_history']) {
    const targeted = await invoke('tools', { name }), canonical = name.startsWith('fx_') ? name : `fx_${name}`;
    assert.equal(targeted.tools[0].name, canonical);
    assert.equal(targeted.contractLookup.arguments.ref.id, canonical);
    assert.equal(targeted.cli.one, `tools '${JSON.stringify({name:canonical})}'`);
  }
  const all = await invoke('tools', { detail: 'full' }); assert.deepEqual(all, TOOLS);
  await assert.rejects(invoke('tools', { name: 'no-such-tool' }), e => e.code === 'RESOURCE_NOT_FOUND' && e.recovery.arguments.ref.id === 'catalog');
});

test('unknown field recovery gives the exact single-tool contract and preserves the original error', async () => {
  let failure;
  try { await invoke('inspect', { id: 'ice/freeze', includeSource: true }); } catch (e) { failure = e; }
  assert.equal(failure.code, 'INVALID_INPUT'); assert.equal(failure.path, 'arguments.includeSource');
  assert.deepEqual(failure.recovery.arguments.ref, { kind: 'tool', id: 'fx_inspect' });
  const repaired = await invoke('inspect', failure.recovery.arguments);
  assert.deepEqual(repaired.sections.contract, TOOLS.find(t => t.name === 'fx_inspect'));
  const original = await invoke('history', { callRef: failure.callRef });
  assert.equal(original.call.status, 'failed'); assert.equal(original.call.error.path, 'arguments.includeSource');
  await assert.rejects(execute('inspect', { ref: { ...repaired.ref, revision: 'stale' } }), e => e.code === 'REVISION_CONFLICT');
});

test('Chinese mechanisms route to mature references and distinguish helpers from private fragments', async () => {
  for (const [query, id, callable] of [['裂痕', 'branching-fractures', true], ['裂纹', 'branching-fractures', true], ['光环', 'projected-rings', false], ['震动', 'impact-feedback', false], ['山峰', 'faceted-rocks', true]]) {
    const found = await invoke('search', { query, limit: 1 });
    assert.equal(found.mechanisms[0].ref.id, `library/${id}`); assert.equal(found.mechanisms[0].callable, callable);
    assert(found.effects.length); assert(found.totals.effects > found.effects.length);
    const contract = await invoke('inspect', { ref: found.mechanisms[0].ref });
    assert.equal(typeof contract.sections.contract, 'string'); assert.equal(typeof contract.sections.example, 'string');
    assert(!contract.sections.source); assert.equal(contract.callable, callable);
  }
});

test('registered fragments are verbatim bounded source with real dependencies, not arbitrary file access', async () => {
  const found = await invoke('search', { query: 'fracture' });
  const ref = found.mechanisms[0].ref;
  const r = await invoke('inspect', { ref, sections: ['source', 'dependencies', 'provenance'] });
  for (const fragment of r.sections.source) {
    const source = readFileSync(join(ROOT, fragment.file), 'utf8'), offset = source.indexOf(fragment.source);
    assert(offset >= 0); assert.equal(fragment.startLine, source.slice(0, offset).split('\n').length);
    assert(fragment.endLine >= fragment.startLine); assert(fragment.source.includes('export function'));
  }
  assert(r.sections.source.reduce((n,s) => n + Buffer.byteLength(s.source), 0) < 10000);
  assert(r.sections.source[0].preamble.includes('Sprite Fusion'));
  assert.deepEqual(r.sections.dependencies.find(d => d.file === 'src/core/branching.js').imports, ['./math.js']);
  assert.deepEqual(r.sections.dependencies.find(d => d.file === 'src/fx/ice/_lib.js').imports, ['../../core/branching.js', '../../core/index.js']);
  for (const query of ['光环', '山峰', '震动']) {
    const found = await invoke('search', { query });
    const inspected = await invoke('inspect', { ref: found.mechanisms[0].ref, sections: ['source', 'dependencies'] });
    for (const part of inspected.sections.source) {
      const original = readFileSync(join(ROOT, part.file), 'utf8');
      assert(original.includes(part.source)); assert(original.startsWith(part.preamble));
    }
  }
  await assert.rejects(invoke('inspect', { ref: { ...ref, revision: 'stale' } }), e => e.code === 'REVISION_CONFLICT');
  await assert.rejects(invoke('inspect', { ref: { kind: 'mechanism', id: '../../package.json' } }), e => e.code === 'RESOURCE_NOT_FOUND');
  await assert.rejects(invoke('inspect', { id: 'ice/_lib' }), e => e.code === 'INVALID_INPUT');
});

test('HTTP compact/name discovery and MCP single-schema inspection retain legacy full tool lists', async () => {
  const server = createLabServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.deepEqual(await (await fetch(url + '/api/tools')).json(), TOOLS);
    const brief = await (await fetch(url + '/api/tools?detail=summary')).json(); assert.equal(brief.tools.length, TOOLS.length); assert(brief.callRef);
    const one = await (await fetch(url + '/api/tools?name=fx_probe')).json(); assert.deepEqual(one.tools, [TOOLS.find(t => t.name === 'fx_probe')]);
    const invalid = await fetch(url + '/api/tools?includeSource=true'); assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).diagnostic.path, 'arguments.includeSource');
  } finally { await new Promise(resolve => server.close(resolve)); }
  const messages = [
    { id: 1, method: 'initialize', params: {} }, { method: 'notifications/initialized' }, { id: 2, method: 'tools/list' },
    { id: 3, method: 'tools/call', params: { name: 'fx_inspect', arguments: { ref: { kind: 'tool', id: 'fx_probe' } } } },
    { id: 4, method: 'tools/call', params: { name: 'fx_inspect', arguments: { ref: { kind: 'tool', id: 'catalog' } } } },
  ];
  const output = await new Promise((resolve, reject) => {
    const child = execFile(process.execPath, [join(ROOT, 'experiments/vfx-lab/mcp.mjs')], { timeout: 10000, maxBuffer: 1024 * 1024 }, (e,stdout) => e ? reject(e) : resolve(stdout));
    child.stdin.end(messages.map(m => JSON.stringify({ jsonrpc: '2.0', ...m })).join('\n') + '\n');
  });
  const responses = output.trim().split('\n').map(JSON.parse);
  assert.deepEqual(responses[1].result.tools, TOOLS);
  assert.deepEqual(responses[2].result.structuredContent.sections.contract, TOOLS.find(t => t.name === 'fx_probe'));
  assert.equal(responses[3].result.structuredContent.tools.length, TOOLS.length);
});
