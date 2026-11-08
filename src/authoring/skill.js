// Open timing and visual parts, not a fixed skill grammar. Timing extracts
// core/chain's cue offsets; pure intervals avoid its stateful update overshoot.
// Slash directly reuses melee/_lib (Sprite Fusion slash / MIT / Hugo Duprez).
// Beam bands/strands and inward rings/spirals adapt arcane-beam/spell-charge
// (Sprite Fusion energy / MIT / (c) 2026 Hugo Duprez). Old presets stay intact.
import {swing as legacySwing,smear as legacySmear,slash as legacySlash,onSwing,slashEnd} from '../fx/melee/_lib.js';
import {fit} from '../core/color.js';
import {identity,finite,positive,point,count,color,alpha,choice,fail} from './contract.js';
import * as path from './path.js';
import * as particle from './particle.js';
import * as random from './random.js';
import {stroke} from './strip.js';

const TAU=Math.PI*2,clamp=x=>Math.max(0,Math.min(1,x));
// Add the author's decimal seconds without accumulating binary sum noise.
// No fixed precision/rounding grid: even exponent-form tiny offsets survive
// whenever the resulting Number can represent the interval.
function seconds(...values) {
  const parts=values.map(value=>{finite(value,'skill.seconds');const [digits,e='0']=String(value).split('e'),[whole,fraction='']=digits.split('.');return {n:BigInt(whole+fraction),scale:fraction.length-Number(e)};});
  const scale=Math.max(0,...parts.map(p=>p.scale)),n=parts.reduce((sum,p)=>sum+p.n*10n**BigInt(scale-p.scale),0n);
  return finite(Number(`${n}e-${scale}`),'skill.seconds');
}
const palette=colors=>{if(!Array.isArray(colors)||!colors.length)fail('skill.colors','provide a dark-to-light ramp');return fit(colors.map(c=>color(c)),8);};
const requireSequence=s=>{if(s?.kind!=='SkillSequence')fail('skill.sequence','expected skill.sequence()');return s;};
const stageOf=(s,id)=>{const stage=requireSequence(s).stages.find(q=>q.id===String(id));if(!stage)fail('skill.stage',`unknown stage '${id}'`,'RESOURCE_NOT_FOUND');return stage;};

/** Names/order/durations are free ordinary data. No compulsory charge/fire
 * phases. stop closes emission; existing detached lives are never truncated. */
export function sequence({id,start=0,stages,cancelAt=null,tail=0}={}) {
  identity(id,'skill.sequence.id');positive(start,'skill.sequence.start',true);positive(tail,'skill.sequence.tail',true);
  if(!Array.isArray(stages)||!stages.length)fail('skill.sequence.stages','provide named positive-duration stages');
  count(stages.length,'skill.sequence.stages',128);if(cancelAt!==null)positive(cancelAt,'skill.sequence.cancelAt',true);
  const ids=new Set();let cursor=start;
  const timed=stages.map(stage=>{identity(stage.id,'skill.stage.id');if(ids.has(String(stage.id)))fail('skill.stage.id','duplicate stage');ids.add(String(stage.id));positive(stage.duration,'skill.stage.duration');
    const end=seconds(cursor,stage.duration);if(end<=cursor)fail('skill.stage.duration','duration is below the representable interval at this start time');
    const q=Object.freeze({id:String(stage.id),start:cursor,end,duration:stage.duration});cursor=q.end;return q;});
  const stop=cancelAt===null?cursor:Math.min(cursor,cancelAt);
  return Object.freeze({kind:'SkillSequence',id,start,end:cursor,stop,tailEnd:seconds(stop,tail),cancelAt,cancelled:cancelAt!==null&&cancelAt<cursor,stages:Object.freeze(timed)});
}
export function interval(s,id) {
  const stage=stageOf(s,id),end=Math.max(stage.start,Math.min(stage.end,s.stop));
  return {...stage,end,plannedEnd:stage.end,emits:end>stage.start,cancelled:s.cancelled&&s.stop<stage.end};
}
export function at(s,id,{edge='start',offset=0}={}) {
  const q=stageOf(s,id);choice(edge,['start','end'],'skill.at.edge');finite(offset,'skill.at.offset');const t=seconds(q[edge],offset);
  return t<s.start||t>s.stop||(s.cancelled&&t>=s.stop)||q.start>=s.stop?null:t;
}
export function sample(s,time) {
  requireSequence(s);finite(time,'skill.sample.time');const status=time<Math.min(s.start,s.stop)?'pending':time>=s.start&&time<s.stop?'active':time<s.tailEnd?'tail':'expired';
  const effectiveTime=Math.max(s.start,Math.min(time,s.stop)),atCut=s.cancelled&&effectiveTime===s.stop,q=(atCut?s.stages.find(q=>effectiveTime>q.start&&effectiveTime<=q.end):s.stages.find(q=>effectiveTime>=q.start&&effectiveTime<q.end))??(s.stop<=s.start?s.stages[0]:s.stages.at(-1));
  return {id:s.id,time,status,stage:q.id,localTime:effectiveTime-q.start,progress:clamp((effectiveTime-q.start)/q.duration),effectiveTime,emitting:status==='active',cancelled:s.cancelled,stop:s.stop,tailAge:Math.max(0,time-s.stop)};
}
export function retime(s,id,births,{offset=0}={}) {
  const q=interval(s,id);finite(offset,'skill.retime.offset');if(!Array.isArray(births))fail('skill.retime.births','provide local birth records');
  return births.map(b=>({...b,id:`${s.id}/${id}/${b.id}`,randomId:b.randomId??b.id,born:seconds(q.start,finite(b.born,'skill.retime.born'),offset)})).filter(b=>b.born>=q.start&&b.born<q.end);
}

/** Mature cone/ellipse crescent remains available alongside arbitrary path
 * strips. smear allows replacing the entire material/width inside the band. */
export function swing(options={}) {
  const s=legacySwing(options);positive(s.R,'skill.swing.R');positive(s.sy,'skill.swing.sy');finite(s.k,'skill.swing.k');
  if(Math.abs(s.k)>=s.sy)fail('skill.swing.k','cone magnitude must remain below aspect sy');
  for(const key of ['cx','cy','rot','a0','dir'])finite(s[key],`skill.swing.${key}`);
  if(![1,-1].includes(s.dir))fail('skill.swing.dir','expected -1 or 1');return s;
}
export {onSwing,slashEnd};
export function smear(p,s,from,to,width,shader,half=0){return legacySmear(p,s,from,to,width,shader,half);}
export function slash(p,s,time,{half=0,glow=1}={}) {
  finite(time,'skill.slash.time');positive(glow,'skill.slash.glow',true);choice(half,[-1,0,1],'skill.slash.half');
  const q=swing(s);for(const k of ['sweep','trail','W','span'])positive(q[k],`skill.slash.${k}`);positive(q.hold??0,'skill.slash.hold',true);finite(q.t0??0,'skill.slash.t0');
  const previous=p.lightK;try{p.lightK*=glow;legacySlash(p,{...q,hold:q.hold??0,t0:q.t0??0,ramp:palette(q.ramp)},time,half);}finally{p.lightK=previous;}
}

/** Arcane beam's transverse bands and moving near-side filaments, generalized
 * onto any existing Path. Head/tail/profile/shader can change independently. */
export function beam(p,route,time,{from=0,to=1,width=12,colors=['#24183d','#69499c','#af8ede','#fff'],profile,shade,opacity=1,glow=.2,strands=3,taperHead=0,taperTail=0}={}) {
  finite(time,'skill.beam.time');alpha(opacity,'skill.beam.opacity');positive(glow,'skill.beam.glow',true);count(strands,'skill.beam.strands',32);positive(taperHead,'skill.beam.taperHead',true);positive(taperTail,'skill.beam.taperTail',true);
  const C=palette(colors),LV=[C[7],C[6],C[5],C[4],C[3],C[2]],L=route.lengthPx;
  const breadth=s=>{const d=s*L,base=typeof width==='function'?width(s):width;
    const k=profile?profile(s):clamp(Math.min(1,taperHead?(to-s)*L/taperHead:1,taperTail?(s-from)*L/taperTail:1));
    return positive(base,'skill.beam.width',true)*positive(k,'skill.beam.profile',true)*(1+.12*Math.sin(d*.35-time/1.2*TAU*8));};
  const paint=(s,across)=>{
    const d=s*L,q=Math.abs(across)*1.3,pulse=((d*.025-time/1.2*4)%1+1)%1<.07?1:0;
    let level=q<.2?0:q<.4?1:q<.62?2:q<.85?3:q<1?4:5;level=Math.max(0,level-pulse);
    let base=LV[level];
    for(let i=0;i<strands;i++){const a=d*.17-time/1.2*TAU*6+i*TAU/strands;if(Math.cos(a)>-.15&&Math.abs(across-Math.sin(a)*1.05/1.3)<.09){base=Math.cos(a)>.55?C[7]:C[6];break;}}
    return shade?shade({s,across,time,distancePx:d,color:base}):base;
  };
  const points=path.resample(route,{from,to,spacingPx:1}).map(q=>({...q,width:breadth(q.s)*1.3}));
  const result=stroke(p,points,{width:q=>q.width,shade:({a,b,u,across},out)=>{
    const s=a.s+(b.s-a.s)*u,painted=paint(s,across);if(painted===null)return;
    const q=typeof painted==='object'?painted:{color:painted};out.c=color(q.color,'skill.beam.shade.color');
    out.a=opacity*alpha(q.alpha??(Math.abs(across)<1/1.3?1:clamp((1.3-Math.abs(across)*1.3)/.3)),'skill.beam.shade.alpha');
    if(q.light!==undefined){out.l=color(q.light,'skill.beam.shade.light');out.k=positive(q.lightStrength??1,'skill.beam.shade.lightStrength',true);}
  }});
  if(glow&&to>from)for(const q of path.resample(route,{from,to,spacingPx:6}))p.glow(...q.position,breadth(q.s)+4,C[5],glow*opacity);
  return {...result,head:path.sample(route,to),tail:path.sample(route,from)};
}

/** Standalone layered charge core; no automatically attached rays/particles. */
export function orb(p,{position=[0,0],radius=6,colors=['#24183d','#69499c','#af8ede','#fff'],opacity=1,glow=0}={}) {
  point(position,'skill.orb.position');positive(radius,'skill.orb.radius',true);alpha(opacity,'skill.orb.opacity');positive(glow,'skill.orb.glow',true);const C=palette(colors),[x,y]=position;
  if(!radius||!opacity)return;
  p.circle(x,y,radius+1.3,C[4],opacity);p.circle(x,y,radius+.3,C[5],opacity);p.circle(x-radius*.12,y-radius*.12,radius*.8,C[6],opacity);p.circle(x,y,radius*.5,C[7],opacity);if(glow)p.glow(x,y,radius*4,C[5],glow*opacity);
}
export function chargeRing(p,{position=[0,0],radius=24,aspect=1,rotation=0,progress=1,colors=['#24183d','#69499c','#af8ede','#fff'],glow=.12}={}) {
  point(position,'skill.chargeRing.position');positive(radius,'skill.chargeRing.radius',true);positive(aspect,'skill.chargeRing.aspect',true);finite(rotation,'skill.chargeRing.rotation');alpha(progress,'skill.chargeRing.progress');positive(glow,'skill.chargeRing.glow',true);
  const C=palette(colors),n=Math.ceil(radius*TAU*1.4),c=Math.cos(rotation),s=Math.sin(rotation),col=C[progress>.85?7:progress>.55?6:5],opacity=Math.min(1,progress*3);
  for(let j=0;j<n;j++){const g=j/n*TAU,lx=Math.cos(g)*radius,ly=Math.sin(g)*radius*aspect,x=position[0]+lx*c-ly*s,y=position[1]+lx*s+ly*c;p.dot(x,y,col,opacity);if(j%10===0&&glow)p.glow(x,y,5,C[5],glow*opacity);}
}

/** Spell-charge's inward quadratic spiral with analytic relative velocity.
 * It follows the supplied source; use its ordinary Emitter to draw any mark. */
export function infall({id,births,source,seed=1,life=[.2,.34],radius=[20,52],endRadius=6,angles=[0,TAU],spin=[.6,1.3],aspect=1,material={}}={}) {
  if(source?.kind!=='SourceTrajectory'||source.space!=='effect')fail('skill.infall.source','provide an effect-space source trajectory');
  point(radius,'skill.infall.radius');point(angles,'skill.infall.angles');point(spin,'skill.infall.spin');positive(endRadius,'skill.infall.endRadius',true);positive(aspect,'skill.infall.aspect',true);
  if(radius[0]<0||radius[1]<radius[0]||spin[1]<spin[0])fail('skill.infall.range','use ascending radius/spin ranges');
  if(!Array.isArray(births))fail('skill.infall.births','provide birth records');
  const positioned=births.map(b=>{const key={seed,layer:id,id:b.randomId??b.id},a=random.range({...key,channel:'angle'},...angles),r=random.range({...key,channel:'radius'},...radius),turn=random.range({...key,channel:'spin'},...spin);
    return {...b,position:[Math.cos(a)*r,Math.sin(a)*r*aspect],infall:{a,r,spin:turn}};});
  return particle.emitter({id,births:positioned,seed,transform:source,inheritVelocity:1,initial:{life,data:({birth})=>birth.data??birth.infall},motion:{trajectory(s){
    const c=source.sample(s.time),q=s.age01,a=s.birth.infall.a+s.birth.infall.spin*q*q,r=s.birth.infall.r+(endRadius-s.birth.infall.r)*q*q,da=2*s.birth.infall.spin*q/s.life,dr=2*(endRadius-s.birth.infall.r)*q/s.life;
    const x=Math.cos(a)*r,y=Math.sin(a)*r*aspect,vx=Math.cos(a)*dr-Math.sin(a)*r*da,vy=(Math.sin(a)*dr+Math.cos(a)*r*da)*aspect,cs=Math.cos(c.rotation),sn=Math.sin(c.rotation),rx=x*cs-y*sn,ry=x*sn+y*cs;
    return {position:[c.position[0]+rx,c.position[1]+ry],velocity:[c.velocity[0]+vx*cs-vy*sn-c.angularVelocity*ry,c.velocity[1]+vx*sn+vy*cs+c.angularVelocity*rx]};
  }},material});
}
