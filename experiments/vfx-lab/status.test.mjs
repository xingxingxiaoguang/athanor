import test from 'node:test';
import assert from 'node:assert/strict';
import {status,body,particle,motion} from '../../src/authoring/index.js';
import {invoke} from './invoke.mjs';
const facts=[{id:'on',action:'apply',time:.2,duration:1,strength:.6},{id:'renew',action:'refresh',time:.7,duration:1.4,strength:1.2,phase:'preserve'},{id:'off',action:'remove',time:1.5}];
test('external facts preserve/replace expiry and phase explicitly without inventing buff rules',()=>{
 const l=status.lifecycle({id:'coat',target:'hero',events:facts,fadeOut:.4});
 const s=status.sample(l,1);assert.equal(s.active.phaseOrigin,.2);assert.equal(s.active.strength,1.2);assert.equal(s.active.end,1.5);
 assert.equal(status.sample(l,1.5).active,null);assert.equal(status.sample(l,1.6).tails.length,1);assert.equal(status.sample(l,2).instances.length,0);
 const restarted=status.lifecycle({id:'coat',target:'hero',events:facts.map(e=>e.id==='renew'?{...e,phase:'restart'}:e)});assert.equal(status.sample(restarted,1).active.phaseOrigin,.7);
 assert.deepEqual(status.sample(l,1),s);assert.throws(()=>status.lifecycle({id:'x',target:'h',events:[{id:'r',time:1,action:'refresh'}]}),{path:'status.refresh'});
 const stacked=status.lifecycle({id:'x',target:'h',events:[{id:'a',time:0,action:'apply'},{id:'b',time:1,action:'apply'}]});assert.equal(status.sample(stacked,1.1).instances.length,2);
});
test('preserved-phase births retain identity across refresh and windows, and detached lives outlast removal',()=>{
 const l=status.lifecycle({id:'coat',target:'hero',events:facts});
 const b=status.births(l,{rate:10,to:3,life:1});assert(b.every(b=>b.born<1.5));assert.equal(new Set(b.map(b=>b.id)).size,b.length);
 const before=status.births(l,{rate:10,to:.6,life:1});assert.deepEqual(before,b.filter(b=>b.born<.6));
 const a=status.births(l,{rate:10,to:1,life:1}),c=status.births(l,{rate:10,from:1,to:3,life:1});assert.deepEqual([...a,...c],b);
 const e=particle.emitter({id:'embers',births:b,initial:{velocity:[0,-5]}});assert(particle.sample(e,1.7).length);assert.equal(status.sample(l,1.9).instances.length,0);
 assert.equal(b.at(-1).statusEffect.event,'renew');assert.equal(b.at(-1).statusEffect.strength,1.2);
});
test('the same actual body supplies material/anchor/declared lifecycle state without witness particles',()=>{
 const l=status.lifecycle({id:'coat',target:'hero',events:facts}),hero=status.bind(body.create({id:'hero',source:motion.source({position:[12,-4]}),data:{art:'free'}}),l);
 assert.deepEqual(body.anchor(hero).sample(1).position,[12,-4]);const q=body.observe(hero,1);assert.equal(q.id,'hero');assert.equal(q.data.statuses.coat.active.strength,1.2);assert.deepEqual(q.data.target,{art:'free'});
 assert.equal(body.sample(hero,1,{data:false}).data,null);
 const phase=status.phase(status.sample(l,1).active,.4);assert(Math.abs(phase.progress)<1e-12);
});
test('public material/orbit status exposes refresh/removal and stable real residual births',async()=>{
 const r=await invoke('render',{id:'lab/status-relay'});
 const body=await invoke('probe',{run:r.run,view:'bodies',at:{times:[1.5,2,3.2,3.8]},fields:['position','data']});
 const q=body.samples[2].states[0];assert.equal(q.data.statuses['warm-coat'].active,null);assert.equal(q.data.statuses['warm-coat'].tails[0].emitting,false);
 const p=await invoke('probe',{run:r.run,view:'particles',at:{times:[3.4]},limit:2,fields:['position','data']});assert(p.births.length);assert(p.births.every(b=>b.born<3.1));
 const validation=await invoke('validate',{run:r.run});assert.equal(validation.passed,true,JSON.stringify(validation.errors));
});
