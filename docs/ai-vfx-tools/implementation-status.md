# 当前状态

核对日期：2026-11-09。此页集中维护当前事实；优先级见[路线](ROADMAP-PIXEL-GAMES.md)，调用参数以可执行定义和[公开 API](authoring-api.md)为准。

## 可以从这里开始工作

代码版本为 1.3.0。现有10个公开工具覆盖查找/检查、建稿、冻结渲染、原尺寸观察/比较、技术验证、历史/选版、证据交接、导出和正式收录。创作使用普通 JS，兼容 draw 与 create 两类效果；可继续自画形状、材质和编排。

| 能力 | 当前可用范围 |
| --- | --- |
| 查找与复用 | 原函数名、作品实际静态库依赖/导出、机制可替换输入/契约及原helper源码；正式条目可读来源。不是通用装配图或实际生效算子推断 |
| 几何、材质与运动 | 路径/连续条带、稳定随机/排期、粒子与纹理/材质、原库分瓣冷却lobe与整批密度cloud、源速度继承、有限接触、分叉传播和真实历史 |
| 主体、动作与因果 | body/orbit/action/surface，共享变换/挂点、2D 材质表面、实际 IK 子集；combat/skill/status/gather 连接外部事实、阶段、刷新/解除、到达与累计 |
| 光学与电弧 | 有限 2D 贯穿/反射/折射/全反射光路、自由电链图及真实路径/到达观察 |
| 资产与冻结 | 明确声明的本地 PNG/序列/规则图集；JS/资源/选项随 run 保存，缺稿后按保存后端重放 |
| 观察与交付 | 保存色层/加法光层、原尺寸窗口、真实对象/调用；同run图集、可选媒体、独立消费包；history bundle汇集原错误/各稿原图/验证/导出和作者说明，逐文件SHA、明确观看声明 |
| 正式入库 | library 的计划/逐帧对照、源码和 PNG 搬运、批准范围核对、索引更新、状态检查及中断恢复 |

## 生产状态

| 范围 | 当前事实 | 按需记录 |
| --- | --- | --- |
| 正式库 | 293 个效果、22 个分类；其中九类俯视武器49分件已按用户批准收录，另五类19分件待审批 | [收录记录](../../experiments/vfx-lab/productions/2026-11-07-arsenal/library-installation.json)、[武器说明](../../experiments/vfx-lab/productions/2026-11-07-arsenal/README.md) |
| 当前爆炸工作母版 | Grenade 像素版，`lab/fireball-master`；已交付，未收到该版明确美术反馈，未正式收录 | [生产索引](../../experiments/vfx-lab/productions/README.md) |
| 独立烟体母版 | DRIFT像素短尾版，`lab/smoke-master`；不规则体积基础上弱化拉丝、加速至2.8秒、3px/5色块面，已交付待本版反馈，未正式收录；前版保留 | [烟雾说明](../../experiments/vfx-lab/productions/2026-11-09-smoke-pixel/README.md) |

本轮火球/烟雾改稿只新增作品，不提升 SDK/工具版本。作者选版、技术通过、用户美术反馈与正式库收录是不同状态。

## 明确边界

- 引擎中立资产消费已有独立实作，尚无具体 Godot/Unity 等目标项目导入认证。
- 任意蒙皮、动态遮挡/移动碰撞、通用刚体、向量场/UV 光带、任意 Spine 或网络资源不属于已认证的通用能力。
- lab 的输出视口和求值约定不能自动推广为旧库运行时或目标引擎行为。
- validate 是采样技术检查；工具交图、实际观看、媒体解码和审美批准分别记录。逐帧交付对照只覆盖保存时刻及选定参数。
- 母版中的连续烟流、共同像素网格和快攻慢放曲线仍是作品私有实现，尚无通用 API/独立功能门结论。

## 完成依据

工具1.3的独立基线、复杂原创、缺口修复和分离补测见[里程碑](history/milestones/MILESTONE-1.3.md)及[原始实验](../../experiments/vfx-lab/evaluations/2026-11-08-local-reuse/README.md)。更早节点从[历史索引](history/README.md)查询，旧待办不重启。

最近作品的源码/固定身份、实际观看范围、原失败和交付对照见[作品接手记录](../../experiments/vfx-lab/productions/history/2026-11-08-fireball-smoke.md)。本次提交前的技术与干净快照检查独立记录在[交接核对](history/checkpoint-2026-11-08.md)，不回填为旧里程碑验收。

2026-11-09独立烟体的社区参考、五版体积取舍保留在[体积轮廓版](../../experiments/vfx-lab/productions/2026-11-09-smoke-volume/README.md)，后续弱拉丝/快速消散的选版和交付核对见[像素短尾版](../../experiments/vfx-lab/productions/2026-11-09-smoke-pixel/README.md)。这是作品制作，不改变1.3工具功能门结论。
