import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {surface,mask,body,motion,action,curve,propagation,image,field,particle,material} from '../../src/authoring/index.js';
import {createFrame,painterFor,fit} from '../../src/core/index.js';
import {iceOf} from '../../src/fx/ice/_lib.js';
import {normalizeObservation} from './observation.mjs';
import {invoke} from './invoke.mjs';
import {LAB,RECORDS} from './lab.mjs';
import {packFrames,packHistory,expandHistory} from './history-storage.mjs';
const close=(a,b,e=1e-7)=>assert(Math.abs(a-b)<e,`${a} != ${b}`),vec=(a,b,e)=>a.forEach((v,i)=>close(v,b[i],e));
const channel=points=>curve.scalar({input:'scene.seconds',points});
const front=points=>curve.scalar({input:'scene.seconds',outputUnit:'pixels',points});
const skin=(o={})=>mask.make({id:'skin',space:'skin',w:8,h:6,origin:[0,-3],test:()=>true,...o});
const plain=(o={})=>surface.create({id:'skin',mask:skin(),body:body.create({id:'host'}),...o});

test('surface features lift the real silhouette scan including holes, top/rows and local origins',()=>{
  const s=plain({mask:skin({w:3,h:3,origin:[5,7],test:(x,y)=>!(x===6.5&&y===8.5)})}),f=surface.features(s);
  assert.equal(f.pixels.length,8);assert.equal(f.outline.length,13);vec(f.top[0],[5.5,7.5]);assert.deepEqual(f.rows[1],{y:8.5,left:5,right:8});
  assert(f.outline.some(p=>p.position[0]===6.5&&p.position[1]===8.5));
  f.pixels[0].position[0]=999;assert.notEqual(surface.features(s).pixels[0].position[0],999);
});

test('inverse surface drawing keeps scaled cells filled and a subset drives the same remaining state',()=>{
  const m=skin({w:2,h:2,origin:[0,0]}),s=plain({mask:m,body:body.create({id:'host',scale:[2,3]})}),f=createFrame(24,24),p=painterFor(f).place(8,8);
  let calls=0;surface.draw(p,s,0,{shade:q=>{calls++;assert(q.id.startsWith('skin/pixel/'));return {color:'#ffffff',light:'#00ffff',lightStrength:.1};}});
  assert.equal([...f.color].filter(Boolean).length,24);assert.equal(calls,4);assert(f.light.some(x=>x&0xffffff));assert.equal(p.toX(0,0),8);
  const subset=mask.derive(m,'one',(x,y,i)=>i===0),q=surface.draw(p,s,0,{mask:subset,color:'#ffaa00'});assert.equal(q.data.surface.remaining,1);assert.equal(surface.observe(s,0,{mask:subset}).data.surface.remaining,1);
  assert.throws(()=>surface.draw(p,s,0,{shade:()=>{throw Error('artist');}}),/artist/);assert.equal(p.toX(0,0),8);
});

test('surface projection uses full affine point derivatives and inverse-transpose reflected normals',()=>{
  const b=body.create({id:'host',source:motion.source({position:[channel([[0,0],[2,10]]),-4],rotation:channel([[0,.2],[2,.8]])}),scale:[channel([[0,1],[2,2]]),.8],flipX:true}),s=plain({body:b}),t=.6,h=1e-5,q=surface.project(s,t,{position:[4,-2],normal:[1,1]}),lo=surface.project(s,t-h,{position:[4,-2]}),hi=surface.project(s,t+h,{position:[4,-2]});
  vec(q.velocity,hi.position.map((x,i)=>(x-lo.position[i])/(2*h)),1e-6);close(Math.hypot(...q.normal),1);
  const m=body.sample(b,t).matrix,tangent=[m[0]-m[2],m[1]-m[3]];close(q.normal[0]*tangent[0]+q.normal[1]*tangent[1],0);
});

test('bone material frame follows solved IK, reflection, held changes and continuous root velocity',()=>{
  const a=action.create({id:'hero',clock:action.clock({to:2,holds:[{at:1,duration:.2}]}),scale:1.7,flipX:true,source:motion.source({rotation:channel([[0,0],[2,.5]])}),poses:[[0,{fx:4,fy:-25}],[2,{fx:18,fy:-29,x:20},'line']]}),s=surface.bone({id:'arm',action:a,mask:skin({w:12}),from:'elbowN',to:'handN',length:12}),t=.6,h=1e-6;
  vec(surface.project(s,t,{position:[0,0]}).position,action.sample(a,t).anchors.elbowN.position);vec(surface.project(s,t,{position:[12,0]}).position,action.sample(a,t).anchors.handN.position);
  const q=surface.project(s,t,{position:[5,1]}),lo=surface.project(s,t-h,{position:[5,1]}),hi=surface.project(s,t+h,{position:[5,1]});vec(q.velocity,hi.position.map((v,i)=>(v-lo.position[i])/(2*h)),1e-5);
  vec(surface.project(s,1.1,{position:[5,1]}).velocity,[0,0]);assert.equal(surface.sample(s,t).derivative.method,'held-bone-surface');
});

test('crack fields retain inherited design distance through projection and feed the same removal events',()=>{
  const s=plain({mask:skin({w:6,h:2,origin:[0,-1]})}),n=propagation.network({id:'crack',space:'skin',project:([x,y])=>[x*.5,y],branches:[{id:'main',points:[[0,0],[12,0]]}]}),f=surface.crackField({id:'break',surface:s,network:n,front:front([[1,0],[2,12]]),spreadPxPerSecond:2,delay:.1});
  close(f.distance.sample(3.5,.5),.5);close(f.crackAt.sample(3.5,.5),1+7/12);close(f.removeAt.sample(3.5,.5),1+7/12+.25+.1);
  const at=f.removeAt.sample(.5,-.5),d=image.dissolve({mask:s.mask,field:f.removeAt,threshold:at});assert.equal(d.keepMask.data[0],0);
  const births=surface.births({id:'flakes',surface:s,arrival:f.removeAt});assert.equal(births.length,12);assert(births.some(b=>b.sourcePixel===0&&b.born===at));
});

test('material departures freeze world position and inherit the real point velocity once after a launch impulse',()=>{
  const s=plain({body:body.create({id:'host',source:motion.source({position:[channel([[0,0],[3,18]]),0],rotation:channel([[0,0],[3,.6]])}),scale:2})}),rank=field.rank({id:'rank',mask:s.mask,score:(x,y)=>x+y}),arrival=field.arrival({id:'remove',rank,start:.5,end:1.5}),births=surface.births({id:'chips',surface:s,arrival,density:.2,seed:2}),e=particle.emitter({id:'chips',births,initial:{life:.7,velocity:[0,-10],velocityOffset:surface.inheritVelocity(.4)}});
  assert(births.length>0);for(let i=0;i<births.length;i++){const b=births[i],q=surface.project(s,b.born,{position:b.surface.materialPosition});vec(b.position,q.position);vec(e.births[i].velocity,q.velocity.map((v,k)=>v*.4+(k===1?-10:0)));}
  const saved=JSON.stringify(births);particle.sample(e,2);particle.sample(e,.1);assert.equal(JSON.stringify(births),saved);
});

test('event retiming and surface observations keep exact material identity through hold/replay order',()=>{
  const c=action.clock({from:-.2,to:2,holds:[{at:.5,duration:.2}]}),s=plain(),r=field.rank({id:'r',mask:s.mask,score:()=>0}),a=field.arrival({id:'a',rank:r,start:.5,end:1}),b=surface.births({id:'b',surface:s,arrival:a,clock:c});close(b[0].born,.9);close(b[0].surface.materialBorn,.5);
  const obs=normalizeObservation({bodies:[surface.observe(s,.6)]});assert.equal(obs.bodies[0].data.surface.pixels,48);assert.equal(obs.bodies[0].id,'surface/skin');
  const original=surface.sample(s,.7);surface.sample(s,1.7);surface.sample(s,.1);assert.deepEqual(surface.sample(s,.7),original);
});

test('surface contracts reject ambiguous spaces, grids, empty crack networks, budgets and invalid inheritance',()=>{
  assert.throws(()=>plain({mask:skin({space:'effect'})}),{path:'surface.mask.space'});
  assert.throws(()=>plain({body:{kind:'Body',space:'skin',sample:()=>{}}}),{path:'surface.body'});
  assert.throws(()=>plain({mask:skin({w:128,h:129})}),{code:'BUDGET_EXCEEDED',path:'surface.pixels'});
  const s=plain();assert.throws(()=>surface.sample(s,0,{mask:skin({w:9})}),{path:'surface.mask'});
  assert.throws(()=>surface.bone({id:'b',action:null}),{path:'surface.bone.action'});
  assert.throws(()=>surface.crackField({id:'f',surface:s,network:propagation.network({id:'n',space:'skin',branches:[]}),front:front([[0,0],[1,1]])}),{path:'surface.crackField.network'});
  assert.throws(()=>surface.inheritVelocity()({birth:{}}),{path:'surface.inheritVelocity.birth'});
  assert.throws(()=>particle.emitter({id:'bad',births:[{id:'b',born:0}],initial:{velocityOffset:[NaN,0]}}),{path:'particle.initial.velocityOffset[0]'});
});

test('ice color directly retains the mature brightness-to-ice mapping',()=>{
  const C=fit(['#111522','#227799','#bbedff','#ffffff'],8);for(const c of [0xff000000,0xffeeeeee,0xff287ead])assert.equal(material.iceColor(c,{colors:C}),iceOf(c,C));
});

test('large observation frames pack losslessly across all state kinds and retain trail indexing integrity',()=>{
  const pt={time:.1,simulationTime:.1,position:[1.0000000000000002,2],breakBefore:false,interpolated:false,distancePx:0,s:0,time01:0,ageSeconds:.2,historyAge:.2};
  const original={version:1,layers:[{id:'chips',births:[{id:'b',born:.1,life:1}]}],trailLayers:[{id:'trail',tracks:[{id:'one'}]}],frames:Array.from({length:35},(_,i)=>({index:i,t:i/30,simulationTime:i/30,localTime:i/30,particles:[{id:'chips',states:[{id:'b',status:'alive',position:[i/7,-i/13]}]}],sources:[{id:'source',position:[i,-i]}],bodies:[{id:'skin',data:{frameEncoding:'user data, not the envelope',padding:'surface'.repeat(70000),value:i/19}}],trails:[{id:'trail',states:[{id:'one',points:[pt]}]}]}))};
  const packed=packFrames(packHistory(original));assert.equal(packed.frameEncoding,'deflate-json-v1');assert.equal(packed.version,3);assert(Buffer.byteLength(JSON.stringify(packed))<16_000_000);
  assert.deepEqual({...expandHistory(JSON.parse(JSON.stringify(packed))),version:1},JSON.parse(JSON.stringify(original)));
  const bad=structuredClone(packed);bad.framePayload.rawBytes++;assert.throws(()=>expandHistory(bad),{code:'CONTRACT_MISMATCH'});
  const bomb=structuredClone(packed);bomb.framePayload.rawBytes=64_000_001;assert.throws(()=>expandHistory(bomb),{code:'CONTRACT_MISMATCH'});
  const index=structuredClone(packed);index.frames[0].t=99;assert.throws(()=>expandHistory(index),{code:'CONTRACT_MISMATCH'});
});

test('public saved/replay body probes transparently expand large evidence without dropping data',async()=>{
  const id=`surface-large-${randomUUID().slice(0,8)}`,file=join(LAB,'drafts',id+'.js'),runs=[];mkdirSync(join(LAB,'drafts'),{recursive:true});
  writeFileSync(file,`import {body} from '../../../src/authoring/index.js';
export const meta={name:'Large surface observation',size:[20,20],origin:[10,10],duration:1,loop:false,options:{seed:7}};
export const authoring={ending:'clear'};const b=body.create({id:'skin',bounds:[-2,-2,4,4],data:t=>({marker:t,padding:'f'.repeat(560000)})});
export function draw(p,t){if(t<.9)p.rect(-2,-2,4,4,0xffffffff);}
export function observe(t){return {bodies:[body.observe(b,t)]};}`);
  try{
    const r=await invoke('render',{id:'draft/'+id});runs.push(r.run);assert.equal(r.observation.frameEncoding,'deflate-json-v1');
    const saved=await invoke('probe',{run:r.run,view:'bodies',at:{times:[.5]},fields:['data']}),replay=await invoke('probe',{run:r.run,view:'bodies',at:{times:[.5]},fields:['data'],sampling:'replay'});assert.deepEqual(saved.samples,replay.samples);assert.equal(saved.samples[0].states[0].data.padding.length,560000);
    rmSync(file);const child=await invoke('render',{run:r.run});runs.push(child.run);assert.deepEqual(readFileSync(join(RECORDS,child.run,'observations.json')),readFileSync(join(RECORDS,r.run,'observations.json')));
  }finally{rmSync(file,{force:true});for(const run of runs)rmSync(join(RECORDS,run),{recursive:true,force:true});}
});

test('public surface probes and selected same-run delivery survive removal of the current draft',async()=>{
  const id=`surface-test-${randomUUID().slice(0,8)}`,file=join(LAB,'drafts',id+'.js'),runs=[];mkdirSync(join(LAB,'drafts'),{recursive:true});
  writeFileSync(file,`import {surface,mask,body,motion,curve,field,image,particle} from '../../../src/authoring/index.js';
export const meta={name:'Surface fixture',size:[40,32],origin:[14,18],duration:1.3,loop:false,options:{seed:7}};
export const authoring={ending:'clear'};
const m=mask.make({id:'m',space:'skin',w:4,h:4,test:()=>true}),s=surface.create({id:'plate',mask:m,body:body.create({id:'plate-body',end:1.3,scale:2,source:motion.source({position:[curve.scalar({input:'scene.seconds',points:[[0,0],[1.3,4]]}),0]})})});
const at=field.arrival({id:'at',rank:field.rank({id:'r',mask:m,score:x=>x}),start:.4,end:.8});
const chips=particle.emitter({id:'chips',births:surface.births({id:'chips',surface:s,arrival:at}),initial:{life:.2,velocity:[0,-2],velocityOffset:surface.inheritVelocity(.2)}});
const cut=t=>image.dissolve({mask:m,field:at,threshold:t}).keepMask;
export function draw(p,t){surface.draw(p,s,t,{mask:cut(t),color:'#ffffff'});particle.draw(p,chips,t,{draw:(q,s)=>q.px(...s.position,0xffffffff)});}
export function observe(t){return {bodies:[surface.observe(s,t,{mask:cut(t)})],particles:[particle.observe(chips,t)]};}`);
  try{
    assert((await invoke('search',{query:'material surface'})).resources.some(r=>r.ref.id==='core/surface'));
    const r=await invoke('render',{id:'draft/'+id});runs.push(r.run);const p=await invoke('probe',{run:r.run,view:'bodies',at:{times:[.2,.7,1]},fields:['data','matrix'],sampling:'replay'});assert.equal(p.samples[0].states[0].data.surface.remaining,16);assert.equal(p.samples[2].states[0].data.surface.remaining,0);
    rmSync(file);const child=await invoke('render',{run:r.run});runs.push(child.run);assert.equal(child.sourceDigest,r.sourceDigest);
    const v=await invoke('validate',{run:r.run});assert.equal(v.passed,true);const out=await invoke('export',{run:r.run,validationRef:v.validationRef});assert.deepEqual(readFileSync(join(out.directory,'combined.png')),readFileSync(join(RECORDS,r.run,'combined.png')));
  }finally{rmSync(file,{force:true});for(const run of runs)rmSync(join(RECORDS,run),{recursive:true,force:true});}
});
