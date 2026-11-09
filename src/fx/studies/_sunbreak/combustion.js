// SUNBREAK / original art-directed pixel fireball study, 2026-11-08.
// New fused front-volume/combustion shader, not a copy of a library preset.
// Retains Athanor's seeded RNG, Painter, color/light separation and analytic
// drag recipe. Existing explosion lobe/Plume and projectile cloud were studied;
// their separate-puff drawing is deliberately replaced by one fused surface.
// Art references/credits and the adaptation boundaries are in RESEARCH.md.
import {hex,Rng,smooth,clamp,TAU} from '../../../core/index.js';

const FIRE=['#4a1712','#4a1712','#8a1f17','#c9281f','#f2561d','#ff8a2a','#ffc23d','#ffe26b','#fff3a6','#fff3a6','#ffffff'].map(hex);
const designs=new Map();
function design(seed){
  if(designs.has(seed))return designs.get(seed);
  const R=new Rng(seed),noise=new Float32Array(32*32*32);
  for(let i=0;i<noise.length;i++)noise[i]=R.next()*2-1;
  const lobes=Array.from({length:14},(_,i)=>{
    const a=i*2.399963+.22,depth=i<8?R.range(-.25,.55):R.range(.45,.85);
    return {a,depth,rad:R.range(.32,.47),reach:i<8?R.range(.63,.85):R.range(.22,.55),phase:R.range(0,TAU),speed:R.range(.65,1.3)};
  });
  const embers=Array.from({length:32},(_,i)=>({born:i<10?R.range(.02,.1):R.range(.3,.8),a:R.range(-Math.PI,.15),speed:i<10?R.range(260,330):R.range(22,58),life:i<10?R.range(.4,.65):R.range(.5,1.15),size:R.next(),phase:R.range(0,TAU),skin:i>=10}));
  const tongues=Array.from({length:9},(_,i)=>({a:-Math.PI+.27+i*.33,phase:R.range(0,TAU),length:R.range(8,19),born:R.range(.12,.4)}));
  const result={noise,lobes,embers,tongues};designs.set(seed,result);return result;
}
function noise3(table,x,y,z){
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);let u=x-ix,v=y-iy,w=z-iz;
  u=u*u*(3-2*u);v=v*v*(3-2*v);w=w*w*(3-2*w);
  const x0=ix&31,x1=(ix+1)&31,y0=(iy&31)*32,y1=((iy+1)&31)*32,z0=(iz&31)*1024,z1=((iz+1)&31)*1024;
  const a=table[x0+y0+z0]+u*(table[x1+y0+z0]-table[x0+y0+z0]);
  const b=table[x0+y1+z0]+u*(table[x1+y1+z0]-table[x0+y1+z0]);
  const c=table[x0+y0+z1]+u*(table[x1+y0+z1]-table[x0+y0+z1]);
  const d=table[x0+y1+z1]+u*(table[x1+y1+z1]-table[x0+y1+z1]);
  return a+v*(b-a)+w*(c+v*(d-c)-a-v*(b-a));
}
export function stateAt(t,o){
  const g=1-Math.exp(-t*11),late=smooth(1.05,2.4,t),rise=21*(1-Math.exp(-t*2.4))+t*11;
  return {radius:(4+65*g+8*smooth(.25,.9,t))*o.power,center:[-2*Math.sin(t*2.7),-20-rise],growth:g,late,
    heat:o.heat*(.96-.14*smooth(.06,.35,t)-.2*smooth(.65,1.2,t)-.35*smooth(1.1,1.9,t)-.45*smooth(1.6,2.5,t)),erosion:smooth(1.55,2.75,t)};
}
// The same fused surface drives the flame and the smoke handoff.
export function combustionSurface(t,o){
  const D=design(o.seed),S=stateAt(t,o);
  const R=S.radius,cx=S.center[0];let cy=S.center[1];const spin=(1-Math.exp(-t*2.2))*1.6*o.roll;
  const balls=[{x:cx,y:cy,z:0,r:R*(.81-.31*smooth(.95,2.2,t)),phase:2.4,angle:.25,stretch:.06}];
  for(const q of D.lobes){
    const roll=t*q.speed*1.75+q.phase,a=q.a+.17*Math.sin(roll),spread=1+.21*smooth(.3,1.8,t),r=R*q.rad*(1+.16*Math.sin(roll+1.5))*(1-.17*S.erosion);
    balls.push({x:cx+Math.cos(a)*R*q.reach*spread*1.08,y:cy+Math.sin(a)*R*q.reach*spread*.88-5*smooth(.4,2.1,t)*Math.sin(q.phase),z:R*q.depth+Math.sin(spin*q.speed+q.phase)*R*.13,r,phase:q.phase,angle:q.a*.45+q.phase*.32+roll*.12,stretch:.16*Math.sin(q.phase+roll*.22)});
  }
  const n3=(x,y,z)=>noise3(D.noise,x,y,z),cs=Math.cos(spin),sn=Math.sin(spin),k=R*.075;
  // Smooth anisotropy, low harmonics and a shared broad warp break the
  // repeated round lobes without roughening their pixel-art contours.
  for(const b of balls){
    b.rx=b.r*(1+b.stretch);b.ry=b.r*(1-b.stretch*.7);
    b.cs=Math.cos(b.angle);b.sn=Math.sin(b.angle);
    b.ex=Math.hypot(b.rx*b.cs,b.ry*b.sn)*1.085+R*.045;
    b.ey=Math.hypot(b.rx*b.sn,b.ry*b.cs)*1.085+R*.04;
  }
  // Grounded blast: keep the full organic silhouette above the floor.
  // The same shifted surface supplies the smoke; no lower-half clipping.
  const lift=Math.max(0,...balls.map(b=>b.y+b.ey+3));
  cy-=lift;S.center[1]=cy;for(const b of balls)b.y-=lift;
  const bounds=balls.reduce((a,b)=>[Math.min(a[0],b.x-b.ex),Math.min(a[1],b.y-b.ey),Math.max(a[2],b.x+b.ex),Math.max(a[3],b.y+b.ey)],[Infinity,Infinity,-Infinity,-Infinity]);
  return {S,bounds,at(x,y){
    let front=-1e5,nx=0,ny=0,nz=1;
    const fx=(x-cx)/R,fy=(y-cy)/R;
    const warpX=R*.045*n3(fx*1.9+8,fy*1.9-t*.28+14,t*.23+5);
    const warpY=R*.04*n3(fx*1.9+23,fy*1.9-t*.28+3,t*.23+19);
    for(const b of balls){
      const dx=x+warpX-b.x,dy=y+warpY-b.y;
      const ex=(dx*b.cs+dy*b.sn)/b.rx,ey=(-dx*b.sn+dy*b.cs)/b.ry;
      const radius=Math.hypot(ex,ey),angle=Math.atan2(ey,ex);
      const ripple=1+smooth(.12,.65,radius)*(.055*Math.sin(angle*3+b.phase+t*.65)+.03*Math.sin(angle*5-b.phase*.7-t*.38));
      const d2=radius*radius/(ripple*ripple);if(d2>=1)continue;
      const lz=Math.sqrt(1-d2),z=b.z+lz*b.r;
      const lx=(ex*b.cs-ey*b.sn)/ripple,ly=(ex*b.sn+ey*b.cs)/ripple;
      if(front<-1e4){front=z;nx=lx;ny=ly;nz=lz;continue;}
      const h=clamp(.5+.5*(z-front)/k);
      front=front+(z-front)*h+k*h*(1-h);
      nx=nx*(1-h)+lx*h;ny=ny*(1-h)+ly*h;nz=nz*(1-h)+lz*h;
    }
    if(front<-1e4)return;
    const px=(x-cx)/R,py=(y-cy)/R,pz=front/R;
    const wx=px*cs+pz*sn,wz=-px*sn+pz*cs;
    const drift=n3(wx*1.9+7,py*1.9-t*.4,wz*1.9+3);
    const fold=n3(wx*2.8+11+drift*.9,py*2.8-t*.85+13,wz*2.8+19);
    const fine=n3(wx*7+fold*.9+5,py*7-t*1.25+7,wz*7+fold*.7+2);
    const grain=n3(wx*20+2,py*20-t*1.9,wz*20+4);
    const edge=clamp((nz-.12)*2.8),core=clamp(1-Math.hypot(px*.82,py*.9));
    const seam=1-smooth(.025,.17,Math.abs(fold+fine*.17));
    const heat=S.heat+fold*.33+fine*.16+core*.15-(1-edge)*.14-seam*.13;
    const erosion=n3(wx*4+22,py*4-t*.24+3,wz*4+5)*.35+.52+fine*.12;
    if(S.erosion>erosion)return;
    return {heat,grain,erosion,fold,fine,nx,ny,nz,coverage:clamp((erosion-S.erosion)*13)*(1-smooth(2.48,2.85,t))};
  }};
}
function volume(p,t,o,D,S){
  const surface=combustionSurface(t,o);
  p.each(...surface.bounds,(x,y,sx,sy)=>{
    const f=surface.at(x,y);if(!f)return;
    const {heat,grain,coverage}=f;
    // Retain the approved fire shader. Cold spherical shading is gone;
    // advected smoke below now carries the cooling material away.
    if(heat<=.12)return;
    let c,alpha=1;
    if(heat>.24){
      const h=heat+grain*.018;
      const index=h<.31?1:h<.4?2:h<.54?4:h<.70?5:h<.90?6:h<1.05?8:h<1.2?9:10;
      c=FIRE[index];
      if(index>=6)p.add(sx,sy,c,(index-5)*.009*(1-S.erosion));
    }else{c=FIRE[heat>.2?2:1];alpha=smooth(.12,.24,heat);}
    p.blendPx(sx,sy,c,alpha*coverage);
  });
}

function accents(p,t,o,D,S){
  // Sparse coherent escaping fire tongues; each grows out of the same skin.
  if(t<1.15){
    const R=S.radius;
    for(const q of D.tongues){
      const u=(t-q.born)/.62;if(u<=0||u>=1)continue;
      const a=q.a+.12*Math.sin(t*5+q.phase),e=Math.sin(u*Math.PI),x=S.center[0]+Math.cos(a)*R*.98,y=S.center[1]+Math.sin(a)*R*.94;
      const len=q.length*1.5*e,cs=Math.cos(a),sn=Math.sin(a),w=3.7*e,tx=x+cs*len-sn*len*.42,ty=y+sn*len+cs*len*.42;
      p.poly([[x-sn*w,y+cs*w],[x+cs*len*.48-sn*w*.8,y+sn*len*.48+cs*w*.8],[tx,ty],[x+cs*len*.35+sn*w*.45,y+sn*len*.35-cs*w*.45],[x+sn*w,y-cs*w]],FIRE[4]);
      p.poly([[x-sn*w*.4,y+cs*w*.4],[x+cs*len*.7-sn*w*.2,y+sn*len*.7+cs*w*.2],[x+cs*len*.3+sn*w*.4,y+sn*len*.3-cs*w*.4]],FIRE[7]);
    }
  }
}
export function drawFire(p,t,o){
  if(t<0||t>=2.9)return;
  const D=design(o.seed),S=combustionSurface(t,o).S;
  // Broad low glow, never an opaque halo ring or a replacement for fire shape.
  if(t<1.65)p.glow(S.center[0],S.center[1],S.radius*1.5,FIRE[5],.035*(1-smooth(.15,1.65,t)));
  accents(p,t,o,D,S);
  volume(p,t,o,D,S);
}

// Retained editable artwork; technical checks do not imply final art approval.
export const asset={status:"study",source:"experiments/vfx-lab/productions/2026-11-08-fireball-grenade/combustion.js",revision:"f207224ec08573ec71c8832c657ebd5ff1d998e9"};
