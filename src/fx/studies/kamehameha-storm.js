/* Kamehameha / BLUE HORIZON — original pixel production study, 2026-11-06.
 * Beam cross-section bands, travelling pulses/near-side sine filaments and layered
 * charge orb adapt src/fx/arcane/{arcane-beam,spell-charge}.js, which adapt
 * https://www.spritefusion.com/pixel-art-vfx/energy — MIT, Copyright (c) 2026 Hugo Duprez.
 * The original Athanor skeleton/poseAt solve the actor's joints; original artwork
 * here supplies the gi, anatomy silhouettes, hair, staging and all choreography.
 * Contact debris uses public authoring contact/particle/material operators.
 */
import {hex, mix, skeleton, poseAt, TAU, WHITE} from '../../core/index.js';
import {curve, random, schedule, particle, contact, material, trail} from '../../authoring/index.js';

export const meta={name:'BLUE HORIZON — Kamehameha',desc:'A martial artist compresses a blue-white sun at his hip and drives it through the horizon. Original eight-second pixel performance.',tags:['anime','kamehameha','beam','character','production'],size:[360,240],origin:[0,0],duration:8,loop:false,fps:30,bg:'dark',options:{seed:73,light:1}};
export const events={gather:1.1,compression:3.12,release:3.5,fullBeam:3.8,cutoff:6.05,recovery:7.2};
export const authoring={ending:'persistent'};
const C=Object.fromEntries(Object.entries({ink:'#0b1427',deep:'#0b3d89',blue:'#1677dc',azure:'#26a8fa',cyan:'#63ddff',ice:'#bbf5ff',white:'#f4fdff',orange:'#f29232',orangeL:'#ffd071',orangeD:'#af431f',skin:'#f4b56e',skinL:'#ffddb1',skinD:'#ad624b',navy:'#172e74',navyL:'#3865aa',rock:'#3d435c',rockL:'#798292',rockD:'#1e293e'}).map(([k,v])=>[k,hex(v)]));
const clamp=v=>Math.max(0,Math.min(1,v)),sm=(a,b,t)=>{let q=clamp((t-a)/(b-a));return q*q*(3-2*q)},lerp=(a,b,q)=>a+(b-a)*q;
const rand=(seed,id,channel,min=0,max=1)=>random.range({seed,layer:'blue-horizon',id,channel},min,max);
const charge=curve.scalar({points:[[0,0],[.65,0],[1.4,.36],[2.6,1],[3.08,1],[3.37,.55],[3.5,0]],input:'local.seconds',interpolation:'smooth'});
const beamPower=curve.scalar({points:[[0,0],[3.48,0],[3.53,.85],[3.65,1],[5.6,1],[6.05,.85],[6.27,.75],[6.4,0],[8,0]],input:'local.seconds',interpolation:'smooth'});
const REST={lean:0,crouch:1,fx:6,fy:-17,bx:7,by:-17,ffx:9,fbx:-8,ffy:-3,fby:-3};
const CUP={lean:-2,crouch:6,turn:.95,fx:-6,fy:-17,bx:-8,by:-20,ffx:9,fbx:-10,ffy:-3,fby:-3};
const PUSH={lean:6,crouch:2,turn:.15,fx:20,fy:-23,bx:17,by:-22,ffx:11,fbx:-10,ffy:-3,fby:-3,toeB:true};
const TRACK=[[0,REST],[.6,REST],[1.2,CUP],[2.8,{...CUP,crouch:7,lean:-3}],[3.34,{...CUP,crouch:8,lean:-4}],[3.5,{...PUSH,lean:9},'out'],[3.7,PUSH],[5.8,{...PUSH,crouch:3}],[6.18,{...PUSH,lean:4}],[6.7,{...PUSH,fx:13,fy:-18,bx:11,by:-17,lean:2}],[7.4,REST],[8,REST]];
function actorPose(t){return poseAt(TRACK,t)}
function actorJoints(t){const q=actorPose(t),s=skeleton(q).joints,x=63+(q.x??0),y=205;return Object.fromEntries(Object.entries(s).map(([k,v])=>[k,[x+v[0]*2.7,y+v[1]*2.7,v[2]]]))}
function hands(t){const j=actorJoints(t);return [(j.handN[0]+j.handF[0])*.5+2,(j.handN[1]+j.handF[1])*.5]}
const cache=new Map();
function design(seed){
 if(cache.has(seed))return cache.get(seed);
 const chargeBirths=schedule.rate({id:'gather',start:.8,end:3.37,rate:26});
 const gather=particle.emitter({id:'inward-energy',seed,births:chargeBirths,initial:{life:[.32,.58],data:c=>({angle:c.rand('angle',-3.9,2),distance:c.rand('distance',28,66),turn:c.rand('turn',.4,1.3)})},motion:{trajectory:s=>{const a=s.data.angle+s.data.turn*s.age01*s.age01,d=s.data.distance*(1-s.age01*s.age01)+4,h=hands(s.time);return {position:[h[0]+Math.cos(a)*d,h[1]+Math.sin(a)*d*.8],velocity:[-Math.cos(a)*120,-Math.sin(a)*110]}}},material:{opacity:curve.scalar({points:[[0,0],[.15,1],[.85,1],[1,0]],input:'particle.age01'})}});
 const sparks=particle.emitter({id:'release-sparks',seed,births:schedule.burst({id:'burst',at:3.5,count:56,spread:.13}),transform:b=>({position:hands(b)}),initial:{life:[.3,.9],velocity:c=>{let a=c.rand('angle',-Math.PI,Math.PI),v=c.rand('speed',45,150);return [Math.cos(a)*v,Math.sin(a)*v*.7]},scale:[.6,1.2]},motion:{acceleration:[20,65],drag:.5},material:{opacity:curve.scalar({points:[[0,1],[.65,1],[1,0]],input:'particle.age01'})}});
 const floor=contact.floor({id:'stone-stage',y:205,restitution:.35,tangentRetention:.7,settleSpeed:8});
 const rocks=particle.emitter({id:'ground-shards',seed,births:schedule.burst({id:'shards',at:3.53,count:32,spread:.25}).map((b,i)=>({...b,position:[45+i*7.5,202]})),initial:{life:[1.8,2.7],velocity:c=>[c.rand('vx',12,70),c.rand('vy',-90,-28)],scale:[.8,2.2],rotation:[0,6],spin:[-9,9]},motion:{acceleration:[0,150],drag:.25,contact:floor},material:{opacity:curve.scalar({points:[[0,1],[.8,1],[1,0]],input:'particle.age01'})}});
 const dust=particle.emitter({id:'floor-dust',seed,births:schedule.rate({id:'dust',start:3.53,end:5.85,rate:20}).map((b,i)=>({...b,position:[50+rand(seed,i,'dust-x',0,260),203]})),initial:{life:[.5,1.25],velocity:c=>[c.rand('vx',25,70),c.rand('vy',-15,-4)],scale:[1.8,4]},motion:{acceleration:[0,-5],drag:.8},material:{opacity:curve.scalar({points:[[0,0],[.2,.55],[.65,.35],[1,0]],input:'particle.age01'})}});
 const arcTracks=Array.from({length:4},(_,i)=>({id:'orbit-'+i,born:1.15+i*.12,end:3.4,space:'effect',sample:time=>{const q=(time-1.15-i*.12)/2.25,h=hands(time),a=-q*TAU*(1.2+i*.13)+i*1.7,r=25-16*q;return {position:[h[0]+Math.cos(a)*r,h[1]+Math.sin(a)*r*.6],velocity:[0,0]}}}));
 const orbits=arcTracks.map(tr=>trail.history(tr,{length:{seconds:.11},stepSeconds:1/60,death:{mode:'fade',seconds:.12}}));
 const d={gather,sparks,rocks,dust,orbits};cache.set(seed,d);return d;
}
function limb(p,a,b,w,col,lit){p.beam(a[0],a[1],b[0],b[1],w*1.16+2,C.ink);p.beam(a[0],a[1],b[0],b[1],w*1.16,col);if(lit)p.beam(a[0]-1,a[1]-1,b[0]-1,b[1]-1,Math.max(1,w*.25),lit)}
function jointPoint(a,b,q){return [lerp(a[0],b[0],q),lerp(a[1],b[1],q)]}
function drawActor(p,t){
 const j=actorJoints(t),pel=j.pelvis,ch=j.chest,head=j.head;
 const leg=(far)=>{let hip=j['hip'+far],k=j['knee'+far],a=j['ankle'+far],toe=j['toe'+far];limb(p,hip,k,11,far==='F'?C.orangeD:C.orange,far==='F'?null:C.orangeL);limb(p,k,a,9,far==='F'?C.orangeD:C.orange);let boot=jointPoint(k,a,.55);limb(p,boot,a,7,C.navy,C.navyL);limb(p,a,toe,6,C.navy,C.navyL);p.line(boot[0]-3,boot[1],boot[0]+3,boot[1]-1,C.orangeL)};
 leg('F');
 const arm=(far)=>{let s=j['shoulder'+far],e=j['elbow'+far],h=j['hand'+far];limb(p,s,e,6,far==='F'?C.skinD:C.skin,C.skinL);limb(p,s,jointPoint(s,e,.4),8,far==='F'?C.orangeD:C.orange,C.orangeL);limb(p,e,h,5,far==='F'?C.skinD:C.skin,C.skinL);limb(p,jointPoint(e,h,.7),jointPoint(e,h,.91),6,C.navy,C.navyL);p.circle(h[0],h[1],3.3,C.ink);p.circle(h[0],h[1],2.4,C.skinL)};
 arm('F');leg('N');
 p.poly([[pel[0]-7,pel[1]+2],[pel[0]+8,pel[1]+2],[ch[0]+10,ch[1]-3],[ch[0]-9,ch[1]-4]],C.ink);
 p.poly([[pel[0]-6,pel[1]],[pel[0]+6,pel[1]],[ch[0]+8,ch[1]-3],[ch[0]-7,ch[1]-3]],C.orange);
 p.poly([[ch[0]-6,ch[1]-4],[ch[0]+7,ch[1]-4],[ch[0]+3,ch[1]+8]],C.navy);
 p.line(ch[0]-5,ch[1]-3,ch[0]+1,ch[1]+9,C.orangeL);
 p.line(ch[0]+1,ch[1]+9,pel[0]+4,pel[1]-2,C.orangeD);p.line(ch[0]+5,ch[1]+10,pel[0]+5,pel[1]-4,C.orangeL);
 limb(p,[pel[0]-7,pel[1]],[pel[0]+7,pel[1]],4,C.navy,C.navyL);
 p.poly([[pel[0]-2,pel[1]],[pel[0]+2,pel[1]],[pel[0]-2,pel[1]+13],[pel[0]-4,pel[1]+12]],C.navy);
 p.poly([[pel[0]+2,pel[1]],[pel[0]+5,pel[1]+1],[pel[0]+10,pel[1]+7],[pel[0]+7,pel[1]+7]],C.navyL);
 limb(p,j.neck,[head[0],head[1]+3],5,C.skin,C.skinL);
 p.ellipse(head[0]+1,head[1]+1,6.5,7,C.ink);
 p.poly([[head[0]-4,head[1]-5],[head[0]+5,head[1]-5],[head[0]+7,head[1]+1],[head[0]+9,head[1]+2],[head[0]+6,head[1]+4],[head[0]+5,head[1]+7],[head[0]-2,head[1]+7],[head[0]-5,head[1]+2]],C.skin);
 p.poly([[head[0]+2,head[1]-4],[head[0]+5,head[1]-3],[head[0]+6,head[1]+1],[head[0]+7,head[1]+2],[head[0]+5,head[1]+4],[head[0]+3,head[1]+4]],C.skinL);
 const hair=[[-8,1],[-10,-5],[-5,-4],[-11,-11],[-4,-9],[-5,-17],[0,-12],[4,-19],[7,-11],[13,-12],[8,-6],[11,-4],[4,-4],[1,0],[-1,-5],[-5,-2]].map(([x,y])=>[head[0]+x,head[1]+y]);p.poly(hair,C.ink);
 p.poly([[head[0]-7,head[1]-10],[head[0]-2,head[1]-8],[head[0]+3,head[1]-14],[head[0]+2,head[1]-8],[head[0]-2,head[1]-4]],hex('#1e2a3a'));
 p.line(head[0]+3,head[1]-1,head[0]+6,head[1]-2,C.ink);p.px(head[0]+6,head[1],C.ink);p.line(head[0]+4,head[1]+5,head[0]+6,head[1]+5,C.skinD);
 arm('N');
 // The face and right-facing folds catch the hand's cool light, without washing the gi out.
 const h=hands(t),k=Math.max(charge.sample(t)*.65,beamPower.sample(t)*.45);if(k>0){p.line(head[0]+7,head[1]+1,head[0]+5,head[1]+6,C.ice,k*.8);p.line(ch[0]+8,ch[1],pel[0]+6,pel[1]-3,C.cyan,k*.8);p.glow(h[0],h[1],32,C.azure,.12*k)}
}
function ellipseRing(p,x,y,rx,ry,color,a=1,width=1,rotation=0){let pts=[],ca=Math.cos(rotation),sa=Math.sin(rotation),n=Math.ceil(Math.max(rx,ry)*7);for(let i=0;i<=n;i++){let q=i/n*TAU,lx=Math.cos(q)*rx,ly=Math.sin(q)*ry;pts.push([x+lx*ca-ly*sa,y+lx*sa+ly*ca])}for(let j=1;j<pts.length;j++)p.beam(...pts[j-1],...pts[j],width,color,a)}
function drawGround(p,t,seed){
 // Quiet blue-violet ridges and a continuous battlefield ground the scale of the blast.
 p.poly([[0,165],[29,153],[52,160],[90,139],[120,156],[149,144],[178,158],[217,141],[255,149],[289,131],[322,143],[360,136],[360,204],[0,204]],hex('#1c2337'));
 p.poly([[0,178],[23,170],[56,177],[86,167],[123,179],[151,169],[185,173],[220,163],[259,177],[292,166],[326,172],[360,161],[360,205],[0,205]],hex('#252c40'));
 p.poly([[0,199],[39,194],[71,198],[112,191],[153,196],[191,190],[227,194],[265,188],[300,194],[335,190],[360,194],[360,240],[0,240]],hex('#303344'));
 p.poly([[0,219],[39,211],[81,214],[133,208],[174,215],[226,208],[278,216],[327,208],[360,216],[360,240],[0,240]],hex('#272c3d'));
 for(let i=0;i<76;i++){let x=rand(seed,i,'ground-x',0,359),y=rand(seed,i,'ground-y',198,239),l=rand(seed,i,'ground-l',2,10);p.line(x,y,x+l,y-1,i%3===0?C.rockL:C.rockD,.42)}
 // Perspective fissures and blasted gouges remain after the light has gone.
 const hot=sm(3.5,3.65,t)*(1-sm(6.1,7.7,t))*(.8+.2*Math.sin(t*14));for(let i=0;i<9;i++){let x=76+i*31,dep=6+rand(seed,i,'depth',0,14),pts=[[x,198],[x-7,203],[x+7,208],[x+13,208+dep],[x+22,213+dep]];p.polyline(pts,C.ink,.65);if(hot){p.polyline(pts,C.azure,hot*.65);p.line(x-7,202,x+6,207,C.cyan,hot*.6)}}
 if(hot){p.glowLine(80,201,327,201,19,C.azure,.14*hot);for(let i=0;i<5;i++){let q=((t-3.5)*.9+i*.2)%1;if(q<0)continue;let x=80+q*255;p.poly([[x-12,205],[x+19,201],[x+6,207],[x-19,211]],C.cyan,(1-q)*hot*.35)}}
 p.ellipse(63,205,31,3,C.ink,.7);
}
function drawCharge(p,t,d){
 let power=charge.sample(t);if(power<=0)return;const [x,y]=hands(t),compress=sm(3.08,3.38,t),r=(4+8*power)*(1-.48*compress),beat=.5+.5*Math.sin(t*(9+t*7));
 // Spiral ribbons preserve history; changing their lifetime is independent of the core material.
 for(let i=0;i<d.orbits.length;i++)trail.draw(p,d.orbits[i],t,{width:q=>.5+1.6*q.s,color:(q,a)=>Math.abs(a)<.3?C.ice:C.azure,alpha:power*.8});
 particle.draw(p,d.gather,t,{draw:(p,s)=>material.streak(p,s,{tint:s.age01>.75?C.ice:C.cyan,maxLength:7,glow:.12})});
 for(let i=0;i<4;i++){let q=((t*.95+i*.25)%1);let rr=r+27*(1-q*q);ellipseRing(p,x,y,rr,rr*(i%2?.42:.8),q>.8?C.ice:C.azure,power*(.3+.7*q),1,i%2?.5:-.4)}
 p.glow(x,y,43,C.blue,.22*power);p.glowRing(x,y,r+2,8,C.cyan,.2*power);
 p.circle(x,y,r+2,C.deep);p.circle(x,y,r+1,C.blue);p.circle(x,y,r,C.azure);p.circle(x-1,y-1,r*.8,C.cyan);p.circle(x-1,y-1,r*.55,C.ice);p.circle(x,y,r*.3,C.white);
 for(let i=0;i<5;i++){let a=t*7+i*TAU/5,rr=r+4+beat*4;let pts=[[x+Math.cos(a)*r*.7,y+Math.sin(a)*r*.7],[x+Math.cos(a+.16)*rr,y+Math.sin(a+.16)*rr],[x+Math.cos(a-.1)*(rr+5),y+Math.sin(a-.1)*(rr+5)]];p.polyline(pts,i%2?C.ice:C.cyan,power)}
}
function beamShape(p,t){
 const power=beamPower.sample(t);if(power<=0)return;const h=hands(t),x0=h[0]+2,y0=h[1],u=1-Math.pow(1-clamp((t-3.5)/.32),3),end=lerp(x0+5,420,u),length=end-x0,tail=sm(6.04,6.4,t),headR=(12+17*u)*power*(1+.055*Math.sin(t*28)),fade=1-sm(6.05,6.28,t);
 // Adapted banded cross-section from arcane-beam. A narrow broken white spine
 // is separated from cyan facets, with moving dark channels to avoid a white slab.
 p.glowLine(x0+tail*length,y0-13*tail*u,end,y0-13*u,28*power,C.azure,.24*power);
 for(let d=tail*length;d<=length;d+=.7){let s=d/Math.max(1,length),x=x0+d,cy=y0-13*s*u+Math.sin(s*9-t*7)*1.1*power,w=(8+20*Math.pow(s,.6))*power*(1+.11*Math.sin(d*.15-t*15)+.04*Math.sin(d*.49+t*31))*(tail>0?sm(tail*length,tail*length+31,d):1);if(w<.25)continue;for(let y=-w*1.16;y<=w*1.16;y+=.7){let q=Math.abs(y)/w,noise=Math.sin(d*.17-t*22+y*.15)*Math.sin(y*.35+d*.07+t*8),pulse=(d*.035-t*4)%1;let col=q<.1?C.white:q<.28?C.ice:q<.58?C.cyan:q<.8?C.azure:q<1?C.blue:C.deep;if(q<.58&&noise>.5)col=q<.18?C.ice:C.azure;if(q>1&&rand(19,Math.floor(x)+'/'+Math.floor(y),'edge')>(1.16-q)/.16)continue;p.px(x,cy+y,col)}for(let i=0;i<3;i++){let a=d*.11-t*17+i*TAU/3,off=Math.sin(a)*w*.88;if(Math.cos(a)>.12)p.line(x,cy+off,x+1,cy+off,(Math.cos(a)>.7)?C.ice:C.cyan)}}
 // A rounded, irregular pressure head; it leads the body, rather than a flat crop.
 const hy=y0-13*u;for(let i=0;i<17;i++){let a=i*TAU/17+t*1.5,rr=headR*(1+.13*Math.sin(i*7+t*19));let x=end+Math.cos(a)*rr*1.1,y=hy+Math.sin(a)*rr;p.beam(end-5,hy,x,y,4,C.blue)}
 p.ellipse(end,hy,headR*1.08,headR,C.azure);p.ellipse(end+1,hy-2,headR*.89,headR*.81,C.cyan);p.ellipse(end+3,hy-4,headR*.64,headR*.59,C.ice);p.ellipse(end+5,hy-5,headR*.31,headR*.29,C.white);
 for(let i=0;i<3;i++){let a=t*12+i*TAU/3,rx=headR*.94,ry=headR*.8;let pts=[];for(let j=0;j<17;j++){let an=a+j*.09;pts.push([end+Math.cos(an)*rx,hy+Math.sin(an)*ry])}p.polyline(pts,C.white,.8)}
 // Pressure rings travel from the palms along the beam. Elliptical and tilted.
 for(let i=0;i<4;i++){let q=((t-3.5)*1.6+i*.25)%1;if(q<tail+.03)continue;let x=x0+q*length,y=y0-13*q*u,r=(13+20*q)*power;ellipseRing(p,x,y,r*.24,r,C.ice,(1-q)*.75,1.5,-.06);ellipseRing(p,x-2,y,r*.34,r+3,C.azure,(1-q)*.45,1,-.06)}
 if(tail===0){p.circle(x0,y0,9*power,C.blue);p.circle(x0+2,y0,7*power,C.cyan);p.circle(x0+3,y0,4.5*power,C.ice);p.glow(x0,y0,22,C.ice,.16*power)}
 // Sparse shear marks around the beam visibly stream forward.
 for(let i=0;i<26;i++){let q=((t-3.5)*(.7+rand(7,i,'speed',0,.5))+rand(7,i,'phase'))%1;if(q<tail)continue;let x=x0+q*length,y=y0-13*q+(i%2?1:-1)*(13+17*q+rand(9,i,'away',0,13));let len=rand(9,i,'len',3,12);p.line(x,y,x+len,y-1,i%3?C.azure:C.ice,power*(1-q)*.7)}
 const shock=t-3.5;if(shock>=0&&shock<.6){let rr=12+85*sm(0,.6,shock);ellipseRing(p,x0,y0,rr*.35,rr*.78,C.ice,(1-shock/.6)*.85,2);p.glowRing(x0,y0,rr,6,C.azure,.15*(1-shock/.6))}
}
function drawAfterglow(p,t,seed){
 if(t<6.12||t>7.4)return;const q=(t-6.12)/1.28,k=(1-q)*(1-q);let h=hands(t);for(let i=0;i<35;i++){let x=rand(seed,i,'after-x',105,335)+q*12,y=rand(seed,i,'after-y',117,166)-q*20;let on=rand(seed,i,'after-life',.3,1);if(q>on)continue;p.dot(x,y,i%3?C.azure:C.ice,k);if(i%7===0)p.glow(x,y,6,C.azure,k*.12)}ellipseRing(p,h[0],h[1],4+q*11,5+q*13,C.cyan,k,1);for(let i=0;i<5;i++){let born=6.08+i*.048,age=t-born;if(age<0||age>.48)continue;let x=120+age*320+i*27,y=145+Math.sin(age*12+i)*18,kk=1-age/.48;p.polyline([[x-17,y+4],[x-9,y-3],[x,y],[x+8,y-5]],i%2?C.azure:C.cyan,kk*.65)}
}
function drawLaunch(p,t){
 const a=t-3.5;if(a<0||a>.28)return;const [x,y]=hands(t),k=1-a/.28;
 // A two-frame hard flash breaks anticipation, followed by directional pressure wedges.
 for(let i=0;i<9;i++){let an=-2.6+i*.6,len=(i%2?40:58)*k,dx=Math.cos(an),dy=Math.sin(an);p.poly([[x-dy*2,y+dx*2],[x+dx*len,y+dy*len],[x+dy*2,y-dx*2]],a<.065?C.ice:C.azure,k*.7)}
 if(a<.067){p.circle(x,y,18*(1-a/.09),C.ice);p.circle(x,y,10*(1-a/.09),C.white)}
 const r=15+185*(1-Math.pow(1-a/.28,3));ellipseRing(p,x-10,205,r,r*.12,C.ice,k,2);ellipseRing(p,x-14,205,r*.8,r*.09,C.azure,k*.7,1);
}
function renderScene(p,t,o){
 const d=design(o.seed);drawGround(p,t,o.seed);
 // Dim speed silhouettes sit behind the performer and establish pressure before release.
 const pow=charge.sample(t);if(pow>.2){for(let i=0;i<9;i++){let a=rand(o.seed,i,'a',-Math.PI,Math.PI),h=hands(t),r=45+rand(o.seed,i,'r',0,25),k=pow*.25;p.line(h[0]+Math.cos(a)*r,h[1]+Math.sin(a)*r*.8,h[0]+Math.cos(a)*(r-8),h[1]+Math.sin(a)*(r-8)*.8,C.blue,k)}}
 particle.draw(p,d.dust,t,{draw:(p,s)=>material.smoke(p,s,{size:s.scale[0]*2,tint:C.rockL})});
 if(t>=3.5&&t<3.64){p.fade=.18;drawActor(p,3.32);p.fade=1;}drawActor(p,t);drawCharge(p,t,d);drawLaunch(p,t);beamShape(p,t);
 particle.draw(p,d.sparks,t,{draw:(p,s)=>material.streak(p,s,{tint:s.age01<.3?C.ice:C.azure,maxLength:8,glow:.08})});
 particle.draw(p,d.rocks,t,{draw:(p,s)=>{let r=s.scale[0],x=s.position[0],y=s.position[1],a=s.rotation,pts=Array.from({length:5},(_,i)=>{let an=i*TAU/5+a;return[x+Math.cos(an)*r,y+Math.sin(an)*r]});p.poly(pts,C.rockD,s.opacity);p.line(x-r,y-1,x+r*.5,y-r,C.rockL,s.opacity)}});
 drawAfterglow(p,t,o.seed);
}
export function observe(t,o){let d=design(o.seed);return {particles:[particle.observe(d.gather,t),particle.observe(d.sparks,t),particle.observe(d.rocks,t),particle.observe(d.dust,t)],contacts:[contact.observe(d.rocks)],trails:d.orbits.map(x=>trail.observe(x,t))}}

// The art direction intentionally sends the beam out of shot and uses full-bleed
// terrain. The lab bounds validator has no declared viewport/crop mode. Clip all
// public Painter raw writes to the authored rectangle, without changing in-frame
// pixels or touching the SDK/runtime. Restoring methods is essential on reuse.
export function draw(p,t,o){
 const names=['put','blendPx','add'],original=names.map(k=>p[k]);
 try{
  names.forEach((name,i)=>{p[name]=function(sx,sy,...args){
   const x=this.fromX(sx+.5,sy+.5),y=this.fromY(sx+.5,sy+.5);
   if(x>=0&&x<meta.size[0]&&y>=0&&y<meta.size[1])return original[i].call(this,sx,sy,...args);
  }});
  renderScene(p,t,o);
 }finally{names.forEach((name,i)=>{p[name]=original[i]})}
}

// Retained editable artwork; technical checks do not imply final art approval.
export const asset={status:"study",source:"experiments/vfx-lab/effects/kamehameha-storm.js",revision:"f207224ec08573ec71c8832c657ebd5ff1d998e9"};
