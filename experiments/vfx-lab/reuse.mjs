// Public structural map of actual library dependencies, never SDK/runtime code.
import { posix } from 'node:path';
import { init, parse } from 'es-module-lexer';
import { moduleImports } from './source-parser.mjs';
import { digestOf } from './replay.mjs';
import { mechanismsForFile } from './mechanisms.mjs';

export async function reuseOverview(snapshot, entry, includeSource = false) {
  await init();
  const dependencies = moduleImports(snapshot), isLibrary = file => file.startsWith('src/fx/');
  const edges = Object.entries(dependencies).flatMap(([from, imports]) => imports.filter(s => s.startsWith('.')).map(specifier => ({ from, specifier, to: posix.normalize(posix.join(posix.dirname(from), specifier)) }))).filter(e => isLibrary(e.to));
  const modules = [...new Set(edges.map(e => e.to))].filter(file => file !== entry).sort().map(file => {
    const source = snapshot[file], [, exports] = parse(source, file);
    return { file, revision: digestOf(source), exports: exports.map(e => e.exported ?? e.name ?? '*'), importedBy: edges.filter(e => e.to === file).map(({ from, specifier }) => ({ file: from, specifier })), mechanisms: mechanismsForFile(file), ...(includeSource ? { source } : {}) };
  });
  return { entry, representation: 'actual-static-library-dependencies', modules,
    scope: 'Static reachability is not proof of active use: barrel imports can include unused helpers. No tool/runtime/SDK implementation is returned. Private dependencies stay in their original modules; import helpers rather than pasting fragments.',
    next: 'Inspect a listed mechanism for units, replaceable inputs and an adapter example. Request sections:["reuse","source"] on this effect for the actual library modules, retaining their notices. Ordinary JavaScript remains editable.' };
}
