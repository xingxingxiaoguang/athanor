#!/usr/bin/env node
import './index.mjs';
import {build} from 'esbuild';
import {mkdirSync, cpSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT} from './lib/fxlib.mjs';
const source=join(ROOT,'demo'), out=join(ROOT,'dist/demo');
rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
await build({entryPoints:[join(source,'app.js')],bundle:true,format:'esm',minify:true,outfile:join(out,'app.js'),legalComments:'eof'});
for(const file of ['index.html','style.css','fonts'])cpSync(join(source,file),join(out,file),{recursive:true});
for(const file of ['LICENSE','NOTICE.md'])cpSync(join(ROOT,file),join(out,file));
console.log('Built dist/demo (generated, ignored)');
