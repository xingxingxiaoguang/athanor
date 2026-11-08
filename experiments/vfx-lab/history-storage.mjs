// Lossless storage only. Public trail probes always return complete points.
// Keep dynamic floating values verbatim; do not recompute/quantize them.
import { LabError } from './errors.mjs';
import { deflateSync, inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const dynamic = ['distancePx','s','time01','ageSeconds','historyAge'];
const invalid = () => { throw new LabError('CONTRACT_MISMATCH','Invalid indexed history observation evidence'); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const decodedLimit = 64_000_000;
/** Keep all state cells verbatim. Only large saved runs use this envelope;
 * public probes expand it before selecting any particle/body/source/trail. */
export function packFrames(series) {
  const totalBytes=Buffer.byteLength(JSON.stringify(series));
  if(totalBytes<=16_000_000)return series;
  if(totalBytes>decodedLimit)throw new LabError('BUDGET_EXCEEDED','Decoded observations exceed 64 MB',{details:{decodedBytes:totalBytes,decodedLimit},recovery:'Reduce declared groups or count; no state is silently dropped.'});
  const raw=Buffer.from(JSON.stringify(series.frames)),compressed=deflateSync(raw);
  return {...series,version:3,frameEncoding:'deflate-json-v1',framePayload:{version:series.version,rawBytes:raw.length,sha256:hash(raw),data:compressed.toString('base64')},frames:series.frames.map(({index,t,simulationTime,localTime})=>({index,t,simulationTime,localTime}))};
}
function expandFrames(series) {
  if(!series.frameEncoding)return series;
  const p=series.framePayload;
  if(series.frameEncoding!=='deflate-json-v1'||!p||![1,2].includes(p.version)||!Number.isInteger(p.rawBytes)||p.rawBytes<0||p.rawBytes>decodedLimit||typeof p.data!=='string'||p.data.length>24_000_000||!Array.isArray(series.frames))invalid();
  let raw,frames;
  try{raw=inflateSync(Buffer.from(p.data,'base64'),{maxOutputLength:decodedLimit});if(raw.length!==p.rawBytes||hash(raw)!==p.sha256)invalid();frames=JSON.parse(raw);}catch{invalid();}
  if(!Array.isArray(frames)||frames.length!==series.frames.length||frames.some((f,i)=>['index','t','simulationTime','localTime'].some(k=>f[k]!==series.frames[i][k])))invalid();
  const {frameEncoding,framePayload,...rest}=series;return {...rest,version:p.version,frames};
}
export function packHistory(series) {
  if (!series.trailLayers?.length) return series;
  const table = [], indices = new Map();
  const frames = series.frames.map(frame => ({...frame, trails: (frame.trails ?? []).map(group => ({...group, states: group.states.map(state => ({...state, points: state.points.map(point => {
    const base = Object.fromEntries(Object.entries(point).filter(([key]) => !dynamic.includes(key))), key = JSON.stringify(base);
    let index = indices.get(key);
    if (index === undefined) { index = table.length; indices.set(key,index); table.push(base); }
    return [index,...dynamic.map(key=>point[key])];
  })}))}))}));
  return {...series,version:2,historyEncoding:'point-table-v1',trailPointTable:table,frames};
}
export function expandHistory(series) {
  series = expandFrames(series);
  if (!series.historyEncoding) return series; // Original v1 runs remain valid.
  if (series.historyEncoding !== 'point-table-v1' || !Array.isArray(series.trailPointTable) || !Array.isArray(series.frames)) invalid();
  const frames = series.frames.map(frame=>({...frame,trails:(frame.trails??[]).map(group=>({...group,states:group.states.map(state=>({...state,points:state.points.map(tuple=>{
    if(!Array.isArray(tuple)||tuple.length!==6||!Number.isInteger(tuple[0])||tuple[0]<0||tuple[0]>=series.trailPointTable.length||!tuple.slice(1).every(Number.isFinite))invalid();
    const base=series.trailPointTable[tuple[0]];
    if(!base||!Array.isArray(base.position)||base.position.length!==2||!base.position.every(Number.isFinite)||!Number.isFinite(base.time)||!Number.isFinite(base.simulationTime)||typeof base.breakBefore!=='boolean'||typeof base.interpolated!=='boolean'||(base.velocity!==undefined&&(!Array.isArray(base.velocity)||base.velocity.length!==2||!base.velocity.every(Number.isFinite))))invalid();
    return {...structuredClone(base),...Object.fromEntries(dynamic.map((key,i)=>[key,tuple[i+1]]))};
  })}))}))}));
  const {historyEncoding,trailPointTable,...rest}=series;
  return {...rest,frames};
}
