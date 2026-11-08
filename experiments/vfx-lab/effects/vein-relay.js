// Small composable example, not a production preset. Original branching walk:
// Sprite Fusion ice, MIT / Copyright (c) 2026 Hugo Duprez (core/branching.js).
import { fit } from '../../../src/core/index.js';
import { propagation, curve, particle, material } from '../../../src/authoring/index.js';
export const meta = { name: 'Vein relay', desc: 'A copper root network wakes spaced enamel buds in inherited distance order, then retires from its tips.', tags: ['branch','arrival','secondary','分叉','传播'], size: [240,160], origin: [120,85], duration: 3.6, loop: false,
  options: { seed: 7, palette: ['#172735','#344e59','#6d9b98','#d4eee0','#d18b54','#fff0b9'] } };
export const events = { release: .25, spread: 1.4, retreat: 2.65, clear: 3.6 };
export const authoring = { ending: 'clear' };
let cachedSeed, cached;
function design(o) {
  if (cachedSeed === o.seed) return cached;
  const veins = propagation.fractures({id:'veins',seed:o.seed,arms:6,steps:22,stepPx:[3,5],fork:.1,inside:(x,z)=>x*x/8100+z*z/4900<1,project:([x,z])=>[x,z*.55]});
  const front=curve.scalar({input:'scene.seconds',outputUnit:'pixels',points:[[.25,0],[1.4,veins.maxDistancePx]],interpolation:'smooth'});
  const tail=curve.scalar({input:'scene.seconds',outputUnit:'pixels',points:[[2.65,veins.maxDistancePx],[3.3,0]],interpolation:'smooth'});
  const sites=propagation.sites(veins,{spacingPx:6,minDistancePx:15,minGapPx:14,limit:14});
  const grow=propagation.births({id:'grow',sites,front,delay:.03});
  const retire=propagation.births({id:'retire',sites,front:tail,direction:'inward'});
  const ends=new Map(retire.map(b=>[b.site.id,b.born]));
  const buds=particle.emitter({id:'buds',seed:o.seed,births:grow,initial:({birth,rand})=>({life:ends.get(birth.site.id)-birth.born+.12,velocity:[0,0],data:{h:rand('height',5,13),end:ends.get(birth.site.id),distance:birth.site.distancePx}})});
  cachedSeed=o.seed;return cached={veins,front,tail,buds};
}
export function draw(p,t,o) {
  if(t<.25||t>=3.6)return;
  const d=design(o),C=fit(o.palette,6),fade=Math.min(1,(3.6-t)*5),reach=Math.min(d.front.sample(t),d.tail.sample(t));
  for(const s of propagation.segments(d.veins,{toPx:reach})) {
    p.line(s.a[0],s.a[1]+1,s.b[0],s.b[1]+1,C[0],fade);
    p.line(...s.a,...s.b,C[4],fade*.8);
  }
  particle.draw(p,d.buds,t,{draw:(p,s)=>{
    const [x,y]=s.position,up=Math.min(1,s.age*9),out=Math.max(0,Math.min(1,(s.data.end+.12-t)/.12)),h=s.data.h*up*out;
    p.poly([[x-3,y],[x-2,y-h],[x,y-h-2],[x+2,y-h],[x+3,y]],C[2],fade);
    p.line(x,y-h-1,x,y-1,C[3],fade);material.ember(p,{...s,position:[x,y-h]},{colors:[C[5],C[3],C[2],C[1]],size:1,glow:.02});
  }});
}
export function observe(t,o){return {particles:[particle.observe(design(o).buds,t)]};}
