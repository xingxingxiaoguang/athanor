// Reconstruct saved relative modules in a temporary ESM checkout. No fallback to
// current effect files: missing/unsupported dependencies are explicit failures.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname, posix } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { LabError } from "./errors.mjs";
import { moduleImports } from "./source-parser.mjs";

export const digestOf = (value) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
export const entryFor = (id) => {
  const [category, name] = id.split("/");
  return category === "lab" || category === "draft" ? `experiments/vfx-lab/${category === "lab" ? "effects" : "drafts"}/${name}.js` : `src/fx/${id}.js`;
};

export function revisionOf(snapshot, entry, options) {
  const files = new Set(), imports = moduleImports(snapshot);
  function visit(file) {
    if (files.has(file) || typeof snapshot[file] !== "string") return;
    files.add(file);
    for (const specifier of imports[file]) if (specifier.startsWith(".")) visit(posix.normalize(posix.join(posix.dirname(file), specifier)));
  }
  visit(entry);
  return digestOf({ sources: Object.fromEntries([...files].sort().map((file) => [file, snapshot[file]])), options });
}

export function replaySupport(snapshot, entry) {
  const blockers = [], visited = new Set(), imports = moduleImports(snapshot);
  function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    const source = snapshot[file];
    if (typeof source !== "string") { blockers.push({ file, reason: "Missing saved dependency" }); return; }
    if (/\bimport\s*\(|\brequire\s*\(|\bnew\s+URL\s*\(|\bimport\.meta\b|\bprocess\s*[.[]|\bfetch\s*\(|\bglobalThis\b|\beval\s*\(|\bnew\s+Function\s*\(/.test(source)) blockers.push({ file, reason: "Dynamic imports, runtime resources or environment-dependent effect code are not frozen by this backend" });
    for (const specifier of imports[file]) {
      if (!specifier.startsWith(".")) { blockers.push({ file, specifier, reason: "Only relative local JavaScript imports are replayable" }); continue; }
      const dependency = posix.normalize(posix.join(posix.dirname(file), specifier));
      if (dependency.startsWith("../") || !/\.(?:m?js)$/.test(dependency)) { blockers.push({ file, specifier, reason: "Dependency is outside the saved JavaScript source contract" }); continue; }
      visit(dependency);
    }
  }
  visit(entry);
  return { available: blockers.length === 0, scope: "Relative local JavaScript sources and saved renderer; external assets, packages and dynamic imports are unsupported", blockers };
}

export async function withFrozenRun(manifest, directory, callback) {
  const unavailable = (message, details) => new LabError("REPLAY_UNAVAILABLE", message, { details, recovery: "Inspect saved run evidence, compare or export its saved images. Restore missing sources/runtime before replaying; current files are never substituted." });
  let snapshot;
  try { snapshot = JSON.parse(readFileSync(join(directory, "sources.json"), "utf8")); }
  catch { throw unavailable("Saved source snapshot is missing or unreadable", { run: manifest.run }); }
  if (digestOf(snapshot) !== manifest.sourceDigest) throw unavailable("Saved source digest does not match the run", { run: manifest.run });
  const entry = manifest.entry ?? entryFor(manifest.id);
  let support;
  try { support = replaySupport(snapshot, entry); }
  catch (error) { throw unavailable(`Saved sources could not be parsed: ${error.message}`, { run: manifest.run }); }
  if (!support.available) throw unavailable("Saved dependencies cannot be replayed completely", support);
  const runtime = manifest.runtime;
  if (!runtime || runtime.node !== process.version || runtime.platform !== process.platform || runtime.arch !== process.arch) throw unavailable("Saved runtime differs from the current runtime", { saved: runtime, current: { node: process.version, platform: process.platform, arch: process.arch } });
  const folder = mkdtempSync(join(tmpdir(), "athanor-vfx-replay-"));
  try {
    writeFileSync(join(folder, "package.json"), '{"type":"module"}\n');
    for (const [file, source] of Object.entries(snapshot)) {
      if (file.startsWith("/") || file.includes("\\") || file.split("/").some((part) => part === ".." || !part) || !/\.(?:m?js)$/.test(file) || typeof source !== "string") throw unavailable("Invalid saved source path or content", { file });
      const dest = join(folder, file);
      mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, source);
    }
    let backend;
    try {
      const saved = await import(pathToFileURL(join(folder, "experiments/vfx-lab/lab.mjs")).href);
      const clock = await import(pathToFileURL(join(folder, "experiments/vfx-lab/clock.js")).href);
      const core = await import(pathToFileURL(join(folder, "src/core/index.js")).href);
      backend = { fx: await saved.effect(manifest.id), sample: saved.sample, clockedFx: clock.clockedFx, createFrame: core.createFrame, clearFrame: core.clearFrame, snapshot };
      if (typeof backend.sample !== "function" || typeof backend.clockedFx !== "function") throw new Error("Saved evaluator entry is missing");
    } catch (error) { throw unavailable(`Could not load saved evaluator: ${error.message}`, { run: manifest.run }); }
    return await callback(backend);
  } finally { rmSync(folder, { recursive: true, force: true }); }
}
