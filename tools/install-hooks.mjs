#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chmodSync} from 'node:fs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
try {
  if(process.env.CI&&process.env.CI!=='false')console.log('Repository hooks: CI uses the independent guard job.');
  else {
    let top;try{top=git('rev-parse','--show-toplevel');}catch{}
    if(!top||resolve(top)!==root)console.log('Repository hooks: skipping a package outside its own Git checkout.');
    else {
      let current;try{current=git('config','--get','core.hooksPath');}catch{}
      if(current&&current!=='.githooks'&&resolve(root,current)!==resolve(root,'.githooks'))throw new Error(`Existing core.hooksPath '${current}' was preserved. Chain the Athanor pre-commit/pre-push hooks there, or explicitly configure .githooks.`);
      for(const file of ['pre-commit','pre-push','run-node'])chmodSync(resolve(root,'.githooks',file),0o755);
      git('config','--local','core.hooksPath','.githooks');
      git('config','--local','athanor.guardNode',process.execPath);
      console.log('Repository hooks: pre-commit + pre-push installed; working Node path saved locally.');
    }
  }
}catch(error){console.error('Repository hooks: '+error.message);process.exitCode=1;}
