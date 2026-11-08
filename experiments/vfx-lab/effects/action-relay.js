// Choreography example: replace the artwork freely. Core held timing derives
// from Hollow Crown, MIT, (c) 2026 rehan-remade; original Athanor IK is reused.
import {fit} from '../../../src/core/index.js';
import {action,motion,particle,schedule,material} from '../../../src/authoring/index.js';
export const meta={name:'Action relay',desc:'An original joint-drawn lancer gathers a spark, holds on release, then sends detached motes into flight.',tags:['action','rig','joint','hitstop','动作','挂点'],size:[256,176],origin:[105,139],duration:3.4,loop:false,options:{seed:7,facingLeft:false,palette:['#14243d','#28516b','#50a6b4','#aedccc','#e6a260','#fff1bc']}};
export const authoring={ending:'clear'};
const clock=action.clock({from:-.4,to:2.8,holds:[{at:.8,duration:.16}]}),release=clock.at(.8);
export const events={gather:.4,hold:clock.at(.8,{edge:'before'}),release,recover:clock.at(1.8),clear:3.4};
let cache;
function design(o){
  if(cache?.seed===o.seed&&cache?.flip===o.facingLeft)return cache;
  const hero=action.create({id:'lancer',clock,source:motion.source({position:[-23,0]}),scale:1.45,flipX:!!o.facingLeft,bounds:[-21,-44,52,45],end:3.4,
    poses:[[-.4,{x:-5,fx:-3,fy:-26,bx:4,by:-23}], [.5,{x:0,crouch:4,lean:-2,fx:3,fy:-28,bx:1,by:-27},'out'],[.8,{x:14,crouch:3,lean:5,fx:19,fy:-25,bx:-5,by:-22},'snap'],[1.4,{x:18,crouch:2,lean:3,fx:17,fy:-25},'out'],[2.1,{x:12}],[2.8,{x:12}]]});
  const hand=action.anchor(hero,{joint:'handN',toward:'elbowN',rotation:Math.PI});
  const births=action.retime(clock,schedule.burst({id:'release',at:.8,count:15}));
  const sparks=particle.emitter({id:'cast-sparks',seed:o.seed,births,transform:hand,inheritVelocity:.3,initial:{life:[.45,.8],velocity:({rand})=>[rand('vx',58,105),rand('vy',-20,12)]},motion:{acceleration:[0,35],drag:.8}});
  return cache={seed:o.seed,flip:o.facingLeft,hero,hand,sparks};
}
export function draw(p,t,o){
  if(t>=3.4)return;const d=design(o),C=fit(o.palette,6);
  action.draw(p,d.hero,t,{draw:(q,s)=>{
    const J=s.data.joints;
    // Original body geometry, same local solved joints used by the emitter.
    for(const names of [['hipF','kneeF','ankleF'],['shoulderF','elbowF','handF'],['hipN','kneeN','ankleN'],['shoulderN','elbowN','handN']])for(let i=1;i<names.length;i++){const a=J[names[i-1]],b=J[names[i]];q.beam(a[0],a[1],b[0],b[1],4,C[0]);q.beam(a[0],a[1],b[0],b[1],2,C[2]);}
    const [x,y]=J.chest;q.poly([[x-5,y-3],[x+4,y-3],[J.pelvis[0]+4,J.pelvis[1]+1],[J.pelvis[0]-4,J.pelvis[1]+1]],C[1]);
    q.circle(J.head[0],J.head[1]-1,4,C[0]);q.rect(J.head[0]-2,J.head[1]-2,5,2,C[4]);q.px(J.head[0]+2,J.head[1]-2,C[5]);
  }});
  const at=d.hand.sample(t),g=t<release?Math.max(0,Math.min(1,(t-.3)/.7)):Math.max(0,1-(t-release)/.12);
  if(g>0){p.circle(...at.position,2+g*2,C[4],g);p.circle(...at.position,1.5,C[5],g);p.glow(...at.position,11,C[3],g*.16);}
  particle.draw(p,d.sparks,t,{draw:(q,s)=>material.spark(q,s,{colors:[C[5],C[4],C[2],C[0]],size:1,glow:.04})});
}
export function observe(t,o){const d=design(o);return {bodies:[action.observe(d.hero,t)],sources:[motion.observeSource(d.hand,t,{id:'casting-hand'})],particles:[particle.observe(d.sparks,t)]};}
