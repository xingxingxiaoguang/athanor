#!/usr/bin/env node
// Git hygiene only: inspect committed/index bytes without executing asset code.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const POLICY = '.repository-policy.json';
const MAX_OUTPUT = 64 * 1024 * 1024;
const textDecoder = new TextDecoder('utf-8', {fatal:true});
const git = (cwd, args, input) => execFileSync('git', args, {cwd, input, maxBuffer:MAX_OUTPUT, stdio:['pipe','pipe','pipe']});
const gitText = (cwd, args, input) => git(cwd,args,input).toString('utf8').trim();

function readPolicy(cwd, staged) {
  let bytes;
  if(staged) {
    try { bytes=git(cwd,['show',`:${POLICY}`]); } catch { bytes=readFileSync(resolve(cwd,POLICY)); }
  } else bytes=readFileSync(resolve(cwd,POLICY));
  const p=JSON.parse(bytes);
  if(p.version!==1 || !/^[a-f0-9]{40,64}$/.test(p.cleanHistoryBase))throw new Error('Invalid cleanHistoryBase/version in '+POLICY);
  for(const key of ['maxSourceFileBytes','maxResourceFileBytes','maxTreeBytes','maxHistoryBytes','maxReportFileBytes','maxEvaluationBytes','maxAllEvaluationsBytes']) {
    if(!Number.isSafeInteger(p[key])||p[key]<=0)throw new Error(`Invalid ${key} in ${POLICY}`);
  }
  for(const key of ['protectedRefs','requiredFiles','sourceDirectories','rootFiles','generatedDirectories','iterationDirectories','generatedPrefixes','generatedFiles','blockedExtensions','htmlEntries','pngSourcePatterns']) {
    if(!Array.isArray(p[key])||p[key].some(x=>typeof x!=='string'))throw new Error(`Invalid ${key} in ${POLICY}`);
  }
  return p;
}

function indexEntries(cwd) {
  const rows=git(cwd,['ls-files','--stage','-z']).toString('utf8').split('\0').filter(Boolean);
  return rows.map(row=>{const i=row.indexOf('\t'),[mode,oid,stage]=row.slice(0,i).split(' ');return {mode,oid,stage:Number(stage),file:row.slice(i+1)};});
}
function treeEntries(cwd, commit) {
  return git(cwd,['ls-tree','-r','-z',commit]).toString('utf8').split('\0').filter(Boolean).map(row=>{
    const i=row.indexOf('\t'),[mode,type,oid]=row.slice(0,i).split(' ');
    return {mode,type,oid,stage:0,file:row.slice(i+1)};
  });
}
function objectInfo(cwd, oids) {
  const unique=[...new Set(oids)];
  if(!unique.length)return new Map();
  const rows=gitText(cwd,['cat-file','--batch-check=%(objectname) %(objecttype) %(objectsize)'],unique.join('\n')+'\n').split('\n');
  return new Map(rows.map(row=>{const [oid,type,size]=row.split(' ');return [oid,{type,size:Number(size)}];}));
}
function contentKind(bytes) {
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';
  if(bytes.subarray(0,4).toString('ascii')==='wOF2')return 'woff2';
  const start=bytes.subarray(0,8);
  const zip=['504b0304','504b0506','504b0708'].includes(start.subarray(0,4).toString('hex'));
  if(/^(GIF87a|GIF89a|%PDF-)/.test(start.toString('ascii')) || zip || start.subarray(0,2).equals(Buffer.from([31,139])))return 'generated-binary';
  if(bytes.includes(0))return 'binary';
  try { textDecoder.decode(bytes); return 'text'; } catch { return 'binary'; }
}

export function checkRepository({cwd=process.cwd(),mode='staged',refs=['HEAD'],input=''}={}) {
  const p=readPolicy(cwd,mode==='staged'),errors=[],inspected=new Set(),kinds=new Map();
  let errorCount=0,treesChecked=0,treeBytes=0,historyBytes=0;
  const add=(code,error,context={},recovery='Remove generated files from the index and keep them in ignored records/. Review docs/REPOSITORY-GUARDS.md.')=>{
    errorCount++;if(errors.length<60)errors.push({code,...context,error,recovery});
  };
  const pngPatterns=p.pngSourcePatterns.map(x=>new RegExp(x)),fontPattern=new RegExp(p.fontSourcePattern);
  const inspect=(entries,commit)=>{
    const stats=objectInfo(cwd,entries.map(e=>e.oid)),evaluations=new Map();let total=0;
    const names=new Set(entries.map(e=>e.file));
    for(const file of p.requiredFiles)if(!names.has(file))add('REQUIRED_SOURCE_MISSING','Required guard source/configuration is missing',{file,...(commit?{commit}:{})},'Restore the guard/configuration; do not remove protection while changing assets.');
    for(const e of entries) {
      const context={file:e.file,...(commit?{commit}:{})},parts=e.file.split('/'),lower=e.file.toLowerCase(),ext=lower.split('.').at(-1);
      if(e.stage || !['100644','100755'].includes(e.mode) || stats.get(e.oid)?.type!=='blob') {
        add('SOURCE_ENTRY_UNSUPPORTED','Only regular, merged source files may enter Git',context,'Resolve merge stages or remove the symlink/submodule from the index; install dependencies with npm ci.');continue;
      }
      const size=stats.get(e.oid).size;total+=size;
      const png=pngPatterns.some(re=>re.test(e.file)),font=fontPattern.test(e.file),resource=png||font;
      if(parts.length===1?!p.rootFiles.includes(e.file):!p.sourceDirectories.includes(parts[0]))add('SOURCE_LOCATION','File is outside the declared source layout',context);
      if(parts.some(x=>p.generatedDirectories.includes(x)||p.iterationDirectories.includes(x))||p.generatedPrefixes.some(x=>e.file.startsWith(x))||p.generatedFiles.includes(e.file)||p.blockedExtensions.includes(ext))add('GENERATED_OUTPUT','Generated/iteration output cannot enter source history',context);
      if(/\.html?$/i.test(e.file)&&!p.htmlEntries.includes(e.file))add('EXTRA_DEMO','Only demo/index.html is a permitted HTML entry',context,'Use the shared demo/ and load effects from src/fx/; do not add per-artwork preview pages.');
      const limit=resource?p.maxResourceFileBytes:p.maxSourceFileBytes;
      if(size>limit)add('FILE_BUDGET',`File is ${size} bytes; limit is ${limit}`,context,'Keep exports out of Git. A necessary original resource needs an explicit reviewed policy change.');
      if(e.file.startsWith('experiments/vfx-lab/evaluations/')) {
        const rest=e.file.slice('experiments/vfx-lab/evaluations/'.length).split('/'),group=rest[0];
        if(rest.length!==2||!(rest[1].endsWith('.md')||rest[1]==='build-summary.json'))add('EVALUATION_LAYOUT','Only flat Markdown reports and build-summary.json may be tracked',context);
        if(size>p.maxReportFileBytes)add('REPORT_BUDGET',`Report exceeds ${p.maxReportFileBytes} bytes`,context,'Keep the compact original report in Git; archive calls, images, versions and full ledgers under ignored records/.');
        evaluations.set(group,(evaluations.get(group)??0)+size);
      }
      // Never read an oversized blob into memory just to identify its format.
      if(size<=limit) {
        let kind=kinds.get(e.oid);
        if(!kind){kind=contentKind(git(cwd,['cat-file','blob',e.oid]));kinds.set(e.oid,kind);}
        const valid=png?kind==='png':font?kind==='woff2':kind==='text';
        if(!valid)add('CONTENT_TYPE',`Content type ${kind} does not match an allowed source resource`,context,'Renaming a preview/archive does not make it source. Keep real PNG resources in declared _assets/ or documented fixture locations.');
      }
      inspected.add(e.oid);
    }
    const evaluationBytes=[...evaluations.values()].reduce((a,b)=>a+b,0);
    for(const [name,bytes]of evaluations)if(bytes>p.maxEvaluationBytes)add('EVALUATION_BUDGET',`Evaluation ${name} exceeds ${p.maxEvaluationBytes} bytes`,{...(commit?{commit}:{})});
    if(evaluationBytes>p.maxAllEvaluationsBytes)add('EVALUATIONS_BUDGET',`All tracked evaluation reports exceed ${p.maxAllEvaluationsBytes} bytes`,{...(commit?{commit}:{})});
    if(total>p.maxTreeBytes)add('TREE_BUDGET',`Source tree is ${total} bytes; limit is ${p.maxTreeBytes}`,{...(commit?{commit}:{})});
    treeBytes=Math.max(treeBytes,total);treesChecked++;
  };
  if(mode==='staged')inspect(indexEntries(cwd));
  else {
    if(mode==='push')refs=input.trim()?input.trim().split('\n').map(row=>{
      const fields=row.trim().split(/\s+/);if(fields.length!==4)throw new Error('Invalid Git pre-push input');
      const [,local,remoteRef,remote]=fields;
      if(p.protectedRefs.includes(remoteRef)) {
        if(/^0+$/.test(local))add('PROTECTED_REF_DELETE','Deleting a protected branch is blocked',{ref:remoteRef},'Keep main intact; use an ordinary feature branch for changes.');
        else if(!/^0+$/.test(remote))try{git(cwd,['merge-base','--is-ancestor',remote,local]);}catch{add('PROTECTED_REF_NON_FF','Rewinding/replacing a protected branch is blocked',{ref:remoteRef},'Fetch origin and fast-forward from the current main; do not force-push cleaned history.');}
      }
      return local;
    }).filter(oid=>!/^0+$/.test(oid)):[];
    if(!['push','history'].includes(mode))throw new Error(`Unknown mode ${mode}`);
    try {git(cwd,['cat-file','-e',p.cleanHistoryBase+'^{commit}']);}catch{add('HISTORY_BASE_MISSING','Clean history baseline is unavailable',{},'Use a clone of the cleaned repository; shallow clones need git fetch --unshallow.');}
    const commits=new Set(),tips=[];
    for(const ref of [...new Set(refs)]) {
      const commit=gitText(cwd,['rev-parse','--verify',ref+'^{commit}']);tips.push(commit);
      if(errors.some(e=>e.code==='HISTORY_BASE_MISSING'))continue;
      let descendant=false,ancestor=false;
      try{git(cwd,['merge-base','--is-ancestor',p.cleanHistoryBase,commit]);descendant=true;}catch{}
      if(!descendant)try{git(cwd,['merge-base','--is-ancestor',commit,p.cleanHistoryBase]);ancestor=true;}catch{}
      if(!descendant&&!ancestor){add('UNCLEAN_HISTORY_BASE','Ref does not belong to the cleaned repository history',{commit},'Reclone the cleaned origin and reapply source changes; do not merge or push pre-cleanup history.');continue;}
      if(descendant){commits.add(commit);for(const oid of gitText(cwd,['rev-list',commit,'^'+p.cleanHistoryBase]).split('\n').filter(Boolean))commits.add(oid);}
    }
    // Prior cleaned history is grandfathered; every subsequent commit is inspected,
    // including merge side branches and files deleted again before the pushed tip.
    for(const commit of commits)if(commit!==p.cleanHistoryBase)inspect(treeEntries(cwd,commit),commit);
    if(tips.length) {
      const oids=gitText(cwd,['rev-list','--objects','--no-object-names',...tips]).split('\n').filter(Boolean);
      historyBytes=[...objectInfo(cwd,oids).values()].reduce((sum,v)=>sum+v.size,0);
      if(historyBytes>p.maxHistoryBytes)add('HISTORY_BUDGET',`Reachable Git objects total ${historyBytes} bytes; limit is ${p.maxHistoryBytes}`,{},'Deleting the tip file does not remove old objects. Remove the accidental commits or recreate the change from the clean baseline before pushing.');
    }
  }
  return {passed:errorCount===0,mode,treesChecked,uniqueBlobsChecked:inspected.size,treeBytes,historyBytes,errorCount,errors,omittedErrors:Math.max(0,errorCount-errors.length)};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [mode='history',...refs]=process.argv.slice(2);
    const result=checkRepository({mode,refs:refs.length?refs:['HEAD'],input:mode==='push'?readFileSync(0,'utf8'):''});
    console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;
  } catch(error) {console.error(JSON.stringify({passed:false,error:error.message,recovery:'Run from a complete Athanor checkout with Git and a working Node 18+; see docs/REPOSITORY-GUARDS.md.'}));process.exitCode=1;}
}
