// Shared body/plane example, not a forced production preset.
// Ring projection: Sprite Fusion energy orb / MIT / (c) 2026 Hugo Duprez.
import {fit} from '../../../src/core/index.js';
import {body,orbit,motion,curve,particle,schedule,material} from '../../../src/authoring/index.js';
export const meta={name:'Orrery relay',desc:'A moving enamel seed expands together with its tilted ring; real attachment velocity carries detached chips.',tags:['body','orbit','anchor','主体','轨环'],size:[200,160],origin:[100,112],duration:3.6,loop:false,options:{seed:7,palette:['#142031','#314c60','#548489','#a5d7bf','#d89360','#fff0c1']}};
export const events={wake:.3,expand:1.2,peak:1.7,retreat:2.8,clear:3.6};
export const authoring={ending:'clear'};
let cached;
const channel=points=>curve.scalar({points,input:'scene.seconds',interpolation:'smooth'});
function design(o){
  if(cached?.seed===o.seed)return cached;
  const shape=body.create({id:'seed',source:motion.source({position:[channel([[0,-22],[1.7,18],[3.6,-6]]),-36],rotation:channel([[0,-.25],[1.7,.35],[3.6,-.1]])}),
    scale:channel([[0,.1],[.3,.3],[1.2,1],[1.7,1.3],[2.8,.9],[3.6,0]]),opacity:channel([[0,0],[.3,1],[3.2,1],[3.6,0]]),bounds:[-14,-14,28,28],anchors:{vent:[12,-2]},end:3.6,data:t=>({stage:t<1.2?'waking':t<2.8?'sustained':'retiring'})});
  const ring=orbit.create({id:'rim',body:shape,radius:27,aspect:.35,roll:channel([[0,.4],[3.6,-.3]])}),phase=curve.scalar({input:'scene.seconds',points:[[0,0],[3.6,Math.PI*4]]});
  const bead=orbit.source(ring,{angle:phase}),vent=body.anchor(shape,{name:'vent'});
  const chips=particle.emitter({id:'ring-chips',seed:o.seed,births:schedule.rate({id:'chips',start:.5,end:2.6,rate:6}),transform:bead,inheritVelocity:.55,initial:{life:.65,velocity:[0,-8]},motion:{acceleration:[0,15]}});
  const fumes=particle.emitter({id:'vent-chips',seed:o.seed,births:schedule.rate({id:'fumes',start:.8,end:2.8,rate:4}),transform:vent,inheritVelocity:1,initial:{life:.6,velocity:[8,-10]}});
  return cached={seed:o.seed,shape,ring,phase,bead,vent,chips,fumes};
}
export function draw(p,t,o){
  if(t>=3.6)return;const d=design(o),C=fit(o.palette,6),style={width:q=>q.near?1.8:1,color:q=>q.near?C[3]:C[2],alpha:.8,light:.08};
  orbit.draw(p,d.ring,t,{...style,side:'far'});
  body.draw(p,d.shape,t,{draw:(q)=>{q.poly([[-12,-2],[-6,-12],[6,-10],[13,0],[7,11],[-6,10]],C[0]);q.poly([[-10,-2],[-5,-10],[4,-8],[0,8],[-5,8]],C[2]);q.poly([[4,-8],[11,0],[5,9],[0,8]],C[1]);q.circle(0,-1,4,C[4]);q.circle(0,-2,2,C[5]);q.glow(0,-1,13,C[4],.12);}});
  orbit.draw(p,d.ring,t,{...style,side:'near'});
  const bead=orbit.sample(d.ring,t,{angle:d.phase});if(bead.status==='alive'){p.circle(...bead.position,1.2,C[5],bead.opacity);p.glow(...bead.position,5,C[4],.15*bead.opacity);}
  for(const emitter of [d.chips,d.fumes])particle.draw(p,emitter,t,{draw:(p,s)=>material.ember(p,s,{colors:[C[5],C[4],C[2],C[0]],size:1,glow:.03})});
}
export function observe(t,o){const d=design(o);return {bodies:[body.observe(d.shape,t)],sources:[motion.observeSource(d.bead,t,{id:'ring-bead'}),motion.observeSource(d.vent,t,{id:'vent'})],particles:[particle.observe(d.chips,t),particle.observe(d.fumes,t)]};}
