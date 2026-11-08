// Open electrical geometry/inking, lifted from lightning/_lib zigzag/bowed/
// stroke/crackle. Sprite Fusion lightning / MIT / (c) 2026 Hugo Duprez.
// Caller supplies target nodes/links; no combat target selection or fixed rig.
import {zigzag,bowed,stroke,crackle,VOLT} from '../fx/lightning/_lib.js';
import {Rng,fit} from '../core/index.js';
import {identity,finite,positive,point,count,alpha,color,choice,fail} from './contract.js';
import {unit as random} from './random.js';import {polyline,sample as onPath} from './path.js';import * as body from './body.js';
import {seconds,product,period as cycleAt} from './seconds.js';
const frozen=q=>{if(q&&typeof q==='object'){Object.values(q).forEach(frozen);Object.freeze(q);}return q;};
function at(node,time){const q=node.position?.kind==='SourceTrajectory'?node.position.sample(time).position:typeof node.position==='function'?node.position(time):node.position;point(q,`arc.nodes.${node.id}.position`);return [...q];}
export function bolt({id,from,to,seed=1,jag=.18,forks=.15,bow=0}={}){
 identity(id,'arc.bolt.id');point(from,'arc.bolt.from');point(to,'arc.bolt.to');finite(seed,'arc.seed');positive(jag,'arc.jag',true);alpha(forks,'arc.forks');finite(bow,'arc.bow');if(jag>1)fail('arc.jag','expected 0..1 displacement ratio');
 const length=Math.hypot(to[0]-from[0],to[1]-from[1]);if(length>800)fail('arc.bolt.length','maximum 800 art pixels','BUDGET_EXCEEDED');
 if(length<1e-9)return {kind:'ArcGeometry',id:String(id),paths:[],path:null,lengthPx:0,from:[...from],to:[...to]};
 const rng=new Rng(Math.floor(random({seed,layer:'arc',id,channel:'shape'})*0x7fffffff)),geometry=bow?bowed(rng,...from,...to,bow,jag,forks):zigzag(rng,...from,...to,jag,forks);
 const path=polyline({id:`${id}/trunk`,points:geometry.paths[0].pts});return {kind:'ArcGeometry',id:String(id),...geometry,path,lengthPx:path.lengthPx,from:[...from],to:[...to]};
}
export function network({id,nodes,links,seed=1,jag=.18,forks=.15,bow=0,step=.1,travel=.06,hold=.5}={}){
 identity(id,'arc.network.id');if(!Array.isArray(nodes)||nodes.length<2)fail('arc.nodes','provide at least two named positions/sources');count(nodes.length,'arc.nodes',64);const seen=new Set();const n=nodes.map(q=>{identity(q.id,'arc.node.id');if(seen.has(String(q.id)))fail('arc.node.id','duplicate node');seen.add(String(q.id));if(Array.isArray(q.position))point(q.position,`arc.nodes.${q.id}.position`);else if(typeof q.position!=='function'&&!(q.position?.kind==='SourceTrajectory'&&typeof q.position.sample==='function'))fail('arc.node.position','expected [x,y], pure time callback or SourceTrajectory');return {...q,id:String(q.id)};});
 if(links===undefined){positive(step,'arc.step',true);positive(travel,'arc.travel');positive(hold,'arc.hold',true);links=n.slice(1).map((q,i)=>({id:`${n[i].id}>${q.id}`,from:n[i].id,to:q.id,start:product(i,step),travel,duration:seconds(travel,hold)}));}
 if(!Array.isArray(links)||!links.length)fail('arc.links','provide a nonempty link array');count(links.length,'arc.links',64);const ids=new Set();
 // Resolve explicit timing dependencies by identity, never array order.
 const definitions=new Map();for(const q of links){identity(q.id,'arc.link.id');if(definitions.has(String(q.id)))fail('arc.link.id','duplicate link');definitions.set(String(q.id),q);}
 const resolved=new Map(),resolving=new Set();
 const resolve=q=>{const id=String(q.id);if(resolved.has(id))return resolved.get(id);if(resolving.has(id))fail('arc.link.after','cyclic timing dependencies');resolving.add(id);let start=q.start??0;
 if(q.after!==undefined){if(q.start!==undefined)fail('arc.link.start','choose start or after, not both');const parent=definitions.get(String(q.after));if(!parent)fail('arc.link.after',`unknown link '${q.after}'`);const r=resolve(parent),delay=q.delay??0;positive(delay,'arc.link.delay',true);start=seconds(r.start,r.travel??travel,delay);}
 const out={...q,start};resolving.delete(id);resolved.set(id,out);return out;};
 const l=links.map(resolve).map(q=>{identity(q.id,'arc.link.id');if(ids.has(String(q.id)))fail('arc.link.id','duplicate link');ids.add(String(q.id));if(!seen.has(String(q.from))||!seen.has(String(q.to)))fail('arc.link.nodes','from/to must name existing nodes');const start=q.start??0,flight=q.travel??travel,duration=q.duration??seconds(flight,hold);positive(start,'arc.link.start',true);positive(flight,'arc.link.travel');positive(duration,'arc.link.duration');if(duration<flight)fail('arc.link.duration','must include its travel time');return {id:String(q.id),from:String(q.from),to:String(q.to),...(q.after===undefined?{}:{after:String(q.after),delay:q.delay??0}),start,travel:flight,hit:seconds(start,flight),duration,end:seconds(start,duration),jag:q.jag??jag,forks:q.forks??forks,bow:q.bow??bow};});
 // Validate shape parameters without reading the caller's implementation.
 for(const q of l)bolt({id:q.id,from:[0,0],to:[1,0],seed,jag:q.jag,forks:q.forks,bow:q.bow});
 return {kind:'ArcNetwork',id:String(id),nodes:n,links:l,seed,born:Math.min(...l.map(q=>q.start)),end:Math.max(...l.map(q=>q.end))};
}
function checked(n){if(n?.kind!=='ArcNetwork')fail('arc.network','use network()');return n;}
export function sample(value,time,{flickerHz=18,period=null}={}){
 const n=checked(value);finite(time,'arc.time');positive(flickerHz,'arc.flickerHz',true);if(period!==null){positive(period,'arc.period');if(period<n.end)fail('arc.period','period must cover all link ends; overlapping network copies are not implicit');}const phase=period===null?{cycle:0,local:time}:cycleAt(time,period),t=phase.local,epoch=flickerHz?Math.floor(t*flickerHz):0,map=new Map(n.nodes.map(q=>[q.id,at(q,time)]));
 return n.links.map(q=>{const from=map.get(q.from),to=map.get(q.to),age=seconds(t,-q.start),progress=Math.max(0,Math.min(1,age/q.travel)),status=t<q.start?'pending':t>=q.end?'expired':t<q.hit?'propagating':'holding';
 const g=bolt({id:`${n.id}/${q.id}/${epoch}`,from,to,seed:n.seed,jag:q.jag,forks:q.forks,bow:q.bow}),head=g.path?onPath(g.path,progress).position:[...to];
 return {id:q.id,network:n.id,source:q.from,target:q.to,time,cycle:phase.cycle,localTime:t,start:q.start,hit:q.hit,end:q.end,status,age,progress,from:[...from],to:[...to],head,geometry:g};});
}
export function draw(p,value,time,{colors=VOLT,width=.65,glow=.18,opacity=1,power=1,style='stroke',filter,...sampling}={}){
 positive(width,'arc.width');positive(glow,'arc.glow',true);alpha(opacity,'arc.opacity');alpha(power,'arc.power');choice(style,['stroke','crackle'],'arc.style');const C=fit(colors.map(c=>color(c,'arc.colors')),8),states=sample(value,time,sampling);
 for(const s of states){if(!['propagating','holding'].includes(s.status)||!s.geometry.paths.length||filter&&!filter(s))continue;
 // Clip the leader by true arc length; the old helper's upTo is point-count.
 let shape=s.geometry;if(s.progress<1){const path=shape.path,d=s.progress*path.lengthPx,pts=[path.points[0]];for(const seg of path.segments){if(seg.start+seg.length<d)pts.push(seg.b);else{pts.push(s.head);break;}}shape={paths:pts.length>1?[{pts,w:1}]:[]};}
 if(style==='crackle')crackle(p,shape,power,C,glow,opacity);else stroke(p,shape,power,C,width,{light:glow,a:opacity});
 }
 return states;
}
export function events(value,{from=-1e-12,to=value?.end,period=null}={}){
 const n=checked(value);finite(from,'arc.events.from');finite(to,'arc.events.to');if(to<from)fail('arc.events.interval','expected to >= from');if(period!==null){positive(period,'arc.events.period');if(period<n.end)fail('arc.events.period','period must cover all link ends');}const nodes=new Map(n.nodes.map(q=>[q.id,q]));const out=[];
 for(const link of n.links){const first=period===null?0:Math.max(0,cycleAt(seconds(from,-link.hit),period).cycle+1),last=period===null?0:cycleAt(seconds(to,-link.hit),period).cycle;if(last-first>10000)fail('arc.events','query spans >10000 cycles','BUDGET_EXCEEDED');for(let cycle=first;cycle<=last;cycle++){const time=seconds(link.hit,period===null?0:product(cycle,period));if(time<=from||time>to)continue;out.push({id:`${n.id}/${link.id}/${cycle}`,link:link.id,source:link.from,target:link.to,cycle,time,position:at(nodes.get(link.to),time),from:at(nodes.get(link.from),time)});}}
 return out.sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));
}
export function observe(value,time,options={}){
 const n=checked(value),states=sample(n,time,options),active=states.filter(s=>['propagating','holding'].includes(s.status)),pts=active.flatMap(s=>s.geometry.paths.flatMap(p=>p.pts));let bounds=null;
 if(pts.length){const x=Math.min(...pts.map(p=>p[0])),y=Math.min(...pts.map(p=>p[1]));bounds=[x,y,Math.max(...pts.map(p=>p[0]))-x,Math.max(...pts.map(p=>p[1]))-y];}
 const b=body.create({id:`arc/${n.id}`,born:n.born,end:options.period?null:n.end,bounds:null,data:{geometryBounds:bounds,links:states.map(({geometry,...s})=>({...s,lengthPx:geometry.lengthPx}))}});return body.observe(b,time);
}
