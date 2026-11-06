import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { digestOf } from "./replay.mjs";
import { LabError } from "./errors.mjs";

const documentation = fileURLToPath(new URL("../../docs/ai-vfx-tools/authoring-api.md", import.meta.url));
const entries = [
  ["painter", "Local pixel drawing, shapes, soft alpha, Bayer coverage, masks and separate additive light", "绘制 像素 形状 透明 抖动 光 circle line glow mask shade", "../../src/core/painter.js"],
  ["color", "Color32 conversion, palette resampling and color ramps", "颜色 色带 调色板 空画面 hex rgb ramp fit palette", "../../src/core/color.js"],
  ["clock", "Fixed 120 Hz simulation, exact pure time and sampling clocks", "时钟 时间 固定步长 重放 tick fps dt", "./clock.js"],
  ["effect", "Editable module interface, options, events, origin and ending policies", "作品 入口 坐标 原点 结束 残留 meta draw create options", "../../src/core/fx.js"],
  ["path", "Arc-length paths, adaptive cubic curves, tangents and continuous editable strips", "路径 轨迹 弧长 刀光 头尾 条带 拖尾 ribbon strip bezier tangent", "../../src/authoring/path.js"],
  ["random", "Stable named random channels that preserve unrelated particle attributes", "随机 通道 种子 身份 stable seed channel", "../../src/authoring/random.js"],
  ["curve", "Typed curves, one-sided analytic derivatives and composable sum/product/affine envelopes", "曲线 导数 速度 单侧 乘积 包络 插值 生命周期 色带 颜色 age envelope width color ramp gradient derivative affine combine", "../../src/authoring/curve.js"],
  ["domain", "Identity-stable sampling of points, sectors, circles, rectangles, paths and weighted masks", "采样 出生 区域 边界 密度 圆盘 扇形 固定点 均匀 sampling density point sector", "../../src/authoring/domain.js"],
  ["schedule", "Stable burst/rate/resident/cycle birth records including overlapping loop copies", "排期 发射 出生 生命周期 常驻 周期 burst rate resident cycle alive loop", "../../src/authoring/schedule.js"],
  ["motion", "Reusable source trajectories and actual source observations, arc-length following and analytic/fixed-tick motion", "运动 源轨迹 源观测 源状态 移动源 源速度 速度继承 角速度 导数 停顿 反向 折点 数值差分 弹道 重力 阻力 跟随 汇聚 径向 切向 力场 source pathSource sampledSource observeSource angularVelocity velocity ballistic along integrate radial attract force vortex", "../../src/authoring/motion.js"],
  ["mask", "Programmatic/polygon masks, boolean composition, outlines and actual interval change regions", "遮罩 轮廓 区域 差分 变化 多边形 凹 polygon make derive combine outline change", "../../src/authoring/mask.js"],
  ["field", "Typed scalar/noise/rank/first-arrival fields with explicit spaces and units", "场 噪声 排序 到达 传播 消融 noise rank arrival", "../../src/authoring/field.js"],
  ["image", "Dissolve keep/edge/change masks, first-arrival particle births and checked mask drawing", "图像 消融 边缘 衍生 粒子 着色 dissolve change birth", "../../src/authoring/image.js"],
  ["light", "Separate additive light derived from the same reusable source/edge mask", "光 发光 边缘 遮罩 additive fromMask", "../../src/authoring/light.js"],
  ["texture", "Straight RGBA/ASCII/atlas textures, pivots, lifetime or FPS sequences and transformed nearest-pixel drawing", "贴图 精灵 序列 纹理 帧 轴心 旋转 图片 rgba ascii sheet sequence pivot tint blend", "../../src/authoring/texture.js"],
  ["particle", "Composable emitters, source-trajectory/rotating-point velocity inheritance, lifecycle materials and declared observations", "粒子 发射 移动源 源速度 速度继承 属性 生命周期 运动 贴图 继承 观测 身份 emitter sample draw observe probe material texture lifetime", "../../src/authoring/particle.js"],
  ["material", "Reusable library implementations: cooling fire, layered soft smoke, embers, velocity-facing sparks/motes/streaks, water drops and ripples", "材质 火焰 烟雾 余烬 火花 尾迹 像素 复用 库 水滴 涟漪 cooling fire smoke ember spark mote streak waterDrop ripple", "../../src/authoring/material.js"],
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
  const result = { ref: { kind: "operator", id: ref.id, revision }, summary: entry[1], maturity: "implemented", callable: true, documentation, import: ref.id === "core/clock" ? "experiments/vfx-lab/clock.js" : entry[3].includes("/authoring/") ? "src/authoring/index.js" : "src/core/index.js", sections: {} };
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
