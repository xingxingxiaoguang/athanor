import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync,rmSync,mkdtempSync,cpSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {pathToFileURL} from 'node:url';
import {createAsset,imageAsset,instance,sample,eventsBetween,scene,compose} from '../../src/playback/index.js';
import {loadPack} from '../../src/playback/load-node.js';import {invoke} from './invoke.mjs';
const asset=(loop=false)=>createAsset({atlas:{frames:[{time:0,frame:{x:0,y:0,w:2,h:1}},{time:.5,frame:{x:0,y:1,w:2,h:1}}],meta:{size:{w:2,h:2},athanor:{sourceRun:'frozen',sourceDigest:'js',revision:'revision',pivot:[1,1],loop,events:{zero:0,hit:.5,end:1},playback:{version:1,duration:1}}}},color:{width:2,height:2,data:new Uint8Array([90,20,30,128,4,5,6,0,10,90,40,255,250,230,10,128])},light:{width:2,height:2,data:new Uint8Array([10,20,30,255,0,0,0,0,0,0,0,0,0,25,0,255])}});
test('standalone exact timing, seeking, stop, hold, unique partitionable looping event instances',()=>{
 const a=asset(),b=asset(true),i=instance({id:'cut',asset:a,start:2});assert.equal(sample(i,1).status,'pending');assert.equal(sample(i,2.5).frameIndex,1);assert.equal(sample(i,3).status,'expired');assert.equal(sample(instance({id:'hold',asset:a,hold:true}),2).status,'alive');
 const j=instance({id:'loop',asset:b,start:.2,stopAt:2.4});assert.equal(sample(j,1.2).frameIndex,0);assert.equal(sample(j,2.4).status,'expired');
 const whole=eventsBetween(j,-.01,3),parts=[...eventsBetween(j,-.01,1.1),...eventsBetween(j,1.1,3)];assert.deepEqual(parts,whole);assert.equal(new Set(whole.map(e=>e.id)).size,whole.length);assert(whole.every(e=>e.time<2.4));
 assert.equal(eventsBetween(i,0,3).length,3);sample(j,2);sample(j,.4);assert.equal(sample(j,.7).frameIndex,1);assert.throws(()=>scene([j,j],1),/duplicate/);
});
test('decimal period division and arbitrary small offsets do not drift a loop seam or duplicate interval events',()=>{
 const base=asset(true),atlas=structuredClone(base.atlas);atlas.frames[1].time=.1;atlas.meta.athanor.playback.duration=.2;atlas.meta.athanor.events={start:0,mid:.1};const a=createAsset({atlas,color:base.color,light:base.light}),i=instance({id:'short',asset:a});
 assert.equal(sample(i,.6).cycle,3);assert.equal(sample(i,.6).localTime,0);assert.equal(sample(i,.6).frameIndex,0);assert.equal(sample(i,.5999999999999999).frameIndex,1);
 const cues=eventsBetween(i,-.1,.6);assert.deepEqual(cues.map(e=>e.time),[0,.1,.2,.3,.4,.5,.6]);assert.deepEqual([...eventsBetween(i,-.1,.3),...eventsBetween(i,.3,.6)],cues);
});
test('nearest pixel compositing preserves transparent colors and independent additive light under mirror/pivot/opacity',()=>{
 const a=asset(),i=instance({id:'one',asset:a,position:[1,1]});const out=compose({width:2,height:1},scene([i],0));assert.deepEqual([...out.color],[90,20,30,128,0,0,0,0]);assert.deepEqual([...out.light],[10,20,30,255,0,0,0,0]);
 const flip=compose({width:2,height:1},scene([instance({id:'flip',asset:a,position:[1,1],scale:[-1,1]})],0));assert.deepEqual([...flip.color],[0,0,0,0,90,20,30,128]);
 const bg=compose({width:2,height:1,background:[40,60,80,255]},scene([i],0));assert.deepEqual([...bg.combined.subarray(0,4)],[75,59,84,255]);
 const dim=compose({width:2,height:1},scene([instance({id:'dim',asset:a,position:[1,1],opacity:.5})],0));assert.equal(dim.light[0],5);assert.equal(dim.color[3],64);
});
test('caller static art needs no atlas/timing boilerplate or fictitious frozen identity',()=>{
 const color={width:2,height:1,data:new Uint8Array([20,50,90,255,90,40,10,128])},a=imageAsset({id:'my-target',color,pivot:[1,1]}),i=instance({id:'target',asset:a,position:[1,1],stopAt:4});
 assert.equal(a.sourceRun,null);assert.equal(a.duration,null);assert.equal(sample(i,3).frameIndex,0);assert.equal(sample(i,3).assetId,'my-target');assert.equal(sample(i,4).status,'expired');assert.deepEqual(eventsBetween(i,-1,5),[]);assert.deepEqual(compose({width:2,height:1},scene([i],3)).color,color.data);
});
test('exported pack alone loads from moved external directory, identifies corrupt bytes and shares exact source run',async()=>{
 const r=await invoke('render',{id:'lab/asset-relay'}),v=await invoke('validate',{run:r.run}),x=await invoke('export',{run:r.run,validationRef:v.validationRef}),temp=mkdtempSync(join(tmpdir(),'athanor-consumer-'));
 try{cpSync(x.directory,temp,{recursive:true});const loader=await import(pathToFileURL(join(temp,'load-node.mjs')));const a=loader.loadPack(temp);assert.equal(a.sourceRun,r.run);assert.equal(a.pack.validation.ref,v.validationRef);const {instance,scene,compose}=await import(pathToFileURL(join(temp,'playback.mjs')));const s=scene([instance({id:'external',asset:a,position:a.pivot})],1.2);assert.equal(s[0].sourceRun,r.run);const frame=compose({width:192,height:160},s);assert(frame.color.some(x=>x));const saved=loader.writeFrame(join(temp,'scene','native.png'),frame);assert.deepEqual([saved.width,saved.height],[192,160]);assert(readFileSync(saved.file).length>100);
 const bytes=readFileSync(join(temp,'color.png'));writeFileSync(join(temp,'color.png'),bytes.subarray(0,32));assert.throws(()=>loader.loadPack(temp),/color.png.*digest differs/);
 }finally{rmSync(temp,{recursive:true,force:true});}
});
