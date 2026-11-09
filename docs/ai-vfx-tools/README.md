# AI VFX 工具

特效源码与算法是资产，观察和交付从源码生成。最新仓库组织见 [资产规范](../ASSETS.md)。

| 任务 | 入口 |
| --- | --- |
| 制作、修改或交付 | [公开创作者指南](../../experiments/vfx-lab/README.md) |
| 查找资产和依赖 | `npm run assets -- list` / `inspect <id>` |
| 研发接手 | [HANDOFF](HANDOFF.md) |
| API 与可组合机制 | [公开 API](authoring-api.md)、[机制地图](library-mechanisms.md) |
| 工具调用与恢复 | [工具契约](tool-contracts.md)、[入库事务](library-installation.md) |
| 验收 | [独立创作者规范](creator-evaluation.md) |
| 环境 | [ENVIRONMENT](ENVIRONMENT.md) |

仓库只保存源码、必要原始资源、署名和轻量文档。旧生产迭代、历史快照、测评原始输出及媒体不再进入 Git；既往提交在清理前已另存仓库外恢复 bundle。
