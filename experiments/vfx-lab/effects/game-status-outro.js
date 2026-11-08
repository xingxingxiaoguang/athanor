import {base,ring} from './_game-kit.js';
export const meta={...base,name:'Game cutout / status outro',desc:'A matching phase-zero status tail. Bake/select a different phase when removal is elsewhere in the loop.',tags:['game','status','tail','asset','解除'],duration:.8};export const authoring={ending:'clear'};export const events={remove:0,clear:.6};export function draw(p,t){ring(p,t,{out:true});}
