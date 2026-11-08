// Material-space surfaces reuse status/_lib.shape's actual silhouette scan,
// body/Painter affine sampling, action's held IK and image first-arrival births.
// Ice crack behavior derives from the existing Sprite Fusion ice adaptation:
// MIT, (c) 2026 Hugo Duprez. Held timing: Hollow Crown / MIT / rehan-remade.
import { shape } from '../fx/status/_lib.js';
import * as body from './body.js';
import * as action from './action.js';
import * as image from './image.js';
import * as propagation from './propagation.js';
import { transformPoint, transformVector } from './affine.js';
import { identity, finite, positive, point, count, compatible, color, alpha, fail } from './contract.js';

const requireSurface = s => { if (s?.kind !== 'Surface') fail('surface', 'expected surface.create/bone()'); return s; };
const compose = (a, b) => [...transformVector(a,b.slice(0,2)),...transformVector(a,b.slice(2,4)),...transformPoint(a,b.slice(4,6))];
const multiplyDerivative = (a,b) => [...transformVector(a,b.slice(0,2)),...transformVector(a,b.slice(2,4)),...transformPoint(a,b.slice(4,6))];
function normalAt(m, normal) {
  if (!Math.hypot(...normal)) return [0,0];
  const det=m[0]*m[3]-m[1]*m[2]; if (!det) fail('surface.normal','singular transform has no inverse-transpose normal');
  const v=[(m[3]*normal[0]-m[1]*normal[1])/det,(-m[2]*normal[0]+m[0]*normal[1])/det],n=Math.hypot(...v);
  return v.map(x=>finite(x/n,'surface.normal'));
}
function bounds(m,rect) {
  const [x,y,w,h]=rect,corners=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(p=>transformPoint(m,p));
  const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]),x0=Math.min(...xs),y0=Math.min(...ys);
  return {corners,rect:[x0,y0,Math.max(...xs)-x0,Math.max(...ys)-y0]};
}
function selected(s,mask=s.mask) {
  if (mask?.kind!=='Mask') fail('surface.mask','expected a Mask'); compatible(s.mask,mask,'surface.mask');
  for(let i=0;i<mask.data.length;i++)if(mask.data[i]&&!s.mask.data[i])fail('surface.mask','selected mask adds pixels outside the material surface');
  return mask;
}

/** A static material grid, bound to a real program body; not a screen mask. */
export function create({id,mask,body:parent}={}) {
  identity(id,'surface.id');
  if(mask?.kind!=='Mask'||!mask.data||mask.data.length!==mask.w*mask.h)fail('surface.mask','expected a declared binary Mask');
  identity(mask.space,'surface.mask.space');point(mask.origin,'surface.mask.origin');count(mask.w,'surface.mask.w',480);count(mask.h,'surface.mask.h',480);
  if(!mask.w||!mask.h||[...mask.data].some(v=>v!==0&&v!==1))fail('surface.mask','expected nonempty dimensions and binary 0/1 data');
  if(mask.space==='effect')fail('surface.mask.space','material coordinates need an explicit local space label, e.g. skin; body maps them to effect space');
  if(parent?.kind!=='Body'||parent.space!=='effect'||typeof parent.sample!=='function')fail('surface.body','expected an effect-space Body; use body.create or an action body');
  const S=shape({mask}),rect=[...mask.origin,mask.w,mask.h];count(S.body.length,'surface.pixels',16384);
  const normals=new Map(S.body.map(([x,y])=>{const v=[+S.on(x-1,y)-+S.on(x+1,y),+S.on(x,y-1)-+S.on(x,y+1)],n=Math.hypot(...v);return [y*mask.w+x,n?v.map(q=>q/n):[0,0]];}));
  const subject={kind:'Body',id:`surface/${id}`,space:'effect',sample(t,options){
    const q=body.sample(parent,t,options);
    return {...q,id:`surface/${id}`,localBounds:[...rect],bounds:bounds(q.matrix,rect),anchors:{origin:{position:transformPoint(q.matrix,[0,0]),velocity:transformPoint(q.matrixVelocity,[0,0])}},
      data:{surface:{id,materialSpace:mask.space,grid:{w:mask.w,h:mask.h,origin:[...mask.origin],revision:mask.revision},pixels:S.body.length,remaining:S.body.length,parentBody:q.id},parent:q.data}};
  }};
  return {kind:'Surface',id,space:mask.space,mask,body:subject,_scan:S,_normals:normals};
}

/** A replaceable local mask on a solved 2D bone frame. Local x spans `length`
 * material pixels from from->to; local y is perpendicular. No skinned mesh. */
export function bone({id,mask,action:actor,from,to,length,widthScale=1}={}) {
  if(actor?.kind!=='Action')fail('surface.bone.action','expected action.create()');
  positive(length,'surface.bone.length');positive(widthScale,'surface.bone.widthScale');
  const first=action.sample(actor,0);if(!Object.hasOwn(first.data.joints,from)||!Object.hasOwn(first.data.joints,to)||from===to)fail('surface.bone.joints','provide two distinct names from action joint definitions');
  const parent={kind:'Body',space:'effect',sample(t,options){
    const q=action.sample(actor,t,options),a=q.data.joints[from],b=q.data.joints[to],dx=b[0]-a[0],dy=b[1]-a[1],n=Math.hypot(dx,dy);
    const u=n?dx/n:1,v=n?dy/n:0,local=[dx/length,dy/length,-v*widthScale,u*widthScale,a[0],a[1]],matrix=compose(q.matrix,local),matrixVelocity=multiplyDerivative(q.matrixVelocity,local),f=q.flipX?-1:1;
    return {...q,id:`bone/${id}`,matrix,matrixVelocity,position:matrix.slice(4),velocity:matrixVelocity.slice(4),rotation:Math.atan2(matrix[1]*f,matrix[0]*f),scale:[Math.hypot(matrix[0],matrix[1]),Math.hypot(matrix[2],matrix[3])],scaleVelocity:[0,0],anchors:{},
      derivative:{method:'held-bone-surface',parent:q.derivative,joints:[from,to],poseJump:q.data.poseJump,localVelocity:'zero-between-held-drawings'}};
  }};
  return create({id,mask,body:parent});
}

export function features(value) {
  const s=requireSurface(value),S=s._scan,m=s.mask,at=([x,y])=>[m.origin[0]+x+.5,m.origin[1]+y+.5];
  return {space:m.space,pixels:S.body.map(([x,y])=>({id:`${s.id}/pixel/${y*m.w+x}`,index:y*m.w+x,position:at([x,y]),normal:[...s._normals.get(y*m.w+x)]})),
    upper:S.up.map(at),sides:S.side.map(([x,y,d])=>({position:at([x,y]),direction:d})),outline:S.outline.map(([x,y,nx,ny])=>({position:at([x,y]),normal:[nx,ny]})),top:S.top.map((y,x)=>y<0?null:at([x,y])),rows:S.rows.map(([a,b],y)=>a<0?null:{y:m.origin[1]+y+.5,left:m.origin[0]+a,right:m.origin[0]+b+1})};
}

export function sample(value,time,{mask,...options}={}) {
  const s=requireSurface(value),m=selected(s,mask),q=body.sample(s.body,time,options);
  q.data.surface.remaining=m.data.reduce((sum,v)=>sum+(v?1:0),0);return q;
}
export function observe(value,time,options) {return {kind:'BodyObservation',...sample(value,time,options)};}
export function project(value,time,{position,normal=[0,0],side='right'}={}) {
  const s=requireSurface(value);point(position,'surface.project.position');point(normal,'surface.project.normal');
  const q=body.sample(s.body,time,{side});
  return {position:transformPoint(q.matrix,position),velocity:transformPoint(q.matrixVelocity,position),normal:normalAt(q.matrix,normal),status:q.status,opacity:q.opacity,space:'effect',derivative:q.derivative};
}

/** Inverse rasterization keeps the same material pixel under animated body
 * transforms. Shader runs once per touched material cell, not per output dot. */
export function draw(painter,value,time,{mask,shade,color:base='#ffffff'}={}) {
  const s=requireSurface(value),m=selected(s,mask);if(shade!==undefined&&typeof shade!=='function')fail('surface.draw.shade','expected pixel => color/{color,alpha,light,lightStrength} or null');
  const drawingBody={kind:'Body',sample:(t,options)=>sample(s,t,{...options,mask:m})};
  return body.draw(painter,drawingBody,time,{draw(p,q){
    const cache=new Map(),[ox,oy]=m.origin;
    p.shade(ox,oy,ox+m.w,oy+m.h,(x,y,out)=>{
      const ix=Math.floor(x-ox),iy=Math.floor(y-oy);if(ix<0||iy<0||ix>=m.w||iy>=m.h)return;const i=iy*m.w+ix;if(!m.data[i])return;
      if(!cache.has(i)){
        const position=[ox+ix+.5,oy+iy+.5],localNormal=s._normals.get(i),state={id:`${s.id}/pixel/${i}`,index:i,position,localNormal:[...localNormal],effectPosition:transformPoint(q.matrix,position),velocity:transformPoint(q.matrixVelocity,position),normal:normalAt(q.matrix,localNormal),time,body:q};
        let paint=shade?shade(state):base;if(typeof paint==='number'||typeof paint==='string')paint={color:paint};
        if(paint!==null&&(!paint||typeof paint!=='object'))fail('surface.draw.shade','return color, paint object or null');
        cache.set(i,paint===null?null:{c:color(paint.color,'surface.draw.color'),a:alpha(paint.alpha??1,'surface.draw.alpha'),...(paint.light!==undefined?{l:color(paint.light,'surface.draw.light'),k:positive(paint.lightStrength??1,'surface.draw.lightStrength',true)}:{})});
      }
      const paint=cache.get(i);if(paint)Object.assign(out,paint);
    });
  }});
}

/** Closest projected crack segment supplies inherited design-distance arrival;
 * transverse distance supplies the subsequent erosion delay. Not geodesics. */
export function crackField({id,surface:value,network,front,spreadPxPerSecond=12,delay=0}={}) {
  identity(id,'surface.crackField.id');const s=requireSurface(value),m=s.mask;positive(spreadPxPerSecond,'surface.crackField.spreadPxPerSecond');positive(delay,'surface.crackField.delay',true);
  if(network?.kind!=='PropagationNetwork'||network.space!==m.space)fail('surface.crackField.network','network and material mask must share a declared local space');
  const segments=network.branches.flatMap(b=>b.path.segments.map((seg,i)=>({a:b.projected[i],b:b.projected[i+1],start:b.startPx+seg.start,length:seg.length})));
  if(!segments.length)fail('surface.crackField.network','a nonempty crack network is required');count(segments.length*s._scan.body.length,'surface.crackField.work',8000000);
  if(!Number.isFinite(propagation.arrival(front,0))||!Number.isFinite(propagation.arrival(front,network.maxDistancePx)))fail('surface.crackField.front','front must reach the complete [0,network.maxDistancePx] interval');
  const distance=new Float64Array(m.data.length).fill(NaN),crack=new Float64Array(m.data.length).fill(NaN),erode=new Float64Array(m.data.length).fill(NaN);
  for(const [ix,iy] of s._scan.body){
    const i=iy*m.w+ix,x=m.origin[0]+ix+.5,y=m.origin[1]+iy+.5;let best=Infinity,born=Infinity;
    for(const seg of segments){const dx=seg.b[0]-seg.a[0],dy=seg.b[1]-seg.a[1],ll=dx*dx+dy*dy,u=ll?Math.max(0,Math.min(1,((x-seg.a[0])*dx+(y-seg.a[1])*dy)/ll)):0,d=Math.hypot(x-seg.a[0]-dx*u,y-seg.a[1]-dy*u);
      if(d<=best+1e-10){const t=propagation.arrival(front,seg.start+seg.length*u);finite(t,'surface.crackField.arrival');if(d<best-1e-10||t<born){best=d;born=t;}}
    }
    distance[i]=best;crack[i]=born;erode[i]=finite(born+delay+best/spreadPxPerSecond,'surface.crackField.erosion');
  }
  const grid={w:m.w,h:m.h,origin:[...m.origin],revision:m.revision},field=(name,values,arrival)=>{
    const filled=[...values].filter(Number.isFinite),range=filled.length?[Math.min(...filled),Math.max(...filled)]:[0,0];
    return {kind:arrival?'ArrivalField':'ScalarField',id:`${id}/${name}`,space:m.space,unit:arrival?'seconds':'px',range,grid,...(arrival?{firstArrival:true}:{}),sample(x,y){const ix=Math.floor(x-m.origin[0]),iy=Math.floor(y-m.origin[1]);return ix<0||iy<0||ix>=m.w||iy>=m.h?NaN:values[iy*m.w+ix];}};
  };
  return {distance:field('distance',distance,false),crackAt:field('crack',crack,true),removeAt:field('remove',erode,true)};
}

/** Freeze each material event at its actual effect-space position/velocity.
 * There is no draw/update callback and no output-FPS differentiation. */
export function births({id,surface:value,arrival,clock,edge='after',...options}={}) {
  const s=requireSurface(value);if(clock!==undefined&&clock?.kind!=='ActionClock')fail('surface.births.clock','expected action.clock()');
  return image.dissolveEvents({id,mask:s.mask,arrival,...options}).map(b=>{
    const born=clock?clock.at(b.born,{edge}):b.born,q=project(s,born,{position:b.position,normal:s._normals.get(b.sourcePixel)});
    if(q.status!=='alive'||q.opacity===0)fail('surface.births.time','arrival occurs outside the active body; adjust arrival times or body lifecycle');
    return {...b,born,position:q.position,normal:q.normal,space:'effect',surface:{id:s.id,materialPixel:b.sourcePixel,materialPosition:b.position,materialBorn:b.born,pointVelocity:q.velocity,derivative:q.derivative}};
  });
}
export function inheritVelocity(factor=1) {
  finite(factor,'surface.inheritVelocity.factor');return ({birth})=>{
    if(!birth?.surface)fail('surface.inheritVelocity.birth','requires births from surface.births()');
    return point(birth.surface.pointVelocity,'surface.inheritVelocity.pointVelocity').map(v=>v*factor);
  };
}
