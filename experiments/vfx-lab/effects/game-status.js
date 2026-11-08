import {base,ring} from './_game-kit.js';
export const meta={...base,name:'Game cutout / status loop',desc:'Two-second seamless status ring cutout; follow the game target, stop explicitly and pair matching outro.',tags:['game','status','loop','asset','状态'],duration:2,loop:true};export const authoring={ending:'loop'};export const events={phaseZero:0};export function draw(p,t){ring(p,t);}
