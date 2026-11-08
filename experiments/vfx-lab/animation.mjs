// Frozen-frame delivery, adapted from tools/lib/fxlib.writeVideo/upscale.
// No effect evaluation or replay occurs here. Source attribution stays in the
// original library and the selected run's source closure.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { decodePNG } from '../../tools/lib/png.mjs';
import { writeVideo, canvas } from '../../tools/lib/fxlib.mjs';
import { LabError } from './errors.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const frameDuration = frame => Number(frame.duration_time ?? frame.pkt_duration_time);
const recovery = 'Install ffmpeg (with libx264, GIF and palette filters) and ffprobe on PATH, then retry export with the same run. Atlas export needs neither executable.';
function executable(name) {
  const r = spawnSync(name, ['-version'], { encoding: 'utf8', timeout: 5000, maxBuffer: 256 * 1024 });
  return { available: !r.error && r.status === 0, version: !r.error && r.status === 0 ? r.stdout.split('\n')[0] : null };
}
export function animationCapabilities() {
  const ffmpeg = executable('ffmpeg'), ffprobe = executable('ffprobe');
  return { formats: ['atlas', 'mp4', 'gif'], mediaAvailable: ffmpeg.available && ffprobe.available, encoders: { ffmpeg, ffprobe },
    channel: 'saved preview; may include authored scenery and standing actor reference, not a guaranteed VFX cutout',
    scale: { min: 1, max: 4, integer: true, filter: 'nearest-neighbor' },
    defaults: { formats: ['atlas'], scale: 1, terminal: 'preserve' }, recovery };
}

export function prepareAnimation(m, directory, { scale = 1, terminal = 'preserve' } = {}) {
  const bad = message => { throw new LabError('CONTRACT_MISMATCH', message, { path: join(directory, 'manifest.json'), recovery: 'Restore this run’s intact saved manifest and PNGs. Current effect files are never substituted.' }); };
  const [w, h] = m.size ?? [];
  if (![w, h].every(n => Number.isInteger(n) && n >= 8 && n <= 480) || ![12, 24, 30, 60].includes(m.fps) || !(m.duration > 0 && m.duration <= 12)) bad('Saved size, fps or duration is invalid');
  if (!Number.isInteger(scale) || scale < 1 || scale > 4 || !['preserve', 'omit-loop'].includes(terminal)) throw new LabError('INVALID_INPUT', 'Media scale must be an integer 1..4; terminal is preserve or omit-loop');
  if (terminal === 'omit-loop' && !m.loop) throw new LabError('INVALID_INPUT', 'terminal:omit-loop requires a declared looping run');
  const expected = Math.ceil(m.duration * m.fps) + 1;
  if (!Array.isArray(m.frames) || m.frames.length !== expected || m.frames.some((f, i) => !Number.isFinite(f.t) || Math.abs(f.t - Math.min(i / m.fps, m.duration)) > 1e-9)) {
    throw new LabError('SAMPLING_INSUFFICIENT', 'Animation requires the complete ordered saved frame sequence, including its terminal sample', {
      path: join(directory, 'manifest.json'), details: { expectedFrames: expected, savedFrames: m.frames?.length ?? 0, frozenRun: m.run },
      recovery: { tool: 'fx_render', arguments: { target: { run: m.run }, fps: m.fps }, next: 'Inspect and explicitly select the returned new run before export. No current draft is rendered automatically.' } });
  }
  if (expected * w * h > 24_000_000) throw new LabError('BUDGET_EXCEEDED', 'Saved sequence exceeds the 24 million frame-pixel delivery budget');
  const path = join(directory, 'preview.png');
  let bytes, atlas;
  try { bytes = readFileSync(path); atlas = decodePNG(bytes); }
  catch (error) { throw new LabError('CONTRACT_MISMATCH', `Saved preview PNG is unavailable or invalid: ${error.message}`, { path, recovery: 'Restore the saved PNG for this run; exporting never renders a replacement.' }); }
  if (atlas.width !== m.atlas?.size?.[0] || atlas.height !== m.atlas?.size?.[1]) bad('Saved preview dimensions differ from the manifest');
  const chosen = terminal === 'omit-loop' ? m.frames.slice(0, -1) : m.frames;
  const raw = Buffer.alloc(chosen.length * w * h * 4), frames = [], table = [];
  // Read rectangles, not a guessed grid; raw row copies preserve straight RGB.
  for (let i = 0; i < chosen.length; i++) {
    const f = chosen[i], r = f.rect;
    if (!r || ![r.x, r.y, r.w, r.h].every(Number.isInteger) || r.x < 0 || r.y < 0 || r.w !== w || r.h !== h || r.x + w > atlas.width || r.y + h > atlas.height) bad(`Saved frame ${i} has an invalid atlas rectangle`);
    const color = raw.subarray(i * w * h * 4, (i + 1) * w * h * 4);
    for (let y = 0; y < h; y++) atlas.data.copy(color, y * w * 4, ((r.y + y) * atlas.width + r.x) * 4, ((r.y + y) * atlas.width + r.x + w) * 4);
    const shown = canvas(w, h, [0, 0, 0, 255]);
    shown.paste(color, w, h, 0, 0);
    frames.push({ color: shown.data });
    table.push({ index: f.index ?? i, sourceTime: f.t, simulationTime: f.simulationTime ?? null, rect: r, rgbaSha256: sha(color), encoderInputRgbaSha256: sha(shown.data), presentationTime: i / m.fps, nominalDuration: 1 / m.fps });
  }
  return { w, h, fps: m.fps, frames, table, scale, terminal, sourceAtlasSha256: sha(bytes), omitted: terminal === 'omit-loop' ? [m.frames.at(-1).index ?? m.frames.length - 1] : [] };
}

function runCommand(name, args, timeout) {
  const result = spawnSync(name, args, { encoding: 'utf8', timeout, maxBuffer: 4 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new LabError('ENCODING_FAILED', `${name} failed while checking the encoded animation`, {
    details: { command: [name, ...args], cause: result.error?.message ?? result.stderr.slice(0, 2000) }, recovery: 'Check encoder support and available resources, then retry the same run; no saved run was modified.' });
  return result.stdout;
}

export function encodeAnimations(m, directory, prepared, formats, capabilities) {
  if (!capabilities.mediaAvailable) throw new LabError('ENCODER_UNAVAILABLE', 'Animation delivery requires both ffmpeg and ffprobe on PATH', { details: capabilities.encoders, recovery });
  const media = [];
  // Leave room for CLI/JSON and input decoding within invoke's 90-second limit.
  const deadline = Date.now() + 70_000;
  const remaining = max => {
    const ms = Math.min(max, deadline - Date.now());
    if (ms <= 0) throw new LabError('ENCODING_FAILED', 'Animation export exceeded its delivery time budget', { recovery: 'Retry one media format per export or use a smaller integer scale. Saved frames remain intact.' });
    return ms;
  };
  for (const format of formats.filter(f => f !== 'atlas')) {
    const filename = `animation.${format}`, path = join(directory, filename);
    let encoded;
    try { encoded = writeVideo(path, prepared, prepared.scale, { scaleInEncoder: true, gifLoop: m.loop ? 0 : -1, timeout: remaining(30_000), details: true }); }
    catch (error) { throw new LabError('ENCODING_FAILED', `Animation encoding failed: ${error.message}`, { recovery: 'Check ffmpeg codec/filter support and resources; retry export of this same run. Saved frames remain intact.' }); }
    if (!encoded) throw new LabError('ENCODER_UNAVAILABLE', 'ffmpeg became unavailable during export', { recovery });
    const inputOptions = format === 'gif' ? ['-min_delay', '0'] : [];
    const probeCommand = ['-v', 'error', ...inputOptions, '-i', path, '-count_frames', '-show_frames', '-show_entries', 'frame=best_effort_timestamp_time,duration_time,pkt_duration_time:stream=codec_type,codec_name,width,height,nb_read_frames,r_frame_rate,duration:format=duration', '-of', 'json'];
    let probed;
    try { probed = JSON.parse(runCommand('ffprobe', probeCommand, remaining(15_000))); }
    catch (error) { if (error instanceof LabError) throw error; throw new LabError('ENCODING_FAILED', 'ffprobe returned invalid media metadata', { recovery: 'Check the ffprobe installation and retry this run.' }); }
    const stream = probed.streams?.find(s => s.codec_type === 'video');
    if (!stream || Number(stream.nb_read_frames) !== prepared.frames.length || stream.width !== encoded.size[0] || stream.height !== encoded.size[1] || probed.streams.some(s => s.codec_type === 'audio') || probed.frames?.length !== prepared.frames.length || !Number.isFinite(Number(probed.format?.duration ?? stream.duration)) || probed.frames.some(f => !Number.isFinite(Number(f.best_effort_timestamp_time)) || !(frameDuration(f) > 0))) {
      throw new LabError('ENCODING_FAILED', 'Encoded size, frame sequence, timing or audio differ from the selected saved sequence', { details: { expectedFrames: prepared.frames.length, expectedSize: encoded.size, streams: probed.streams }, recovery: 'Use a compatible encoder and retry the same run; partial delivery is removed.' });
    }
    const decodeCommand = ['-v', 'error', ...inputOptions, '-i', path, '-f', 'null', '-'];
    runCommand('ffmpeg', decodeCommand, remaining(15_000));
    media.push({ file: filename, format, sha256: sha(readFileSync(path)), bytes: readFileSync(path).length, channel: 'preview', size: encoded.size,
      scale: prepared.scale, scaleFilter: 'nearest-neighbor', crop: null, padding: { right: encoded.size[0] - prepared.w * prepared.scale, bottom: encoded.size[1] - prepared.h * prepared.scale, color: 'black' },
      frameCount: Number(stream.nb_read_frames), requestedFps: m.fps, nominalDuration: prepared.frames.length / m.fps, actualDuration: Number(probed.format?.duration ?? stream.duration),
      actualFrames: probed.frames.map((f, i) => ({ sourceIndex: prepared.table[i].index, time: Number(f.best_effort_timestamp_time), duration: frameDuration(f) })),
      codec: stream.codec_name, audio: false, alpha: format === 'mp4' ? 'straight RGBA flattened on black; YUV420 H264 is lossy' : 'straight RGBA flattened on black, palette quantization; no soft alpha',
      quantization: format === 'gif' ? { paletteColors: 255, dither: 'none', timeBaseSeconds: 0.01, clientNote: 'GIF clients can clamp short delays; actual encoded timestamps do not guarantee client playback cadence.' } : { crf: 14, pixelFormat: 'yuv420p' },
      loop: format === 'gif' ? (m.loop ? 'infinite' : 'once') : 'single sequence', command: encoded.command, probeCommand: ['ffprobe', ...probeCommand], decodeCommand: ['ffmpeg', ...decodeCommand], fullDecodePassed: true });
  }
  const delivery = { version: 1, sourceRun: m.run, digest: m.digest, sourceDigest: m.sourceDigest, revision: m.revision ?? m.sourceDigest,
    representation: 'saved-images', sourceChannel: 'preview', sourceAtlas: { file: 'preview.png', sha256: prepared.sourceAtlasSha256 },
    compositing: { background: '#000000', method: 'straight RGBA over black using fxlib.canvas; exact asset PNGs unchanged' },
    scope: 'Saved whole-effect preview including its saved background/actor and any authored scenery; not inferred to be a VFX cutout.',
    nativeSize: m.size, origin: m.origin, bounds: m.bounds ?? null, events: m.events, authoredDuration: m.duration, loop: m.loop, fps: m.fps,
    terminal: { policy: prepared.terminal, included: prepared.terminal === 'preserve', omittedSourceIndices: prepared.omitted, note: 'Preserved one-shot terminal sample holds for another nominal frame. CFR presentation times and source sample times are recorded separately.' },
    frames: prepared.table, encoders: capabilities.encoders, media,
    precision: 'color.png and additive light.png retain original saved bytes. combined ordinary alpha is approximate; GIF quantization and MP4 loss are previews.',
    verification: { fullMediaDecode: true, sourceFramesHashed: true, currentEffectEvaluated: false, continuousPlaybackViewed: false } };
  writeFileSync(join(directory, 'delivery.json'), JSON.stringify(delivery, null, 2) + '\n');
  return delivery;
}
