import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createFrame, painterFor, fit } from '../../src/core/index.js';
import { material } from '../../src/authoring/index.js';
import { lobe } from '../../src/fx/explosions/_lib.js';
import { cloud } from '../../src/fx/projectiles/_lib.js';
import { invoke } from './invoke.mjs';
import { LAB, RECORDS } from './lab.mjs';

const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const F = fit(['#fff3c4','#f8984b','#6e3442','#242231'],9), S = fit(['#b9c7cd','#5f6d7d','#222637'],8);
test('lobe and merged cloud preserve mature helper pixels, transforms and Painter state', () => {
  for (const style of ['smooth','cel']) for (const angle of [0,.34]) for (const opacity of [.18,.8,1]) {
    const frames = [createFrame(80,80),createFrame(80,80)];
    const painters = frames.map(f=>{const p=painterFor(f).place(40,40,false,angle);p.fade=.7;p.lightK=.6;return p;});
    const s={position:[-4,2],age01:.4,opacity};
    material.lobe(painters[0],s,{fireColors:F,smokeColors:S,size:13,heat:.6,innerGlow:.4,depth:-.5,dark:1,style,glow:.2});
    painters[1].lightK*=.2;lobe(painters[1],-4,2,13,F,S,.6,.4,opacity,-.5,1,style==='cel'?1:0);
    assert.deepEqual(frames[0].color,frames[1].color);assert.deepEqual(frames[0].light,frames[1].light);
    assert.equal(painters[0].fade,.7);assert.equal(painters[0].lightK,.6);
    const states=[s,{...s,position:[5,2],opacity:.6}];
    const more=[createFrame(80,80),createFrame(80,80)], ps=more.map(f=>painterFor(f).place(40,40,true,angle));
    material.cloud(ps[0],states,{colors:S,warmColors:S,size:11,brightness:.8,warmth:.3,clip:(x,y)=>y<10});
    cloud(ps[1],states.map(s=>({x:s.position[0],y:s.position[1],r:11,a:s.opacity,b:.8,w:.3})),S,S,{clip:(x,y)=>y<10});
    assert.deepEqual(more[0].color,more[1].color);assert.deepEqual(more[0].light,more[1].light);
  }
  assert.throws(()=>material.cloud(painterFor(createFrame(8,8)),[{position:[0,0],opacity:1}],{colors:S,size:()=>NaN}),e=>e.path==='material.cloud.states[0].size');
});

test('effect reuse reveals actual helper exports/source and registered symbol discovery without SDK source', async () => {
  for(const query of ['lobe','fireBall','cloud','drawRock','fractures']){
    const r=await invoke('search',{query});assert(r.mechanisms.length,query);
  }
  const alias=await invoke('search',{query:'firePuff'});assert(alias.resources.some(r=>r.ref.id==='core/material'));
  const r=await invoke('inspect',{id:'explosions/smoke-bomb',sections:['reuse','source']});
  const module=r.reuse.modules.find(m=>m.file==='src/fx/explosions/_lib.js');
  assert(module.exports.includes('lobe'));assert(module.importedBy.some(i=>i.file==='src/fx/explosions/smoke-bomb.js'));
  assert.equal(module.source,readFileSync(join(LAB,'../../',module.file),'utf8'));
  assert(r.reuse.modules.every(m=>m.file.startsWith('src/fx/')));
  for(const id of ['library/explosion-lobes','library/merged-smoke']){
    const m=await invoke('inspect',{ref:{kind:'mechanism',id},sections:['source','reuse','contract','example']});
    assert(m.sections.reuse.replaceable.length>=4);assert.equal(typeof m.sections.example,'string');
    for(const part of m.sections.source)assert(readFileSync(join(LAB,'../../',part.file),'utf8').includes(part.source));
  }
});

test('evidence bundle keeps original failures, native pages, earlier selection and usable same-run export after deleting draft', async () => {
  const name=`reuse-${randomUUID().slice(0,8)}`,id=`draft/${name}`,file=join(LAB,'drafts',`${name}.js`),runs=[];
  mkdirSync(dirname(file),{recursive:true});
  const source=c=>`export const meta={name:'Bundle check',desc:'test',tags:['test'],size:[24,24],origin:[12,12],duration:.2,options:{seed:7}};export function draw(p,t){if(t<.15)p.circle(0,0,3,${c})}`;
  try {
    writeFileSync(file,source('0xffaa8844'));const a=await invoke('render',{id});runs.push(a.run);
    writeFileSync(file,source('0xffbb9955'));const b=await invoke('render',{id});runs.push(b.run);
    const p=await invoke('compare',{runs:[a.run,b.run],alignment:'time',window:{from:0,to:.1},layout:{columns:2}});
    let failure;try{await invoke('render',{run:a.run,invalid:true});}catch(e){failure=e;}
    assert(failure?.callRef);
    await invoke('history',{action:'select',run:a.run,reason:'earlier choice',evidence:[p.callRef]});
    const v=await invoke('validate',{run:a.run});assert(v.passed);
    const exp=await invoke('export',{run:a.run,validationRef:v.validationRef});
    await invoke('history',{action:'select',run:b.run,reason:'a separate choice'});
    rmSync(file);
    const result=await invoke('history',{action:'bundle',run:a.run,annotations:{intent:'test bundle',viewed:[p.callRef],limitations:['test declaration only']}}),bundle=result.bundle;
    const index=JSON.parse(readFileSync(bundle.index));
    assert.equal(index.target.run,a.run);assert.equal(index.decision.selectedRun,a.run);assert(index.validations.some(x=>x.validationRef===v.validationRef));
    const error=index.calls.find(x=>x.callRef===failure.callRef);assert.equal(error.status,'failed');
    const original=join(RECORDS,'calls',`${failure.callRef}.json`);assert.equal(hash(original),hash(join(bundle.directory,error.file)));
    for(const call of index.calls){
      const f=index.files.find(f=>f.file===call.file);assert(f,`Call file absent from hashed ledger: ${call.file}`);
      assert(f.roles.includes('public-call'));assert.equal(f.original,join(RECORDS,'calls',`${call.callRef}.json`));
      assert.equal(call.sha256,f.sha256);assert.equal(hash(f.original),call.sha256);
    }
    assert.equal(index.viewing.automaticViewingClaim,false);assert.equal(index.viewing.declarations[0].verifiedByTool,false);
    assert(index.files.some(f=>f.roles.includes('native-image-page')));assert(!index.files.some(f=>f.original.endsWith('/sources.json')));
    for(const f of index.files)assert.equal(hash(join(bundle.directory,f.file)),f.sha256);
    const atlas=index.files.find(f=>f.original===join(exp.directory,'atlas.json'));
    assert(existsSync(join(dirname(join(bundle.directory,atlas.file)),'color.png')));
    assert(index.versions.some(v=>v.run===b.run));assert.equal(index.missing.length,0);
    await assert.rejects(invoke('history',{run:a.run,annotations:{intent:'wrong action'}}),{code:'INVALID_INPUT'});
    await assert.rejects(invoke('history',{run:a.run,action:'bundle',annotations:{viewed:[v.callRef]}}),{code:'CONTRACT_MISMATCH'});
  }finally{rmSync(file,{force:true});for(const run of runs)rmSync(join(RECORDS,run),{force:true,recursive:true});}
});
