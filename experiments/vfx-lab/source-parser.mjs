// Use Node's own ECMAScript parser in a small subprocess. No third-party parser
// or text matching of strings/comments is used for static dependency discovery.
import * as vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const known = new Map();
function requests(source) { return [...new vm.SourceTextModule(source).dependencySpecifiers]; }
function worker(input) {
  const dependencies = {}, snapshot = input.snapshot ?? {};
  function visit(entry) {
    const file = realpathSync(entry);
    if (!file.startsWith(input.root + sep)) throw new Error('Source import leaves the checkout');
    const key = relative(input.root, file);
    if (Object.hasOwn(snapshot, key)) return;
    const source = readFileSync(file, 'utf8'); snapshot[key] = source;
    const imports = requests(source); dependencies[key] = imports;
    for (const specifier of imports) if (specifier.startsWith('.')) visit(resolve(dirname(file), specifier));
  }
  if (input.entry) visit(input.entry);
  for (const [file, source] of Object.entries(snapshot)) dependencies[file] ??= requests(source);
  return { snapshot, dependencies };
}
function run(input) {
  const output = JSON.parse(execFileSync(process.execPath, ['--experimental-vm-modules', '--no-warnings', fileURLToPath(import.meta.url), '--parse-worker'], { input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
  if (output.error) throw new Error(`Source parse failed: ${output.error}`);
  for (const [file, source] of Object.entries(output.snapshot)) known.set(source, output.dependencies[file]);
  return output;
}
export function captureSources(entry, root, existing) { return run({ entry, root: realpathSync(root), snapshot: existing }).snapshot; }
export function moduleImports(snapshot) {
  if (Object.values(snapshot).some((source) => !known.has(source))) run({ snapshot });
  return Object.fromEntries(Object.entries(snapshot).map(([file, source]) => [file, known.get(source)]));
}
if (process.argv[2] === '--parse-worker' && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.stdout.write(JSON.stringify(worker(JSON.parse(readFileSync(0, 'utf8'))))); }
  catch (error) { process.stdout.write(JSON.stringify({ error: error.message })); process.exitCode = 0; }
}
