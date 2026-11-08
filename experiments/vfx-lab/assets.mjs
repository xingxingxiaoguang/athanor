// Declared local PNG dependencies. Freeze original bytes separately from JS;
// replay materializes only the saved bundle, never the current source files.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname,isAbsolute,basename,join} from 'node:path';
import {createHash} from 'node:crypto';
import {decodePNG} from '../../tools/lib/png.mjs';
import * as texture from '../../src/authoring/texture.js';
import {LabError} from './errors.mjs';

const digest=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const failure=(id,message,code='CONTRACT_MISMATCH',path)=>new LabError(code,`Asset '${id}': ${message}`,{path,details:{asset:id},recovery:'Inspect the effect assets declaration, restore/convert the named local PNG or correct frameSize/pivots, then render explicitly. Saved runs never substitute current files.'});
function image(file,id) {
  const bytes=Buffer.from(file.data,'base64');if(digest(bytes)!==file.sha256)throw failure(id,'saved PNG byte digest differs');
  let q;try{q=decodePNG(bytes);}catch(e){throw failure(id,e.message,/Unsupported|unsupported/.test(e.message)?'CAPABILITY_UNSUPPORTED':'CONTRACT_MISMATCH',file.source);}
  if(q.width>4096||q.height>4096||q.width*q.height>16_777_216)throw failure(id,'local source exceeds 4096 per axis / 16M pixels','BUDGET_EXCEEDED',file.source);
  try{return texture.rgba({id,w:q.width,h:q.height,data:q.data,pivot:file.pivot});}catch(e){throw failure(id,e.message,e.code??'CONTRACT_MISMATCH',file.source);}
}
export function materializeAssets(bundle) {
  if(!bundle)return null;if(bundle.version!==1||!Array.isArray(bundle.entries))throw failure('bundle','unsupported saved asset bundle');
  let pixels=0;
  return Object.fromEntries(bundle.entries.map(entry=>{
    const frames=entry.files.map((file,i)=>image(file,entry.kind==='image'?entry.id:`${entry.id}/${i}`));
    pixels+=frames.reduce((sum,f)=>sum+f.w*f.h,0);if(pixels>32_000_000)throw failure(entry.id,'declared decoded source pixels exceed 32 million','BUDGET_EXCEEDED');
    try{return [entry.id,entry.kind==='sheet'?texture.sheet({id:entry.id,image:frames[0],frameSize:entry.frameSize,pivots:entry.pivots}):entry.kind==='frames'?frames:frames[0]];}catch(e){throw failure(entry.id,e.message,e.code??'CONTRACT_MISMATCH',e.path);}
  }));
}
export function captureAssets(fx,options={}) {
  const declarations=typeof fx.mod.assets==='function'?fx.mod.assets(options):fx.mod.assets;
  if(declarations===undefined)return null;
  if(!declarations||Object.getPrototypeOf(declarations)!==Object.prototype)throw failure('declarations','export a plain ID → PNG declaration object');
  const entries=[];let totalBytes=0,totalFiles=0;
  for(const [id,input]of Object.entries(declarations)){
    if(!id)throw failure(id,'resource ID must be nonempty');const spec=typeof input==='string'?{file:input}:input;
    if(!spec||typeof spec!=='object'||((typeof spec.file==='string')===Array.isArray(spec.files)))throw failure(id,'declare exactly one of {file,pivot?}, {file,frameSize,pivots?} or {files,pivots?}');
    if(spec.files!==undefined&&!Array.isArray(spec.files))throw failure(id,'files must be an array of explicit PNG paths');
    if(spec.file!==undefined&&typeof spec.file!=='string')throw failure(id,'file must be a local PNG path string');
    if(spec.frameSize&&spec.files)throw failure(id,'frameSize splits one atlas file; use files for separate frames');
    if(spec.pivots!==undefined&&!Array.isArray(spec.pivots))throw failure(id,'pivots must be one [x,y] array per output frame');
    const list=spec.files??[spec.file];totalFiles+=list.length;if(!list.length||list.length>1024||totalFiles>1024)throw failure(id,'declare 1..1024 source files in total');
    const files=list.map((item,i)=>{
      const q=typeof item==='string'?{file:item}:item;if(typeof q?.file!=='string'||/^https?:/i.test(q.file))throw failure(id,'file must be an explicit local PNG path');
      const source=isAbsolute(q.file)?q.file:resolve(dirname(fx.file),q.file);let bytes;
      try{bytes=readFileSync(source);}catch(e){throw failure(id,`cannot read '${source}': ${e.message}`,'RESOURCE_NOT_FOUND',source);}
      totalBytes+=bytes.length;if(totalBytes>64*1024*1024)throw failure(id,'declared original PNG bytes exceed 64 MB','BUDGET_EXCEEDED',source);
      return {source,name:basename(source),sha256:digest(bytes),byteLength:bytes.length,data:bytes.toString('base64'),...(q.pivot??(spec.files?spec.pivots?.[i]:spec.pivot)?{pivot:q.pivot??(spec.files?spec.pivots?.[i]:spec.pivot)}:{})};
    });
    const entry={id,kind:spec.frameSize?'sheet':spec.files?'frames':'image',files,...(spec.frameSize?{frameSize:spec.frameSize,...(spec.pivots?{pivots:spec.pivots}:{})}:{})};
    if(spec.files&&spec.pivots&&spec.pivots.length!==files.length)throw failure(id,'one pivot per declared frame is required');
    entries.push(entry);if(entries.length>128)throw failure(id,'declare at most 128 resource IDs','BUDGET_EXCEEDED');
  }
  const bundle={version:1,entries};materializeAssets(bundle);return bundle;
}
export function assetDigest(bundle) {
  return bundle?digest(bundle.entries.map(({files,...entry})=>({...entry,files:files.map(({sha256,pivot})=>({sha256,pivot:pivot??null}))}))):null;
}
export function assetSummary(bundle) {
  return bundle?{digest:assetDigest(bundle),resources:bundle.entries.map(({files,...entry})=>({...entry,files:files.map(({data,...file})=>{const bytes=Buffer.from(data,'base64'),width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);return {...file,width,height,pivot:file.pivot??[width/2,height/2],encoding:{bitDepth:bytes[24],colorType:bytes[25],interlace:bytes[28]}};})}))}:null;
}
export function inspectAssets(fx,options={}) {
  try{const bundle=captureAssets(fx,options);if(bundle)fx.resources=materializeAssets(bundle);return {available:true,...assetSummary(bundle),declared:!!bundle};}
  catch(e){return {available:false,declared:true,error:{code:e.code??'CONTRACT_MISMATCH',message:e.message,path:e.path,details:e.details,recovery:e.recovery}};}
}
export function currentAssetStatus(summary) {
  return summary?.resources?.flatMap(entry=>entry.files.map(file=>{let actual=null;try{actual=digest(readFileSync(file.source));}catch{}return {id:entry.id,source:file.source,expected:file.sha256,actual,status:actual===null?'missing':actual===file.sha256?'unchanged':'changed'};}))??[];
}
export function readAssetBundle(manifest,directory) {
  if(!manifest.assets)return null;const path=join(directory,'assets.json');let text;
  try{text=readFileSync(path,'utf8');}catch{throw failure('bundle','saved assets.json is missing','REPLAY_UNAVAILABLE',path);}
  if(manifest.assets.file!=='assets.json'||digest(text)!==manifest.assets.sha256)throw failure('bundle','saved bundle digest differs','REPLAY_UNAVAILABLE',path);
  let bundle;try{bundle=JSON.parse(text);}catch{throw failure('bundle','saved JSON is unreadable','REPLAY_UNAVAILABLE',path);}
  if(assetDigest(bundle)!==manifest.assets.digest)throw failure('bundle','saved logical resource identity differs','REPLAY_UNAVAILABLE',path);return bundle;
}
export function exportAssets(bundle,directory) {
  if(!bundle)return [];
  // Verify complete decoded resources too; never export a corrupt closure as
  // apparently intact source art alongside valid baked frames.
  materializeAssets(bundle);const entries=bundle.entries.map((entry,i)=>({...entry,files:entry.files.map((file,j)=>{
    const name=`source-asset-${i}-${j}.png`;writeFileSync(join(directory,name),Buffer.from(file.data,'base64'));const {data,...info}=file;return {...info,file:name};
  })}));
  writeFileSync(join(directory,'source-assets.json'),JSON.stringify({version:1,digest:assetDigest(bundle),entries},null,2)+'\n');
  return ['source-assets.json',...entries.flatMap(e=>e.files.map(f=>f.file))];
}
