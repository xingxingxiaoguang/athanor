// DRIFT / compact pixel billows, 2026-11-09.
// Continuous 2D advected density, pressure projection and vorticity confinement.
// Conceptual numerical reference: Stam / Mark Harris, GPU Gems chapter 38;
// original CPU implementation for this artwork, not copied GPU/Cg source.
// Density-gradient lighting adapts Athanor projectiles/_lib.cloud's mature
// merged-cloud recipe, retaining Sprite Fusion / Hugo Duprez / MIT credit.
// Continuous relief shading and a 3px grid strengthen the billows without
// replacing the connected flow with sphere sprites. Artwork-private renderer.
import {hex,noise2,smooth,clamp} from '../../core/index.js';

export const meta={name:'卷岚 · DRIFT / compact pixel billows',desc:'Compact asymmetric smoke with broad pixel clusters, overlapping shaded billows, restrained wisps and a quick dissolving finish.',tags:['smoke','plume','curl','volume','pixel','master','one-shot'],size:[320,352],origin:[144,306],duration:2.8,loop:false,options:{seed:27,wind:1,buoyancy:1,curl:1,density:1}};
export const authoring={ending:'clear',bounds:{mode:'asset'}};
export const events={release:.1,billow:.65,curl:1.3,dissolve:1.7,clear:2.75};
export const PIXEL=3;
const COLORS=['#454b54','#606b75','#7f8d94','#a4afae','#c4c7bb'].map(hex);
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
    const tmp=zero(),out=zero(),r=4,n=9;
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
// Unequal, warped volume shoulders travel in the existing DRIFT velocity
// field. Like projectiles/_lib.cloud they merge before lighting; unlike the
// old spherical kernels their outlines stretch, turn and have uneven lobes.
// This is a director's 2.5D shape scaffold, not a physical 3D smoke solver.
const SHOULDERS=[
  [.02,74,145,13,1.08,-.35,1.1], [.08,102,143,11,.86,.3,2.7],
  [.18,87,149,15,1.15,-.12,4.3], [.33,72,150,10,.85,-.4,5.6],
  [.47,97,151,11,1.1,.6,7.2], [.65,83,153,9,.83,-.2,8.1],
];
function billowDensity(billows,time){
  const out=zero(),front=zero();
  for(const b of billows){
    const age=time-b.born,life=(1-smooth(1.05,2.5,age))*smooth(0,.12,age);
    if(life<=0)continue;
    const radius=b.radius*(.4+.6*smooth(0,.28,age)+.25*smooth(.2,2,age));
    const reach=radius*1.8,cs=Math.cos(b.angle),sn=Math.sin(b.angle);
    for(let y=Math.max(1,Math.floor(b.y-reach));y<Math.min(H-1,b.y+reach);y++)for(let x=Math.max(1,Math.floor(b.x-reach));x<Math.min(W-1,b.x+reach);x++){
      const dx=(x-b.x)/radius,dy=(y-b.y)/radius;
      const nx=(dx*cs+dy*sn)/b.aspect,ny=(-dx*sn+dy*cs)*b.aspect;
      const angle=Math.atan2(ny,nx),rim=1+.14*Math.sin(angle*3+b.phase)+.08*Math.sin(angle*5-b.phase*1.7+age*.4);
      const q=(nx*nx+ny*ny)/(rim*rim);
      if(q<1){
        const thickness=Math.sqrt(1-q),i=y*W+x;
        out[i]+=thickness*life*.9;
        // The exposed front is a union of unequal warped caps, not the sum
        // of all depths: overlapping billows retain their curved shoulders.
        front[i]=Math.max(front[i],thickness*radius/16*life);
      }
    }
  }
  return {out,front};
}
function store(d,billows=[],time=0){
  const {out:k,front}=billowDensity(billows,time),surface=zero();
  for(let i=0;i<N;i++){surface[i]=d[i]*.24+k[i];front[i]+=d[i]*.12;}
  let x0=W,y0=H,x1=0,y1=0,total=0;const wide=wideBlur(surface);
  for(let y=1;y<H-1;y++)for(let x=1,i=y*W+1;x<W-1;x++,i++)if(d[i]+k[i]+wide[i]*.75>.002){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);total+=d[i];}
  return {d:d.slice(),k,b:blur(front),w:wide,bounds:[x0-3,y0-3,x1+3,y1+3],mass:total};
}
function simulation(o){
  const key=JSON.stringify([o.seed,o.wind,o.buoyancy,o.curl]);
  if(caches.has(key))return caches.get(key);
  const s={o,step:0,billows:[],u:zero(),v:zero(),u0:zero(),v0:zero(),d:zero(),d0:zero(),scratch:zero(),heat:zero(),heat0:zero(),p:zero(),q:zero(),div:zero(),omega:zero(),frames:[],gust:zero()};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)s.gust[y*W+x]=noise2(x*.075,y*.075,o.seed);
  // A divergence-free ambient crossflow (stream-function derivatives) carries
  // the whole smoke sheet, rather than giving individual puffs launch speeds.
  const psi=zero();for(let y=0;y<H;y++)for(let x=0;x<W;x++)psi[y*W+x]=noise2(x*.038,y*.038,o.seed+23)+.19*noise2(x*.105,y*.105,o.seed+93);
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
    u[i]+=DT*gy/n*omega[i]*4.4*o.curl;v[i]-=DT*gx/n*omega[i]*4.4*o.curl;
  }
  advect(u0,u,u,v,DT,.998);advect(v0,v,u,v,DT,.998);
  u.set(u0);v.set(v0);project(u,v,p,q,div);
  const decay=Math.exp(-DT*(.08+.48*smooth(1.2,3.3,t)));
  advectDetailed(d0,d,u,v,scratch,DT,decay);advect(heat0,heat,u,v,DT,Math.exp(-DT*.8));d.set(d0);heat.set(heat0);
  // A continuous, lobed fan of density; never a list of round sprite puffs.
  const emit=smooth(0,.06,t)*(1-smooth(.7,1.12,t))*(1-.67*smooth(.38,.7,t));
  if(emit>0){
    const taper=smooth(.38,.8,t),width=(19+11*smooth(0,.25,t))*(1-.74*taper),cx=88-7*taper+Math.sin(t*9+o.seed)*2.5,cy=146;
    for(let y=130;y<=161;y++)for(let x=57;x<=119;x++){
      const i=y*W+x,dx=(x-cx)/width,dy=(y-cy)/13;
      const grain=noise2(x*.3+t*1.7,y*.3-t*.6,o.seed+66);
      const fan=Math.max(0,1-Math.pow(Math.abs(dx),3))*Math.max(0,1-Math.pow(Math.abs(dy),3));
      // Three unequal connected shoulders in the source, not visible sphere
      // sprites. They enter the same density field and deform with its flow.
      const left=Math.exp(-((dx+.6)**2/.15+(dy+.3)**2/.6));
      const center=Math.exp(-((dx-.02)**2/.3+(dy-.1)**2/.4));
      const right=Math.exp(-((dx-.65)**2/.12+(dy+.45)**2/.3));
      const billow=.38+left*.9+center*.8+right*.65;
      const pulse=.85+.23*Math.sin(t*13+dx*3.6);
      const profile=fan*billow*pulse*(.9+.55*gust[i]+.35*grain);
      if(!profile)continue;
      const amount=emit*profile*DT;
      d[i]=Math.min(3.5,d[i]+amount*6);heat[i]=Math.min(1.7,heat[i]+amount*4.5);
      const turn=Math.sin(t*12+dy*1.7+o.seed*.2);
      u[i]+=amount*8*(16*o.wind+dx*5+turn*10-u[i]);
      v[i]+=amount*8*(-38+dx*14-v[i]);
    }
  }
  for(const [index,q] of SHOULDERS.entries())if(q[0]>s.step*DT&&q[0]<=t){
    const [born,x,y,radius,aspect,angle,phase]=q;
    s.billows.push({born,x,y,radius,aspect,angle,phase:phase+(o.seed-27)*.13,index});
  }
  for(const b of s.billows){
    b.x+=sample(u,b.x,b.y)*DT*.8;b.y+=(sample(v,b.x,b.y)*.8-3*o.buoyancy)*DT;
    b.angle+=clamp(sample(omega,b.x,b.y),-3,3)*DT*.08;
  }
  s.step++;s.frames.push(store(d,s.billows,t));
}
export function smokeState(time,o){
  const s=simulation(o),position=Math.max(0,time)*HZ,lo=Math.floor(position+1e-9),hi=Math.ceil(position-1e-9);
  while(s.step<hi)tick(s);
  const a=s.frames[lo],b=s.frames[hi],mix=position-lo;
  return {a,b,mix,time,simulationHz:HZ,kind:'advected-density'};
}
export function draw(p,t,o){
  if(t<=0||t>=2.76)return;
  const {a,b,mix}=smokeState(t,o),end=1-smooth(1.75,2.75,t),cut=.055+.2*smooth(1.3,2.65,t);
  const wisps=1-smooth(.9,2.1,t);
  const bounds=[Math.min(a.bounds[0],b.bounds[0]),Math.min(a.bounds[1],b.bounds[1]),Math.max(a.bounds[2],b.bounds[2]),Math.max(a.bounds[3],b.bounds[3])];
  if(bounds[0]>bounds[2])return;
  const density=(x,y)=>{const d=sample(a.d,x,y);return d+(sample(b.d,x,y)-d)*mix;};
  const volume=(x,y)=>{const d=sample(a.b,x,y);return d+(sample(b.b,x,y)-d)*mix;};
  const depth=(x,y)=>{const d=sample(a.w,x,y);return d+(sample(b.w,x,y)-d)*mix;};
  const billow=(x,y)=>{const d=sample(a.k,x,y);return d+(sample(b.k,x,y)-d)*mix;};
  const relief=(x,y)=>volume(x,y)+depth(x,y)*.12;
  p.each(X0+bounds[0]*CELL,Y0+bounds[1]*CELL,X0+bounds[2]*CELL,Y0+bounds[3]*CELL,(x,y,sx,sy)=>{
    // Evaluate the actual material at logical pixel centers, shared by all
    // color and alpha decisions. No soft resize or post-composite pixel filter.
    x=Math.floor(x/PIXEL)*PIXEL+PIXEL*.5;y=Math.floor(y/PIXEL)*PIXEL+PIXEL*.5;
    const gx=(x-X0)/CELL,gy=(y-Y0)/CELL,fine=density(gx,gy),deep=depth(gx,gy),bulk=billow(gx,gy),d=(fine*.36*wisps+deep*.16+bulk*.74)*o.density;
    if(d<=cut)return;
    const local=volume(gx,gy),dx=(relief(gx+2,gy)-relief(gx-2,gy))*3.2,dy=(relief(gx,gy+2)-relief(gx,gy-2))*3.2;
    const sky=(dx*.46+dy*.72+.55)/Math.sqrt(dx*dx+dy*dy+1);
    // Broad density gives the shared inflated surface; finer density only
    // folds that surface. A displaced upstream sample shades the lower seam.
    const pocket=clamp((depth(gx-4,gy-6)-deep)*1.5),fold=clamp((local-deep)*.7,-.15,.15);
    const brightness=clamp(.34+sky*.43-pocket*.08+fold*.06),index=Math.min(4,Math.floor(brightness*6));
    const edge=smooth(cut,cut+.065,d),body=.3+.6*(1-Math.exp(-d*2.5));
    const alpha=Math.round(edge*body*end*6)/6;
    if(alpha>.014)p.blendPx(sx,sy,COLORS[index],alpha);
  });
}

// Retained editable artwork; technical checks do not imply final art approval.
export const asset={status:"study",source:"experiments/vfx-lab/productions/2026-11-09-smoke-pixel/smoke.js",revision:"f207224ec08573ec71c8832c657ebd5ff1d998e9"};
