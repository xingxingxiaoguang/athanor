// Frozen artwork source: experiments/vfx-lab/productions/2026-11-07-arsenal/art/_fluids.js
// Original pressure-column / viscous acid / cryogenic cone compositions.
// Reuses water bead, layered cloud and ice fracture implementation via SDK.
import {hex,fit,mix,clamp,smooth,TAU,tileNoise,tileFbm,particle,body,material,propagation,cloud,WATER,ACID,FROST,INK,rr,phase,fadeAt,births,palette,local,discShadow,radialRing} from '../91c1b9989a625cbcc307/_common.js';
const COLORS={water:WATER,acid:ACID,cold:FROST};
export function buildFluid(weapon,stage,o){const base=stage.replace(/-(intro|outro)$/,''),mode=stage.endsWith('-intro')?'intro':stage.endsWith('-outro')?'outro':'loop',seed=o.seed??53,C=COLORS[weapon],m={weapon,stage,base,mode,seed,colors:C,emitters:[],bodies:[]};const add=e=>(m.emitters.push(e),e);
 const n=base==='flight'?weapon==='cold'?42:48:base==='hit'?32:14;
 const records=births(`${weapon}-${base}`,mode,n,weapon==='cold'?1.15:.8).map(b=>({...b,position:[0,0]}));
 m.drops=add(particle.emitter({id:weapon+'-'+base+'-drops',seed,births:records,initial:({rand,birth})=>{
  const speed=base==='launch'?rand('speed',18,48):base==='flight'?rand('speed',130,215):rand('speed',35,100),angle=base==='hit'?rand('angle',1.1,5.2):rand('angle',weapon==='cold'?-.25:-.1,weapon==='cold'?.25:.1),life=base==='launch'?[.1,.3]:weapon==='cold'?[.5,.85]:base==='flight'?[.4,.7]:[.22,.65];
  return {life,velocity:[Math.cos(angle)*speed,Math.sin(angle)*speed],opacity:weapon==='cold'?.6:.9,data:{radius:rand('size',weapon==='acid'?1.4:.7,weapon==='acid'?3.1:weapon==='cold'?2.2:1.8),phase:rand('phase',0,TAU)}};
 },motion:{drag:base==='flight'?weapon==='cold'?.5:.8:2.8},material:{opacity:s=>Math.min(1,s.age*35,(1-s.age01)*4)}}));
 if(weapon==='cold'||base==='hit')m.mist=add(particle.emitter({id:weapon+'-'+base+'-mist',seed:seed+1,births:births(`${weapon}-${base}-mist`,mode,weapon==='cold'?18:9,1.1),initial:({rand})=>{const angle=base==='hit'?rand('a',0,TAU):rand('a',-.25,.25),speed=base==='launch'?rand('speed',8,20):base==='flight'?rand('speed',60,120):rand('speed',4,18);return {life:[.4,.85],velocity:[Math.cos(angle)*speed,Math.sin(angle)*speed],opacity:weapon==='cold'?.4:.25,data:{radius:rand('radius',weapon==='cold'?3:2,weapon==='cold'?7:4),bright:rand('b',.6,1)}};},motion:{drag:1.1},material:{opacity:s=>Math.min(1,s.age*12)*(1-s.age01)**1.3}}));
 if(base==='hit'&&weapon==='cold')m.fractures=propagation.fractures({id:'cryo-ground-veins',seed,arms:8,steps:16,stepPx:[1.5,2],fork:.14,inside:(x,y)=>x*x+y*y<28*28});
 const bounds=base==='flight'?[0,-44,170,88]:base==='launch'?[-5,-10,30,20]:[-35,-35,70,70];
 m.bodies.push(body.create({id:`${weapon}-${base}-field`,bounds,data:t=>({weapon,stage,phase:mode==='loop'?phase(t):t,emitting:mode!=='outro',front:base==='flight'?(mode==='intro'?Math.min(o.range??128,t*210):o.range??128):0,tail:base==='flight'&&mode==='outro'?Math.min(128,t*210):0})}));return m;
}
function drawDroplets(p,m,t,C){return particle.draw(p,m.drops,t,{draw:(p,s)=>{const[x,y]=s.position,r=s.data.radius,a=s.opacity,vel=s.velocity;if(m.base==='flight'&&x>151)return;
 if(m.weapon==='water')material.waterDrop(p,s,{colors:WATER,size:r,glow:0});
 else if(m.weapon==='acid'){discShadow(p,x,y,r+.5,.2*a);p.circle(x,y,r+1,C[1],a);p.circle(x-.3,y-.3,r,C[4],a);p.px(x-.8,y-.8,C[7],a);if(r>2)p.circle(x+.6,y+.3,.65,C[2],a);}
 else{const angle=Math.atan2(vel[1],vel[0])+s.data.phase,q=local(p,x,y,angle);q.poly([[-r,0],[0,-r*.6],[r*1.8,0],[0,r*.6]],C[3],a);q.line(-r,0,r*1.8,0,C[7],a);q.px(0,-r*.6,C[6],a);}
 }});}
function jet(p,t,o,m){const C=palette(m.colors),L=o.range??128,stop=m.mode==='outro',tail=stop?t*(m.weapon==='acid'?165:210):0;
 if(tail>=L)return;const phaseT=phase(t);
 if(m.weapon==='cold'){
  p.each(2,-43,L+2,43,(x,y,sx,sy)=>{const u=x/L,w=2.5+u*30,ac=y/w;if(u<0||u>1||x<tail||m.mode==='intro'&&x>t*210||Math.abs(ac)>=1)return;const n=tileFbm(x*.06-phaseT*9,y*.12,9,0,m.seed,2),edge=(1-ac*ac)*Math.min(1,x/8)*Math.min(1,(L-x)/26),dens=clamp((.5+n*.9)*edge);if(dens<.12)return;const alpha=Math.min(.48,dens*.68)*(stop?Math.min(1,(x-tail)/8+Math.max(0,1-t*30)):1);p.blendPx(sx,sy,dens>.65?C[6]:dens>.36?C[4]:C[2],alpha);});
  for(let i=0;i<5;i++){const x=(phaseT*L+i*L/5)%L,y=Math.sin(i*2.6+phaseT*TAU)*(.8+x*.12);if(x>tail){p.line(x-9,y,x+3,y,C[6],.38);p.px(x+3,y,C[7],.6);}}return;
 }
 const acid=m.weapon==='acid',head=m.mode==='intro'?Math.min(L,t*210):L;
 p.each(0,-12,L+2,12,(x,y,sx,sy)=>{if(x<tail||x<0||x>head)return;const u=x/L,flow=x*.1-phaseT*TAU*4,yc=Math.sin(x*.065-phaseT*TAU*3)*(acid?1.7:1.05)*(u+.2),w=(acid?3.2:1.6)+u*(acid?2.5:3.8)+(acid?.75:1.1)*Math.sin(flow),ac=(y-yc)/w;
  if(Math.abs(ac)>1)return;if(!acid&&u>.72&&tileNoise(x*.12-phaseT*24,y*.7,24,0,m.seed+2)<-1+(u-.72)*2)return;if(acid&&u>.2&&Math.sin(x*.07-phaseT*TAU*3+y*.6)<-.83)return;
  const flowNoise=tileNoise(x*.11-phaseT*20,Math.floor((y-yc)*2),20,0,m.seed),bright=ac<-.18&&ac>-.65,foam=flowNoise>.5&&u>.5;
  const col=Math.abs(ac)>.8?C[2]:bright?C[7]:Math.abs(ac)<.3?C[5]:C[4],a=(acid?.94:.78)*(Math.abs(ac)>.8?.55:1)*Math.min(1,Math.max(0,(L-x)/17))*(stop?Math.min(1,(x-tail)/5+Math.max(0,1-t*30)):1);
  p.blendPx(sx,sy,foam?C[6]:col,a);if(!acid&&bright&&flowNoise>.18)p.put(sx,sy,C[7],a*.75);
 });
 if(acid)for(let i=0;i<7;i++){const x=(phaseT*L+i*L/7)%L,y=Math.sin(i*2.1+phaseT*TAU)*1.5,r=3+Math.sin(i+phaseT*TAU)*.8;if(x>tail+3&&x<L-12){p.ellipse(x,y,r*1.8,r,C[2],.85);p.ellipse(x-.7,y-.5,r*1.6,r*.75,C[4],.9);p.arc(x,y,r*.8,.8,3.2,5.2,C[7],.8);}}
 if(acid)for(let i=0;i<5;i++){const x=(phaseT*L+i*L/5)%L,y=Math.sin(i*2.1+phaseT*TAU)*2;if(x>tail+4)p.arc(x,y,1.6,1,.3,4.3,C[2],.7);}
}
export function drawFluid(p,t,o,m){const C=palette(m.colors),outro=m.mode==='outro',f=outro?fadeAt(t,m.base==='hit'?1.8:1.2,.4):1,phaseT=outro?t:phase(t);
 if(m.base==='flight')jet(p,t,o,m);
 if(m.base==='hit'){
  const acid=m.weapon==='acid',cold=m.weapon==='cold',r=(cold?26:acid?21:15)*(m.mode==='intro'?Math.min(1,t*4):1),cover=f*(outro?Math.max(0,1-t/2):1),border=r+Math.sin(phaseT*TAU*2)*1.2;
  p.shade(-r-4,-r-4,r+4,r+4,(x,y,out)=>{const a=Math.atan2(y,x),d=Math.hypot(x,y),edge=border+1.5*Math.sin(a*7)+Math.cos(a*11);if(d>edge)return;
   out.c=cold?C[4]:acid?d>edge-2?C[6]:d<edge*.55?C[2]:C[4]:d>edge-1?C[5]:C[3];out.a=cover*(cold?.3:acid?.6:.22)*(d>edge-1?.65:1);});
  if(cold&&m.fractures){const front=outro?m.fractures.maxDistancePx*Math.max(0,1-t/1.6):m.fractures.maxDistancePx*(m.mode==='intro'?Math.min(1,t*1.8):1);for(const s of propagation.segments(m.fractures,{toPx:front})){p.line(...s.a,...s.b,C[2],.8*f);p.line(s.a[0]-.5,s.a[1]-.5,s.b[0]-.5,s.b[1]-.5,C[6],f);}for(let i=0;i<6;i++){const a=i*TAU/6+.3,x=Math.cos(a)*18,y=Math.sin(a)*18;p.poly([[x-2,y],[x,y-4],[x+4,y],[x,y+2]],C[3],.7*f);p.line(x-2,y,x+4,y,C[7],f);}}
  if(!cold)for(let i=0;i<3;i++){const u=(phaseT*3+i/3)%1;if(outro&&t>1-i*.1)continue;const rad=(acid?5:3)+u*(acid?14:20);p.arc(-3,0,rad,1,.3+i,4.9+i,C[acid?6:7],(1-u)*.4*cover);}
  if(acid)for(let i=0;i<8;i++){const u=(phaseT*2+rr(m.seed,i,'ph'))%1,x=rr(m.seed,i,'x',-17,17),y=rr(m.seed,i,'y',-15,15);if(u<.5){p.circle(x,y,1.3+u*2,C[1],.65*f);p.arc(x,y,1.3+u*2,.8,3.2,5.5,C[7],.8*f);}}
 }
 if(m.mist){const R=palette(m.weapon==='acid'?['#445b36','#7c8c61','#b4bd93','#e0e3c1']:m.colors,7),list=particle.sample(m.mist,t).map(s=>({x:s.position[0],y:s.position[1],r:s.data.radius*(1+s.age01*1.8),a:s.opacity*(m.weapon==='cold'?.75:.5),b:s.data.bright,w:0}));cloud(p,list,R,R,{dens:1.05,max:m.weapon==='cold'?.5:.3,lit:1.2});}
 drawDroplets(p,m,t,C);
 if(m.base==='launch'){
  const pressure=(outro?Math.exp(-t*30):1)*(.94+.06*Math.sin(phaseT*TAU*12));if(pressure>.01){p.ellipse(3,0,m.weapon==='cold'?4:3,m.weapon==='acid'?3.1:2,C[3],pressure*.7);p.line(0,-1,6,-1,C[6],pressure*.9);p.px(1,-1,C[7],pressure);if(m.weapon==='cold')p.arc(0,0,7,1,-.9,.9,C[5],.45*pressure);}
 }
}
export function observeFluid(m,t){return {particles:m.emitters.map(e=>particle.observe(e,t)),bodies:m.bodies.map(b=>body.observe(b,t))};}
