import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createFrame } from "../../src/core/index.js";
import { ROOT } from "../../tools/lib/fxlib.mjs";
import { clockedFx } from "./clock.js";
import { LAB, RECORDS, execute, eventFrames, blit, effect, validate } from "./lab.mjs";
import { TOOLS, validateInput } from "./definitions.mjs";
import { invoke } from "./invoke.mjs";
import { createLabServer } from "./server.mjs";

const meta = { name: "Fixture", desc: "A small deterministic test fixture.", tags: ["test"], size: [16, 16], origin: [8, 8], duration: 0.2, loop: false, fps: 30, bg: "dark", options: { seed: 4 } };
const fixture = `export const meta=${JSON.stringify(meta)}; export const events={release:0.1}; export function draw(p,t){if(t>=0.2)return; p.blend(0,0,0xff3278c8,0.25);p.light(1,0,0xff112233,0.2);}`;
const cleanRun = (run) => rmSync(join(RECORDS, run), { recursive: true, force: true });

test("fixed ticks are identical at 30/60/240 FPS and irregular update intervals", () => {
  const mod = { meta, create() { let ticks = 0; return { update() { ticks++; }, draw(p) { p.px(0, 0, 0xff000000 | ticks); } }; } };
  const shots = [];
  for (const fps of [30, 60, 240]) {
    const fx = clockedFx(mod); for (let i = 0; i < fps; i++) fx.update(1 / fps);
    const f = createFrame(16, 16); fx.draw(f); shots.push([...f.color]); assert.equal(fx.t, 1);
  }
  const fx = clockedFx(mod); for (const dt of [0.011, 0.249, 0.04, 0.317, 0.383]) fx.update(dt);
  const f = createFrame(16, 16); fx.draw(f);
  assert.deepEqual([...f.color], shots[0]); assert.deepEqual(shots[0], shots[1]); assert.deepEqual(shots[0], shots[2]);
  assert.throws(() => fx.update(-1)); assert.throws(() => fx.update(NaN));
});

test("pure effects land exactly on authored boundaries across FPS", () => {
  for (const fps of [30, 60, 240]) {
    const mod = { meta, draw(p, t) { if (t < 0.2) p.px(0, 0, 0xffffffff); } }, fx = clockedFx(mod);
    for (let i = 0; i < fps; i++) fx.update(1 / fps);
    const f = createFrame(16, 16); fx.draw(f); assert.equal(f.color.some(Boolean), false);
  }
});

test("event-aware sampling includes short release plus surrounding frames", () => {
  const indices = eventFrames(5.4, 30, { release: 0.06 });
  assert(indices.includes(1)); assert(indices.includes(2)); assert(indices.includes(3)); assert(indices.includes(162));
});

test("atlas copies preserve straight RGB at fractional alpha", () => {
  const target = new Uint8Array(16), source = new Uint8Array([200, 120, 50, 64]);
  blit(target, 2, source, 1, 1, 1, 1); assert.deepEqual([...target.subarray(12)], [...source]);
});

test("tool schema rejects missing arguments, unknown fields and invalid types", () => {
  const tool = TOOLS.find((t) => t.name === "fx_render");
  assert.throws(() => validateInput(tool, {}), /required/);
  assert.throws(() => validateInput(tool, { id: "lab/cryo-bloom", fps: 240 }), /one of/);
  assert.throws(() => validateInput(tool, { id: "lab/cryo-bloom", unknown: true }), /unknown/);
  assert.throws(() => validateInput(tool, { id: "lab/cryo-bloom", events: { release: "0.1" } }), /number/);
});

test("search routes Chinese material terms to references and mechanisms", async () => {
  const found = await execute("search", { query: "冰霜" });
  assert(found.effects.some((f) => f.id === "ice/frost-nova")); assert(found.recipes.some((r) => r.id === "propagation"));
  await assert.rejects(effect("../../package"), /Invalid/);
  await assert.rejects(execute("scaffold", { name: "../bad", brief: "brief", question: "question" }), /kebab/);
});

test("render snapshots survive source edits; comparison and export use saved frames", async () => {
  const name = `test-${randomUUID().slice(0, 8)}`, file = join(LAB, "drafts", `${name}.js`), helper = join(LAB, "drafts", `_${name}-helper.js`), runs = [];
  const source = `import {color} from './_${name}-helper.js';\n${fixture.replace("0xff3278c8", "color")}`;
  mkdirSync(join(LAB, "drafts"), { recursive: true }); writeFileSync(file, source); writeFileSync(helper, "export const color=0xff3278c8;");
  try {
    const a = await invoke("render", { id: `draft/${name}` }); runs.push(a.run);
    assert(a.selected.includes(3)); assert.equal(a.aestheticApproval, null);
    assert.equal(JSON.parse(readFileSync(join(RECORDS, a.run, "sources.json"), "utf8"))[relative(ROOT, file)], source);
    const before = readFileSync(join(RECORDS, a.run, "combined.png"));
    writeFileSync(helper, "export const color=0xff00ff00;");
    const b = await invoke("render", { id: `draft/${name}` }); runs.push(b.run); assert.notEqual(a.digest, b.digest);
    const comparison = await execute("compare", { runs, event: "release" }); runs.push(comparison.run);
    assert(existsSync(comparison.image)); assert.equal(comparison.pixelScale, 1);
    const exported = await execute("export", { run: a.run });
    assert.deepEqual(readFileSync(join(exported.directory, "combined.png")), before);
    assert.equal(JSON.parse(readFileSync(join(exported.directory, "atlas.json"))).meta.athanor.digest, a.digest);
    await assert.rejects(execute("compare", { runs: [a.run, b.run], event: "missing" }), /must define/);
  } finally { rmSync(file, { force: true }); rmSync(helper, { force: true }); runs.forEach(cleanRun); }
});

test("scaffold records intent and never overwrites the creator's code", async () => {
  const name = `test-${randomUUID().slice(0, 8)}`, file = join(LAB, "drafts", `${name}.js`), brief = file.replace(/\.js$/, ".brief.json");
  try {
    const result = await execute("scaffold", { name, brief: "A low ring of ice", question: "Does the wave read clearly?" });
    assert.equal(result.id, `draft/${name}`); assert.equal(JSON.parse(readFileSync(brief)).question, "Does the wave read clearly?");
    writeFileSync(file, fixture);
    await assert.rejects(execute("scaffold", { name, brief: "other", question: "other" }), /already exists/);
    assert.equal(readFileSync(file, "utf8"), fixture);
  } finally { rmSync(file, { force: true }); rmSync(brief, { force: true }); }
});

test("validator catches light-only endings and draw-time mutations", async () => {
  const name = `test-${randomUUID().slice(0, 8)}`, file = join(LAB, "drafts", `${name}.js`);
  mkdirSync(join(LAB, "drafts"), { recursive: true });
  try {
    writeFileSync(file, `export const meta=${JSON.stringify(meta)};export function draw(p,t){p.light(0,0,0xff123456,1)}`);
    const badEnd = await invoke("validate", { id: `draft/${name}` });
    assert.equal(badEnd.passed, false); assert(badEnd.errors.some((e) => e.code === "END_NOT_EMPTY"));
    writeFileSync(file, `export const meta=${JSON.stringify(meta)};let i=0;export function draw(p,t){p.px(0,0,0xff000000|i++)}`);
    const badDraw = await invoke("validate", { id: `draft/${name}` });
    assert(badDraw.errors.some((e) => e.code === "DRAW_MUTATES_STATE"));
  } finally { rmSync(file, { force: true }); }
});

test("demo passes the explicit technical checks", async () => {
  const report = await validate({ id: "lab/cryo-bloom" });
  assert.equal(report.passed, true, JSON.stringify(report.errors)); assert.equal(report.coverage.exhaustive, false);
});

test("HTTP adapter serves the viewer, calls tools and rejects hostile origins", async () => {
  const server = createLabServer(); await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(url)).status, 200);
    const tools = await fetch(`${url}/api/tools`).then((r) => r.json()); assert.equal(tools.length, 9); assert(tools.some((t) => t.name === "fx_history")); assert(tools.some((t) => t.name === "fx_probe"));
    const response = await fetch(`${url}/api/call`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "fx_inspect", arguments: { id: "lab/cryo-bloom" } }) }).then((r) => r.json());
    assert.equal(response.result.events.release, 0.36);
    assert.equal((await fetch(`${url}/api/call`, { method: "POST", headers: { origin: "https://example.com", "content-type": "application/json" }, body: "{}" })).status, 403);
    assert.equal((await fetch(`${url}/api/call`, { method: "POST", headers: { "content-type": "application/json" }, body: "{" })).status, 400);
    assert.notEqual((await fetch(`${url}/artifacts/%2e%2e%2f%2e%2e%2fpackage.json`)).status, 200);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test("stdio MCP negotiates, lists tools, returns errors and embeds rendered images", async () => {
  const messages = [
    { id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } } },
    { method: "notifications/initialized" }, { id: 2, method: "tools/list" },
    { id: 3, method: "tools/call", params: { name: "fx_render", arguments: { id: "lab/cryo-bloom", fps: 12 } } },
    { id: 4, method: "tools/call", params: { name: "fx_render", arguments: {} } },
  ];
  const output = await new Promise((resolve, reject) => {
    const child = execFile(process.execPath, [join(LAB, "mcp.mjs")], { timeout: 30_000, maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => error ? reject(error) : resolve(stdout));
    child.stdin.end(messages.map((m) => JSON.stringify({ jsonrpc: "2.0", ...m })).join("\n") + "\n");
  });
  const responses = output.trim().split("\n").map((s) => JSON.parse(s));
  assert.equal(responses[0].result.protocolVersion, "2025-11-25"); assert.equal(responses[1].result.tools.length, 9);
  try { assert(responses[2].result.content.some((c) => c.type === "image" && c.mimeType === "image/png")); assert.equal(responses[3].result.isError, true); }
  finally { if (responses[2].result.structuredContent?.run) cleanRun(responses[2].result.structuredContent.run); }
});

test("public API discovery provides exact Color32/painter/clock contracts and a runnable example", async () => {
  const reference = await execute("inspect", { id: "ice/frost-nova" });
  assert.equal(reference.capabilities.namedLayers, false);
  assert(reference.authoringContract.resources.some((r) => r.id === "core/color"));
  const found = await execute("search", { query: "颜色" });
  assert(found.resources.some((r) => r.ref.id === "core/color"));
  const color = await execute("inspect", { ref: { kind: "operator", id: "core/color" } });
  assert.match(color.sections.contract, /fit\(colors,n\)/); assert.match(color.sections.overview, /Color32/);
  assert.equal(color.sections.source, undefined);
  await assert.rejects(execute("inspect", { ref: { ...color.ref, revision: "stale" } }), { code: "REVISION_CONFLICT" });
  const doc = await execute("inspect", { ref: { kind: "operator", id: "core/effect" }, sections: ["example"] });
  const name = `test-${randomUUID().slice(0, 8)}`, file = join(LAB, "drafts", `${name}.js`);
  try {
    writeFileSync(file, doc.sections.example.match(/```js\n([\s\S]*?)\n```/)[1]);
    const report = await invoke("validate", { target: { id: `draft/${name}` } });
    assert.equal(report.passed, true, JSON.stringify(report.errors));
    rmSync(report.detailRef, { force: true });
  } finally { rmSync(file, { force: true }); }
});

test("target selectors reject conflicts, nested invalid inputs and ambiguous comparison clocks", async () => {
  for (const args of [{}, { id: "lab/cryo-bloom", run: "x" }, { run: "x", options: {} }, { target: { id: "lab/cryo-bloom", run: "x" } }, { target: { id: "lab/cryo-bloom", options: [] } }, { target: { run: "x" }, options: {} }]) {
    await assert.rejects(execute("validate", args), { code: "INVALID_INPUT" });
  }
  for (const args of [{ runs: ["a", "b"] }, { runs: ["a", "b"], event: "release", times: [0] }, { runs: ["a", "b"], alignment: "time", times: [0], offsets: [0] }, { runs: ["a", "b"], event: "release", offsets: [] }]) {
    await assert.rejects(execute("compare", args), { code: "INVALID_INPUT" });
  }
  await assert.rejects(execute("history", {}), { code: "INVALID_INPUT" });
});

test("frozen validation and re-render survive deletion of effect and transitive dependency", async () => {
  const name = `test-${randomUUID().slice(0, 8)}`, id = `draft/${name}`, file = join(LAB, "drafts", `${name}.js`), helper = join(LAB, "drafts", `_${name}.js`), runs = [];
  const source = `import {color} from './_${name}.js';\nexport const meta=${JSON.stringify(meta)};export const events={release:0.1};export function create(){let ticks=0;return {update(){ticks++},draw(p,t){if(t<0.2)p.px(0,0,color+ticks)}}}`;
  mkdirSync(join(LAB, "drafts"), { recursive: true }); writeFileSync(file, source); writeFileSync(helper, "export const color=0xff3278c8;");
  try {
    const a = await invoke("render", { target: { id }, events: { accent: 0.14 }, note: "version one" }); runs.push(a.run);
    assert.equal(a.replay.available, true); assert.equal(a.frames, undefined); assert.equal(a.runtime, undefined); assert.equal(a.sourceFiles, undefined); assert(a.manifest); assert(a.frameCount > 1);
    const full = JSON.parse(readFileSync(a.manifest)); assert.equal(full.frames.length, a.frameCount);
    writeFileSync(helper, "throw new Error('Current dependency must never execute');");
    const current = await execute("inspect", { ref: { kind: "run", id: a.run } }); assert.equal(current.currentSources.matches, false);
    rmSync(file); rmSync(helper);
    const report = await invoke("validate", { run: a.run });
    assert.equal(report.passed, true, JSON.stringify(report.errors)); assert.equal(report.targetRun, a.run); assert.equal(report.sourceDigest, a.sourceDigest);
    assert.equal(report.representation, "frozen-source-replay"); assert.equal(report.savedFramesVerified, false); assert(report.coverage.times.includes(0.14));
    assert.equal(report.target.revision, a.revision);
    const b = await invoke("render", { target: { run: a.run }, note: "replay after deletion", detail: "full" }); runs.push(b.run);
    assert.equal(b.parentRun, a.run); assert.equal(b.revision, a.revision); assert.equal(b.sourceDigest, a.sourceDigest);
    assert.deepEqual(readFileSync(join(b.directory, "color.png")), readFileSync(join(a.directory, "color.png")));
    const page = await execute("history", { id, limit: 1 }); assert.equal(page.total, 2); assert.equal(page.nextCursor, 1);
    const next = await execute("history", { id, limit: 1, cursor: page.nextCursor }); assert.equal(next.runs.length, 1); assert.notEqual(page.runs[0].run, next.runs[0].run);
    const compared = await execute("compare", { runs: [a.run, b.run], event: "release", offsets: [-0.2, 0, 0.03, 0.3, 0.4] }); runs.push(compared.run);
    assert.equal(compared.samples.length, 10); assert.equal(compared.samples[0].clamped, true); assert.equal(compared.samples[4].duplicateOf, 3); assert.equal(compared.samples[2].requested, 0.13); assert(Number.isFinite(compared.samples[2].simulationTime));
    const absolute = await execute("compare", { runs: [a.run, b.run], alignment: "time", times: [0.05, 0.14] }); runs.push(absolute.run); assert.equal(absolute.alignment, "time"); assert.equal(absolute.samples[0].requested, 0.05);
    const output = await execute("export", { run: a.run, validationRef: report.validationRef });
    assert.equal(output.validation.passed, true);
    await assert.rejects(execute("export", { run: b.run, validationRef: report.validationRef }), { code: "CONTRACT_MISMATCH" });
    const hist = await execute("history", { run: a.run, query: "version one" });
    assert.equal(hist.runs.length, 1); assert.equal(hist.runs[0].evidence.validations[0].ref, report.validationRef); assert.equal(hist.runs[0].evidence.exports.length, 1);
    assert.equal(hist.decision, null);
    // Version-1 manifests have no replay status/revision/entry; their saved
    // evaluator is still usable if the source closure and runtime are present.
    const legacy = { ...full, version: 1 }; delete legacy.replay; delete legacy.revision; delete legacy.entry;
    writeFileSync(a.manifest, JSON.stringify(legacy));
    const old = await invoke("validate", { run: a.run }); assert.equal(old.passed, true); assert.equal(old.sourceDigest, a.sourceDigest);
    writeFileSync(a.manifest, JSON.stringify({ ...legacy, runtime: { ...legacy.runtime, node: "v0.0.0" } }));
    await assert.rejects(invoke("validate", { run: a.run }), { code: "REPLAY_UNAVAILABLE" });
    writeFileSync(a.manifest, JSON.stringify(full));
    const saved = join(a.directory, "sources.json"); writeFileSync(saved, "{}");
    await assert.rejects(invoke("validate", { run: a.run }), { code: "REPLAY_UNAVAILABLE" });
    // Saved image export remains possible even when source replay is unavailable.
    assert.equal((await execute("export", { run: a.run })).validation.status, "unvalidated");
  } finally { rmSync(file, { force: true }); rmSync(helper, { force: true }); runs.forEach(cleanRun); }
});

test("unsupported asset dependencies are explicit and do not fall back to current files", async () => {
  const name = `test-${randomUUID().slice(0, 8)}`, file = join(LAB, "drafts", `${name}.js`); let run;
  writeFileSync(file, `import {readFileSync} from 'node:fs';\n${fixture}`);
  try {
    const result = await invoke("render", { id: `draft/${name}` }); run = result.run;
    assert.equal(result.replay.available, false); assert(result.replay.blockers.some((b) => b.specifier === "node:fs"));
    await assert.rejects(invoke("validate", { run }), { code: "REPLAY_UNAVAILABLE" });
    await assert.rejects(invoke("render", { run }), { code: "REPLAY_UNAVAILABLE" });
    assert.equal((await execute("export", { run })).run, run);
  } finally { rmSync(file, { force: true }); if (run) cleanRun(run); }
});

test("blank scaffold is genuinely empty and declared residue does not require an empty ending", async () => {
  const name = `test-${randomUUID().slice(0, 8)}`, file = join(LAB, "drafts", `${name}.js`), brief = file.replace(/\.js$/, ".brief.json"); let run;
  try {
    const draft = await execute("scaffold", { name, brief: "A custom shape", template: "blank" });
    assert.equal(draft.template, "blank"); assert.deepEqual(JSON.parse(readFileSync(brief)).references, []);
    const blank = await invoke("render", { id: draft.id }); run = blank.run; assert(blank.diagnostics.some((d) => d.code === "DRAWS_NOTHING"));
    writeFileSync(file, `export const meta=${JSON.stringify(meta)};export const authoring={ending:'residue'};export function draw(p){p.px(0,0,0xff123456)}`);
    const report = await invoke("validate", { id: draft.id }); assert.equal(report.passed, true); assert(report.unperformed.includes("residue stability")); assert(report.diagnostics.some((d) => d.code === "DECLARED_ENDING"));
    rmSync(report.detailRef, { force: true });
  } finally { rmSync(file, { force: true }); rmSync(brief, { force: true }); if (run) cleanRun(run); }
});

test("simulation draw clocks reach exact tick boundaries and retain prototype methods", () => {
  class Simulation {
    ticks = 0;
    update() { this.ticks++; }
    draw(p, t) { if (t < meta.duration) p.px(0, 0, 0xff000000 | this.ticks); }
    drawBack(p, t) { if (t < meta.duration) p.px(1, 0, 0xffffffff); }
  }
  for (const fps of [30, 60, 240]) {
    const fx = clockedFx({ meta, create: () => new Simulation() });
    for (let i = 0; i < fps * 0.1; i++) fx.update(1 / fps);
    const before = createFrame(16, 16); fx.draw(before); assert.equal(before.color[0] & 255, 12); assert.equal(before.color[1], 0xffffffff);
    for (let i = 0; i < fps * 0.1; i++) fx.update(1 / fps);
    const end = createFrame(16, 16); fx.draw(end); assert.equal(end.color.some(Boolean), false); assert.equal(fx.t, 0.2);
  }
});

test("history pagination reaches runs beyond the viewer's recent-sixty window", async () => {
  const id = `draft/test-${randomUUID().slice(0, 8)}`, runs = [];
  try {
    for (let i = 0; i < 65; i++) {
      const run = `${i.toString(16).padStart(12, "0")}-${randomUUID().slice(0, 8)}`; runs.push(run);
      mkdirSync(join(RECORDS, run), { recursive: true });
      writeFileSync(join(RECORDS, run, "manifest.json"), JSON.stringify({ run, id, name: "Pagination fixture", createdAt: new Date(2026, 0, 1, 0, 0, i).toISOString(), note: "history", options: {}, sourceDigest: "fixture" }));
    }
    const page = await execute("history", { id, limit: 60 }); assert.equal(page.total, 65); assert.equal(page.runs.length, 60); assert.equal(page.nextCursor, 60);
    const last = await execute("history", { id, cursor: 60 }); assert.equal(last.runs.length, 5); assert.equal(last.nextCursor, null);
    assert.equal(new Set([...page.runs, ...last.runs].map((r) => r.run)).size, 65);
  } finally { runs.forEach(cleanRun); }
});
