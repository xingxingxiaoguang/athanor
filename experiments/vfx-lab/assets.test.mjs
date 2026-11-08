import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,rmSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {decodePNG} from '../../tools/lib/png.mjs';
import {texture} from '../../src/authoring/index.js';
import {captureAssets,materializeAssets,assetDigest} from './assets.mjs';
import {invoke} from './invoke.mjs';
import {LAB,RECORDS} from './lab.mjs';
const bytes=name=>readFileSync(new URL(`./fixtures/png/${name}.png`,import.meta.url));
const hash=x=>createHash('sha256').update(x).digest('hex');
test('independent PNG fixtures preserve straight transparent RGB, indexed partial alpha, grayscale and RGB tRNS',()=>{
 assert.deepEqual([...decodePNG(bytes('rgb8')).data],[20,40,60,0,255,0,127,255,0,150,50,255,255,255,255,255,0,0,0,255,4,8,16,255]);
 const indexed=decodePNG(bytes('indexed2'));assert.deepEqual([...indexed.data.subarray(0,12)],[20,40,60,0,255,0,127,128,0,150,50,255]);
 const gray=decodePNG(bytes('gray-alpha8'));assert.deepEqual([...gray.data.subarray(4,12)],[50,50,50,128,255,255,255,0]);
 assert.deepEqual([...decodePNG(bytes('gray1')).data].filter((_,i)=>i%4===0),[0,255,0,255,255,0]);
 const image=texture.rgba({id:'indexed',w:3,h:2,data:indexed.data,pivot:[1,2]}),mask=texture.mask(image);
 assert.equal(mask.data.reduce((a,b)=>a+b,0),4);assert.equal(texture.sample(image,[-1,-2]).alpha,0);assert.deepEqual(texture.sample(image,[0,-2]).rgba,[255,0,127,128]);assert.equal(texture.sample(image,[2,0]),null);
 assert.throws(()=>decodePNG(bytes('unsupported-gray16')),/Unsupported PNG encoding/);
 const bad=Buffer.from(bytes('indexed2'));bad[bad.length-6]^=1;assert.throws(()=>decodePNG(bad),/checksum/);
});
test('declared atlas/sequence assets preserve pivots and logical identity excludes source directory',()=>{
 const file=new URL('./fixtures/png/indexed2.png',import.meta.url).pathname;
 const make=(assets)=>captureAssets({file:join(LAB,'effects','asset-relay.js'),mod:{assets}});
 const b=make({single:{file,pivot:[0,2]},sheet:{file,frameSize:[1,2],pivots:[[0,1],[1,1],[0,2]]},frames:{files:[file,file],pivots:[[0,0],[2,2]]}}),a=materializeAssets(b);
 assert.equal(a.sheet.length,3);assert.deepEqual(a.sheet[1].pivot,[1,1]);assert.deepEqual(a.frames[1].pivot,[2,2]);
 const moved=structuredClone(b);moved.entries[0].files[0].source='/moved/elsewhere.png';assert.equal(assetDigest(moved),assetDigest(b));moved.entries[0].files[0].pivot=[1,1];assert.notEqual(assetDigest(moved),assetDigest(b));
 assert.throws(()=>make({broken:{file,files:[file]}}),/exactly one/);
 assert.throws(()=>make({broken:{file,frameSize:[2,2]}}),/divide/);
 assert.throws(()=>make({broken:{file:new URL('./fixtures/png/unsupported-gray16.png',import.meta.url).pathname}}),{code:'CAPABILITY_UNSUPPORTED'});
});
test('PNG closure survives missing draft/art, retains exact selected exports, rejects changed/corrupt current and saved inputs',async()=>{
 const name=`asset-${randomUUID().slice(0,8)}`,file=join(LAB,'drafts',name+'.js'),png=join(LAB,'drafts',name+'.png'),runs=[];
 mkdirSync(join(LAB,'drafts'),{recursive:true});
 const source=`import{texture}from'../../../src/authoring/index.js';export const meta={name:'Asset fixture',size:[32,32],origin:[16,16],duration:.5,options:{}};export const assets={icon:{file:'./${name}.png',pivot:[1,2]}};export function draw(p,t,o){if(t<.5)texture.draw(p,o.assets.icon,{scale:3,blend:'soft'});}`;
 try{
  writeFileSync(file,source);writeFileSync(png,bytes('indexed2'));const a=await invoke('render',{id:'draft/'+name});runs.push(a.run);const m=JSON.parse(readFileSync(a.manifest));assert(m.assets.digest);
  writeFileSync(png,bytes('rgb8'));const changed=await invoke('render',{id:'draft/'+name});runs.push(changed.run);assert.notEqual(changed.revision,a.revision);assert.equal(changed.sourceDigest,a.sourceDigest);
  writeFileSync(png,'broken');await assert.rejects(invoke('render',{id:'draft/'+name}),{code:'CONTRACT_MISMATCH'});
  writeFileSync(png,bytes('unsupported-gray16'));await assert.rejects(invoke('render',{id:'draft/'+name}),{code:'CAPABILITY_UNSUPPORTED'});
  rmSync(png);await assert.rejects(invoke('render',{id:'draft/'+name}),{code:'RESOURCE_NOT_FOUND'});rmSync(file);
  const v=await invoke('validate',{run:a.run});assert.equal(v.passed,true);assert.equal(v.assetDigest,m.assets.digest);
  const b=await invoke('render',{target:{run:a.run}});runs.push(b.run);for(const layer of ['color','light','combined'])assert.equal(hash(readFileSync(join(RECORDS,a.run,layer+'.png'))),hash(readFileSync(join(RECORDS,b.run,layer+'.png'))));
  const delivery=await invoke('export',{run:a.run,validationRef:v.validationRef});assert.equal(hash(readFileSync(join(delivery.directory,'source-asset-0-0.png'))),hash(bytes('indexed2')));
  const assets=join(RECORDS,a.run,'assets.json'),saved=readFileSync(assets);try{writeFileSync(assets,'corrupt');await assert.rejects(invoke('validate',{run:a.run}),{code:'REPLAY_UNAVAILABLE'});}finally{writeFileSync(assets,saved);}
 }finally{rmSync(file,{force:true});rmSync(png,{force:true});runs.forEach(run=>rmSync(join(RECORDS,run),{recursive:true,force:true}));}
});
