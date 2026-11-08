import test from 'node:test';import assert from 'node:assert/strict';
import {gather,skill,schedule,motion,particle,body} from '../../src/authoring/index.js';
import {invoke} from './invoke.mjs';
test('actual inward endpoints retain identities and signed weights under reorder, time jumps and edits',()=>{
 const src=motion.source({position:[10,-20]}),e=skill.infall({id:'slag',births:schedule.burst({id:'b',at:.2,count:3}),source:src,life:.5,endRadius:0});
 const config={id:'arrival',target:'arm',ends:b=>b.born+b.life,weight:({birth})=>birth.index+1,accept:({endpoint})=>Math.hypot(endpoint.position[0]-10,endpoint.position[1]+20)<1e-9};
 const a=gather.fromParticles(e,config);assert.equal(a.events.length,3);assert.deepEqual(a.events.map(e=>e.parent.particle),['b/0','b/1','b/2']);assert(a.events.every(e=>Math.hypot(e.position[0]-10,e.position[1]+20)<1e-9));
 assert.equal(gather.sample(a,.6999).total,0);assert.equal(gather.sample(a,.7).total,6);gather.sample(a,2);gather.sample(a,0);assert.equal(gather.sample(a,.7).count,3);
 assert.deepEqual(gather.fromParticles({...e,births:[...e.births].reverse()},config),a);
 const b=gather.records({id:'other',events:[...a.events,{id:'consume',target:'arm',time:1,position:[10,-20],weight:-4}]});assert.equal(gather.sample(b,1,{target:'arm',initial:2}).total,4);assert.equal(gather.sample(b,1,{from:.8}).total,-4);
 const births=gather.births(a,{count:2});assert.equal(new Set(births.map(b=>b.id)).size,6);assert.equal(births[0].arrival.id,a.events[0].id);
 const bound=gather.bind(body.create({id:'arm',data:{alloy:'copper'}}),a);assert.equal(body.sample(bound,.7).data.accumulation[0].total,6);assert.deepEqual(body.sample(bound,.7).data.target,{alloy:'copper'});assert.equal(body.sample(bound,.7,{data:false}).data,null);
 assert.throws(()=>gather.fromParticles(e,{target:'arm'}),/explicit terminal/);assert.throws(()=>gather.records({id:'bad',events:[a.events[0],a.events[0]]}),/duplicate/);
});
test('a malformed artist field identifies the exact event payload key',()=>{
 assert.throws(()=>gather.records({id:'bad',events:[{id:'shard',target:'arm',time:1,position:[0,0],data:{bank:undefined}}]}),e=>e.path==='gather.events[shard].data.bank');
});
test('public arrival reference observes the actual weighted body and exports the selected same run',async()=>{
 const r=await invoke('render',{id:'lab/gather-relay'});const b=await invoke('probe',{run:r.run,view:'bodies',at:{times:[2.4,1,.4]},fields:['data','position']});assert(b.samples.length===3);
 const v=await invoke('validate',{run:r.run});assert.equal(v.passed,true,JSON.stringify(v.errors));const x=await invoke('export',{run:r.run,validationRef:v.validationRef});assert(x.directory);
});
