// Frozen artwork source: experiments/vfx-lab/productions/2026-11-07-arsenal/art/_frost.js
// Target-bound frost art, using the existing surface/alpha-mask operators.
// The mature ice brightness mapping retains Sprite Fusion / Hugo Duprez / MIT
// attribution in ice/_lib. No standing actor or fixed vehicle mask is required.
import {texture,mask,surface,body,motion,field,material} from '../../../../authoring/index.js';
import {mix,clamp,tileNoise,luma,FROST,palette,phase} from '../9234fb6e7caffcc4ee85/_common.js';
import {vehicleTexture} from '../d905da7ef2e0897fd7d8/_vehicle.js';
export function buildFrost(stage,o){
 const image=o.targetTexture?texture.rgba(o.targetTexture):vehicleTexture(),seed=o.seed??53,raw=texture.mask(image,{space:'weapon-target'}),grid=mask.derive(raw,'frostable-skin',(x,y,i)=>!!raw.data[i]&&luma(texture.sample(image,[x,y]).color)>.135),subject=o.targetBody??body.create({id:'frost-target',source:motion.source({position:o.targetPosition??[0,0]})}),skin=surface.create({id:'cold-'+stage+'-skin',mask:grid,body:subject}),edge=mask.outline(grid),rank=field.rank({id:'cold-'+stage+'-order',mask:grid,score:(x,y)=>x+tileNoise(x*.15,y*.15,0,0,seed)*7});
 return {image,grid,skin,edge,rank,stage,seed,offset:o.targetTimeOffset??0,active:o.frostActive!==false,sampleTime:o.targetSampleTime};
}
export function frostState(m,t,o={}){const intro=m.stage.includes('intro'),outro=m.stage.includes('outro'),coverage=o.frostActive===false||t<0||outro&&t>=1.8?0:intro?clamp(t):1,alpha=outro?clamp((1.8-t)/.65):1,keep=mask.derive(m.grid,m.stage+'/visible',(x,y,i)=>!!m.grid.data[i]&&coverage>0&&m.rank.sample(x,y)<=coverage);
 return {keep,coverage,alpha,time:o.targetSampleTime??t+m.offset};
}
export function drawFrost(p,m,t,o){const s=frostState(m,t,o),C=palette(FROST);surface.draw(p,m.skin,s.time,{mask:s.keep,shade:q=>{const base=texture.sample(m.image,q.position),[x,y]=q.position,n=tileNoise(x*.52,y*.52,0,0,m.seed),rim=!!m.edge.data[q.index],snow=n>.46&&luma(base.color)>.22,fern=Math.sin(x*1.8+y*.9+n*3)>.98&&n>.25;let color=mix(base.color,material.iceColor(base.color,{colors:FROST}),.57*s.alpha);if(snow||fern)color=mix(color,C[6],.7*s.alpha);else if(rim)color=mix(color,C[5],.28*s.alpha);return{color,alpha:1};}});}

export function observeFrost(m,t,o){const s=frostState(m,t,o);return surface.observe(m.skin,s.time,{mask:s.keep});}
