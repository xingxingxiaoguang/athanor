// The editable modules are the catalog. Registries and deliveries are disposable.
import {readFileSync, existsSync, realpathSync} from 'node:fs';
import {resolve, relative, dirname, sep} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {init, parse} from 'es-module-lexer';
import {ROOT, allIds, loadEffect} from './fxlib.mjs';
import {categories} from '../../src/fx/categories.js';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const outputDirectories = ['.cache', 'dist', 'records', 'sheets', 'output', '.playwright-cli'];

export async function catalog(query = '') {
  const effects = [];
  for (const id of allIds()) {
    const fx = await loadEffect(id);
    if (query && !JSON.stringify({id, ...fx.meta}).toLowerCase().includes(query.toLowerCase())) continue;
    effects.push({id, entry:`src/fx/${id}.js`, status:fx.mod.asset?.status ?? 'library', ...fx.meta});
  }
  return {version:1, categories, count:effects.length, effects};
}

export async function dependencyFiles(entry) {
  await init();
  const files = new Map();
  const root = realpathSync(ROOT);
  function visit(path) {
    const absolute = realpathSync(resolve(root, path));
    if (!absolute.startsWith(root + sep)) throw new Error(`Dependency leaves the repository: ${path}`);
    const file = relative(root, absolute);
    if (files.has(file)) return;
    const source = readFileSync(absolute, 'utf8');
    const [imports] = parse(source, file);
    files.set(file, {file, sha256:sha256(source), bytes:Buffer.byteLength(source)});
    for (const item of imports) {
      if (!['static', 'reexport-star'].includes(item.type) || !item.specifier?.startsWith('.')) {
        throw new Error(`${file}: asset dependencies must use static relative imports`);
      }
      const dep = relative(root, resolve(dirname(absolute), item.specifier));
      if (!dep.startsWith('src/')) throw new Error(`${file}: library dependency must live in src/: ${dep}`);
      visit(dep);
    }
  }
  visit(entry);
  return [...files.values()].sort((a,b) => a.file.localeCompare(b.file));
}

export async function inspectAsset(id) {
  if (!allIds().includes(id)) throw new Error(`Unknown asset '${id}'; use assets list to discover category/name IDs`);
  const fx = await loadEffect(id);
  const {captureAssets, assetSummary} = await import('../../experiments/vfx-lab/assets.mjs');
  const bundle = captureAssets(fx);
  return {
    id, entry:`src/fx/${id}.js`, status:fx.mod.asset?.status ?? 'library', meta:fx.meta,
    events: typeof fx.mod.events === 'function' ? fx.mod.events(fx.meta.options) : fx.mod.events ?? {},
    dependencies:await dependencyFiles(`src/fx/${id}.js`),
    resources:bundle ? assetSummary(bundle) : null,
    provenance:fx.mod.provenance ?? fx.mod.asset ?? null,
    license:'MIT; preserve LICENSE, NOTICE.md and the notices in each dependency.',
    usage:`import * as effect from 'athanor/fx/${id}';`,
    delivery:`node experiments/vfx-lab/cli.mjs render '${JSON.stringify({id})}'`,
  };
}

export async function checkLibrary({staged=false} = {}) {
  const errors = [], c = await catalog(), reachable = new Set();
  const categoryIds = new Set(categories.map(x => x.id));
  for (const fx of c.effects) {
    try {
      if (!categoryIds.has(fx.id.split('/')[0])) throw new Error('Category is not declared in src/fx/categories.js');
      if (!fx.name || !fx.desc || !Array.isArray(fx.tags) || !fx.tags.every(x=>typeof x==='string')) throw new Error('Needs name, desc and string tags in meta');
      if (!Array.isArray(fx.size) || fx.size.length!==2 || fx.size.some(x=>!Number.isInteger(x)||x<8||x>480)) throw new Error('meta.size must contain two integers in 8..480');
      if (!Array.isArray(fx.origin) || fx.origin.length!==2 || fx.origin.some(x=>!Number.isFinite(x)) || !(fx.duration>0)) throw new Error('Needs a finite origin and positive duration');
      for (const file of await dependencyFiles(fx.entry)) reachable.add(file.file);
      const loaded = await loadEffect(fx.id);
      for (const mod of loaded.mod.provenance?.sourceModules ?? []) {
        if (sha256(readFileSync(resolve(ROOT,mod.file)))!==mod.sha256) throw new Error(`Provenance digest differs: ${mod.file}`);
      }
      if (loaded.mod.assets) await inspectAsset(fx.id);
    } catch (error) { errors.push({id:fx.id,error:error.message}); }
  }
  // CI and pre-commit also catch force-added outputs, even when .gitignore hides them.
  let paths, sizes;
  if (staged) {
    const entries=execFileSync('git',['ls-files','--stage','-z'],{cwd:ROOT,encoding:'utf8'}).split('\0').filter(Boolean).map(row=>{const [metadata,path]=row.split('\t');return {path,blob:metadata.split(' ')[1]};});
    const stats=execFileSync('git',['cat-file','--batch-check=%(objectsize)'],{cwd:ROOT,input:entries.map(e=>e.blob).join('\n')+'\n',encoding:'utf8'}).trim().split('\n').map(Number);
    paths=entries.map(e=>e.path);sizes=new Map(entries.map((e,i)=>[e.path,stats[i]]));
  } else paths = execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:ROOT,encoding:'utf8'}).split('\0').filter(p=>p&&existsSync(resolve(ROOT,p)));
  let bytes=0;
  for (const path of paths) {
    const size=staged?sizes.get(path):readFileSync(resolve(ROOT,path)).length; bytes+=size;
    const output = outputDirectories.some(d=>path.startsWith(d+'/')) || /^experiments\/vfx-lab\/(productions|drafts)\//.test(path)
      || /^docs\/ai-vfx-tools\/(history|handoff-review)\//.test(path)
      || /\.(?:gif|mp4|webm|zip|gz|jsonl|log|tap)$/.test(path)
      || (/\.(?:png|jpe?g|webp)$/.test(path) && !/^src\/fx\/.*\/_assets\//.test(path) && !/^experiments\/vfx-lab\/(effects\/assets|fixtures\/png)\//.test(path));
    if (output) errors.push({file:path,error:'Generated/iteration output must stay outside tracked source'});
    if (size>1024*1024 && !/\/_assets\//.test(path)) errors.push({file:path,error:'Non-resource source exceeds 1 MiB; review repository contents'});
    if (path.startsWith('src/fx/') && path.endsWith('.js') && path!=='src/fx/categories.js' && !reachable.has(path)) errors.push({file:path,error:'Unreachable asset source; remove or connect it to a public asset'});
  }
  if(bytes>16*1024*1024)errors.push({error:'Source tree exceeds the 16 MiB budget; review source resources or generated outputs'});
  return {passed:errors.length===0,scope:staged?'index':'worktree',effects:c.count,categories:categoryIds.size,sourceBytes:bytes,dependencyFiles:reachable.size,errors};
}
