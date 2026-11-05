import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { readRun, RECORDS, compare } from './lab.mjs';
import { withFrozenRun } from './replay.mjs';
import { observationSeries, PARTICLE_UNITS as units } from './observation.mjs';
import { LabError } from './errors.mjs';
import { canvas } from '../../tools/lib/fxlib.mjs';
import { createFrame, painterFor } from '../../src/core/index.js';

const digest = (s) => createHash('sha256').update(s).digest('hex');
function timesFor(m, at) {
  if (!at) return m.selected.slice(0, 24).map((i) => m.frames[i].t);
  if (at.times) return at.times;
  if (!Object.hasOwn(m.events, at.event)) throw new LabError('RESOURCE_NOT_FOUND', `Run has no event '${at.event}'`, { details: { events: m.events } });
  return (at.offsets ?? [-0.1, 0, 0.1]).map((offset) => m.events[at.event] + offset);
}
function unavailable() { throw new LabError('CAPABILITY_UNSUPPORTED', 'This run has no declared particle observations', { recovery: 'Use preview/color/light/combined for old effects. New effects can export observe(t,o) with particle.observe(); inspect core/particle. Rendering a new revision is an explicit action; old pixels do not imply particle identity.' }); }

export async function probe({ run, at, view = 'color', sampling = 'saved', layers, particles, fields, limit = 12 }) {
  const m = readRun(run), desired = timesFor(m, at), times = desired.map((t) => Math.max(0, Math.min(m.duration, t)));
  if (['preview', 'color', 'light', 'combined'].includes(view)) {
    if (sampling !== 'saved' || layers || particles || fields) throw new LabError('CAPABILITY_UNSUPPORTED', 'Image channel probe reads saved whole-effect frames; particle fields, layer isolation and image replay are not implemented');
    const result = compare({ runs: [run], alignment: 'time', times, channel: view });
    const report = { ...result, probeRef: `probe-${randomUUID()}`, targetRun: run, sourceDigest: m.sourceDigest, requestedTimes: desired, samples: result.samples.map((s, i) => ({ ...s, requested: desired[i], clamped: desired[i] !== times[i] })), scope: 'whole effect, saved channel only', detailRef: join(RECORDS, result.run, 'probe.json') };
    writeFileSync(report.detailRef, JSON.stringify(report, null, 2)); return report;
  }
  fields ??= ['position', 'velocity', 'age01', 'opacity', 'texture'];
  let series, actual;
  if (sampling === 'saved') {
    if (!m.observation) unavailable();
    const file = join(RECORDS, run, m.observation.file);
    let source;
    try { source = readFileSync(file, 'utf8'); } catch { throw new LabError('CONTRACT_MISMATCH', 'Saved observation evidence is missing', { path: file }); }
    if (digest(source) !== m.observation.sha256) throw new LabError('CONTRACT_MISMATCH', 'Saved observation digest differs from manifest', { path: file });
    series = JSON.parse(source);
    actual = times.map((t) => series.frames.reduce((a, b) => Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
  } else {
    const unique = [...new Set(times)].sort((a, b) => a - b);
    const frames = await withFrozenRun(m, join(RECORDS, run), (backend) => backend.sample(backend.fx, unique, m.options, { observe: true, background: 'none' }));
    series = observationSeries(frames); if (!series) unavailable();
    actual = times.map((t) => series.frames[unique.indexOf(t)]);
  }
  const selectedLayers = layers ?? series.layers.map((g) => g.id);
  for (const id of selectedLayers) if (!series.layers.some((g) => g.id === id)) throw new LabError('RESOURCE_NOT_FOUND', `No declared particle group '${id}'`, { details: { layers: series.layers.map((g) => g.id) } });
  const births = series.layers.filter((g) => selectedLayers.includes(g.id)).flatMap((g) => g.births.map((birth) => ({ ...birth, layer: g.id })));
  const allIds = [...new Set(births.map((b) => b.id))];
  for (const id of particles ?? []) if (!allIds.includes(id)) throw new LabError('RESOURCE_NOT_FOUND', `No declared particle '${id}' in selected groups`, { details: { exampleIds: allIds.slice(0, 12), total: allIds.length } });
  const selected = particles ? births.filter((b) => particles.includes(b.id)) : births.slice(0, limit);
  const selectedKeys = new Set(selected.map((b) => JSON.stringify([b.layer, b.id])));
  const samples = actual.map((frame, i) => ({ requested: desired[i], actual: frame.t, simulationTime: frame.simulationTime, localTime: frame.localTime, samplingError: frame.t - times[i], clamped: desired[i] !== times[i],
    states: frame.particles.filter((g) => selectedLayers.includes(g.id)).flatMap((g) => g.states.filter((s) => selectedKeys.has(JSON.stringify([g.id, s.id]))).map((s) => ({ layer: g.id, id: s.id, status: s.status, ...Object.fromEntries(fields.filter((f) => Object.hasOwn(s, f)).map((f) => [f, s[f]])) }))),
    counts: frame.particles.filter((g) => selectedLayers.includes(g.id)).map((g) => ({ layer: g.id, ...Object.fromEntries(['pending', 'alive', 'expired', 'killed'].map((status) => [status, g.states.filter((s) => s.status === status).length])) })),
  }));
  // Visuals use all selected positions even when callers omit position fields.
  const [w, h] = m.size, columns = view === 'trajectory' ? 1 : times.length;
  if ((w + 8) * columns * (h + 48) > 8_000_000) throw new LabError('BUDGET_EXCEEDED', 'Probe view exceeds 8 million pixels; request fewer times.');
  const sheet = canvas((w + 8) * columns + 8, h + 48), f = createFrame(w, h), p = painterFor(f).place(...m.origin);
  const colors = [0xff88d9ff, 0xffffab88, 0xffb0f0ac, 0xffec99db, 0xffd9b399, 0xff99e2e2];
  const get = (frame, birth) => frame.particles.find((g) => g.id === birth.layer)?.states.find((s) => s.id === birth.id);
  if (view === 'trajectory') {
    selected.forEach((birth, j) => {
      let previous;
      for (const frame of [...new Set(actual)].sort((a, b) => a.t - b.t)) {
        const s = get(frame, birth);
        if (s?.status !== 'alive') { previous = null; continue; }
        if (previous) p.line(...previous, ...s.position, colors[j % colors.length], 0.8);
        p.rect(s.position[0] - 0.5, s.position[1] - 0.5, 1, 1, colors[j % colors.length]); previous = s.position;
      }
    });
    sheet.text('SAMPLED PATH / EFFECT PIXELS', 8, 8, 2); sheet.paste(new Uint8Array(f.color.buffer), w, h, 8, 32);
  } else {
    actual.forEach((frame, i) => {
      f.color.fill(0); selected.forEach((birth, j) => { const s = get(frame, birth); if (s?.status === 'alive') { if (s.velocity) p.line(...s.position, s.position[0] + s.velocity[0] * 0.05, s.position[1] + s.velocity[1] * 0.05, colors[j % colors.length], 0.6); p.rect(s.position[0] - 1, s.position[1] - 1, 2, 2, colors[j % colors.length]); } });
      sheet.text(`${frame.t.toFixed(3)}s / PARTICLES`, 8 + i * (w + 8), 8, 2); sheet.paste(new Uint8Array(f.color.buffer), w, h, 8 + i * (w + 8), 32);
    });
  }
  const probeRef = `probe-${randomUUID()}`, directory = join(RECORDS, run, probeRef); mkdirSync(directory);
  const result = { probeRef, targetRun: run, sourceDigest: m.sourceDigest, representation: sampling === 'saved' ? 'saved-observations' : 'frozen-source-replay', view, pixelScale: 1, units: Object.fromEntries(fields.map((f) => [f, units[f]])), births: selected, samples,
    selection: { layers: selectedLayers, mode: particles ? 'explicit particle IDs' : 'first births in declared order', totalBirths: births.length, selectedBirths: selected.length, omittedBirths: births.length - selected.length },
    scope: 'Author-declared particle data in effect coordinates. Physical velocity excludes visual offsets. Lines connect observed positions only; hidden layers, arbitrary fields and modifier removal are unsupported.',
    image: join(directory, 'probe.png'), detailRef: join(directory, 'probe.json'), aestheticScore: null };
  writeFileSync(result.image, sheet.png()); writeFileSync(result.detailRef, JSON.stringify(result, null, 2)); return result;
}
