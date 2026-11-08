// Reorderable ordinary JS composition, not a complete copied skill preset.
// Visual parts retain Sprite Fusion energy/slash / Hugo Duprez / MIT sources.
import {skill,body,motion,curve,path,schedule,particle,material,combat} from '../../../src/authoring/index.js';
import {fit} from '../../../src/core/index.js';
export const meta={name:'Skill relay / 可取消技能部件',desc:'One charge is cancelled; a second cast advances a path beam, holds, hits and clears from the source. Timing and visual parts can be replaced independently.',tags:['skill','charge','beam','cancel','技能','蓄力','取消'],size:[256,192],origin:[128,150],duration:4.8,loop:false,options:{seed:13,charge:.65,sustain:.6,palette:['#142d38','#326d75','#70b8a7','#e4c678','#fff5d2','#ffffff']}};
export function events(o){const cue=design(o).casts[1].cue;return {release:skill.at(cue,'advance'),hit:skill.at(cue,'advance',{edge:'end'}),cancel:.4};}
export const authoring={ending:'clear'};
let cached;
function design(o){
  if(cached?.key===JSON.stringify(o))return cached;
  const C=fit(o.palette,8),casts=[['cut',0,.4,-72],['cast',1.3,null,-22]].map(([id,start,cancelAt,y])=>{
    const cue=skill.sequence({id,start,cancelAt,tail:.7,stages:[{id:'gather',duration:o.charge},{id:'advance',duration:.35},{id:'hold',duration:o.sustain},{id:'clear',duration:.25}]});
    const source=motion.source({position:[curve.scalar({input:'scene.seconds',points:[[0,-74],[4.8,-50]]}),y]});
    const region=skill.interval(cue,'gather'),births=skill.retime(cue,'gather',schedule.rate({id:`${id}-in`,start:0,end:o.charge,rate:35}));
    const motes=skill.infall({id:`${id}-motes`,births,source,seed:o.seed,life:[.22,.38],radius:[14,28],endRadius:4,angles:[0,Math.PI*2],material:{opacity:s=>Math.min(1,s.age01*5)*(1-s.age01)}});
    const hitTime=skill.at(cue,'advance',{edge:'end'}),hits=combat.hits({id:`${id}-hits`,events:hitTime===null?[]:[{id:'arrived',target:'seal',time:hitTime,position:[68,y],value:73,direction:[1,0]}]});
    return {id,cue,source,region,motes,hits,numbers:combat.numbers({id:`${id}-labels`,hits,size:.5,life:.9,velocity:[12,-90],acceleration:[0,420]})};
  });
  return cached={key:JSON.stringify(o),C,casts};
}
export function draw(p,t,o){
  const d=design(o);if(t>=4.3)return;
  for(const cast of d.casts){
    const state=skill.sample(cast.cue,t),position=cast.source.sample(t).position;if(state.status==='pending'||state.status==='expired')continue;
    const stage=cast.cue.stages.find(q=>q.id===state.stage),u=state.progress,fade=state.status==='tail'?Math.max(0,1-state.tailAge/.7):1;
    if(state.stage==='gather'){
      skill.orb(p,{position,radius:3+u*3,colors:o.palette,opacity:fade,glow:.1});
      if(state.status==='active')for(let i=0;i<3;i++){const q=((t-stage.start)*3+i/3)%1;skill.chargeRing(p,{position,radius:5+22*(1-q*q),aspect:i===1?.35:1,rotation:i*.6,progress:q,colors:o.palette,glow:0});}
    }
    particle.draw(p,cast.motes,t,{draw:(p,s)=>material.streak(p,s,{tint:d.C[6],glow:.15,maxLength:5})});
    if(!cast.cue.cancelled&&['advance','hold','clear'].includes(state.stage)&&state.status==='active'){
      const route=path.polyline({id:`${cast.id}-beam`,points:[position,[8,position[1]-8],[68,position[1]]]});
      skill.beam(p,route,t,{from:state.stage==='clear'?u:0,to:state.stage==='advance'?u:1,width:10,colors:o.palette,taperHead:10,taperTail:5,glow:.1});
      skill.orb(p,{position:position,radius:3*(state.stage==='clear'?1-u:1),colors:o.palette});
    }
    for(const hit of combat.sample(cast.hits,t,{duration:.24}))combat.impact(p,hit,{colors:[d.C[3],d.C[6],d.C[7]],radius:10,glow:.1});
    combat.drawNumbers(p,cast.numbers,t,{style:{fill:[d.C[3],d.C[5],d.C[7]],outline:d.C[0]}});
  }
}
export function observe(t,o){const d=design(o);return {sources:d.casts.map(c=>motion.observeSource(c.source,t,{id:c.id})),particles:d.casts.flatMap(c=>[particle.observe(c.motes,t),particle.observe(c.numbers,t)])};}
