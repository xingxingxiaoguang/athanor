// Known-track endpoints -> immutable arrival facts -> pure weighted response.
// Motion stays in particle.track/contact/path. No frame-local counters, assumed
// collisions, prescribed growth silhouette or automatic physical mass model.
import {track as particleTrack} from './particle.js';
import {identity,finite,positive,point,count,fail} from './contract.js';
const freeze=q=>{if(q&&typeof q==='object'){Object.values(q).forEach(freeze);Object.freeze(q);}return q;};
function json(q,path='gather.data',seen=new Set()){
 if(q===null||typeof q==='string'||typeof q==='boolean')return q;
 if(typeof q==='number')return finite(q,path);
 if(!q||(!Array.isArray(q)&&Object.getPrototypeOf(q)!==Object.prototype)||seen.has(q)||seen.size>=16)fail(path,'expected acyclic plain finite JSON, depth <=16');
 seen.add(q);const out=Array.isArray(q)?q.map((x,i)=>json(x,`${path}[${i}]`,seen)):Object.fromEntries(Object.entries(q).map(([k,v])=>[k,json(v,`${path}.${k}`,seen)]));seen.delete(q);return out;
}
export function records({id,events=[]}){
 identity(id,'gather.id');if(!Array.isArray(events))fail('gather.events','expected an array of explicit arrival facts');count(events.length,'gather.events');
 const ids=new Set(),items=events.map(e=>{identity(e.id,'gather.event.id');const key=String(e.id);if(ids.has(key))fail('gather.event.id',`duplicate '${key}'`);ids.add(key);identity(e.target,'gather.event.target');finite(e.time,'gather.event.time');point(e.position,'gather.event.position');point(e.velocity??[0,0],'gather.event.velocity');finite(e.weight??1,'gather.event.weight');
 return {id:key,target:String(e.target),time:e.time,position:[...e.position],velocity:[...(e.velocity??[0,0])],weight:e.weight??1,parent:e.parent?json(e.parent):null,data:json(e.data??null,`gather.events[${key}].data`)};});
 items.sort((a,b)=>a.time-b.time||(a.id<b.id?-1:a.id>b.id?1:0));return freeze({kind:'ArrivalSequence',id:String(id),events:items});
}
function sequence(q){if(q?.kind!=='ArrivalSequence')fail('gather.sequence','expected records/fromTracks/fromParticles');return q;}
/** Caller supplies closed tracks and a known destination. accept is optional
 * author-owned domain checking at that endpoint, never a collision solver. */
export function fromTracks({id,tracks,target,weight=1,accept=()=>true,data=null}){
 if(!Array.isArray(tracks))fail('gather.tracks','expected closed tracks');count(tracks.length,'gather.tracks');
 const events=[],omitted=[];
 for(const track of tracks){identity(track?.id,'gather.track.id');finite(track.end,'gather.track.end');if(typeof track.sample!=='function')fail('gather.track.sample','expected a closed track sampler');
 const endpoint=track.sample(track.end);point(endpoint?.position,'gather.endpoint.position');point(endpoint.velocity??[0,0],'gather.endpoint.velocity');const context={track,time:track.end,endpoint};
 const keep=accept(context);if(typeof keep!=='boolean')fail('gather.accept','expected boolean');if(!keep){omitted.push(String(track.id));continue;}
 events.push({id:track.id,time:track.end,target:typeof target==='function'?target(context):target,weight:typeof weight==='function'?weight(context):weight,data:typeof data==='function'?data(context):data,position:endpoint.position,velocity:endpoint.velocity,parent:track.parent??null});
 }
 return freeze({...records({id,events}),omitted});
}
export function fromParticles(emitter,{id=`${emitter?.id}/arrivals`,target,ends,weight=1,accept,data=null,select=()=>true}={}){
 if(emitter?.kind!=='Emitter')fail('gather.emitter','expected particle.emitter');
 const births=new Map(emitter.births.map(b=>[b.id,b]));const tracks=emitter.births.filter(b=>{const v=select(b);if(typeof v!=='boolean')fail('gather.select','expected boolean');return v;}).map(b=>particleTrack(emitter,b.id,{position:'physical',...(ends===undefined?{}:{end:typeof ends==='function'?ends(b):ends[b.id]})}));
 const withBirth=fn=>typeof fn==='function'?q=>fn({...q,birth:births.get(q.track.parent.particle)}):fn;
 return fromTracks({id,tracks,target:withBirth(target),weight:withBirth(weight),accept:withBirth(accept),data:withBirth(data)});
}
export function sample(value,time,{target,initial=0,from}={}){
 const s=sequence(value);finite(time,'gather.time');finite(initial,'gather.initial');if(from!==undefined)finite(from,'gather.from');if(target!==undefined)identity(target,'gather.target');
 const events=s.events.filter(e=>e.time<=time&&(from===undefined||e.time>=from)&&(target===undefined||e.target===String(target)));
 const total=events.reduce((sum,e)=>finite(sum+e.weight,'gather.total'),initial);
 return {id:s.id,time,target:target===undefined?null:String(target),initial,total,count:events.length,latest:events.at(-1)??null,events};
}
export function births(value,{id=`${value?.id}/response`,count:n=1,life=.35,delay=0,select=()=>true}={}){
 sequence(value);identity(id,'gather.births.id');count(n,'gather.births.count',1024);positive(life,'gather.births.life');positive(delay,'gather.births.delay',true);
 return value.events.flatMap(e=>{const keep=select(e);if(typeof keep!=='boolean')fail('gather.births.select','expected boolean');return keep?Array.from({length:n},(_,i)=>({id:`${id}/${JSON.stringify([e.id,i])}`,born:finite(e.time+delay,'gather.births.born'),life,position:[...e.position],space:'effect',arrival:e})):[];});
}
/** Optional real-body observation binding. Shape/material response remains JS. */
export function bind(body,sequences,{initial=0,from}={}){
 if(body?.kind!=='Body'||typeof body.sample!=='function')fail('gather.bind.body','expected Body');if(!Array.isArray(sequences))sequences=[sequences];sequences.forEach(sequence);
 return {...body,sample(time,options={}){const state=body.sample(time,options);if(options.data===false)return state;return {...state,data:{target:state.data,accumulation:sequences.map(s=>sample(s,time,{target:body.id,initial,from}))}};}};
}
