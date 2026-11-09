// Artwork source: src/fx/weapons/_sources/d905da7ef2e0897fd7d8/_vehicle.js
// Original top-down reference vehicle. Shared paint/alpha for the preview
// and target-bound frost; game callers may supply any Texture and Body.
import {hex,mix,INK,WHITE} from './_common-85a33fd1.js';
import {createFrame,painterFor} from '../../../core/index.js';
import {texture} from '../../../authoring/index.js';
const METAL=['#121e22','#2a3b3d','#425b56','#617966','#9aab82','#c6c9a1'].map(hex);
export function drawVehicle(p,{flash=0,shadow=true}={}){const C=METAL.map(c=>mix(c,flash>.4?WHITE:hex('#9c8f6a'),Math.min(.65,flash*.65)));if(shadow)p.ellipse(2,3,25,19,INK,.5);
 p.rect(-21,-18,41,36,C[0]);p.rect(-19,-17,38,8,C[1]);p.rect(-19,10,38,7,C[1]);for(let x=-17;x<18;x+=6){p.rect(x,-16,3,5,C[2]);p.rect(x,11,3,5,C[2]);}p.poly([[-18,-9],[-12,-14],[12,-14],[20,-8],[20,9],[12,14],[-12,14],[-18,9]],C[2]);p.poly([[-14,-8],[-10,-11],[10,-11],[16,-6],[16,7],[10,11],[-11,10],[-14,7]],C[3]);p.line(-10,-10,11,-10,C[4]);p.circle(-1,0,9,C[1]);p.circle(-2,-1,7,C[3]);p.circle(-3,-2,3,C[4]);p.rect(-5,-1,18,4,C[2]);p.rect(11,-2,12,5,C[0]);p.line(12,-1,22,-1,C[3]);for(const x of [-12,11])for(const y of [-6,6])p.px(x,y,C[5]);
}
let image;
export function vehicleTexture(){if(image)return image;const f=createFrame(64,48);drawVehicle(painterFor(f).place(32,24),{shadow:false});const bytes=new Uint8Array(64*48*4);f.color.forEach((c,i)=>bytes.set([c&255,(c>>>8)&255,(c>>>16)&255,c>>>24],i*4));return image=texture.rgba({id:'reference-vehicle',w:64,h:48,pivot:[32,24],data:bytes});}
