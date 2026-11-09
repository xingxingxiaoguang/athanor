// DRIFT / original non-spherical smoke master, 2026-11-08.
// Continuous 2D advected density, pressure projection and vorticity confinement.
// Conceptual numerical reference: Stam / Mark Harris, GPU Gems chapter 38;
// original CPU implementation for this artwork, not copied GPU/Cg source.
// Density-gradient lighting adapts Athanor projectiles/_lib.cloud's mature
// merged-cloud recipe, retaining Sprite Fusion / Hugo Duprez / MIT credit.
// No puff spheres, disc particles, spherical normals or additive smoke glow.
import {hex,noise2,smooth,clamp,mix as mixColor} from '../../../core/index.js';
import {combustionSurface} from './combustion.js';

const COLORS=['#1a171e','#2b2630','#2b2630','#433d48','#433d48','#5d5660','#5d5660','#7b6f72'].map(hex);
const WARM=['#1a1422','#2b1e26','#3a272b','#4a3030','#5a403b','#70564c','#80675a','#927b68'].map(hex);
const W=192,H=192,N=W*H,CELL=2,X0=-176,Y0=-306,HZ=60,DT=1/HZ;
const caches=new Map();
const zero=()=>new Float32Array(N);
function sample(a,x,y){
  x=clamp(x,.5,W-1.501);y=clamp(y,.5,H-1.501);
  const i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j,k=j*W+i;
  const top=a[k]+u*(a[k+1]-a[k]),bot=a[k+W]+u*(a[k+W+1]-a[k+W]);
  return top+v*(bot-top);
}
function advect(out,src,u,v,dt,damping=1){
  out.fill(0);
  for(let y=1;y<H-1;y++)for(let x=1,i=y*W+1;x<W-1;x++,i++)out[i]=sample(src,x-dt*u[i],y-dt*v[i])*damping;
}
function advectDetailed(out,src,u,v,scratch,dt,damping){
  advect(out,src,u,v,dt);advect(scratch,out,u,v,-dt);
  // Bounded MacCormack correction preserves dragged-out smoke filaments;
  // extrema are limited to the original departure neighbourhood.
  for(let y=1;y<H-1;y++)for(let x=1,i=y*W+1;x<W-1;x++,i++){
    const px=clamp(x-dt*u[i],.5,W-1.501),py=clamp(y-dt*v[i],.5,H-1.501),ix=Math.floor(px),iy=Math.floor(py),k=iy*W+ix;
    const lo=Math.min(src[k],src[k+1],src[k+W],src[k+W+1]),hi=Math.max(src[k],src[k+1],src[k+W],src[k+W+1]);
    out[i]=clamp(out[i]+.5*(src[i]-scratch[i]),lo,hi)*damping;
  }
}
function project(u,v,p,q,div){
  p.fill(0);q.fill(0);
  for(let y=1;y<H-1;y++)for(let x=1,i=y*W+1;x<W-1;x++,i++)div[i]=.5*(u[i+1]-u[i-1]+v[i+W]-v[i-W]);
  for(let step=0;step<22;step++){
    for(let y=1;y<H-1;y++)for(let x=1,i=y*W+1;x<W-1;x++,i++)q[i]=.25*(p[i-1]+p[i+1]+p[i-W]+p[i+W]-div[i]);
    [p,q]=[q,p];
  }
  for(let y=1;y<H-1;y++)for(let x=1,i=y*W+1;x<W-1;x++,i++){
    u[i]-=.5*(p[i+1]-p[i-1]);v[i]-=.5*(p[i+W]-p[i-W]);
  }
}
function blur(src){
  const tmp=zero(),out=zero();
  for(let y=2;y<H-2;y++)for(let x=2,i=y*W+2;x<W-2;x++,i++)tmp[i]=(src[i-2]+src[i-1]*2+src[i]*3+src[i+1]*2+src[i+2])/9;
  for(let y=2;y<H-2;y++)for(let x=2,i=y*W+2;x<W-2;x++,i++)out[i]=(tmp[i-W*2]+tmp[i-W]*2+tmp[i]*3+tmp[i+W]*2+tmp[i+W*2])/9;
  return out;
}
function wideBlur(src){
  let a=src;
  for(let pass=0;pass<2;pass++){
    const tmp=zero(),out=zero(),r=6,n=13;
    for(let y=1;y<H-1;y++){
      let acc=0;for(let x=0;x<=r;x++)acc+=a[y*W+x];
      for(let x=0;x<W;x++){tmp[y*W+x]=acc/n;if(x-r>=0)acc-=a[y*W+x-r];if(x+r+1<W)acc+=a[y*W+x+r+1];}
    }
    for(let x=1;x<W-1;x++){
      let acc=0;for(let y=0;y<=r;y++)acc+=tmp[y*W+x];
      for(let y=0;y<H;y++){out[y*W+x]=acc/n;if(y-r>=0)acc-=tmp[(y-r)*W+x];if(y+r+1<H)acc+=tmp[(y+r+1)*W+x];}
    }
    a=out;
  }
  return a;
}
function store(d){
  let x0=W,y0=H,x1=0,y1=0,total=0;const wide=wideBlur(d);
  for(let y=1;y<H-1;y++)for(let x=1,i=y*W+1;x<W-1;x++,i++)if(d[i]+wide[i]*.75>.002){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);total+=d[i];}
  return {d:d.slice(),b:blur(d),w:wide,bounds:[x0-3,y0-3,x1+3,y1+3],mass:total};
}
function simulation(o){
  const key=JSON.stringify([o.seed,o.smokeSeed,o.power,o.heat,o.roll,o.wind,o.buoyancy,o.curl]);
  if(caches.has(key))return caches.get(key);
  const s={o,step:0,u:zero(),v:zero(),u0:zero(),v0:zero(),d:zero(),d0:zero(),scratch:zero(),heat:zero(),heat0:zero(),p:zero(),q:zero(),div:zero(),omega:zero(),frames:[],gust:zero()};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)s.gust[y*W+x]=noise2(x*.075,y*.075,o.smokeSeed);
  // A divergence-free ambient crossflow (stream-function derivatives) carries
  // the whole smoke sheet, rather than giving individual puffs launch speeds.
  const psi=zero();for(let y=0;y<H;y++)for(let x=0;x<W;x++)psi[y*W+x]=noise2(x*.038,y*.038,o.smokeSeed+23)+.33*noise2(x*.105,y*.105,o.smokeSeed+93);
  for(let y=1;y<H-1;y++)for(let x=1,i=y*W+1;x<W-1;x++,i++){
    s.u[i]=6*o.wind+(psi[i+W]-psi[i-W])*150*o.curl;
    s.v[i]=-17*o.buoyancy-(psi[i+1]-psi[i-1])*150*o.curl;
  }
  s.frames.push(store(s.d));caches.set(key,s);return s;
}
function tick(s){
  const {o,u,v,u0,v0,d,d0,scratch,heat,heat0,p,q,div,omega,gust}=s,t=(s.step+1)*DT;
  // Buoyancy and a weak crosswind act on the same transported smoke field.
  for(let y=1;y<H-1;y++)for(let x=1,i=y*W+1;x<W-1;x++,i++){
    u[i]+=DT*(6*o.wind-u[i]*.10)*.2;
    v[i]+=DT*(-35*heat[i]*o.buoyancy+.7*d[i]-.05*(v[i]+17*o.buoyancy));
    omega[i]=.5*(v[i+1]-v[i-1]-u[i+W]+u[i-W]);
  }
  for(let y=2;y<H-2;y++)for(let x=2,i=y*W+2;x<W-2;x++,i++){
    if(d[i]<.002)continue;
    const gx=Math.abs(omega[i+1])-Math.abs(omega[i-1]),gy=Math.abs(omega[i+W])-Math.abs(omega[i-W]),n=Math.hypot(gx,gy)+1e-5;
    u[i]+=DT*gy/n*omega[i]*6*o.curl;v[i]-=DT*gx/n*omega[i]*6*o.curl;
  }
  advect(u0,u,u,v,DT,.998);advect(v0,v,u,v,DT,.998);
  u.set(u0);v.set(v0);project(u,v,p,q,div);
  const decay=Math.exp(-DT*(.08+.48*smooth(1.2,3.3,t)));
  advectDetailed(d0,d,u,v,scratch,DT,decay);advect(heat0,heat,u,v,DT,Math.exp(-DT*.8));d.set(d0);heat.set(heat0);
  // This artwork inherits cooling mass from SUNBREAK's actual fused surface.
  // It does not launch a second ground-level plume or retain cold sphere normals.
  const emit=smooth(.65,1.05,t)*(1-smooth(1.65,2.0,t));
  if(emit>0){
    const surface=combustionSurface(t,o),[cx,cy]=surface.S.center,R=surface.S.radius;
    const [bx0,by0,bx1,by1]=surface.bounds;
    const x0=Math.max(1,Math.floor((bx0-X0)/CELL)),x1=Math.min(W-2,Math.ceil((bx1-X0)/CELL));
    const y0=Math.max(1,Math.floor((by0-Y0)/CELL)),y1=Math.min(H-2,Math.ceil((by1-Y0)/CELL));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const wx=X0+x*CELL,wy=Y0+y*CELL,f=surface.at(wx,wy);if(!f)continue;
      const cool=1-smooth(.22,.65,f.heat),i=y*W+x;
      const amount=DT*emit*cool*f.coverage;
      d[i]=Math.min(3.5,d[i]+amount*3.4);heat[i]=Math.min(.9,heat[i]+amount*1.4);
      const dx=(wx-cx)/R,dy=(wy-cy)/R;
      u[i]+=amount*4*(dx*10+6*o.wind-u[i]);
      v[i]+=amount*4*(dy*7-17*o.buoyancy-v[i]);
    }
  }
  s.step++;s.frames.push(store(d));
}
export function smokeState(time,o){
  const s=simulation(o),position=Math.max(0,time)*HZ,lo=Math.floor(position+1e-9),hi=Math.ceil(position-1e-9);
  while(s.step<hi)tick(s);
  const a=s.frames[lo],b=s.frames[hi],mix=position-lo;
  return {a,b,mix,time,simulationHz:HZ,kind:'advected-density'};
}
export function drawSmoke(p,t,o){
  if(t<=.8||t>=2.99)return;
  const {a,b,mix}=smokeState(t,o),end=(1-smooth(2.45,2.97,t))*smooth(.8,1.15,t),cut=.045+.16*smooth(1.9,2.95,t);
  const palette=COLORS.map((c,i)=>mixColor(c,WARM[i],.85*(1-smooth(1.25,2.2,t))));
  const bounds=[Math.min(a.bounds[0],b.bounds[0]),Math.min(a.bounds[1],b.bounds[1]),Math.max(a.bounds[2],b.bounds[2]),Math.max(a.bounds[3],b.bounds[3])];
  if(bounds[0]>bounds[2])return;
  const density=(x,y)=>{const d=sample(a.d,x,y);return d+(sample(b.d,x,y)-d)*mix;};
  const volume=(x,y)=>{const d=sample(a.b,x,y);return d+(sample(b.b,x,y)-d)*mix;};
  const depth=(x,y)=>{const d=sample(a.w,x,y);return d+(sample(b.w,x,y)-d)*mix;};
  p.each(X0+bounds[0]*CELL,Y0+bounds[1]*CELL,X0+bounds[2]*CELL,Y0+bounds[3]*CELL,(x,y,sx,sy)=>{
    const gx=(x-X0)/CELL,gy=(y-Y0)/CELL,fine=density(gx,gy),deep=depth(gx,gy),d=(fine+deep*.35)*(o.smoke/.75);
    if(d<=cut)return;
    const local=volume(gx,gy),dx=volume(gx+1.2,gy)-volume(gx-1.2,gy),dy=volume(gx,gy+1.2)-volume(gx,gy-1.2);
    // Adapted merged-cloud gradient lighting: the transported density itself
    // supplies the folds; no per-sphere normal/lighting survives this path.
    const face=clamp(.5+Math.atan((dy*.9+dx*.35)/(local*.16+.03))*.42),front=fine/(fine+deep*.35+.001),up=face*front+.46*(1-front);
    const grain=noise2(x*.075+17,y*.075-t*.32,o.smokeSeed+119)*.04;
    const brightness=clamp(.30+up*.33+Math.min(.10,local*.045)+grain),index=Math.min(7,Math.floor(brightness*8));
    const alpha=Math.round(Math.min(.95,(1-Math.exp(-(d-cut)*1.8)))*5)/5*end;
    if(alpha>.014)p.blendPx(sx,sy,palette[index],alpha);
  });
}

// Retained editable artwork; technical checks do not imply final art approval.
export const asset={status:"study",source:"experiments/vfx-lab/productions/2026-11-08-fireball-grenade/smoke-flow.js",revision:"f207224ec08573ec71c8832c657ebd5ff1d998e9"};
