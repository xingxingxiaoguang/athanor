# 研发接手

更新：2026-11-09。分支 `codex/ai-vfx-lab-mvp`。面向下一位研发者；黑盒创作者只从[公开创作者指南](../../experiments/vfx-lab/README.md)开始。

## 先读什么

1. 仓库 [AGENTS](../../AGENTS.md)：两大实现基石、独立创作者门、已有用户授权；有 .codegraph 才使用 CodeGraph。
2. [当前状态](implementation-status.md)：已交付能力、当前作品与正式库的区别。
3. [后续路线](ROADMAP-PIXEL-GAMES.md)：下一处具体负担和验收条件。之后只读任务需要的契约、代码和证据。

本实验分支以 AI 创作工具能力为主线。普通 JS、自由造型和作者判断继续开放；人类 GUI、流程整理或性能指标不替代创意自由、顺手程度与具体组合帮助。

## 这次交到哪里

工具/SDK 停在 **1.3.0**：成熟 helper 发现、lobe/cloud 局部适配及同 run 证据交接已完成独立原创与修复补测。原件从[历史里程碑](history/milestones/MILESTONE-1.3.md)按需读取。

随后完成火球、连续烟体、火烟耦合、有机轮廓与 grenade 风格适配。这一串是作品制作，没有新增公共工具能力。当前爆炸工作母版是 **Grenade 像素版**，独立烟体是 **DRIFT像素短尾版（2026-11-09）**，持久入口分别是 `lab/fireball-master`、`lab/smoke-master`。烟体先补不规则体积与遮叠，再按反馈弱化拉丝、将4秒收为2.8秒，以3px/5色块面增强像素语言；各版保留，火球内烟副本未同步。源文件、版本链、反馈/收录状态及交付见[生产索引](../../experiments/vfx-lab/productions/README.md)。两个最新版均已交付待各自明确美术反馈，未正式收录。

```sh
node experiments/vfx-lab/cli.mjs render '{"id":"lab/fireball-master","fps":30,"background":"black"}'
node experiments/vfx-lab/cli.mjs render '{"id":"lab/smoke-master","fps":30,"background":"black"}'
```

这两个入口随 Git 保存；`draft/*` 别名、原始 run 和 localhost 服务不会因克隆自动恢复。用新返回的 run 做 probe/validate/export。本机默认 Node 22 有动态库故障，可用 Node 24 路径与编码器配置见[环境说明](ENVIRONMENT.md)。

## 下一位先处理什么

按[路线](ROADMAP-PIXEL-GAMES.md)优先调查**可编辑源码交付的重复工程**：本轮多件母版仍手写依赖重定位、core/helper 复制、独立渲染入口和逐帧像素核对。先确认现有冻结闭包/导出能覆盖哪一段，再决定是否补公共能力。不要先把艺术专用烟流、像素网格或时钟曲线整体搬进 SDK。

修改当前母版前，按[作品接手记录](../../experiments/vfx-lab/productions/history/2026-11-08-fireball-smoke.md)查共同冷却表面、烟源、独立辅助时钟和像素网格。改几何会改变供烟，改变时钟会改变火烟交接；原版本和失败报告保留。

## 需要时再读

| 问题 | 材料 |
| --- | --- |
| 调用、诊断与恢复 | [契约入口](tool-contracts.md)、单工具 tools/inspect |
| 公共计算与实现位置 | [SDK API](authoring-api.md)、[实现地图](implementation-map.md) |
| 提炼成熟行为 | 原效果/helper/core、[参考平台研究](../../experiments/vfx-lab/research/tsnm-spine-particle/README.md) |
| 正式收录或已有批准 | [入库契约](library-installation.md)、作品的准确批准范围；不重复索要既有授权 |
| 功能波验收 | [独立创作者规范](creator-evaluation.md)及 AGENTS；新隔离构建、新上下文、公开入口、原图局改、同 run 交付 |
| 历史决定与本次检查 | [历史索引](history/README.md)、[本次交接核对](history/checkpoint-2026-11-08.md) |

重要且无法判断的路线抉择才做独立 A/B 探路；确认问题的修复单独补测，原报告不改。交接只更新当前状态、下一问题和索引，不把版本日志重新堆回热区。
