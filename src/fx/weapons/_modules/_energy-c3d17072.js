// Artwork source: src/fx/weapons/_sources/4811286905e38c92eb7a/_energy.js
// Original top-down pressure waves, penetrating/reflected optical pulses,
// coherent plasma orb and causal chain-lightning. ray/arc own their geometry.
import {hex,fit,mix,clamp,smooth,TAU,Rng,particle,body,motion,curve,path,skill,material,arc,ray,cloud,ELECTRIC,LASER,LENS,FROST,SMOKE,INK,WHITE,rr,local,phase,fadeAt,births,sprayEmitter,planarSparks,palette,puffList,radialRing,discShadow} from './_common-f8537791.js';
const CHAIN=['#261b3c','#4a3265','#704f99','#a47bc2','#c7a9df','#e1d4ed','#f7f1e5','#fffceb'];
export function optics(weapon,o={}){const L=o.range??224;return weapon==='laser-pierce'?ray.trace({id:'penetrating-laser',origin:[0,0],direction:[1,0],range:L,surfaces:[ray.box({id:'front-armor',bounds:[68,-14,12,28],mode:'pass',retention:.93}),ray.box({id:'second-armor',bounds:[133,-16,16,32],mode:'pass',retention:.93}),ray.box({id:'third-armor',bounds:[196,-13,10,26],mode:'pass',retention:.93})]}):ray.trace({id:'refracted-laser',origin:[0,0],direction:[1,.08],range:390,surfaces:[ray.box({id:'glass-prism',bounds:[45,-25,18,50],mode:'refract',ior:1.45}),ray.segment({id:'mirror-a',a:[98,-22],b:[144,24],mode:'reflect',retention:.91}),ray.segment({id:'mirror-b',a:[112,38],b:[168,94],mode:'reflect',retention:.91}),ray.box({id:'end-plate',bounds:[214,60,12,22],mode:'stop'})]});}
export function chain(o={}){const targets=o.targets??[{id:'one',position:[72,0]},{id:'two',position:[140,-47]},{id:'three',position:[205,16]},{id:'fork',position:[142,57]}];
 return arc.network({id:'chain-discharge',seed:o.seed??53,jag:.13,forks:.12,bow:0,nodes:[{id:'coil',position:[0,0]},...targets],links:[{id:'leader',from:'coil',to:targets[0].id,start:0,travel:.09,duration:.52},{id:'hop-a',from:targets[0].id,to:targets[1].id,after:'leader',delay:.015,travel:.08,duration:.48},{id:'hop-b',from:targets[1].id,to:targets[2].id,after:'hop-a',delay:.015,travel:.08,duration:.43},{id:'fork',from:targets[0].id,to:targets[3].id,after:'leader',delay:.04,travel:.11,duration:.47}]});}
export function buildEnergy(weapon,stage,o){const seed=o.seed??53,m={weapon,stage,seed,emitters:[],bodies:[]},add=e=>(m.emitters.push(e),e),laser=weapon.startsWith('laser');
 if(laser&&stage==='flight')m.trace=optics(weapon,o);
 if(weapon==='chain'&&stage==='flight')m.network=chain(o);
 if(weapon==='tesla'&&stage==='flight'){
  m.corona=arc.network({id:'ball-corona',seed,jag:.3,forks:.08,nodes:[{id:'core',position:[0,0]},...Array.from({length:5},(_,i)=>({id:'rim'+i,position:t=>{const a=i*TAU/5+t*TAU*2;return [Math.cos(a)*(15+Math.sin(t*TAU*4+i)*2),Math.sin(a)*(15+Math.sin(t*TAU*4+i)*2)];}}))],links:Array.from({length:5},(_,i)=>({id:'spoke'+i,from:'core',to:'rim'+i,start:0,travel:.02,duration:1}))});
  m.wake=add(sprayEmitter({id:'tesla-drifting-ion-wake',seed,mode:'loop',count:21,life:[.18,.45],position:[-7,0],speed:[35,105],angle:[Math.PI-.2,Math.PI+.2],drag:1.5,radius:[.5,1.5],opacity:.8}));
 }
 if(['hit','reflect','explosion'].includes(stage)){
  m.sparks=add(sprayEmitter({id:weapon+'-'+stage+'-particles',seed,count:weapon==='tesla'?23:weapon==='sonic'?13:laser?19:17,life:[.13,.58],speed:weapon==='sonic'?[15,55]:[30,135],angle:laser?[1.5,4.8]:[-Math.PI,Math.PI],drag:3,radius:[.8,2],opacity:.8}));
  if(laser||weapon==='sonic')m.smoke=add(sprayEmitter({id:weapon+'-'+stage+'-haze',seed,count:laser?8:5,life:[.3,.8],speed:[5,23],angle:[-Math.PI,Math.PI],drag:2,radius:[1.5,4],opacity:.32}));
 }
 const end=stage==='launch'?.6:stage==='flight'?weapon==='tesla'?null:weapon==='sonic'?.8:1.3:stage==='explosion'?1.4:1.1;
 m.bodies.push(body.create({id:weapon+'-'+stage+'-geometry',end,bounds:null,data:t=>({weapon,stage,phase:t,beamDistance:m.trace?Math.min(m.trace.distance,t*1800):null,pressureFront:weapon==='sonic'?Math.min(o.range??160,t*410):null})}));return m;
}
function corona(p,position,r,t,seed,C,count=6,power=1){for(let i=0;i<count;i++){const a=rr(seed,i,'arc-angle',0,TAU)+t*TAU*.5,d=rr(seed,i,'arc-length',r*.8,r*1.7),from=[position[0]+Math.cos(a)*r*.65,position[1]+Math.sin(a)*r*.65],to=[position[0]+Math.cos(a+.35)*d,position[1]+Math.sin(a+.35)*d],b=arc.bolt({id:'corona/'+i+'/'+Math.floor(t*24),seed,from,to,jag:.3,forks:.1});
 for(const path of b.paths)for(let j=1;j<path.pts.length;j++){const a=path.pts[j-1],b=path.pts[j];p.line(...a,...b,C[3],.75*power);p.line(a[0],a[1]-.5,b[0],b[1]-.5,C[7],power);}}
}
function drawOrb(p,t,m){const C=palette(ELECTRIC),r=7.2+.5*Math.sin(t*TAU*4);discShadow(p,0,0,13,.26);
 if(m.wake)particle.draw(p,m.wake,t,{draw:(p,s)=>{const a=s.opacity,x=s.position[0],y=s.position[1];p.px(x,y,C[s.age01<.3?6:4],a);p.line(x-3,y,x,y,C[3],.5*a);p.glow(x,y,4,C[3],.1*a);}});
 p.shade(-10,-10,10,10,(x,y,out)=>{const d=Math.hypot(x,y),a=Math.atan2(y,x);if(d>r+1)return;const band=Math.sin(a*3-t*TAU*3+d*.9)*.4+Math.cos(a*5+t*TAU*2)*.18,light=1-d/(r+1)+band;out.c=d>r?C[2]:light>.85?C[7]:light>.5?C[6]:light>.12?C[4]:C[3];});
 p.circle(-1.5,-1.8,2.2,C[7]);p.glow(0,0,23,C[3],.2);arc.draw(p,m.corona,t,{colors:ELECTRIC,width:.38,glow:.06,flickerHz:24,period:1,power:.8});
}
export function drawEnergy(p,t,o,m){const {weapon,stage,seed}=m,laser=weapon.startsWith('laser'),C=palette(weapon==='chain'?CHAIN:weapon==='tesla'?ELECTRIC:weapon==='laser-bounce'?LENS:weapon==='sonic'?['#38454e','#778a91','#b7c7c9','#f6f4df']:LASER),range=o.range??160;
 if(weapon==='sonic'){
  if(stage==='launch')for(let i=0;i<3;i++){const age=t-i*.055;if(age<0||age>.22)continue;const u=age/.22;p.arc(0,0,3+u*20,Math.max(.6,2*(1-u)),-.55,.55,C[6],1-u);p.arc(0,0,5+u*20,.6,-.5,.5,C[1],.5*(1-u));}
  if(stage==='flight')for(let i=0;i<4;i++){const age=t-i*.055;if(age<0)continue;const d=age*410;if(d>range)continue;const u=d/range,a=(1-u*.7)*Math.min(1,age*35);p.arc(0,0,d,1.7+(1-u),-.36,.36,C[6],a);p.arc(0,0,d-3,.8,-.35,.35,C[2],.55*a);if(i%2===0)p.arc(0,0,d-6,.6,-.29,.29,C[5],.4*a);}
  if(stage==='hit'){
   if(m.smoke){const R=palette(SMOKE,7);cloud(p,puffList(p,m.smoke,t,SMOKE),R,R,{dens:.9,max:.32});}
   for(let i=0;i<3;i++){const age=t-i*.07;if(age<0||age>.45)continue;const u=age/.45;p.ring(0,0,2+28*(1-(1-u)**2),Math.max(.6,2*(1-u)),C[6],.8*(1-u));p.arc(0,0,5+u*34,1,-1.1,1.1,C[2],.5*(1-u));}
   if(m.sparks)particle.draw(p,m.sparks,t,{draw:(p,s)=>p.line(s.position[0]-1,s.position[1],s.position[0]+1,s.position[1],C[3],s.opacity*.7)});
  }return;
 }
 if(stage==='launch'){
  const duration=laser?.38:.5,u=clamp(t/duration),k=t<duration?Math.sin(Math.PI*u):0;if(!k)return;
  if(laser){p.ellipse(-2,0,4,7,C[2],k);p.ellipse(-1,0,2.5,5,C[5],k);p.line(0,-8,0,8,C[3],k*.6);p.arc(0,0,5+8*(1-u),1,-1.05,1.05,C[6],k);if(u>.58)p.beam(0,0,17*(u-.58)/.42,0,2,C[7],(1-u)*2.2);p.glow(0,0,18,C[3],.18*k);}
  else{p.ring(0,0,12*(1-u)+2,1.5,C[4],k);p.circle(0,0,1+3*k,C[6],k);corona(p,[0,0],8,t,seed,C,weapon==='tesla'?5:3,k);p.glow(0,0,20,C[3],.2*k);}return;
 }
 if(stage==='flight'){
  if(weapon==='tesla'){drawOrb(p,phase(t),m);return;}
  if(weapon==='chain'){const fade=fadeAt(t,1.25,.28);arc.draw(p,m.network,t,{colors:CHAIN,width:.6,glow:.1,power:.9,opacity:fade,flickerHz:24});return;}
  const tr=m.trace,head=Math.min(tr.distance,t*1800),k=fadeAt(t,1.3,.25)*Math.min(1,t*100),front=head/tr.distance;
  if(tr.path&&head>0){skill.beam(p,tr.path,t,{to:front,width:s=>{const d=s*tr.distance,seg=tr.segments.find(g=>d>=g.distance&&d<=g.distance+g.length)??tr.segments.at(-1);return (weapon==='laser-pierce'?5.5:3.6)*Math.sqrt(seg.energy);},colors:weapon==='laser-pierce'?LASER:LENS,glow:.14,strands:0,opacity:k,taperHead:3});
   for(const seg of tr.segments){if(seg.distance>=head)break;const shown=Math.min(seg.length,head-seg.distance);if(weapon==='laser-pierce')for(let d=0;d<shown;d+=13){const x=seg.from[0]+seg.direction[0]*d,y=seg.from[1]+seg.direction[1]*d;p.px(x,y,C[7],.7*k);} }
  }return;
 }
 if(stage==='hit'||stage==='reflect'){
  const k=fadeAt(t,1.1,.35);if(m.smoke){const R=palette(['#32323b','#58535b','#86767b','#b7a294'],7);cloud(p,puffList(p,m.smoke,t,SMOKE),R,R,{dens:1.1,max:.45});}
  if(laser){if(t<.09){const a=1-t/.09;p.ellipse(0,0,stage==='reflect'?4:3,8*a+1,C[6]);p.line(-7*a,0,9*a,0,C[7]);p.glow(0,0,20,C[3],.3*a);}p.ring(0,0,2.5+.6*Math.sin(t*50),1,t<.4?C[5]:C[2],k*.8);p.px(0,-1,C[7],k);}
  else{const r=(weapon==='tesla'?8:6)*(1-t/1.1);if(r>0){p.circle(0,0,1+r*.3,C[6],k);corona(p,[0,0],r+3,t,seed,C,weapon==='tesla'?7:4,k);p.glow(0,0,24,C[3],.15*k);}}
  if(m.sparks)planarSparks(p,m.sparks,t,{colors:weapon==='chain'?CHAIN:weapon==='tesla'?ELECTRIC:weapon==='laser-bounce'?LENS:LASER,glow:.08});return;
 }
 if(stage==='explosion'){
  const u=t/1.4,k=fadeAt(t,1.4,.45),r=4+38*(1-(1-clamp(u*2))**2);
  if(t<.06){p.circle(0,0,15*(1-t/.06)+3,C[6]);p.circle(0,0,10*(1-t/.06),C[7]);p.glow(0,0,60,C[4],.45*(1-t/.06));}
  radialRing(p,0,0,r,Math.max(.6,2*(1-u)),C[5],k*.7,seed,9);corona(p,[0,0],r*.75,t,seed,C,10,k*.8);if(m.sparks)planarSparks(p,m.sparks,t,{colors:ELECTRIC,glow:.08});
 }
}
export function observeEnergy(m,t){const bodies=m.bodies.map(b=>body.observe(b,t));if(m.trace)bodies.push(ray.observe(m.trace,t,{toPx:Math.min(m.trace.distance,t*1800)}));if(m.network)bodies.push(arc.observe(m.network,t));if(m.corona)bodies.push(arc.observe(m.corona,phase(t),{period:1}));return {particles:m.emitters.map(e=>particle.observe(e,t)),bodies};}
