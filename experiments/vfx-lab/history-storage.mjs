// Lossless storage only. Public trail probes always return complete points.
// Keep dynamic floating values verbatim; do not recompute/quantize them.
import { LabError } from './errors.mjs';
const dynamic = ['distancePx','s','time01','ageSeconds','historyAge'];
const invalid = () => { throw new LabError('CONTRACT_MISMATCH','Invalid indexed history observation evidence'); };
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
