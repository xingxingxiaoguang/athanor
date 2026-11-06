import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync, realpathSync } from "node:fs";
import { join, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { allIds, loadEffect, ROOT, canvas } from "../../tools/lib/fxlib.mjs";
import { encodePNG, decodePNG } from "../../tools/lib/png.mjs";
import { createFrame, clearFrame, composite, backdrop, drawActor, painterFor, actorAlphaOf, resolveOptions } from "../../src/core/index.js";
import { clockedFx, TICK_RATE } from "./clock.js";
import { RECIPES } from "./recipes.mjs";
import { TOOLS, validateInput } from "./definitions.mjs";
import { LabError } from "./errors.mjs";
import { digestOf, entryFor, replaySupport, revisionOf, withFrozenRun } from "./replay.mjs";
import { apiResources, inspectApi, authoringContract } from "./contracts.mjs";
import { captureSources } from "./source-parser.mjs";
import { normalizeObservation, observationSeries } from "./observation.mjs";
import { probe } from "./probe.mjs";

export const LAB = dirname(fileURLToPath(import.meta.url));
export const RECORDS = join(ROOT, "records", "vfx-lab");
const ID = /^[a-z0-9-]+\/[a-z0-9-]+$/;
const RUN = /^[a-f0-9]{12}-[a-f0-9]{8}$/;
const hash = (data) => createHash("sha256").update(data).digest("hex");
const json = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + "\n");

export async function effect(id) {
  if (!ID.test(id)) throw new LabError("INVALID_INPUT", "Invalid effect ID; use category/name");
  const [category, name] = id.split("/");
  const entry = join(ROOT, entryFor(id));
  if (!existsSync(entry)) throw new LabError("RESOURCE_NOT_FOUND", `Effect '${id}' does not exist`, { recovery: "Use fx_search to find an existing effect or fx_scaffold to create a draft." });
  let fx;
  try {
    fx = category === "lab" || category === "draft"
      ? await loadEffect(`${category === "lab" ? "effects" : "drafts"}/${name}`, LAB)
      : await loadEffect(id);
  } catch (error) {
    throw new LabError(error.code === "ERR_MODULE_NOT_FOUND" ? "RESOURCE_NOT_FOUND" : "CONTRACT_MISMATCH", `Cannot load effect '${id}': ${error.message}`, {
      path: entry, details: { id, file: entry, cause: error.name },
      recovery: "Fix this effect's JavaScript syntax, relative imports or meta/draw/create exports in the editable source file. A helper without meta can be excluded from discovery with a leading underscore; other search results remain available.",
    });
  }
  const m = fx.meta;
  if (!Array.isArray(m.tags) || m.tags.some((tag) => typeof tag !== "string")) throw new LabError("CONTRACT_MISMATCH", "Effect tags must be a string array", { path: "meta.tags", recovery: "Correct meta.tags in the effect source; inspect core/effect for the module contract." });
  if (!Array.isArray(m.size) || m.size.length !== 2 || m.size.some((v) => !Number.isInteger(v) || v < 8 || v > 480)) throw new LabError("CONTRACT_MISMATCH", "Effect size must be two integers in 8..480 pixels", { path: "meta.size" });
  if (!Array.isArray(m.origin) || m.origin.length !== 2 || m.origin.some((v) => !Number.isFinite(v))) throw new LabError("CONTRACT_MISMATCH", "Effect origin must be two finite coordinates", { path: "meta.origin" });
  if (!(m.duration > 0 && m.duration <= 12)) throw new LabError("CONTRACT_MISMATCH", "Effect duration must be in (0, 12] seconds", { path: "meta.duration" });
  if (fx.mod.authoring?.ending && !["clear", "residue", "persistent", "handoff", "loop"].includes(fx.mod.authoring.ending)) throw new LabError("CONTRACT_MISMATCH", "authoring.ending must be clear, residue, persistent, handoff or loop");
  if (fx.mod.authoring?.ending && (fx.mod.authoring.ending === "loop") !== !!m.loop) throw new LabError("CONTRACT_MISMATCH", "authoring.ending and meta.loop disagree");
  return { ...fx, id };
}

function ids() {
  const local = (folder, category) => existsSync(join(LAB, folder)) ? readdirSync(join(LAB, folder)).filter((p) => /^[a-z0-9-]+\.js$/.test(p)).map((p) => `${category}/${p.slice(0, -3)}`) : [];
  return [...allIds(), ...local("effects", "lab"), ...local("drafts", "draft")];
}

// Capture the local import closure, including the renderer, to make a run reviewable
// even after source edits. Fresh tool processes avoid Node's transitive import cache.
export function sources(entry, result = {}) {
  const snapshot = captureSources(entry, ROOT, result);
  Object.assign(result, snapshot);
  return result;
}

function resolvedOptions(fx, options = {}) {
  if (options.actor !== undefined || options.x !== undefined || options.y !== undefined) throw new LabError("INVALID_INPUT", "Actor masks and placement are supplied by the lab, not options", { path: "arguments.options" });
  const result = resolveOptions(fx.meta, options);
  delete result.actor;
  return result;
}

function snapshotOf(fx) {
  const snapshot = sources(fx.file);
  sources(join(LAB, "lab.mjs"), snapshot);
  return snapshot;
}

function targetOf(args) { return args.target ?? (args.run ? { run: args.run } : { id: args.id, options: args.options }); }

function capabilities(fx) {
  const declared = typeof fx.mod.observe === 'function';
  return { wholeEffect: true, colorLight: true, frozenReplay: "relative local JavaScript only; inspect run replay status", namedLayers: false, particles: declared, trails: declared ? "actual declared sampled history only; render manifest lists tracks" : false, contacts: declared ? "actual declared contact event tables only; render manifest lists groups/counts" : false, sources: declared ? "actual declared sources only; render manifest lists available IDs" : false, trajectories: declared ? "sampled declared positions; no inferred continuous path" : false, fields: false, fullAct: false, observation: declared ? "Optional observe(t,options) particle/source/contact/trail protocols; availability verified and saved by render, not inferred from pixels" : null, authoringDeclaration: fx.mod.authoring ?? null };
}

export function presentRun(manifest, detail = "summary") {
  const directory = join(RECORDS, manifest.run);
  const { frames, sourceFiles, runtime, ...summary } = manifest;
  return {
    ...(detail === "full" ? manifest : summary), directory, manifest: join(directory, "manifest.json"),
    frameCount: manifest.frames.length, image: join(directory, "contact.png"),
    target: { id: manifest.id, revision: manifest.revision ?? manifest.sourceDigest, run: manifest.run },
    next: "Inspect contact.png and playback. Compare saved runs, validate this run, then explicitly export the chosen run. Request detail:'full' or read manifest for frame tables.",
  };
}

export function eventFrames(duration, fps, events = {}) {
  const n = Math.ceil(duration * fps), indices = new Set([0, n]);
  for (let i = 1; i < 5; i++) indices.add(Math.round(n * i / 5));
  for (const t of Object.values(events)) {
    const center = Math.round(t * fps);
    for (const delta of [-1, 0, 1]) indices.add(Math.max(0, Math.min(n, center + delta)));
  }
  return [...indices].sort((a, b) => a - b);
}

function mergedEvents(fx, overrides = {}) {
  const events = { ...(fx.mod.events ?? {}), ...overrides };
  for (const [name, time] of Object.entries(events)) if (!Number.isFinite(time) || time < 0 || time > fx.meta.duration) throw new LabError("CONTRACT_MISMATCH", `Event ${name} must lie inside 0..${fx.meta.duration} seconds`, { path: `events.${name}` });
  return events;
}

export function sample(fx, times, options = {}, { margin = 0, background = "ground", actor = false, observe = false } = {}) {
  const m = fx.meta, w = m.size[0] + margin * 2, h = m.size[1] + margin * 2;
  const frame = createFrame(w, h, -margin, -margin);
  const inst = clockedFx(fx.mod, { ...options, x: m.origin[0], y: m.origin[1] });
  const bg = background === "none" ? null : backdrop(background, w, h, m.origin[1] + margin);
  let previous = 0;
  return times.map((t) => {
    if (t < previous || !Number.isFinite(t)) throw new Error("Sample times must be finite and in order");
    if (fx.mod.create) inst.update(t - previous); else inst.seek(t);
    previous = t;
    clearFrame(frame); inst.draw(frame);
    const color = frame.color.slice(), light = frame.light.slice();
    const combined = composite(frame, new Uint8ClampedArray(w * h * 4));
    if (actor && m.actor) {
      clearFrame(frame); inst.draw(frame, "back");
      drawActor(painterFor(frame).place(m.origin[0], m.origin[1], !!options.flip), inst.options.actor, actorAlphaOf(fx.mod, t, inst.options));
      inst.draw(frame, "front");
    }
    const localTime = m.loop ? inst.t % m.duration : Math.min(inst.t, m.duration);
    const observation = observe && typeof fx.mod.observe === 'function' ? normalizeObservation(fx.mod.observe(localTime, inst.options)) : undefined;
    return { t, simulationTime: inst.t, localTime, color, light, combined, preview: composite(frame, new Uint8ClampedArray(w * h * 4), bg), ...(observation ? { observation } : {}) };
  });
}

// Copy straight RGBA bytes. canvas.paste() composites and would premultiply
// translucent smoke against transparent black, corrupting a reusable atlas.
export function blit(target, targetWidth, pixels, w, h, x, y) {
  for (let row = 0; row < h; row++) target.set(pixels.subarray(row * w * 4, (row + 1) * w * 4), ((y + row) * targetWidth + x) * 4);
}

function pack(frames, w, h, field, columns) {
  const width = columns * w, height = Math.ceil(frames.length / columns) * h;
  const data = new Uint8ClampedArray(width * height * 4);
  frames.forEach((frame, i) => {
    let rgba;
    if (field === "color") rgba = new Uint8Array(frame.color.buffer);
    else if (field === "light") {
      rgba = new Uint8ClampedArray(w * h * 4);
      frame.light.forEach((c, j) => { rgba[j * 4] = c & 255; rgba[j * 4 + 1] = (c >>> 8) & 255; rgba[j * 4 + 2] = (c >>> 16) & 255; rgba[j * 4 + 3] = c & 0xffffff ? 255 : 0; });
    } else rgba = frame[field];
    blit(data, width, rgba, w, h, i % columns * w, Math.floor(i / columns) * h);
  });
  return { width, height, data };
}

export async function render(args) {
  const target = targetOf(args);
  if (target.run) {
    const parent = readRun(target.run);
    return withFrozenRun(parent, join(RECORDS, parent.run), (backend) => renderResolved({ ...args, id: parent.id, options: parent.options, fps: args.fps ?? parent.fps, background: args.background ?? parent.background, events: { ...parent.events, ...args.events } }, { ...backend, parent }));
  }
  const fx = await effect(target.id);
  return renderResolved({ ...args, id: target.id, options: target.options }, { fx, snapshot: snapshotOf(fx), sample });
}

async function renderResolved(args, backend) {
  const { fx, snapshot, parent } = backend, m = fx.meta, fps = args.fps ?? 30;
  // Saved options belong to the saved backend. Do not reinterpret them through
  // the current core's defaults or palette conversion during frozen replay.
  const options = parent ? { ...parent.options } : resolvedOptions(fx, args.options);
  const n = Math.ceil(m.duration * fps) + 1, [w, h] = m.size;
  if (n * w * h > 24_000_000) throw new LabError("BUDGET_EXCEEDED", "Render exceeds 24 million frame-pixels", { recovery: "Lower output fps or use a smaller authored canvas; resolution is never silently reduced." });
  const events = mergedEvents(fx, args.events), background = args.background ?? "ground";
  const runtime = { node: process.version, platform: process.platform, arch: process.arch };
  const sourceDigest = digestOf(snapshot), revision = parent ? parent.revision ?? parent.sourceDigest : revisionOf(snapshot, entryFor(fx.id), options);
  const engine = parent ? parent.engine ?? "lab-fixed-120-v1" : "lab-fixed-120-v2";
  const identity = { id: args.id, options, fps, events, background, engine, runtime, sources: snapshot };
  const digest = hash(JSON.stringify(identity)), run = `${digest.slice(0, 12)}-${randomUUID().slice(0, 8)}`, dir = join(RECORDS, run);
  const times = Array.from({ length: n }, (_, i) => Math.min(i / fps, m.duration));
  const frames = backend.sample(fx, times, options, { background, actor: true, observe: true });
  const observation = observationSeries(frames), observationText = observation ? JSON.stringify(observation) : null;
  mkdirSync(dir, { recursive: true });
  const columns = Math.ceil(Math.sqrt(n * h / w));
  let atlasSize;
  for (const field of ["preview", "color", "light", "combined"]) {
    const atlas = pack(frames, w, h, field, columns); atlasSize = [atlas.width, atlas.height];
    writeFileSync(join(dir, `${field}.png`), encodePNG(atlas.width, atlas.height, atlas.data));
    if (field === "preview") writeFileSync(join(dir, "preview.rgba"), atlas.data);
  }
  const selected = eventFrames(m.duration, fps, events), cols = Math.min(5, selected.length);
  const sheet = canvas(cols * (w + 8) + 8, Math.ceil(selected.length / cols) * (h + 28) + 30);
  sheet.text(`${fx.id} / NATIVE PIXELS / EVENT FRAMES`, 8, 8, 2);
  selected.forEach((index, j) => {
    const x = 8 + j % cols * (w + 8), y = 30 + Math.floor(j / cols) * (h + 28);
    sheet.text(`${index} / ${frames[index].t.toFixed(3)}s`, x, y, 2);
    sheet.paste(frames[index].preview, w, h, x, y + 16);
  });
  writeFileSync(join(dir, "contact.png"), sheet.png());
  const manifest = {
    version: 2, engine, run, digest, revision, parentRun: parent?.run ?? null, entry: entryFor(fx.id), id: fx.id, name: m.name, createdAt: new Date().toISOString(), note: args.note ?? "",
    options, background, fps, size: m.size, origin: m.origin, duration: m.duration, loop: m.loop,
    implementation: fx.mod.create ? "simulated" : "pure", runtime, clock: { tickRate: TICK_RATE, sampling: "simulation holds the last complete tick; pure effects use exact requested time" },
    events, selected, atlas: { size: atlasSize, columns },
    frames: frames.map((f, i) => ({ index: i, t: f.t, simulationTime: f.simulationTime, rect: { x: i % columns * w, y: Math.floor(i / columns) * h, w, h } })),
    files: { preview: "preview.png", color: "color.png", light: "light.png", combined: "combined.png", contact: "contact.png" },
    sourceFiles: Object.keys(snapshot), sourceDigest, replay: replaySupport(snapshot, entryFor(fx.id)),
    ending: fx.mod.authoring?.ending ?? (m.loop ? "loop" : "clear"), capabilities: capabilities(fx),
    observation: observation ? { file: "observations.json", sha256: hash(observationText), version: observation.version, ...(observation.historyEncoding ? {historyEncoding:observation.historyEncoding} : {}), layers: observation.layers.map((g) => ({ id: g.id, birthCount: g.births.length })), ...(observation.sourceLayers?.length ? { sources: observation.sourceLayers } : {}), ...(observation.trailLayers?.length ? { trails: observation.trailLayers.map(g => ({id:g.id,trackCount:g.tracks.length})) } : {}), ...(observation.contactLayers?.length ? { contacts: observation.contactLayers.map((g) => ({ id: g.id, eventCount: g.events.length })) } : {}), frames: observation.frames.length } : null,
    diagnostics: frames.some((f) => f.color.some((c) => c >>> 24) || f.light.some((c) => c & 0xffffff)) ? [] : [{ code: "DRAWS_NOTHING", severity: "warning", message: "No color or light appears at saved sample times. This observation does not identify the cause.", recovery: { tool: "fx_inspect", arguments: { ref: { kind: "operator", id: "core/color" } } } }],
    aestheticApproval: null, actorPreview: "standing scale reference; acts are not played in this MVP",
  };
  if (observationText) writeFileSync(join(dir, "observations.json"), observationText);
  json(join(dir, "sources.json"), snapshot); json(join(dir, "manifest.json"), manifest);
  return presentRun(manifest, args.detail);
}

export function readRun(run) {
  if (!RUN.test(run)) throw new LabError("INVALID_INPUT", "Invalid run ID");
  const file = join(RECORDS, run, "manifest.json");
  if (!existsSync(file)) throw new LabError("RESOURCE_NOT_FOUND", `Saved run '${run}' does not exist`, { recovery: "Use fx_history with an effect ID or query to find saved runs." });
  return JSON.parse(readFileSync(file, "utf8"));
}

export function history(limit = 60) {
  if (!existsSync(RECORDS)) return [];
  return readdirSync(RECORDS).filter((p) => RUN.test(p)).flatMap((p) => {
    // A render may still be writing, or a test may remove its own fixture.
    try { return [readRun(p)]; } catch { return []; }
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.run.localeCompare(a.run)).slice(0, limit);
}

export function compare({ runs, event, alignment = "event", offsets = [-0.1, 0, 1 / 30, 0.1, 0.3, 0.7], times, channel = "preview" }) {
  const list = runs.map(readRun), positions = alignment === "time" ? times : offsets;
  if (alignment === "event" && list.some((m) => m.events[event] === undefined)) throw new LabError("RESOURCE_NOT_FOUND", `Every run must define event '${event}'; use an existing event or absolute time alignment`, { details: { events: list.map((m) => ({ run: m.run, events: m.events })) } });
  const left = Math.max(...list.map((m) => m.origin[0])), top = Math.max(...list.map((m) => m.origin[1]));
  const w = left + Math.max(...list.map((m) => m.size[0] - m.origin[0])), h = top + Math.max(...list.map((m) => m.size[1] - m.origin[1]));
  if (w > 960 || h > 960 || (positions.length * (w + 8) + 8) * (list.length * (h + 40) + 8) > 24_000_000) throw new LabError("BUDGET_EXCEEDED", "Comparison exceeds the canvas budget", { recovery: "Request fewer times/offsets; native pixel scale is preserved." });
  // Stored light PNGs encode additive RGB with opaque nonzero pixels. Their
  // neutral inspection surface must be black; ordinary alpha over a gray
  // matte would turn faint light into darker silhouettes.
  const img = canvas(positions.length * (w + 8) + 8, list.length * (h + 40) + 8, channel === "light" ? [0, 0, 0, 255] : [12, 11, 16, 255]), samples = [];
  for (const [row, m] of list.entries()) {
    const aw = m.atlas.size[0]; let raw;
    try {
      if (channel === "preview") raw = readFileSync(join(RECORDS, m.run, "preview.rgba"));
      else {
        const atlas = decodePNG(readFileSync(join(RECORDS, m.run, `${channel}.png`)));
        if (atlas.width !== aw || atlas.height !== m.atlas.size[1]) throw new Error("Saved image dimensions differ from manifest");
        raw = atlas.data;
      }
      if (raw.length !== aw * m.atlas.size[1] * 4) throw new Error("Saved pixel buffer length differs from manifest");
    } catch (error) { throw new LabError("CONTRACT_MISMATCH", `Cannot read saved ${channel} evidence: ${error.message}`, { path: join(RECORDS, m.run, channel === "preview" ? "preview.rgba" : `${channel}.png`), recovery: "Use an intact saved run/channel. The tool will not substitute current source or re-render to repair this evidence." }); }
    img.text(`${m.id} / ${channel.toUpperCase()} / ${m.run.slice(0, 12)}`, 8, row * (h + 40) + 6, 2);
    const used = new Map();
    for (const [col, position] of positions.entries()) {
      const desired = alignment === "time" ? position : m.events[event] + position, t = Math.max(0, Math.min(m.duration, desired));
      const f = m.frames.reduce((a, b) => Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a), pixels = new Uint8Array(m.size[0] * m.size[1] * 4);
      if (![f.rect.x, f.rect.y, f.rect.w, f.rect.h].every(Number.isInteger) || f.rect.x < 0 || f.rect.y < 0 || f.rect.w !== m.size[0] || f.rect.h !== m.size[1] || f.rect.x + f.rect.w > aw || f.rect.y + f.rect.h > m.atlas.size[1]) throw new LabError("CONTRACT_MISMATCH", "Saved frame rectangle is invalid for this atlas", { path: join(RECORDS, m.run, "manifest.json"), recovery: "Use the intact manifest and images for this saved run. No frame is fabricated from invalid coordinates." });
      for (let y = 0; y < m.size[1]; y++) pixels.set(raw.subarray(((f.rect.y + y) * aw + f.rect.x) * 4, ((f.rect.y + y) * aw + f.rect.x + m.size[0]) * 4), y * m.size[0] * 4);
      const x = 8 + col * (w + 8), y = row * (h + 40) + 24;
      img.text(`${alignment === "event" && position >= 0 ? "+" : ""}${position.toFixed(3)} / ${f.t.toFixed(3)}s`, x, y, 2);
      img.paste(pixels, m.size[0], m.size[1], x + left - m.origin[0], y + 16 + top - m.origin[1]);
      samples.push({ run: m.run, column: col, ...(alignment === "event" ? { offset: position } : {}), requested: desired, actual: f.t, simulationTime: f.simulationTime, samplingError: f.t - t, clamped: desired !== t, duplicateOf: used.get(f.index) ?? null });
      if (!used.has(f.index)) used.set(f.index, col);
    }
  }
  const run = `${hash(JSON.stringify({ runs, event, alignment, positions, channel })).slice(0, 12)}-${randomUUID().slice(0, 8)}`, dir = join(RECORDS, run);
  mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, "compare.png"), img.png());
  const conditions = list.map((m) => ({ run: m.run, fps: m.fps, background: m.background, size: m.size, origin: m.origin, options: m.options }));
  const differingConditions = ["fps", "background", "size", "origin", "options"].filter((key) => new Set(conditions.map((c) => JSON.stringify(c[key]))).size > 1);
  const result = { run, runs, channel, representation: "saved-images", background: channel === "preview" ? "saved scenario" : channel === "light" ? "black additive inspection matte; original light RGB at exposure 1" : "dark inspection matte; channels are read from saved transparent atlases", exposure: 1, alignment, ...(alignment === "event" ? { event, offsets: positions } : { times: positions }), samples, conditions, differingConditions, image: join(dir, "compare.png"), pixelScale: 1, aestheticScore: null, next: "Judge against the brief. Nearest saved frames are shown; repeated/clamped samples are identified. Condition differences cannot be attributed only to source edits." };
  json(join(dir, "comparison.json"), result); return result;
}

const frameHash = (frame) => hash(Buffer.concat([Buffer.from(frame.color.buffer), Buffer.from(frame.light.buffer)]));
export async function validate(args) {
  const target = targetOf(args);
  if (target.run) {
    const manifest = readRun(target.run);
    return withFrozenRun(manifest, join(RECORDS, manifest.run), (backend) => validateResolved(backend, manifest.options, manifest));
  }
  const fx = await effect(target.id);
  return validateResolved({ fx, sample, clockedFx, createFrame, clearFrame, snapshot: snapshotOf(fx) }, target.options);
}

async function validateResolved(backend, inputOptions = {}, manifest = null) {
  const { fx, sample, clockedFx, createFrame, clearFrame, snapshot } = backend;
  const options = manifest ? { ...manifest.options } : resolvedOptions(fx, inputOptions), id = fx.id, m = fx.meta, errors = [], diagnostics = [], D = m.duration;
  const ending = fx.mod.authoring?.ending ?? (m.loop ? "loop" : "clear");
  const times = [...new Set([0, ...Array.from({ length: 11 }, (_, i) => D * (i + 1) / 12), ...Object.values(manifest?.events ?? mergedEvents(fx)), D])].sort((a, b) => a - b);
  const findings = (list, code, message, evidence = {}) => list.push({ code, message, ...evidence });
  const firstSeed = options.seed ?? m.options.seed ?? 1;
  const seeds = [firstSeed, firstSeed === 7 ? 1 : 7];
  let sampledTimes;
  const src = readFileSync(fx.file, "utf8");
  if (/\bMath\.random\s*\(|\bDate\s*[.(]/.test(src)) findings(errors, "UNSEEDED_TIME", "Effect source uses Math.random or Date; use a seeded generator and effect time.");
  for (const seed of seeds) {
    const opts = { ...options, seed }, frames = sample(fx, times, opts, { margin: 24 }), replay = sample(fx, times, opts, { margin: 24 });
    sampledTimes ??= frames.map((f) => ({ requested: f.t, actual: f.simulationTime }));
    if (frames.some((f, i) => frameHash(f) !== frameHash(replay[i]))) findings(errors, "NONDETERMINISTIC", "Same time and seed changed color or light.", { seed });
    let colorSpill = 0, lightSpill = 0;
    frames.forEach((f) => f.color.forEach((c, j) => {
      const w = m.size[0] + 48, x = j % w - 24, y = Math.floor(j / w) - 24;
      if (x >= 0 && y >= 0 && x < m.size[0] && y < m.size[1]) return;
      if (c >>> 24) colorSpill++;
      if ((f.light[j] & 255) + ((f.light[j] >>> 8) & 255) + ((f.light[j] >>> 16) & 255) > 90) lightSpill++;
    }));
    if (colorSpill) findings(errors, "COLOR_SPILL", "Solid/translucent color leaves the declared canvas in sampled frames.", { seed, pixels: colorSpill });
    if (lightSpill) findings(diagnostics, "LIGHT_SPILL", "Bright light leaves the canvas; inspect the edge on dark and light backgrounds.", { seed, pixels: lightSpill });
    if (!frames.some((f) => f.color.some((c) => c >>> 24) || f.light.some((c) => c & 0xffffff))) findings(errors, "DRAWS_NOTHING", "No color or light appears at any sampled time. Cause is not identified; inspect the drawing and color contracts.", { seed, recovery: { tool: "fx_inspect", arguments: { ref: { kind: "operator", id: "core/color" } } } });
    const end = frames.at(-1), colorPixels = end.color.reduce((n, c) => n + (c >>> 24 ? 1 : 0), 0), lightPixels = end.light.reduce((n, c) => n + (c & 0xffffff ? 1 : 0), 0);
    if (ending === "clear" && (colorPixels || lightPixels)) findings(errors, "END_NOT_EMPTY", "Clear-ending effect still draws color or light at the ending sample.", { seed, time: D, actualTime: end.simulationTime, colorPixels, lightPixels });
    if (["residue", "persistent", "handoff"].includes(ending)) findings(diagnostics, "DECLARED_ENDING", `Ending '${ending}' permits non-empty output; stability and handoff are not certified.`, { seed, time: D, colorPixels, lightPixels });
    if (m.loop) {
      const periodic = sample(fx, [D * 0.37, D * 1.37], opts);
      if (frameHash(periodic[0]) !== frameHash(periodic[1])) findings(errors, "LOOP_PERIOD", "The same phase in successive periods differs in color or light.", { seed });
      findings(diagnostics, "LOOP_REVIEW", "Period equality does not prove velocity continuity; watch at least three repeats.", { seed });
    }
  }
  const clockHashes = [], probeTime = Math.min(1, D / 2);
  for (const fps of [30, 60, 240]) {
    const inst = clockedFx(fx.mod, options), f = createFrame(...m.size);
    for (let i = 0; i < Math.ceil(probeTime * fps); i++) inst.update(Math.min(1 / fps, probeTime - i / fps));
    inst.options.x = m.origin[0]; inst.options.y = m.origin[1]; inst.draw(f);
    const digest = frameHash(f);
    clearFrame(f); inst.draw(f);
    if (digest !== frameHash(f)) findings(errors, "DRAW_MUTATES_STATE", "Drawing twice without advancing time changes color or light; move state changes into update().", { fps });
    clockHashes.push({ fps, time: probeTime, simulationTime: inst.t, digest });
  }
  if (new Set(clockHashes.map((s) => s.digest)).size > 1) findings(errors, "CLOCK_DRIFT", "Playback at the probe time differs across tested update rates; inspect time-based drawing or stateful draw().", { time: probeTime });
  const sourceDigest = digestOf(snapshot), revision = manifest ? manifest.revision ?? manifest.sourceDigest : revisionOf(snapshot, entryFor(fx.id), options);
  const validationRef = `validation-${randomUUID()}`;
  const result = { validationRef, createdAt: new Date().toISOString(), id, targetRun: manifest?.run ?? null, target: { id, revision, run: manifest?.run ?? null }, sourceDigest, options, ending,
    representation: manifest ? "frozen-source-replay" : "current-source-replay", savedFramesVerified: false,
    passed: errors.length === 0, errors, diagnostics, coverage: { times, samples: sampledTimes, seeds, channels: ["color", "light"], updateRates: [30, 60, 240], boundsMargin: 24, exhaustive: false, clock: "experimental 120 Hz adapter" }, clockHashes,
    unperformed: ["exhaustive frame bounds", "performance certification", "full character action", "target engine import", "aesthetic assessment", ...(ending === "residue" ? ["residue stability"] : []), ...(ending === "handoff" ? ["downstream handoff"] : [])],
    aesthetics: "Not assessed. The creator must inspect motion, readability, material and context." };
  const directory = manifest ? join(RECORDS, manifest.run, "validations") : join(RECORDS, "validations");
  mkdirSync(directory, { recursive: true });
  result.detailRef = join(directory, `${validationRef}.json`);
  json(result.detailRef, result);
  return result;
}

export function exportRun({ run, validationRef }) {
  const m = readRun(run), dir = join(RECORDS, run, `export-${randomUUID().slice(0, 8)}`);
  let validation = null;
  if (validationRef) {
    if (!/^validation-[a-f0-9-]{36}$/.test(validationRef)) throw new LabError("INVALID_INPUT", "Invalid validationRef");
    const file = join(RECORDS, run, "validations", `${validationRef}.json`);
    if (!existsSync(file)) throw new LabError("CONTRACT_MISMATCH", "Validation does not belong to this run", { recovery: "Validate this exact run, then pass its returned validationRef." });
    validation = JSON.parse(readFileSync(file, "utf8"));
    if (validation.targetRun !== run || validation.sourceDigest !== m.sourceDigest) throw new LabError("CONTRACT_MISMATCH", "Validation identity differs from the exported run");
  }
  mkdirSync(dir);
  for (const name of ["combined", "color", "light"]) copyFileSync(join(RECORDS, run, `${name}.png`), join(dir, `${name}.png`));
  // Drop the duplicated terminal sample for loops; preserve explicit one-shot end.
  const frames = m.loop ? m.frames.filter((f) => f.t < m.duration - 1e-8) : m.frames;
  const data = {
    frames: frames.map((f, i) => ({ filename: `${m.id.replace("/", "-")} ${i}`, frame: f.rect, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: m.size[0], h: m.size[1] }, sourceSize: { w: m.size[0], h: m.size[1] }, duration: Math.round(1000 * (frames[i + 1] ? frames[i + 1].t - f.t : 1 / m.fps)) })),
    meta: { app: "athanor/vfx-lab", image: "combined.png", format: "RGBA8888", size: { w: m.atlas.size[0], h: m.atlas.size[1] }, scale: "1", athanor: { sourceRun: run, digest: m.digest, sourceDigest: m.sourceDigest, revision: m.revision ?? m.sourceDigest, pivot: m.origin, fps: m.fps, loop: m.loop, events: m.events, ending: m.ending ?? (m.loop ? "loop" : "clear"), validation: validation ? { ref: validationRef, passed: validation.passed, representation: validation.representation, coverage: validation.coverage } : { status: "unvalidated" }, layers: { color: "color.png", light: "light.png", lightBlend: "additive" } } },
  };
  json(join(dir, "atlas.json"), data);
  const result = { run, directory: dir, validation: data.meta.athanor.validation, files: ["atlas.json", "combined.png", "color.png", "light.png"].map((p) => join(dir, p)), warning: "combined.png approximates glow using ordinary alpha; use separate color and additive light for scene-independent compositing." };
  json(join(dir, "export.json"), result);
  return result;
}

function sourceStatus(manifest) {
  try {
    const saved = JSON.parse(readFileSync(join(RECORDS, manifest.run, "sources.json"), "utf8"));
    const changedFiles = [], missingFiles = [];
    for (const [file, source] of Object.entries(saved)) {
      const path = resolve(ROOT, file);
      if (!path.startsWith(ROOT + sep)) return { matches: null, reason: "Invalid saved path" };
      if (!existsSync(path)) missingFiles.push(file);
      else if (readFileSync(path, "utf8") !== source) changedFiles.push(file);
    }
    return { matches: !changedFiles.length && !missingFiles.length, changedFiles, missingFiles };
  } catch { return { matches: null, reason: "Saved sources unavailable" }; }
}

function runEvidence(m) {
  const directory = join(RECORDS, m.run), validations = join(directory, "validations");
  return {
    validations: existsSync(validations) ? readdirSync(validations).filter((p) => /^validation-[a-f0-9-]+\.json$/.test(p)).map((p) => {
      const result = JSON.parse(readFileSync(join(validations, p), "utf8"));
      return { ref: result.validationRef, passed: result.passed, representation: result.representation, path: join(validations, p) };
    }) : [],
    exports: readdirSync(directory).filter((p) => /^export-[a-f0-9]{8}$/.test(p)).map((p) => ({ directory: join(directory, p), atlas: join(directory, p, "atlas.json") })),
  };
}

export function queryHistory(args) {
  const focus = args.run ? readRun(args.run) : null, id = args.id ?? focus?.id;
  if (args.id && !ID.test(args.id)) throw new LabError("INVALID_INPUT", "Invalid effect ID; use category/name");
  const words = (args.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const matches = history(Infinity).filter((m) => (!id || m.id === id) && words.every((word) => `${m.id} ${m.name} ${m.run} ${m.note}`.toLowerCase().includes(word)));
  const cursor = args.cursor ?? 0, page = matches.slice(cursor, cursor + (args.limit ?? 12));
  return { total: matches.length, focusRun: focus?.run ?? null, cursor, nextCursor: cursor + page.length < matches.length ? cursor + page.length : null,
    runs: page.map((m) => ({ ...(args.detail === "full" ? m : { run: m.run, id: m.id, name: m.name, revision: m.revision ?? m.sourceDigest, sourceDigest: m.sourceDigest, createdAt: m.createdAt, note: m.note, parentRun: m.parentRun ?? null, options: m.options, fps: m.fps, background: m.background }), evidence: runEvidence(m), manifest: join(RECORDS, m.run, "manifest.json") })),
    decision: null, next: "No selection record exists; newest does not imply final. Inspect a run, compare, validate or export by explicit run ID." };
}

export async function execute(name, args = {}) {
  const tool = TOOLS.find((t) => t.name === `fx_${name.replace(/^fx_/, "")}`);
  if (!tool) throw new LabError("RESOURCE_NOT_FOUND", `Unknown tool '${name}'. Run tools to discover the contract.`);
  validateInput(tool, args);
  switch (tool.name) {
    case "fx_search": {
      const words = (args.query ?? "").toLowerCase().split(/\s+/).filter(Boolean), matches = [], diagnostics = [];
      const recipes = RECIPES.filter((r) => words.every((w) => `${r.id} ${r.name} ${r.words} ${r.mechanism}`.toLowerCase().includes(w)));
      const recommended = new Set(recipes.flatMap((r) => r.references));
      for (const id of ids()) {
        let fx;
        try { fx = await effect(id); }
        catch (error) {
          diagnostics.push({ code: "RESOURCE_SKIPPED", severity: "warning", id, message: error.message, recovery: "This module was skipped; other results remain usable. Inspect the candidate if it is meant to be an effect. Helpers may be named with a leading underscore to exclude them from discovery." });
          continue;
        }
        const m = fx.meta, hay = `${id} ${m.name} ${m.desc} ${m.tags.join(" ")}`.toLowerCase();
        if (recommended.has(id) || words.every((w) => hay.includes(w))) matches.push({ id, name: m.name, description: m.desc, duration: m.duration, size: m.size, loop: m.loop, recipes: RECIPES.filter((r) => r.references.includes(id)).map((r) => r.id) });
      }
      const resources = apiResources(args.query).slice(0, args.limit ?? 12);
      return { total: matches.length, effects: matches.slice(0, args.limit ?? 12), recipes, resources, diagnostics, partial: diagnostics.length > 0,
        ...(!matches.length && !recipes.length && !resources.length && words.length > 1 ? { suggestions: words.slice(0, 6).map((query) => ({ query, reason: "Search currently requires every word to match the same entry; try these terms separately." })) } : {}) };
    }
    case "fx_inspect": {
      const ref = args.ref ?? { kind: "effect", id: args.id };
      if (ref.kind === "operator") return inspectApi(ref, args.sections);
      if (ref.kind === "run") {
        const manifest = readRun(ref.id), revision = manifest.revision ?? manifest.sourceDigest;
        if (ref.revision && ref.revision !== revision) throw new LabError("REVISION_CONFLICT", "Saved run revision differs from requested revision");
        const sections = args.sections ?? ["overview", "contract", "evidence"];
        return { ...presentRun(manifest, args.detail), ref: { ...ref, revision }, currentSources: sourceStatus(manifest), evidence: runEvidence(manifest),
          ...(sections.includes("source") ? { sources: JSON.parse(readFileSync(join(RECORDS, manifest.run, "sources.json"), "utf8")) } : {}),
          ...(sections.includes("dependencies") ? { dependencies: manifest.sourceFiles, runtime: manifest.runtime } : {}),
          unavailableSections: sections.filter((s) => !["overview", "contract", "source", "dependencies", "evidence", "provenance"].includes(s)) };
      }
      const fx = await effect(ref.id);
      const briefFile = fx.file.replace(/\.js$/, ".brief.json");
      const revision = revisionOf(sources(fx.file), entryFor(fx.id), resolvedOptions(fx));
      if (ref.revision && ref.revision !== revision) throw new LabError("REVISION_CONFLICT", "Current effect source changed", { details: { expected: ref.revision, actual: revision } });
      const sections = args.sections ?? (args.id ? ["overview", "contract", "source"] : ["overview", "contract", "example"]);
      return { id: fx.id, ref: { kind: "effect", id: fx.id, revision }, file: fx.file, meta: fx.meta, events: fx.mod.events ?? {}, act: fx.mod.act ?? null,
        brief: existsSync(briefFile) ? JSON.parse(readFileSync(briefFile, "utf8")) : null,
        ...(sections.includes("source") || sections.includes("example") ? { source: readFileSync(fx.file, "utf8") } : {}),
        ...(sections.includes("dependencies") ? { dependencies: Object.keys(sources(fx.file)) } : {}),
        unavailableSections: sections.filter((s) => !["overview", "contract", "example", "source", "dependencies", "provenance"].includes(s)),
        authoringContract: authoringContract(), capabilities: capabilities(fx), optionConstraints: "Actual defaults above; effect-specific ranges/types are undeclared unless provided by authoring metadata.",
        ending: fx.mod.authoring?.ending ?? (fx.meta.loop ? "loop" : "clear"), recipes: RECIPES.filter((r) => r.references.includes(fx.id)), next: "Inspect authoring APIs for signatures. Edit ordinary JavaScript; render, observe, compare, validate the chosen run and export it. Full acts still use tools/act.mjs." };
    }
    case "fx_scaffold": {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.name)) throw new LabError("INVALID_INPUT", "Draft name must be kebab-case without a path", { path: "arguments.name" });
      if (!args.brief.trim() || (args.question !== undefined && !args.question.trim())) throw new LabError("INVALID_INPUT", "Brief and supplied visual question must not be empty");
      const folder = join(LAB, "drafts"), file = join(folder, `${args.name}.js`);
      mkdirSync(folder, { recursive: true });
      if (existsSync(file)) throw new LabError("REVISION_CONFLICT", "Draft already exists; edit it or choose another name");
      const template = args.template ?? "example";
      writeFileSync(file, readFileSync(join(LAB, template === "blank" ? "templates/blank.js" : "effects/cryo-bloom.js")), { flag: "wx" });
      json(join(folder, `${args.name}.brief.json`), { ...args, template, question: args.question ?? "", references: template === "example" ? ["lab/cryo-bloom"] : [], decisions: [], review: [] });
      return { id: `draft/${args.name}`, file, template, authoringContract: authoringContract(), next: "Edit this JavaScript to create your own silhouette, material and timing. This is a starting template, not an interpretation of the brief. Then render and inspect." };
    }
    case "fx_render": return render(args);
    case "fx_compare": return compare(args);
    case "fx_probe": return probe(args);
    case "fx_validate": return validate(args);
    case "fx_history": return queryHistory(args);
    case "fx_export": return exportRun(args);
  }
}
