// Combat parts compose on freely drawn moving bodies. Pixel word treatment
// and brightness tint reuse Sprite Fusion / Hugo Duprez / MIT adaptations.
import {combat,body,surface,mask,motion,curve,particle,material} from '../../../src/authoring/index.js';
import {fit} from '../../../src/core/index.js';
export const meta={name:'Hit relay / 连续命中',desc:'Two moving mask bodies consume shared normal, critical and blocked hit records. Replace number style, impact or body shading independently.',tags:['combat','damage','critical','hit','block','技能','伤害','暴击'],size:[288,192],origin:[144,150],duration:3.6,loop:false,options:{seed:17,secondHit:1.15,direction:1,palette:['#172239','#456079','#83a8a0','#dcba72','#fff2b4','#ffffff']}};
export function events(o){return Object.fromEntries(design(o).hits.events.map(e=>[e.id==='second'?'release':e.id,e.time]));}
export const authoring={ending:'persistent'};
let cache;
function design(o){
  if(cache?.key===JSON.stringify(o))return cache;
  const targets=Object.fromEntries(['guard','moth'].map((id,i)=>{
    const b=body.create({id,source:motion.source({position:[curve.scalar({input:'scene.seconds',points:[[0,i?55:-65],[3.6,i?24:-28]]}),-28-i*6],rotation:curve.scalar({input:'scene.seconds',points:[[0,-.1],[1.2,.12],[3.6,-.06]]})}),bounds:[-10,-20,20,38],anchors:{hit:[i?-6:8,-7]}});
    const m=mask.make({id:`${id}-skin`,space:`${id}-material`,w:24,h:40,origin:[-12,-22],test:(x,y)=>i?Math.abs(x)<3+9*Math.max(0,1-Math.abs(y)/16):Math.abs(x)<8+(y>-9&&y<4?3:0)&&y<16});
    return [id,{body:b,surface:surface.create({id,mask:m,body:b})}];
  }));
  const hits=combat.hits({id:'duel',events:[{id:'first',target:'guard',time:.6,direction:[o.direction,0],value:27},{id:'second',target:'guard',time:o.secondHit,direction:[o.direction,-.2],value:128,critical:true},{id:'defense',target:'moth',time:1.9,direction:[-1,0],value:'BLOCK',kind:'block'}],resolve:e=>body.anchor(targets[e.target].body,{name:'hit'}).sample(e.time)});
  const numbers=combat.numbers({id:'numbers',hits,size:e=>e.critical?.75:.55,velocity:e=>[e.direction[0]*22,-120],acceleration:[0,560],text:e=>e.kind==='block'?'BLOCK':String(e.value)});
  const sparks=particle.emitter({id:'sparks',seed:o.seed,births:combat.births(hits,{id:'sparks',count:e=>e.kind==='block'?5:9,life:.36}),initial:{velocity:({birth,rand})=>[birth.hit.direction[0]*rand('speed',28,65)+rand('spread',-30,30),rand('lift',-42,8)]},motion:{acceleration:[0,120],drag:1}});
  return cache={key:JSON.stringify(o),targets,hits,numbers,sparks};
}
export function draw(p,t,o){
  const d=design(o),C=fit(o.palette,6);
  for(const [id,target]of Object.entries(d.targets)){
    const feedback=combat.sample(d.hits,t,{target:id});
    surface.draw(p,target.surface,t,{shade:s=>combat.tint(Math.abs(s.position[0])>7?C[0]:s.position[1]<-7?C[3]:C[1],feedback.filter(h=>h.kind!=='block'),{ramp:[C[1],C[3],C[4]]})});
  }
  for(const hit of combat.sample(d.hits,t,{duration:.28}))combat.impact(p,hit,{radius:hit.critical?17:10,colors:hit.kind==='block'?[C[1],C[2],C[5]]:[C[3],C[4],C[5]],glow:.25});
  particle.draw(p,d.sparks,t,{draw:(p,s)=>material.spark(p,s,{colors:[C[0],C[3],C[4],C[5]],glow:.2})});
  combat.drawNumbers(p,d.numbers,t,{style:s=>({fill:s.data.hit.kind==='block'?[C[1],C[2],C[4]]:[C[3],C[4],C[5]],outline:C[0],edge:C[5]})});
}
export function observe(t,o){const d=design(o);return {bodies:Object.values(d.targets).map(target=>surface.observe(target.surface,t)),particles:[particle.observe(d.numbers,t),particle.observe(d.sparks,t)]};}
