// Finite 2D beam geometry for declared game surfaces. Reuses path.polyline;
// laser-grid's segment intersection is the repository starting point. New
// closed-volume/normal/Snell calculations are explicit geometric optics, not
// a rigid-body engine, damage rules, volumetric transport or renderer.
import {identity,finite,positive,point,count,choice,fail,alpha} from './contract.js';
import {polyline} from './path.js';
import {seconds} from './seconds.js';
import * as body from './body.js';
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1],cross=(a,b)=>a[0]*b[1]-a[1]*b[0],sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b,k=1)=>a.map((v,i)=>v+b[i]*k);
const unit=(a,name)=>{point(a,name);const n=Math.hypot(...a);if(!n)fail(name,'zero vector has no direction');return a.map(v=>v/n);};
const frozen=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(frozen);Object.freeze(x);}return x;};
function surface(id,shape,q,{mode='stop',retention=1,ior=1.5}={}){identity(id,'ray.surface.id');choice(mode,['stop','pass','reflect','refract'],'ray.surface.mode');alpha(retention,'ray.surface.retention');positive(ior,'ray.surface.ior');if(mode==='refract'&&shape==='segment')fail('ray.segment.mode','refractive regions need circle/box entry and exit boundaries');return frozen({kind:'RaySurface',id:String(id),shape,...q,mode,retention,ior});}
export function segment({id,a,b,...options}){point(a,'ray.segment.a');point(b,'ray.segment.b');if(Math.hypot(...sub(b,a))<1e-9)fail('ray.segment','distinct endpoints required');return surface(id,'segment',{a:[...a],b:[...b]},options);}
export function circle({id,center,radius,...options}){point(center,'ray.circle.center');positive(radius,'ray.circle.radius');return surface(id,'circle',{center:[...center],radius},options);}
export function box({id,bounds,...options}){if(!Array.isArray(bounds)||bounds.length!==4)fail('ray.box.bounds','expected [x,y,width,height]');bounds.forEach(v=>finite(v,'ray.box.bounds'));positive(bounds[2],'ray.box.width');positive(bounds[3],'ray.box.height');return surface(id,'box',{bounds:[...bounds]},options);}
export function reflect(direction,normal){const d=unit(direction,'ray.reflect.direction'),n=unit(normal,'ray.reflect.normal');return unit(add(d,n,-2*dot(d,n)),'ray.reflect.result');}
export function refract(direction,normal,{from=1,to=1.5}={}){const d=unit(direction,'ray.refract.direction');let n=unit(normal,'ray.refract.normal');positive(from,'ray.refract.from');positive(to,'ray.refract.to');if(dot(d,n)>0)n=n.map(v=>-v);const cos=-dot(d,n),eta=from/to,k=1-eta*eta*Math.max(0,1-cos*cos);if(k<0)return {direction:reflect(d,n),totalInternalReflection:true};return {direction:unit(add(d.map(v=>v*eta),n,eta*cos-Math.sqrt(k)),'ray.refract.result'),totalInternalReflection:false};}
function inside(s,p){if(s.shape==='circle')return Math.hypot(...sub(p,s.center))<s.radius;if(s.shape==='box'){const[x,y,w,h]=s.bounds;return p[0]>x&&p[0]<x+w&&p[1]>y&&p[1]<y+h;}return false;}
function intersections(s,p,d,epsilon){
 if(s.shape==='circle'){const v=sub(p,s.center),b=dot(v,d),c=dot(v,v)-s.radius*s.radius,k=b*b-c;if(k<0)return [];const h=Math.sqrt(k);return [-b-h,-b+h].filter((t,i,a)=>t>epsilon&&(i===0||Math.abs(t-a[0])>epsilon)).map(t=>{const position=add(p,d,t);return {t,position,normal:unit(sub(position,s.center),'ray.normal'),face:'curve'};});}
 const edges=s.shape==='segment'?[[s.a,s.b,'line',null]]:(()=>{const[x,y,w,h]=s.bounds;return [[[x,y],[x+w,y],'top',[0,-1]],[[x+w,y],[x+w,y+h],'right',[1,0]],[[x+w,y+h],[x,y+h],'bottom',[0,1]],[[x,y+h],[x,y],'left',[-1,0]]];})();
 return edges.flatMap(([a,b,face,normal])=>{const v=sub(b,a),den=cross(d,v);if(Math.abs(den)<1e-12*Math.hypot(...v))return [];const q=sub(a,p),t=cross(q,v)/den,u=cross(q,d)/den;if(t<=epsilon||u<0||u>1)return [];let n=normal??unit([-v[1],v[0]],'ray.normal');if(s.shape==='segment'&&dot(d,n)>0)n=n.map(v=>-v);return [{t,position:add(p,d,t),normal:n,face}];});
}
export function trace({id,origin,direction,surfaces=[],range=320,maxInteractions=32,energy=1,minEnergy=.01,epsilon=1e-7}={}){
 identity(id,'ray.id');point(origin,'ray.origin');let d=unit(direction,'ray.direction');positive(range,'ray.range');if(range>1e6)fail('ray.range','range exceeds 1M art pixels','BUDGET_EXCEEDED');positive(epsilon,'ray.epsilon');if(epsilon>=range)fail('ray.epsilon','epsilon must be smaller than range');count(maxInteractions,'ray.maxInteractions',256);if(!maxInteractions)fail('ray.maxInteractions','must be >=1');positive(energy,'ray.energy',true);positive(minEnergy,'ray.minEnergy',true);
 if(!Array.isArray(surfaces))fail('ray.surfaces','expected explicit surfaces from segment/circle/box');count(surfaces.length,'ray.surfaces',256);const ids=new Set();for(const s of surfaces){if(s?.kind!=='RaySurface')fail('ray.surface','use ray.segment/circle/box');if(ids.has(s.id))fail('ray.surface.id',`duplicate '${s.id}'`);ids.add(s.id);}
 let medium=surfaces.filter(s=>s.mode==='refract'&&inside(s,origin));if(medium.length>1)fail('ray.media','overlapping/nested refractive regions unsupported','CAPABILITY_UNSUPPORTED');medium=medium[0]??null;
 let p=[...origin],distance=0,power=energy,reason='range';const segments=[],hits=[];
 for(let ordinal=0;ordinal<maxInteractions;ordinal++){
  if(power<=minEnergy){reason='energy';break;}
  const candidates=surfaces.flatMap(s=>intersections(s,p,d,epsilon).map(h=>({...h,s}))).sort((a,b)=>a.t-b.t||(a.s.id<b.s.id?-1:a.s.id>b.s.id?1:a.face.localeCompare(b.face)));
  const h=candidates[0],remaining=range-distance;
  if(!h||h.t>remaining){const end=add(p,d,remaining);if(remaining>0)segments.push({id:`${id}/segment/${segments.length}`,from:[...p],to:end,direction:[...d],distance,length:remaining,energy:power,medium:medium?.id??null});p=end;distance=range;reason='range';break;}
  if(candidates.some(c=>c.s.id!==h.s.id&&Math.abs(c.t-h.t)<=epsilon))fail('ray.intersection','coincident boundaries from different surfaces are ambiguous; separate them','CONTRACT_MISMATCH');
  if(h.s.shape==='box'&&candidates.some(c=>c.s.id===h.s.id&&c.face!==h.face&&Math.abs(c.t-h.t)<=epsilon)&&h.s.mode==='refract')fail('ray.intersection','refraction exactly at a box corner has no unique normal; offset the path');
  segments.push({id:`${id}/segment/${segments.length}`,from:[...p],to:[...h.position],direction:[...d],distance,length:h.t,energy:power,medium:medium?.id??null});distance+=h.t;p=[...h.position];
  const incoming=[...d],tangent=Math.abs(dot(d,h.normal))<1e-10,entering=h.s.shape==='segment'?null:dot(d,h.normal)<0;
  let action=h.s.mode,totalInternalReflection=false;const iorFrom=medium?.ior??1;let iorTo=iorFrom;
  if(tangent)action='tangent';
  else if(h.s.mode==='reflect')d=reflect(d,h.normal);
  else if(h.s.mode==='refract'){
   if(entering&&medium&&medium.id!==h.s.id)fail('ray.media','overlapping/nested refractive regions unsupported','CAPABILITY_UNSUPPORTED');
   if(!entering&&medium?.id!==h.s.id)fail('ray.media','exit has no matching region; do not start exactly on a refractive boundary');
   iorTo=entering?h.s.ior:1;const result=refract(d,h.normal,{from:iorFrom,to:iorTo});d=result.direction;totalInternalReflection=result.totalInternalReflection;
   if(totalInternalReflection){action='reflect';iorTo=iorFrom;}else medium=entering?h.s:null;
  }
  const after=h.s.mode==='stop'&&!tangent?0:power*h.s.retention;
  hits.push({id:`${id}/hit/${ordinal}/${h.s.id}/${h.face}`,ordinal,surface:h.s.id,shape:h.s.shape,face:h.face,position:[...p],normal:[...h.normal],incoming,outgoing:h.s.mode==='stop'&&!tangent?null:[...d],distance,entering,action,energyBefore:power,energyAfter:after,iorFrom,iorTo,totalInternalReflection});power=after;
  if(h.s.mode==='stop'&&!tangent){reason='stop';break;}
  if(distance>=range){reason='range';break;}
  reason='limit';
 }
 const points=segments.length?[segments[0].from,...segments.map(s=>s.to)]:[];
 return frozen({kind:'RayTrace',id:String(id),origin:[...origin],direction:unit(direction,'ray.direction'),segments,hits,end:[...p],distance,energy:power,reason,epsilon,path:points.length>1?polyline({id:`${id}/path`,points}):null});
}
export function events(value,{start=0,speed=null}={}){
 if(value?.kind!=='RayTrace')fail('ray.events','expected ray.trace');positive(start,'ray.events.start',true);if(speed!==null)positive(speed,'ray.events.speed');
 return value.hits.map(h=>({...h,time:speed===null?start:seconds(start,h.distance/speed)}));
}

/** Observe the very trace used for drawing, without an artist-maintained
 * synthetic body/data bridge. from/to are the caller's actual visible range. */
export function observe(value,time,{fromPx=0,toPx=value?.distance,id=`ray/${value?.id}`}={}){
 if(value?.kind!=='RayTrace')fail('ray.observe','expected ray.trace');finite(time,'ray.observe.time');positive(fromPx,'ray.observe.fromPx',true);positive(toPx,'ray.observe.toPx',true);if(fromPx>toPx||toPx>value.distance)fail('ray.observe.interval','expected 0 <= fromPx <= toPx <= traced distance');
 const pointAt=d=>{const s=value.segments.find(s=>s.distance+s.length>=d)??value.segments.at(-1);return s?add(s.from,s.direction,Math.max(0,Math.min(s.length,d-s.distance))):[...value.origin];};
 const head=pointAt(toPx),tail=pointAt(fromPx),visible=value.segments.flatMap(s=>{const a=Math.max(fromPx,s.distance),b=Math.min(toPx,s.distance+s.length);return b>a?[{...s,from:pointAt(a),to:pointAt(b),distance:a,length:b-a}]:[];});
 const b=body.create({id,bounds:null,data:{traceId:value.id,head,tail,fromPx,toPx,totalDistance:value.distance,reason:value.reason,energy:value.energy,segments:visible,hits:value.hits.filter(h=>h.distance<=toPx),visibleHits:value.hits.filter(h=>h.distance>=fromPx&&h.distance<=toPx)}});return body.observe(b,time);
}
