// 引力炸弹修稿1 · Sudden Horizon. Original revised intent: expansion and absorption.
// Mature faceted debris and real history trails are reused from Athanor.
// Source materials retain Sprite Fusion / Hugo Duprez, MIT Copyright (c) 2026.
// No outward explosion, no compression/rebound narrative. Sphere, orbit and peak ring share [0,0].
import {hex,fit,clamp,smooth,TAU,rr,lerp,drawRock,stoneShape,Rng,ellipseRing,trail} from './_production-kit.js';
export const meta={name:'引力炸弹 · Sudden Horizon',desc:'A tiny black hole violently expands and swallows orbiting matter. One brief co-centered peak ring marks the horizon surge.',tags:['gravity','black-hole','absorption','引力炸弹','revision'],size:[360,240],origin:[180,120],duration:6.4,loop:false,fps:30,options:{seed:81,light:1,version:3}};
export const events={seed:.2,expansion:1.1,peak:1.2333333333333334,absorb:2.2,lastMatter:4.8,clear:6.4};
export const authoring={ending:'clear',bounds:{mode:'asset'}};
const K=fit(['#10151c','#252b36','#414c59','#657989','#91a8af','#b6c8c8','#dce3d1','#fff2cf'],8),V=fit(['#03060d','#0b1020','#1b253a','#344761','#62778c','#a2c9d5','#deffff'],7),P=fit(['#24192f','#65475e','#ae718b','#e7b6ca','#fff5ed'],5);
const CY=0,SY=.54;export const peakWindow={from:1.2,to:1.3333333333333333,semantics:'half-open; four nominal 30fps samples at 1.2,1.2333,1.2667,1.3'};
function radius(t){return 5+46*smooth(1.1,1.24,t);}
function position(q,t){const u=clamp((t-q.born)/q.life),f=u*u*u,r=lerp(q.r,2,f),a=q.a+u*(.55+1.8*u);return {position:[Math.cos(a)*r,CY+Math.sin(a)*r*SY],r,a,u};}
let key,memo;
function design(o){if(key===o.seed+':'+o.version)return memo;const R=new Rng(o.seed),matter=Array.from({length:o.version===1?78:234},(_,i)=>({id:i,born:rr(o.seed,i,'born',.18,4.7),life:rr(o.seed,i,'life',.9,1.65),r:rr(o.seed,i,'radius',91,153),a:(i%3)*TAU/3+rr(o.seed,i,'angle',-.3,.3),s:i%5===0?rr(o.seed,i,'size',4,7):rr(o.seed,i,'size',.8,2.2),shape:stoneShape(R)}));
 const wakes=matter.filter(q=>q.id%5===0).map(q=>trail.history({id:`fall-${q.id}`,born:q.born,end:q.born+q.life,space:'effect',sample:t=>({position:position(q,t).position})},{length:{seconds:.24},stepSeconds:1/90,death:{mode:'clear'}}));key=o.seed+':'+o.version;return memo={matter,wakes};}
function sphere(p,t,r,fade){
 // A screen-space sphere is circular; tilted orbital-plane projection is shared by
 // every orbit and the peak ring. The horizon occludes matter in that same screen space.
 p.shade(-r-2,CY-r-2,r+2,CY+r+2,(x,y,out)=>{const d=Math.hypot(x,y-CY);if(d>r+.5)return;let c=V[0];if(d>r-1.2)c=x<0&&y<CY+5?V[4]:V[2];else if(d>r-3)c=x<-r*.3?V[2]:V[1];out.c=c;out.a=fade;});
}
function matter(p,q,t,r,front,o){if(t<q.born||t>=q.born+q.life)return;const s=position(q,t),[x,y]=s.position;if((Math.sin(s.a)>0)!==front)return;if(s.r<r+q.s*.25)return;const screen=Math.hypot(x,y-CY),depth=Math.sin(s.a)*s.r*Math.sqrt(1-SY*SY);if(screen<r&&depth<Math.sqrt(r*r-screen*screen))return;const appear=smooth(0,.12,s.u)*(1-smooth(5.55,6.35,t)),near=1-smooth(r+3,r+24,Math.hypot(x,y-CY));if(q.id%5===0)drawRock(p,x,y,q.s*(1-.2*s.u),s.a,q.shape,K,appear);else{const near3=1-smooth(r+8,r+49,s.r),tail=.045+.12*near3,pts=[];for(let j=0;j<7;j++){const a=position(q,t-tail*(1-j/6));if(a.r>r&&Math.hypot(...a.position)>r+1)pts.push(a.position);}if(pts.length>1)p.polyline(pts,j=>j>.7?V[6]:j>.3?V[4]:P[1],appear*(.55+.35*near3));p.dot(x,y,near3>.4?V[6]:P[2],appear);}if(near>.2)p.glow(x,y,3,P[2],near*.018);}
export function draw(p,t,o){if(t>=meta.duration)return;const d=design(o),r=radius(t),fade=smooth(.08,.25,t)*(1-smooth(5.55,6.35,t));
 for(const q of d.matter)matter(p,q,t,r,false,o);
 // Old history is clipped by the same horizon, not left visibly passing through its body.
 for(const h of d.wakes)trail.draw(p,h,t,{width:q=>.3+1.4*q.s,color:(q,a)=>Math.abs(a)<.3?V[5]:V[3],alpha:q=>Math.hypot(...q.position)>r+1?.5*q.s*fade:0});
 const peak=t>=peakWindow.from&&t<peakWindow.to;
 if(peak){const a=(t-peakWindow.from)/(peakWindow.to-peakWindow.from),rx=r+20;ellipseRing(p,0,CY,rx,rx*SY,P[4],.95,2.5,0,0);p.glow(0,CY,r+15,P[2],.035*Math.sin(Math.PI*a));}
 sphere(p,t,r,fade);
 for(const q of d.matter)matter(p,q,t,r,true,o);
 // The near half is in front in the same 3D plane; the far half was occluded by the sphere.
 // Four-frame peak ring front arc respects the same plane and hole occultation.
 if(peak){const rx=r+20,n=80;for(let i=0;i<n;i++){const a=i/n*Math.PI,x=Math.cos(a)*rx,y=CY+Math.sin(a)*rx*SY;p.dot(x,y,P[4],fade);}}

}
export function observe(t,o){return{trails:design(o).wakes.slice(0,3).map(h=>trail.observe(h,t))};}

// Retained editable artwork; technical checks do not imply final art approval.
export const asset={status:"study",source:"experiments/vfx-lab/effects/gravity-bomb.js",revision:"f207224ec08573ec71c8832c657ebd5ff1d998e9"};
