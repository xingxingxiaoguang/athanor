// Assemble existing public evidence. Never evaluate artwork or infer viewing.
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync, copyFileSync, rmSync } from 'node:fs';
import { join, basename, dirname, relative, sep } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { queryCalls, readCall, selectedDecisionForRun } from './journal.mjs';
import { LabError } from './errors.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
export function bundleEvidence(manifest, records, annotations = {}, exclude) {
  const calls = new Map();
  let cursor = 0, skipped = [];
  do {
    const page = queryCalls({ id: manifest.id, limit: 60, cursor, exclude });
    skipped = page.skipped;
    for (const item of page.items) calls.set(item.callRef, readCall(item.callRef));
    cursor = page.nextCursor;
  } while (cursor !== null);
  for (const ref of [...(annotations.references ?? []), ...(annotations.viewed ?? [])]) calls.set(ref, readCall(ref));
  const viewed = (annotations.viewed ?? []).map(ref => {
    const call = calls.get(ref), r = call?.result;
    if (call?.status !== 'success' || !['render', 'probe', 'compare'].includes(call.tool) || !(r?.image || r?.pages?.length)) throw new LabError('CONTRACT_MISMATCH', 'A viewed declaration needs a successful render/probe/compare image call', { details: { callRef: ref }, recovery: 'Use the callRef of the image you actually observed, or omit viewed. File delivery alone never proves viewing.' });
    if (!call.ids.includes(manifest.id)) throw new LabError('CONTRACT_MISMATCH', 'Viewed image is outside this artwork history', { details: { callRef: ref, id: manifest.id } });
    return { callRef: ref, runs: call.runs, basis: 'author-declared', verifiedByTool: false };
  });
  const decision = selectedDecisionForRun(manifest.id, manifest.run, manifest.sourceDigest);
  const ordered = [...calls.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.callRef.localeCompare(b.callRef));
  const bundleRef = `bundle-${randomUUID()}`, directory = join(records, manifest.run, bundleRef);
  mkdirSync(join(directory, 'calls'), { recursive: true }); mkdirSync(join(directory, 'files'));
  const files = [], missing = [], copied = new Map(), recordRoot = realpathSync(records);
  function attach(path, role, run = null) {
    if (typeof path !== 'string') return null;
    if (!existsSync(path)) { missing.push({ path, role, run }); return null; }
    const actual = realpathSync(path);
    // Only explicit evidence files under records, never frozen source closures.
    if (!actual.startsWith(recordRoot + sep) || ['sources.json', 'assets.json', 'preview.rgba'].includes(basename(actual))) return null;
    if (copied.has(actual)) { const item = copied.get(actual); if (!item.roles.includes(role)) item.roles.push(role); return item.file; }
    const bytes = readFileSync(actual), sha256 = hash(bytes), file = `files/${relative(recordRoot, actual)}`;
    mkdirSync(dirname(join(directory, file)), { recursive: true });
    copyFileSync(actual, join(directory, file));
    const item = { file, original: path, sha256, bytes: bytes.length, roles: [role], run };
    files.push(item); copied.set(actual, item); return file;
  }
  try {
    const runIDs = new Set([manifest.run, ...ordered.flatMap(c => c.runs)]), versions = [];
    for (const run of runIDs) {
      const path = join(records, run, 'manifest.json');
      if (!existsSync(path)) { missing.push({ path, role: 'run-manifest', run }); continue; }
      const m = JSON.parse(readFileSync(path));
      versions.push({ run, id: m.id, revision: m.revision ?? m.sourceDigest, sourceDigest: m.sourceDigest, parentRun: m.parentRun ?? null, note: m.note, createdAt: m.createdAt, selected: run === manifest.run, manifest: attach(path, 'run-manifest', run), image: attach(join(records, run, 'contact.png'), 'contact-image', run) });
    }
    const summaries = ordered.map(call => {
      const r = call.result, file = `calls/${call.callRef}.json`, original = join(records, 'calls', `${call.callRef}.json`);
      const bytes = readFileSync(original), sha256 = hash(bytes);
      copyFileSync(original, join(directory, file));
      files.push({ file, original, sha256, bytes: bytes.length, roles: ['public-call'], run: null, runs: call.runs });
      const artifacts = [];
      if (r) {
        const run = r.targetRun ?? r.run ?? null;
        for (const [path, role] of [[r.image, 'image'], [r.detailRef, 'analysis'], [r.deliveryRef, 'delivery']]) {
          const file = attach(path, role, run); if (file) artifacts.push(file);
        }
        for (const page of r.pages ?? []) { const file = attach(page.image, 'native-image-page', run); if (file) artifacts.push(file); }
        if (call.tool === 'export') for (const path of r.files ?? []) { const file = attach(path, 'export-asset', run); if (file) artifacts.push(file); }
      }
      return { callRef: call.callRef, tool: call.tool, status: call.status, runs: call.runs, file, sha256, artifacts: [...new Set(artifacts)], scope: call.ids.includes(manifest.id) ? 'artwork-history' : 'author-linked-reference', ...(call.error ? { error: call.error } : {}) };
    });
    const sameRun = ordered.filter(c => c.status === 'success' && c.runs.includes(manifest.run));
    const validations = sameRun.filter(c => c.tool === 'validate' && c.result.targetRun === manifest.run && c.result.sourceDigest === manifest.sourceDigest).map(c => ({ callRef: c.callRef, validationRef: c.result.validationRef, passed: c.result.passed, representation: c.result.representation }));
    const exports = sameRun.filter(c => c.tool === 'export' && c.result.run === manifest.run).map(c => ({ callRef: c.callRef, validation: c.result.validation, directory: c.result.directory }));
    const index = { version: 1, bundleRef, createdAt: new Date().toISOString(), target: { run: manifest.run, id: manifest.id, revision: manifest.revision ?? manifest.sourceDigest, sourceDigest: manifest.sourceDigest, assetDigest: manifest.assets?.digest ?? null }, decision, annotations, viewing: { declarations: viewed, automaticViewingClaim: false }, validations, exports, versions, calls: summaries, files, missing, skipped,
      limits: ['Snapshot of existing public records, not a new validation or aesthetic approval.', 'Selected means the explicitly requested bundle run; decision is null unless that same run has a recorded author selection.', 'Successful image calls prove file delivery only. Viewing entries are unverified author declarations.', 'Original call files/errors are unchanged. JSON paths inside those originals may refer to the source checkout; use this index for portable copied files.', 'Frozen sources, raw observations and raw PNG-resource bundles are excluded. This is an evidence/delivery bundle, not a replay backup.'] };
    save(join(directory, 'index.json'), index);
    const md = [`# ${manifest.name ?? manifest.id}`, '', `Run: \`${manifest.run}\`  `, `Source digest: \`${manifest.sourceDigest}\``, '', annotations.intent ?? '', '', '## Author judgment', '', annotations.judgment ?? '(not supplied)', '', '## Changes', '', ...(annotations.changes ?? []).map(s=>`- ${s}`), '', '## Evidence', '', `- [Structured index](index.json): ${versions.length} versions, ${summaries.length} original public calls.`, `- Exact-run author selection: ${decision?.decisionRef ?? 'not recorded'}.`, `- Exact-run validations: ${validations.map(v=>`${v.validationRef} passed=${v.passed}`).join(', ') || 'none'}.`, `- Exact-run exports: ${exports.length}.`, `- Actual viewing: ${viewed.length} author declarations; the tool does not verify viewing.`, ...files.filter(f=>f.roles.some(r=>['native-image-page','contact-image'].includes(r))).map(f=>`- [${f.run ?? 'image'} / ${f.roles.join(', ')}](${f.file})`), '', '## Limits', '', ...(annotations.limitations ?? []).map(s=>`- ${s}`), ...index.limits.map(s=>`- ${s}`), ...(missing.length ? [`- ${missing.length} missing referenced files; see index.`] : [])].join('\n');
    writeFileSync(join(directory, 'README.md'), md + '\n');
    return { bundleRef, directory, index: join(directory, 'index.json'), report: join(directory, 'README.md'), target: index.target, decisionRef: decision?.decisionRef ?? null, callCount: summaries.length, versionCount: versions.length, fileCount: files.length, missing, skipped, viewing: index.viewing };
  } catch (error) { rmSync(directory, { recursive: true, force: true }); throw error; }
}
