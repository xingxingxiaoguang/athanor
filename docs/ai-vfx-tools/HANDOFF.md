# 研发接手

更新：2026-11-09。本轮完成资产与 Git 组织整理，未修改绘制算法。

先读 [AGENTS](../../AGENTS.md) 与 [资产规范](../ASSETS.md)。公开创作者只从 [创作者指南](../../experiments/vfx-lab/README.md) 开始。

- 唯一母版是 `src/fx/`，保留 293 个原 ID，最新 8 件原创作品在 `studies/`。成熟 helper 仍是算法来源；原理研究保留在 `experiments/vfx-lab/research/`。
- 最新火球 `studies/sunbreak`；最新像素短尾烟体 `studies/drift`。两者保留作品状态和来源，未将技术检查当作美术批准。旧 `lab/*` 母版 ID 兼容。
- 武器冻结源码改为可读 `_modules/` 文件，摘要对应当前文件；不同验收依赖版本不强行合并。入库工具使用同一组织规则。
- `npm run demo`、`lab`、`gallery` 都启动同一个通用演示台。CLI/MCP 和结构化 HTTP API 保留。
- 索引自动生成至 ignored `.cache/athanor/`。交付与原始测评数据只在 ignored `records/`；独立原报告/构建摘要在 evaluations。
- 仓库产物门禁：`npm run assets:check`；功能验证：`npm run lab:test`；静态部署：`npm run build`。本地启用 `.githooks/`，CI 同样执行。

入库迁移统一使用 es-module-lexer 3 的完整解析接口；入库事务继续核对冻结源、原资源、逐帧色/光、审批范围、过期计划、幂等及恢复。

[环境说明](ENVIRONMENT.md)记录本机可用 Node。历史版本和大运行记录不作为干净克隆的前置条件；从源码生成新 run，使用新 validationRef。后续只为已观察的重复工程扩展工具，不把作品专用算法直接升为通用 SDK。
