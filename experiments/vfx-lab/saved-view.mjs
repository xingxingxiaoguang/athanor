// Ordered strip selection from tools/act.mjs + native grid placement from
// fxlib.contactSheet, retaining saved clocks/anchors from lab.compare.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { canvas } from '../../tools/lib/fxlib.mjs';
import { decodePNG } from '../../tools/lib/png.mjs';
import { LabError } from './errors.mjs';
import { startSavedPlayback } from './saved-player.js';

const epsilon = value => 32 * Number.EPSILON * Math.max(1, Math.abs(value));
function timeline(list, args) {
  const event = args.event ?? args.window?.event;
  if (args.event && args.window?.event && args.event !== args.window.event) throw new LabError('INVALID_INPUT', 'Outer event and window.event conflict');
  const alignment = args.alignment ?? (event ? 'event' : 'time');
  if (alignment === 'event' && (!event || list.some(m => !Object.hasOwn(m.events, event)))) throw new LabError('RESOURCE_NOT_FOUND', 'Every run must declare the aligned event', { details: { event, available: list.map(m => ({ run: m.run, events: m.events })) } });
  if (alignment === 'time' && event) throw new LabError('INVALID_INPUT', 'An event requires event alignment');
  if (!args.window) return { event, alignment, positions: alignment === 'event' ? args.offsets ?? [-0.1, 0, 1 / 30, 0.1, 0.3, 0.7] : args.times };
  const { from, to, every = 1 } = args.window;
  if (args.times || args.offsets || !(to >= from)) throw new LabError('INVALID_INPUT', 'A window requires from <= to and cannot be combined with times/offsets');
  const origin = m => alignment === 'event' ? m.events[event] : 0;
  const saved = list.flatMap(m => m.frames.map(f => f.t - origin(m))).filter(t => t >= from - epsilon(from) && t <= to + epsilon(to));
  if (!saved.length) throw new LabError('SAMPLING_INSUFFICIENT', 'No saved frame occurs inside this window', { recovery: { tool: 'fx_render', arguments: { target: { run: list[0].run }, fps: 60 }, next: 'Inspect the explicitly resampled frozen child run before using it; or widen the window. No current source or interpolated frame is substituted.' } });
  const all = [from, ...saved, to].sort((a, b) => a - b).filter((t, i, a) => i === 0 || t - a[i - 1] > epsilon(t));
  const positions = all.filter((_, i) => i % every === 0 || i === all.length - 1);
  if (positions.length > 120) throw new LabError('BUDGET_EXCEEDED', 'Window exceeds 120 shared sample positions', { details: { positions: positions.length }, recovery: 'Use a shorter window, or explicitly set window.every to skip positions. Frames are never silently thinned.' });
  const gaps = list.map(m => ({ run: m.run, gaps: m.frames.slice(1).flatMap((f, i) => {
    const previous = m.frames[i], a = previous.t - origin(m), b = f.t - origin(m);
    return b >= from && a <= to && f.t - previous.t > 1.5 / m.fps ? [{ from: previous.t, to: f.t, estimatedMissingSamples: Math.max(0, Math.round((f.t - previous.t) * m.fps) - 1) }] : [];
  }) }));
  return { event, alignment, positions, window: { from, to, every, interval: 'closed; source frames plus nearest boundary requests', sourcePositions: all.length, selectedPositions: positions.length, omittedPositions: all.filter(t => !positions.includes(t)), gaps } };
}

function playbackHTML(data) {
  const payload = JSON.stringify(data).replaceAll('<', '\\u003c');
  return `<!doctype html><meta charset="utf-8"><title>Saved frame window</title>
<style>body{background:#0c0b10;color:#ddd;font:13px monospace;padding:16px}button,select,input{margin:4px}#stages{display:flex;gap:24px;overflow:auto}canvas{image-rendering:pixelated;max-width:none;flex:none}p{white-space:pre-wrap;max-width:600px}section{flex:none}</style>
<h1>Saved frame window</h1><p id="status">Loading saved images…</p>
<button id="prev">Previous frame</button><button id="play">Play</button><button id="next">Next frame</button>
<label><input id="loop" type="checkbox" checked>Loop window</label><label>Speed <select id="speed"><option>0.25</option><option>0.5</option><option selected>1</option><option>2</option></select></label>
<input id="scrub" type="range" min="0" value="0" step="1"><span id="position"></span><div id="stages"></div>
<script>(${startSavedPlayback.toString()})(${payload});</script>`;
}

export function savedView(list, records, args) {
  if (list.some(m => !Array.isArray(m.frames) || !m.frames.length || ![12, 24, 30, 60].includes(m.fps) || m.frames.some((f, i) => !Number.isFinite(f.t) || (i > 0 && f.t < m.frames[i - 1].t)))) throw new LabError('CONTRACT_MISMATCH', 'Saved windows require an intact ordered frame table and declared fps');
  const channel = args.channel ?? 'preview', selection = timeline(list, args), { positions, alignment, event } = selection;
  if (!positions?.length) throw new LabError('INVALID_INPUT', 'Choose a time/event window or explicit sample positions');
  const anchor = [Math.max(...list.map(m => m.origin[0])), Math.max(...list.map(m => m.origin[1]))];
  const offsets = list.map(m => anchor.map((a, i) => a - m.origin[i]));
  if (offsets.some(v => v.some(n => Math.abs(n - Math.round(n)) > epsilon(n)))) throw new LabError('CAPABILITY_UNSUPPORTED', 'Different fractional pixel anchors cannot be exactly aligned without resampling', { recovery: 'Inspect single-run windows separately, or explicitly author compatible pixel anchors. No image is shifted by a fractional pixel silently.' });
  offsets.forEach(v => { v[0] = Math.round(v[0]); v[1] = Math.round(v[1]); });
  const w = Math.max(...list.map((m, i) => m.size[0] + offsets[i][0])), h = Math.max(...list.map((m, i) => m.size[1] + offsets[i][1]));
  const { maxWidth = 1120, maxHeight = 1024, columns: requestedColumns } = args.layout ?? {};
  const columns = requestedColumns ?? Math.max(1, Math.min(list.length > 1 ? list.length : 6, Math.floor((maxWidth - 8) / (w + 8))));
  const rows = Math.floor((maxHeight - 38) / (h + 44)), perPage = columns * rows;
  if (w > 960 || h > 960 || !rows || 8 + columns * (w + 8) > maxWidth) throw new LabError('BUDGET_EXCEEDED', 'Native frame cells do not fit the requested page limits', { recovery: 'Increase layout limits within the schema or use fewer columns. Art pixels are never resized or cropped.' });
  const tileCount = positions.length * list.length, pageCount = Math.ceil(tileCount / perPage);
  if (pageCount > 12 || tileCount * (w + 8) * (h + 44) > 24_000_000) throw new LabError('BUDGET_EXCEEDED', 'Native pages exceed 12 pages or 24 million pixels', { recovery: 'Use a shorter window or explicitly skip positions with window.every.' });
  const atlases = list.map(m => {
    const path = join(records, m.run, `${channel}.png`);
    try {
      const a = decodePNG(readFileSync(path));
      if (a.width !== m.atlas.size[0] || a.height !== m.atlas.size[1]) throw new Error('Dimensions differ from manifest');
      return a;
    } catch (error) { throw new LabError('CONTRACT_MISMATCH', `Saved ${channel} PNG is unavailable or invalid: ${error.message}`, { path, recovery: 'Restore this saved channel; current source is never substituted.' }); }
  });
  const samples = list.flatMap((m, row) => {
    const used = new Map();
    return positions.map((position, column) => {
      const requested = position + (alignment === 'event' ? m.events[event] : 0), t = Math.max(0, Math.min(m.duration, requested));
      const f = m.frames.reduce((a, b) => Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a), r = f.rect;
      if (!r || ![r.x, r.y, r.w, r.h].every(Number.isInteger) || r.x < 0 || r.y < 0 || r.w !== m.size[0] || r.h !== m.size[1] || r.x + r.w > atlases[row].width || r.y + r.h > atlases[row].height) throw new LabError('CONTRACT_MISMATCH', 'Invalid saved frame rectangle', { path: join(records, m.run, 'manifest.json') });
      const sourceIndex = f.index ?? m.frames.indexOf(f), duplicateOf = used.get(sourceIndex) ?? null;
      if (!used.has(sourceIndex)) used.set(sourceIndex, column);
      return { run: m.run, row, column, sourceIndex, requested, actual: f.t, simulationTime: f.simulationTime ?? null, samplingError: f.t - t, clamped: requested !== t, duplicateOf, rect: r, ...(alignment === 'event' ? { offset: position } : {}) };
    });
  });
  const run = `${createHash('sha256').update(JSON.stringify({ runs: list.map(m => m.run), args })).digest('hex').slice(0, 12)}-${randomUUID().slice(0, 8)}`, directory = join(records, run);
  mkdirSync(directory, { recursive: true });
  const matte = channel === 'light' ? [0, 0, 0, 255] : [12, 11, 16, 255], tiles = positions.flatMap((_, col) => list.map((_, row) => row * positions.length + col)), pages = [];
  for (let page = 0; page < pageCount; page++) {
    const indices = tiles.slice(page * perPage, (page + 1) * perPage), actualColumns = Math.min(columns, indices.length), height = 38 + Math.ceil(indices.length / columns) * (h + 44);
    const sheet = canvas(8 + actualColumns * (w + 8), height, matte), cells = [];
    sheet.text(`SAVED ${channel} / NATIVE PIXELS / PAGE ${page + 1}/${pageCount}`, 8, 8, 2);
    indices.forEach((sampleIndex, j) => {
      const s = samples[sampleIndex], m = list[s.row], a = atlases[s.row], x = 8 + j % columns * (w + 8), y = 30 + Math.floor(j / columns) * (h + 44);
      sheet.text(`${String.fromCharCode(65 + s.row)} ${m.run.slice(0, 12)}`, x, y, 2);
      sheet.text(`${positions[s.column].toFixed(3)} / ${s.actual.toFixed(3)}s`, x, y + 14, 2);
      const pixels = Buffer.alloc(m.size[0] * m.size[1] * 4);
      for (let yy = 0; yy < m.size[1]; yy++) a.data.copy(pixels, yy * m.size[0] * 4, ((s.rect.y + yy) * a.width + s.rect.x) * 4, ((s.rect.y + yy) * a.width + s.rect.x + m.size[0]) * 4);
      const frameRect = { x: x + offsets[s.row][0], y: y + 32 + offsets[s.row][1], w: m.size[0], h: m.size[1] };
      sheet.paste(pixels, m.size[0], m.size[1], frameRect.x, frameRect.y); cells.push({ sampleIndex, frameRect });
    });
    const image = join(directory, `page-${String(page + 1).padStart(3, '0')}.png`), png = sheet.png(); writeFileSync(image, png); pages.push({ page: page + 1, image, sha256: createHash('sha256').update(png).digest('hex'), width: sheet.w, height: sheet.h, pixelScale: 1, cells });
  }
  const player = { size: [w, h], matte: channel === 'light' ? '#000000' : '#0c0b10', alignment, positions, fps: Math.max(...list.map(m => m.fps)), rows: list.map((m, i) => ({ id: m.id, run: m.run, atlas: `../${m.run}/${channel}.png`, offset: offsets[i], samples: samples.filter(s => s.row === i) })) };
  const file = join(directory, 'playback.html'), html = playbackHTML(player); writeFileSync(file, html);
  const conditions = list.map(m => ({ run: m.run, revision: m.revision ?? m.sourceDigest, sourceDigest: m.sourceDigest, fps: m.fps, background: m.background, size: m.size, origin: m.origin, bounds: m.bounds ?? null, options: m.options }));
  const result = { run, runs: list.map(m => m.run), channel, representation: 'saved-images', alignment, ...(event ? { event, offsets: positions } : { times: positions }), ...(selection.window ? { window: selection.window } : {}),
    samples, conditions, differingConditions: ['fps', 'background', 'size', 'origin', 'bounds', 'options'].filter(k => new Set(conditions.map(c => JSON.stringify(c[k]))).size > 1),
    image: pages[0].image, pages, pixelScale: 1, anchor, layout: { mode: 'native-pages', columns, maxWidth, maxHeight, pageCount },
    playback: { file, sha256: createHash('sha256').update(html).digest('hex'), urlPath: `/artifacts/${run}/playback.html`, prerequisites: 'Open through the running local lab server, or open this HTML beside its intact sibling saved runs.', source: 'same saved samples as pages; no effect evaluation or interpolation', viewed: false },
    background: channel === 'light' ? 'black additive inspection matte' : channel === 'preview' ? 'saved scenario over dark inspection matte' : 'dark inspection matte', exposure: 1, aestheticScore: null,
    next: 'Inspect each native page or step/play the local window. Request/actual/simulation clocks and repeated/clamped samples are recorded; delivered evidence does not mean it was viewed.' };
  writeFileSync(join(directory, 'comparison.json'), JSON.stringify(result, null, 2) + '\n'); return result;
}
