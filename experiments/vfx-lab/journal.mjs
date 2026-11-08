// Public call/decision evidence. One atomic file per call avoids append races
// between CLI processes. These records never modify an immutable render.
import { readFileSync, writeFileSync, renameSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { ROOT } from '../../tools/lib/fxlib.mjs';
import { LabError, errorResult } from './errors.mjs';

const records = join(ROOT, 'records', 'vfx-lab');
const calls = join(records, 'calls');
const validCall = /^call-[a-f0-9-]{36}$/;
const validRun = /^[a-f0-9]{12}-[a-f0-9]{8}$/;
function save(path, data) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(data, null, 2) + '\n'); renameSync(temporary, path);
}
function references(args, result) {
  const runs = new Set([args?.run, args?.target?.run, ...(Array.isArray(args?.runs) ? args.runs : []), args?.ref?.kind === 'run' ? args.ref.id : null, result?.targetRun, result?.target?.run].filter(v => typeof v === 'string' && validRun.test(v)));
  if (typeof result?.run === 'string' && validRun.test(result.run) && existsSync(join(records, result.run, 'manifest.json'))) runs.add(result.run);
  const ids = new Set([args?.id, args?.target?.id, args?.ref?.kind === 'effect' ? args.ref.id : null, result?.id, result?.target?.id].filter(v => typeof v === 'string'));
  for(const entry of [...(Array.isArray(args?.entries)?args.entries:[]),...(Array.isArray(result?.entries)?result.entries:[])]){if(validRun.test(entry.run??''))runs.add(entry.run);if(typeof entry.id==='string')ids.add(entry.id);}
  for (const run of runs) {
    try { ids.add(JSON.parse(readFileSync(join(records, run, 'manifest.json'))).id); } catch { /* input may be an invalid run */ }
  }
  return { runs: [...runs], ids: [...ids].filter(Boolean) };
}
export function beginCall(tool, args, ref = `call-${randomUUID()}`) {
  mkdirSync(calls, { recursive: true });
  const data = { version: 1, callRef: ref, tool: String(tool).replace(/^fx_/, ''), arguments: args, startedAt: new Date().toISOString(), status: 'pending', ...references(args) };
  save(join(calls, `${ref}.json`), data); return ref;
}
export function readCall(ref) {
  if (!validCall.test(ref)) throw new LabError('INVALID_INPUT', 'Invalid callRef');
  const path = join(calls, `${ref}.json`);
  if (!existsSync(path)) throw new LabError('RESOURCE_NOT_FOUND', `Public call '${ref}' is unavailable`, { recovery: 'Use history with an effect/run or query to discover recorded call references.' });
  try {
    const entry = JSON.parse(readFileSync(path));
    if (entry.callRef !== ref || !Array.isArray(entry.ids) || !Array.isArray(entry.runs) || typeof entry.startedAt !== 'string' || !['pending', 'success', 'failed', 'interrupted'].includes(entry.status)) throw new Error('Invalid record shape');
    return entry;
  } catch { throw new LabError('CONTRACT_MISMATCH', `Public call '${ref}' is damaged`, { path, recovery: 'Restore this record from intact evidence. Other valid history records remain available; no result is fabricated.' }); }
}
export function finishCall(ref, status, value) {
  const entry = readCall(ref);
  const result = status === 'success' ? value : undefined;
  Object.assign(entry, { status, finishedAt: new Date().toISOString(), ...references(entry.arguments, result) });
  if (status === 'success') entry.result = result;
  else entry.error = value;
  save(join(calls, `${ref}.json`), entry);
}
export async function recordCall(tool, args, operation) {
  const inherited = process.env.ATHANOR_PUBLIC_CALL_REF;
  delete process.env.ATHANOR_PUBLIC_CALL_REF;
  const ref = inherited && validCall.test(inherited) && existsSync(join(calls, `${inherited}.json`)) ? inherited : beginCall(tool, args);
  try {
    const value = await operation(ref);
    const result = value && !Array.isArray(value) && typeof value === 'object' ? { ...value, callRef: ref } : value;
    finishCall(ref, 'success', result); return result;
  } catch (error) {
    const diagnostic = errorResult(error);
    const failure = Object.assign(new Error(diagnostic.message), diagnostic, { callRef: ref });
    finishCall(ref, 'failed', errorResult(failure)); throw failure;
  }
}
export function recordFailure(tool, args, error) {
  const inherited = process.env.ATHANOR_PUBLIC_CALL_REF;
  const ref = inherited && validCall.test(inherited) && existsSync(join(calls, `${inherited}.json`)) ? inherited : beginCall(tool, args);
  delete process.env.ATHANOR_PUBLIC_CALL_REF;
  error.callRef = ref; finishCall(ref, 'failed', errorResult(error)); return error;
}
export function queryCalls({ id, run, query = '', limit = 12, cursor = 0, exclude }) {
  if (!existsSync(calls)) return { total: 0, cursor, nextCursor: null, items: [] };
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const skipped = [];
  const entries = readdirSync(calls).filter(p => /^call-[a-f0-9-]{36}\.json$/.test(p)).flatMap(p => {
    try { return [readCall(p.slice(0, -5))]; } catch (error) { skipped.push({ callRef: p.slice(0, -5), code: error.code, message: error.message }); return []; }
  }).filter(e => e.callRef !== exclude && (!id || e.ids.includes(id)) && (!run || e.runs.includes(run)) && words.every(w => `${e.tool} ${e.callRef} ${JSON.stringify(e.arguments)}`.toLowerCase().includes(w))).sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.callRef.localeCompare(a.callRef));
  const page = entries.slice(cursor, cursor + limit);
  return { total: entries.length, cursor, nextCursor: cursor + page.length < entries.length ? cursor + page.length : null, skipped,
    items: page.map(({ result, ...entry }) => ({ ...entry, ...(result ? { references: { run: result.run ?? result.targetRun ?? null, probeRef: result.probeRef ?? null, validationRef: result.validationRef ?? null, decisionRef: result.decision?.decisionRef ?? null, detailRef: result.detailRef ?? result.manifest ?? result.deliveryRef ?? null, image: result.image ?? null, directory: result.directory ?? null } } : {}) })) };
}
const decisionDirectory = id => join(records, 'decisions', createHash('sha256').update(id).digest('hex'));
export function readDecision(id) {
  if (!id) return null;
  const path = join(decisionDirectory(id), 'selected.json');
  return existsSync(path) ? JSON.parse(readFileSync(path)) : null;
}
// A later selection (e.g. another stop phase) does not revoke the recorded
// selection of an older frozen variant. Registration names the exact run.
export function selectedDecisionForRun(id, run, sourceDigest) {
  const directory=decisionDirectory(id);if(!existsSync(directory))return null;
  return readdirSync(directory).filter(name=>/^decision-[a-f0-9-]{36}\.json$/.test(name)).flatMap(name=>{
    try{const d=JSON.parse(readFileSync(join(directory,name),'utf8'));return d.id===id&&d.selectedRun===run&&d.sourceDigest===sourceDigest?[d]:[];}catch{return[];}
  }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0]??null;
}
export function selectRun(manifest, reason, evidence = []) {
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 2000) throw new LabError('INVALID_INPUT', 'Explicit selection needs a nonempty reason, at most 2000 characters', { path: 'arguments.reason' });
  for (const ref of evidence) {
    const call = readCall(ref);
    if (call.status !== 'success' || !call.runs.includes(manifest.run)) throw new LabError('CONTRACT_MISMATCH', 'Selection evidence must be a successful public call concerning the selected run', { details: { callRef: ref, selectedRun: manifest.run, evidenceRuns:call.runs, evidenceStatus:call.status }, recovery:'Keep the selected run. Use a successful probe/compare/render callRef whose result concerns this run (compare must include it), or omit evidence. Inspect history by callRef, then retry selection; no new render is required.' });
  }
  const decision = { decisionRef: `decision-${randomUUID()}`, id: manifest.id, selectedRun: manifest.run, revision: manifest.revision ?? manifest.sourceDigest, sourceDigest: manifest.sourceDigest, reason, evidence, createdAt: new Date().toISOString(), aestheticApproval: null };
  const directory = decisionDirectory(manifest.id); mkdirSync(directory, { recursive: true });
  save(join(directory, `${decision.decisionRef}.json`), decision); save(join(directory, 'selected.json'), decision); return decision;
}
