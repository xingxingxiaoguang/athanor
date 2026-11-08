// Presentation lifecycles only: the game supplies apply/refresh/remove facts.
// Extracts the separation of attached body material, cyclic ring/motes and
// released smoke/embers from status/burning, poisoned, stunned and holy/heal.
// Stable births reuse schedule/particle conventions, not legacy global stop().
// Optional flame drawing directly reuses status/_lib.tongue / tnoise:
// Sprite Fusion fire / MIT / (c) 2026 Hugo Duprez.
import {tongue,tnoise} from '../fx/status/_lib.js';
import {fit,mix,luma} from '../core/color.js';
import {identity,finite,positive,count,choice,color,alpha,fail} from './contract.js';
import * as body from './body.js';

const clamp=x=>Math.max(0,Math.min(1,x));
function payload(value,seen=new Set()) {
  if(value===null||['string','boolean'].includes(typeof value))return value;
  if(typeof value==='number')return finite(value,'status.data');
  if(!value||seen.has(value)||(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype))fail('status.data','provide acyclic finite plain JSON');
  seen.add(value);const result=Array.isArray(value)?value.map(v=>payload(v,seen)):Object.fromEntries(Object.entries(value).map(([k,v])=>[k,payload(v,seen)]));seen.delete(value);return result;
}
const requireLife=l=>{if(l?.kind!=='StatusLifecycle')fail('status.lifecycle','expected status.lifecycle()');return l;};
const endOf=i=>i.end===null?Infinity:i.end;
const until=(event,previous=null)=>event.duration===null?null:event.duration===undefined?previous:finite(event.time+positive(event.duration,'status.event.duration'),'status.event.end');

/** Explicit presentation events; no stacks, damage ticks or buff decisions. */
export function lifecycle({id,target,events,fadeIn=.15,fadeOut=.3}={}) {
  identity(id,'status.id');identity(target,'status.target');positive(fadeIn,'status.fadeIn',true);positive(fadeOut,'status.fadeOut',true);
  if(!Array.isArray(events))fail('status.events','provide external status facts');count(events.length,'status.events');const ids=new Set();
  const facts=events.map(e=>{
    identity(e.id,'status.event.id');if(ids.has(String(e.id)))fail('status.event.id','duplicate event');ids.add(String(e.id));positive(e.time,'status.event.time',true);choice(e.action,['apply','refresh','remove'],'status.event.action');
    if(e.duration!==undefined&&e.duration!==null)positive(e.duration,'status.event.duration');if(e.strength!==undefined)positive(e.strength,'status.event.strength',true);
    if(e.phase!==undefined)choice(e.phase,['preserve','restart'],'status.event.phase');finite(e.order??0,'status.event.order');
    return {id:String(e.id),time:e.time,action:e.action,order:e.order??0,...(e.duration!==undefined?{duration:e.duration}:{}),...(e.strength!==undefined?{strength:e.strength}:{}),...(e.phase!==undefined?{phase:e.phase}:{}),...(e.data!==undefined?{data:payload(e.data)}:{})};
  }).sort((a,b)=>a.time-b.time||a.order-b.order||a.id.localeCompare(b.id));
  const instances=[];let current=null;
  for(const e of facts){
    if(current&&endOf(current)<=e.time)current=null;
    if(e.action==='remove'){if(current){current.end=e.time;current.releaseEvent=e.id;current=null;}continue;}
    if(e.action==='apply'){
      if(current){current.end=e.time;current.releaseEvent=e.id;}
      current={id:`${id}/${encodeURIComponent(e.id)}`,born:e.time,end:until(e),releaseEvent:null,segments:[{event:e.id,time:e.time,strength:e.strength??1,phaseOrigin:e.time,phaseId:e.id,data:e.data??null}]};instances.push(current);
    }else{
      if(!current)fail('status.refresh',`refresh '${e.id}' has no active presentation; supply apply or a refresh before expiry`);
      const prev=current.segments.at(-1);current.end=until(e,current.end);
      current.segments.push({event:e.id,time:e.time,strength:e.strength??prev.strength,phaseOrigin:e.phase==='restart'?e.time:prev.phaseOrigin,phaseId:e.phase==='restart'?e.id:prev.phaseId,data:e.data??prev.data});
    }
  }
  const result={kind:'StatusLifecycle',id:String(id),target:String(target),fadeIn,fadeOut,events:facts,instances};
  // No mutable consumption cursor; every read is reconstructed from facts.
  const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};return freeze(result);
}
function stateAt(l,i,time) {
  const end=endOf(i);if(time<i.born||time>=end+l.fadeOut)return null;
  const segment=i.segments.filter(s=>s.time<=Math.min(time,end)).at(-1),age=time-i.born,releaseAge=time>=end?time-end:null;
  return {id:i.id,target:l.target,status:time<end?'active':'tail',born:i.born,end:i.end,event:segment.event,releaseEvent:i.releaseEvent,age,phaseTime:time-segment.phaseOrigin,phaseOrigin:segment.phaseOrigin,phaseId:segment.phaseId,strength:segment.strength,data:segment.data,emitting:time<end,releaseAge,
    opacity:(l.fadeIn?clamp(age/l.fadeIn):1)*(releaseAge===null?1:l.fadeOut?clamp(1-releaseAge/l.fadeOut):0)};
}
export function sample(l,time) {
  requireLife(l);finite(time,'status.sample.time');const instances=l.instances.map(i=>stateAt(l,i,time)).filter(Boolean);
  return {id:l.id,target:l.target,time,active:instances.find(i=>i.status==='active')??null,tails:instances.filter(i=>i.status==='tail'),instances};
}
export function phase(state,period) {
  positive(period,'status.phase.period');finite(state.phaseTime,'status.phase.time');const cycle=Math.floor(state.phaseTime/period);
  return {cycle,seconds:state.phaseTime-cycle*period,progress:(state.phaseTime-cycle*period)/period};
}

/** Fixed birth lattice per explicit phase restart. Refreshing strength/expiry
 * with preserved phase does not reset IDs or resend births. Life stays free. */
export function births(l,{id=l?.id,rate,from=0,to,life=1}={}) {
  requireLife(l);identity(id,'status.births.id');positive(rate,'status.births.rate');positive(from,'status.births.from',true);positive(to,'status.births.to',true);if(to<from)fail('status.births.window','to must be >= from');
  const out=[];
  for(const instance of l.instances)for(let j=0;j<instance.segments.length;j++){
    const seg=instance.segments[j],lo=Math.max(from,seg.time),hi=Math.min(to,endOf(instance),instance.segments[j+1]?.time??Infinity);
    const first=Math.max(0,Math.ceil((lo-seg.phaseOrigin)*rate-1e-9)),last=Math.ceil((hi-seg.phaseOrigin)*rate-1e-9);
    for(let k=first;k<last;k++){
      const born=seg.phaseOrigin+k/rate;if(born<lo||born>=hi)continue;count(out.length+1,'status.births.total');
      const statusEffect={lifecycle:l.id,target:l.target,instance:instance.id,event:seg.event,phaseId:seg.phaseId,phaseOrigin:seg.phaseOrigin,phaseTime:born-seg.phaseOrigin,strength:seg.strength,data:seg.data};
      const duration=positive(typeof life==='function'?life({born,...statusEffect}):life,'status.births.life');
      out.push({id:`${id}/${encodeURIComponent(instance.id)}/${encodeURIComponent(seg.phaseId)}/${k}`,born,life:duration,statusEffect});
    }
  }
  return out;
}

/** Optional state channel on the actual drawn body, not invisible particles.
 * Use the returned Body in surface/body drawing and body.observe as usual. */
export function bind(subject,lifecycles) {
  if(subject?.kind!=='Body')fail('status.bind.body','provide the actual program/action body');
  const list=Array.isArray(lifecycles)?lifecycles:[lifecycles],ids=new Set();for(const l of list){requireLife(l);if(ids.has(l.id))fail('status.bind.id','duplicate lifecycle');ids.add(l.id);}
  return {kind:'Body',id:subject.id,space:'effect',sample(time,options={}){
    const q=body.sample(subject,time,options);return {...q,data:options.data===false?null:{target:q.data,statuses:Object.fromEntries(list.map(l=>[l.id,sample(l,time)]))}};
  }};
}

/** Optional brightness/material treatment; no required palette or tick flash.
 * pixel.position stays in the existing surface's material coordinates. */
export function heat(base,pixel,state,{colors=['#491712','#c9281f','#ffc23d','#fff3a6'],period=.6,amount=.6}={}) {
  const original=color(base);if(!state)return original;positive(period,'status.heat.period');alpha(amount,'status.heat.amount');
  if(!Array.isArray(colors)||colors.length<2)fail('status.heat.colors','provide a dark-to-light ramp');
  const C=fit(colors.map(c=>color(c)),8),wave=.5+.5*tnoise(state.phaseTime,period,3,1,pixel.position[1]*.15),lit=luma(original),tint=C[Math.min(7,Math.round(lit*5+wave*2))];
  return mix(original,tint,clamp(amount*state.opacity*state.strength));
}
export function flame(p,{position,height=5,width=1.2,lean=0,time=0,period=1.2,seed=1,colors=['#491712','#c9281f','#ffc23d','#fff3a6'],opacity=1}={}) {
  if(!Array.isArray(position)||position.length!==2)fail('status.flame.position','provide [x,y]');position.forEach(v=>finite(v,'status.flame.position'));positive(height,'status.flame.height',true);positive(width,'status.flame.width');finite(lean,'status.flame.lean');finite(time,'status.flame.time');positive(period,'status.flame.period');alpha(opacity,'status.flame.opacity');
  const C=fit(colors.map(c=>color(c)),9).reverse(),fade=p.fade;try{p.fade*=opacity;tongue(p,...position,height,width,lean,C,time,period,seed);}finally{p.fade=fade;}
}
