// Original external PNG example. Motion/body/combat stay ordinary code;
// PNG data is supplied by the lab and frozen as original bytes per run.
import {texture,body,surface,motion,curve,combat,particle} from '../../../src/authoring/index.js';
export const meta={name:'Asset relay / 外部像素素材',desc:'A local PNG character moves and flashes through its real alpha mask; a PNG atlas supplies lifetime spark frames. Both originals freeze with the run.',tags:['asset','png','atlas','素材','导入','外部'],size:[192,160],origin:[96,132],duration:3.2,loop:false,options:{seed:21,sparkScale:1}};
export const assets={traveler:{file:'./assets/asset-relay/traveler.png',pivot:[16,40]},sparkFrames:{file:'./assets/asset-relay/spark-atlas.png',frameSize:[8,8],pivots:Array.from({length:8},()=>[4,4])}};
export const events={hit:1.2};export const authoring={ending:'clear'};
let cached;
function design(o){
 if(cached?.assets===o.assets&&cached.seed===o.seed&&cached.scale===o.sparkScale)return cached;
 const image=o.assets.traveler,subject=body.create({id:'traveler',source:motion.source({position:[curve.scalar({input:'scene.seconds',points:[[0,-35],[2.8,28]]}),0]}),end:2.8,bounds:[-16,-40,32,40],anchors:{chest:[0,-18]}});
 const skin=surface.create({id:'traveler-skin',mask:texture.mask(image,{space:'traveler-material'}),body:subject});
 const hits=combat.hits({id:'delivery',events:[{id:'impact',time:1.2,target:'traveler',value:35,direction:[1,-.2]}],resolve:e=>body.anchor(subject,{name:'chest'}).sample(e.time)});
 const sequence=texture.sequence({id:'spark-sequence',frames:o.assets.sparkFrames});
 const sparks=particle.emitter({id:'asset-sparks',seed:o.seed,births:combat.births(hits,{count:12,life:.9}),initial:{velocity:({rand})=>[rand('vx',-35,48),rand('vy',-56,-12)],scale:o.sparkScale},motion:{acceleration:[0,110],drag:.5},material:{texture:sequence,opacity:s=>1-s.age01,blend:'soft'}});
 return cached={assets:o.assets,seed:o.seed,scale:o.sparkScale,image,subject,skin,hits,sparks};
}
export function draw(p,t,o){const d=design(o),hits=combat.sample(d.hits,t,{target:'traveler'});surface.draw(p,d.skin,t,{shade:pixel=>{const paint=texture.sample(d.image,pixel.position);return {...paint,color:combat.tint(paint.color,hits,{ramp:['#204252','#65afb0','#d9f6dc']})};}});particle.draw(p,d.sparks,t);}
export function observe(t,o){const d=design(o);return {bodies:[surface.observe(d.skin,t)],particles:[particle.observe(d.sparks,t)]};}
