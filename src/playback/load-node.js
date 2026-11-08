// Optional filesystem adapter. Exported verbatim with imports rewritten to
// sibling standalone files; no runtime dependency on the workbench checkout.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {resolve,sep,join,dirname} from 'node:path';import {createHash} from 'node:crypto';
import {decodePNG,encodePNG} from '../../tools/lib/png.mjs';
import {createAsset,PlaybackError} from './index.js';
export function loadPack(directory){
 const root=resolve(directory),fail=(p,m,code='CONTRACT_MISMATCH')=>{throw new PlaybackError(p,m,code);};
 const read=name=>{if(typeof name!=='string'||!resolve(root,name).startsWith(root+sep))fail('pack.file','expected file inside pack directory');try{return readFileSync(join(root,name));}catch(e){fail(join(root,name),e.message,'RESOURCE_NOT_FOUND');}};
 const parse=name=>{try{return JSON.parse(read(name));}catch(e){if(e instanceof PlaybackError)throw e;fail(name,'unreadable JSON');}};
 const pack=parse('pack.json');if(pack.version!==1||!pack.sourceRun||!Array.isArray(pack.files))fail('pack.json','unsupported or incomplete asset pack');
 for(const f of pack.files){const bytes=read(f.file),sha=createHash('sha256').update(bytes).digest('hex');if(sha!==f.sha256)fail(f.file,`byte digest differs in frozen run '${pack.sourceRun}'`);}
 const atlas=parse('atlas.json');if(atlas.meta?.athanor?.sourceRun!==pack.sourceRun||atlas.meta.athanor.revision!==pack.revision)fail('atlas.json','identity differs from pack');
 for(const name of ['atlas.json','color.png','light.png'])if(!pack.files.some(f=>f.file===name))fail('pack.files',`required '${name}' is not hashed`);
 const decode=name=>{try{return decodePNG(read(name));}catch(e){if(e instanceof PlaybackError)throw e;fail(name,e.message);}};
 return {...createAsset({atlas,color:decode('color.png'),light:decode('light.png')}),pack,directory:root};
}

/** Optional Node image output adapter, preserving the composed scene size. */
export function writeFrame(file,frame,{channel='combined'}={}){
 if(!['color','light','combined'].includes(channel))throw new PlaybackError('writeFrame.channel','expected color/light/combined');
 const {width,height}=frame??{},data=frame?.[channel];if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||data?.length!==width*height*4)throw new PlaybackError('writeFrame.frame','expected composed width/height and RGBA channel bytes');
 const target=resolve(file);try{const bytes=encodePNG(width,height,data);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes);return {file:target,width,height,channel,sha256:createHash('sha256').update(bytes).digest('hex')};}catch(e){if(e instanceof PlaybackError)throw e;throw new PlaybackError(target,e.message,'RESOURCE_UNAVAILABLE');}
}
