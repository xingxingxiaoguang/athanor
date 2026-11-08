// Original engine-neutral cutouts. Optional parts compose in ordinary JS;
// no target actor, game rules or automatic art direction is baked here.
import {combat,skill,particle,schedule,motion,material} from '../../../src/authoring/index.js';
import {hex,fit} from '../../../src/core/index.js';
export const colors=['#132e3c','#306776','#66b8a5','#c8e3ac','#fff4ce'];
export const base={size:[112,112],origin:[56,70],duration:1.6,loop:false,options:{seed:17}};
export function hitParts(o){const hits=combat.hits({id:'hit',events:[{id:'game-hit',target:'external',time:0,position:[0,0],value:o.value??32,critical:!!o.critical,direction:[1,-.2]}]});return {hits,numbers:combat.numbers({id:'labels',hits,size:.7,life:.9}),chips:particle.emitter({id:'hit-chips',births:combat.births(hits,{count:9,life:.55}),seed:o.seed,initial:{velocity:({rand})=>[rand('vx',-45,70),rand('vy',-75,-15)]},motion:{acceleration:[0,180]},material:{opacity:s=>1-s.age01}})};}
export function hitDraw(p,t,o,d){for(const h of combat.sample(d.hits,t))combat.impact(p,h,{duration:.18,radius:14,colors});combat.drawNumbers(p,d.numbers,t,{style:{fill:colors.slice(2),edge:colors[4],under:colors[1],outline:colors[0],shadow:colors[0]}});particle.draw(p,d.chips,t,{draw:(p,s)=>material.spark(p,s,{colors,glow:.12})});}
export function flow(o){return skill.sequence({id:'cast',start:0,stages:[{id:'charge',duration:.5},{id:'slash',duration:.25},{id:'tail',duration:.35}],cancelAt:o.cancelAt??null,tail:.4});}
export function skillParts(o){const sequence=flow(o),born=schedule.burst({id:'infall',at:.05,count:15}).map((b,i)=>({...b,born:.05+i*.025}));return {sequence,motes:skill.infall({id:'charge-motes',births:skill.retime(sequence,'charge',born),source:motion.source(),seed:o.seed,life:.22,radius:[15,34],endRadius:2})};}
export function skillDraw(p,t,o,d){const s=skill.sample(d.sequence,t),C=fit(colors,5);if(s.stage==='charge'&&s.emitting){skill.chargeRing(p,{position:[0,0],radius:18*(1-s.progress)+3,colors,opacity:1});skill.orb(p,{position:[0,0],radius:3+2*s.progress,colors});}
 const interval=skill.interval(d.sequence,'slash');if(interval?.emits&&t>=interval.start&&t<1.1){skill.slash(p,{cx:0,cy:0,R:29,sy:.6,a0:-2.6,dir:1,span:3.4,W:4,sweep:.18,hold:.05,trail:.35,t0:interval.start,ramp:colors},t);}
 particle.draw(p,d.motes,t,{draw:(p,s)=>{p.px(...s.position,C[4]);p.light(...s.position,C[3],.15);}});}
export function ring(p,t,{out=false}={}){const C=colors.map(hex),u=out?Math.max(0,1-t/.6):1,phase=out?0:t*Math.PI;
 if(u<=0)return;for(let i=0;i<6;i++){const a=phase+i*Math.PI/3,x=Math.cos(a)*(21+(1-u)*9),y=Math.sin(a)*8-14;p.line(x-2,y,x+2,y,C[2],u);p.px(x,y-1,C[4],u);p.light(x,y,C[2],.18*u);}}
