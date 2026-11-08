import test from 'node:test';
import assert from 'node:assert/strict';
import {skill,path,particle,motion,curve,schedule} from '../../src/authoring/index.js';
import {createFrame,painterFor,fit,hex} from '../../src/core/index.js';
import {slash as legacySlash} from '../../src/fx/melee/_lib.js';
import {invoke} from './invoke.mjs';
const stages=[{id:'gather',duration:.6},{id:'fly',duration:.4},{id:'sustain',duration:.5}];
const close=(a,b)=>a.forEach((v,i)=>assert(Math.abs(v-b[i])<1e-5,`${v} != ${b[i]}`));
test('free named stages share cues and cancel emission without truncating detached lives',()=>{
 const s=skill.sequence({id:'a',start:.2,stages,cancelAt:.65,tail:.5});
 assert.equal(skill.at(s,'fly'),null);assert.equal(skill.at(s,'gather',{edge:'end'}),null);
 const b=skill.retime(s,'gather',schedule.rate({id:'x',start:0,end:.6,rate:10}));
 assert(b.every(b=>b.born>=.2&&b.born<.65));
 const e=particle.emitter({id:'x',births:b,initial:{life:1}});assert(particle.sample(e,.8).length);
 assert.equal(skill.sample(s,.8).status,'tail');assert.equal(skill.sample(s,.8).effectiveTime,.65);
 const full=skill.sequence({id:'b',start:.2,stages});assert.equal(skill.at(full,'fly'),.8);assert(Math.abs(skill.at(full,'sustain',{edge:'end'})-1.7)<1e-12);
 const edge=skill.sequence({id:'edge',stages,cancelAt:.6,tail:.2});assert.equal(skill.sample(edge,.6).stage,'gather');assert.equal(skill.at(edge,'fly'),null);
 const pre=skill.sequence({id:'pre',start:1,stages,cancelAt:.2,tail:.3});assert.equal(skill.sample(pre,.3).status,'tail');assert.equal(skill.sample(pre,.6).status,'expired');assert.equal(skill.interval(pre,'gather').emits,false);
});
test('decimal stage cues land on a common output sample without binary accumulation shifting the first hit',()=>{
 const s=skill.sequence({id:'decimal',start:1.3,stages:[{id:'a',duration:.65},{id:'b',duration:.35},{id:'c',duration:.6}]});
 assert.equal(skill.at(s,'c',{edge:'end'}),2.9);
 assert.equal(skill.at(s,'a',{offset:.1}),1.4);
 const tiny=skill.sequence({id:'tiny',start:0,stages:[{id:'a',duration:1e-17},{id:'b',duration:2e-17}]});assert.equal(tiny.end,3e-17);
});
test('mature slash raster remains identical while geometry and material stay replaceable',()=>{
 const C=fit(['#123','#789','#fff'],8),s=skill.swing({R:22,sy:.5,rot:.2,a0:-1,span:3.2,W:7,sweep:.12,hold:.05,trail:.3,t0:0,ramp:C});
 const a=createFrame(80,80),b=createFrame(80,80);skill.slash(painterFor(a).place(40,40),s,.21);legacySlash(painterFor(b).place(40,40),s,.21);
 assert.deepEqual(a.color,b.color);assert.deepEqual(a.light,b.light);assert(a.color.some(v=>v));
 const f=createFrame(80,80);skill.smear(painterFor(f).place(40,40),s,0,2,6,(_,r,out)=>{out.c=hex('#0af');out.a=.5;});assert(f.color.some(v=>v));
});
test('beam uses actual curved endpoints and accepts fully replaced alpha/color/light shaders',()=>{
 const route=path.polyline({id:'bend',points:[[-20,5],[0,-8],[25,3]]}),f=createFrame(80,64),p=painterFor(f).place(32,32);
 const result=skill.beam(p,route,.3,{from:.2,to:.8,width:6,glow:0,strands:0,shade:({across})=>Math.abs(across)>.8?null:{color:'#327',alpha:.7,light:'#08f',lightStrength:.1}});
 close(result.head.position,path.sample(route,.8).position);close(result.tail.position,path.sample(route,.2).position);assert(f.color.some(v=>v));assert(f.light.some(v=>v&0xffffff));
 const blank=createFrame(20,20);skill.orb(painterFor(blank),{radius:0});assert(!blank.color.some(v=>v));
});
test('attached quadratic infall exposes real birth source and analytical moving/rotating point velocity',()=>{
 const line=points=>curve.scalar({input:'scene.seconds',points});
 const source=motion.source({position:[line([[0,0],[2,20]]),-5],rotation:line([[0,0],[2,1]])});
 const e=skill.infall({id:'in',births:[{id:'p',born:.1}],source,life:.6,radius:[20,30],spin:[.6,1]});
 const initial=particle.sample(e,.1)[0];close(initial.position,e.births[0].position);close(initial.velocity,e.births[0].velocity);
 assert.deepEqual(e.births[0].source.derivative,source.sample(.1).derivative);
 const t=.3,h=1e-6,s=particle.sample(e,t)[0],a=particle.sample(e,t-h)[0],b=particle.sample(e,t+h)[0];close(s.velocity,b.position.map((v,i)=>(v-a.position[i])/(2*h)));
 const before=particle.observe(e,t);particle.sample(e,.6);particle.sample(e,.1);assert.deepEqual(particle.observe(e,t),before);
});
test('public skill composition suppresses cancelled hits and exposes actual remaining tail identities',async()=>{
 const r=await invoke('render',{id:'lab/skill-relay',options:{charge:.7}});
 const inspected=await invoke('inspect',{ref:{kind:'run',id:r.run}});
 assert(Math.abs(inspected.events.release-2)<1e-12);assert(Math.abs(inspected.events.hit-2.35)<1e-12);
 const probe=await invoke('probe',{run:r.run,view:'particles',layers:['cut-motes','cast-labels'],at:{times:[.5,2.4]},limit:4,fields:['position','data']});
 assert(probe.births.some(b=>b.layer==='cut-motes'));assert(probe.births.some(b=>b.hit?.id==='arrived'));
 const all=await invoke('probe',{run:r.run,view:'particles',layers:['cut-labels'],at:{times:[.7]},selection:'birth-order'});assert.equal(all.births.length,0);
 const validation=await invoke('validate',{run:r.run});assert.equal(validation.passed,true,JSON.stringify(validation.errors));
});

test('infall retains artist birth data independently from its motion parameters',()=>{
 const e=skill.infall({id:'payload',births:[{id:'p',born:0,data:{a:'art',mass:3,bank:'left'}}],source:motion.source(),life:.5,endRadius:0});
 const s=particle.sample(e,.2)[0];assert.deepEqual(s.data,{a:'art',mass:3,bank:'left'});assert.equal(e.births[0].infall.a,Number(e.births[0].infall.a));assert(particle.track(e,'p',{end:.5}).sample(.5).position.every(v=>Math.abs(v)<1e-10));
});
