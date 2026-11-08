// Frozen artwork source: experiments/vfx-lab/productions/2026-11-07-arsenal/art/_ballistic.js
// Top-down muzzle pressure / spinning shell / entry-spall / differentiated
// detonation art. Flash/cloud are mature Sprite Fusion-derived Athanor helpers;
// all trajectory, composition and paint choices here are original production.
import {hex,fit,mix,clamp,smooth,tileNoise,TAU,Rng,particle,schedule,body,motion,material,flash,flashShape,cloud,FIRE,SMOKE,ACID,INK,WHITE,rr,local,phase,fadeAt,births,sprayEmitter,planarSparks,palette,puffList,radialRing,discShadow} from '../91c1b9989a625cbcc307/_common.js';
const BRASS=['#292524','#645338','#ad8750','#e3bc76','#fff1b7'].map(hex);
const STEEL=['#18232b','#34454b','#6e817e','#bbcbc0','#f1f5d8'].map(hex);
export function buildBallistic(weapon,stage,o){const seed=o.seed??53,mode=stage.endsWith('-intro')?'intro':stage.endsWith('-outro')?'outro':weapon==='gatling'&&stage==='launch'?'loop':'burst',base=stage.replace(/-(intro|outro)$/,''),m={weapon,stage,base,mode,seed,emitters:[],bodies:[]};
 const add=e=>(m.emitters.push(e),e),tank=weapon.startsWith('tank-');
 if(base==='launch'){
  m.smoke=add(sprayEmitter({id:weapon+'-muzzle-smoke',seed,mode,count:tank?26:weapon==='shotgun'?17:14,life:tank?[.55,1.35]:[.22,.65],position:[4,0],speed:tank?[25,95]:[12,55],angle:[-.75,.75],drag:3.6,radius:tank?[3.5,6]:[1.5,3.2],opacity:.54}));
  if(!tank)m.cases=add(particle.emitter({id:weapon+'-cases',seed,births:weapon==='gatling'?births('case',mode,12,.75).map(b=>({...b,position:[-13,5]})):[{id:'eject',born:.22,position:[-13,4]}],initial:({rand})=>({life:.75,velocity:[rand('vx',-28,-10),rand('vy',27,54)],rotation:rand('angle',0,TAU),spin:rand('spin',12,23),data:{shell:weapon==='shotgun'}}),motion:{drag:1.8},material:{opacity:s=>Math.min(1,(1-s.age01)*3)}}));
  m.sparks=add(sprayEmitter({id:weapon+'-launch-sparks',seed,mode,count:tank?16:weapon==='gatling'?12:17,life:[.08,.23],position:[3,0],speed:[70,tank?230:150],angle:[-.5,.5],drag:2.5,radius:[1,1],opacity:1}));
 }
 if(base==='flight'){
  if(weapon==='shotgun')m.pellets=add(particle.emitter({id:'shotgun-pellets',seed,births:schedule.burst({id:'pellet',at:0,count:12}),initial:({birth,rand})=>{const angle=(birth.index/11-.5)*.54+rand('jitter',-.018,.018);return {life:.3,velocity:[540,540*Math.tan(angle)],data:{angle}};},material:{opacity:s=>Math.min(1,s.age*90,Math.max(0,(1-s.age01)*12))}}));
  else{
   const toxic=weapon==='tank-gas',hot=weapon==='tank-incendiary';
   m.wake=add(sprayEmitter({id:weapon+'-wake',seed,mode:'loop',count:toxic?10:hot?14:7,life:[.12,.32],position:[-7,0],speed:[40,140],angle:[Math.PI-.12,Math.PI+.12],drag:1,radius:hot?[.8,1.7]:toxic?[1,2]:[.4,.8],opacity:toxic?.25:.32}));
   m.bodies.push(body.create({id:weapon+'-projectile',bounds:[-18,-7,26,14],data:{space:'projectile-local; game moves the pivot',weapon}}));
  }
 }
 if(base==='hit'||base==='exit'){
  const ap=weapon==='tank-ap',exit=base==='exit',life=ap?[.13,.44]:[.08,.33];
  m.sparks=add(sprayEmitter({id:weapon+'-'+base+'-spall',seed,mode:'burst',count:ap?38:weapon==='gatling'?10:16,life,position:[0,0],speed:ap?[90,260]:[45,140],angle:exit?[-.6,.6]:[Math.PI-.95,Math.PI+.95],drag:3,radius:[1,1]}));
  m.dust=add(sprayEmitter({id:weapon+'-'+base+'-dust',seed,mode:'burst',count:ap?9:7,life:[.3,.75],position:[-2,0],speed:[10,40],angle:exit?[-1,1]:[1.7,4.5],drag:3,radius:[1.6,3.7],opacity:.45}));
  if(weapon==='tank-incendiary'||weapon==='tank-gas')m.frags=add(sprayEmitter({id:weapon+'-broken-casing',seed,mode:'burst',count:7,life:[.2,.55],speed:[30,115],angle:[-Math.PI,Math.PI],drag:2.8,radius:[1,2],opacity:1}));
 }
 if(base==='explosion'){
  if(weapon==='tank-he'){
   m.fire=add(sprayEmitter({id:'he-fire-lobes',seed,count:19,life:[.32,.85],speed:[30,100],angle:[-Math.PI,Math.PI],drag:1.9,radius:[8,14]}));
   m.smoke=add(sprayEmitter({id:'he-rolling-smoke',seed,count:31,life:[.9,2.1],speed:[25,90],angle:[-Math.PI,Math.PI],drag:2.4,radius:[5.5,10],opacity:.75}));
   m.debris=add(sprayEmitter({id:'he-shrapnel',seed,count:32,life:[.2,.9],speed:[90,250],angle:[-Math.PI,Math.PI],drag:3,radius:[1,2]}));
  }else if(weapon==='tank-incendiary'){
   const patches=Array.from({length:11},(_,i)=>{const a=rr(seed,i,'fuel-angle',-Math.PI,Math.PI),r=rr(seed,i,'fuel-radius',8,52);return{id:`fuel/${i}`,born:rr(seed,i,'delay',.02,.12),life:rr(seed,i,'life',2.5,3.3),position:[Math.cos(a)*r,Math.sin(a)*r*.85],radius:rr(seed,i,'size',5,10)};});
   m.patches=add(particle.emitter({id:'incendiary-fuel-patches',seed,births:patches,initial:({birth})=>({data:{radius:birth.radius,phase:rr(seed,birth.id,'flicker',0,TAU)},velocity:[0,0]}),material:{opacity:s=>Math.min(1,s.age*15,(1-s.age01)*5)}}));
   m.smoke=add(sprayEmitter({id:'incendiary-soot',seed,count:16,life:[1.2,2.8],speed:[13,35],angle:[-Math.PI,Math.PI],drag:2.6,radius:[4,8],opacity:.43}));
   m.debris=add(sprayEmitter({id:'incendiary-wet-ejecta',seed,count:25,life:[.3,.8],speed:[45,160],angle:[-Math.PI,Math.PI],drag:3,radius:[1,2]}));
  }else{
   m.cloud=add(sprayEmitter({id:'gas-ground-cloud',seed,count:10,life:[2.2,3.7],speed:[45,92],angle:[-Math.PI,Math.PI],drag:1.8,radius:[4.5,8.5],opacity:.48}));
   m.veils=add(sprayEmitter({id:'gas-thin-curls',seed,count:13,life:[1.4,2.9],speed:[20,60],angle:[-Math.PI,Math.PI],drag:3,radius:[3,7],opacity:.3}));
  }
 }
 return m;
}
function smoke(p,m,t,{warm=0,C=SMOKE,scale=1,opacity=1}={}){if(!m.smoke)return;const col=palette(C,7),list=puffList(p,m.smoke,t,C,{warm,scale,opacity});cloud(p,list,col,col.map((c,i)=>mix(c,palette(FIRE,9)[Math.min(7,i+1)],.55)),{dens:1.3,max:.72,lit:1.2});}
function shell(p,weapon,t,o){const c=weapon==='tank-ap'?STEEL:BRASS,gas=weapon==='tank-gas',inc=weapon==='tank-incendiary',he=weapon==='tank-he';
 if(weapon==='gatling'){const L=24+5*Math.sin(t*TAU*3);p.line(-L,0,-6,0,hex('#bf6637'),.55);p.line(-14,0,0,0,BRASS[3]);p.poly([[-5,-1],[1,-1],[4,0],[1,1],[-5,1]],WHITE);p.glow(0,0,5,BRASS[3],.12);return;}
 discShadow(p,-2,1,5,.28);
 if(weapon==='tank-ap'){
  p.poly([[-17,-2],[5,-1],[10,0],[5,1],[-17,2]],STEEL[0]);p.line(-15,0,8,0,STEEL[3]);p.line(-14,-1,3,-1,STEEL[2]);p.poly([[-16,-4],[-11,-1],[-9,-1],[-13,-4]],STEEL[2]);p.poly([[-16,4],[-11,1],[-9,1],[-13,4]],STEEL[1]);
  p.line(-40,0,-19,0,hex('#b89561'),.45);p.line(-27,0,-18,0,hex('#ffe4a0'),.8);p.glow(-13,0,6,BRASS[3],.1);return;
 }
 const tip=he?9:7;p.poly([[-12,-3],[3,-3],[tip,0],[3,3],[-12,3]],STEEL[0]);p.rect(-11,-2,14,4,c[2]);p.poly([[2,-2],[tip-1,0],[2,2]],c[3]);p.line(-10,-2,2,-2,c[4]);p.line(-10,2,2,2,c[1]);p.rect(-8,-2,2,4,gas?hex(ACID[4]):inc?hex('#cb542f'):hex('#b34533'));p.rect(-11,-2,1,4,STEEL[2]);
 const spin=Math.sin(t*TAU*4);p.px(-4,spin>0?-2:1,gas?hex('#c9df83'):inc?hex('#ffcf71'):c[3]);if(inc)p.glow(-7,0,6,hex('#ed7a36'),.08);
}
export function drawBallistic(p,t,o,m){const {weapon,base,mode,seed}=m,F=palette(FIRE,9),tank=weapon.startsWith('tank-');
 if(base==='launch'){
  smoke(p,m,t,{warm:mode==='burst'?Math.exp(-t*9):.35});
  if(m.cases)particle.draw(p,m.cases,t,{draw:(p,s)=>{const q=local(p,...s.position,s.rotation);q.line(-2,0,1.5,0,s.data.shell?hex('#ae3328'):BRASS[2],s.opacity);q.px(2,0,BRASS[4],s.opacity);q.px(-1,-1,s.data.shell?hex('#e35a3d'):BRASS[3],s.opacity);}});
  planarSparks(p,m.sparks,t,{glow:.1});
  let age=t,shot=0;if(weapon==='gatling'){const tt=mode==='outro'?t:phase(t),latest=Math.floor((tt-.025)*12);const born=latest/12+.025;age=tt-born;shot=latest;if(mode==='outro'&&born>=0||mode==='intro'&&born<0)age=99;}
  if(age>=0&&age<.065){const f=age<1/60?1:2,k=1-age/.065,r=new Rng(seed+shot*7919),size=tank?2.1:weapon==='shotgun'?1.45:.85;
   const lobes=flashShape(r,f,{size,spike:tank?[19,27]:weapon==='shotgun'?[14,22]:[13,23],diag:weapon==='shotgun'?[9,17]:[5,10],cross:[3,8],back:[2,5]});
   if(weapon==='shotgun')for(let i=0;i<5;i++)lobes.push({off:3,a:(i-2)*.19,len:(23-Math.abs(i-2)*3)*k,wid:2.3,core:.25});
   flash(p,1,0,0,lobes,[F[8],F[7],F[5],F[2]],seed+shot);p.glow(10,0,tank?35:20,F[5],.38*k);p.glow(1,0,9,F[7],.3*k);
  }
  if(tank&&t<.28){const u=t/.28;radialRing(p,0,0,3+40*(1-(1-u)**2),Math.max(.6,1.8*(1-u)),F[6],.35*(1-u),seed);}
  return;
 }
 if(base==='flight'){
  if(weapon==='shotgun'){particle.draw(p,m.pellets,t,{draw:(p,s)=>{p.line(s.position[0]-13,s.position[1]-Math.tan(s.data.angle)*13,...s.position,F[5],.45*s.opacity);p.line(s.position[0]-4,s.position[1]-Math.tan(s.data.angle)*4,...s.position,F[7],s.opacity);p.px(...s.position,WHITE,s.opacity);}});return;}
  if(m.wake){const col=weapon==='tank-gas'?['#253b2e','#466341','#77905d','#a8bb7d','#cfdaa0']:weapon==='tank-incendiary'?['#292b30','#464946','#777157','#a39670']:SMOKE;const R=palette(col,7);cloud(p,puffList(p,m.wake,t,col,{opacity:weapon==='tank-gas'?.8:.55}),R,R,{dens:1.05,max:.35});}
  shell(p,weapon,t,o);return;
 }
 if(base==='hit'||base==='exit'){
  const ap=weapon==='tank-ap',f=fadeAt(t,ap?1.4:.9,.3);
  if(f>0){p.ellipse(0,0,ap?6:3.5,ap?4:3,INK,.7*f);if(ap){p.ring(0,0,3.2,1,t<.14?F[5]:STEEL[2],f);p.px(1,-2,STEEL[3],f);}}
  if(t<.07){const k=1-t/.07;p.ellipse(0,0,(ap?12:6)*k+1,(ap?4:3)*k+1,F[6]);p.ellipse(0,0,(ap?8:4)*k,(ap?2.5:2)*k,WHITE);p.glow(0,0,ap?22:13,F[5],.32*k);}
  if(m.dust){const C=palette(SMOKE,7);cloud(p,puffList(p,m.dust,t,SMOKE),C,C,{dens:1.1,max:.56});}
  planarSparks(p,m.sparks,t,{glow:.13});if(m.frags)particle.draw(p,m.frags,t,{draw:(p,s)=>{const r=s.data.radius;p.poly([[s.position[0]-r,s.position[1]],[s.position[0]+r,s.position[1]-r],[s.position[0]+r,s.position[1]+1]],t<.1?BRASS[3]:STEEL[2],s.opacity);}});return;
 }
 if(base==='explosion'){
  if(weapon==='tank-he'){
   const residue=fadeAt(t,2.5,.7);p.shade(-35,-32,35,32,(x,y,out)=>{const a=Math.atan2(y,x),r=Math.hypot(x,y),edge=25+3*Math.sin(a*5)+2*Math.cos(a*9);if(r>edge)return;out.c=r<edge*.7?INK:hex('#5a5144');out.a=residue*(r<edge*.7?.6:.38);});
   smoke(p,m,t,{warm:Math.exp(-t*3.5),scale:1.4});
   particle.draw(p,m.fire,t,{draw:(p,s)=>material.fire(p,s,{colors:FIRE,size:s.data.radius,glow:.2,direction:[Math.cos(rr(seed,s.id,'a',0,TAU)),Math.sin(rr(seed,s.id,'a',0,TAU))]})});
   planarSparks(p,m.debris,t,{glow:.12,size:1.4});
   if(t<.055){const k=1-t/.055;p.circle(0,0,18+10*(1-k),F[6]);p.circle(0,0,14*k+4,WHITE);p.glow(0,0,65,F[5],.65*k);}
   if(t<.45){const u=t/.45;radialRing(p,0,0,9+93*(1-(1-u)**2.3),Math.max(.5,2.3*(1-u)),u<.2?F[7]:hex('#b7a787'),(1-u)*.75,seed,9);}
  }else if(weapon==='tank-incendiary'){
   const patches=particle.sample(m.patches,t),fuel=patches.map(s=>({x:s.position[0],y:s.position[1],r:s.data.radius*2.8,a:s.opacity*.65,b:.35,w:0}));const fuelRamp=palette(['#201e22','#372b26','#513425','#6e4029'],7);cloud(p,fuel,fuelRamp,fuelRamp,{dens:1.5,max:.7,lit:.8});
   // A continuous fuel sheet with moving fissures and ragged tongues. The
   // field is built from the actual fuel patches; no circular fire sprites.
   p.shade(-80,-75,80,75,(x,y,out)=>{let field=0,weight=0;for(const s of patches){const r=s.data.radius*2.1,d=Math.hypot(x-s.position[0],(y-s.position[1])*1.08)/r;const f=Math.max(0,1-d*d);field+=f*s.opacity;weight=Math.max(weight,s.opacity*f);}
    const n=tileNoise(x*.12+t*1.3,y*.12-t*2.6,0,0,seed),fine=tileNoise(x*.28-t*1.7,y*.28+t*2.1,0,0,seed+19),edge=.17+n*.24;if(field<edge)return;const intensity=clamp((field-edge)*.9+n*.43+fine*.22);out.c=F[Math.min(6,1+Math.floor(intensity*5.5))];out.a=Math.min(1,weight*2.2)*(field<edge+.15?.7:1);
   });
   for(const s of patches){const[x,y]=s.position,a=s.opacity,r=s.data.radius;for(let k=0;k<3;k++){const an=k*TAU/3+s.data.phase,dx=Math.cos(an),dy=Math.sin(an),f=.5+.5*Math.sin(t*TAU*5+s.data.phase+k*2),L=r*(.6+f*.9);p.poly([[x-dy*r*.35,y+dx*r*.35],[x+dx*L-dy*r*.1,y+dy*L+dx*r*.1],[x+dx*(L+r*.4),y+dy*(L+r*.4)],[x+dy*r*.3,y-dx*r*.3]],F[4],a*.8);p.line(x,y,x+dx*L*.6,y+dy*L*.6,F[5],a*.7);}p.glow(x,y,r*2.1,F[4],a*.055);}
   smoke(p,m,t,{warm:.3*Math.max(0,1-t/2),opacity:.55});
   planarSparks(p,m.debris,t,{glow:.1});if(t<.07){const k=1-t/.07;p.circle(0,0,7*k+1,F[7]);p.glow(0,0,28,F[5],.3*k);}
  }else{
   const colors=['#293c2e','#3c5738','#597443','#7d9457','#a3b77b','#c8d59c','#e0e5bb'],C=palette(colors,7);
   const list=puffList(p,m.cloud,t,colors,{scale:1.7}).map(q=>({...q,x:q.x+t*6+Math.sin(t*1.3+q.y*.07)*t*2,y:q.y+t*2+Math.cos(t+q.x*.05)*t,r:q.r*(.88+.12*Math.sin(t*1.4+q.x*.08)),a:q.a*.8,b:.45+q.b*.2,w:0}));cloud(p,list,C,C,{dens:1.15,max:.56,lit:.85});
   cloud(p,puffList(p,m.veils,t,colors,{scale:1.5,opacity:.5}).map(q=>({...q,x:q.x+t*11,y:q.y-3,w:0})),C,C,{dens:.9,max:.35});
   const fade=fadeAt(t,3.9,.65);for(let i=0;i<7;i++){const x=rr(seed,i,'bubble-x',-33,40)+t*7,y=rr(seed,i,'bubble-y',-29,30),a=(t*1.7+rr(seed,i,'bubble-phase'))%1;if(a<.4&&t>.25)p.arc(x,y,2+a*6,1,.2,4.7,C[5],(1-a/.4)*.27*fade);}
  }
 }
}
export function observeBallistic(m,t){return {particles:m.emitters.map(e=>particle.observe(e,t)),bodies:m.bodies.map(b=>body.observe(b,t))};}
