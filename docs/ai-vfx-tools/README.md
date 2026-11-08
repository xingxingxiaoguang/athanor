# AI 像素特效工作台

面向能写普通 JavaScript、调用公开工具并观察原尺寸图像的 AI 创作者。特效库既是作品，也是成熟算法来源；工具负责可组合计算、观察、改稿和交付，作者负责形状、材质与审美取舍。

## 按任务进入

| 当前任务 | 入口 | 需要时再展开 |
| --- | --- | --- |
| 接手研发 | [HANDOFF](HANDOFF.md) | [当前状态](implementation-status.md) → [下一问题](ROADMAP-PIXEL-GAMES.md) |
| 制作或修改作品 | [创作者指南](../../experiments/vfx-lab/README.md) | [作品索引](../../experiments/vfx-lab/productions/README.md)、具体作品说明、工作流 |
| 调用工具或机制 | [契约入口](tool-contracts.md) | tools/inspect 的单个定义；[SDK API](authoring-api.md)按节查询 |
| 定位实现与复用来源 | [实现地图](implementation-map.md) | 相关原效果、helper/core 与两大基石研究 |
| 验收工具改动 | [独立创作者规范](creator-evaluation.md) | 对应实验原报告、构建与分离补测 |
| 追问设计或历史 | [设计资料](design/README.md) / [历史索引](history/README.md) | 原里程碑和历史快照；不是当前待办 |
| 运行失败或缺媒体编码器 | [环境说明](ENVIRONMENT.md) | 按实际错误恢复 |

## 文档维护：按需披露、冷热分离

热区只维护当前事实、下一行动和查阅入口：本文、HANDOFF、当前状态、路线。契约、API、作品说明按具体问题展开。已完成节点、逐轮测试数字、run/构建摘要、原错误与长研究进入历史或实验目录，不再追加到冷读链路。

- 能力与收录状态只在[当前状态](implementation-status.md)汇总，优先级只在[路线](ROADMAP-PIXEL-GAMES.md)维护。
- 精确调用以可执行定义为准；文档给入口和关键语义，不复制完整 Schema。
- 当前作品由[生产索引](../../experiments/vfx-lab/productions/README.md)指向。版本链、审批边界和交付身份留在作品记录，作品交付不自动成为工具里程碑或正式收录。
- 已完成里程碑正文放 history/milestones；旧路径仅跳转。原测评报告、原错误、历史快照及其摘要保留；删除热区的重复计数和过期待办，不回写旧结论。
- ignored records/drafts 属于本机工作材料。干净克隆从持久源码生成新 run，不沿用旧 validationRef；可移出仓库的交付以作品 ZIP 为准。
