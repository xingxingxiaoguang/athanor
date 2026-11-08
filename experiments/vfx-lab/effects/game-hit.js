import {base,hitParts,hitDraw} from './_game-kit.js';import {particle} from '../../../src/authoring/index.js';
export const meta={...base,name:'Game cutout / hit',desc:'Transparent reusable hit text and chips; game supplies spawn point and facts.',tags:['game','asset','hit','damage','伤害'],options:{seed:17,value:32,critical:false}};export const events={contact:0};export const authoring={ending:'clear'};
let c;function d(o){return c?.seed===o.seed&&c.value===o.value&&c.critical===o.critical?c:(c={seed:o.seed,value:o.value,critical:o.critical,...hitParts(o)});}
export function draw(p,t,o){hitDraw(p,t,o,d(o));}export function observe(t,o){const q=d(o);return {particles:[particle.observe(q.numbers,t),particle.observe(q.chips,t)]};}
