// Decimal input clock arithmetic, as used by skill cues and standalone player.
// No epsilon snapping or output-FPS rounding grid.
import {finite} from './contract.js';
const decimal=x=>{finite(x,'seconds');const [m,e='0']=String(x).toLowerCase().split('e'),p=m.split('.');return {n:BigInt(p.join('')),scale:(p[1]?.length??0)-Number(e)};};
export function seconds(...values){const parts=values.map(decimal),scale=Math.max(...parts.map(p=>p.scale)),n=parts.reduce((sum,p)=>sum+p.n*10n**BigInt(scale-p.scale),0n);return finite(Number(`${n}e${-scale}`),'seconds');}
export function product(a,b){const x=decimal(a),y=decimal(b);return finite(Number(`${x.n*y.n}e${-x.scale-y.scale}`),'seconds');}
export function period(time,duration){const x=decimal(time),y=decimal(duration),s=Math.max(x.scale,y.scale),n=x.n*10n**BigInt(s-x.scale),d=y.n*10n**BigInt(s-y.scale);let q=n/d;if(n<0n&&n%d)q--;return {cycle:Number(q),local:seconds(time,-product(Number(q),duration))};}
