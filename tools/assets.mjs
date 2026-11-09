#!/usr/bin/env node
import {rmSync, existsSync, lstatSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT} from './lib/fxlib.mjs';
import {catalog, inspectAsset, checkLibrary, outputDirectories} from './lib/asset-library.mjs';

const [command='help', ...args] = process.argv.slice(2);
try {
  let result;
  if (command==='list') result=await catalog(args.join(' '));
  else if (command==='inspect') result=await inspectAsset(args[0]);
  else if (command==='check') {if(args.some(x=>x!=='--staged'))throw new Error('check accepts only --staged');result=await checkLibrary({staged:args.includes('--staged')});if(!result.passed)process.exitCode=1;}
  else if (command==='clean') {
    if(args.some(x=>!['--apply','--drafts'].includes(x)))throw new Error('clean accepts only --apply and --drafts');
    const paths=[...outputDirectories,...(args.includes('--drafts')?['experiments/vfx-lab/drafts']:[])];
    const size=path=>{const s=lstatSync(path);return s.isDirectory()?readdirSync(path).reduce((n,f)=>n+size(join(path,f)),0):s.size;};
    const directories=paths.filter(p=>existsSync(join(ROOT,p))).map(path=>({path,bytes:size(join(ROOT,path))}));
    if(args.includes('--apply'))for(const {path}of directories)rmSync(join(ROOT,path),{recursive:true,force:true});
    result={action:args.includes('--apply')?'removed':'dry-run',bytes:directories.reduce((n,d)=>n+d.bytes,0),directories};
  } else if(command==='help')result={commands:['list [query]','inspect category/name','check [--staged]','clean [--apply] [--drafts]'],source:'src/fx/<category>/<name>.js',generated:'.cache/athanor, records, dist, sheets, output (ignored)'};
  else throw new Error(`Unknown command '${command}'; run node tools/assets.mjs help`);
  console.log(JSON.stringify(result,null,2));
} catch(error) {console.error(JSON.stringify({error:error.message}));process.exitCode=1;}
