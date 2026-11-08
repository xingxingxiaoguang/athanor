import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { LAB, RECORDS } from './lab.mjs';
import { invoke } from './invoke.mjs';
import { decodePNG } from '../../tools/lib/png.mjs';

const sha = b => createHash('sha256').update(b).digest('hex');
function fixture() { const name = `bounds-${randomUUID().slice(0, 8)}`; mkdirSync(join(LAB, 'drafts'), { recursive: true }); return { id: `draft/${name}`, file: join(LAB, 'drafts', name + '.js') }; }
const source = (bounds, drawing = "if(t>=.4)return;p.rect(-30,-30,80,80,0xff182838);p.disc(1,0,6,0xffddeeff,.2);p.glow(0,0,30,0xff8888ff,.2);", extra = '') => `export const meta={name:'Bounds fixture',size:[32,24],origin:[8,8],duration:.4,options:{seed:1}};export const authoring={ending:'clear',${bounds === undefined ? '' : 'bounds:'+JSON.stringify(bounds)}};export function draw(p,t,o){${drawing}}${extra}`;
const cleanup = (f, runs) => { rmSync(f.file, { force: true }); runs.forEach(r => rmSync(join(RECORDS, r), { recursive: true, force: true })); };
function framePixels(rendered, name, index = 0) {
  const m = JSON.parse(readFileSync(rendered.manifest)), image = decodePNG(readFileSync(join(RECORDS, rendered.run, name+'.png'))), r = m.frames[index].rect, out = Buffer.alloc(r.w*r.h*4);
  for (let y=0;y<r.h;y++) image.data.copy(out,y*r.w*4,((r.y+y)*image.width+r.x)*4,((r.y+y)*image.width+r.x+r.w)*4);
  return out;
}

test('viewport declaration keeps every in-window color/soft-alpha/light pixel under flip/rotation and clips direct buffer writes', async () => {
  const f=fixture(), runs=[];
  try {
    for (const options of [{}, {flip:true}, {angle:.63,flip:true}]) {
      const art="if(t>=.4)return;p.rect(-30,-30,80,80,0xff182838);p.disc(1,0,6,0xffddeeff,.2);p.glow(0,0,30,0xff8888ff,.2);p.C[(5-p.oy)*p.w+5-p.ox]=0x80443322;p.L[(5-p.oy)*p.w+5-p.ox]=0xff020304;";
      writeFileSync(f.file,source({mode:'asset'},art)); const a=await invoke('render',{id:f.id,background:'sky',options});runs.push(a.run);
      writeFileSync(f.file,source({mode:'viewport',rect:[4,3,22,17]},art)); const b=await invoke('render',{id:f.id,background:'sky',options});runs.push(b.run);
      for (const channel of ['color','light','combined','preview']) {
        const before=framePixels(a,channel),after=framePixels(b,channel);
        for(let y=0;y<24;y++)for(let x=0;x<32;x++) {
          const at=(y*32+x)*4,inside=x>=4&&x<26&&y>=3&&y<20;
          assert.deepEqual(after.subarray(at,at+4),inside?before.subarray(at,at+4):Buffer.alloc(4),`${channel} ${x},${y} ${JSON.stringify(options)}`);
        }
      }
      assert.deepEqual(b.bounds.rect,[4,3,22,17]);assert.equal(b.bounds.space,'canvas');
    }
  } finally { cleanup(f,runs); }
});

test('explicit assets locate short off-grid color and faint-light spill; legacy light severity is preserved', async () => {
  const f=fixture(),runs=[];
  try {
    const art="if(t>=.4)return;p.px(0,0,0xffffffff);if(t===.123){p.blend(25,-2,0xffffffff,.1);p.light(25,-2,0xffffffff,.006)}";
    writeFileSync(f.file,source({mode:'asset'},art));const r=await invoke('render',{id:f.id});runs.push(r.run);
    assert.equal((await invoke('validate',{run:r.run})).passed,true);
    const v=await invoke('validate',{run:r.run,boundsTimes:[.123]});assert.equal(v.passed,false);
    for(const code of ['COLOR_SPILL','LIGHT_SPILL']) {
      const finding=v.errors.find(e=>e.code===code);assert(finding);assert.equal(finding.pixels,1);assert.equal(finding.locations[0].time,.123);assert.deepEqual(finding.locations[0].rect,[33,6,1,1]);assert.equal(finding.locations[0].sides.right,1);
    }
    assert(v.pages.length);assert.equal(v.pages[0].pixelScale,1);assert.equal(v.pages[0].representation,'unclipped-frozen-raster');assert.equal(sha(readFileSync(v.pages[0].image)),v.pages[0].sha256);
    writeFileSync(f.file,source(undefined,art));const old=await invoke('render',{id:f.id});runs.push(old.run);
    const legacy=await invoke('validate',{run:old.run,boundsTimes:[.123]});assert(legacy.errors.some(e=>e.code==='COLOR_SPILL'));assert(!legacy.errors.some(e=>e.code==='LIGHT_SPILL'));assert.equal(legacy.bounds.declared,false);
    await assert.rejects(invoke('validate',{run:r.run,boundsTimes:[.5]}),{code:'INVALID_INPUT'});
  } finally {cleanup(f,runs);}
});

test('scan-edge uncertainty stays explicit and an expanded requested margin locates the actual far edge', async () => {
  const f=fixture(),runs=[];
  try {
    writeFileSync(f.file,source({mode:'asset'},"if(t>=.4)return;p.line(24,2,100,2,0xffffffff);"));const r=await invoke('render',{id:f.id});runs.push(r.run);
    const near=await invoke('validate',{run:r.run});const far=await invoke('validate',{run:r.run,boundsMargin:96});
    assert.equal(near.errors.find(e=>e.code==='COLOR_SPILL').locations[0].touchesScanBoundary,true);
    const loc=far.errors.find(e=>e.code==='COLOR_SPILL').locations[0];assert.equal(loc.touchesScanBoundary,false);assert.deepEqual(loc.rect,[32,10,77,1]);assert.equal(far.coverage.boundsMargin,96);
  } finally {cleanup(f,runs);}
});

test('a declared viewport reports intentional crop without masking ending or draw mutation checks', async () => {
  const f=fixture(),runs=[];
  try {
    writeFileSync(f.file,source({mode:'viewport'},"if(t>=.4)return;p.circle(0,0,3,0xffffffff);p.beam(10,0,60,0,4,0xffffffff);p.glow(25,0,12,0xffffffff,.2);"));const r=await invoke('render',{id:f.id});runs.push(r.run);
    const v=await invoke('validate',{run:r.run});assert.equal(v.passed,true);assert(v.diagnostics.some(e=>e.code==='INTENTIONAL_CROP'));assert(v.boundary.samples.some(s=>s.color.pixels>0&&s.light.pixels>0));
    writeFileSync(f.file,source({mode:'viewport'},"p.px(0,0,0xffffffff);"));const e=await invoke('validate',{id:f.id});assert(e.errors.some(e=>e.code==='END_NOT_EMPTY'));
    writeFileSync(f.file,source({mode:'viewport'},"p.px(0,0,0xff000000|count++);",'let count=0;'));const d=await invoke('validate',{id:f.id});assert(d.errors.some(e=>e.code==='DRAW_MUTATES_STATE'));
  } finally {cleanup(f,runs);}
});

test('bounds definitions are discoverable and invalid declarations retain actionable public errors', async () => {
  const f=fixture();
  try {
    assert((await invoke('search',{query:'viewport'})).resources.some(r=>r.ref.id==='core/effect'));
    const contract=await invoke('inspect',{ref:{kind:'operator',id:'core/effect'},sections:['contract']});assert.match(contract.sections.contract,/bounds/);
    for(const bounds of [{mode:'crop'},{mode:'viewport',rect:null},{mode:'viewport',rect:[0,0,33,24]},{mode:'asset',rect:[0,0,1.5,4]},{mode:'asset',typo:true}]) {
      writeFileSync(f.file,source(bounds));const err=await invoke('render',{id:f.id}).catch(e=>e);assert.equal(err.code,'CONTRACT_MISMATCH');assert.match(err.path,/authoring.bounds/);
      const record=(await invoke('history',{callRef:err.callRef})).call;assert.equal(record.status,'failed');assert.equal(record.error.message,err.message);
    }
  } finally {cleanup(f,[]);}
});

test('frozen output declaration survives missing/currently different drafts and reaches exact atlas delivery metadata', async () => {
  const f=fixture(),runs=[];
  try {
    writeFileSync(f.file,source({mode:'viewport',rect:[3,2,25,20]}));const a=await invoke('render',{id:f.id,background:'none'});runs.push(a.run);
    writeFileSync(f.file,source({mode:'asset'}));const current=await invoke('validate',{id:f.id});assert(current.errors.some(e=>e.code==='COLOR_SPILL'));
    rmSync(f.file);const replay=await invoke('render',{target:{run:a.run}});runs.push(replay.run);assert.deepEqual(replay.bounds,a.bounds);
    for(const name of ['color','light','combined','preview'])assert.equal(sha(readFileSync(join(RECORDS,a.run,name+'.png'))),sha(readFileSync(join(RECORDS,replay.run,name+'.png'))));
    const v=await invoke('validate',{run:a.run});assert.equal(v.passed,true);assert.equal(v.bounds.mode,'viewport');
    const e=await invoke('export',{run:a.run,validationRef:v.validationRef});const atlas=JSON.parse(readFileSync(join(e.directory,'atlas.json')));assert.deepEqual(atlas.meta.athanor.bounds,a.bounds);
    for(const name of ['color','light','combined'])assert.equal(sha(readFileSync(join(RECORDS,a.run,name+'.png'))),sha(readFileSync(join(e.directory,name+'.png'))));
    const c=await invoke('compare',{runs:[a.run,replay.run],window:{from:.1,to:.2}});runs.push(c.run);assert.deepEqual(c.conditions[0].bounds,a.bounds);
  } finally {cleanup(f,runs);}
});

test('MCP validate exposes structured boundary locations and all native evidence pages to an AI caller', async () => {
  const f=fixture(),runs=[];
  try {
    writeFileSync(f.file,source({mode:'asset'},"if(t>=.4)return;p.line(0,0,32,0,0xffffffff);p.glow(25,0,8,0xffffffff,.2);"));const r=await invoke('render',{id:f.id});runs.push(r.run);
    const messages=[{jsonrpc:'2.0',id:1,method:'initialize',params:{}},{jsonrpc:'2.0',method:'notifications/initialized'},{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'fx_validate',arguments:{run:r.run}}}];
    const out=await new Promise((resolve,reject)=>{const child=execFile(process.execPath,[join(LAB,'mcp.mjs')],{timeout:10000,maxBuffer:8*1024*1024},(error,stdout)=>error?reject(error):resolve(stdout));child.stdin.end(messages.map(m=>JSON.stringify(m)).join('\n')+'\n');});
    const result=out.trim().split('\n').map(s=>JSON.parse(s)).find(r=>r.id===2).result;assert.equal(result.structuredContent.passed,false);assert(result.structuredContent.boundary.samples.length);assert.equal(result.content.filter(c=>c.type==='image').length,result.structuredContent.pages.length);
  } finally {cleanup(f,runs);}
});
