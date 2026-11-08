// 蜂群导弹 · Hornet Choir. Original multi-wave flight routes, metal silhouettes and target choreography.
// Reuses the library's merged smoke volume and true-history ribbons.
// Rocket / homing-missile steel facets, nozzle jet and delayed blast recipes informed this work.
// Upstream materials: Sprite Fusion, MIT Copyright (c) 2026 Hugo Duprez.
import {C,H,hex,fit,clamp,smooth,TAU,rr,lerp,tx,poly,burst,ellipseRing,cloud,trail,path} from './_production-kit.js';
export const meta={name:'蜂群导弹 · Hornet Choir',desc:'Three waves of individual finned missiles peel away, weave separate curved guidance paths and strike three targets in a cascading barrage.',tags:['missile','production','swarm','guidance','蜂群导弹'],size:[360,240],origin:[180,184],duration:6.4,loop:false,fps:30,options:{seed:22,light:1,version:3,launchers:true,targetMarkers:true}};
export const events={lock:.25,wave1:.65,wave2:1.55,wave3:2.5,impact:2.45,final:4.55,clear:6.4};
export const authoring={ending:'clear',bounds:{mode:'asset'}};
const M=fit(['#111621','#283346','#485872','#78919f','#b6d4d5','#f1fff2'],6),SM=fit(['#202533','#343b4c','#50586b','#737d8c','#9ba5ac','#c7cfc8'],6),WR=fit(['#2b2631','#4f3a43','#7c514c','#b57955','#dfa86c','#ffe1a0'],6),R=fit(['#3a1d2b','#833944','#b95a4e','#ed9f67'],4);
const targets=[[54,-18],[103,-38],[128,8]];
let key,memo;
function design(o){if(key===o.seed+':'+o.version)return memo;const n=o.version===1?12:18,missiles=Array.from({length:n},(_,i)=>{const wave=Math.floor(i/6),slot=i%6,born=.65+wave*.95+slot*.09,flight=1.6+rr(o.seed,i,'flight',-.16,.2),target=targets[(slot+wave)%3],start=[-133,-9-(slot%3)*17],upper=slot%2===0;const route=path.bezier({id:`guidance-${i}`,points:[start,[-126+slot*6,upper?-158+slot*8+wave*4:-40-slot*8],[slot*22-73,upper?-149+slot*6:-100+slot*9],target],tolerancePx:.16});return{id:i,wave,slot,born,end:born+flight,flight,route,target,start};});const wakes=missiles.map(q=>trail.history({id:`hornet-${q.id}`,born:q.born,end:q.end,space:'effect',sample:t=>({position:position(q,t).position})},{length:{seconds:.28},stepSeconds:1/90,death:{mode:'fade',seconds:.4}}));key=o.seed+':'+o.version;return memo={missiles,wakes};}
function position(q,t){const u=clamp((t-q.born)/q.flight),f=.15*u+.85*u*u;return path.sample(q.route,f);}
function missile(p,x,y,a,id,t){
 const sc=id%3===0?1.35:1,P=(pts,c)=>poly(p,x,y,a,pts.map(([u,v])=>[u*sc,v*sc]),c),T=(u,v)=>tx(x,y,a,u*sc,v*sc);
 // 17px metal body; fin outline remains distinct from orange motor plume.
 P([[-9,-5],[-5,-2],[5,-2],[9,0],[5,2],[-5,2],[-9,5],[-8,1],[-10,0],[-8,-1]],M[0]);
 P([[-7,-3],[-4,-1],[4,-1],[7,0],[4,1],[-4,1],[-7,3]],M[2]);
 P([[-6,-1],[4,-1],[6,0],[-6,0]],M[4]);
 P([[2,-2],[5,-2],[9,0],[5,1],[2,1]],R[2]);
 let A=T(-5,-1),B=T(4,-1);p.line(...A,...B,M[5]);
 A=T(-7,-4);B=T(-5,-2);p.line(...A,...B,M[4]);
 const J=6+rr(32,id,Math.floor(t*30),0,4);P([[-8,-1.3],[-8-J,0],[-8,1.3]],H[3]);A=T(-8,0);B=T(-12,0);p.beam(...A,...B,1.7,H[0]);p.glow(...A,9,H[3],.07);
}
export function draw(p,t,o){if(t>=meta.duration)return;const d=design(o),fade=1-smooth(5.6,6.35,t),lock=smooth(0,.4,t)*(1-smooth(4.8,5.4,t));
 if(o.launchers){for(let i=0;i<3;i++){const x=-139,y=-3-i*12;p.poly([[x-9,y+3],[x+7,y],[x+7,y-5],[x-9,y-2]],M[1],fade);p.line(x-8,y-2,x+6,y-5,M[3],fade);p.line(x-9,y+2,x-9,y-2,M[0],fade);}}
 if(o.targetMarkers){for(let j=0;j<targets.length;j++){const[x,y]=targets[j];ellipseRing(p,x,y,13,7,R[2],lock*.6,1,t*2,4);for(const side of[-1,1])p.polyline([[x+side*18,y-7],[x+side*14,y-7],[x+side*14,y-3]],C.gold,lock);}}
 // Historical exhaust laid at actual trajectory samples. Smoke stays behind,
 // lifts and dilates independently after the motor passes, rather than following velocity.
 const list=[];
 for(const q of d.missiles){for(let born=q.born;born<Math.min(t,q.end);born+=.015){const age=t-born;if(age>1.28)continue;const a=position(q,born),r=1.7+6*(1-Math.exp(-age*3)),u=age/1.28;list.push({x:a.position[0]-a.tangent[0]*7+Math.sin(born*7+q.id)*age*1.2,y:a.position[1]-a.tangent[1]*7-age*6,r,a:.28*(1-u)**1.1,b:.72-.3*u,w:Math.exp(-age*8)});}}
 cloud(p,list,SM,WR,{dens:o.version>=3?1.15:.85,max:.62,lit:1.25});
 for(let i=0;i<d.wakes.length;i++)trail.draw(p,d.wakes[i],t,{width:q=>.25+2.1*q.s,color:(q,a)=>q.historyAge<.055?H[0]:Math.abs(a)<.3?H[2]:H[4],alpha:q=>Math.max(0,1-q.historyAge/.28)*.9});
 for(const q of d.missiles){if(t>=q.born&&t<q.end){const a=position(q,t),ang=Math.atan2(...[a.tangent[1],a.tangent[0]]);missile(p,...a.position,ang,q.id,t);}
 const k=t-q.end;if(k>=0&&k<1.4){burst(p,k,...q.target,{seed:110+q.id,scale:q.wave===2?.65:.47,count:q.wave===2?19:12,glow:.018});if(o.version>=2&&k<.18){const[x,y]=q.target;p.beam(x-3,y-3,x+12,y-12,1.5+3*(1-k/.18),H[1],1-k/.18);}}
 const kick=t-q.born;if(kick>=0&&kick<.22){const[x,y]=q.start;p.ellipse(x-9,y,5+kick*12,2,H[4],1-kick/.22);}}
 // After the last wave the three impact sites carry a shared cooling smoke layer.
 const impacts=[];for(const q of d.missiles){const age=t-q.end-.12;if(age<0||age>1.65)continue;const u=age/1.65;impacts.push({x:q.target[0]+(q.slot-2.5)*(1-Math.exp(-age*2))*2,y:q.target[1]-age*15,r:3+7*(1-Math.exp(-age*2.5)),a:.34*(1-u)*fade,b:.72-.2*u,w:Math.exp(-age*4)});}cloud(p,impacts,SM,WR,{dens:1,max:.64,lit:1.15});
}
export function observe(t,o){const d=design(o);return{trails:d.wakes.filter((_,i)=>[0,4,8].includes(i)).map(h=>trail.observe(h,t))};}
