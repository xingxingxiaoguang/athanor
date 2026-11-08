import {base,skillParts,skillDraw,flow} from './_game-kit.js';import {particle,skill} from '../../../src/authoring/index.js';
export const meta={...base,name:'Game cutout / skill',desc:'Transparent charge and slash, with actual cancellable emission and surviving tails.',tags:['game','skill','asset','技能'],options:{seed:17,cancelAt:null}};export function events(o){const time=skill.at(flow(o),'slash');return time===null?{cancel:o.cancelAt}:{release:time};}export const authoring={ending:'clear'};
let c;function d(o){return c?.seed===o.seed&&c.cancelAt===o.cancelAt?c:(c={seed:o.seed,cancelAt:o.cancelAt,...skillParts(o)});}
export function draw(p,t,o){skillDraw(p,t,o,d(o));}export function observe(t,o){return {particles:[particle.observe(d(o).motes,t)]};}
