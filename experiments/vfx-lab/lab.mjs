import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync, realpathSync } from "node:fs";
import { join, dirname, relative, resolve, sep } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { allIds, loadEffect, ROOT, canvas } from "../../tools/lib/fxlib.mjs";
import { encodePNG } from "../../tools/lib/png.mjs";
import { createFrame, clearFrame, composite, backdrop, drawActor, painterFor, actorAlphaOf } from "../../src/core/index.js";
import { clockedFx, TICK_RATE } from "./clock.js";
import { RECIPES } from "./recipes.mjs";
import { TOOLS, validateInput } from "./definitions.mjs";

export const LAB = dirname(fileURLToPath(import.meta.url));
export const RECORDS = join(ROOT, "records", "vfx-lab");
const ID = /^[a-z0-9-]+\/[a-z0-9-]+$/;
const RUN = /^[a-f0-9]{12}-[a-f0-9]{8}$/;
const hash = (data) => createHash("sha256").update(data).digest("hex");
const json = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + "\n");

export async function effect(id) {
  if (!ID.test(id)) throw new Error("Invalid effect ID; use category/name");
  const [category, name] = id.split("/");
  const fx = category === "lab" || category === "draft"
    ? await loadEffect(`${category === "lab" ? "effects" : "drafts"}/${name}`, LAB)
    : await loadEffect(id);
  const m = fx.meta;
  if (!Array.isArray(m.size) || m.size.length !== 2 || m.size.some((v) => !Number.isInteger(v) || v < 8 || v > 480)) throw new Error("Effect size must be two integers in 8..480 pixels");
  if (!Array.isArray(m.origin) || m.origin.length !== 2 || m.origin.some((v) => !Number.isFinite(v))) throw new Error("Effect origin must be two finite coordinates");
  if (!(m.duration > 0 && m.duration <= 12)) throw new Error("Effect duration must be in (0, 12] seconds");
  return { ...fx, id };
}

function ids() {
  const local = (folder, category) => existsSync(join(LAB, folder)) ? readdirSync(join(LAB, folder)).filter((p) => /^[a-z0-9-]+\.js$/.test(p)).map((p) => `${category}/${p.slice(0, -3)}`) : [];
  return [...allIds(), ...local("effects", "lab"), ...local("drafts", "draft")];
}

// Capture the local import closure, including the renderer, to make a run reviewable
// even after source edits. Fresh tool processes avoid Node's transitive import cache.
export function sources(entry, result = {}) {
  const file = realpathSync(entry);
  if (!file.startsWith(ROOT + sep)) throw new Error("Source import leaves the checkout");
  const key = relative(ROOT, file);
  if (key in result) return result;
  const source = readFileSync(file, "utf8");
  result[key] = source;
  for (const match of source.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/g)) sources(resolve(dirname(file), match[1]), result);
  return result;
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
  for (const [name, time] of Object.entries(events)) if (!Number.isFinite(time) || time < 0 || time > fx.meta.duration) throw new Error(`Event ${name} must lie inside 0..${fx.meta.duration} seconds`);
  return events;
}

export function sample(fx, times, options = {}, { margin = 0, background = "ground", actor = false } = {}) {
  const m = fx.meta, w = m.size[0] + margin * 2, h = m.size[1] + margin * 2;
  const frame = createFrame(w, h, -margin, -margin);
  const inst = clockedFx(fx.mod, { ...options, x: m.origin[0], y: m.origin[1] });
  const bg = background === "none" ? null : backdrop(background, w, h, m.origin[1] + margin);
  let previous = 0;
  return times.map((t) => {
    if (t < previous || !Number.isFinite(t)) throw new Error("Sample times must be finite and in order");
    inst.update(t - previous); previous = t;
    clearFrame(frame); inst.draw(frame);
    const color = frame.color.slice(), light = frame.light.slice();
    const combined = composite(frame, new Uint8ClampedArray(w * h * 4));
    if (actor && m.actor) {
      clearFrame(frame); inst.draw(frame, "back");
      drawActor(painterFor(frame).place(m.origin[0], m.origin[1], !!options.flip), inst.options.actor, actorAlphaOf(fx.mod, t, inst.options));
      inst.draw(frame, "front");
    }
    return { t, simulationTime: inst.t, color, light, combined, preview: composite(frame, new Uint8ClampedArray(w * h * 4), bg) };
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
  const fx = await effect(args.id), m = fx.meta, fps = args.fps ?? 30, options = args.options ?? {};
  if (options.actor || options.x !== undefined || options.y !== undefined) throw new Error("Actor masks and placement are supplied by the lab, not options");
  const n = Math.ceil(m.duration * fps) + 1, [w, h] = m.size;
  if (n * w * h > 24_000_000) throw new Error("Render exceeds the MVP's 24 million frame-pixel budget; lower fps or canvas size");
  const events = mergedEvents(fx, args.events), background = args.background ?? "ground";
  const snapshot = sources(fx.file);
  sources(join(LAB, "lab.mjs"), snapshot);
  const runtime = { node: process.version, platform: process.platform, arch: process.arch };
  const identity = { id: args.id, options, fps, events, background, engine: "lab-fixed-120-v1", runtime, sources: snapshot };
  const digest = hash(JSON.stringify(identity)), run = `${digest.slice(0, 12)}-${randomUUID().slice(0, 8)}`, dir = join(RECORDS, run);
  const times = Array.from({ length: n }, (_, i) => Math.min(i / fps, m.duration));
  const frames = sample(fx, times, options, { background, actor: true });
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
    version: 1, run, digest, id: fx.id, name: m.name, createdAt: new Date().toISOString(), note: args.note ?? "",
    options: { ...m.options, ...options }, background, fps, size: m.size, origin: m.origin, duration: m.duration, loop: m.loop,
    implementation: fx.mod.create ? "simulated" : "pure", runtime, clock: { tickRate: TICK_RATE, sampling: "simulation holds the last complete tick; pure effects use exact requested time" },
    events, selected, atlas: { size: atlasSize, columns },
    frames: frames.map((f, i) => ({ index: i, t: f.t, simulationTime: f.simulationTime, rect: { x: i % columns * w, y: Math.floor(i / columns) * h, w, h } })),
    files: { preview: "preview.png", color: "color.png", light: "light.png", combined: "combined.png", contact: "contact.png" },
    sourceFiles: Object.keys(snapshot), sourceDigest: hash(JSON.stringify(snapshot)), aestheticApproval: null, actorPreview: "standing scale reference; acts are not played in this MVP",
  };
  json(join(dir, "sources.json"), snapshot); json(join(dir, "manifest.json"), manifest);
  return { ...manifest, directory: dir, image: join(dir, "contact.png"), next: "Inspect contact.png plus playback. State the most important visual problem before editing; validate technical constraints separately." };
}

export function readRun(run) {
  if (!RUN.test(run)) throw new Error("Invalid run ID");
  return JSON.parse(readFileSync(join(RECORDS, run, "manifest.json"), "utf8"));
}

export function history() {
  if (!existsSync(RECORDS)) return [];
  return readdirSync(RECORDS).filter((p) => RUN.test(p)).flatMap((p) => {
    // A render may still be writing, or a test may remove its own fixture.
    try { return [readRun(p)]; } catch { return []; }
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 60);
}

export function compare({ runs, event }) {
  const list = runs.map(readRun), offsets = [-0.1, 0, 1 / 30, 0.1, 0.3, 0.7];
  if (list.some((m) => m.events[event] === undefined)) throw new Error(`Every run must define event '${event}'; render again with explicit events`);
  const left = Math.max(...list.map((m) => m.origin[0])), top = Math.max(...list.map((m) => m.origin[1]));
  const w = left + Math.max(...list.map((m) => m.size[0] - m.origin[0])), h = top + Math.max(...list.map((m) => m.size[1] - m.origin[1]));
  if (w > 960 || h > 960) throw new Error("Combined origins exceed the comparison canvas budget");
  const img = canvas(offsets.length * (w + 8) + 8, list.length * (h + 40) + 8), samples = [];
  for (const [row, m] of list.entries()) {
    const raw = readFileSync(join(RECORDS, m.run, "preview.rgba")), aw = m.atlas.size[0];
    img.text(`${m.id} / ${m.options.direction ?? "original"} / ${m.run.slice(0, 12)}`, 8, row * (h + 40) + 6, 2);
    for (const [col, offset] of offsets.entries()) {
      const desired = m.events[event] + offset, t = Math.max(0, Math.min(m.duration, desired));
      const f = m.frames.reduce((a, b) => Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a), pixels = new Uint8Array(m.size[0] * m.size[1] * 4);
      for (let y = 0; y < m.size[1]; y++) pixels.set(raw.subarray(((f.rect.y + y) * aw + f.rect.x) * 4, ((f.rect.y + y) * aw + f.rect.x + m.size[0]) * 4), y * m.size[0] * 4);
      const x = 8 + col * (w + 8), y = row * (h + 40) + 24;
      img.text(`${offset >= 0 ? "+" : ""}${offset.toFixed(3)} / ${f.t.toFixed(3)}s`, x, y, 2);
      img.paste(pixels, m.size[0], m.size[1], x + left - m.origin[0], y + 16 + top - m.origin[1]);
      samples.push({ run: m.run, offset, requested: desired, actual: f.t, clamped: desired !== t });
    }
  }
  const run = `${hash(JSON.stringify({ runs, event })).slice(0, 12)}-${randomUUID().slice(0, 8)}`, dir = join(RECORDS, run);
  mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, "compare.png"), img.png());
  const result = { run, runs, event, samples, image: join(dir, "compare.png"), pixelScale: 1, aestheticScore: null, next: "Judge silhouette, timing and material against the brief. Different render FPS uses nearest saved frame; actual times are listed." };
  json(join(dir, "comparison.json"), result); return result;
}

const frameHash = (frame) => hash(Buffer.concat([Buffer.from(frame.color.buffer), Buffer.from(frame.light.buffer)]));
export async function validate({ id, options = {} }) {
  const fx = await effect(id), m = fx.meta, errors = [], diagnostics = [], D = m.duration;
  const times = [...new Set([0, ...Array.from({ length: 11 }, (_, i) => D * (i + 1) / 12), ...Object.values(mergedEvents(fx)), D])].sort((a, b) => a - b);
  const findings = (list, code, message, evidence = {}) => list.push({ code, message, ...evidence });
  const seeds = [...new Set([options.seed ?? m.options.seed ?? 1, 7])];
  const src = readFileSync(fx.file, "utf8");
  if (/\bMath\.random\s*\(|\bDate\s*[.(]/.test(src)) findings(errors, "UNSEEDED_TIME", "Effect source uses Math.random or Date; use a seeded generator and effect time.");
  for (const seed of seeds) {
    const opts = { ...options, seed }, frames = sample(fx, times, opts, { margin: 24 }), replay = sample(fx, times, opts, { margin: 24 });
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
    if (!frames.some((f) => f.color.some((c) => c >>> 24) || f.light.some((c) => c & 0xffffff))) findings(errors, "DRAWS_NOTHING", "No color or light appears at any sampled time.", { seed });
    const end = frames.at(-1), colorPixels = end.color.reduce((n, c) => n + (c >>> 24 ? 1 : 0), 0), lightPixels = end.light.reduce((n, c) => n + (c & 0xffffff ? 1 : 0), 0);
    if (!m.loop && (colorPixels || lightPixels)) findings(errors, "END_NOT_EMPTY", "One-shot still draws color or light at duration.", { seed, time: D, colorPixels, lightPixels });
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
    clockHashes.push({ fps, time: probeTime, digest });
  }
  if (new Set(clockHashes.map((s) => s.digest)).size > 1) findings(errors, "CLOCK_DRIFT", "Playback at the probe time differs across tested update rates; inspect time-based drawing or stateful draw().", { time: probeTime });
  const snapshot = sources(fx.file); sources(join(LAB, "lab.mjs"), snapshot);
  const result = { id, sourceDigest: hash(JSON.stringify(snapshot)), passed: errors.length === 0, errors, diagnostics, coverage: { times, seeds, channels: ["color", "light"], updateRates: [30, 60, 240], boundsMargin: 24, exhaustive: false, clock: "experimental 120 Hz adapter" }, clockHashes, aesthetics: "Not assessed. The creator must inspect motion, readability, material and context." };
  return result;
}

export function exportRun({ run }) {
  const m = readRun(run), dir = join(RECORDS, run, `export-${randomUUID().slice(0, 8)}`);
  mkdirSync(dir);
  for (const name of ["combined", "color", "light"]) copyFileSync(join(RECORDS, run, `${name}.png`), join(dir, `${name}.png`));
  // Drop the duplicated terminal sample for loops; preserve explicit one-shot end.
  const frames = m.loop ? m.frames.filter((f) => f.t < m.duration - 1e-8) : m.frames;
  const data = {
    frames: frames.map((f, i) => ({ filename: `${m.id.replace("/", "-")} ${i}`, frame: f.rect, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: m.size[0], h: m.size[1] }, sourceSize: { w: m.size[0], h: m.size[1] }, duration: Math.round(1000 * (frames[i + 1] ? frames[i + 1].t - f.t : 1 / m.fps)) })),
    meta: { app: "athanor/vfx-lab", image: "combined.png", format: "RGBA8888", size: { w: m.atlas.size[0], h: m.atlas.size[1] }, scale: "1", athanor: { sourceRun: run, digest: m.digest, pivot: m.origin, fps: m.fps, loop: m.loop, events: m.events, layers: { color: "color.png", light: "light.png", lightBlend: "additive" } } },
  };
  json(join(dir, "atlas.json"), data);
  return { run, directory: dir, files: ["atlas.json", "combined.png", "color.png", "light.png"].map((p) => join(dir, p)), warning: "combined.png approximates glow using ordinary alpha; use separate color and additive light for scene-independent compositing." };
}

export async function execute(name, args = {}) {
  const tool = TOOLS.find((t) => t.name === `fx_${name.replace(/^fx_/, "")}`);
  if (!tool) throw new Error(`Unknown tool '${name}'. Run tools to discover the contract.`);
  validateInput(tool, args);
  switch (tool.name) {
    case "fx_search": {
      const words = (args.query ?? "").toLowerCase().split(/\s+/).filter(Boolean), matches = [];
      const recipes = RECIPES.filter((r) => words.every((w) => `${r.id} ${r.name} ${r.words} ${r.mechanism}`.toLowerCase().includes(w)));
      const recommended = new Set(recipes.flatMap((r) => r.references));
      for (const id of ids()) {
        const fx = await effect(id), m = fx.meta, hay = `${id} ${m.name} ${m.desc} ${m.tags.join(" ")}`.toLowerCase();
        if (recommended.has(id) || words.every((w) => hay.includes(w))) matches.push({ id, name: m.name, description: m.desc, duration: m.duration, size: m.size, loop: m.loop, recipes: RECIPES.filter((r) => r.references.includes(id)).map((r) => r.id) });
      }
      return { total: matches.length, effects: matches.slice(0, args.limit ?? 12), recipes };
    }
    case "fx_inspect": {
      const fx = await effect(args.id);
      const briefFile = fx.file.replace(/\.js$/, ".brief.json");
      return { id: fx.id, file: fx.file, meta: fx.meta, events: fx.mod.events ?? {}, act: fx.mod.act ?? null, brief: existsSync(briefFile) ? JSON.parse(readFileSync(briefFile, "utf8")) : null, source: readFileSync(fx.file, "utf8"), recipes: RECIPES.filter((r) => r.references.includes(fx.id)), next: "Write your brief and visual question before scaffolding. Keep art choices in editable code; use shared named events. For full character action, use the original tools/act.mjs; the lab previews a standing scale reference." };
    }
    case "fx_scaffold": {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.name)) throw new Error("Draft name must be kebab-case without a path");
      if (!args.brief.trim() || !args.question.trim()) throw new Error("Brief and visual question must not be empty");
      const folder = join(LAB, "drafts"), file = join(folder, `${args.name}.js`);
      mkdirSync(folder, { recursive: true });
      if (existsSync(file)) throw new Error("Draft already exists; edit it or choose another name");
      writeFileSync(file, readFileSync(join(LAB, "effects", "cryo-bloom.js")), { flag: "wx" });
      json(join(folder, `${args.name}.brief.json`), { ...args, references: ["lab/cryo-bloom"], decisions: [], review: [] });
      return { id: `draft/${args.name}`, file, next: "Edit this JavaScript to create your own silhouette, material and timing. This is a starting example, not an AI-generated interpretation of the brief. Then render and inspect." };
    }
    case "fx_render": return render(args);
    case "fx_compare": return compare(args);
    case "fx_validate": return validate(args);
    case "fx_export": return exportRun(args);
  }
}
