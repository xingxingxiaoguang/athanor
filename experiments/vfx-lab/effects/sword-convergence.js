// 万剑归宗 · Jade Edict. Original choreography and sword pixel meshes.
// Historical ribbon, staggered volley and layered impacts build on arcane-missiles,
// melee/sword-slash, core/shapes trail. Their Sprite Fusion / Hugo Duprez MIT credit remains.
import {C,hex,fit,clamp,smooth,TAU,rr,lerp,sword,burst,ellipseRing,trail} from './_production-kit.js';
export const meta={name:'万剑归宗 · Jade Edict',desc:'A jade sword mandala folds into a disciplined array, turns, and releases a serial converging sword storm.',tags:['sword','production','volley','pixel','万剑归宗'],size:[360,240],origin:[180,165],duration:6.4,loop:false,fps:30,options:{seed:31,light:1,version:4}};
export const events={summon:.65,array:1.65,converge:2.6,release:3.2,impact:3.76,final:4.85,clear:6.4};
export const authoring={ending:'clear',bounds:{mode:'asset'}};
let memo,key;
function design(o){if(key===o.seed+':'+o.version)return memo;
 const blades=Array.from({length:o.version===1?27:35},(_,i)=>{const row=Math.floor(i/7),col=i%7;const ring=i*TAU/(o.version===1?27:35),born=.55+(i%7)*.055+row*.06,launch=3.2+row*.18+col*.065;const hit=launch+.54+rr(o.seed,i,'fly',0,.12);return{id:i,born,launch,hit,ring,x:-139+col*16+row*3,y:-125+row*27+(col%2)*8,len:i===17?30:12+(i%5)*3.3,target:[99+rr(o.seed,i,'tx',-7,7),-35+rr(o.seed,i,'ty',-12,12)]};});
 const wakes=blades.map(q=>trail.history({id:`edict-${q.id}`,born:q.launch,end:q.hit,space:'effect',sample:t=>({position:pos(q,t,o).slice(0,2)})},{id:`jade-wake-${q.id}`,length:{seconds:.19},stepSeconds:1/90,death:{mode:'fade',seconds:.18}}));key=o.seed+':'+o.version;return memo={blades,wakes};}
function pos(q,t,o){const u=clamp((t-q.born)/.85),v=smooth(2.25,3.18,t),a=q.ring-.55+t*.13,rx=o.version===1?65:72,ry=o.version===1?50:61;
 const orbit=[-70+Math.cos(a)*rx,-61+Math.sin(a)*ry];let x=lerp(orbit[0],q.x,v),y=lerp(orbit[1],q.y,v),ang=lerp(a+Math.PI/2,-.2+(q.id%7-3)*.045,v);
 if(t<2.25){x=-70+(x+70)*u;y=-61+(y+61)*u;ang=a+Math.PI/2;}
 if(t>=q.launch){const z=clamp((t-q.launch)/(q.hit-q.launch)),f=z*z;const bend=(q.id%7-3)*(o.version===1?4:7)*Math.sin(Math.PI*z);x=lerp(q.x,q.target[0],f);y=lerp(q.y,q.target[1],f)+bend;const dz=.002,z2=clamp(z+dz),fy=lerp(q.y,q.target[1],z2*z2)+(q.id%7-3)*(o.version===1?4:7)*Math.sin(Math.PI*z2);ang=Math.atan2(fy-y,lerp(q.x,q.target[0],z2*z2)-x);}
 return[x,y,ang];}
export function draw(p,t,o){if(t>=meta.duration)return;const d=design(o),intro=smooth(0,.7,t)*(1-smooth(2.8,3.5,t)),fade=1-smooth(5.6,6.3,t);
 // The seal is a transient VFX layer, no scenery or character baked in.
 ellipseRing(p,-70,-61,81,64,C.deep,intro*.6,1,t,12);ellipseRing(p,-70,-61,74,58,C.teal,intro*.85,1,-t,8);
 for(let i=0;i<8;i++){const a=i*TAU/8+t*.12,x=-70+Math.cos(a)*78,y=-61+Math.sin(a)*61;p.line(x-2,y,x+2,y,C.gold,intro);p.line(x,y-2,x,y+2,C.gold,intro);}
 if(o.version>=2){for(let i=0;i<7;i++){const x=-116+i*9;p.line(x,-117,x,-108,C.teal,intro*.6);p.px(x,-120,C.gold,intro);}}
 // A single foreground command sword anchors the empty centre of the summoned mandala.
 if(t>.4&&t<4.36){let mx=-70,my=-61,ma=-Math.PI/2+smooth(2.28,3.18,t)*Math.PI/2;const a=smooth(.4,1,t)*(1-smooth(4.17,4.36,t));if(t>3.7){const u=clamp((t-3.7)/.47),f=u*u;mx=lerp(-70,100,f);my=lerp(-61,-35,f);ma=Math.atan2(26,170);p.beam(mx-33,my-5,mx-7,my-1,3,C.teal,.6*a);}sword(p,mx,my,ma,43,a,true);p.glow(mx,my,12,C.mint,.025*a);}
 for(let i=0;i<d.wakes.length;i++)trail.draw(p,d.wakes[i],t,{width:q=>(o.version>=3?3.4:2.3)*q.s+.2,color:(q,a)=>Math.abs(a)<.25?C.ice:Math.abs(a)<.7?C.mint:C.teal,alpha:q=>.8*q.s});
 for(const q of d.blades){if(t<q.born||t>=q.hit)continue;const[x,y,a]=pos(q,t,o),alpha=smooth(q.born,q.born+.16,t);sword(p,x,y,a,q.len,alpha,q.id===17);if(t>q.launch)p.glow(x,y,6,C.mint,.035);}
 const I=fit(['#fcffdf','#caffce','#77e2b0','#32a28f','#28617e','#1b2d46'],9);
 for(const q of d.blades){const u=t-q.hit;if(u<0||u>1.05)continue;const k=1-u/1.05;
 if(u<.08)p.beam(85,-35,120,-35,1.5+6*(1-u/.08),C.white);if(u<.35)ellipseRing(p,q.target[0],q.target[1],5+u*30,3+u*24,C.mint,1-u/.35,1.2);
 for(let i=0;i<4;i++){const a=rr(o.seed,q.id*4+i,'spark',0,TAU),v=rr(o.seed,q.id*4+i,'sp',12,48);p.line(q.target[0]+Math.cos(a)*u*v,q.target[1]+Math.sin(a)*u*v,q.target[0]+Math.cos(a)*(u+.06)*v,q.target[1]+Math.sin(a)*(u+.06)*v,i===0?C.gold:C.mint,k);}}
 burst(p,t-4.85,100,-35,{seed:74,scale:o.version>=3?1.1:.8,tint:I,glow:.025,count:35});
 if(o.version>=3&&t>4.85&&t<5.6){const u=(t-4.85)/.75;
 // Three sword-shaped cuts arrive on separate beats; each has a tapered broad facet.
 for(let i=0;i<3;i++){const a=-.92+i*.87,age=t-4.85-i*.09;if(age<0||age>.42)continue;const k=1-age/.42,L=25+42*(1-(1-age/.42)**2),nx=Math.cos(a),ny=Math.sin(a),vx=-ny,vy=nx;
 p.poly([[100-nx*L,-35-ny*L],[100+vx*5*k,-35+vy*5*k],[100+nx*L,-35+ny*L],[100-vx*2*k,-35-vy*2*k]],i===1?C.gold:C.mint,k);p.line(100-nx*L,-35-ny*L,100+nx*L,-35+ny*L,C.white,k);}
 ellipseRing(p,100,-35,24+u*30,12+u*24,C.teal,(1-u)*.7,1,t*6,9);p.glow(100,-35,39,C.mint,.1*(1-u));}
 for(let i=0;i<15;i++){const u=(t-4.6-i*.035)/1.3;if(u<0||u>1)continue;p.dot(90+rr(o.seed,i,'ashx',-28,35)+u*5,-30+u*25+rr(o.seed,i,'ashy',-22,17),i%3===0?C.gold:C.teal,(1-u)*fade);}
}
export function observe(t,o){const d=design(o);return{trails:d.wakes.filter((_,i)=>[0,10,20,26].includes(i)).map(h=>trail.observe(h,t))};}
