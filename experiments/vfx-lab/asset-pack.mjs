import {readFileSync,writeFileSync} from 'node:fs';import {join,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const ROOT=join(dirname(fileURLToPath(import.meta.url)),'../..');
export function writeAssetPack(directory,manifest,files){
 const sources=[['playback.mjs','src/playback/index.js'],['load-node.mjs','src/playback/load-node.js'],['png.mjs','tools/lib/png.mjs']];
 for(const [name,source] of sources){let text=readFileSync(join(ROOT,source),'utf8');if(name==='load-node.mjs')text=text.replace("'../../tools/lib/png.mjs'","'./png.mjs'").replace("'./index.js'","'./playback.mjs'");writeFileSync(join(directory,name),text);}
 const names=[...files,...sources.map(([name])=>name)];
 const pack={version:1,sourceRun:manifest.run,sourceDigest:manifest.sourceDigest,revision:manifest.revision??manifest.sourceDigest,assetDigest:manifest.assets?.digest??null,validation:manifest.validation??null,files:names.map(file=>({file,sha256:createHash('sha256').update(readFileSync(join(directory,file))).digest('hex')}))};
 writeFileSync(join(directory,'pack.json'),JSON.stringify(pack,null,2)+'\n');return [...sources.map(([name])=>name),'pack.json'];
}
