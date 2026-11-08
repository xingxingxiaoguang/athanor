import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { digestOf } from "./replay.mjs";
import { LabError } from "./errors.mjs";

const documentation = fileURLToPath(new URL("../../docs/ai-vfx-tools/authoring-api.md", import.meta.url));
const entries = [
  ["assets", "Declared local PNG/atlas/frame resources, raw byte identities, pivots and frozen replay without the original files", "asset import resource image png atlas sequence sprite mask alpha 素材 外部 图片 导入 图集 序列 资源 冻结 遮罩 PNG", "./assets.mjs"],
  ["ray", "Finite declared 2D beam intersections, penetration, reflection/refraction and distance-linked hit facts", "射线 激光 贯穿 反射 折射 弹跳 碰撞 镜面 俯视 ray trace reflect refract segment circle box beam penetration", "../../src/authoring/ray.js"],
  ["arc", "Reusable mature electrical branches, moving graph links, leader travel and real arrival facts", "闪电 电弧 电球 闪电链 球形 特斯拉 分叉 电击 lightning tesla arc bolt chain branch network leader", "../../src/authoring/arc.js"],
  ["playback", "Standalone exported asset loading, exact instance timing/events and color plus additive scene composition", "游戏 资产 消费 实例 图集 轴心 时间 事件 循环 尾部 引擎 中立 交付 playback pack load instance atlas pivot loop tail engine", "../../src/playback/index.js"],
  ["gather", "Known-track endpoint arrivals, pure weighted accumulation and author-defined body response", "汇入 吸收 累计 沉积 碎片 身体 增长 到达 冲拳 gather arrival accumulation weight absorb endpoint body", "../../src/authoring/gather.js"],
  ["status", "Explicit apply/refresh/remove presentation lifecycles, phase-preserving/restarting births and material/body state channels", "status buff debuff apply refresh remove lifecycle tail heat flame 状态 增益 减益 施加 持续 刷新 解除 生命周期 尾部 身体 材质 环绕", "../../src/authoring/status.js"],
  ["skill", "Editable stage intervals/cancellation, mature slash head-tail, path beam bands and attached charge infall/rings", "skill sequence phase stage cue cancel slash beam charge infall head tail 技能 阶段 取消 释放 刀光 束流 蓄力 内收 头尾 持续 退场", "../../src/authoring/skill.js"],
  ["combat", "Shared external hit snapshots, brightness tint, replaceable pixel text/number flight and impact parts", "combat damage critical crit hit hurt block parry skill feedback 伤害 暴击 命中 受击 闪白 伤害数字 伤害文字 格挡 防御 技能 战斗", "../../src/authoring/combat.js"],
  ["surface", "Material surface masks, silhouette features, held-bone attachment, crack arrival/erosion and frozen departure births", "material surface skin body coating crack frost dissolve mask 身体表面 表面 身体特征 材质坐标 骨段 裂纹 结霜 消融 脱离 碎裂", "../../src/authoring/surface.js"],
  ["action", "Pure action clocks with hitstop, held rig poses, shared drawing/joint sources and explicit birth retiming", "动作 角色 骨骼 骨架 挂点 手部 武器 姿态 停顿 时间 跳转 翻转 action actor rig skeleton joint hand weapon pose hitstop hold seek flip clock retime", "../../src/authoring/action.js"],
  ["body", "Shared program-body transforms, named attachments with real point velocity, depth order and declared frozen observations", "主体 程序主体 物体 变换 挂点 附着 缩放 旋转 深度 观察 状态 body transform anchor attachment scale rotation depth observe", "../../src/authoring/body.js"],
  ["orbit", "Projected rings sharing a body, exact near/far seams and emitter trajectories from the same points", "光环 轨环 环绕 轨道 主体 共同中心 共同投影 近远 投影 扩张 缩小 渐隐 速度 发射 ring halo orbit projection near far radius roll emitter velocity", "../../src/authoring/orbit.js"],
  ["propagation", "Inherited branch distance, stable spaced sites, monotone front arrival and secondary births", "分叉 裂纹 裂痕 距离 传播 到达 取样 间距 生长 退场 衍生 次级 branch fracture crack distance propagation sites arrival growth retreat secondary births", "../../src/authoring/propagation.js"],
  ["painter", "Local pixel drawing, shapes, soft alpha, Bayer coverage, masks and separate additive light", "绘制 像素 形状 透明 抖动 光 circle line glow mask shade", "../../src/core/painter.js"],
  ["color", "Color32 conversion, palette resampling and color ramps", "颜色 色带 调色板 空画面 hex rgb ramp fit palette", "../../src/core/color.js"],
  ["clock", "Fixed 120 Hz simulation, exact pure time and sampling clocks", "时钟 时间 固定步长 重放 tick fps dt", "./clock.js"],
  ["effect", "Editable module interface, output viewport/asset bounds, options, events, origin and ending policies", "作品 入口 坐标 原点 结束 残留 视口 裁切 越界 边界 viewport crop bounds asset meta draw create options", "../../src/core/fx.js"],
  ["path", "Arc-length paths, adaptive cubic curves, tangents and continuous editable strips", "路径 轨迹 弧长 刀光 头尾 条带 拖尾 ribbon strip bezier tangent", "../../src/authoring/path.js"],
  ["random", "Stable named random channels that preserve unrelated particle attributes", "随机 通道 种子 身份 stable seed channel", "../../src/authoring/random.js"],
  ["curve", "Typed curves, one-sided analytic derivatives and composable sum/product/affine envelopes", "曲线 导数 速度 单侧 乘积 包络 插值 生命周期 色带 颜色 age envelope width color ramp gradient derivative affine combine", "../../src/authoring/curve.js"],
  ["domain", "Identity-stable sampling of points, sectors, circles, rectangles, paths and weighted masks", "采样 出生 区域 边界 密度 圆盘 扇形 固定点 均匀 sampling density point sector", "../../src/authoring/domain.js"],
  ["schedule", "Stable birth records, overlapping cycles and matched end-time/lifetime joins", "排期 发射 出生 生命周期 常驻 周期 寿命 退场 关联 burst rate resident cycle alive loop until match lifetime retire", "../../src/authoring/schedule.js"],
  ["motion", "Reusable source trajectories and actual source observations, arc-length following and analytic/fixed-tick motion", "运动 源轨迹 源观测 源状态 移动源 源速度 速度继承 角速度 导数 停顿 反向 折点 数值差分 弹道 重力 阻力 跟随 汇聚 径向 切向 力场 source pathSource sampledSource observeSource angularVelocity velocity ballistic along integrate radial attract force vortex", "../../src/authoring/motion.js"],
  ["mask", "Programmatic/polygon masks, boolean composition, outlines and actual interval change regions", "遮罩 轮廓 区域 差分 变化 多边形 凹 polygon make derive combine outline change", "../../src/authoring/mask.js"],
  ["field", "Typed scalar/noise/rank/first-arrival fields with explicit spaces and units", "场 噪声 排序 到达 传播 消融 noise rank arrival", "../../src/authoring/field.js"],
  ["image", "Dissolve keep/edge/change masks, first-arrival particle births and checked mask drawing", "图像 消融 边缘 衍生 粒子 着色 dissolve change birth", "../../src/authoring/image.js"],
  ["light", "Separate additive light derived from the same reusable source/edge mask", "光 发光 边缘 遮罩 additive fromMask", "../../src/authoring/light.js"],
  ["texture", "Straight RGBA/ASCII/atlas textures, pivots, lifetime or FPS sequences and transformed nearest-pixel drawing", "贴图 精灵 序列 纹理 帧 轴心 旋转 图片 rgba ascii sheet sequence pivot tint blend", "../../src/authoring/texture.js"],
  ["particle", "Composable emitters, source-trajectory/rotating-point velocity inheritance, lifecycle materials and declared observations", "粒子 发射 移动源 源速度 速度继承 属性 生命周期 运动 贴图 继承 观测 身份 emitter sample draw observe probe material texture lifetime", "../../src/authoring/particle.js"],
  ["material", "Reusable library implementations: cooling fire/lobes, merged density clouds, embers, sparks, water and ripples", "材质 火焰 火团 烟雾 烟云 蒸汽 合并 冷却 余烬 火花 尾迹 像素 复用 库 水滴 涟漪 cooling fire smoke ember spark mote streak waterDrop ripple firePuff smokePuff lobe fireBall cloud density", "../../src/authoring/material.js"],
  ["trail", "Reconstructible sampled history, time/pixel length trimming, death fade and editable continuous bands", "历史 拖尾 尾迹 反弹 折返 轨迹 停留 消散 条带 history trail ribbon wake arc length pixels seconds", "../../src/authoring/trail.js"],
  ["contact", "Analytic floor arrival, stable bounce/settle/kill contact events and idempotent secondary births", "接触 碰撞 落地 反弹 停留 二次发射 衍生 水滴 涟漪 事件 身份 去重 floor contact collision bounce impact landing event secondary births ripple", "../../src/authoring/contact.js"],
];

export function apiResources(query = "") {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(([name, summary, aliases]) => words.every((w) => `core/${name} ${summary} ${aliases}`.toLowerCase().includes(w))).map(([name, summary]) => ({ ref: { kind: "operator", id: `core/${name}` }, summary, maturity: "implemented", callable: true, contract: "fx_inspect", match: "Matches registered API name, summary or aliases" }));
}

export function inspectApi(ref, sections = ["overview", "contract", "example"]) {
  const entry = entries.find(([name]) => ref.id === `core/${name}`);
  if (!entry) throw new LabError("RESOURCE_NOT_FOUND", `Unknown authoring API '${ref.id}'`, { recovery: "Search the creative mechanism or API family, then inspect the returned operator ref." });
  const doc = readFileSync(documentation, "utf8").split(`## ${ref.id}\n`)[1]?.split(/\n## /)[0];
  const sourceFile = fileURLToPath(new URL(entry[3], import.meta.url)), source = readFileSync(sourceFile, "utf8");
  const revision = digestOf({ doc, source });
  if (ref.revision && ref.revision !== revision) throw new LabError("REVISION_CONFLICT", "Authoring API revision changed", { details: { expected: ref.revision, actual: revision } });
  const result = { ref: { kind: "operator", id: ref.id, revision }, summary: entry[1], maturity: "implemented", callable: true, documentation, import: ref.id==='core/playback'?'Exported playback.mjs + load-node.mjs, or athanor/playback (+ athanor/playback/node)':ref.id==='core/assets'?'Declare assets in the effect module; textures arrive in options.assets':ref.id === "core/clock" ? "experiments/vfx-lab/clock.js" : entry[3].includes("/authoring/") ? "src/authoring/index.js" : "src/core/index.js", sections: {} };
  for (const section of sections) {
    if (section === "source") result.sections.source = { file: sourceFile, source };
    else if (section === "provenance") result.sections.provenance = { sourceFile, revision, evidence: "Repository implementation plus independent creator case studies in docs/ai-vfx-tools/creator-evaluation.md; inspect those records for actual scope, not all family variants have independent coverage" };
    else {
      const text = doc?.split(`### ${section}\n`)[1]?.split(/\n### /)[0]?.trim();
      result.sections[section] = text ?? { available: false, reason: "Not registered for this API" };
    }
  }
  return result;
}

export const authoringContract = () => ({
  version: 1, documentation,
  resources: apiResources().map((r) => r.ref),
  color: "Painter requires Color32 integers (RGBA bytes); use hex() or fit(). CSS strings are not accepted by drawing methods.",
  coordinates: "Local art pixels; +x right, +y down; origin placed by lab; angles in radians.",
  time: "Non-negative effect seconds; pure exact time, simulated fixed 120 Hz with actual sample times recorded.",
  next: { tool: "fx_inspect", arguments: { ref: { kind: "operator", id: "core/painter" } } },
});
