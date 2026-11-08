import test from 'node:test';
import assert from 'node:assert/strict';
import {combat,particle,body,motion,curve} from '../../src/authoring/index.js';
import {createFrame,painterFor,hex,scale} from '../../src/core/index.js';
import {spell,drawWord} from '../../src/fx/ui/_lib.js';
import {relevance} from './search.mjs';
import {invoke} from './invoke.mjs';

const events=[{id:'a',target:'enemy',time:.4,value:27,direction:[1,0]},{id:'b',target:'enemy',time:.7,value:128,critical:true,direction:[-1,1]},{id:'c',target:'other',time:.9,value:'BLOCK',kind:'block',position:[40,0]}];
const sequence=()=>combat.hits({id:'fight',events,resolve:e=>({position:[e.time*20,-10],velocity:[20,0]})});
test('shared hits snapshot exact target time, preserve external facts and stable birth identities under reorder',()=>{
 const h=sequence();assert.deepEqual(h.events[0].position,[8,-10]);assert.equal(h.events[1].critical,true);
 const rev=combat.hits({id:'fight',events:[...events].reverse(),resolve:e=>({position:[e.time*20,-10],velocity:[20,0]})});
 assert.deepEqual(combat.births(h),combat.births(rev));
 const before=combat.sample(h,.75);combat.sample(h,.1);combat.sample(h,2);assert.deepEqual(combat.sample(h,.75),before);
 assert.equal(combat.sample(h,.75,{target:'enemy'}).length,2);assert.equal(combat.sample(h,.76,{target:'enemy'}).length,1);
 assert.throws(()=>combat.hits({id:'x',events:[{...events[0],id:1,position:[0,0]},{...events[0],id:'1',position:[0,0]}]}),/duplicate/);
 assert.throws(()=>{h.events[0].position[0]=999;},TypeError);
});
test('number bodies detach from moving targets and retain real hit provenance and query-independent contact flight',()=>{
 const b=body.create({id:'enemy',source:motion.source({position:[curve.scalar({input:'scene.seconds',points:[[0,0],[2,40]]}),-8]})});
 const h=combat.hits({id:'fight',events:[events[0]],resolve:e=>body.anchor(b).sample(e.time)}),n=combat.numbers({id:'labels',hits:h,size:.5});
 const s=particle.sample(n,.6)[0];assert.equal(s.data.text,'27');assert.equal(s.birth.hit.id,'a');assert.equal(s.birth.hit.target,'enemy');
 assert.deepEqual(s.birth.position,[8,-16]);assert(s.position[0]>8);assert(s.position[1]<-16);
 const before=particle.observe(n,.6);particle.sample(n,1.2);particle.sample(n,.1);assert.deepEqual(particle.observe(n,.6),before);
 assert.deepEqual(combat.births(h,{count:3}).map(b=>b.hit.id),['a','a','a']);
 assert.equal(particle.sample(n,n.births[0].born+n.births[0].life).length,0);
});
test('geometric hit resolution does not evaluate body feedback data before the hit sequence exists',()=>{
 let facts;
 const enemy=body.create({id:'enemy',anchors:{chest:[2,-7]},data:t=>({feedback:combat.sample(facts,t)})});
 facts=combat.hits({id:'fight',events:[events[0]],resolve:e=>body.anchor(enemy,{name:'chest'}).sample(e.time)});
 assert.deepEqual(facts.events[0].position,[2,-7]);assert.equal(body.sample(enemy,.5).data.feedback[0].id,'a');
 assert.equal(body.sample(enemy,.5,{data:false}).data,null);
});
test('public text keeps the mature bevel/outline/shadow raster and rejects unsupported glyphs explicitly',()=>{
 const a=createFrame(128,80),b=createFrame(128,80),p=painterFor(a).place(64,64),q=painterFor(b).place(64,64),w=spell('128!');
 combat.text(p,'128!',{scale:2});
 drawWord(q,w.letters.filter(l=>l.g).map(l=>({g:l.g,x:-w.w+l.x*2,y:-14,sx:2,sy:2,a:1,flash:0,slant:0})),{fill:['#d42a2e','#ff5a4a','#ff9a86'].map(hex),edge:hex('#ffd8cc'),under:hex('#8c1420'),outline:hex('#1a0508'),shadow:scale(hex('#1a0508'),.5)});
 assert.deepEqual(a.color,b.color);assert(a.color.some(c=>c));
 assert.throws(()=>combat.text(p,'暴击'),{code:'CAPABILITY_UNSUPPORTED',path:'combat.text.glyphs'});
 assert.equal(combat.tint('#246',[]),hex('#246'));assert.equal(combat.tint('#246',[{time:0,age:.01}]),hex('#fff'));
});
test('combat discovery matches game terms and precise IDs without critters/white substring noise',async()=>{
 for(const [query,id]of [['伤害','ui/damage-number'],['暴击','ui/crit-number'],['状态','status/frozen'],['技能','moves/fireball-throw']]){
  const r=await invoke('search',{query,limit:30});assert(r.effects.some(e=>e.id===id),query);
 }
 for(const query of ['crit','hit']){const r=await invoke('search',{query,limit:6});assert(r.effects.length);assert(!r.effects.some(e=>e.id.startsWith('critters/')));}
 assert.equal(relevance('hit',{description:'white light'}),0);
 assert.equal(relevance('damage critical',{tags:['damage','critical']} )>0,true);
 assert.equal(relevance('damage critical',{tags:['damage']}),0);
 const exact=await invoke('search',{query:'ui/damage-number',limit:1});assert.equal(exact.effects[0].id,'ui/damage-number');
 const contract=await invoke('inspect',{ref:{kind:'operator',id:'core/combat'}});assert.match(contract.sections.contract,/combat\.hits/);
});
test('public combat run has real target/number/spark identity and fair active selection across groups',async()=>{
 const run=await invoke('render',{id:'lab/hit-relay'});
 const probe=await invoke('probe',{run:run.run,view:'particles',at:{times:[.7]},limit:2,fields:['position','data']});
 assert.equal(probe.births.length,2);assert.deepEqual(new Set(probe.births.map(b=>b.layer)),new Set(['numbers','sparks']));
 assert(probe.births.every(b=>b.hit.id==='first'));assert.equal(probe.selection.groups.length,2);
 const saved=await invoke('probe',{run:run.run,view:'bodies',at:{times:[1.2,.6]},fields:['position','data']});assert.equal(saved.samples.length,2);
 const validation=await invoke('validate',{run:run.run});assert.equal(validation.passed,true,JSON.stringify(validation.errors));
 const delivery=await invoke('export',{run:run.run,validationRef:validation.validationRef});assert(delivery.directory);
});
