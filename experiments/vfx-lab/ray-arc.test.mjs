import test from 'node:test';import assert from 'node:assert/strict';
import {ray,arc,motion,curve} from '../../src/authoring/index.js';
import {createFrame,painterFor} from '../../src/core/index.js';
const near=(a,b,e=1e-9)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
test('declared finite surfaces give true normals, pass-through entry/exit, stable order, reflection and range',()=>{
 const surfaces=[ray.box({id:'armor',bounds:[10,-3,5,6],mode:'pass',retention:.8}),ray.segment({id:'mirror',a:[20,-5],b:[30,5],mode:'reflect'}),ray.segment({id:'end',a:[10,15],b:[30,15]})];
 const a=ray.trace({id:'shot',origin:[0,0],direction:[1,0],surfaces,range:80});assert.deepEqual(a.hits.map(h=>h.surface),['armor','armor','mirror','end']);assert.deepEqual(a.hits.slice(0,2).map(h=>h.entering),[true,false]);near(a.hits[2].outgoing[0],0);near(a.hits[2].outgoing[1],1);assert.equal(a.reason,'stop');near(a.distance,40);near(a.hits[2].energyBefore,.64);assert.deepEqual(ray.trace({id:'shot',origin:[0,0],direction:[1,0],surfaces:[...surfaces].reverse(),range:80}),a);
 const events=ray.events(a,{start:.2,speed:100});near(events[0].time,.3);assert.equal(new Set(events.map(e=>e.id)).size,4);near(a.path.lengthPx,40);
});
test('Snell entry and exit preserve the correct refractive regions and total internal reflection',()=>{
 const glass=ray.box({id:'glass',bounds:[10,-30,12,60],mode:'refract',ior:1.5});const q=ray.trace({id:'r',origin:[0,0],direction:[1,.4],surfaces:[glass],range:70});assert.equal(q.hits.length,2);near(q.hits[0].iorTo,1.5);near(q.hits[1].iorTo,1);near(q.hits[0].incoming[1]/q.hits[0].outgoing[1],1.5);near(q.hits[1].outgoing[1],q.hits[0].incoming[1]);
 const r=ray.refract([.9,.435889894],[-1,0],{from:1.5,to:1});assert.equal(r.totalInternalReflection,false);
 const tir=ray.trace({id:'tir',origin:[15,0],direction:[.3,1],surfaces:[glass],range:27,maxInteractions:8});assert(tir.hits.some(h=>h.totalInternalReflection));assert(tir.hits.every(h=>h.iorFrom===1.5));
 assert.throws(()=>ray.trace({id:'overlap',origin:[15,0],direction:[1,0],surfaces:[glass,ray.circle({id:'second',center:[15,0],radius:5,mode:'refract'})]}),{code:'CAPABILITY_UNSUPPORTED'});
 const tangent=ray.trace({id:'tan',origin:[0,5],direction:[1,0],surfaces:[ray.circle({id:'c',center:[10,0],radius:5,mode:'refract'})],range:20});assert.equal(tangent.hits[0].action,'tangent');near(tangent.end[0],20);
});
test('arc graph supports moving arbitrary branches, pure restrikes, exact arrival facts and true leader length',()=>{
 const source=motion.source({position:[curve.scalar({input:'scene.seconds',points:[[0,60],[1,80]]}),20]});const n=arc.network({id:'net',seed:4,nodes:[{id:'a',position:[0,0]},{id:'b',position:source},{id:'c',position:[90,-10]}],links:[{id:'ab',from:'a',to:'b',start:.1,travel:.2,duration:.6},{id:'bc',from:'b',to:'c',start:.3,travel:.1,duration:.4}]});
 assert.equal(arc.sample(n,.2)[0].status,'propagating');const at=arc.sample(n,.3);assert.equal(at[0].status,'holding');near(at[0].head[0],66);assert.deepEqual(arc.sample(n,.3),at);arc.sample(n,.6);arc.sample(n,0);assert.deepEqual(arc.sample(n,.3),at);
 const events=arc.events(n);assert.deepEqual(events.map(e=>e.time),[.3,.4]);assert.deepEqual(events[0].position,[66,20]);const whole=arc.events(n,{from:-.01,to:2,period:1}),split=[...arc.events(n,{from:-.01,to:.7,period:1}),...arc.events(n,{from:.7,to:2,period:1})];assert.deepEqual(whole,split);assert.equal(new Set(whole.map(e=>e.id)).size,whole.length);
 const b=arc.observe(n,.3);assert.equal(b.kind,'BodyObservation');assert.equal(b.data.links[0].head[0],66);
 const f=createFrame(128,96),p=painterFor(f).place(12,48);arc.draw(p,n,.3,{glow:.1});assert(f.color.some(c=>c));const old=f.color.slice();const g=createFrame(128,96);arc.draw(painterFor(g).place(12,48),n,.3,{glow:0});assert.deepEqual(g.color,old);assert(g.light.every(c=>!c));
});

test('ray observation and causal electrical timing remove bridges while preserving actual geometry',()=>{
 const q=ray.trace({id:'obs',origin:[0,0],direction:[1,0],surfaces:[ray.box({id:'target',bounds:[20,-4,10,8],mode:'pass'})],range:50});const o=ray.observe(q,.2,{toPx:25});assert.equal(o.id,'ray/obs');assert.equal(o.localBounds,null);assert.deepEqual(o.data.head,[25,0]);assert.equal(o.data.hits.length,1);assert.equal(o.data.segments.reduce((n,s)=>n+s.length,0),25);
 const nodes=[{id:'a',position:[0,0]},{id:'b',position:[20,0]},{id:'c',position:[40,0]}];const n=arc.network({id:'causal',nodes,links:[{id:'bc',from:'b',to:'c',after:'ab',delay:.05,travel:.1,duration:.4},{id:'ab',from:'a',to:'b',start:.1,travel:.2,duration:.5}]});assert.equal(n.links[0].start,.35);assert.equal(n.links[0].hit,.45);assert.deepEqual(arc.events(n).map(e=>e.time),[.3,.45]);
 assert.throws(()=>arc.network({id:'bad',nodes,links:[{id:'ab',from:'a',to:'b',after:'bc'},{id:'bc',from:'b',to:'c',after:'ab'}]}),/cyclic/);
});
