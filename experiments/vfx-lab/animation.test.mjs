import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, mkdtempSync, chmodSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { LAB, RECORDS, execute } from './lab.mjs';
import { invoke } from './invoke.mjs';
import { animationCapabilities, prepareAnimation } from './animation.mjs';
import { encodePNG, decodePNG } from '../../tools/lib/png.mjs';
import { writeVideo } from '../../tools/lib/fxlib.mjs';

const cli = join(LAB, 'cli.mjs'), capable = animationCapabilities().mediaAvailable;
const modernProbe = process.env.ATHANOR_TEST_FFPROBE_MODERN;
const hash = b => createHash('sha256').update(b).digest('hex');
const clean = run => rmSync(join(RECORDS, run), { recursive: true, force: true });
const fresh = () => { const name = `media-${randomUUID().slice(0, 8)}`; mkdirSync(join(LAB, 'drafts'), { recursive: true }); return { id: `draft/${name}`, file: join(LAB, 'drafts', `${name}.js`) }; };
const source = (loop = false) => `export const meta={name:'Delivery fixture',size:[17,15],origin:[8,7],duration:0.2,loop:${loop},options:{seed:9}};
export const events={release:1/30};export function draw(p,t){if(t>=0.2)return;p.rect(-5,-4,10,8,0xff0000ff);if(t>=1/30&&t<2/30)p.rect(-3,-2,6,4,0xff00ff00);p.blend(6,5,0xffffffff,0.25);}`;
const callWithPath = (name, args, path) => {
  const r = spawnSync(process.execPath, [cli, name, JSON.stringify(args)], { env: { ...process.env, PATH: path }, encoding: 'utf8' });
  return JSON.parse(r.stdout);
};

test('public media discovery, missing-encoder recovery and legacy atlas export remain usable', async () => {
  const draft = fresh(); let run;
  try {
    writeFileSync(draft.file, source());
    const tools = JSON.parse(spawnSync(process.execPath, [cli, 'tools', '{"detail":"full"}'], { encoding: 'utf8' }).stdout).result;
    assert.deepEqual(tools.find(t => t.name === 'fx_export').inputSchema.properties.formats.items.enum, ['atlas', 'mp4', 'gif']);
    run = (await invoke('render', { id: draft.id })).run;
    const info = callWithPath('inspect', { ref: { kind: 'run', id: run } }, '/does-not-exist');
    assert.equal(info.result.delivery.mediaAvailable, false);
    const failed = callWithPath('export', { run, formats: ['gif'] }, '/does-not-exist');
    assert.equal(failed.error.code, 'ENCODER_UNAVAILABLE'); assert.match(failed.error.recovery, /same run/);
    const exported = callWithPath('export', { run }, '/does-not-exist').result;
    assert.equal(exported.files.length, 8); assert.equal(exported.validation.status, 'unvalidated');
    assert.deepEqual(readFileSync(join(exported.directory, 'color.png')), readFileSync(join(RECORDS, run, 'color.png')));
    await assert.rejects(execute('export', { run, scale: 2 }), { code: 'INVALID_INPUT' });
    await assert.rejects(execute('export', { run, formats: ['gif'], scale: 0.5 }), { code: 'INVALID_INPUT' });
  } finally { rmSync(draft.file, { force: true }); if (run) clean(run); }
});

test('saved delivery refuses sparse, corrupt or invalid rectangle evidence without substituting source', () => {
  const dir = mkdtempSync(join(tmpdir(), 'athanor-delivery-'));
  const m = { run: '123456789abc-12345678', size: [8, 8], fps: 12, duration: 0.1, atlas: { size: [24, 8] }, frames: [0, 1 / 12, 0.1].map((t, i) => ({ index: i, t, rect: { x: i * 8, y: 0, w: 8, h: 8 } })) };
  try {
    const png = encodePNG(24, 8, new Uint8Array(24 * 8 * 4)); writeFileSync(join(dir, 'preview.png'), png);
    assert.equal(prepareAnimation(m, dir).frames.length, 3);
    assert.throws(() => prepareAnimation({ ...m, frames: [m.frames[0], m.frames[2]] }, dir), { code: 'SAMPLING_INSUFFICIENT' });
    assert.throws(() => prepareAnimation({ ...m, frames: m.frames.map((f, i) => i === 1 ? { ...f, rect: { ...f.rect, x: 100 } } : f) }, dir), { code: 'CONTRACT_MISMATCH' });
    assert.throws(() => prepareAnimation(m, dir, { terminal: 'omit-loop' }), { code: 'INVALID_INPUT' });
    const corrupt = Buffer.from(png); corrupt[corrupt.length - 5] ^= 1; writeFileSync(join(dir, 'preview.png'), corrupt);
    assert.throws(() => prepareAnimation(m, dir), { code: 'CONTRACT_MISMATCH' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('real MP4/GIF preserve every selected frozen frame, short peaks, exact assets and declared timing after source removal', { skip: !capable && 'ffmpeg + ffprobe required for actual codec verification' }, async () => {
  const draft = fresh(); let run;
  try {
    writeFileSync(draft.file, source());
    const a = await invoke('render', { id: draft.id, background: 'black' }); run = a.run;
    const validation = await invoke('validate', { run }); assert.equal(validation.passed, true);
    const manifest = JSON.parse(readFileSync(a.manifest));
    rmSync(draft.file);
    const out = await invoke('export', { run, validationRef: validation.validationRef, formats: ['mp4', 'gif'], scale: 3 });
    assert.equal(out.validation.ref, validation.validationRef); assert.equal(out.representation, 'saved-images');
    const d = JSON.parse(readFileSync(out.deliveryRef)), atlas = decodePNG(readFileSync(join(RECORDS, run, 'preview.png')));
    assert.equal(d.sourceRun, run); assert.equal(d.sourceDigest, a.sourceDigest); assert.equal(d.verification.currentEffectEvaluated, false);
    assert.equal(d.frames.length, 7); assert.equal(d.frames.at(-1).sourceTime, 0.2);
    for (const name of ['color', 'light', 'combined']) assert.deepEqual(readFileSync(join(out.directory, name + '.png')), readFileSync(join(RECORDS, run, name + '.png')));
    for (const media of d.media) { assert.equal(media.frameCount, 7); assert.equal(media.fullDecodePassed, true); assert.equal(media.audio, false); assert(media.actualDuration > 0.2); }
    assert.deepEqual(d.media.find(m => m.format === 'mp4').size, [52, 46]);
    assert.deepEqual(d.media.find(m => m.format === 'mp4').padding, { right: 1, bottom: 1, color: 'black' });
    const gif = d.media.find(m => m.format === 'gif'); assert.deepEqual(gif.size, [51, 45]);
    const decoded = spawnSync('ffmpeg', ['-v', 'error', '-min_delay', '0', '-i', join(out.directory, gif.file), '-vsync', '0', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { maxBuffer: 1024 * 1024 });
    assert.equal(decoded.status, 0); assert.equal(decoded.stdout.length, 7 * 51 * 45 * 4);
    for (let i = 0; i < 7; i++) {
      const r = manifest.frames[i].rect, raw = Buffer.alloc(17 * 15 * 4);
      for (let y = 0; y < 15; y++) atlas.data.copy(raw, y * 17 * 4, ((r.y + y) * atlas.width + r.x) * 4, ((r.y + y) * atlas.width + r.x + 17) * 4);
      assert.equal(hash(raw), d.frames[i].rgbaSha256);
      for (let y = 0; y < 45; y++) for (let x = 0; x < 51; x++) {
        const s = (Math.floor(y / 3) * 17 + Math.floor(x / 3)) * 4, p = (i * 51 * 45 + y * 51 + x) * 4;
        assert.deepEqual(decoded.stdout.subarray(p, p + 4), raw.subarray(s, s + 4));
      }
    }
    assert.notEqual(d.frames[1].rgbaSha256, d.frames[2].rgbaSha256); // one-output-frame peak survives
    const hist = await invoke('history', { run }); assert(hist.runs.find(r => r.run === run).evidence.exports.length);
  } finally { rmSync(draft.file, { force: true }); if (run) clean(run); }
});

test('real 60fps GIF records centisecond quantization and explicit loop endpoint omission', { skip: !capable && 'ffmpeg + ffprobe required' }, async () => {
  const draft = fresh(); let run;
  try {
    writeFileSync(draft.file, source(true)); run = (await invoke('render', { id: draft.id, fps: 60, background: 'black' })).run;
    const full = await invoke('export', { run, formats: ['gif'] }), cut = await invoke('export', { run, formats: ['gif'], terminal: 'omit-loop' });
    const a = JSON.parse(readFileSync(full.deliveryRef)), b = JSON.parse(readFileSync(cut.deliveryRef));
    assert.equal(a.media[0].frameCount, 13); assert.equal(b.media[0].frameCount, 12);
    assert.deepEqual(b.terminal.omittedSourceIndices, [12]); assert.equal(a.terminal.included, true);
    assert(a.media[0].actualFrames.some(f => f.duration === 0.01)); assert(a.media[0].actualFrames.some(f => f.duration === 0.02));
    assert.equal(a.media[0].loop, 'infinite'); assert.equal(a.media[0].quantization.timeBaseSeconds, 0.01);
  } finally { rmSync(draft.file, { force: true }); if (run) clean(run); }
});

test('codec execution failure removes partial delivery and same-run retry uses the original library encoder', { skip: !capable && 'real encoder required to verify recovery' }, async () => {
  const draft = fresh(), bin = mkdtempSync(join(tmpdir(), 'athanor-encoder-')); let run;
  try {
    writeFileSync(draft.file, source()); run = (await invoke('render', { id: draft.id })).run;
    const probe = spawnSync('/usr/bin/which', ['ffprobe'], { encoding: 'utf8' }).stdout.trim();
    symlinkSync(probe, join(bin, 'ffprobe'));
    writeFileSync(join(bin, 'ffmpeg'), '#!/bin/sh\nif [ "$1" = "-version" ]; then echo "fixture encoder version"; exit 0; fi\necho "original codec failure" >&2\nexit 7\n'); chmodSync(join(bin, 'ffmpeg'), 0o755);
    const before = readdirSync(join(RECORDS, run));
    const fail = callWithPath('export', { run, formats: ['gif'] }, bin);
    assert.equal(fail.error.code, 'ENCODING_FAILED'); assert.match(fail.error.message, /original codec failure/);
    assert.deepEqual(readdirSync(join(RECORDS, run)), before);
    const retried = await invoke('export', { run, formats: ['gif'] }); assert.equal(retried.media[0].frameCount, 7);
    const legacy = join(bin, 'legacy.gif'), r = { w: 8, h: 8, fps: 12, frames: [{ color: new Uint8ClampedArray(8 * 8 * 4).fill(255) }] };
    assert.equal(writeVideo(legacy, r, 2), true);
  } finally { rmSync(draft.file, { force: true }); rmSync(bin, { recursive: true, force: true }); if (run) clean(run); }
});

test('a real modern ffprobe duration_time-only result and legacy pkt_duration_time both deliver the same frozen sequence', { skip: (!capable || !modernProbe) && 'set ATHANOR_TEST_FFPROBE_MODERN to a modern ffprobe binary for actual compatibility verification' }, async () => {
  const draft = fresh(), bin = mkdtempSync(join(tmpdir(), 'athanor-modern-probe-')); let run;
  try {
    writeFileSync(draft.file, source()); run = (await invoke('render', { id: draft.id })).run;
    const old = await invoke('export', { run, formats: ['mp4', 'gif'] });
    symlinkSync(modernProbe, join(bin, 'ffprobe')); rmSync(draft.file);
    const result = callWithPath('export', { run, formats: ['mp4', 'gif'] }, bin + ':' + process.env.PATH);
    assert.equal(result.ok, true);
    const modern = JSON.parse(readFileSync(result.result.deliveryRef)), legacy = JSON.parse(readFileSync(old.deliveryRef));
    assert.deepEqual(modern.frames, legacy.frames); assert.deepEqual(modern.assets, legacy.assets);
    for (const media of modern.media) { assert.equal(media.frameCount, 7); assert(media.actualFrames.every(f => Number.isFinite(f.time) && f.duration > 0)); }
    const fields = spawnSync(modernProbe, ['-v', 'error', '-i', result.result.media[0].file, '-show_frames', '-show_entries', 'frame=duration_time,pkt_duration_time', '-of', 'json'], { encoding: 'utf8' });
    const frame = JSON.parse(fields.stdout).frames[0];
    assert.equal(typeof frame.duration_time, 'string'); assert.equal(frame.pkt_duration_time, undefined);
  } finally { rmSync(draft.file, { force: true }); rmSync(bin, { recursive: true, force: true }); if (run) clean(run); }
});
