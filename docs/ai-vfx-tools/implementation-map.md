# 实现与复用入口

本文用于定位代码，按当前问题展开。公开调用查[API](authoring-api.md)与[工具入口](tool-contracts.md)；资产目录与输出边界见[资产规范](../ASSETS.md)。

## 代码分层

| 层 | 主要位置 | 什么时候读 |
| --- | --- | --- |
| 成熟作品与 helper | [src/fx](../../src/fx)、[目录](../CATALOG.md)、[机制契约](library-mechanisms.md) | 新建能力前先找已有算法；正式条目可通过 inspect source/provenance 看实际作品依赖 |
| 像素与旧运行时 | [src/core](../../src/core) | 绘制/合成、旧粒子/模拟、骨架与表演的兼容边界 |
| 可组合创作 SDK | [src/authoring](../../src/authoring) | 路径、粒子、源、表面、状态与因果等公共计算；先查公开签名再读相关实现 |
| 工具契约与发现 | [definitions](../../experiments/vfx-lab/definitions.mjs)、[discovery](../../experiments/vfx-lab/discovery.mjs)、[contracts](../../experiments/vfx-lab/contracts.mjs)、[mechanisms](../../experiments/vfx-lab/mechanisms.mjs) | 输入/输出、按需查询、API/原库机制登记 |
| 局部复用与交接 | [reuse](../../experiments/vfx-lab/reuse.mjs)、[evidence](../../experiments/vfx-lab/evidence.mjs) | 真实库依赖/导出/机制映射；复用journal调用、原错误、原图与导出生成同run哈希索引，不重渲染 |
| 求值、冻结与记录 | [lab](../../experiments/vfx-lab/lab.mjs)、[replay](../../experiments/vfx-lab/replay.mjs)、[source-parser](../../experiments/vfx-lab/source-parser.mjs)、[assets](../../experiments/vfx-lab/assets.mjs)、[journal](../../experiments/vfx-lab/journal.mjs) | 当前与冻结目标、资源闭包、选版/调用身份、缺源恢复 |
| 观察与交付 | [probe](../../experiments/vfx-lab/probe.mjs)、[observation](../../experiments/vfx-lab/observation.mjs)、[boundary](../../experiments/vfx-lab/boundary.mjs)、[animation](../../experiments/vfx-lab/animation.mjs)、[asset-pack](../../experiments/vfx-lab/asset-pack.mjs) | 原尺寸窗口、真实对象、边界诊断、媒体与资产封装 |
| 正式收录 | [library](../../experiments/vfx-lab/library.mjs)、[registry](../../tools/lib/registry.mjs) | 冻结作品重定位、逐帧同图、批准范围、索引更新与恢复 |
| 独立游戏消费 | [src/playback](../../src/playback) | 无工作台依赖的实例、事件、图层与资产加载 |

## 按机制找起点

| 当前创作问题 | 已有入口 | 成熟实现来源举例 |
| --- | --- | --- |
| 火、烟、火花与爆炸 | material.lobe/cloud/fire等；library/explosion-lobes、merged-smoke | explosions/_lib.js、small-explosion.js、smoke-bomb.js、projectiles/_lib.js、rocket.js；实际库模块可公开inspect reuse/source |
| 路径、条带、拖尾与到达 | path、trail、particle.track、propagation、gather | core/shapes、原弹道/裂纹/内收实现 |
| 目标表面、动作与状态 | body、action、surface、combat、status | core/rig/act、status/ice 的材质与轮廓实现 |
| 刀光、束流、蓄力与阶段 | skill、action 时钟、源与事件 | melee/_lib、arcane-beam、spell-charge、core/chain |
| 贯穿、折射、反射与电链 | ray、arc | 成熟电弧笔触及显式几何/因果连接；范围见 API |
| 自有素材与可追溯改稿 | assets、texture、mask、surface、history | 既有 PNG 解码/贴图、冻结闭包和独立交付模块 |

提炼时记录具体来源、保留的行为、适配/新增的部分和署名。第二基石的固定构建与机制对照见[研究入口](../../experiments/vfx-lab/research/tsnm-spine-particle/README.md)，不重建其人类编辑器。既有算法和新计算分别验证；能力边界和创作可用性由对应证据说明。

完整 legacy act、任意蒙皮/碰撞或目标引擎适配不从这张地图推断已经完成。研发者可读实现；独立创作者只按其公开阅读范围实作。

## 最近作品的实现参考

火球/连续烟体/像素风的代码关系见`src/fx/studies/` 的当前源码。其中共同冷却表面、烟流、像素网格与跨时钟组合仍是作品私有实现；调查重复负担时可读，不作为已交付通用算子。
