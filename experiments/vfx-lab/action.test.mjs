import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {action,motion,curve,particle} from '../../src/authoring/index.js';
import {poseAt} from '../../src/core/act.js';
import {skeleton} from '../../src/core/rig.js';
import {createFrame,painterFor} from '../../src/core/index.js';
import {invoke} from './invoke.mjs';
import {LAB,RECORDS} from './lab.mjs';
const close=(a,b,e=1e-7)=>assert(Math.abs(a-b)<e,`${a} != ${b}`),vec=(a,b,e)=>a.forEach((v,i)=>close(v,b[i],e));
const poses=[[-.3,{x:-3,fx:-4,fy:-24}],[.7,{x:21,y:-5,fx:19,fy:-28},'line'],[1.4,{x:28,fx:15,fy:-20},'out']];
const line=points=>curve.scalar({input:'scene.seconds',points});
const make=(options={})=>action.create({id:'hero',clock:action.clock({from:-.3,to:1.4}),poses,...options});

test('pure action clocks insert exact holds, invert event edges and preserve negative windup through seeks',()=>{
  const c=action.clock({from:-.3,to:1.4,rate:2,holds:[{at:.7,duration:.2},{at:-.3,duration:.1}]});
  close(c.duration,1.15);close(c.at(.7,{edge:'before'}),.6);close(c.at(.7),.8);
  assert.equal(c.sample(.65).local,.7);assert.equal(c.sample(.65).frozen,true);assert.equal(c.sample(.65).localRate,0);
  assert.equal(c.sample(.6,{side:'left'}).localRate,2);assert.equal(c.sample(.6).localRate,0);
  assert.equal(c.sample(.8,{side:'left'}).localRate,0);assert.equal(c.sample(.8).localRate,2);
  assert.equal(c.sample(-1).frozen,false);assert.equal(c.sample(2).local,1.4);
  const expected=c.sample(.51);c.sample(.9);c.sample(.01);assert.deepEqual(c.sample(.51),expected);
  assert.throws(()=>c.sample(.6,{side:'error'}),{path:'action.clock.playback'});
  assert.throws(()=>action.clock({to:1,holds:[{at:.2,duration:.1},{at:.2,duration:.3}]}),{path:'action.clock.holds'});
  assert.throws(()=>c.at(-1),{path:'action.clock.at'});
});

test('creator-reported decimal hold exit resolves its temporal side before interval containment',()=>{
  const c=action.clock({from:-.4,to:3.8,holds:[{at:.85,duration:.22},{at:1.61,duration:.16}]});
  assert.equal(c.sample(2.39).frozen,false);assert.equal(c.sample(2.39).localRate,1);assert.equal(c.sample(2.39).local,1.61);
  assert.equal(c.sample(2.39,{side:'left'}).frozen,true);assert.equal(c.sample(2.389999).frozen,true);assert.equal(c.sample(2.390001).frozen,false);
  const at=c.holds[1].start;assert.equal(c.sample(at+Number.EPSILON*2,{side:'left'}).frozen,false);
  assert.equal(c.sample(c.at(1.61)).frozen,false);
  assert.throws(()=>action.clock({to:1,holds:[{at:.5,duration:Number.EPSILON}]}),{path:'action.clock.hold.duration'});
});

test('held poses reuse legacy interpolation and solved IK rather than requested hand coordinates',()=>{
  const a=make();
  for(const local of [-.21,.11,.61,.86,1.23]){
    const s=action.sample(a,local+.3),legacy=poseAt(poses,local);for(const k of ['x','y','fx','fy','lean'])close(s.data.pose[k]??0,legacy[k]??0);
    vec(s.data.joints.handN,skeleton(legacy).joints.handN);
  }
  const far=make({poses:[[0,{fx:90,fy:-90}],[1,{}]],clock:action.clock({to:1})}),s=action.sample(far,0);
  assert(Math.hypot(s.data.joints.handN[0]-90,s.data.joints.handN[1]+90)>50);
  vec(s.anchors.handN.position,s.data.joints.handN.slice(0,2));
});

test('rig anchor chain rule includes root motion, turn, playback rate, scale and reflection exactly once',()=>{
  const a=make({clock:action.clock({from:-.3,to:1.4,rate:1.4}),source:motion.source({position:[line([[-.3,0],[1.4,30]]),-9],rotation:line([[-.3,0],[1.4,.8]])}),scale:1.8,flipX:true});
  const src=action.anchor(a,{joint:'handN',toward:'elbowN',offset:[3,-2]}),t=.41,h=1e-6,q=src.sample(t),lo=src.sample(t-h),hi=src.sample(t+h);
  vec(q.velocity,hi.position.map((v,i)=>(v-lo.position[i])/(2*h)),1e-5);close(q.angularVelocity,(hi.rotation-lo.rotation)/(2*h),1e-5);
  const b=particle.emitter({id:'released',births:[{id:'one',born:t}],transform:src,inheritVelocity:1,initial:{life:.3,velocity:[0,0]}});
  vec(b.births[0].position,q.position);vec(b.births[0].velocity,q.velocity);assert.equal(b.births[0].source.derivative.method,'held-rig-anchor');
});

test('held drawing limits and snap keys declare jumps without fabricating crossing speeds',()=>{
  const a=action.create({id:'pose',clock:action.clock({to:1}),poses:[[0,{fx:0,fy:-25}],[1,{fx:18,fy:-25},'line']]});
  const src=action.anchor(a),t=1/12,left=src.sample(t,{side:'left'}),right=src.sample(t);
  assert.notDeepEqual(left.position,right.position);vec(left.velocity,[0,0]);vec(right.velocity,[0,0]);assert(right.derivative.poseJump.includes('fx'));
  assert.throws(()=>src.sample(t,{side:'error'}),{path:'action.pose'});
  const snap=action.create({id:'snap',clock:action.clock({to:1}),poses:[[0,{x:0}],[.5,{x:20},'snap'],[1,{x:20}]]});
  assert.equal(action.sample(snap,.5,{side:'left'}).position[0],0);assert.equal(action.sample(snap,.5).position[0],20);
  vec(action.anchor(snap).sample(.5).velocity,[0,0]);
});

test('hitstop freezes every attached state while detached particles advance on explicitly retimed playback',()=>{
  const c=action.clock({to:1,holds:[{at:.5,duration:.2}]}),a=action.create({id:'stop',clock:c,poses:[[0,{x:0}],[1,{x:40,fx:18,fy:-24},'line']]}),src=action.anchor(a);
  vec(src.sample(.55).position,src.sample(.65).position);vec(src.sample(.55).velocity,[0,0]);
  assert.deepEqual(action.sample(a,.55).data.pose,action.sample(a,.65).data.pose);
  const births=action.retime(c,[{id:'one',born:.5,end:.9}],{edge:'before'});close(births[0].born,.5);close(births[0].life,.6);
  const e=particle.emitter({id:'flight',births,transform:src,initial:{velocity:[30,0]}});
  assert(particle.sample(e,.65)[0].position[0]>particle.sample(e,.55)[0].position[0]);
  close(action.retime(c,[{id:'a',born:.5,life:.3}])[0].born,.7);close(action.retime(c,[{id:'a',born:.5,life:.3}])[0].life,.3);
});

test('pose-jump metadata follows playback limits: the held step occurs at hold entry, never twice at exit',()=>{
  const c=action.clock({to:1,holds:[{at:.5,duration:.2}]}),a=action.create({id:'step',clock:c,poses:[[0,{}],[1,{fx:18,fy:-25},'line']]});
  assert(action.sample(a,.5).data.poseJump.includes('fx'));
  assert.deepEqual(action.sample(a,.6).data.poseJump,[]);assert.deepEqual(action.sample(a,.7).data.poseJump,[]);
  vec(action.anchor(a).sample(.7,{side:'left'}).position,action.anchor(a).sample(.7).position);
  assert.deepEqual(action.sample(a,0).data.poseJump,[]);assert.equal(c.sample(0).boundary,'range-edge');
});

test('custom character geometry and the stock rig share the same sampled draw and attachment state',()=>{
  const a=make({scale:2,flipX:true}),t=.45,f=createFrame(100,100),p=painterFor(f).place(50,70),s=action.sample(a,t);
  action.draw(p,a,t,{draw:(q,state)=>{assert.deepEqual(state,s);const [x,y]=state.data.joints.handN;q.rect(x-.5,y-.5,1,1,0xffffffff);}});
  const at=s.anchors.handN.position;assert([...f.color].some(Boolean));assert(Math.abs(p.toX(...at)-(50+at[0]))<1e-8);
  const before=p.toX(0,0);action.draw(p,a,t);assert.equal(p.toX(0,0),before);
  assert.throws(()=>action.anchor(a,{joint:'fake'}),{code:'RESOURCE_NOT_FOUND'});
  assert.throws(()=>make({source:{kind:'SourceTrajectory',space:'effect'}}),{code:'CONTRACT_MISMATCH',path:'action.source'});
  assert.throws(()=>action.anchor(a,{joint:'handN',toward:'handN'}).sample(t),{path:'action.anchor.toward'});
});

test('public action discovery, frozen body/source states, replay and same-run export survive draft removal',async()=>{
  const id=`action-test-${randomUUID().slice(0,8)}`,file=join(LAB,'drafts',id+'.js'),runs=[];mkdirSync(join(LAB,'drafts'),{recursive:true});
  writeFileSync(file,`import {action,motion} from '../../../src/authoring/index.js';
export const meta={name:'Action fixture',size:[72,64],origin:[28,55],duration:1.3,loop:false,options:{seed:7}};
export const authoring={ending:'clear'};
const clock=action.clock({to:1,holds:[{at:.5,duration:.2}]});
const hero=action.create({id:'hero',clock,poses:[[0,{x:0}],[1,{x:20,fx:14,fy:-24},'line']],end:1.3,bounds:[-12,-40,44,42]});
const hand=action.anchor(hero);
export function draw(p,t){action.draw(p,hero,t);}
export function observe(t){return {bodies:[action.observe(hero,t)],sources:[motion.observeSource(hand,t,{id:'hand'})]};}`);
  try{
    assert((await invoke('search',{query:'hitstop'})).resources.some(r=>r.ref.id==='core/action'));
    assert.match((await invoke('inspect',{ref:{kind:'operator',id:'core/action'},sections:['contract']})).sections.contract,/action.retime/);
    const r=await invoke('render',{id:'draft/'+id});runs.push(r.run);
    const probe=await invoke('probe',{run:r.run,view:'bodies',at:{times:[.55,.65]},fields:['data','anchors'],sampling:'replay'});
    assert.deepEqual(probe.samples[0].states[0].data.pose,probe.samples[1].states[0].data.pose);assert.equal(probe.samples[0].states[0].data.clock.frozen,true);
    rmSync(file);const child=await invoke('render',{run:r.run});runs.push(child.run);assert.equal(r.sourceDigest,child.sourceDigest);
    const v=await invoke('validate',{run:r.run});assert.equal(v.passed,true);const out=await invoke('export',{run:r.run,validationRef:v.validationRef});assert.equal(out.run,r.run);
    assert.deepEqual(readFileSync(join(out.directory,'combined.png')),readFileSync(join(RECORDS,r.run,'combined.png')));
  }finally{rmSync(file,{force:true});for(const run of runs)rmSync(join(RECORDS,run),{recursive:true,force:true});}
});
