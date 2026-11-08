// Body material + orbit/particle status, freely composable presentation facts.
// Heat/flame: Sprite Fusion fire / MIT / Hugo Duprez; orbit uses mature projection.
import {status,body,surface,mask,motion,curve,orbit,particle,material} from '../../../src/authoring/index.js';
import {fit} from '../../../src/core/index.js';
export const meta={name:'Status relay / 状态生命周期',desc:'A moving mask has a warmed material and orbiting seals; explicit refresh preserves or restarts phase, removal stops emission while released embers survive.',tags:['status','buff','debuff','refresh','状态','刷新','解除'],size:[224,192],origin:[112,150],duration:5.4,loop:false,options:{seed:31,refreshPhase:'preserve',remove:3.1,palette:['#172a31','#3b6969','#8fba9d','#d99b52','#fff0ac','#ffffff']}};
export const authoring={ending:'clear'};
let cached;
function design(o){
 if(cached?.key===JSON.stringify(o))return cached;
 const heat=status.lifecycle({id:'warm-coat',target:'walker',fadeIn:.2,fadeOut:.45,events:[{id:'coat-on',time:.3,action:'apply',duration:2.4,strength:.8},{id:'coat-refresh',time:1.6,action:'refresh',duration:2.3,strength:1.2,phase:o.refreshPhase},{id:'coat-off',time:o.remove,action:'remove'}]});
 const seals=status.lifecycle({id:'seals',target:'walker',fadeIn:.2,fadeOut:.5,events:[{id:'seal-on',time:.65,action:'apply',duration:3},{id:'seal-refresh',time:1.9,action:'refresh',duration:2,phase:'restart'},{id:'seal-off',time:o.remove+.2,action:'remove'}]});
 const base=body.create({id:'walker',end:4.8,source:motion.source({position:[curve.scalar({input:'scene.seconds',points:[[0,-44],[2.5,16],[4.8,35]]}),-24],rotation:curve.scalar({input:'scene.seconds',points:[[0,-.06],[2,.08],[4.8,-.04]]})}),bounds:[-8,-19,16,35]});
 const subject=status.bind(base,[heat,seals]),m=mask.make({id:'coat',space:'coat-material',w:22,h:38,origin:[-11,-21],test:(x,y)=>Math.abs(x)<(y<-8?6:y<5?10:5)&&y<15});
 const skin=surface.create({id:'warm-skin',mask:m,body:subject}),ring=orbit.create({id:'seal-ring',body:subject,radius:18,aspect:.3,center:[0,-13]});
 const sparks=particle.emitter({id:'released-embers',seed:o.seed,births:status.births(heat,{id:'shed',rate:13,to:5.4,life:1.1}),transform:body.anchor(subject,{point:[0,-12]}),inheritVelocity:.8,initial:{velocity:({rand})=>[rand('vx',-16,16),rand('vy',-42,-20)],data:({birth})=>birth.statusEffect},motion:{acceleration:[0,45],drag:.8}});
 return cached={key:JSON.stringify(o),heat,seals,subject,skin,ring,sparks};
}
export function events(o){return {apply:.3,refresh:1.6,remove:o.remove,sealRemove:o.remove+.2};}
export function draw(p,t,o){
 const d=design(o),C=fit(o.palette,6),warm=status.sample(d.heat,t),seal=status.sample(d.seals,t),coat=warm.active??warm.tails.at(-1),ring=seal.active??seal.tails.at(-1);
 const drawRing=side=>{if(!ring)return;orbit.draw(p,d.ring,t,{side,color:C[3],alpha:ring.opacity*.7,width:1});for(let i=0;i<3;i++){const q=orbit.sample(d.ring,t,{angle:ring.phaseTime*4+i*Math.PI*2/3});if(q.near!==(side==='near'))continue;p.poly([[q.position[0],q.position[1]-3],[q.position[0]+2,q.position[1]],[q.position[0],q.position[1]+3],[q.position[0]-2,q.position[1]]],C[4],ring.opacity);}};
 drawRing('far');surface.draw(p,d.skin,t,{shade:s=>status.heat(Math.abs(s.position[0])>6?C[0]:s.position[1]<-8?C[2]:C[1],s,coat,{colors:o.palette,period:.6})});drawRing('near');
 if(coat)body.draw(p,d.subject,t,{draw:q=>status.flame(q,{position:[-7,-4],height:5*coat.opacity,width:1,lean:-1,time:coat.phaseTime,colors:o.palette,opacity:coat.opacity})});
 // The visual lifecycle may be gone; detached particles keep their own lives.
 particle.draw(p,d.sparks,t,{draw:(q,s)=>material.ember(q,s,{colors:[C[0],C[3],C[4],C[5]],size:1,glow:.15})});
}
export function observe(t,o){const d=design(o);return {bodies:[body.observe(d.subject,t)],particles:[particle.observe(d.sparks,t)]};}
