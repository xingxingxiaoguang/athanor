import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { readRun, RECORDS, compare } from './lab.mjs';
import { withFrozenRun } from './replay.mjs';
import { observationSeries, PARTICLE_UNITS as units, SOURCE_UNITS, CONTACT_UNITS, TRAIL_UNITS, BODY_UNITS } from './observation.mjs';
import { bodyProbe } from './body-probe.mjs';
import { LabError } from './errors.mjs';
import { expandHistory } from './history-storage.mjs';
import { canvas } from '../../tools/lib/fxlib.mjs';
import { createFrame, painterFor } from '../../src/core/index.js';

const digest = (s) => createHash('sha256').update(s).digest('hex');
function timesFor(m, at) {
  if (!at) return m.selected.slice(0, 24).map((i) => m.frames[i].t);
  if (at.times) return at.times;
  if (!Object.hasOwn(m.events, at.event)) throw new LabError('RESOURCE_NOT_FOUND', `Run has no event '${at.event}'`, { details: { events: m.events } });
  return (at.offsets ?? [-0.1, 0, 0.1]).map((offset) => m.events[at.event] + offset);
}
function unavailable(kind = 'particle') { throw new LabError('CAPABILITY_UNSUPPORTED', `This run has no declared ${kind} observations`, { recovery: kind === 'program body' ? 'Declare bodies:[body.observe(subject,t)] in observe(), then explicitly render a new revision. Old pixels/particles do not imply body identity. Inspect core/body.' : kind === 'history trail' ? 'Declare trails:[trail.observe(history,t)] in observe(); render a new revision explicitly. Old particle samples do not imply history. Inspect core/trail.' : kind === 'source' ? 'Declare actual sources with motion.observeSource() in observe(). Render a new revision explicitly; old runs are not backfilled from pixels or synthetic particles. Inspect core/motion.' : 'Use preview/color/light/combined for old effects. New effects can export observe(t,o) with particle.observe(); inspect core/particle. Rendering a new revision is an explicit action; old pixels do not imply particle identity.' }); }

export async function probe({ run, at, view = 'color', sampling = 'saved', layers, particles, fields, tracks, limit = 12, window, layout, selection = 'active' }) {
  const imageView = ['preview', 'color', 'light', 'combined'].includes(view);
  if (tracks && view !== 'trails') throw new LabError('CAPABILITY_UNSUPPORTED', 'tracks selects declared history trails only');
  if (view === 'trails' && (fields || particles)) throw new LabError('CAPABILITY_UNSUPPORTED', 'History probes return complete sampled points; use tracks IDs, not fields/particles');
  if (layout && !imageView && view !== 'bodies') throw new LabError('CAPABILITY_UNSUPPORTED', 'Native page layout applies to saved image channels and body state pages only');
  if (window && !imageView && view !== 'contacts') throw new LabError('CAPABILITY_UNSUPPORTED', 'Use at for declared point/history observations; window is for saved image channels or contact events');
  if (window && at) throw new LabError('INVALID_INPUT', 'Choose window or at, not both');
  if (view === 'contacts') {
    if (window?.event !== undefined || window?.every !== undefined) throw new LabError('CAPABILITY_UNSUPPORTED', 'Contact event windows use absolute from/to and no image sampling step');
    return contactProbe({ run, at, sampling, layers, particles, fields, limit, window });
  }
  const m = readRun(run), desired = window ? [] : timesFor(m, at), times = desired.map((t) => Math.max(0, Math.min(m.duration, t)));
  if (imageView) {
    if (sampling !== 'saved' || layers || particles || fields) throw new LabError('CAPABILITY_UNSUPPORTED', 'Image channel probe reads saved whole-effect frames; particle fields, layer isolation and image replay are not implemented');
    const result = compare({ runs: [run], ...(window ? { window, alignment: window.event ? 'event' : 'time' } : { alignment: 'time', times }), channel: view, layout });
    const requested = window ? result.samples.map(s => s.requested) : desired;
    const report = { ...result, probeRef: `probe-${randomUUID()}`, targetRun: run, sourceDigest: m.sourceDigest, requestedTimes: requested, samples: window ? result.samples : result.samples.map((s, i) => ({ ...s, requested: desired[i], clamped: desired[i] !== times[i] })), scope: 'whole effect, saved channel only', detailRef: join(RECORDS, result.run, 'probe.json') };
    writeFileSync(report.detailRef, JSON.stringify(report, null, 2)); return report;
  }
  if (['sources','bodies'].includes(view) && particles) throw new LabError('CAPABILITY_UNSUPPORTED', 'Source/body observations have stable IDs selected with layers; they do not have particle births');
  fields ??= view === 'trails' ? [] : view === 'bodies' ? ['position','rotation','scale','opacity','bounds','anchors','data'] : view === 'sources' ? ['position', 'velocity', 'rotation', 'angularVelocity', 'derivative'] : ['position', 'velocity', 'age01', 'opacity', 'texture'];
  const availableFields = view === 'bodies' ? BODY_UNITS : view === 'sources' ? SOURCE_UNITS : units;
  for (const field of fields) if (!Object.hasOwn(availableFields, field)) throw new LabError('CAPABILITY_UNSUPPORTED', `Field '${field}' is unavailable for view '${view}'`, { details: { fields: Object.keys(availableFields) } });
  let series, actual;
  if (sampling === 'saved') {
    if (!m.observation) unavailable(view === 'bodies' ? 'program body' : view === 'sources' ? 'source' : view === 'trails' ? 'history trail' : 'particle');
    const file = join(RECORDS, run, m.observation.file);
    let source;
    try { source = readFileSync(file, 'utf8'); } catch { throw new LabError('CONTRACT_MISMATCH', 'Saved observation evidence is missing', { path: file }); }
    if (digest(source) !== m.observation.sha256) throw new LabError('CONTRACT_MISMATCH', 'Saved observation digest differs from manifest', { path: file });
    series = expandHistory(JSON.parse(source));
    actual = times.map((t) => series.frames.reduce((a, b) => Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
  } else {
    const unique = [...new Set(times)].sort((a, b) => a - b);
    const frames = await withFrozenRun(m, join(RECORDS, run), (backend) => backend.sample(backend.fx, unique, m.options, { observe: true, background: 'none' }));
    series = observationSeries(frames); if (!series) unavailable(view === 'bodies' ? 'program body' : view === 'sources' ? 'source' : view === 'trails' ? 'history trail' : 'particle');
    series = expandHistory(series);
    actual = times.map((t) => series.frames[unique.indexOf(t)]);
  }
  if (view === 'trails') { const expanded = expandHistory(series); actual = actual.map(frame => expanded.frames[frame.index]); return trailProbe({ m, run, sampling, series: expanded, actual, desired, times, layers, tracks, limit }); }
  if (view === 'sources') return sourceProbe({ m, run, sampling, series, actual, desired, times, layers, fields, limit });
  if (view === 'bodies') return bodyProbe({m,run,sampling,series,actual,desired,times,layers,fields,limit,layout,records:RECORDS});
  if (!series.layers.length) unavailable();
  const selectedLayers = layers ?? series.layers.map((g) => g.id);
  for (const id of selectedLayers) if (!series.layers.some((g) => g.id === id)) throw new LabError('RESOURCE_NOT_FOUND', `No declared particle group '${id}'`, { details: { layers: series.layers.map((g) => g.id) } });
  const births = series.layers.filter((g) => selectedLayers.includes(g.id)).flatMap((g) => g.births.map((birth) => ({ ...birth, layer: g.id })));
  const allIds = [...new Set(births.map((b) => b.id))];
  for (const id of particles ?? []) if (!allIds.includes(id)) throw new LabError('RESOURCE_NOT_FOUND', `No declared particle '${id}' in selected groups`, { details: { exampleIds: allIds.slice(0, 12), total: allIds.length } });
  const key = (layer, id) => JSON.stringify([layer, id]);
  const anchorTime = Math.max(...actual.map(f => f.t)), active = new Set(), atAnchor = new Set();
  for (const frame of actual) for (const g of frame.particles) if (selectedLayers.includes(g.id)) for (const s of g.states) if (s.status === 'alive') {
    active.add(key(g.id, s.id)); if (frame.t === anchorTime) atAnchor.add(key(g.id, s.id));
  }
  // Preserve latest-time priority, then distribute each tier across groups.
  // A dense first group must not consume the whole default inspection budget.
  const interleave=items=>{
    const groups=selectedLayers.map(layer=>items.filter(b=>b.layer===layer)),out=[];
    for(let i=0;groups.some(g=>i<g.length);i++)for(const group of groups)if(group[i])out.push(group[i]);
    return out;
  };
  const candidates = selection === 'birth-order' ? births : [...interleave(births.filter(b => atAnchor.has(key(b.layer, b.id)))), ...interleave(births.filter(b => active.has(key(b.layer, b.id)) && !atAnchor.has(key(b.layer, b.id))))];
  const selected = particles ? births.filter((b) => particles.includes(b.id)) : candidates.slice(0, limit);
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
    selection: { layers: selectedLayers, mode: particles ? 'explicit particle IDs' : selection === 'birth-order' ? 'first births in declared order' : 'alive at latest sampled time, then other sampled times; round-robin groups in each tier', anchorTime, activeCandidates: active.size, totalBirths: births.length, selectedBirths: selected.length, omittedBirths: births.length - selected.length, omittedActive: particles ? null : [...active].filter(k => !selectedKeys.has(k)).length,
      groups:selectedLayers.map(layer=>({id:layer,activeCandidates:births.filter(b=>b.layer===layer&&active.has(key(layer,b.id))).length,selected: selected.filter(b=>b.layer===layer).length,omittedActive:births.filter(b=>b.layer===layer&&active.has(key(layer,b.id))&&!selectedKeys.has(key(layer,b.id))).length})) },
    scope: 'Author-declared particle data in effect coordinates. Physical velocity excludes visual offsets. Lines connect observed positions only; hidden layers, arbitrary fields and modifier removal are unsupported.',
    image: join(directory, 'probe.png'), detailRef: join(directory, 'probe.json'), aestheticScore: null };
  writeFileSync(result.image, sheet.png()); writeFileSync(result.detailRef, JSON.stringify(result, null, 2)); return result;
}

async function contactProbe({ run, at, sampling, layers, particles, fields, limit, window }) {
  if (at || fields) throw new LabError('CAPABILITY_UNSUPPORTED', 'Contact events have exact solver times and complete records; use window:{from,to}, not at/fields');
  const m = readRun(run), requested = window ?? { from: 0, to: m.duration };
  if (requested.from > requested.to) throw new LabError('INVALID_INPUT', 'Contact window requires from <= to', { path: 'arguments.window' });
  const from = Math.max(0, Math.min(m.duration, requested.from)), to = Math.max(0, Math.min(m.duration, requested.to));
  let series;
  if (sampling === 'replay') {
    const frames = await withFrozenRun(m, join(RECORDS, run), (backend) => backend.sample(backend.fx, [0], m.options, { observe: true, background: 'none' }));
    series = observationSeries(frames);
  } else {
    if (!m.observation) throw new LabError('CAPABILITY_UNSUPPORTED', 'Run has no declared contact events', { recovery: 'Declare contacts:[contact.observe(emitter)] and explicitly render a new run; old pixels do not imply contact IDs.' });
    const file = join(RECORDS, run, m.observation.file); let bytes;
    try { bytes = readFileSync(file, 'utf8'); } catch { throw new LabError('CONTRACT_MISMATCH', 'Saved contact evidence is missing', { path: file }); }
    if (digest(bytes) !== m.observation.sha256) throw new LabError('CONTRACT_MISMATCH', 'Saved observation digest differs from manifest', { path: file });
    series = JSON.parse(bytes);
  }
  if (!series?.contactLayers?.length) throw new LabError('CAPABILITY_UNSUPPORTED', 'Run has no declared contact event groups', { recovery: 'Use contact.observe() in a new revision. Hidden legacy callbacks and particle positions are not event evidence.' });
  const ids = series.contactLayers.map((g) => g.id);
  for (const id of layers ?? []) if (!ids.includes(id)) throw new LabError('RESOURCE_NOT_FOUND', `Unknown contact group '${id}'`, { details: { layers: ids } });
  const groups = series.contactLayers.filter((g) => !layers || layers.includes(g.id)), parents = new Set(groups.flatMap((g) => g.parents));
  for (const id of particles ?? []) if (!parents.has(id)) throw new LabError('RESOURCE_NOT_FOUND', `Unknown contact parent '${id}'`);
  const all = groups.flatMap((g) => g.events).filter((e) => e.time >= from && e.time < to && (!particles || particles.includes(e.particle))).sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
  const selected = all.slice(0, limit), [w, h] = m.size;
  if ((w + 16) * (h + 56) > 8_000_000) throw new LabError('BUDGET_EXCEEDED', 'Contact view exceeds 8 million pixels.');
  const sheet = canvas(w + 16, h + 56), frame = createFrame(w, h), p = painterFor(frame).place(...m.origin);
  selected.forEach((e) => { p.line(...e.position, e.position[0] - e.velocityBefore[0] * .05, e.position[1] - e.velocityBefore[1] * .05, 0xff88abff, .6); if (e.velocityAfter) p.line(...e.position, e.position[0] + e.velocityAfter[0] * .05, e.position[1] + e.velocityAfter[1] * .05, 0xffacf0b0, .8); p.rect(e.position[0] - 1, e.position[1] - 1, 2, 2, 0xffffffff); });
  sheet.text(`CONTACTS ${selected.length}/${all.length}`, 8, 8, 2); sheet.paste(new Uint8Array(frame.color.buffer), w, h, 8, 32);
  const probeRef = `probe-${randomUUID()}`, directory = join(RECORDS, run, probeRef); mkdirSync(directory);
  const result = { probeRef, targetRun: run, sourceDigest: m.sourceDigest, representation: sampling === 'saved' ? 'saved-contact-events' : 'frozen-source-replay', view: 'contacts', samples: [], events: selected, units: CONTACT_UNITS,
    window: { requested, actual: { from, to }, interval: '[from,to)', clamped: from !== requested.from || to !== requested.to }, selection: { layers: groups.map((g) => g.id), totalEvents: all.length, selectedEvents: selected.length, omittedEvents: all.length - selected.length },
    scope: 'Author-declared complete contact records; event times are solver values, not output frames. Incoming/outgoing whiskers represent 0.05 seconds. No continuous trajectory or aesthetic assessment.', pixelScale: 1, image: join(directory, 'probe.png'), detailRef: join(directory, 'probe.json'), aestheticScore: null };
  writeFileSync(result.image, sheet.png()); writeFileSync(result.detailRef, JSON.stringify(result, null, 2)); return result;
}

function sourceProbe({ m, run, sampling, series, actual, desired, times, layers, fields, limit }) {
  if (!series.sourceLayers?.length) unavailable('source');
  const names = series.sourceLayers.map((s) => s.id);
  for (const id of layers ?? []) if (!names.includes(id)) throw new LabError('RESOURCE_NOT_FOUND', `No declared source '${id}'`, { details: { sources: names } });
  const selected = layers ? series.sourceLayers.filter((s) => layers.includes(s.id)) : series.sourceLayers.slice(0, limit);
  const selectedIds = new Set(selected.map((s) => s.id));
  const samples = actual.map((frame, i) => ({ requested: desired[i], actual: frame.t, simulationTime: frame.simulationTime, localTime: frame.localTime, samplingError: frame.t - times[i], clamped: desired[i] !== times[i],
    states: frame.sources.filter((s) => selectedIds.has(s.id)).map((s) => ({ id: s.id, ...Object.fromEntries(fields.map((field) => [field, s[field]])) })) }));
  const [w, h] = m.size;
  if ((w + 8) * times.length * (h + 48) > 8_000_000) throw new LabError('BUDGET_EXCEEDED', 'Source probe view exceeds 8 million pixels; request fewer times.');
  const sheet = canvas((w + 8) * times.length + 8, h + 48), f = createFrame(w, h), p = painterFor(f).place(...m.origin);
  const colors = [0xff88d9ff, 0xffffab88, 0xffb0f0ac, 0xffec99db];
  actual.forEach((frame, i) => {
    f.color.fill(0);
    selected.forEach((selected, j) => {
      const s = frame.sources.find((q) => q.id === selected.id), [x, y] = s.position, color = colors[j % colors.length];
      p.line(x, y, x + s.velocity[0] * .05, y + s.velocity[1] * .05, color, .6);
      p.line(x, y, x + Math.cos(s.rotation) * 5, y + Math.sin(s.rotation) * 5, color, .9);
      p.rect(x - 1, y - 1, 2, 2, color);
    });
    sheet.text(`${frame.t.toFixed(3)}s / SOURCES`, 8 + i * (w + 8), 8, 2); sheet.paste(new Uint8Array(f.color.buffer), w, h, 8 + i * (w + 8), 32);
  });
  const probeRef = `probe-${randomUUID()}`, directory = join(RECORDS, run, probeRef); mkdirSync(directory);
  const result = { probeRef, targetRun: run, sourceDigest: m.sourceDigest, representation: sampling === 'saved' ? 'saved-observations' : 'frozen-source-replay', view: 'sources', pixelScale: 1,
    units: Object.fromEntries(fields.map((field) => [field, SOURCE_UNITS[field]])), sources: selected, samples,
    selection: { mode: layers ? 'explicit source IDs' : 'first declared sources', totalSources: names.length, selectedSources: selected.length, omittedSources: names.length - selected.length },
    scope: 'Actual author-declared source transforms in effect space; no particle births or inferred continuous trajectories. Velocity whiskers represent 0.05 seconds; orientation whiskers are 5 pixels.',
    image: join(directory, 'probe.png'), detailRef: join(directory, 'probe.json'), aestheticScore: null };
  writeFileSync(result.image, sheet.png()); writeFileSync(result.detailRef, JSON.stringify(result, null, 2)); return result;
}

function trailProbe({ m, run, sampling, series, actual, desired, times, layers, tracks, limit }) {
  if (!series?.trailLayers?.length) throw new LabError('CAPABILITY_UNSUPPORTED', 'Run has no declared history trails', { recovery: 'Declare trails:[trail.observe(history,t)] and explicitly render a new revision. Old sampled particle positions do not imply history geometry. Inspect core/trail.' });
  const groups = layers ?? series.trailLayers.map(g => g.id);
  for (const id of groups) if (!series.trailLayers.some(g => g.id === id)) throw new LabError('RESOURCE_NOT_FOUND', `Unknown trail group '${id}'`);
  const all = series.trailLayers.filter(g => groups.includes(g.id)).flatMap(g => g.tracks.map(t => ({ ...t, group: g.id })));
  for (const id of tracks ?? []) if (!all.some(t => t.id === id)) throw new LabError('RESOURCE_NOT_FOUND', `Unknown trail '${id}'`, { details: { exampleIds: all.slice(0,12).map(t=>t.id) } });
  const selected = tracks ? all.filter(t => tracks.includes(t.id)) : all.slice(0,limit);
  const keys = new Set(selected.map(t => JSON.stringify([t.group,t.id])));
  const states = actual.map(f => (f.trails ?? []).flatMap(g => g.states.filter(t => keys.has(JSON.stringify([g.id,t.id]))).map(t=>({...t,group:g.id}))));
  if (states.flat().reduce((n,t)=>n+t.points.length,0)>12000) throw new LabError('BUDGET_EXCEEDED','Trail probe exceeds 12000 retained points; request fewer times/tracks. Points are never silently discarded.');
  const [w,h]=m.size;
  if ((w+8)*times.length*(h+48)>8_000_000) throw new LabError('BUDGET_EXCEEDED','Trail probe exceeds 8 million pixels; request fewer times.');
  const sheet=canvas((w+8)*times.length+8,h+48), f=createFrame(w,h), p=painterFor(f).place(...m.origin), colors=[0xff88d9ff,0xffffab88,0xffb0f0ac,0xffec99db];
  states.forEach((list,i)=>{
    f.color.fill(0);
    list.forEach((state,j)=>{ let previous;
      for(const point of state.points){ if(previous&&!point.breakBefore)p.line(...previous,...point.position,colors[j%colors.length],.8); p.rect(point.position[0]-.5,point.position[1]-.5,1,1,colors[j%colors.length]);previous=point.position; }
    });
    sheet.text(`${actual[i].t.toFixed(3)}s / HISTORY`,8+i*(w+8),8,2);sheet.paste(new Uint8Array(f.color.buffer),w,h,8+i*(w+8),32);
  });
  const probeRef=`probe-${randomUUID()}`,directory=join(RECORDS,run,probeRef);mkdirSync(directory);
  const result={probeRef,targetRun:run,sourceDigest:m.sourceDigest,representation:sampling==='saved'?'saved-history-polylines':'frozen-source-replay',view:'trails',pixelScale:1,units:TRAIL_UNITS,trails:selected,
    samples:actual.map((f,i)=>({requested:desired[i],actual:f.t,simulationTime:f.simulationTime,localTime:f.localTime,samplingError:f.t-times[i],clamped:desired[i]!==times[i],states:states[i]})),
    selection:{groups,totalTrails:all.length,selectedTrails:selected.length,omittedTrails:all.length-selected.length},
    scope:'Author-declared sampled history, oldest to newest, with explicit gaps, temporal resolution and physical/render position choice. Lines connect sampled points, not a continuous-motion guarantee. Shader width/material are not inferred.',
    image:join(directory,'probe.png'),detailRef:join(directory,'probe.json'),aestheticScore:null};
  writeFileSync(result.image,sheet.png());writeFileSync(result.detailRef,JSON.stringify(result,null,2));return result;
}
