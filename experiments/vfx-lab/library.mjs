// Selected frozen artwork -> staged ordinary JS -> pixel parity -> scoped install.
// Reuse source/replay, selection/validation, clock, PNG and registry mechanisms.
import{readFileSync,writeFileSync,mkdirSync,existsSync,renameSync,rmSync,symlinkSync,lstatSync}from'node:fs';
import{join,dirname,posix}from'node:path';import{pathToFileURL}from'node:url';import{randomUUID,createHash}from'node:crypto';
import{init,parse}from'es-module-lexer';
import{ROOT,allIds,loadEffect}from'../../tools/lib/fxlib.mjs';import{registryFiles}from'../../tools/lib/registry.mjs';
import{decodePNG}from'../../tools/lib/png.mjs';import{createFrame,clearFrame}from'../../src/core/index.js';
import{clockedFx}from'./clock.js';import{cropFrame,resolveBounds}from'./boundary.mjs';import{moduleImports}from'./source-parser.mjs';
import{digestOf,replaySupport}from'./replay.mjs';import{readDecision,selectedDecisionForRun}from'./journal.mjs';
import{readAssetBundle,materializeAssets}from'./assets.mjs';import{readRun,RECORDS}from'./lab.mjs';import{LabError}from'./errors.mjs';
const home=join(RECORDS,'library'),validPlan=/^library-[a-f0-9-]{36}$/,validId=/^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/;
const hash=b=>createHash('sha256').update(b).digest('hex'),shaFile=p=>existsSync(p)?hash(readFileSync(p)):null;
function fail(code,message,details={},recovery='Inspect plan/status and the exact conflicts; fix the input or create a new plan. Frozen runs remain unchanged.'){throw new LabError(code,message,{details,recovery});}
function atomic(file,bytes){mkdirSync(dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';writeFileSync(temp,bytes);renameSync(temp,file);}
const save=(file,value)=>atomic(file,JSON.stringify(value,null,2)+'\n');
function safe(file){if(file.startsWith('/')||file.includes('\\')||file.split('/').some(p=>!p||p==='..'||p==='.'))fail('CONTRACT_MISMATCH','Invalid source/destination path',{file});return file;}
function noLinks(file){let p=ROOT;for(const bit of file.split('/')){p=join(p,bit);if(existsSync(p)&&lstatSync(p).isSymbolicLink())fail('REVISION_CONFLICT','Destination traverses a symlink',{file,p});}}
function planPath(ref){if(!validPlan.test(ref))fail('INVALID_INPUT','Invalid library planRef');return join(home,ref);}
function readPlan(ref,digest){const dir=planPath(ref);if(!existsSync(join(dir,'plan.json')))fail('RESOURCE_NOT_FOUND','Library plan is unavailable',{planRef:ref});const p=JSON.parse(readFileSync(join(dir,'plan.json'),'utf8')),{planDigest,...body}=p;if(digestOf(body)!==planDigest||digest&&digest!==planDigest)fail('REVISION_CONFLICT','Plan digest differs',{expected:digest,actual:planDigest});return{dir,p};}
function validation(m,ref){if(!/^validation-[a-f0-9-]{36}$/.test(ref))fail('INVALID_INPUT','Invalid validationRef');let v;try{v=JSON.parse(readFileSync(join(RECORDS,m.run,'validations',ref+'.json'),'utf8'));}catch{fail('CONTRACT_MISMATCH','Validation does not belong to this frozen run',{run:m.run,validationRef:ref});}if(!v.passed||v.targetRun!==m.run||v.sourceDigest!==m.sourceDigest||m.assets&&v.assetDigest!==m.assets.digest)fail('CONTRACT_MISMATCH','Needs a passing validation for the exact run/source/assets',{run:m.run,validationRef:ref});}
function selected(m){const d=selectedDecisionForRun(m.id,m.run,m.sourceDigest);if(!d)fail('SELECTION_CONFLICT','Requested run has no explicit selection record',{id:m.id,run:m.run,selectedRun:readDecision(m.id)?.selectedRun??null},'Use history action:select for the intended frozen run, then retry. Previously selected variants remain eligible; newest/current draft is never selected implicitly.');return d.decisionRef;}
function graph(snapshot,entry){const imports=moduleImports(snapshot),edges={},seen=new Set();function visit(file){safe(file);if(seen.has(file))return;seen.add(file);if(typeof snapshot[file]!=='string')fail('REPLAY_UNAVAILABLE','Missing frozen source',{file});edges[file]=(imports[file]??[]).map(s=>{if(!s.startsWith('.'))fail('CAPABILITY_UNSUPPORTED','Needs relative local JS imports',{file,specifier:s});return posix.normalize(posix.join(posix.dirname(file),s));});for(const dep of edges[file])visit(dep);}visit(entry);return{edges,files:[...seen]};}
function closure(edges,file){const seen=new Set();function visit(f){if(seen.has(f))return;seen.add(f);for(const d of edges[f]??[])visit(d);}visit(file);return[...seen].sort();}
const relImport=(from,to)=>{const p=posix.relative(posix.dirname(from),to);return p.startsWith('.')?p:'./'+p;};

// EVERY saved native frame, selected options, separate color/light. Does not
// claim unsaved-time, arbitrary-option, engine or aesthetic verification.
function comparePixels(mod,m,resources){
 const atlases=['color','light'].map(ch=>{const file=join(RECORDS,m.run,ch+'.png');if(m.files[ch]!==ch+'.png')fail('CONTRACT_MISMATCH','Unexpected saved channel path',{run:m.run,ch});return{...decodePNG(readFileSync(file)),sha256:shaFile(file)};});
 const[w,h]=m.size,frame=createFrame(w,h),fx=clockedFx(mod,{...m.options,...(resources?{assets:resources}:{}),x:m.origin[0],y:m.origin[1]}),bounds=resolveBounds({meta:mod.meta,mod});let previous=0;
 for(const f of m.frames){if(mod.create)fx.update(f.t-previous);else fx.seek(f.t);previous=f.t;clearFrame(frame);fx.draw(frame);cropFrame(frame,bounds);const bytes=new Uint8Array(frame.color.buffer),r=f.rect;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,a=i*4,b=((r.y+y)*atlases[0].width+r.x+x)*4,c=frame.light[i];
   if(bytes[a]!==atlases[0].data[b]||bytes[a+1]!==atlases[0].data[b+1]||bytes[a+2]!==atlases[0].data[b+2]||bytes[a+3]!==atlases[0].data[b+3])fail('PIXEL_MISMATCH','Staged color differs from approved frame',{run:m.run,time:f.t,channel:'color',pixel:[x,y]},'Inspect the named frozen frame and staged source. Do not substitute an unapproved current draft.');
   const j=((r.y+y)*atlases[1].width+r.x+x)*4;if((c&255)!==atlases[1].data[j]||((c>>>8)&255)!==atlases[1].data[j+1]||((c>>>16)&255)!==atlases[1].data[j+2]||(c&0xffffff?255:0)!==atlases[1].data[j+3])fail('PIXEL_MISMATCH','Staged light differs from approved frame',{run:m.run,time:f.t,channel:'light',pixel:[x,y]});
  }
 }
 return{frames:m.frames.length,frameChannelPairs:m.frames.length*2,channels:['color','light'],differentPixels:0,savedChannelSha256:atlases.map(a=>a.sha256),scope:'All saved times, selected options and native canvas; not unrendered times/options or aesthetics.'};
}
function summary(p,status,dir,more={}){return{action:status,planRef:p.planRef,planDigest:p.planDigest,entries:p.entries,files:p.files,reusedDependencies:p.reused.length,frameChannelPairs:p.frameChannelPairs,totalEffects:p.totalEffects,detailRef:join(dir,'plan.json'),...more};}

export async function planLibrary(args){
 await init();const planRef='library-'+randomUUID(),dir=planPath(planRef),stage=join(dir,'staged'),outputs=new Map(),reused=new Map(),entries=[],seenIds=new Set();let pixels=0;
 const put=(file,bytes)=>{safe(file);const b=Buffer.from(bytes);if(outputs.has(file)&&!outputs.get(file).equals(b))fail('REVISION_CONFLICT','Entries produce different bytes at one destination',{file});outputs.set(file,b);mkdirSync(dirname(join(stage,file)),{recursive:true});writeFileSync(join(stage,file),b);};
 try{for(const request of args.entries){
  if(!validId.test(request.id)||['draft','lab'].includes(request.id.split('/')[0]))fail('INVALID_INPUT','Destination must be a formal category/name ID',{id:request.id});if(seenIds.has(request.id))fail('INVALID_INPUT','Duplicate destination ID',{id:request.id});seenIds.add(request.id);
  if(!request.metadata.name.trim()||!request.metadata.description.trim())fail('INVALID_INPUT','Formal name/description must be nonempty');
  const m=readRun(request.run);validation(m,request.validationRef);const decisionRef=selected(m);
  if(m.runtime.node!==process.version||m.runtime.platform!==process.platform||m.runtime.arch!==process.arch)fail('REPLAY_UNAVAILABLE','Frozen runtime differs',{run:m.run,runtime:m.runtime});
  pixels+=m.frames.length*m.size[0]*m.size[1];if(pixels>320_000_000)fail('BUDGET_EXCEEDED','Plan exceeds 320 million saved frame-pixels; split into smaller plans');
  const snapshot=JSON.parse(readFileSync(join(RECORDS,m.run,'sources.json'),'utf8'));if(digestOf(snapshot)!==m.sourceDigest)fail('REPLAY_UNAVAILABLE','Frozen source digest differs',{run:m.run});const support=replaySupport(snapshot,m.entry);if(!support.available)fail('REPLAY_UNAVAILABLE','Frozen source is incomplete or unsupported',support);
  const g=graph(snapshot,m.entry),mapped=new Map(),category=request.id.split('/')[0];
  for(const file of g.files){const deps=closure(g.edges,file),reuse=file.startsWith('src/')&&!deps.includes(m.entry)&&deps.every(p=>existsSync(join(ROOT,p))&&readFileSync(join(ROOT,p),'utf8')===snapshot[p]);if(reuse){mapped.set(file,file);for(const p of deps)reused.set(p,hash(snapshot[p]));}else{const key=digestOf(deps.map(p=>[p,hash(snapshot[p])])).slice(0,12);mapped.set(file,`src/fx/${category}/_modules/${posix.basename(file).replace(/\.(m?js)$/,`-${key}.$1`)}`);}}
  for(const file of g.files){const dest=mapped.get(file);if(dest===file)continue;let source=snapshot[file];const[imports]=parse(source);for(const item of [...imports].reverse()){if(!['static','reexport-star'].includes(item.type)||!item.specifier?.startsWith('.'))continue;const original=posix.normalize(posix.join(posix.dirname(file),item.specifier)),target=mapped.get(original);if(!target)fail('CONTRACT_MISMATCH','Import missing from frozen graph',{file,original});const quoted=JSON.stringify(relImport(dest,target)).slice(1,-1).replaceAll("'","\\'");source=source.slice(0,item.start)+quoted+source.slice(item.end);}put(dest,`// Frozen artwork source: ${file}\n`+source);}
  for(const[file]of reused){const target=join(stage,file);if(!existsSync(target)){mkdirSync(dirname(target),{recursive:true});symlinkSync(join(ROOT,file),target);}}
  const dest=`src/fx/${request.id}.js`,bundle=readAssetBundle(m,join(RECORDS,m.run)),declarations={};
  if(bundle)for(const entry of bundle.entries){const paths=entry.files.map(file=>{const path=`src/fx/${category}/_assets/${file.sha256}.png`;put(path,Buffer.from(file.data,'base64'));return relImport(dest,path);});declarations[entry.id]=entry.kind==='sheet'?{file:paths[0],frameSize:entry.frameSize,...(entry.pivots?{pivots:entry.pivots}:{})}:entry.kind==='frames'?{files:paths,...(entry.files.some(f=>f.pivot)?{pivots:entry.files.map(f=>f.pivot)}:{})}:{file:paths[0],...(entry.files[0].pivot?{pivot:entry.files[0].pivot}:{})};}
  const sourceModules=g.files.filter(file=>file.startsWith('src/fx/')||/^experiments\/vfx-lab\/(drafts|effects|productions)\//.test(file)).map(file=>({file:mapped.get(file),original:file,sha256:mapped.get(file)===file?hash(snapshot[file]):hash(outputs.get(mapped.get(file)))}));
  const metadata={name:request.metadata.name,desc:request.metadata.description,...(request.metadata.tags?{tags:request.metadata.tags}:{})},provenance={sourceRun:m.run,sourceId:m.id,sourceDigest:m.sourceDigest,validationRef:request.validationRef,decisionRef,sourceModules},imported=relImport(dest,mapped.get(m.entry));
  let source=`// Registered from an explicitly selected frozen run; see provenance.\nexport * from ${JSON.stringify(imported)};\nimport * as artwork from ${JSON.stringify(imported)};\nexport const meta={...artwork.meta,...${JSON.stringify(metadata)},options:{...artwork.meta.options,...${JSON.stringify(m.options)}}};\nexport const provenance=${JSON.stringify(provenance)};\n`;
  if(bundle)source+=`export const assets=${JSON.stringify(declarations)};\n`;put(dest,source);
  let mod=await import(pathToFileURL(join(stage,dest)).href);const resources=materializeAssets(bundle),own=typeof mod.events==='function'?mod.events({...mod.meta.options,...(resources?{assets:resources}:{})}):mod.events??{},overrides=Object.fromEntries(Object.entries(m.events).filter(([k,v])=>own[k]!==v));
  if(Object.keys(overrides).length){source+=`export const events=o=>({...((typeof artwork.events==='function'?artwork.events(o):artwork.events)??{}),...${JSON.stringify(overrides)}});\n`;outputs.delete(dest);put(dest,source);mod=await import(pathToFileURL(join(stage,dest)).href+'?events=1');}
  entries.push({id:request.id,run:m.run,validationRef:request.validationRef,decisionRef,sourceDigest:m.sourceDigest,metadata,parity:comparePixels(mod,m,resources)});
 }
 const current=(await import(pathToFileURL(join(ROOT,'src/fx/categories.js')).href)).categories,categories=structuredClone(current);
 for(const c of args.categories??[]){if(!/^[a-z][a-z0-9-]*$/.test(c.id)||!entries.some(e=>e.id.startsWith(c.id+'/')))fail('INVALID_INPUT','Category must concern a planned destination',{id:c.id});const old=categories.find(x=>x.id===c.id);if(old)Object.assign(old,c);else categories.push(c);}
 for(const e of entries){const id=e.id.split('/')[0];if(!categories.some(c=>c.id===id))categories.push({id,name:id,blurb:'Code-driven effects'});}
 const metas=[];for(const id of allIds())if(!seenIds.has(id)){const fx=await loadEffect(id);metas.push({id,entry:`src/fx/${id}.js`,status:fx.mod.asset?.status??'library',...fx.meta});}for(const e of entries)metas.push({id:e.id,entry:`src/fx/${e.id}.js`,status:'library',...(await import(pathToFileURL(join(stage,`src/fx/${e.id}.js`)).href)).meta});
 if(JSON.stringify(categories)!==JSON.stringify(current))put('src/fx/categories.js','// Library categories, in gallery order.\nexport const categories = '+JSON.stringify(categories,null,2)+';\n');
 for(const[file,text]of Object.entries(registryFiles(metas,categories)))put(file,text);
 const files=[...outputs].map(([file,bytes])=>{noLinks(file);return{file,sha256:hash(bytes),beforeSha256:shaFile(join(ROOT,file)),bytes:bytes.length};}),reuse=[...reused].map(([file,sha256])=>({file,sha256}));
 const body={version:1,planRef,createdAt:new Date().toISOString(),entries,files,reused:reuse,totalEffects:metas.length,frameChannelPairs:entries.reduce((n,e)=>n+e.parity.frameChannelPairs,0)},p={...body,planDigest:digestOf(body)};save(join(dir,'plan.json'),p);return summary(p,'planned',dir);
 }catch(error){rmSync(dir,{recursive:true,force:true});throw error;}
}
function conflicts(p,after=false){return[...p.files.filter(f=>{noLinks(f.file);return shaFile(join(ROOT,f.file))!==(after?f.sha256:f.beforeSha256);}).map(f=>({file:f.file,expected:after?f.sha256:f.beforeSha256,actual:shaFile(join(ROOT,f.file))})),...p.reused.filter(f=>shaFile(join(ROOT,f.file))!==f.sha256).map(f=>({file:f.file,kind:'reused dependency changed'}))];}
function rollback(p,dir,tx){const drift=[];for(const f of [...p.files].reverse()){const actual=shaFile(join(ROOT,f.file));if(actual===f.beforeSha256)continue;if(actual!==f.sha256){drift.push(f.file);continue;}if(f.beforeSha256===null)rmSync(join(ROOT,f.file));else{const backup=join(dir,'before',f.file);if(shaFile(backup)!==f.beforeSha256){drift.push(f.file);continue;}atomic(join(ROOT,f.file),readFileSync(backup));}}tx.status=drift.length?'recovery-required':'rolled-back';tx.conflicts=drift;save(join(dir,'transaction.json'),tx);if(drift.length)fail('RECOVERY_REQUIRED','Recovery preserved files modified outside this transaction',{files:drift});}
export async function libraryAction(args){
 if(args.action==='plan')return planLibrary(args);const{dir,p}=readPlan(args.planRef,args.planDigest),transaction=join(dir,'transaction.json'),receipt=existsSync(transaction)?JSON.parse(readFileSync(transaction,'utf8')):null;
 if(args.action==='status')return summary(p,receipt?.status??'planned',dir,{transaction:receipt,conflicts:conflicts(p,receipt?.status==='installed')});
 mkdirSync(home,{recursive:true});const lock=join(home,'install.lock');let owned=false;
 try{
  if(existsSync(lock)){const owner=JSON.parse(readFileSync(lock,'utf8'));let alive=true;try{process.kill(owner.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}if(args.action==='recover'&&!alive&&owner.planRef===p.planRef)rmSync(lock);else fail('LIBRARY_BUSY','Another transaction holds the install lock',{owner,lock},'If interrupted, call library recover with its planRef/digest. An active transaction is never unlocked.');}
  try{writeFileSync(lock,JSON.stringify({pid:process.pid,planRef:p.planRef}),{flag:'wx'});owned=true;}catch{fail('LIBRARY_BUSY','Another transaction acquired the install lock');}
  if(args.action==='recover'){if(!receipt||!['installing','recovery-required','rolled-back'].includes(receipt.status))fail('CONTRACT_MISMATCH','No interrupted transaction to recover',{status:receipt?.status??'planned'});rollback(p,dir,receipt);return summary(p,'rolled-back',dir,{transaction:receipt});}
  if(receipt?.status==='installed'){const drift=conflicts(p,true);if(drift.length)fail('REVISION_CONFLICT','Installed files changed',{conflicts:drift});return summary(p,'installed',dir,{transaction:receipt,idempotent:true});}
  if(receipt?.status==='installing'||receipt?.status==='recovery-required')fail('RECOVERY_REQUIRED','Recover interrupted transaction first',{planRef:p.planRef});
  const ids=p.entries.map(e=>e.id).sort(),approved=[...new Set(args.approval.ids)].sort();if(JSON.stringify(ids)!==JSON.stringify(approved)||!args.approval.reason.trim())fail('APPROVAL_SCOPE_MISMATCH','Approval must name exactly the planned IDs and the user instruction/reason',{planned:ids,approved},'Use existing user authorization for these exact IDs. Split the plan for partial approval; technical validation is not approval.');
  for(const e of p.entries){const m=readRun(e.run);if(m.sourceDigest!==e.sourceDigest)fail('REVISION_CONFLICT','Frozen source identity changed',{run:e.run});validation(m,e.validationRef);selected(m);if(digestOf(JSON.parse(readFileSync(join(RECORDS,e.run,'sources.json'),'utf8')))!==e.sourceDigest)fail('REVISION_CONFLICT','Frozen source snapshot changed',{run:e.run});for(const[ch,i]of[['color',0],['light',1]])if(shaFile(join(RECORDS,e.run,ch+'.png'))!==e.parity.savedChannelSha256[i])fail('REVISION_CONFLICT','Saved image changed after planning',{run:e.run,ch});}
  const drift=conflicts(p);if(drift.length)fail('REVISION_CONFLICT','Planned files/dependencies changed; no library writes',{conflicts:drift});
  for(const f of p.files){if(shaFile(join(dir,'staged',f.file))!==f.sha256)fail('REVISION_CONFLICT','Staged file changed',{file:f.file});if(f.beforeSha256!==null){const backup=join(dir,'before',f.file);mkdirSync(dirname(backup),{recursive:true});writeFileSync(backup,readFileSync(join(ROOT,f.file)));}}
  const tx={status:'installing',planRef:p.planRef,planDigest:p.planDigest,approval:args.approval,startedAt:new Date().toISOString()};save(transaction,tx);
  try{for(const f of p.files)atomic(join(ROOT,f.file),readFileSync(join(dir,'staged',f.file)));tx.status='installed';tx.finishedAt=new Date().toISOString();save(transaction,tx);}catch(error){rollback(p,dir,tx);throw error;}
  return summary(p,'installed',dir,{transaction:tx});
 }finally{if(owned)rmSync(lock,{force:true});}
}
