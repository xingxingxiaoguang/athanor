// Curated library mechanisms, not new SDK algorithms. Source fragments remain
// verbatim; imports call shared mature helpers and preserve upstream attribution.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../../tools/lib/fxlib.mjs';
import { digestOf } from './replay.mjs';
import { moduleImports } from './source-parser.mjs';
import { LabError } from './errors.mjs';

const documentation = join(ROOT, 'docs/ai-vfx-tools/library-mechanisms.md');
const entries = [
  { id: 'library/explosion-lobes', name: '爆炸火团、冷却与分瓣烟体', maturity: 'library-helper', callable: true,
    summary: '直接复用fireBall/lobe的热核、暗缝、冷却与软烟边；形状布局、运动和时间可独立替换，SDK适配见core/material。',
    words: '爆炸 火团 火球 冷却 分瓣 烟团 火焰 lobe fireBall fireRamp cooling explosion fire smoke billow',
    references: ['explosions/small-explosion', 'explosions/smoke-bomb', 'explosions/nuke'],
    fragments: [
      { file: 'src/fx/explosions/_lib.js', start: 'export const fireRamp =', end: '/** One FIRE', symbols: ['fireRamp'] },
      { file: 'src/fx/explosions/_lib.js', start: 'export function fireBall(', end: '/** A particle system', symbols: ['fireBall'] },
      { file: 'src/fx/explosions/_lib.js', start: 'export function lobe(', end: '/**\n * A rolling fireball.', symbols: ['lobe'], context: 'Import the helper to retain private/shared dependencies. lobe is a pixel material, not the Plume motion model.' },
    ], operators: ['core/material', 'core/particle'],
    replaceable: ['lobe positions/radii and non-circular layout', 'heat and inner-glow clocks', 'fire/smoke ramps and cel shading', 'motion, births and end envelope'],
    invariants: ['All positions/radii are local art pixels; time is supplied by the author.', 'fireRamp takes dark-to-bright input; fireBall/lobe consume hot-to-dark fire ramps; lobe smoke is light-to-dark.', 'Direct helpers do not generate particle identities. Use the same public particle states for drawing and observe.'] },
  { id: 'library/merged-smoke', name: '密度合并烟云与受光冠', maturity: 'library-helper', callable: true,
    summary: 'cloud把真实烟团列表合成连续体，保留密度、亮度、火光、裁域；不必复制像素扫描/模糊，SDK适配见core/material。',
    words: '烟雾 烟云 合并 密度 蒸汽 云团 受光 cloud puff Smoke smoke steam density merged volume',
    references: ['projectiles/rocket', 'projectiles/homing-missile', 'projectiles/muzzle-shotgun'],
    fragments: [
      { file: 'src/fx/projectiles/_lib.js', start: 'export function puff(', end: '/**\n * Puffs', symbols: ['puff'] },
      { file: 'src/fx/projectiles/_lib.js', start: 'export function cloud(', end: '/**\n * Simulated smoke', symbols: ['cloud'], context: 'cloud uses the private blur routine in the same module. Import it; do not paste this fragment as a standalone shader.' },
    ], operators: ['core/material', 'core/particle'],
    replaceable: ['puff layout and motion', 'radius/coverage per state', 'brightness/warmth per state', 'ramps, density, lighting and local clip'],
    invariants: ['cloud receives all puffs together; drawing once per puff does not merge density.', 'Smoke and warm ramps are dark-to-bright, opposite to explosion lobe smoke.', 'No motion/age is advanced by this renderer. Query existing states once; use the same states for observation.'] },
  { id: 'library/branching-fractures', name: '距离前锋与分叉裂纹', maturity: 'library-helper', callable: true,
    summary: '复用递归裂枝、累计距离与连续末段；可替换投影、材质和前锋时序。',
    words: '裂纹 裂痕 裂缝 地裂 放射 蔓延 分叉 传播 fracture crack fork branch distance propagation',
    references: ['ice/ice-shatter', 'ice/freeze', 'impacts/heavy-landing', 'impacts/ground-slam'],
    fragments: [
      { file: 'src/core/branching.js', start: 'export function fractureBranches(', end: null, symbols: ['fractureBranches'], context: 'Mature ice walk extracted into a shared library core, retaining RNG order and legacy points. The validated propagation SDK wrapper is separate.' },
      { file: 'src/fx/ice/_lib.js', start: 'export function fractures(', end: null, symbols: ['fractures', 'drawFractures'] },
      { file: 'src/fx/impacts/_lib.js', start: 'export function makeCracks(', end: '/**\n * A standing crescent', symbols: ['makeCracks', 'drawCracks'], context: 'makeCracks also uses the private walk function in the original module; import the helper rather than copying this fragment alone.' },
    ] },
  { id: 'library/projected-rings', name: '共同投影与近远半环', maturity: 'reference-fragment', callable: false,
    summary: '参考轨环的压扁、画面滚转、近远半环与沿环亮点；原私有片段，通用组合另见core/orbit。',
    words: '光环 环绕 轨环 环形 近远 遮挡 投影 扩张 缩小 渐隐 ring halo orbit projection occlusion expand shrink fade',
    references: ['arcane/arcane-orb', 'holy/halo', 'holy/heal-aoe', 'shadow/black-hole'],
    fragments: [{ file: 'src/fx/arcane/arcane-orb.js', start: '// two rings,', end: '// the orb itself:', symbols: ['RINGS', 'setup', 'ring'], context: 'Private reference fragment; D, Y0, TAU, WHITE and palette are supplied by the original effect. Inspect arcane/arcane-orb for full context.' }] },
  { id: 'library/faceted-rocks', name: '不规则石块与分面材质', maturity: 'library-helper', callable: true,
    summary: '直接调用stoneShape/drawRock的形状、分面与受光边；适合小碎石，大山体需自画轮廓。',
    words: '岩石 岩块 石头 碎石 山体 山峰 分面 rock stone mountain facet debris',
    references: ['nature/boulder', 'nature/earth-spike', 'nature/quake'],
    fragments: [{ file: 'src/fx/nature/_lib.js', start: '// Shared by the nature effects:', end: '/**\n * A faceted stone spike', symbols: ['stoneShape', 'drawRock'] }] },
  { id: 'library/impact-feedback', name: '撞击停顿与衰减余震', maturity: 'reference-fragment', callable: false,
    summary: '参考触地时序、衰减局部抖动、短闪与碎屑；lab尚未接完整act播放时钟。',
    words: '撞击 冲击 落地 震动 震屏 余震 停顿 重量 impact landing shake hitstop quake recoil',
    references: ['nature/quake', 'nature/boulder', 'impacts/heavy-landing', 'impacts/ground-slam'],
    fragments: [
      { file: 'src/fx/nature/quake.js', start: 'const JOLTS =', end: '\n', symbols: ['JOLTS'] },
      { file: 'src/fx/nature/quake.js', start: '  const shake = () =>', end: '\n', symbols: ['shake'], context: 'Private pure-time formula inside create; t and JOLTS come from the effect. Camera shake and object displacement are different artistic choices.' },
    ] },
];
const summary = e => ({ ref: { kind: 'mechanism', id: e.id }, name: e.name, summary: e.summary, maturity: e.maturity, callable: e.callable, contract: 'fx_inspect', references: e.references, symbols: [...new Set(e.fragments.flatMap(p => p.symbols))], ...(e.operators ? { operators: e.operators } : {}) });
export function mechanismResources(query = '') {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(e => words.every(w => `${e.id} ${e.name} ${e.summary} ${e.words} ${e.fragments.flatMap(p=>p.symbols).join(' ')} ${e.references.join(' ')}`.toLowerCase().includes(w))).map(summary);
}
export function mechanismsForFile(file) { return entries.filter(e => e.fragments.some(p => p.file === file)).map(summary); }
function fragment(part, source) {
  const start = source.indexOf(part.start);
  const end = part.end === null ? source.length : source.indexOf(part.end, start + part.start.length);
  if (start < 0 || end < start || source.indexOf(part.start, start + 1) >= 0) throw new LabError('CONTRACT_MISMATCH', 'Registered library source boundary changed; refresh its mechanism record', { details: { file: part.file, symbols: part.symbols } });
  return { file: part.file, symbols: part.symbols, preamble: source.slice(0, source.indexOf('\n\n')), startLine: source.slice(0, start).split('\n').length,
    endLine: source.slice(0, Math.max(start, end - 1)).split('\n').length, source: source.slice(start, end), ...(part.context ? { context: part.context } : {}) };
}
export function inspectMechanism(ref, sections = ['overview', 'contract', 'example']) {
  const entry = entries.find(e => e.id === ref.id);
  if (!entry) throw new LabError('RESOURCE_NOT_FOUND', `Unknown library mechanism '${ref.id}'`, { recovery: { tool: 'fx_search', arguments: { query: '裂纹' } } });
  const doc = readFileSync(documentation, 'utf8').split(`## ${entry.id}\n`)[1]?.split(/\n## /)[0];
  const sourceFiles = Object.fromEntries([...new Set(entry.fragments.map(p => p.file))].map(file => [file, readFileSync(join(ROOT, file), 'utf8')]));
  const revision = digestOf({ entry, doc, sourceFiles });
  if (ref.revision && ref.revision !== revision) throw new LabError('REVISION_CONFLICT', 'Library mechanism changed', { details: { expected: ref.revision, actual: revision } });
  const result = { ...summary(entry), ref: { kind: 'mechanism', id: entry.id, revision }, documentation, sections: {},
    status: entry.callable ? 'Calls existing library helpers; not a new validated SDK operator.' : 'Reference effect fragment; private functions are not independently importable.',
    attribution: 'Athanor MIT. Sprite Fusion / Hugo Duprez attribution remains in original adapted modules; retain their notices when adapting code.' };
  for (const section of sections) {
    if (section === 'reuse') result.sections.reuse = { modules: Object.keys(sourceFiles).map(file => ({ file, symbols: [...new Set(entry.fragments.filter(p=>p.file===file).flatMap(p=>p.symbols))] })), operators: entry.operators ?? [], replaceable: entry.replaceable ?? [], invariants: entry.invariants ?? [], workflow: 'Import the mature helper or its listed SDK adapter. Keep births/geometry as one shared source; change only the chosen material/layout/clock. Render and compare frozen versions; no whole-preset copy is required.' };
    else if (section === 'source') result.sections.source = entry.fragments.map(p => fragment(p, sourceFiles[p.file]));
    else if (section === 'dependencies') result.sections.dependencies = Object.entries(sourceFiles).map(([file, source]) => ({ file, revision: digestOf(source), imports: moduleImports({ [file]: source })[file], note: 'Actual immediate static imports, not a copied dependency closure. Import the original module in this checkout.' }));
    else if (section === 'provenance') result.sections.provenance = { files: Object.keys(sourceFiles).map(file => ({ file, revision: digestOf(sourceFiles[file]) })), references: entry.references, extraction: 'Verbatim bounded library-source fragments. The mature ice walk is shared in core/branching.js; inspect core/propagation separately for the validated SDK contract.' };
    else result.sections[section] = doc?.split(`### ${section}\n`)[1]?.split(/\n### /)[0]?.trim() ?? { available: false, reason: 'Section not registered for this library mechanism' };
  }
  return result;
}
