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
    const tools = await fetch(`${url}/api/tools`).then((r) => r.json()); assert.equal(tools.length, 7);
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
  assert.equal(responses[0].result.protocolVersion, "2025-11-25"); assert.equal(responses[1].result.tools.length, 7);
  try { assert(responses[2].result.content.some((c) => c.type === "image" && c.mimeType === "image/png")); assert.equal(responses[3].result.isError, true); }
  finally { if (responses[2].result.structuredContent?.run) cleanRun(responses[2].result.structuredContent.run); }
});
