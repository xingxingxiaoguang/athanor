// Concise discovery derives exact contracts from the same definitions as MCP.
import { TOOLS, validateInput } from './definitions.mjs';
import { LabError } from './errors.mjs';
import { digestOf } from './replay.mjs';

const summaries = {
  fx_library: '从明确选定的冻结run规划入库、逐帧核对，按批准范围收录；检查与恢复中断事务。',
  fx_search: '查找作品、库内机制、配方与SDK契约。',
  fx_inspect: '读取契约、作品实际helper依赖/导出、可替换机制与参考源码。',
  fx_scaffold: '建立可自由编辑的普通JavaScript草稿。',
  fx_render: '渲染当前作品或明确重放冻结run，保存色光与身份。',
  fx_compare: '按事件、时刻或窗口比较冻结版本的原尺寸图像。',
  fx_probe: '读取保存图像窗口及已声明粒子、源、接触、历史状态。',
  fx_validate: '检查确定性、时钟、边界与结束，不评价美感。',
  fx_history: '恢复版本/原错误，明确选版；bundle汇集同run证据与交付。',
  fx_export: '从同一选定run交付图集及可选完整MP4/GIF。',
};
const catalogSchema = { name: 'tools', inputSchema: { type: 'object', additionalProperties: false, properties: {
  name: { type: 'string', description: 'One tool name, with or without fx_.' },
  detail: { type: 'string', enum: ['summary', 'full'] },
} } };
const brief = tool => ({ name: tool.name, summary: summaries[tool.name] });
function findTool(name) {
  const canonical = name.startsWith('fx_') ? name : `fx_${name}`;
  const tool = TOOLS.find(t => t.name === canonical);
  if (!tool) throw new LabError('RESOURCE_NOT_FOUND', `Unknown tool '${name}'`, { path: 'arguments.name', recovery: { tool: 'fx_inspect', arguments: { ref: { kind: 'tool', id: 'catalog' } } } });
  return tool;
}
export function toolCatalog(args = {}) {
  validateInput(catalogSchema, args);
  const tools = args.name === undefined ? TOOLS : [findTool(args.name)];
  const detail = args.detail ?? (args.name === undefined ? 'summary' : 'full');
  const focus = args.name === undefined ? 'fx_probe' : tools[0].name;
  // Explicit all/full preserves the historical raw array for existing consumers.
  if (detail === 'full' && args.name === undefined) return TOOLS;
  return { kind: 'tool-catalog', detail, tools: detail === 'full' ? tools : tools.map(brief),
    contractLookup: { tool: 'fx_inspect', arguments: { ref: { kind: 'tool', id: focus } } },
    cli: { one: `tools '${JSON.stringify({ name: focus })}'`, all: `tools '{"detail":"full"}'` },
    note: 'Single-tool definitions are exact executable schemas. MCP tools/list remains the full standard list.' };
}
export function inspectTool(ref, sections, detail) {
  const target = ref.id === 'catalog' ? TOOLS : findTool(ref.id);
  const revision = digestOf(target);
  if (ref.revision && ref.revision !== revision) throw new LabError('REVISION_CONFLICT', 'Tool contract changed', { details: { expected: ref.revision, actual: revision } });
  if (ref.id === 'catalog') return { ...toolCatalog(), ref: { kind: 'tool', id: 'catalog', revision },
    ...(detail === 'full' ? { tools: TOOLS, detail: 'full' } : {}) };
  const requested = sections ?? ['overview', 'contract'];
  return { ref: { kind: 'tool', id: target.name, revision }, sections: {
    ...(requested.includes('overview') ? { overview: brief(target) } : {}),
    ...(requested.includes('contract') ? { contract: target } : {}),
  }, unavailableSections: requested.filter(s => !['overview', 'contract'].includes(s)),
  next: 'Call the tool with its inputSchema. Unknown fields are rejected; use history to recover original errors.' };
}
