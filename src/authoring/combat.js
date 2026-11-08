// Combat presentation, not combat rules. Reuses ui/_lib spell/drawWord's
// handcrafted pixel typography, ui/damage-number's pop/flight/landing squash,
// and impacts/hit-flash's brightness tint and hot spike/ring construction.
// Body tint derives from Sprite Fusion power-up / MIT / (c) 2026 Hugo Duprez.
// Legacy effects and their attribution remain intact.
import { spell, drawWord } from '../fx/ui/_lib.js';
import { FONTS } from '../core/font.js';
import { luma, mix, scale as shadeColor } from '../core/color.js';
import { identity, finite, positive, point, count, color, alpha, fail } from './contract.js';
import * as particle from './particle.js';
import * as contact from './contact.js';

const value = (spec, event) => typeof spec === 'function' ? spec(event) : spec;
const requireHits = h => { if(h?.kind !== 'HitSequence') fail('combat.hits','expected combat.hits()'); return h; };
function snapshot(v, seen = new Set()) {
  if(v === null || ['string','boolean'].includes(typeof v)) return v;
  if(typeof v === 'number') return finite(v,'combat.data');
  if(!v || seen.has(v) || (!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype)) fail('combat.data','expected acyclic finite plain JSON');
  seen.add(v);
  const q = Array.isArray(v) ? v.map(x=>snapshot(x,seen)) : Object.fromEntries(Object.entries(v).map(([k,x])=>[k,snapshot(x,seen)]));
  seen.delete(v);return Object.freeze(q);
}

/** Resolve positions once at exact external hit times, never during drawing.
 * `resolve(event)` may sample body.anchor/surface.project/action at event.time.
 * Directions describe the game-supplied blow, not a calculated facing. */
export function hits({id,events,resolve}={}) {
  identity(id,'combat.hits.id');
  if(!Array.isArray(events) || (resolve !== undefined && typeof resolve !== 'function')) fail('combat.hits.events','expected records and optional pure resolve(event)');
  count(events.length,'combat.hits.events');const ids=new Set();
  const records=events.map(e=>{
    identity(e.id,'combat.hit.id');identity(e.target,'combat.hit.target');positive(e.time,'combat.hit.time',true);
    if(ids.has(String(e.id))) fail('combat.hit.id',`duplicate hit '${e.id}'`);ids.add(String(e.id));
    if(e.kind!==undefined&&typeof e.kind!=='string')fail('combat.hit.kind','expected an author-defined string');
    const q=resolve ? resolve(e) : e;
    const position=point(q?.position,'combat.hit.position'),direction=point(e.direction??q.direction??[1,0],'combat.hit.direction'),n=Math.hypot(...direction);
    if(!n)fail('combat.hit.direction','direction cannot be zero');
    if(e.critical !== undefined && typeof e.critical !== 'boolean')fail('combat.hit.critical','expected boolean supplied by the game');
    if(e.value !== undefined && typeof e.value !== 'string')finite(e.value,'combat.hit.value');
    return snapshot({id:String(e.id),sequence:String(id),target:String(e.target),time:e.time,position:[...position],direction:direction.map(v=>v/n),targetVelocity:[...point(q.velocity??[0,0],'combat.hit.targetVelocity')],value:e.value??null,critical:e.critical??false,kind:e.kind??'hit',data:e.data??null});
  }).sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));
  return Object.freeze({kind:'HitSequence',id:String(id),events:Object.freeze(records)});
}

/** Random-access read. No callbacks fire and overlapping hits remain separate. */
export function sample(sequence,time,{target,duration=.36}={}) {
  requireHits(sequence);finite(time,'combat.sample.time');positive(duration,'combat.sample.duration');
  return sequence.events.filter(e=>(target===undefined||e.target===String(target))&&time>=e.time&&time<e.time+duration).map(e=>({...e,age:time-e.time,age01:(time-e.time)/duration}));
}

export function births(sequence,{id=sequence?.id,count:amount=1,life=.25,delay=0,select=()=>true}={}) {
  requireHits(sequence);identity(id,'combat.births.id');positive(delay,'combat.births.delay',true);
  if(typeof select!=='function')fail('combat.births.select','expected event => boolean');
  const out=[];
  for(const hit of sequence.events.filter(select)) {
    const n=value(amount,hit),duration=positive(value(life,hit),'combat.births.life');count(n,'combat.births.count');count(out.length+n,'combat.births.total');
    for(let i=0;i<n;i++)out.push({id:`${id}/${encodeURIComponent(hit.id)}/${i}`,born:hit.time+delay,life:duration,position:[...hit.position],space:'effect',hit,index:i});
  }
  return out;
}

/** A shader combinator, not a forced body renderer. Call inside any surface
 * shader; choose which hit states apply (e.g. exclude blocks) in ordinary JS. */
export function tint(base,states,{ramp=['#6a101c','#d42a30','#ff9a8a'],whiteSeconds=.058,duration=.36,strength=.65,rim=false}={}) {
  const c=color(base,'combat.tint.color');positive(whiteSeconds,'combat.tint.whiteSeconds',true);positive(duration,'combat.tint.duration');alpha(strength,'combat.tint.strength');
  if(!Array.isArray(ramp)||ramp.length<3)fail('combat.tint.ramp','provide at least three dark-to-light colors');
  if(!states?.length)return c;
  const hit=states.reduce((a,b)=>a.time>b.time?a:b),age=hit.age;
  if(age<0||age>=duration)return c;
  if(age<whiteSeconds)return color('#fff');
  if(rim)return age<.158?color('#fff'):mix(c,color(ramp.at(-1),'combat.tint.ramp'),Math.max(0,1-age/duration));
  const C=ramp.map(x=>color(x,'combat.tint.ramp')),l=luma(c),red=C[Math.min(C.length-1,Math.floor(l*C.length))];
  return mix(c,red,age<.125?1:strength*Math.max(0,(duration-age)/Math.max(1e-9,duration-.125)));
}

/** Exact old word rasterizer; unsupported glyphs fail instead of vanishing.
 * For another script, provide your own number draw callback or texture. */
export function text(p,str,{position=[0,0],font='big',scale=1,scaleY=scale,opacity=1,flash=0,slant=0,fill=['#d42a2e','#ff5a4a','#ff9a86'],edge='#ffd8cc',under='#8c1420',outline='#1a0508',shadow='#1a0508'}={}) {
  const F=FONTS[font];if(!F)fail('combat.text.font','expected mini or big');
  const label=String(str),unsupported=[...new Set([...label].filter(ch=>ch!==' '&&!F.glyphs[ch]&&!F.glyphs[ch.toUpperCase()]))];
  if(unsupported.length)fail('combat.text.glyphs',`unsupported glyphs: ${unsupported.join(' ')}`,'CAPABILITY_UNSUPPORTED','Use the documented Latin/digit/punctuation font, or replace drawNumbers with your own draw/texture.');
  point(position,'combat.text.position');positive(scale,'combat.text.scale');positive(scaleY,'combat.text.scaleY');alpha(opacity,'combat.text.opacity');finite(slant,'combat.text.slant');finite(flash,'combat.text.flash');
  if(!Array.isArray(fill)||!fill.length)fail('combat.text.fill','provide a nonempty bottom-to-top color ramp');
  const word=spell(label,font),x=position[0]-word.w*scale/2,y=position[1]-F.h*scaleY;
  drawWord(p,word.letters.filter(l=>l.g).map(l=>({g:l.g,x:x+l.x*scale,y,sx:scale,sy:scaleY,a:opacity,flash,slant})),{fill:fill.map(c=>color(c)),edge:color(edge),under:color(under),outline:color(outline),shadow:shadeColor(color(shadow),.5)});
}

/** Real particle bodies: exact contact flight, authored text/style, no fixed
 * critical art direction. Normal particle sample/observe/track all apply. */
export function numbers({id,hits:sequence,life=1.05,select=()=>true,text:label=e=>String(e.value??''),offset=[0,-8],velocity=e=>[34*e.direction[0],-175],acceleration=[0,900],drag=2,bounce=.36,size=1,material={},style={}}={}) {
  const records=births(sequence,{id,life,select}).map(b=>({...b,position:b.position.map((v,i)=>v+point(value(offset,b.hit),'combat.numbers.offset')[i])}));
  const tracks=new Map();
  const initial=b=>{
    const v=point(value(velocity,b.birth.hit),'combat.numbers.velocity'),s=positive(value(size,b.birth.hit),'combat.numbers.size');
    const trace=contact.trace({position:[0,0],velocity:v,acceleration,drag,life:b.birth.life,floor:contact.floor({restitution:bounce,tangentRetention:.7,settleSpeed:3}),particle:b.birth.id});
    tracks.set(b.birth.id,trace);return {life:b.birth.life,velocity:v,scale:s,data:{hit:b.birth.hit,text:String(value(label,b.birth.hit))}};
  };
  const squash=s=>{const events=tracks.get(s.id).contactEvents,last=events.filter(e=>e.age<=s.age).at(-1);return last?Math.max(0,1-(s.age-last.age)/.09):0;};
  const pop=s=>2+1.4*Math.exp(-s.age*22)*Math.cos(s.age*30);
  const system=particle.emitter({id,births:records,initial,motion:{trajectory(s){const q=tracks.get(s.id).sample(s.age);return {...q,position:q.position.map((v,i)=>v+s.birth.position[i])};},offset:s=>[0,-6*Math.max(0,(s.age01-.8)/.2)**2]},material:{scale:s=>pop(s)*(1+.18*squash(s)),scaleY:s=>pop(s)*(1-.2*squash(s)),opacity:s=>Math.max(0,Math.min(1,(1-s.age01)/.2)),...material}});
  system.numberStyle=style;return system;
}

export function drawNumbers(p,system,time,{draw,style=system.numberStyle??{}}={}) {
  return particle.draw(p,system,time,{draw:draw??((p,s)=>text(p,s.data.text,{position:s.position,scale:s.scale[0],scaleY:s.scale[1],opacity:s.opacity,flash:s.age<.035?1:s.age<.07?.4:0,...value(style,s)}))});
}

/** Hit-flash's hot spikes + outgoing ring, detached from its fixed actor.
 * Replace this pass freely; direction/radius/color/glow are author choices. */
export function impact(p,state,{radius=12,duration=.22,spikes=8,colors=['#d42a30','#ff9a8a','#fff'],glow=.5,rotation=Math.atan2(...[state.direction[1],state.direction[0]])}={}) {
  positive(radius,'combat.impact.radius');positive(duration,'combat.impact.duration');count(spikes,'combat.impact.spikes',128);positive(glow,'combat.impact.glow',true);
  const t=state.age,k=t/duration;if(k<0||k>=1)return;
  const C=colors.map(c=>color(c)),[x,y]=state.position;
  if(C.length<3)fail('combat.impact.colors','provide dark, light and hot colors');
  if(t<.07)for(let i=0;i<spikes;i++){
    const a=rotation+i*Math.PI*2/spikes,L=radius*(i%2?.45:1)*(t<.035?1:1.3),start=t<.035?0:.45;
    p.line(x+Math.cos(a)*L*start,y+Math.sin(a)*L*start,x+Math.cos(a)*L,y+Math.sin(a)*L,u=>u<.45&&t<.035?C[2]:u<.75?C[1]:C[0]);
  }
  p.ring(x,y,3+radius*(1-(1-k)**3),Math.max(1,2*(1-k)),k<.4?C[2]:C[1],1-k);
  if(glow)p.glow(x,y,radius*1.5,C[1],glow*(1-k));
}
