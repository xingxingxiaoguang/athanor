// Detonation support adapted directly from Athanor explosions/grenade.js.
// Original Sprite Fusion explosion, MIT, Copyright (c) 2026 Hugo Duprez.
// Retains native Particles/Bits/Lights physics, grenade burst counts,
// lifetimes, flare, air ring, depth-split ground band, scorch and floor light.
// Main FIRE/round SMOKE are supplied instead by SUNBREAK/DRIFT.
import {Particles,Bits,Lights,P,PF,B,Rng,fit,band,flare,smooth,ease,TAU,WHITE,hex,mix} from '../../../core/index.js';
import {fireRamp,heatRamp,scorch,pool,cull,fadeEdges} from '../../explosions/_lib.js';

const F=fit(['#4a1712','#c9281f','#f2561d','#ff8a2a','#ffc23d','#ffe26b','#fff3a6','#ffffff'],8);
const FR=fireRamp(F),HR=heatRamp(FR),DUST=hex('#7d7280');
const METAL=['#3a3c46','#6a6e7c','#a8acb8'].map(hex);
const caches=new Map(),HZ=120,DT=1/HZ;
function snapshot(s){return {time:s.ps.t,ps:s.ps.list.map(x=>({...x})),bits:s.bits.list.map(x=>({...x})),lights:s.lights.list.map(x=>({...x}))};}
function make(seed){
  const R=new Rng(seed),ground=()=>0;
  const s={R,ps:new Particles({rng:R,ground,sparks:[F[6],F[5],F[3],F[2]]}),bits:new Bits({ground}),lights:new Lights(),step:0,frames:[]};
  const {ps,bits,lights}=s,y=-5;
  lights.add(0,y-10,70,mix(F[3],F[6],.45),.85,.5);
  lights.add(0,y,30,WHITE,.7,.07);
  for(let i=0;i<38;i++){
    const a=R.range(-Math.PI+.04,-.04),sp=R.range(380,640);
    ps.spawn(P.MOTE,0,y,Math.cos(a)*sp,Math.sin(a)*sp,R.range(.12,.26),R.pick([F[7],F[6],F[5]]),R.range(.6,.9),0,i%3?PF.BACK:0);
  }
  for(let i=0;i<60;i++){
    const a=R.range(0,TAU),sp=R.range(140,360);
    ps.spawn(P.SPARK,0,y,Math.cos(a)*sp,Math.sin(a)*sp-60,R.range(.2,.55),0,1,0,i%3?PF.BACK:0);
  }
  for(let i=0;i<30;i++){
    const a=R.range(0,TAU),sp=R.range(30,120);
    ps.spawn(P.EMBER,0,y,Math.cos(a)*sp,Math.sin(a)*sp-50,R.range(.8,1.8),F[3]);
  }
  for(let i=0;i<12;i++){
    const a=R.range(-Math.PI+.2,-.2),sp=R.range(150,330);
    bits.add({kind:B.SHARD,x:0,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,g:1,drag:.5,bounce:.3,life:R.range(1.4,2.1),a:R.range(0,TAU),va:R.range(-24,24),s:R.range(2,3.5),c:R.pick(METAL)});
  }
  for(let i=0;i<70;i++){
    const u=R.range(-1,1),a=-Math.PI/2+u*.8,sp=R.range(100,300)*(1-.4*Math.abs(u));
    ps.spawn(P.GRIT,u*4,-1,Math.cos(a)*sp,Math.sin(a)*sp,R.range(1,1.8),R.pick(['#5a4f6b','#3e3650','#776c88'].map(hex)),R.chance(.35)?2:1);
  }
  for(let i=0;i<10;i++){
    const sign=R.sign();
    ps.spawn(P.SMOKE,sign*R.range(0,6),-R.range(1,4),sign*R.range(60,180),-R.range(2,10),R.range(1,1.7),DUST,R.range(5,8),R.range(0,.05),PF.BIG);
  }
  s.frames.push(snapshot(s));return s;
}
function stateAt(t,seed){
  if(!caches.has(seed))caches.set(seed,make(seed));
  const s=caches.get(seed),index=Math.floor(Math.max(0,t)*HZ+1e-7);
  while(s.step<index){
    s.bits.update(DT);
    for(let i=s.bits.list.length-1;i>=0;i--){const b=s.bits.list[i];if(b.x < -154||b.x>154||b.y < -208)s.bits.list.splice(i,1);}
    s.ps.update(DT);cull(s.ps,-157,-211,157,71);fadeEdges(s.ps,-157,157,24,71);s.lights.update(DT);
    s.step++;s.frames.push(snapshot(s));
  }
  return {s,frame:s.frames[index]};
}
function dust(p,list){
  // Keep grenade's dust motion/lifetime. Replace round dust sprites with
  // short, stepped sheets so the approved smoke never regresses to puff balls.
  for(const q of list){
    if(q.k!==P.SMOKE||q.delay>0)continue;
    const age=1-q.life/q.max,r=q.size*(.65+age*.9),a=Math.min(1,age*12)*Math.min(1,q.life/q.max*2.4)*.45;
    const x=q.x,y=q.y,w=r*1.5,h=r*.55;
    p.poly([[x-w,y],[x-w*.7,y-h*.7],[x-w*.2,y-h],[x+w*.35,y-h*.8],[x+w,y],[x+w*.6,y+h*.4],[x-w*.5,y+h*.35]],DUST,a);
  }
}
export function drawSupport(p,t,o,layer){
  const {s,frame}=stateAt(t,o.auxSeed??6),ps=Object.create(s.ps),bits=Object.create(s.bits),lights=Object.create(s.lights);
  ps.t=frame.time;ps.list=frame.ps.filter(q=>q.k!==P.SMOKE);bits.list=frame.bits;lights.list=frame.lights;
  const k=t/.4,ringScale=1.6;
  if(layer==='back'){
    scorch(p,HR,t,32,1.6,1-smooth(1.8,2.45,t),2);
    if(t<.3){
      const k3=t/.3,e=1-Math.pow(1-k3,3),r=(8+40*e)*2.5;
      band(p,0,-6,r,1.4,Math.max(1,2.5*(1-k3)+.4),Math.min(1,(1-k3)*1.6),[F[4],F[5],F[5],F[5]],a=>Math.sin(a)<.045);
    }
    if(k<1)band(p,0,.5,70*ringScale*ease.outCubic(k),.16,Math.max(1,3.5*(1-k)),1.15-k,['#4a3f69','#6e6390',F[3],F[6]],a=>Math.sin(a)<0);
    dust(p,frame.ps);ps.draw(p,'back');return;
  }
  if(k<1)band(p,0,.5,70*ringScale*ease.outCubic(k),.16,Math.max(1,3.5*(1-k)),1.15-k,['#4a3f69','#6e6390',F[3],F[6]],a=>Math.sin(a)>=0);
  bits.draw(p);ps.draw(p,'front');
  if(t<.07){
    const k2=1-t/.07,r=11*(.8+.2*k2);
    p.circle(0,-6,r+1.2,F[2]);p.circle(0,-6,r,k2>.45?F[6]:F[5]);p.circle(0,-6,r*.6,k2>.45?WHITE:F[6]);
  }
  if(t<.2)flare(p,0,-6,40*Math.pow(1-t/.2,1.4),1-t/.2,F);
  pool(p,0,1,100,12,F[3],.55*Math.max(0,1-t/.6));lights.draw(p);
}

// Retained editable artwork; technical checks do not imply final art approval.
export const asset={status:"study",source:"experiments/vfx-lab/productions/2026-11-08-fireball-grenade/grenade-support.js",revision:"f207224ec08573ec71c8832c657ebd5ff1d998e9"};
