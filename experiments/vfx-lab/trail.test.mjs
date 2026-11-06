import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {trail,particle,contact,path,motion} from '../../src/authoring/index.js';
import {trail as oldTrail} from '../../src/core/shapes.js';
import {createFrame,painterFor} from '../../src/core/index.js';
import {normalizeObservation,observationSeries} from './observation.mjs';
import {packHistory,expandHistory} from './history-storage.mjs';
import {invoke} from './invoke.mjs';
import {LAB,RECORDS} from './lab.mjs';
const close=(a,b,e=1e-8)=>assert(Math.abs(a-b)<=e,`${a} != ${b}`);
const frame=(fn)=>{const f=createFrame(50,40),p=painterFor(f).place(5,25);fn(p);return f;};
const moving=(extra={})=>trail.history({id:'line',born:0,end:2,sample:t=>({position:[10*t,0]}),...extra},{stepSeconds:.125,length:{seconds:.5}});

test('past-time queries preserve the core trail recipe, pause timestamps and query-order independence',()=>{
 const h=moving(),a=trail.sample(h,1);assert.deepEqual(a.trails[0].points.map(p=>p.position),oldTrail(t=>[10*t,0],1,5,.125).reverse());
 trail.sample(h,1.8);trail.sample(h,.2);assert.deepEqual(trail.sample(h,1),a);
 const pause=moving({sample:t=>({position:[Math.min(t,.5)*10,0]})});const pts=trail.sample(pause,1).trails[0].points;
 assert.equal(pts.length,5);assert.equal(new Set(pts.map(p=>p.time)).size,5);assert.equal(new Set(pts.map(p=>p.position[0])).size,1);
});

test('particle tracks retain exact contact corners, terminal samples and physical versus render history',()=>{
 const e=particle.emitter({id:'ball',births:[{id:'p',born:0,position:[0,-10]}],initial:{life:3,velocity:[8,0]},motion:{acceleration:[0,20],contact:contact.floor({restitution:.5,settleSpeed:3}),offset:s=>[0,Math.sin(s.age*5)*2]}});
 const track=particle.track(e,'p'),h=trail.history(track,{stepSeconds:.3,length:{seconds:3}}),p=trail.sample(h,2.7).trails[0].points;
 for(const hit of contact.events(e)){const q=p.find(p=>p.time===hit.time);assert(q);close(q.position[1],Math.sin(hit.age*5)*2);}
 const physical=trail.history(particle.track(e,'p',{position:'physical'}),{stepSeconds:.3,length:{seconds:3}});
 assert.equal(trail.sample(physical,2.7).trails[0].points.find(p=>p.time===1).position[1],0);
 const killed=particle.emitter({id:'k',births:[{id:'k',born:.2,position:[0,-10]}],initial:{life:3},motion:{acceleration:[0,20],contact:contact.floor({response:'kill'})}});
 const k=particle.track(killed,'k');close(k.end,1.2);close(k.sample(k.end).position[1],0);assert.equal(particle.sample(killed,k.end).length,0);
 const line=particle.emitter({id:'l',births:[{id:'l',born:0}],initial:{life:1,velocity:[10,0]}});assert.deepEqual(particle.track(line,'l').sample(1).position,[10,0]);
 const natural=particle.emitter({id:'natural',births:[{id:'p',born:.35,position:[0,-10]}],initial:{life:1.6,velocity:[19,-11]},motion:{acceleration:[0,118],contact:contact.floor({y:43})}});
 const tails=trail.emitter(natural,{length:{seconds:.64},death:{mode:'fade',seconds:.6}});
 for(const t of [1.95,1.9666666666666666,2.1])assert(trail.sample(tails,t).trails[0].points.length);
 const hit=contact.events(natural)[0];assert.deepEqual(particle.track(natural,'p').sample(hit.time).velocity,hit.velocityAfter);assert.deepEqual(particle.sample(natural,hit.time)[0].velocity,hit.velocityAfter);
});

test('pixel length follows traveled polyline through reversal and gaps never bridge',()=>{
 const track={id:'back',born:0,end:2,knots:[{time:1,kind:'corner'}],sample:t=>({position:[t<=1?t*10:(2-t)*10,0]})};
 const h=trail.history(track,{stepSeconds:.3,length:{pixels:15}}),s=trail.sample(h,2).trails[0];close(s.lengthPx,15);close(s.points[0].time,.5);close(s.points[0].position[0],5);assert(s.points[0].interpolated);assert(s.points.some(p=>p.time===1&&p.position[0]===10));
 const g=trail.history({id:'gap',born:0,end:1,knots:[{time:.5,kind:'break'}],sample:t=>({position:[t<.5?t*10:20+(t-.5)*10,0]})},{stepSeconds:.1,length:{seconds:1}});
 const pixels=frame(p=>trail.draw(p,g,1,{width:2}));assert.equal(pixels.color[25*50+20],0,'jump space must be empty');
 const missing=trail.history({id:'missing',born:0,end:1,sample:t=>t>.3&&t<.7?null:{position:[t*20,0]}},{stepSeconds:.1,length:{seconds:1}});
 assert(trail.sample(missing,1).trails[0].points.find(p=>p.time>.7).breakBefore);
 const linear={id:'exact',born:0,end:1,sample:t=>({position:[20*t,0],...(t>0?{velocity:[20,0]}:{})})};
 const exact=trail.sample(trail.history(linear,{stepSeconds:.25,length:{pixels:10}}),1).trails[0].points;
 assert.deepEqual(exact.map(p=>p.time),[.5,.75,1]);assert(!exact[0].interpolated);
 const optional=trail.sample(trail.history(linear,{stepSeconds:.25,length:{pixels:17}}),1).trails[0].points[0];assert(!Object.hasOwn(optional,'velocity'));
 const coincident=trail.history({...g.track,knots:[{time:.5,kind:'break'},{time:.5,kind:'corner'}]},{stepSeconds:.1,length:{seconds:1}});
 assert(trail.sample(coincident,1).trails[0].points.find(p=>p.time===.5).breakBefore);
});

test('death fade freezes geometry, shrink expires old points, clear removes and stationary paths draw no false blob',()=>{
 const track={id:'dead',born:0,end:1,sample:t=>({position:[t*20,0]})};
 const fade=trail.history(track,{length:{seconds:.6},death:{mode:'fade',seconds:.5}});const a=trail.sample(fade,1).trails[0],b=trail.sample(fade,1.25).trails[0];
 assert.deepEqual(a.points.map(p=>p.position),b.points.map(p=>p.position));close(b.opacity,.5);assert.equal(trail.sample(fade,1.5).trails[0].phase,'expired');
 const shrink=trail.history(track,{length:{seconds:.6},death:{mode:'shrink'}});close(trail.sample(shrink,1.3).trails[0].window.from,.7);assert.equal(trail.sample(shrink,1.6).trails[0].phase,'expired');
 assert.equal(trail.sample(trail.history(track,{death:{mode:'clear'}}),1).trails[0].points.length,0);
 const still=moving({sample:t=>({position:[0,0]})});assert(!frame(p=>trail.draw(p,still,1)).color.some(x=>x));
});

test('force tracks reuse the exact fixed-tick solver, expose actual clocks and require explicit custom endings',()=>{
 const force=s=>[-s.position[0]*3,20],e=particle.emitter({id:'force',births:[{id:'p',born:.2,position:[4,-10]}],initial:{life:2,velocity:[8,0]},motion:{forces:[force],kill:s=>s.age>=1}});
 const tr=particle.track(e,'p');close(tr.end,1.2);
 for(const t of [.2,.343,.9]){const s=particle.sample(e,t)[0],q=tr.sample(t);assert.deepEqual(q.position,s.position);close(q.simulationTime,.2+s.simulationAge);}
 const q=tr.sample(.9);q.position[0]=999;assert.notEqual(tr.sample(.9).position[0],999);
 const custom=particle.emitter({id:'custom',births:[{id:'p',born:0}],initial:{life:2},motion:{trajectory:s=>({position:[s.time*10,0],velocity:[10,0]})}});
 assert.throws(()=>particle.track(custom,'p'),/explicit terminal/);assert.deepEqual(particle.track(custom,'p',{end:1}).sample(1).position,[10,0]);
 const premature=particle.emitter({id:'premature',births:[{id:'p',born:0}],initial:{life:2},motion:{trajectory:s=>({position:[s.time,0],velocity:[1,0],alive:s.age<.5})}});
 assert.throws(()=>particle.track(premature,'p',{end:1}).sample(.7),/before declared end/);
});

test('historical bands reuse the continuous path rasterizer and newest exact retraces win',()=>{
 const h=moving(),t=.5;
 assert.deepEqual(frame(p=>trail.draw(p,h,t,{width:3,color:'#f80',alpha:.7})),frame(p=>path.strip(p,path.polyline({id:'line',points:[[0,0],[5,0]]}),{width:3,color:'#f80',alpha:.7})));
 const h2=trail.history({id:'return',born:0,end:2,knots:[{time:1,kind:'corner'}],sample:t=>({position:[t<=1?t*10:(2-t)*10,0]})},{stepSeconds:.25,length:{seconds:2}});
 const drawn=frame(p=>trail.draw(p,h2,2,{width:3,color:q=>q.time>1?'#f00':'#00f'}));assert.equal(drawn.color[25*50+10]>>>0,0xff0000ff);
});

test('history budgets and observation identities fail explicitly rather than silently decimating',()=>{
 const h=moving();assert.throws(()=>trail.sample(trail.history(h.track,{stepSeconds:.01,length:{seconds:1},maxSamples:4}),1),{code:'BUDGET_EXCEEDED'});
 assert.throws(()=>trail.history(h.track,{length:{pixels:5},death:{mode:'shrink'}}),{code:'CAPABILITY_UNSUPPORTED'});
 const a=normalizeObservation({trails:[trail.observe(h,.5)]}),b=normalizeObservation({trails:[trail.observe(h,1)]});assert(observationSeries([{t:.5,observation:a},{t:1,observation:b}]).trailLayers.length);
 b.trails[0].tracks[0].stepSeconds=.1;assert.throws(()=>observationSeries([{t:.5,observation:a},{t:1,observation:b}]),/descriptors/);
 assert.throws(()=>trail.sample(moving({sample:t=>({position:[NaN,t]})}),1),/finite/);
});

test('indexed history evidence preserves every float and point, reads legacy data and rejects bad references',()=>{
 const h=moving(),frames=Array.from({length:20},(_,i)=>{const t=.5+i/30,g=trail.observe(h,t);return {index:i,t,particles:[],trails:[{id:g.id,states:g.states}]};});
 const original={version:1,layers:[],trailLayers:[{id:h.id,tracks:[h.config]}],frames},before=structuredClone(original);
 const packed=packHistory(original);assert.equal(packed.historyEncoding,'point-table-v1');assert.equal(packed.frames.length,20);assert.deepEqual(original,before);
 const expanded=expandHistory(JSON.parse(JSON.stringify(packed)));assert.deepEqual({...expanded,version:1},original);
 assert(Buffer.byteLength(JSON.stringify(packed))<Buffer.byteLength(JSON.stringify(original)));
 assert.equal(expandHistory(original),original);
 const broken=structuredClone(packed);broken.frames[0].trails[0].states[0].points[0][0]=packed.trailPointTable.length;
 assert.throws(()=>expandHistory(broken),{code:'CONTRACT_MISMATCH'});
});

test('public history discovery, saved/replay probes, FPS/material isolation and same-run export',async()=>{
 const found=await invoke('search',{query:'历史'});assert(found.resources.some(r=>r.ref.id==='core/trail'));
 const doc=await invoke('inspect',{ref:{kind:'operator',id:'core/trail'}});assert.match(doc.sections.contract,/stepSeconds/);assert(!doc.sections.source);
 const name='history-'+randomUUID().slice(0,8),file=join(LAB,'drafts',name+'.js'),runs=[];mkdirSync(join(LAB,'drafts'),{recursive:true});
 writeFileSync(file,`import {trail} from '../../../src/authoring/index.js';
export const meta={name:'History fixture',desc:'Reversal trail',tags:['test'],size:[48,40],origin:[12,25],duration:2,options:{tint:'#fff'}};
const h=trail.history({id:'turn',born:0,end:1.2,knots:[{time:.6,kind:'corner'}],sample:t=>({position:[t<=.6?t*20:(1.2-t)*20,-5]})},{length:{seconds:.7},death:{mode:'fade',seconds:.3}});
export function draw(p,t,o){trail.draw(p,h,t,{width:q=>1+q.s*3,color:o.tint})}export function observe(t){return {trails:[trail.observe(h,t)]}}`);
 try{
  const a=await invoke('render',{id:'draft/'+name});runs.push(a.run);assert.equal(a.observation.trails[0].trackCount,1);
  const p=await invoke('probe',{run:a.run,view:'trails',at:{times:[.8,1.3]}});assert.equal(p.trails[0].id,'turn');assert.equal(p.samples[1].states[0].phase,'fading');
  const b=await invoke('render',{id:'draft/'+name,fps:60,options:{tint:'#0ff'}});runs.push(b.run);const q=await invoke('probe',{run:b.run,view:'trails',at:{times:[.8,1.3]}});assert.deepEqual(p.samples.map(s=>s.states),q.samples.map(s=>s.states));
  rmSync(file);const replay=await invoke('probe',{run:a.run,view:'trails',sampling:'replay',at:{times:[.813,.31,.813]}});assert.deepEqual(replay.samples[0].states,replay.samples[2].states);
  const exact=.813123456789123,precise=await invoke('probe',{run:a.run,view:'trails',sampling:'replay',at:{times:[exact]}});
  assert.equal(precise.samples[0].localTime,exact);assert.equal(precise.samples[0].states[0].window.to,exact);
  const saved=await invoke('probe',{run:a.run,view:'trails',at:{times:[.8,1.3]}});assert.deepEqual(saved.samples,p.samples);
  const v=await invoke('validate',{run:a.run});assert(v.passed,JSON.stringify(v.errors));const x=await invoke('export',{run:a.run,validationRef:v.validationRef});assert.equal(x.run,a.run);
  await assert.rejects(invoke('probe',{run:a.run,view:'trails',tracks:['missing']}),{code:'RESOURCE_NOT_FOUND'});
  await assert.rejects(invoke('probe',{run:a.run,view:'trails',fields:['position']}),{code:'CAPABILITY_UNSUPPORTED'});
 }finally{rmSync(file,{force:true});for(const r of runs)rmSync(join(RECORDS,r),{recursive:true,force:true});}
});
