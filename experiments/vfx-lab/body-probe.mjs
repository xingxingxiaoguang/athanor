// Native state pages reuse fxlib.canvas and saved-view's bounded grid layout.
// These are declared transforms/bounds, not recovered artwork silhouettes.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { canvas } from '../../tools/lib/fxlib.mjs';
import { createFrame, painterFor } from '../../src/core/index.js';
import { BODY_UNITS } from './observation.mjs';
import { LabError } from './errors.mjs';

export function bodyProbe({m,run,sampling,series,actual,desired,times,layers,fields,limit,layout,records}) {
  if (!series.bodyLayers?.length) throw new LabError('CAPABILITY_UNSUPPORTED','This run has no declared program body observations',{recovery:'Declare bodies:[body.observe(subject,t)] in observe(), then explicitly render a new revision. Old pixels or particles do not imply body identity. Inspect core/body.'});
  const names=series.bodyLayers.map(b=>b.id);
  for(const id of layers??[])if(!names.includes(id))throw new LabError('RESOURCE_NOT_FOUND',`No declared body '${id}'`,{details:{bodies:names}});
  const selected=layers?series.bodyLayers.filter(b=>layers.includes(b.id)):series.bodyLayers.slice(0,limit),ids=new Set(selected.map(b=>b.id));
  const samples=actual.map((frame,i)=>({requested:desired[i],actual:frame.t,simulationTime:frame.simulationTime,localTime:frame.localTime,samplingError:frame.t-times[i],clamped:desired[i]!==times[i],
    states:(frame.bodies??[]).filter(b=>ids.has(b.id)).map(b=>({id:b.id,status:b.status,...Object.fromEntries(fields.map(f=>[f,b[f]]))}))}));
  const [w,h]=m.size,{maxWidth=1120,maxHeight=1024}=layout??{},columns=layout?.columns??Math.max(1,Math.min(4,Math.floor((maxWidth-8)/(w+8)))),rows=Math.floor((maxHeight-38)/(h+44));
  if(!rows||8+columns*(w+8)>maxWidth)throw new LabError('BUDGET_EXCEEDED','Body state cells do not fit native page limits',{recovery:'Increase layout limits or use fewer columns. No art pixels are resized.'});
  const perPage=columns*rows,pageCount=Math.ceil(actual.length/perPage);
  if(pageCount>12||actual.length*(w+8)*(h+44)>24_000_000)throw new LabError('BUDGET_EXCEEDED','Body state pages exceed 12 pages or 24 million pixels');
  const probeRef=`probe-${randomUUID()}`,directory=join(records,run,probeRef);mkdirSync(directory);
  const pages=[],colors=[0xff88d9ff,0xffffab88,0xffb0f0ac,0xffec99db];
  for(let page=0;page<pageCount;page++){
    const start=page*perPage,visible=actual.slice(start,start+perPage),ncols=Math.min(columns,visible.length),sheet=canvas(8+ncols*(w+8),38+Math.ceil(visible.length/columns)*(h+44)),cells=[];
    sheet.text('DECLARED BODY STATE / NATIVE PIXELS',8,8,2);
    visible.forEach((frame,j)=>{
      const f=createFrame(w,h),p=painterFor(f).place(...m.origin);
      (frame.bodies??[]).filter(b=>ids.has(b.id)).forEach((b,k)=>{
        const c=colors[k%colors.length],a=b.status==='alive'?1:.3;
        if(b.bounds)p.polyline([...b.bounds.corners,b.bounds.corners[0]],c,a);
        const [x,y]=b.position;p.line(x-2,y,x+2,y,c,a);p.line(x,y-2,x,y+2,c,a);
        for(const anchor of Object.values(b.anchors)){const [ax,ay]=anchor.position;p.line(x,y,ax,ay,c,a*.35);p.line(ax,ay,ax+anchor.velocity[0]*.05,ay+anchor.velocity[1]*.05,c,a*.7);p.rect(ax-1,ay-1,2,2,c,a);}
      });
      const x=8+(j%columns)*(w+8),y=38+Math.floor(j/columns)*(h+44);sheet.text(`${frame.t.toFixed(3)}s / BODIES`,x,y,2);sheet.paste(new Uint8Array(f.color.buffer),w,h,x,y+20);cells.push({sampleIndex:start+j,frameRect:{x,y:y+20,w,h}});
    });
    const png=sheet.png(),image=join(directory,`page-${String(page+1).padStart(3,'0')}.png`);writeFileSync(image,png);pages.push({page:page+1,image,sha256:createHash('sha256').update(png).digest('hex'),width:sheet.w,height:sheet.h,pixelScale:1,cells});
  }
  const result={probeRef,targetRun:run,sourceDigest:m.sourceDigest,representation:sampling==='saved'?'saved-body-states':'frozen-source-replay',view:'bodies',pixelScale:1,units:Object.fromEntries(fields.map(f=>[f,BODY_UNITS[f]])),bodies:selected,samples,pages,image:pages[0].image,
    selection:{mode:layers?'explicit body IDs':'first declared bodies',totalBodies:names.length,selectedBodies:selected.length,omittedBodies:names.length-selected.length},
    scope:'Actual author-declared program body state in effect space. Quads are transformed declared local bounds, not silhouettes or ownership inferred from pixels. Anchor whiskers show 0.05 seconds. No arbitrary 3D occlusion or aesthetic assessment.',detailRef:join(directory,'probe.json'),aestheticScore:null};
  writeFileSync(result.detailRef,JSON.stringify(result,null,2));return result;
}
