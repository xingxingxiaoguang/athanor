// Freely replaceable masks on actual held IK bones. Surface scan/ice color
// reuse the library; Sprite Fusion ice / MIT / (c) 2026 Hugo Duprez.
import {fit,mix} from '../../../src/core/index.js';
import {surface,mask,action,motion,field,curve,propagation,image,particle,random} from '../../../src/authoring/index.js';
export const meta={name:'Frost release',desc:'A moving plated figure frosts over in material coordinates, cracks and sheds from its current pose.',tags:['surface','frost','bone','fracture','身体表面'],size:[224,192],origin:[104,153],duration:4.8,loop:false,options:{seed:19,facingLeft:false,palette:['#162337','#34536c','#72a6a8','#b9e0df','#c4efff','#ffffff']}};
export const events={frost:.4,crack:1.45,break:2.6,clear:4.8};
export const authoring={ending:'clear'};
let cached;
function design(o){
  if(cached?.seed===o.seed&&cached.flip===o.facingLeft)return cached;
  const hero=action.create({id:'frost-walker',clock:action.clock({to:4.6,holds:[{at:1.8,duration:.12}]}),source:motion.source({position:[-20,0]}),scale:1.8,flipX:!!o.facingLeft,end:4.8,
    poses:[[0,{x:-12,fx:3,fy:-23,bx:5,by:-24}],[1.3,{x:0,fx:13,fy:-28,bx:2,by:-24},'out'],[2.3,{x:12,fx:15,fy:-33,bx:-7,by:-25,lean:-2},'line'],[3.4,{x:6,fx:8,fy:-27,crouch:3}],[4.6,{x:6}]]});
  const specs=[['far-thigh','hipF','kneeF',6],['far-shin','kneeF','ankleF',5],['far-upper','shoulderF','elbowF',5],['far-fore','elbowF','handF',4],['torso','pelvis','neck',9],['head','neck','crown',7],['near-thigh','hipN','kneeN',6],['near-shin','kneeN','ankleN',5],['near-upper','shoulderN','elbowN',5],['near-fore','elbowN','handN',4]];
  const parts=specs.map(([id,from,to,h],i)=>{
    const L=id==='torso'?17:id==='head'?8:12,m=mask.make({id,space:id,w:L,h,origin:[0,-h/2],test:(x,y)=>x>.3&&x<L-.3&&Math.abs(y)<h/2-.2});
    const skin=surface.bone({id,mask:m,action:hero,from,to,length:L});
    const n=propagation.network({id:`${id}/veins`,space:id,branches:[{id:'main',points:[[0,0],[L*.45,-.5],[L,0]]},{id:'fork',parentId:'main',attachVertex:1,points:[[L*.45,-.5],[L*.65,h*.45]]}]});
    const crack=surface.crackField({id:`${id}/break`,surface:skin,network:n,front:curve.scalar({input:'scene.seconds',outputUnit:'pixels',points:[[1.45+i*.025,0],[2.3+i*.025,n.maxDistancePx]]}),spreadPxPerSecond:10,delay:.65});
    const frost=field.arrival({id:`${id}/frost`,rank:field.rank({id:`${id}/rank`,mask:m,score:(x,y,index)=>x/L+random.unit({seed:o.seed,layer:id,id:index,channel:'frost'})*.3}),start:.4+i*.025,end:1.4+i*.025});
    const chips=particle.emitter({id:`${id}/chips`,seed:o.seed,births:surface.births({id:`${id}/chips`,surface:skin,arrival:crack.removeAt,density:.15,seed:o.seed}),initial:{life:[.55,.95],velocity:({birth,rand})=>[birth.normal[0]*rand('push',12,30)+rand('vx',-10,10),birth.normal[1]*rand('push-y',12,25)-rand('lift',14,30)],velocityOffset:surface.inheritVelocity(.65)},motion:{acceleration:[0,95],drag:.7}});
    return {id,skin,frost,crack,chips,index:i};
  });
  return cached={seed:o.seed,flip:o.facingLeft,hero,parts};
}
const cut=(part,t)=>image.dissolve({mask:part.skin.mask,field:part.crack.removeAt,threshold:t,edgeBand:.09});
export function draw(p,t,o){
  if(t>=4.8)return;const d=design(o),C=fit(o.palette,6);
  for(const part of d.parts){const state=cut(part,t);surface.draw(p,part.skin,t,{mask:state.keepMask,shade:s=>{
    const [x,y]=s.position,coat=Math.max(0,Math.min(1,(t-part.frost.sample(x,y))/.25)),line=part.crack.distance.sample(x,y)<.65&&t>=part.crack.crackAt.sample(x,y),edge=state.edgeMask.data[s.index];
    const base=Math.abs(y)>part.skin.mask.h/2-1.3?C[0]:part.index<4?C[1]:C[2];
    return {color:line||edge?C[5]:mix(base,C[4],coat*.8),light:line?C[4]:C[0],lightStrength:line?.1:0};
  }});}
  for(const part of d.parts)particle.draw(p,part.chips,t,{draw:(q,s)=>{const c=C[s.age01<.35?5:3];q.poly([[s.position[0]-1,s.position[1]],[s.position[0],s.position[1]-2],[s.position[0]+1,s.position[1]+1]],c,1-s.age01);}});
}
export function observe(t,o){const d=design(o);return {bodies:d.parts.map(part=>surface.observe(part.skin,t,{mask:cut(part,t).keepMask})),particles:d.parts.map(part=>particle.observe(part.chips,t))};}
