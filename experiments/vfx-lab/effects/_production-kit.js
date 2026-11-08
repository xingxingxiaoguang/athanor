// Original shared production drawing utilities, 2026-11-07.
// Mature materials are reused, not reimplemented: Sprite Fusion / Hugo Duprez,
// MIT Copyright (c) 2026, retained in the imported Athanor modules.
export {hex,fit,mix,clamp,smooth,TAU,Rng} from '../../../src/core/index.js';
export {random,trail,path,material,contact,particle} from '../../../src/authoring/index.js';
export {drawRock,stoneShape} from '../../../src/fx/nature/_lib.js';
export {cloud} from '../../../src/fx/projectiles/_lib.js';
import {hex,fit,clamp,TAU} from '../../../src/core/index.js';
import {material,random} from '../../../src/authoring/index.js';
export const C=Object.fromEntries(Object.entries({ink:'#101522',white:'#f6ffe8',ice:'#c7fff1',mint:'#55dcb9',teal:'#16847e',deep:'#1d405d',gold:'#f9ce71',amber:'#dc8d41',rust:'#9e4435'}).map(([k,v])=>[k,hex(v)]));
export const H=fit(['#fff9d6','#ffe08a','#ffa94b','#ee6538','#a73732','#4b2336'],9);
export const U=(v)=>clamp(v);export const lerp=(a,b,u)=>a+(b-a)*u;
export function rr(seed,id,channel,a=0,b=1){return random.range({seed,layer:'production',id,channel},a,b);}
export function tx(x,y,a,u,v){const c=Math.cos(a),s=Math.sin(a);return[x+u*c-v*s,y+u*s+v*c];}
export function poly(p,x,y,a,pts,c,alpha=1){p.poly(pts.map(([u,v])=>tx(x,y,a,u,v)),c,alpha);}
export function sword(p,x,y,a,len=18,alpha=1,ornate=false){
 const w=ornate?2.7:1.8,L=len*.6;
 poly(p,x,y,a,[[-L,-w],[L-3,-w],[L+2,0],[L-3,w],[-L,w]],C.ink,alpha);
 poly(p,x,y,a,[[-L+1,-w+.6],[L-3,-w+.6],[L+.4,0],[-L+1,0]],C.ice,alpha);
 poly(p,x,y,a,[[-L+1,0],[L,0],[L-3,w-.4],[-L+1,w-.4]],C.teal,alpha);
 let A=tx(x,y,a,-L+1,0),B=tx(x,y,a,L,0);p.line(...A,...B,C.white,alpha);
 A=tx(x,y,a,-L-1,-4);B=tx(x,y,a,-L-1,4);p.beam(...A,...B,1.7,C.gold,alpha);
 A=tx(x,y,a,-L-5,0);B=tx(x,y,a,-L-1,0);p.beam(...A,...B,2,C.deep,alpha);p.dot(...A,C.gold,alpha);
 if(ornate){A=tx(x,y,a,-L+4,-2);B=tx(x,y,a,-L+4,2);p.line(...A,...B,C.gold,alpha);}
}
export function burst(p,t,x,y,{seed=1,scale=1,tint=H,glow=.06,count=24}={}){
 if(t<0||t>1.35)return;
 if(t<.09){const r=(10-40*t)*scale;p.circle(x,y,r+2,tint[3]);p.circle(x,y,r,tint[0]);p.glow(x,y,30*scale,tint[2],.3*(1-t/.09));}
 if(t<.5){const u=t/.5,r=(4+34*(1-(1-u)**3))*scale;p.ring(x,y,r,Math.max(1,3*(1-u))*scale,tint[2],1-u);}
 for(let i=0;i<count;i++){
  const a=rr(seed,i,'a',0,TAU),v=rr(seed,i,'v',18,84)*scale,life=rr(seed,i,'life',.38,1.25),q=t/life;if(q>=1)continue;
  const f=(1-Math.exp(-3*t))/3,px=x+Math.cos(a)*v*f,py=y+Math.sin(a)*v*f+24*t*t;
  const state={position:[px,py],velocity:[Math.cos(a)*v,Math.sin(a)*v+48*t],opacity:Math.min(1,(1-q)*3),age01:q};
  if(i%4===0)material.fire(p,state,{colors:tint,size:(3+rr(seed,i,'size',0,3))*scale,glow});
  else material.spark(p,state,{colors:tint,glow});
 }
}
export function ellipseRing(p,x,y,rx,ry,c,a=1,width=1,phase=0,gaps=0){
 const n=Math.ceil(TAU*Math.max(rx,ry)*1.2);let prev=null;
 for(let i=0;i<=n;i++){const q=i/n*TAU,pt=[x+Math.cos(q)*rx,y+Math.sin(q)*ry];if(prev&&(!gaps||Math.sin(q*gaps+phase)>.12))p.beam(...prev,...pt,width,c,a);prev=pt;}
}
