// Chibaku Tensei — original production artwork, 2026-11-06.
// Direct reuse: nature/_lib.js stoneShape/drawRock; its attribution is retained in that module.
// Directional faceting, rolling dust and ground rupture follow earth-spike / ground-slam.
// Their upstream credit: Sprite Fusion, MIT, Copyright (c) 2026 Hugo Duprez.
// Acceleration-to-core staging informed by shadow/black-hole; this is not its preset.
// Spherical crust shader, terrain, caster, choreography and transport are original here.
import {hex,fit,mix,Rng,clamp,smooth,TAU} from '../../../src/core/index.js';
import {stoneShape,drawRock} from '../../../src/fx/nature/_lib.js';
import {random,curve,particle,schedule,material,motion,trail} from '../../../src/authoring/index.js';
export const meta={name:'CHIBAKU TENSEI · The Captive Earth',desc:'A black seed rises. A valley is torn apart and pulled into a colossal suspended rock prison.',tags:['earth','gravity','anime','cinematic','production'],size:[360,240],origin:[180,208],duration:9,loop:false,fps:30,bg:'dark',options:{seed:27,light:.7}};
export const events={seed:.5,fracture:1.65,uproot:2.8,convergence:4.5,prison:7.2,hold:8.6};
export const authoring={ending:'persistent'};
const stone=fit(['#15141e','#26222a','#3d3336','#58473f','#78604c','#9d815e','#bfa176','#dfc291'],8);
const dust=fit(['#342c37','#5d4f50','#8c7460','#b59b79'],4),violet=hex('#a8a5cf'),ink=hex('#10101a');
// The visible volume is fed by actual arriving rock records, not an independent scale animation.
function radiusAt(t,d){let mass=0;for(const q of d.rocks)mass+=q.mass*smooth(q.born+q.life-.28,q.born+q.life+.06,t);return 61*Math.cbrt(mass/d.totalMass);}
const height=curve.scalar({points:[[0,-29],[.45,-32],[1.35,-131],[9,-131]],interpolation:'smooth',outputUnit:'pixels'});
const sx=19;
const seedX=curve.scalar({points:[[0,-108],[.45,-108],[1.35,19],[9,19]],interpolation:'smooth',outputUnit:'pixels'});
const hash=(x,y=0)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n)};
const R=(o,id,c,a=0,b=1)=>random.range({seed:o.seed,layer:'earth',id,channel:c},a,b);
let memo,cacheKey;
function design(o){
 if(cacheKey===o.seed)return memo; const rng=new Rng(o.seed);
 const rocks=Array.from({length:188},(_,i)=>{const large=i<48,born=large?1.55+i*.076:R(o,i,'born',1.4,5.8),life=large?R(o,i,'life',1.6,2.12):R(o,i,'life',.8,1.65),a=R(o,i,'angle',0,TAU);return {id:i,born,life,x:R(o,i,'x',-142,144),y:R(o,i,'y',-2,large?8:19),s:i<12?R(o,i,'s',14,19):large?R(o,i,'s',7,12):R(o,i,'s',1.7,5),a,spin:R(o,i,'spin',-2.5,2.5),depth:R(o,i,'depth',-1,1),dest:R(o,i,'dest',0,TAU),shape:i<12?[[-1,-.28],[-.5,-.52],[.65,-.45],[1,.02],[.65,.53],[-.8,.42]]:stoneShape(rng)};});
 const massData={rocks,totalMass:0};for(const q of rocks){q.mass=q.s**3;massData.totalMass+=q.mass;}for(const q of rocks)q.targetR=radiusAt(q.born+q.life,massData);
 const cracks=Array.from({length:18},(_,i)=>{let x=sx,y=5;const a=i*TAU/18;return Array.from({length:8},(_,j)=>{if(j){x+=Math.cos(a)*R(o,i,j,10,23)+R(o,i,`jx${j}`,-4,4);y+=Math.sin(a)*R(o,i,`jy${j}`,2,4)}return[x,y]})});
 const terrain=Array.from({length:20},(_,i)=>({x:-149+i*15,y:Math.sin(i*1.7)*2-1-R(o,i,'top',0,3),s:R(o,i,'slab',8,13),shape:stoneShape(rng)}));
 const wake=rocks.filter(q=>[0,3,8,11].includes(q.id)).map(q=>trail.history({id:`plate-${q.id}`,born:q.born,end:q.born+q.life,space:'effect',sample(time){const a=at(q,time);return{position:[a.x,a.y]};}},{id:`earth-wake-${q.id}`,length:{seconds:.34},stepSeconds:1/60,death:{mode:'fade',seconds:.17}}));
 const coreSource=motion.source({position:[seedX,height]});
 const births=schedule.rate({id:'earth-dust',start:1.65,end:6.1,rate:29});
 const smoke=particle.emitter({id:'gravitational-dust',seed:o.seed,births,initial:{life:[1.2,2.4],data:c=>({x:c.rand('x',-145,145),y:c.rand('y',0,16),size:c.rand('size',3,6),curl:c.rand('curl',-12,12)})},motion:{trajectory:s=>{const q=s.age01,u=q*q,d=s.data;const tx=sx+d.curl;return{position:[d.x*(1-u)+tx*u,d.y*(1-u)-110*u],velocity:[2*q*(tx-d.x)/s.life,2*q*(-110-d.y)/s.life]}}},material:{opacity:curve.scalar({input:'particle.age01',points:[[0,0],[.12,.55],[.6,.44],[1,0]]})}});
 cacheKey=o.seed;return memo={rocks,cracks,terrain,smoke,wake,coreSource,totalMass:massData.totalMass};
}
function at(q,t){const u=clamp((t-q.born)/q.life),v=u*u*u,rr=q.targetR;const tx=sx+Math.cos(q.dest)*rr*.85,ty=-131+Math.sin(q.dest)*rr*.8;return{x:q.x+(tx-q.x)*v+Math.sin(Math.PI*u)*q.spin*6,y:q.y+(ty-q.y)*v-Math.sin(Math.PI*u)*11,u,a:q.a+q.spin*u*1.8};}
function drawGround(p,t,d,o){
 // An authored broken patch rather than an opaque full-screen background: transparent export remains usable.
 p.ellipse(0,7,159,22,stone[0]);p.ellipse(0,5,157,22,stone[2]);
 p.shade(-158,-14,158,30,(x,y)=>{const yy=(y-6)/24,xx=x/158;if(xx*xx+yy*yy>1)return; const n=hash(Math.floor(x/5),Math.floor(y/3));return y>19?stone[n>.65?2:1]:stone[n>.88?4:n>.3?3:2]});
 // Deepening excavation / fallen-away centre. Leaving a broad dark bowl gives the attraction a causal source.
 const g=smooth(1.7,6.2,t);
 const V=[[-111,-1],[-93,-7],[-60,-10],[-29,-9],[4,-13],[35,-7],[75,-5],[100,1],[112,8],[89,16],[66,21],[38,18],[7,23],[-29,20],[-60,22],[-91,14]];
 p.poly(V.map(([x,y])=>[sx+x*g,6+y*g*.68]),ink);
 // Exposed foreground cliff faces: the earth has depth below its torn surface.
 const cut=[[-111,5],[-91,14],[-60,22],[-29,20],[7,23],[38,18],[66,21],[89,16],[112,8]];
 for(let i=1;i<cut.length;i++){const a=cut[i-1],b=cut[i],dep=3+hash(i)*5;p.poly([[sx+a[0]*g,6+a[1]*g*.68],[sx+b[0]*g,6+b[1]*g*.68],[sx+b[0]*g,6+b[1]*g*.68-dep*g],[sx+a[0]*g,6+a[1]*g*.68-dep*g]],stone[i%2+1]);p.line(sx+a[0]*g,6+a[1]*g*.68-dep*g,sx+b[0]*g,6+b[1]*g*.68-dep*g,stone[4]);}
 
 for(let i=0;i<d.terrain.length;i++){const q=d.terrain[i];if(i%3===0||Math.abs(q.x)>132)drawRock(p,q.x,q.y,q.s,.05,q.shape,stone);else if(t<2.0+i*.13)drawRock(p,q.x,q.y,q.s*.55,.05,q.shape,stone);}
 const open=smooth(1.4,2.15,t);
 for(let i=0;i<d.cracks.length;i++){const pts=d.cracks[i],n=Math.min(pts.length,Math.floor(open*pts.length)+1);for(let j=1;j<n;j++){let[a,b]=[pts[j-1],pts[j]];p.beam(a[0],a[1],b[0],b[1],1.5+g*1.7,ink);p.line(a[0],a[1]-1,b[0],b[1]-1,stone[5],.6);}}
 // Sphere shadow and broken perspective strata.
 p.ellipse(sx+8,10,16+radiusAt(t,d)*1.25,5+radiusAt(t,d)*.13,ink,.6);
 for(let i=0;i<45;i++){const x=R(o,i,'gravelx',-146,146),y=R(o,i,'gravely',-8,26);if(Math.abs(x-sx)<75*g&&Math.abs(y-8)<10*g)continue;p.px(x,y,i%4===0?stone[5]:stone[1]);}
}
function ruin(p,t){
 // A far ruined torii-like gate, kept low and tiny for scale. Two posts break away during the pull.
 const k=smooth(3.2,4.3,t),x=112,y=-8;
 p.poly([[x-11,y],[x-10,y-27],[x-6,y-27],[x-6,y],[x+8,y],[x+8,y-27],[x+12,y-27],[x+11,y]],stone[1]);
 if(t<3.6){p.beam(x-16,y-29,x+17,y-29,3,stone[3]);p.line(x-17,y-31,x+18,y-31,stone[5]);}
 p.line(x-8,y-27,x-8,y-8,stone[4]);p.line(x+10,y-27,x+10,y-8,stone[4]);
 if(t<3.6)p.poly([[x-16,y-31],[x-9,y-34],[x+10,y-34],[x+18,y-31]],stone[2]);
 if(k>0){p.line(x+7,y-12,x+12,y-16,ink);p.px(x+11,y-16,stone[6]);}
}
function gateRubble(p,t){
 if(t<3.6||t>5.6)return;const u=(t-3.6)/2,v=u*u*u,x=112+(42-112)*v,y=-38+(-125+38)*v-8*Math.sin(Math.PI*u),a=-u*1.2,dx=Math.cos(a)*17,dy=Math.sin(a)*17;
 p.beam(x-dx,y-dy,x+dx,y+dy,4,stone[1]);p.beam(x-dx,y-dy-1,x+dx,y+dy-1,2,stone[4]);p.line(x-dx,y-dy-3,x+dx,y+dy-3,stone[6]);
 for(let i=0;i<5;i++){const age=u-i*.06;if(age<0)continue;p.px(x+(i-2)*2,y+3+age*9,stone[3]);}
}
function caster(p,t){
 const x=-112,y=8,chant=t<1.4;
 p.ellipse(x+1,y+1,11,3,ink);
 // A dark long coat with red clouds, orange hair, and raised hands; a pixel silhouette only 23px tall.
 p.poly([[x-4,y-16],[x+4,y-16],[x+7,y],[x-7,y]],ink);p.poly([[x-3,y-14],[x,y-12],[x+2,y-1],[x-5,y-1]],hex('#29252f'));
 p.line(x-4,y-1,x-5,y+3,ink);p.line(x+4,y-1,x+5,y+3,ink);
 p.circle(x,y-19,3,hex('#c17443'));p.px(x-3,y-21,hex('#e3a55e'));p.px(x+2,y-20,hex('#e3a55e'));
 p.line(x-2,y-18,x+2,y-18,hex('#d5c1a3'));p.px(x+2,y-19,ink);
 if(chant){p.beam(x-4,y-14,x,y-11,3,hex('#35303c'));p.beam(x+5,y-14,x+1,y-11,3,hex('#35303c'));p.px(x,y-11,hex('#ddbd95'));}
 else{p.beam(x-4,y-14,x-8,y-18,3,hex('#35303c'));p.beam(x+4,y-14,x+9,y-18,3,hex('#35303c'));p.px(x+9,y-19,hex('#ddbd95'));p.px(x-8,y-19,hex('#ddbd95'));}
 p.circle(x-2,y-7,1.7,hex('#a74b4b'));p.circle(x+3,y-3,1.2,hex('#a74b4b'));
 const wind=smooth(2,4,t);p.poly([[x-5,y-4],[x-5-8*wind,y-7],[x-6,y-11]],hex('#26212c'));
}
function sphere(p,t,d){
 const r=radiusAt(t,d);if(r<2)return;const cy=height.sample(t),theta=.08*Math.max(0,t-3),ca=Math.cos(theta),sa=Math.sin(theta);
 // A narrow violet occultation rim is behind the rocky silhouette, not an accretion disk.
 p.glow(sx,cy,r+8,violet,.028*smooth(1.6,3,t));
 p.shade(sx-r-4,cy-r-4,sx+r+4,cy+r+4,(x,y,out)=>{
  let nx=(x-sx)/r,ny=(y-cy)/r,rr=nx*nx+ny*ny;if(rr>1.08)return;
  const angle=Math.atan2(ny,nx),rim=1+.022*Math.sin(angle*19+.4)+.015*Math.sin(angle*37+2);
  if(rr>rim*rim)return;
  if(rr>1)rr=.999;let nz=Math.sqrt(Math.max(0,1-rr));
  // World-space rock cells rotate slowly. Quantized cell faces break the perfect globe.
  const ax=(nx*ca+nz*sa)*r,ay=ny*r,az=(-nx*sa+nz*ca)*r;
  const cx=Math.floor(ax/10),cyy=Math.floor(ay/9);let best=1e6,second=1e6,cellX=0,cellY=0;
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const X=cx+i,Y=cyy+j,dx=ax-(X+hash(X,Y)*.8+.1)*10,dy=ay-(Y+hash(X+71,Y)*.8+.1)*9,dd=dx*dx+dy*dy;if(dd<best){second=best;best=dd;cellX=X;cellY=Y}else if(dd<second)second=dd;}
  const gap=(Math.sqrt(second)-Math.sqrt(best)),cell=hash(cellX+19,cellY-4);
  const nd=Math.max(0,-nx*.5-ny*.65+nz*.56),facet=(cell-.5)*.19;
  let light=.12+nd*.83+facet;let index=Math.max(1,Math.min(7,Math.floor(light*7.3)));
  if(gap<.65)index=Math.max(0,index-2);else if(gap<1.3&&ny<.6)index=Math.min(7,index+1);
  const strata=Math.sin(ay*.63+ax*.17+cell*4);if(strata>.93)index=Math.max(1,index-1);
  if(hash(Math.floor(ax*1.1),Math.floor(ay*1.1))>.96)index=Math.max(1,index-1);
  // Broad cast shadows / impact hollows add relief without uniform noisy highlights.
  const pit=Math.sin(ax*.11+Math.cos(ay*.12)*1.4)*Math.sin(ay*.15+.4);if(pit>.68)index=Math.max(1,index-2);
  if(rr>.96)index=nx<-.2&&ny<.3?5:0;
  return stone[index];
 });
 // Sparse angular silhouette lumps create a broken planet rather than a smooth energy orb.
 for(let i=0;i<24;i++){const a=i*TAU/24+(hash(i)-.5)*.19,s=1.5+hash(i+9)*3.5;drawRock(p,sx+Math.cos(a)*(r-2.5),cy+Math.sin(a)*(r-2.5),s,a,d.rocks[i].shape,stone);}
}
function debris(p,t,d,front){
 for(const q of [...d.rocks].sort((a,b)=>a.depth-b.depth)){if((q.depth>0)!==front||t<q.born||t>q.born+q.life+.12)continue;const a=at(q,t),fade=1-smooth(.96,1.04,a.u);if(q.id<12&&a.u<.4){p.ellipse(q.x,q.y+3,q.s*(.5+a.u),q.s*.2,ink);p.disc(q.x,q.y-2-8*a.u,q.s*.7,dust[2],.2*(1-a.u/.4));}drawRock(p,a.x,a.y,q.s*(1+.28*Math.sin(Math.PI*a.u)-.15*a.u),a.a,q.shape,stone,fade);if(a.u>.2&&a.u<.96){const b=at(q,t-.06),c=at(q,t-.12);p.line(c.x,c.y,b.x,b.y,dust[1],.35);p.px(b.x,b.y,stone[3]);}}
}
function grit(p,t,o,d){
 for(let i=0;i<260;i++){const born=R(o,i,'grainborn',1.7,6.4),life=R(o,i,'grainlife',.9,2.1),u=(t-born)/life;if(u<0||u>1)continue;const x0=R(o,i,'grainx',-145,145),y0=R(o,i,'grainy',-2,20),a=R(o,i,'ga',0,TAU),rr=radiusAt(born+life,d),v=u*u*u,x=x0+(sx+Math.cos(a)*rr*.9-x0)*v,y=y0+(-131+Math.sin(a)*rr*.7-y0)*v;const dx=(sx-x0)*3*u*u/life,dy=(-131-y0)*3*u*u/life;p.line(x-dx*.028,y-dy*.028,x,y,stone[i%3+3],1-smooth(.8,1,u));}
}
export function draw(p,t,o){
 const d=design(o);drawGround(p,t,d,o);ruin(p,t);for(const h of d.wake)trail.draw(p,h,t,{width:q=>.7+4*(1-q.s),color:dust[1],alpha:q=>.22*Math.max(0,1-q.ageSeconds/.5)});gateRubble(p,t);debris(p,t,d,false);
 particle.draw(p,d.smoke,t,{draw(p,s){material.smoke(p,s,{size:s.data.size*1.08,tint:dust[3]});}});
 const cy=height.sample(t),coreX=seedX.sample(t);if(t<3.4){const alpha=1-smooth(2.9,3.4,t),r=2.8+Math.sin(t*15)*.3;p.glow(coreX,cy,16,violet,.15*alpha);p.circle(coreX,cy,r+1.25,violet,alpha);p.circle(coreX,cy,r+.25,ink,alpha);if(t>.45&&t<1.35){const bx=seedX.sample(Math.max(0,t-.045)),by=height.sample(Math.max(0,t-.045));p.line(bx,by,coreX,cy,ink);}}
 sphere(p,t,d);grit(p,t,o,d);debris(p,t,d,true);caster(p,t);
 // Low ground dust wake: tied to actual heave, then thins while the captive moon remains.
 for(let i=0;i<22;i++){const b=1.7+i*.16,u=(t-b)/1.5;if(u<0||u>1)continue;const x=-144+i*13.4;p.disc(x+(sx-x)*u*.25,-2-9*u,4+u*8,dust[2],.22*Math.sin(Math.PI*u));}
}
export function observe(t,o){const d=design(o);return{particles:[particle.observe(d.smoke,t)],sources:[motion.observeSource(d.coreSource,t,{id:'black-seed'})],trails:d.wake.map(h=>trail.observe(h,t))};}
