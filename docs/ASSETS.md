# 特效资产规范

资产 ID 是稳定的 `category/name`。源码的 `meta` 是名称、说明、标签、原生尺寸、轴心、时长、循环和默认参数的唯一事实来源。库目录扫描自动发现入口；不另维护手写 JSON 清单，也不提交生成的索引。

| 路径 | 用途 | Git |
| --- | --- | --- |
| `src/fx/<category>/<name>.js` | 可独立加载的公开入口 | 保存 |
| `src/fx/<category>/_lib.js`、`_modules/`、其他 `_` 目录 | 成熟共享机制和作品私有依赖 | 保存 |
| `src/fx/<category>/_assets/` | 作品实际读取的原始 PNG 资源 | 保存 |
| `src/core/`、`src/authoring/`、`src/playback/` | 绘制、组合、消费运行时 | 保存 |
| `src/fx/studies/` | 最新可编辑原创作品；尚未验收者标记 `asset.status: study` | 保存 |
| `experiments/vfx-lab/effects/` | 可运行 API 例子和旧 ID 兼容入口 | 保存 |
| `demo/` | 唯一通用演示台 | 保存源码与字体 |
| `.cache/athanor/` | 从源码生成的 JS/JSON/Markdown 索引 | 忽略 |
| `records/`、`dist/`、`sheets/`、`output/` | 运行记录、图片、图集、媒体、部署包 | 忽略 |
| `experiments/vfx-lab/drafts/` | 本地创作与改稿 | 忽略 |
| `experiments/vfx-lab/evaluations/` | 简短原报告、构建摘要、复现步骤 | 只保存轻量文字 |

## 查找和复用

```sh
npm run assets -- list
npm run assets -- list smoke
npm run assets -- inspect studies/sunbreak
```

`list` 返回结构化元数据与状态；`inspect` 返回入口、完整静态依赖及 SHA-256、资源、事件和来源。使用 `athanor/fx/<id>` 导入，或按依赖清单复制源码闭包并保留署名。不能只复制一张预览图片、单个包装入口或某个旧交付 ZIP。当作品声明 PNG 时，资源与 JS 闭包同样必需；用公开工作流导出完整交付包。

293 个原库 ID 均保留。武器 `_modules/` 中同名带摘要后缀的模块是不同验收版本依赖，可能有不同的启停/材质行为，不能按文件名强行合并。每个入口的 `provenance` 保留原冻结运行身份，`sourceModules` 指向当前模块并记录当前摘要。

最新火球与烟体为 `studies/sunbreak`、`studies/drift`；另有六个原创大型作品。`lab/fireball-master`、`lab/smoke-master` 和六件原 `lab/*` ID 兼容到这些源码。旧烟体变体、作品专用预览、可编辑交付副本和轮次产物已清除。`study` 只表示保留了可编辑作品，不表示用户最终美术验收。

## 创建、修改与正式入库

普通 JS 自由编辑；公开入口至少导出 `meta` 与 `draw` 或 `create`。helper 用 `_` 前缀以免成为资产。库内只能静态依赖 `src/`，不能依赖草稿、生产记录、导出文件或本机绝对路径。PNG 使用显式 `assets` 声明，保留资源原件。

1. 用 [创作者工作流](../experiments/vfx-lab/README.md) 制作、观察、至少两轮有意义局改并比较。
2. 明确选择冻结 run，验证并导出同一 run；技术通过与美术审批分开记录。
3. 正式收录使用 [library plan/install/status/recover](ai-vfx-tools/library-installation.md)，复用一致的现有依赖，搬运必要源码/原资源；不搬运渲染结果。已有用户授权按其准确范围执行。
4. `npm run assets:check` 和相关测试通过后提交。索引与文档目录写入 `.cache/athanor/`；工具不再重写 README。

## 输出生命周期与 Git 瘦身

`npm run demo` 与 `npm run build` 自动生成目录。删掉 `.cache/` 后重跑即可。`lab`、`gallery` 命令只是同一演示台的兼容别名。HTTP API、CLI、MCP 继续共享工具定义；没有作品专用服务。

`npm run assets:clean` 默认只列清单；加 `-- --apply` 删除可再生输出。额外加 `--drafts` 才清理手写草稿。原始纹理、共享源码、署名和依赖不在清理范围。独立创作者的图像、调用、改稿和导出留在 ignored records，Git 只收简短原报告、构建摘要与复现步骤。

`npm ci` 自动启用提交前/推送前门禁，CI 独立复检。检查实际暂存 blob、清理基线后的全部提交及合并侧枝，拒绝生成目录、交付媒体、改名的二进制、额外演示页、来源摘要不符或断裂依赖。普通文件限 1 MiB，原资源限 4 MiB，源码树总预算 16 MiB，可达历史对象限 64 MiB；测评只保存有单项/总量预算的轻量文字。规则和恢复步骤见[仓库护栏](REPOSITORY-GUARDS.md)。历史重写前应在仓库外保存 Git bundle；远程强推后其他工作副本应重新克隆，不能把旧历史合回。
