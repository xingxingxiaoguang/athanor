import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,rmSync,mkdirSync,mkdtempSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {execFileSync,spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {ROOT} from './lib/fxlib.mjs';
import {catalog,inspectAsset,dependencyFiles} from './lib/asset-library.mjs';
import {registryFiles} from './lib/registry.mjs';
import {createLabServer} from '../experiments/vfx-lab/server.mjs';

test('source catalog resolves approved weapons and retained studies with complete reusable dependencies',async()=>{
  const c=await catalog();assert.equal(new Set(c.effects.map(f=>f.id)).size,c.count);
  const w=await inspectAsset('weapons/acid-flight');assert(w.dependencies.some(f=>f.file.startsWith('src/fx/weapons/_modules/')));
  assert(w.dependencies.every(f=>f.file.startsWith('src/')&&/^[a-f0-9]{64}$/.test(f.sha256)));
  const s=await inspectAsset('studies/sunbreak');assert.equal(s.status,'study');assert(s.dependencies.some(f=>f.file.endsWith('_sunbreak/smoke-flow.js')));
  assert(!s.dependencies.some(f=>/productions|records/.test(f.file)));
  await assert.rejects(inspectAsset('../missing'),/Unknown asset/);
});

test('registry generation targets disposable cache and does not rewrite authored docs',async()=>{
  const c=await catalog('frost-nova'),files=registryFiles(c.effects,c.categories);
  assert(Object.keys(files).every(f=>f.startsWith('.cache/athanor/')));
  assert(files['.cache/athanor/library.js'].includes('../../src/fx/ice/frost-nova.js'));
  assert.equal(JSON.parse(files['.cache/athanor/catalog.json']).effects[0].id,'ice/frost-nova');
});

test('dependency parser follows reexports and rejects imports into disposable working directories',async()=>{
  const dir=join(ROOT,'src/fx/_asset-test-'+randomUUID());mkdirSync(dir);
  try{
    writeFileSync(join(dir,'helper.js'),'export const value=1;');
    writeFileSync(join(dir,'entry.js'),"export * from './helper.js';");
    assert.equal((await dependencyFiles(join(dir,'entry.js'))).length,2);
    writeFileSync(join(dir,'entry.js'),"import '../../../experiments/vfx-lab/effects/cryo-bloom.js';");
    await assert.rejects(dependencyFiles(join(dir,'entry.js')),/must live in src/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('one demo serves its source library and hides Git, drafts and traversal paths',async()=>{
  const server=createLabServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    assert.equal(await(await fetch(base+'/')).text(),readFileSync(join(ROOT,'demo/index.html'),'utf8'));
    assert.equal((await fetch(base+'/src/fx/studies/drift.js')).status,200);
    for(const path of ['/.git/config','/experiments/vfx-lab/drafts/x.js','/src/%2e%2e%2f.git/config'])assert.notEqual((await fetch(base+path)).status,200);
  }finally{await new Promise(r=>server.close(r));}
});

test('commit gate rejects force-added output even after it disappears from the worktree',()=>{
  const root=mkdtempSync(join(tmpdir(),'athanor-asset-index-'));
  try{
    for(const path of ['src','tools'])cpSync(join(ROOT,path),join(root,path),{recursive:true});
    cpSync(join(ROOT,'experiments/vfx-lab/assets.mjs'),join(root,'experiments/vfx-lab/assets.mjs'),{recursive:true});
    writeFileSync(join(root,'package.json'),'{"type":"module"}');
    execFileSync('ln',['-s',join(ROOT,'node_modules'),join(root,'node_modules')]);
    execFileSync('git',['init','-q',root]);
    mkdirSync(join(root,'records'));writeFileSync(join(root,'records/forced.json'),'{}');
    execFileSync('git',['add','-f','records/forced.json'],{cwd:root});
    rmSync(join(root,'records/forced.json'));
    const p=spawnSync(process.execPath,[join(root,'tools/assets.mjs'),'check','--staged'],{cwd:root,encoding:'utf8'});
    const result=JSON.parse(p.stdout);assert.equal(p.status,1,p.stderr);assert(result.errors.some(e=>e.file==='records/forced.json'&&e.error.includes('Generated')));
    execFileSync('ln',['-s',join(root,'src'),join(root,'linked-source')]);
    execFileSync('git',['add','linked-source'],{cwd:root});
    for(const args of [[],['--staged']]){
      const q=spawnSync(process.execPath,[join(root,'tools/assets.mjs'),'check',...args],{cwd:root,encoding:'utf8'}),r=JSON.parse(q.stdout);
      assert.equal(q.status,1,q.stderr);assert(r.errors.some(e=>e.file==='linked-source'&&e.code==='SOURCE_ENTRY_UNSUPPORTED'&&e.recovery));
    }
  }finally{rmSync(root,{recursive:true,force:true});}
});
