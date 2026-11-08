// Original top-down mechanism reference. Geometry/material stay replaceable.
import {ray,arc,skill,body,particle} from '../../../src/authoring/index.js';
import {hex,fit} from '../../../src/core/index.js';
export const meta={name:'Optics relay / 俯视光路与电链',desc:'Declared glass, mirror and armor produce true optical interactions; arbitrary moving electrical nodes share travel and hit identities.',tags:['ray','arc','topdown','laser','lightning','俯视','反射','折射','闪电链'],size:[288,224],origin:[144,112],duration:2,loop:false,options:{seed:41}};
export const authoring={ending:'clear'};
const surfaces=[ray.box({id:'glass',bounds:[-70,-40,18,70],mode:'refract',ior:1.5}),ray.box({id:'plate',bounds:[-10,-20,8,45],mode:'pass',retention:.85}),ray.segment({id:'mirror',a:[45,-40],b:[85,10],mode:'reflect'})];
const beam=ray.trace({id:'example',origin:[-115,-20],direction:[1,.13],surfaces,range:295});
const net=arc.network({id:'relay',nodes:[{id:'a',position:[-65,55]},{id:'b',position:[8,58]},{id:'c',position:t=>[75+8*Math.sin(t*3),65]}],links:[{id:'first',from:'a',to:'b',start:.4,travel:.15,duration:.75},{id:'next',from:'b',to:'c',start:.55,travel:.16,duration:.7}]});
const real=body.create({id:'light-path',end:1.55,bounds:[-120,-90,250,170],data:{hits:beam.hits}});
export const events={beam:.15,firstArc:.4,secondArc:.55,clear:1.6};
export function draw(p,t){if(t>=1.6)return;const fade=Math.min(1,(1.6-t)/.3),C=fit(['#11354b','#337e8d','#8af0c6','#fff3ce'],8);for(const s of surfaces){if(s.shape==='box'){const[x,y,w,h]=s.bounds;p.rect(x,y,w,h,s.id==='glass'?hex('#1b5262'):hex('#5e6560'),.45*fade);p.line(x,y,x+w,y,C[5],fade);}else p.beam(...s.a,...s.b,2,hex('#b5c2b5'),fade);}
 if(t>=.15&&t<1.4&&beam.path)skill.beam(p,beam.path,t,{width:2.5,colors:['#1e223b','#6d4ca6','#cda8ef','#fff2d8'],glow:.12,opacity:Math.min(1,(t-.15)*20)*fade,strands:0});
 arc.draw(p,net,t,{colors:['#122e4d','#217d9a','#70d7ec','#f2ffff'],glow:.1,opacity:fade});for(const e of arc.events(net)){const a=t-e.time;if(a>=0&&a<.3)p.ring(...e.position,2+15*a,1,C[6],(1-a/.3)*fade);}}
export function observe(t){return {bodies:[body.observe(real,t),arc.observe(net,t)]};}
