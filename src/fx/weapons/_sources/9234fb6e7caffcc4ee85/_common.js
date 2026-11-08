// Frozen artwork source: experiments/vfx-lab/productions/2026-11-07-arsenal/art/_common.js
// Original top-down weapon production art, 2026-11-07. Mature Athanor helpers
// retain Sprite Fusion / Hugo Duprez / MIT attribution in their source modules.
export {hex,fit,mix,clamp,smooth,luma,TAU,Rng,rng,tileNoise,tileFbm} from '../../../../core/index.js';
export {particle,schedule,motion,curve,body,path,skill,material,arc,ray,random,propagation} from '../../../../authoring/index.js';
export {flash,flashShape,cloud,drawCasing,casing,turnSprite} from '../../../projectiles/_lib.js';
import {hex,fit,clamp,TAU} from '../../../../core/index.js';
import {random,particle,schedule,motion} from '../../../../authoring/index.js';
export const INK=hex('#17222b'),WHITE=hex('#fff9dc');
export const FIRE=['#251d28','#612d31','#af4430','#e96c2f','#fca443','#ffce70','#ffe5a0','#fff4cb','#fffdf0'];
export const SMOKE=['#252e34','#3c454a','#565d60','#767b79','#989d91','#b9ba9f','#d6d2b1'];
export const WATER=['#132c43','#1b4b68','#247e98','#38a9bc','#68c9cc','#9ae2df','#cef3e9','#f1fff4'];
export const ACID=['#182e23','#304b23','#55792e','#78a732','#a6cb40','#d1e77a','#edfac1','#f8ffe8'];
export const FROST=['#1e314a','#315173','#4e7b9b','#77acbe','#aed5d6','#d0e9df','#e9f4e7','#fcfff1'];
export const ELECTRIC=['#171e3c','#283568','#405c96','#568bbb','#67bfd8','#a3e9ec','#dcfff1','#fcfff1'];
export const LASER=['#2d1937','#673857','#ad4a6b','#dd7075','#faa58f','#ffd5a9','#fff0d2','#fffdec'];
export const LENS=['#1c253c','#344e6a','#438d9f','#69bcc4','#a6e8d7','#defce2','#f0fff0','#ffffff'];
export function rr(seed,id,ch,a=0,b=1){return random.range({seed,layer:'arsenal-art',id:String(id),channel:ch},a,b);}
export const ink=c=>typeof c==='number'?c:hex(c);
export function palette(a,n=8){return fit(a,n);}
export function local(p,x,y,angle=0,scale=1){const c=Math.cos(angle),s=Math.sin(angle),q=Object.create(p);q.toX=(u,v)=>p.toX(x+(u*c-v*s)*scale,y+(u*s+v*c)*scale);q.toY=(u,v)=>p.toY(x+(u*c-v*s)*scale,y+(u*s+v*c)*scale);q.fromX=(sx,sy)=>{const dx=p.fromX(sx,sy)-x,dy=p.fromY(sx,sy)-y;return(dx*c+dy*s)/scale;};q.fromY=(sx,sy)=>{const dx=p.fromX(sx,sy)-x,dy=p.fromY(sx,sy)-y;return(-dx*s+dy*c)/scale;};q.rect=(x,y,w,h,col,a=1)=>q.shade(x,y,x+w,y+h,(u,v,out)=>{if(u>=x&&u<x+w&&v>=y&&v<y+h){out.c=col;out.a=a;}});return q;}
export function fadeAt(t,end,span=.35){return t<0||t>=end?0:Math.min(1,(end-t)/span);}
export function phase(t){return ((t%1)+1)%1;}
export function births(id,mode,count,lifeMax=1,stopPhase=0){
 if(mode==='outro')return schedule.cycle({id,period:1,count,seed:31,start:0,end:stopPhase+1e-10,lifeMax}).filter(b=>b.born<stopPhase).map(b=>({...b,born:b.born-stopPhase}));
 if(mode==='loop'||mode==='intro')return schedule.cycle({id,period:1,count,seed:31,start:0,end:mode==='outro'?1e-10:1.01,lifeMax}).filter(b=>mode==='outro'?b.born<0:mode==='intro'?b.born>=0:true);
 return schedule.burst({id,at:0,count});
}
export function puffList(p,emitter,t,colors=SMOKE,{scale=1,opacity=1,warm=0}={}){const C=palette(colors,7),list=particle.sample(emitter,t).map(s=>({x:s.position[0],y:s.position[1],r:(s.data.radius??3)*(1+s.age01*2)*scale,a:s.opacity*opacity,b:s.data.bright??.7,w:warm*Math.max(0,1-s.age01*4)}));return list;}
export function sprayEmitter({id,seed=31,mode='burst',stopPhase=0,count=22,life=.6,position=[0,0],speed=[35,135],angle=[-Math.PI,Math.PI],drag=3,spread=0,radius=[1,3],opacity=.8,data={}}){
 return particle.emitter({id,seed,births:births(id,mode,count,Array.isArray(life)?Math.max(...life):life,stopPhase).map(b=>({...b,position:[...position]})),initial:({rand})=>{const a=rand('angle',...angle),v=rand('speed',...speed);return{life,position,velocity:[Math.cos(a)*v,Math.sin(a)*v],opacity,data:{...data,radius:rand('radius',...radius),bright:rand('brightness',.5,.95)}};},motion:{drag},material:{opacity:s=>Math.min(1,s.age*35)*Math.max(0,1-s.age01)**1.2}});
}
export function chippedLine(p,x0,y0,x1,y1,width,C,a=1){p.beam(x0,y0,x1,y1,width+2,C[0],a);p.beam(x0,y0,x1,y1,width,C[3],a);p.line(x0,y0-1,x1,y1-1,C.at(-1),a);}
export function discShadow(p,x,y,r,a=.18){p.disc(x+2,y+3,r,INK,a);}
export function radialRing(p,x,y,r,width,c,a=1,seed=1,gap=0){if(r<.5||a<=0)return;const n=Math.ceil(TAU*r*1.1);let last=null;for(let i=0;i<=n;i++){const an=i/n*TAU,pt=[x+Math.cos(an)*r,y+Math.sin(an)*r];if(last&&(!gap||Math.sin(an*gap+seed)>.05))p.beam(...last,...pt,width,c,a);last=pt;}}
export function planarSparks(p,emitter,t,{colors=FIRE,glow=.15,size=1}={}){const C=palette(colors,8);return particle.draw(p,emitter,t,{draw:(p,s)=>{const v=s.velocity,l=Math.hypot(...v)||1,L=(2+Math.min(9,l*.025))*size;const x=s.position[0],y=s.position[1],a=s.opacity;discShadow(p,x,y,1,.1*a);p.line(x-v[0]/l*L,y-v[1]/l*L,x,y,C[Math.min(7,Math.floor((1-s.age01)*6)+1)],a);p.px(x,y,C[7],a);if(glow)p.glow(x,y,3.5,C[5],glow*a);}});}
