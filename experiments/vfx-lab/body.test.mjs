import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,mkdirSync,rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { body,orbit,motion,curve,particle,propagation,schedule,texture } from '../../src/authoring/index.js';
import { createFrame,painterFor,hex } from '../../src/core/index.js';
import { normalizeObservation,observationSeries } from './observation.mjs';
import { invoke } from './invoke.mjs';
import { LAB,RECORDS } from './lab.mjs';
const close=(a,b,e=1e-7)=>assert(Math.abs(a-b)<e,`${a} != ${b}`),vector=(a,b,e)=>a.forEach((v,i)=>close(v,b[i],e));
const line=points=>curve.scalar({input:'scene.seconds',points});
const basic=options=>body.create({id:'subject',...options});

test('body channels share a rigid source and differentiate scaling, pivot, reflection and moving named anchors',()=>{
  const b=basic({source:motion.source({position:[line([[0,0],[2,8]]),1],rotation:line([[0,0],[2,1]])}),scale:[line([[0,1],[2,2]]),line([[0,1.5],[2,.75]])],pivot:[1,-2],flipX:true,anchors:{socket:[line([[0,3],[2,5]]),-4]},bounds:[-8,-6,16,12]});
  const a=body.anchor(b,{name:'socket'}),t=.6,h=1e-5,q=a.sample(t),lo=a.sample(t-h),hi=a.sample(t+h);
  vector(q.velocity,hi.position.map((v,i)=>(v-lo.position[i])/(2*h)));
  const s=body.sample(b,t);vector(s.anchors.socket.position,q.position);vector(s.anchors.socket.velocity,q.velocity);assert.equal(s.bounds.corners.length,4);
  s.localBounds[0]=999;assert.equal(body.sample(b,t).localBounds[0],-8);
  assert.throws(()=>body.anchor(b,{name:'toString'}).sample(t),{code:'RESOURCE_NOT_FOUND',path:'body.anchor.name'});
});

test('attachment inheritance uses the real point velocity exactly once and is independent of output FPS',()=>{
  const b=basic({source:motion.source({rotation:line([[0,0],[2,2]])}),scale:line([[0,1],[2,3]]),anchors:{nozzle:[10,0]}}),source=body.anchor(b,{name:'nozzle'}),born=.7;
  const e=particle.emitter({id:'fragments',seed:3,births:[{id:'one',born}],transform:source,inheritVelocity:1,initial:{life:.5,velocity:[0,0]}});
  vector(e.births[0].position,source.sample(born).position);vector(e.births[0].velocity,source.sample(born).velocity);
  const before=particle.sample(e,.9);particle.sample(e,.1);particle.sample(e,1.4);assert.deepEqual(particle.sample(e,.9),before);
  assert.equal(e.births[0].source.derivative.method,'composed-body-anchor');
});

test('body lifecycle and declared JSON reject invalid states without inventing pixel bounds',()=>{
  const b=basic({born:.2,end:1,data:(t,s)=>({value:t,scale:s.scale})});
  assert.equal(body.sample(b,.1).status,'pending');assert.equal(body.sample(b,1).status,'expired');assert.equal(body.sample(b,.3).bounds,null);
  assert.throws(()=>body.sample(basic({scale:-1}),0),{path:'body.scale'});
  assert.throws(()=>body.sample(basic({opacity:1.1}),0),{path:'body.opacity'});
  const cyclic={};cyclic.self=cyclic;assert.throws(()=>body.sample(basic({data:cyclic}),0),{path:'body.data.self'});
  const jump=line([[0,1],[1,2],[2,2]]);const j=basic({scale:jump,side:'error'});assert.throws(()=>body.sample(j,1),/corner/);
});

test('inverse-mapped body fills stay solid under scaling and preserve caller placement, light and exception recovery',()=>{
  const f=createFrame(40,32),p=painterFor(f).place(20,16),b=basic({scale:[2,3]});
  body.draw(p,b,0,{draw:q=>q.rect(-2,-1,4,2,hex('#f80'))});assert.equal([...f.color].filter(c=>c>>>24).length,48);
  for(let y=13;y<19;y++)for(let x=16;x<24;x++)assert(f.color[y*40+x]>>>24);
  assert.equal(p.toX(0,0),20);assert.equal(p.toY(0,0),16);assert.equal(p.fade,1);
  assert.throws(()=>body.draw(p,b,0,{draw:()=>{throw Error('artist');}}),/artist/);p.px(0,0,hex('#fff'));assert(f.color[16*40+20]>>>24);
  body.draw(p,b,0,{draw:q=>q.glow(0,0,2,hex('#0ff'),.5)});assert(f.light.some(v=>v&0xffffff));
  assert.throws(()=>body.draw(p,b,0,{draw:q=>q.place(0,0)}),{path:'body.draw.painter'});
  let called=false;body.draw(p,basic({scale:0}),0,{draw:()=>called=true});assert.equal(called,false);
});

test('texture drawing and geometry transforms share flip/rotation while deterministic depth order remains explicit',()=>{
  const image=texture.ascii({id:'tile',rows:['AA','AA'],palette:{A:'#fff'},pivot:[1,1]});
  const f=createFrame(32,32),p=painterFor(f).place(16,16),b=basic({source:motion.source({rotation:Math.PI/2}),scale:3,flipX:true});
  body.draw(p,b,0,{draw:q=>texture.draw(q,image,{position:[0,0],scale:[1,1],rotation:0,opacity:1,tint:hex('#fff'),blend:'dither'})});
  assert.equal([...f.color].filter(c=>c>>>24).length,36);
  const a=basic({id:'a',depth:1}),z=basic({id:'z',depth:-1});
  body.drawAll(p,[{body:a,draw:q=>q.rect(-1,-1,2,2,hex('#f00'))},{body:z,draw:q=>q.rect(-1,-1,2,2,hex('#00f'))}],0);
  assert.equal(f.color[16*32+16],hex('#f00')>>>0);
});

test('orbit projection retains the mature common-center flattened/rolled formula and stable half-plane seams',()=>{
  const b=basic({source:motion.source({position:[5,-7]})}),o=orbit.create({id:'halo',body:b,radius:31,aspect:.24,roll:.36});
  for(const a of [.2,1.5,3.7,5.1]){const x=Math.cos(a)*31,y=Math.sin(a)*31*.24,q=orbit.sample(o,0,{angle:a});vector(q.position,[5+x*Math.cos(.36)-y*Math.sin(.36),-7+x*Math.sin(.36)+y*Math.cos(.36)]);assert.equal(q.near,Math.sin(a)>0);}
  for(const a of [0,Math.PI,2*Math.PI,-Math.PI]){const q=orbit.sample(o,0,{angle:a});assert.equal(q.near,false);assert.equal(q.relativeDepth,0);}
  const arcs=orbit.arcs(o,0,{fromAngle:-1,toAngle:5,spacingPx:1});assert.equal(arcs.length,3);
  for(const a of arcs)for(let i=1;i<a.samples.length;i++){assert(Math.hypot(...a.samples[i].position.map((v,j)=>v-a.samples[i-1].position[j]))<=1+1e-8);assert.equal(a.near,Math.sin((a.fromAngle+a.toAngle)/2)>0);}
  assert.throws(()=>orbit.arcs(o,0,{spacingPx:.00001}),{code:'BUDGET_EXCEEDED'});
});

test('projected point velocity includes radius, aspect, roll, phase and body motion/scale with honest source provenance',()=>{
  const b=basic({source:motion.source({position:[line([[0,0],[2,5]]),-3],rotation:line([[0,0],[2,.7]])}),scale:[line([[0,1],[2,1.5]]),.8],flipX:true});
  const o=orbit.create({id:'rim',body:b,radius:line([[0,20],[2,40]]),aspect:line([[0,.2],[2,.6]]),roll:line([[0,-.5],[2,.3]]),center:[2,line([[0,-1],[2,3]])]});
  const angle=line([[0,5],[2,-1]]),src=orbit.source(o,{angle}),t=.8,h=1e-5,q=src.sample(t),lo=src.sample(t-h),hi=src.sample(t+h);
  vector(q.velocity,hi.position.map((v,i)=>(v-lo.position[i])/(2*h)),1e-6);vector(q.position,orbit.sample(o,t,{angle}).position);
  assert.equal(q.derivative.method,'composed-projected-orbit');assert.equal(q.derivative.projection.body,'subject');
  const zero=orbit.create({id:'zero',body:b,radius:0});assert.deepEqual(orbit.arcs(zero,0),[]);assert(orbit.sample(zero,0).position.every(Number.isFinite));
});

test('far/body/near rendering shares geometry and material-only changes preserve ring coverage',()=>{
  const b=basic(),o=orbit.create({id:'ring',body:b,radius:12,aspect:.4});
  const render=color=>{const f=createFrame(40,30),p=painterFor(f).place(20,15);orbit.draw(p,o,0,{side:'far',color,width:2});body.draw(p,b,0,{draw:q=>q.circle(0,0,7,hex('#900'))});orbit.draw(p,o,0,{side:'near',color,width:2});return f;};
  const a=render('#0ff'),c=render('#f80');assert.deepEqual([...a.color].map(Boolean),[...c.color].map(Boolean));
  assert(a.color[10*40+20]===(hex('#900')>>>0));assert(a.color[19*40+20]===(hex('#0ff')>>>0));
  assert.throws(()=>orbit.sample(o,0,{angle:1e20}),{path:'orbit.angle'});
});

test('vertex attachment and matched retirement remove repeated length/lifetime joins without guessing missing ends',()=>{
  const n=propagation.network({id:'tree',branches:[{id:'root',points:[[0,0],[3,4],[6,4]]},{id:'child',parentId:'root',attachVertex:1,points:[[3,4],[3,10]]}]});
  assert.equal(n.branches.find(b=>b.id==='child').startPx,5);
  assert.throws(()=>propagation.network({id:'bad',branches:[{id:'root',points:[[0,0],[3,4]]},{id:'child',parentId:'root',attachVertex:1,attachPx:5,points:[[3,4],[4,4]]}]}),{path:'propagation.branch.attachment'});
  const starts=[{id:'grow/a',born:1,site:{id:'a'}}],ends=[{id:'end/a',born:3,site:{id:'a'}}],joined=schedule.until(starts,ends,{match:b=>b.site.id,offset:-.2});close(joined[0].life,1.8);assert.equal(joined[0].id,starts[0].id);
  assert.throws(()=>schedule.until(starts,[],{match:b=>b.site.id}),{code:'RESOURCE_NOT_FOUND'});
  assert.throws(()=>schedule.until(starts,[...ends,...ends],{match:b=>b.site.id}),{path:'schedule.until.ends'});
  assert.throws(()=>schedule.until(starts,ends,{match:b=>b.site.id,offset:-3}),{path:'schedule.until.life'});
});

test('body observation canonicalizes identities and rejects malformed geometry, lifetime and changing descriptors',()=>{
  const a=basic({id:'a',bounds:[-2,-2,4,4]}),b=basic({id:'b'}),first=normalizeObservation({bodies:[body.observe(b,0),body.observe(a,0)]});assert.deepEqual(first.bodies.map(b=>b.id),['a','b']);
  assert.throws(()=>normalizeObservation({bodies:[body.observe(a,0),body.observe(a,0)]}),{code:'CONTRACT_MISMATCH'});
  assert.throws(()=>normalizeObservation({bodies:[{...body.observe(a,0),matrix:[0]}]}),{code:'CONTRACT_MISMATCH'});
  const frames=[{t:0,observation:first},{t:1,observation:normalizeObservation({bodies:[body.observe(a,1),body.observe(b,1)]})}];assert.equal(observationSeries(frames).bodyLayers.length,2);
  frames[1].observation.bodies[0].localBounds=[0,0,2,2];assert.throws(()=>observationSeries(frames),/local bounds/);
});

const source=`import {body,motion,curve,orbit} from '../../../src/authoring/index.js';
export const meta={name:'Body contract fixture',size:[48,40],origin:[24,24],duration:.6,loop:false,options:{seed:7}};
export const authoring={ending:'clear'};
const b=body.create({id:'shell',source:motion.source({position:[curve.scalar({points:[[0,-5],[.6,5]]}),0],rotation:curve.scalar({points:[[0,0],[.6,.6]]})}),scale:curve.scalar({points:[[0,1],[.6,1.4]]}),bounds:[-5,-4,10,8],anchors:{nozzle:[4,0]},end:.6,data:t=>({time:t})});
const ring=orbit.create({id:'rim',body:b,radius:8,aspect:.4});
export function draw(p,t){if(t>=.6)return;orbit.draw(p,ring,t,{side:'far'});body.draw(p,b,t,{draw:q=>q.rect(-3,-2,6,4,0xffffffff)});orbit.draw(p,ring,t,{side:'near'});}
export function observe(t){return {bodies:[body.observe(b,t)],sources:[motion.observeSource(body.anchor(b,{name:'nozzle'}),t,{id:'emitter'})]};}`;

test('public body probes keep exact frozen state, pages, original errors and same-run delivery after current source disappears',async()=>{
  const id=`body-test-${randomUUID().slice(0,8)}`,file=join(LAB,'drafts',id+'.js'),runs=[];mkdirSync(join(LAB,'drafts'),{recursive:true});writeFileSync(file,source);
  try{
    assert((await invoke('search',{query:'共同投影'})).resources.some(r=>r.ref.id==='core/orbit'));
    assert.match((await invoke('inspect',{ref:{kind:'operator',id:'core/body'},sections:['contract']})).sections.contract,/body.anchor/);
    const r=await invoke('render',{id:'draft/'+id});runs.push(r.run);assert.equal(r.observation.bodies[0].id,'shell');
    const saved=await invoke('probe',{run:r.run,view:'bodies',at:{times:[.1,.4]},fields:['matrix','bounds','anchors','data'],layout:{columns:1}});assert.equal(saved.bodies[0].id,'shell');assert.equal(saved.pixelScale,1);assert.equal(saved.samples[1].states[0].data.time,.4);
    const bad=await invoke('probe',{run:r.run,view:'bodies',particles:['fake']}).catch(e=>e);assert.equal(bad.code,'CAPABILITY_UNSUPPORTED');assert.equal((await invoke('history',{callRef:bad.callRef})).call.status,'failed');
    rmSync(file);const replay=await invoke('probe',{run:r.run,view:'bodies',sampling:'replay',at:{times:[.25]},fields:['position','anchors']});close(replay.samples[0].actual,.25);close(replay.samples[0].states[0].position[0],-5+10*.25/.6);
    const child=await invoke('render',{run:r.run});runs.push(child.run);assert.equal(child.parentRun,r.run);assert.equal(child.sourceDigest,r.sourceDigest);
    const v=await invoke('validate',{run:r.run});assert.equal(v.passed,true);const out=await invoke('export',{run:r.run,validationRef:v.validationRef});assert.equal(out.run,r.run);assert.deepEqual(readFileSync(join(out.directory,'color.png')),readFileSync(join(RECORDS,r.run,'color.png')));
    const reqs=[{jsonrpc:'2.0',id:1,method:'initialize',params:{}},{jsonrpc:'2.0',method:'notifications/initialized'},{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'fx_probe',arguments:{run:r.run,view:'bodies',at:{times:Array.from({length:12},(_,i)=>i/30)},layout:{columns:2,maxWidth:480,maxHeight:480}}}}];
    const cp=spawnSync(process.execPath,[join(LAB,'mcp.mjs')],{input:reqs.map(q=>JSON.stringify(q)).join('\n')+'\n',encoding:'utf8',maxBuffer:4e6});assert.equal(cp.status,0,cp.stderr);const response=cp.stdout.trim().split('\n').map(x=>JSON.parse(x)).find(x=>x.id===2).result;assert.equal(response.isError,false);assert(response.structuredContent.pages.length>=2);assert.equal(response.content.filter(c=>c.type==='image').length,response.structuredContent.pages.length);
  }finally{rmSync(file,{force:true});for(const run of runs)rmSync(join(RECORDS,run),{recursive:true,force:true});}
});
