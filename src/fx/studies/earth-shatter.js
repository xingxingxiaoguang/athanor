// 山崩地裂修稿1 · Falling Mountain. Original falling mountain, impact and branching fault choreography.
// Fracture generation/growth now directly reuses ice/_lib fractures/drawFractures (MIT; original sources retain credits).
// Direct mature reuse: nature/_lib stoneShape/drawRock; projectile/_lib cloud;
// public path arc-length strips and contact.trace. Sprite Fusion/Hugo Duprez MIT credits retained.
import {fractures,drawFractures} from '../ice/_lib.js';
import {hex,fit,clamp,smooth,TAU,rr,lerp,drawRock,stoneShape,Rng,cloud,contact,path} from './_production-kit.js';
export const meta={name:'山崩地裂 · Falling Mountain',desc:'A massive airborne peak accelerates down, hits with a short stop, tears branching faults outward from the impact and breaks into heavy flying stone.',tags:['earth','falling-mountain','impact','山崩地裂','revision'],size:[360,240],origin:[180,200],duration:6.4,loop:false,fps:30,options:{seed:57,light:1,version:4,groundPatch:true}};
export const events={fall:.4,impact:1.7,stop:1.8,fracture:1.85,breakup:2.15,aftershock:3.7,clear:6.4};
export const authoring={ending:'clear',bounds:{mode:'asset'}};
const S=fit(['#14171e','#2c3038','#47494c','#625d56','#817460','#a7936f','#c9b48b','#eddbad'],8),D=fit(['#252831','#44464b','#666361','#928574','#b7a58a','#d8c9aa'],6),WR=fit(['#2d2831','#55434a','#806451','#b68d60','#d6b384','#f4dbab'],6),INK=hex('#080d17');
const outline=[[-72,-5],[-58,-25],[-48,-26],[-45,-46],[-36,-42],[-28,-66],[-18,-64],[-14,-91],[-6,-81],[2,-77],[12,-51],[24,-59],[30,-48],[28,-38],[48,-26],[53,-8],[68,3],[43,8],[-52,8]];
const inside=(x,y)=>{let v=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){const a=outline[i],b=outline[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])v=!v;}return v;};
// Local damped jolts adapted from nature/quake.js, not the unconnected actor act clock.
function shake(t){return [1.7,2.17,2.63].reduce((v,b,i)=>t>b?v+Math.exp(-(t-b)*9)*Math.sin((t-b)*76)*(2.5-i*.6):v,0);}
function altitude(t){if(t<.4)return-106;if(t<1.7){const u=(t-.4)/1.3;return-106+102*u*u*u;}return-4+9*smooth(1.8,2.3,t);}
let key,memo;
function design(o){if(key===o.seed+':'+o.version)return memo;const R=new Rng(o.seed),faults=[];
 // Parents radiate from the actual impact point. Child clocks start only after
 // the parent growth front reaches their attachment point, then grow continuously.
 const rawFaults=fractures(new Rng(o.seed+270),(x,z)=>(x*x)/(153*153)+(z*z)/(95*95)<1,0,0,10,{step:[12,20],len:16,fork:.16});
 const matureFaults=rawFaults.map(pts=>pts.map(([x,z,d])=>[x,4+z*.23,d]));
 const floor=contact.floor({id:'impact-ground',y:16,restitution:.29,tangentRetention:.66,settleSpeed:8});
 const fragments=[];const centres=[[-7,-74],[-29,-52],[10,-50],[-46,-26],[-17,-25],[14,-23],[42,-17],[-52,-5],[-27,-3],[0,-4],[28,-3],[54,2]];
 for(let i=0;i<centres.length;i++){const[x,y]=centres[i],born=2.06+(y+80)*.006;fragments.push({id:i,born,life:3.2,size:i<3?13:rr(o.seed,i,'size',13,20),shape:stoneShape(R),spin:rr(o.seed,i,'spin',-2,2),track:contact.trace({position:[x,y],velocity:[x*.75+rr(o.seed,i,'vx',-15,15),rr(o.seed,i,'vy',-24,6)],acceleration:[0,180],drag:[.4,0],born,life:3.2,floor,layer:'mountain',particle:`mass-${i}`})});}
 for(let i=0;i<64;i++){const born=1.7+rr(o.seed,i,'chipborn',0,.13),x=rr(o.seed,i,'chipx',-13,13),y=rr(o.seed,i,'chipy',0,6);fragments.push({id:100+i,born,life:rr(o.seed,i,'chiplife',1.5,2.8),size:rr(o.seed,i,'chipsize',1.2,4.5),shape:stoneShape(R),spin:rr(o.seed,i,'chipspin',-9,9),track:contact.trace({position:[x,y],velocity:[rr(o.seed,i,'chipvx',-145,145),rr(o.seed,i,'chipvy',-140,-45)],acceleration:[0,230],drag:[.85,0],born,life:2.8,floor,layer:'impact',particle:`chip-${i}`})});}
 key=o.seed+':'+o.version;return memo={faults,fragments,matureFaults};}
function mountain(p,t,o){const y=altitude(t),sx=shake(t),fade=1-smooth(4.6,5.6,t),cut=t<2.05?-90:lerp(-90,8,smooth(2.05,3.05,t));if(cut>=8)return;
 p.shade(-76+sx,y-95,74+sx,y+12,(px,yy,out)=>{const x=px-sx,by=yy-y;if(by<cut||!inside(x,by))return;const nearEdge=!inside(x-1,by)||!inside(x+1,by)||!inside(x,by-1)||!inside(x,by+1);let c;if(nearEdge)c=by<-64?S[6]:S[0];else{const ridge=-14+(by+91)*.08+Math.sin(by*.13)*3,face=x<ridge-22?4:x<ridge-3?5:x<ridge+12?3:2;let i=face;if(Math.abs(x-ridge)<1.1&&by<-35&&Math.sin(by*.23)>.1)i=7;const bed=by+Math.sin(x*.09)*3+Math.floor(x/18)*1.4,band=Math.floor(bed/13),strata=bed-band*13;if(strata<1.2&&rr(44,band,Math.floor(x/13))>.38)i=Math.max(1,i-1);if(rr(39,Math.floor(x/8),Math.floor(by/6))>.93)i=Math.min(7,i+1);c=S[i];}if(t>=1.7&&t<1.7333333333333334&&by>-32)c=S[7];out.c=c;out.a=fade;});
 if(t>1.84){const k=smooth(1.84,2.16,t);p.polyline([[-7,-81],[-14,-57],[0,-42],[-7,-17],[5,3]].map(([x,yy])=>[x,yy+y]),INK,k);p.polyline([[-12,-55],[-30,-43],[-38,-19],[-54,-6]].map(([x,yy])=>[x,yy+y]),INK,k);}
}
export function draw(p,t,o){if(t>=meta.duration)return;const d=design(o),fade=1-smooth(5.4,6.35,t),impact=t-1.7;
 if(o.groundPatch){p.poly([[-155,4],[-136,-8],[-92,-10],[-52,-5],[-12,-12],[35,-8],[82,-12],[128,-5],[154,8],[132,24],[79,28],[30,23],[-17,29],[-64,24],[-113,25]],S[1],fade);p.poly([[-150,0],[-132,-10],[-91,-12],[-52,-8],[-12,-15],[35,-11],[82,-15],[128,-8],[149,4],[129,19],[78,23],[30,18],[-17,24],[-64,19],[-112,20]],S[3],fade);}
 // The shadow expands as the peak approaches; the mountain never rises from this surface.
 const near=smooth(.4,1.7,t);p.ellipse(0,7,24+near*48,5+near*9,INK,(.25+.45*near)*fade*(1-smooth(1.68,1.72,t)));
 if(impact>0){const g=smooth(0,.35,impact),V=[];for(let i=0;i<=18;i++){const a=i/18*TAU,r=1+.09*Math.sin(a*7+.4);V.push([Math.cos(a)*(22+33*g)*r,7+Math.sin(a)*(5+9*g)*r]);}p.poly(V,INK,fade);for(let i=1;i<10;i++){const a=V[i-1],b=V[i];p.line(a[0],a[1]+1,b[0],b[1]+1,S[5],fade*.8);}}
 // Direct drawFractures retains inherited fork distance and clips the leading segment continuously.
 const reach=Math.max(0,(t-1.72))*255;drawFractures(p,d.matureFaults,reach,[S[0],S[0],INK,S[0],S[5]],{hot:false,a:fade,ox:shake(t)});
 // Stone-material undercuts adapt the same [x,y,d] fronts into wider dark grooves.
 for(const pts of d.matureFaults)for(let i=1;i<pts.length;i++){const[a,b]=[pts[i-1],pts[i]];if(a[2]>=reach)break;const f=Math.min(1,(reach-a[2])/(b[2]-a[2]));p.beam(a[0]+shake(t),a[1],lerp(a[0],b[0],f)+shake(t),lerp(a[1],b[1],f),Math.max(1.3,(pts[0][2]===0?7:4.3)*(1-a[2]/280)),INK,fade);p.line(a[0]+shake(t),a[1]+2,lerp(a[0],b[0],f)+shake(t),lerp(a[1],b[1],f)+2,S[1],fade*.8);}
 if(impact>=0&&impact<.1){const k=1-impact/.1;p.ellipse(0,3,56,11,S[7],k);p.glow(0,2,38,hex('#dbb687'),k*.06);}
 mountain(p,t,o);
 for(const q of d.fragments){const age=t-q.born;if(age<0||age>=q.life)continue;const st=q.track.sample(age);drawRock(p,...st.position,q.size,age*q.spin,q.shape,S,Math.min(1,(q.life-age)*2)*fade);}
 const dust=[];if(impact>=0){for(let i=0;i<22;i++){const age=impact-i*.018;if(age<0||age>2.7)continue;const side=i%2?1:-1,f=1-Math.exp(-age*2);dust.push({x:side*f*(28+rr(o.seed,i,'dustreach',10,88)),y:4-age*rr(o.seed,i,'dustrise',3,9),r:3+f*rr(o.seed,i,'dustr',7,14),a:Math.sin(Math.PI*age/2.7)*.43*fade,b:.65,w:Math.exp(-age*6)*.2});}}
 cloud(p,dust,D,WR,{dens:1.25,max:.72,lit:1.15});
}

// Retained editable artwork; technical checks do not imply final art approval.
export const asset={status:"study",source:"experiments/vfx-lab/effects/earth-shatter.js",revision:"f207224ec08573ec71c8832c657ebd5ff1d998e9"};
