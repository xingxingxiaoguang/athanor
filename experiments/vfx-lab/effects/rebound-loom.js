// Reusable history, not a velocity streak: a bouncing bead and a reversible
// non-particle shuttle leave independently replaceable bands.
import { fit } from '../../../src/core/index.js';
import { particle, contact, trail, motion, curve, material } from '../../../src/authoring/index.js';
export const meta = { name: 'Rebound loom', desc: 'A returning enamel shuttle and a bouncing bead retain their actual paths; tails survive the heads and cool independently.', tags: ['history','trail','ribbon','bounce','reverse','历史','拖尾'], size: [200,160], origin: [100,128], duration: 3.2, loop: false,
  options: { seed: 7, glow: .02, palette: ['#172536','#305065','#688b91','#b5e1d1','#d89367','#fff0cf'] } };
export const events = { release: .15, reverse: 1.1, fade: 2.4, clear: 3.2 };
export const authoring = { ending: 'clear' };
let key, cached;
function design(o) {
  if (key === o.seed) return cached;
  const bead = particle.emitter({id:'bead',seed:o.seed,births:[{id:'bead/0',born:.15,position:[5,-58]}],initial:{life:2.2,velocity:[24,-32]},
    motion:{acceleration:[0,160],contact:contact.floor({id:'rail',y:-2,restitution:.63,tangentRetention:.88,settleSpeed:4})}});
  const returns = trail.emitter(bead,{id:'bead-wake',length:{pixels:55},death:{mode:'fade',seconds:.5}});
  const source = motion.source({position:[curve.scalar({points:[[0,-70],[.7,-25],[1.1,-25],[1.8,-65],[2.2,-45]]}),curve.scalar({points:[[0,-52],[.7,-78],[1.1,-78],[1.8,-34],[2.2,-48]]})]});
  const shuttle = trail.history({id:'shuttle',born:0,end:2.2,space:'effect',knots:[.7,1.1,1.8].map(time=>({time,kind:'corner'})),sample:t=>source.sample(t)},
    {length:{seconds:.65},death:{mode:'shrink'}});
  key=o.seed;return cached={bead,returns,source,shuttle};
}
export function draw(p,t,o) {
  if(t>=meta.duration)return;
  const d=design(o),C=fit(o.palette,8),fade=Math.min(1,t*8,(meta.duration-t)*4);
  p.line(-82,4,83,4,C[1],fade);p.rect(-79,5,3,7,C[0],fade);p.rect(77,5,3,7,C[0],fade);
  trail.draw(p,d.shuttle,t,{width:q=>.5+5*q.s,color:(q,a)=>Math.abs(a)<.3?C[6]:q.historyAge<.2?C[3]:C[1],alpha:fade});
  trail.draw(p,d.returns,t,{width:q=>.6+3.5*q.s,color:(q,a)=>Math.abs(a)<.25?C[7]:C[4],alpha:fade});
  particle.draw(p,d.bead,t,{draw:(p,s)=>material.ember(p,s,{colors:[C[7],C[5],C[4],C[1]],size:2,glow:o.glow})});
  if(t<2.2){const [x,y]=d.source.sample(t).position;p.poly([[x-5,y],[x,y-4],[x+5,y],[x,y+4]],C[2],fade);p.line(x-3,y,x+3,y,C[6],fade);}
}
export function observe(t,o){const d=design(o);return {trails:[trail.observe(d.shuttle,t),trail.observe(d.returns,t)],particles:[particle.observe(d.bead,t)],contacts:[contact.observe(d.bead)]};}
