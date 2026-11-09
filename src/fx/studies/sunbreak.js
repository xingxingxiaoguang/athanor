// SUNBREAK / DRIFT with explosions/grenade rhythm and pixel treatment.
// Renderer and time remapping are private to this artwork.
import {Painter,createFrame,clearFrame} from '../../core/index.js';
import {drawFire} from './_sunbreak/combustion.js';
import {drawSmoke} from './_sunbreak/smoke-flow.js';
import {drawSupport} from './_sunbreak/grenade-support.js';
export const meta={name:'焰核爆裂 · Grenade pixel edition',desc:'Organic SUNBREAK fireball and continuous DRIFT smoke, with grenade detonation timing, native secondary physics, split shockwave, discrete color clusters and a shared pixel grid.',tags:['explosion','fireball','grenade','smoke','pixel','master','one-shot'],size:[320,288],origin:[160,214],duration:2.6,loop:false,options:{seed:37,power:1,heat:1,smoke:.75,roll:1,smokeSeed:27,wind:.25,buoyancy:.3,curl:1.15,auxSeed:6}};
export const authoring={ending:'clear',bounds:{mode:'asset'}};
export const events={ignition:1/30,blast:.07,shock:.2,cooling:.5,smoke:.85,embers:1.3,clear:2.6};
const STEP=2,MARGIN=48;
const frame=createFrame((320+MARGIN*2)/STEP,(288+MARGIN*2)/STEP),pixel=new Painter(frame);
// Shared logical pixel grid for the flame, smoke, debris and rings. Shapes are
// evaluated at grid centers, not blurred or color-reduced after compositing.
pixel.toX=function(x,y){return this.tx+(x*this.fx*this.cs-y*this.sn)/STEP;};
pixel.toY=function(x,y){return this.ty+(x*this.fx*this.sn+y*this.cs)/STEP;};
pixel.fromX=function(x,y){return ((x-this.tx)*this.cs+(y-this.ty)*this.sn)*this.fx*STEP;};
pixel.fromY=function(x,y){return (-(x-this.tx)*this.sn+(y-this.ty)*this.cs)*STEP;};
pixel.glow=function(x,y,r,c,k=.5){
  if(r<1||k<=.004)return;
  this.each(x-r,y-r,x+r,y+r,(lx,ly,sx,sy)=>{const d=Math.hypot(lx-x,ly-y)/r;if(d<1)this.add(sx,sy,c,(1-d)**2*k);});
};
export function artTime(t){return Math.min(3,3*(1-Math.exp(-t*1.5))/(1-Math.exp(-2.6*1.5)));}
export function draw(p,t,o){
  if(t<0||t>=2.6)return;
  clearFrame(frame);pixel.reset().place((160+MARGIN)/STEP,(214+MARGIN)/STEP);
  drawSupport(pixel,t,o,'back');
  const clock=artTime(t);drawSmoke(pixel,clock,o);drawFire(pixel,clock,o);
  drawSupport(pixel,t,o,'front');
  // Retain a real gutter through the final draw. Validation can see any pixels
  // outside the asset; the offscreen canvas does not hide boundary spill.
  p.each(-160-MARGIN,-214-MARGIN,160+MARGIN,74+MARGIN,(x,y,sx,sy)=>{
    const ix=Math.floor((x+160+MARGIN)/STEP),iy=Math.floor((y+214+MARGIN)/STEP);
    if(ix<0||iy<0||ix>=frame.w||iy>=frame.h)return;
    const i=iy*frame.w+ix,c=frame.color[i],l=frame.light[i];
    if(c>>>24)p.blendPx(sx,sy,c,(c>>>24)/255);
    if(l&0xffffff)p.add(sx,sy,l,1);
  });
}

// Retained editable artwork; technical checks do not imply final art approval.
export const asset={status:"study",source:"experiments/vfx-lab/productions/2026-11-08-fireball-grenade/fireball-drift.js",revision:"f207224ec08573ec71c8832c657ebd5ff1d998e9"};
