// Frozen artwork source: experiments/vfx-lab/productions/2026-11-07-arsenal/art/_blast-reuse.js
// Direct composition of the existing stock plasma explosion. Its original
// Sprite Fusion / Hugo Duprez / MIT attribution stays in the imported module.
// This artwork adapter samples that simulation on its existing 120 Hz clock;
// it is not another implementation of its shell, rings, arcs or release.
import {create,meta} from '../../../explosions/plasma-explosion.js';
export function plasmaRelease(seed){let state,tick=-1;
 return {draw(p,time){if(time>=.42)return;const target=Math.round(time*1.5*120);if(!state||target<tick){state=create({...meta.options,seed,palette:['#101b35','#254664','#3f7eaa','#70bdd8','#a9e7eb','#e0fff4','#ffffff'],accent:['#14213c','#2d466b','#4d81a7','#a7d5e2','#effaff']});tick=0;}while(tick<target){state.update(1/120);tick++;}const q=Object.create(p);q.fade=p.fade*Math.min(1,Math.max(0,(.42-time)/.12));state.drawBack?.(q);state.draw(q);},sampleTime(time){return time<.42?Math.round(time*1.5*120)/120:null;}};
}
