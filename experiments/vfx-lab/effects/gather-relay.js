// Original asymmetric foundry figure. Reuse existing inward motion; only the
// new immutable endpoint records drive body growth and arrival responses.
import {gather,skill,schedule,body,motion,particle,curve} from '../../../src/authoring/index.js';
import {hex} from '../../../src/core/index.js';
export const meta={name:'Gather relay / 铸体冲拳',desc:'Unequal slag pieces arrive at a moving arm, accumulate weight into its silhouette, then release a punch. Growth and material remain replaceable code.',tags:['gather','arrival','accumulation','汇入','累计','身体','冲拳'],size:[256,192],origin:[116,164],duration:4.2,loop:false,options:{seed:31,weight:1}};
export const authoring={ending:'persistent'};export const events={first:.65,punch:2.7,settled:3.5};
let cache;
function design(o){if(cache?.seed===o.seed&&cache.weight===o.weight)return cache;
 const base=body.create({id:'smith',source:motion.source({position:[curve.scalar({input:'scene.seconds',points:[[0,-8],[2.6,8],[2.72,25],[3.5,8]]}),0]}),bounds:[-16,-62,58,62],anchors:{fist:[17,-33]}}),anchor=body.anchor(base,{name:'fist'});
 const slag=skill.infall({id:'slag',seed:o.seed,births:schedule.burst({id:'left-bank',at:.2,count:9}).map((b,i)=>({...b,born:.2+i*.19})),source:anchor,life:.45,radius:[42,82],endRadius:0,angles:[2.1,4.2],spin:[-.6,.8],aspect:.7});
 const arrivals=gather.fromParticles(slag,{id:'slag-arrivals',target:'smith',ends:b=>b.born+b.life,weight:({birth})=>(birth.index%3+1)*o.weight,data:({birth})=>({grade:birth.index%3,source:birth.id})});
 const smith=gather.bind(base,arrivals),flash=particle.emitter({id:'arrival-flashes',births:gather.births(arrivals,{life:.18}),initial:{velocity:[0,0]}});
 return cache={seed:o.seed,weight:o.weight,slag,arrivals,smith,flash};}
export function draw(p,t,o){const d=design(o),a=gather.sample(d.arrivals,t),release=t<2.7?0:Math.min(1,(t-2.7)/.22),mass=a.total*(1-release),r=3+mass*.24;
 particle.draw(p,d.slag,t,{draw:(p,s)=>{const w=1+s.birth.index%3;p.rect(s.position[0]-w/2,s.position[1]-1,w,2,hex('#685853'));p.px(s.position[0],s.position[1]-1,hex('#e9b56c'));}});
 body.draw(p,d.smith,t,{draw:(p)=>{p.rect(-9,-36,18,29,hex('#414c57'));p.rect(-7,-55,14,17,hex('#a3a5a0'));p.rect(-10,-7,7,7,hex('#30333d'));p.rect(4,-7,7,7,hex('#30333d'));p.rect(9,-36,12+r,7+r,hex('#72675b'));p.circle(19+r*.3,-33,r,hex('#d5a369'));p.px(20,-34,hex('#ffe8a6'));}});
 particle.draw(p,d.flash,t,{draw:(p,s)=>p.ring(...s.position,2+6*s.age01,1,hex('#ffe6aa'),1-s.age01)});
 if(t>=2.7&&t<3.2){const q=(t-2.7)/.5,x=34+q*45;p.line(25,-33,x,-33,hex('#f9d99c'),1-q);p.ring(x,-33,3+q*15,1,hex('#c4865a'),1-q);}
}
export function observe(t,o){const d=design(o);return {bodies:[body.observe(d.smith,t)],particles:[particle.observe(d.slag,t),particle.observe(d.flash,t)]};}
