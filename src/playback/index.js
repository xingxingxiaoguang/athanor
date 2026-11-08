// Standalone engine-neutral baked asset consumer. No authoring SDK, effect
// module, workbench, canvas, DOM or filesystem dependency. Straight RGBA color
// and independent additive light follow src/core/fx.js:composite semantics.
export class PlaybackError extends Error {
 constructor(path,message,code='CONTRACT_MISMATCH'){super(`${path}: ${message}`);this.name='PlaybackError';this.code=code;this.path=path;this.recovery='Inspect the named pack/instance, restore matching exported files or correct the timeline input; sourceRun identifies the frozen artwork.';}
}
const bad=(p,m)=>{throw new PlaybackError(p,m);};
const number=(x,p)=>{if(!Number.isFinite(x))bad(p,'expected finite number');return x;};
const pair=(x,p)=>{if(!Array.isArray(x)||x.length!==2)bad(p,'expected [x,y]');x.forEach(v=>number(v,p));return x;};
// Decimal input arithmetic preserves authored cue boundaries (e.g. .7-.2=.5)
// without an epsilon snap grid or tying time to output FPS.
const decimal=x=>{const [mantissa,e='0']=String(x).toLowerCase().split('e'),parts=mantissa.split('.');return {n:BigInt(parts.join('')),scale:(parts[1]?.length??0)-Number(e)};};
function seconds(...values){const parts=values.map(decimal),scale=Math.max(...parts.map(p=>p.scale)),n=parts.reduce((sum,p)=>sum+p.n*10n**BigInt(scale-p.scale),0n);return number(Number(`${n}e${-scale}`),'playback.seconds');}
function multiply(a,b){const x=decimal(a),y=decimal(b);return number(Number(`${x.n*y.n}e${-x.scale-y.scale}`),'playback.seconds');}
function floorRatio(a,b){const x=decimal(a),y=decimal(b),scale=Math.max(x.scale,y.scale),n=x.n*10n**BigInt(scale-x.scale),d=y.n*10n**BigInt(scale-y.scale),q=n/d;return Number(q-(n<0n&&n%d!==0n?1n:0n));}
function pixels(image,path){if(!Number.isInteger(image?.width)||!Number.isInteger(image?.height)||image.width<1||image.height<1||image.data?.length!==image.width*image.height*4)bad(path,'expected decoded {width,height,data:RGBA bytes}');return image;}
export function createAsset({atlas,color,light}){
 pixels(color,'asset.color');pixels(light,'asset.light');const m=atlas?.meta?.athanor;
 if(!m?.sourceRun||!m.playback||m.playback.version!==1)bad('atlas.meta.athanor.playback','requires version 1 exact playback metadata');
 const duration=number(m.playback.duration,'asset.duration');if(duration<=0)bad('asset.duration','must be positive');pair(m.pivot,'asset.pivot');
 if(color.width!==light.width||color.height!==light.height||atlas.meta.size.w!==color.width||atlas.meta.size.h!==color.height)bad('asset.layers','atlas and layer dimensions differ');
 if(!Array.isArray(atlas.frames)||!atlas.frames.length)bad('asset.frames','expected nonempty frame table');
 let previous=-Infinity;atlas.frames.forEach((f,i)=>{const t=number(f.time,'asset.frames.time');if(t<0||t>duration||t<=previous)bad(`asset.frames[${i}].time`,'expected increasing exact seconds within duration');previous=t;const r=f.frame;if(!r||![r.x,r.y,r.w,r.h].every(Number.isInteger)||r.x<0||r.y<0||r.w<=0||r.h<=0||r.x+r.w>color.width||r.y+r.h>color.height||f.rotated||f.trimmed)bad(`asset.frames[${i}].frame`,'expected unrotated untrimmed in-bounds pixel rectangle');});
 if(atlas.frames[0].time!==0)bad('asset.frames[0].time','first frame must start at zero');
 const events=Object.entries(m.events??{}).map(([name,time])=>({name,time:number(time,`asset.events.${name}`)}));
 if(events.some(e=>e.time<0||e.time>duration))bad('asset.events','events must be inside authored duration');
 return {kind:'PlaybackAsset',id:m.sourceRun,sourceRun:m.sourceRun,sourceDigest:m.sourceDigest,revision:m.revision,assetDigest:m.assets?.digest??null,atlas,color,light,pivot:[...m.pivot],duration,loop:!!m.loop,ending:m.ending,events};
}
/** Caller-owned static scene art, without invented frozen-run provenance or
 * hand-authored atlas/timeline metadata. It remains alive until stopAt. */
export function imageAsset({id,color,light=null,pivot=[0,0]}){
 if(typeof id!=='string'||!id)bad('imageAsset.id','provide a nonempty artwork identity');pixels(color,'imageAsset.color');pair(pivot,'imageAsset.pivot');
 light??={width:color.width,height:color.height,data:new Uint8Array(color.data.length)};pixels(light,'imageAsset.light');if(light.width!==color.width||light.height!==color.height)bad('imageAsset.light','dimensions differ from color');
 const atlas={frames:[{time:0,frame:{x:0,y:0,w:color.width,h:color.height}}],meta:{size:{w:color.width,h:color.height},athanor:{kind:'caller-image',id,pivot:[...pivot]}}};
 return {kind:'PlaybackAsset',id,sourceRun:null,sourceDigest:null,revision:null,assetDigest:null,provenance:{kind:'caller-image',id},atlas,color,light,pivot:[...pivot],duration:null,loop:false,ending:'persistent',events:[]};
}
export function instance({id,asset,start=0,position=[0,0],scale=1,rotation=0,opacity=1,depth=0,rate=1,stopAt=null,hold=false}={}){
 if(typeof id!=='string'||!id)bad('instance.id','provide stable nonempty instance identity');if(asset?.kind!=='PlaybackAsset')bad('instance.asset','use createAsset/loadPack');number(start,'instance.start');number(rate,'instance.rate');if(rate<=0)bad('instance.rate','must be positive');
 if(stopAt!==null&&(number(stopAt,'instance.stopAt')<start))bad('instance.stopAt','must be >= start');if(typeof hold!=='boolean')bad('instance.hold','expected boolean');
 return {kind:'PlaybackInstance',id,asset,start,position,scale,rotation,opacity,depth,rate,stopAt,hold};
}
const channel=(v,t)=>typeof v==='function'?v(t):v;
export function sample(item,time){
 if(item?.kind!=='PlaybackInstance')bad('instance','use instance()');number(time,'sample.time');const a=item.asset,age=multiply(seconds(time,-item.start),item.rate),expired=item.stopAt!==null&&time>=item.stopAt||(a.duration!==null&&!a.loop&&!item.hold&&age>=a.duration);
 const status=time<item.start?'pending':expired?'expired':'alive';const cycle=a.loop&&age>=0?floorRatio(age,a.duration):0,local=a.duration===null?Math.max(0,age):a.loop?Math.max(0,seconds(age,-multiply(cycle,a.duration))):Math.max(0,Math.min(a.duration,age));
 let lo=0,hi=a.atlas.frames.length;while(lo+1<hi){const mid=(lo+hi)>>1;if(a.atlas.frames[mid].time<=local)lo=mid;else hi=mid;}
 const position=pair(channel(item.position,time),'instance.position'),rawScale=channel(item.scale,time),scale=typeof rawScale==='number'?[rawScale,rawScale]:pair(rawScale,'instance.scale');scale.forEach(x=>number(x,'instance.scale'));
 const rotation=number(channel(item.rotation,time),'instance.rotation'),opacity=number(channel(item.opacity,time),'instance.opacity'),depth=number(channel(item.depth,time),'instance.depth');if(opacity<0||opacity>1)bad('instance.opacity','must be in [0,1]');
 return {id:item.id,assetId:a.id,sourceRun:a.sourceRun,status,time,age,cycle,localTime:local,frameIndex:lo,rect:{...a.atlas.frames[lo].frame},pivot:[...a.pivot],position:[...position],scale:[...scale],rotation,opacity,depth,asset:a};
}
/** Pure half-open traversal (from,to]. Pass from < start for initial zero cue.
 * Partitionable and seek-safe; application decides whether to dispatch. */
export function eventsBetween(item,from,to){
 if(item?.kind!=='PlaybackInstance')bad('instance','use instance()');number(from,'events.from');number(to,'events.to');if(to<from)bad('events.interval','expected to >= from');
 const a=item.asset,out=[],localLo=multiply(seconds(from,-item.start),item.rate),localHi=multiply(seconds(to,-item.start),item.rate);
 for(const e of a.events){const first=a.loop?Math.max(0,floorRatio(seconds(localLo,-e.time),a.duration)+1):0,last=a.loop?floorRatio(seconds(localHi,-e.time),a.duration):0;
 if(last-first>10000)bad('events.interval','split event queries spanning more than 10000 cycles');
 for(let cycle=first;cycle<=last;cycle++){const time=seconds(item.start,seconds(e.time,multiply(cycle,a.duration))/item.rate);if(time<=from||time>to||time<item.start||(item.stopAt!==null&&time>=item.stopAt))continue;
 out.push({id:JSON.stringify([item.id,e.name,cycle]),instance:item.id,sourceRun:a.sourceRun,name:e.name,cycle,time,localTime:e.time});}}
 return out.sort((a,b)=>a.time-b.time||(a.id<b.id?-1:a.id>b.id?1:0));
}
export function scene(items,time){if(!Array.isArray(items))bad('scene','expected instance array');const ids=new Set();return items.map(i=>{if(ids.has(i.id))bad('scene.id',`duplicate '${i.id}'`);ids.add(i.id);return sample(i,time);}).sort((a,b)=>a.depth-b.depth||(a.id<b.id?-1:a.id>b.id?1:0));}
/** Pixel-center inverse sampling with arbitrary pivot/flip/rotation. Color is
 * depth ordered, light stays additive above the complete scene. This portable
 * baseline is not an occlusion/light-transport engine. */
export function compose({width,height,background=null},states){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>16_000_000)bad('compose.size','positive integer dimensions, <=16M pixels');
 if(background!==null){pair(background?.slice?.(0,2),'compose.background');if(background.length!==4||!background.every(x=>Number.isInteger(x)&&x>=0&&x<=255))bad('compose.background','expected RGBA bytes or null');}
 const color=new Uint8Array(width*height*4),light=new Uint8Array(width*height*4);if(background)for(let i=0;i<color.length;i+=4)color.set(background,i);
 for(const s of [...states].sort((a,b)=>a.depth-b.depth||(a.id<b.id?-1:a.id>b.id?1:0))){if(s.status!=='alive'||!s.opacity||s.scale.some(x=>x===0))continue;
 const [sx,sy]=s.scale,[px,py]=s.pivot,[tx,ty]=s.position,c=Math.cos(s.rotation),sn=Math.sin(s.rotation),r=s.rect;
 const corners=[[0,0],[r.w,0],[r.w,r.h],[0,r.h]].map(([u,v])=>{const x=(u-px)*sx,y=(v-py)*sy;return [tx+x*c-y*sn,ty+x*sn+y*c];});
 const minX=Math.max(0,Math.floor(Math.min(...corners.map(q=>q[0])))),maxX=Math.min(width,Math.ceil(Math.max(...corners.map(q=>q[0])))),minY=Math.max(0,Math.floor(Math.min(...corners.map(q=>q[1])))),maxY=Math.min(height,Math.ceil(Math.max(...corners.map(q=>q[1]))));
 for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++){const dx=x+.5-tx,dy=y+.5-ty,u=Math.floor((dx*c+dy*sn)/sx+px+1e-10),v=Math.floor((-dx*sn+dy*c)/sy+py+1e-10);if(u<0||v<0||u>=r.w||v>=r.h)continue;
 const src=((r.y+v)*s.asset.color.width+r.x+u)*4,dst=(y*width+x)*4,C=s.asset.color.data,L=s.asset.light.data,sa=C[src+3]/255*s.opacity,da=color[dst+3]/255,oa=sa+da*(1-sa);
 if(sa&&oa){for(let k=0;k<3;k++)color[dst+k]=Math.floor((C[src+k]*sa+color[dst+k]*da*(1-sa))/oa);color[dst+3]=Math.floor(oa*255);}
 for(let k=0;k<3;k++)light[dst+k]=Math.min(255,light[dst+k]+L[src+k]*s.opacity);if(light[dst]||light[dst+1]||light[dst+2])light[dst+3]=255;
 }}
 const combined=new Uint8Array(color.length);for(let i=0;i<color.length;i+=4){const a=color[i+3]/255,na=Math.max(a,light[i]/255,light[i+1]/255,light[i+2]/255);if(na){for(let k=0;k<3;k++)combined[i+k]=Math.min(255,(color[i+k]*a+light[i+k])/na);combined[i+3]=na*255;}}
 return {width,height,color,light,combined};
}
