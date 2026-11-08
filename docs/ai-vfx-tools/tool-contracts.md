# 工具契约入口

CLI、MCP 和 HTTP 使用同一份[可执行定义](../../experiments/vfx-lab/definitions.mjs)。此页只帮你选工具；准确参数、默认值、返回与恢复按需查询，不再手工复制另一份完整 Schema。

```sh
node experiments/vfx-lab/cli.mjs tools
node experiments/vfx-lab/cli.mjs tools '{"name":"fx_probe"}'
node experiments/vfx-lab/cli.mjs inspect '{"ref":{"kind":"tool","id":"fx_library"}}'
```

裸 tools 返回短目录，name 返回单个完整定义，detail:full 返回完整列表。算子用 ref.kind:operator（例如 core/particle），参考作品用 effect/id，已登记原库机制用 mechanism；具体引用从 search 结果取得。

## 当前工具分工

| 工具 | 何时使用 |
| --- | --- |
| search | 找作品、配方、SDK 契约和已登记成熟机制 |
| inspect | 按所需 sections 读工具/算子、参考源码、依赖、资源或保存 run |
| scaffold | 创建可编辑普通 JS；可选 blank，不替作者决定艺术方向 |
| render | 求值当前 id 或明确重放冻结 run，保存图像、事实和身份 |
| probe | 读取一个冻结 run 的原尺寸窗口及实际声明对象 |
| compare | 对齐多个冻结版本，比较结构/时序/色光等改动 |
| validate | 检查确定性、边界、时钟、结束等技术条件，报告抽样范围 |
| history | 找回运行/调用/原错误，记录明确选版及证据 |
| export | 从指定保存 run 交付图集/独立消费包及可选媒体 |
| library | 从已选、已验证的冻结 run 计划收录，按已有批准执行；检查与恢复事务 |

## 调用前分清目标与证据

- id 指向当前源码；run 指向保存版本。修改当前文件不会改写旧 run。
- probe/compare 的保存图像与真实声明对象是不同视图；没有声明的身份不从像素推断。
- 技术验证、作者选版和用户作品审批分别记录。library 核对选版/验证与准确批准 IDs；导出时应明确选择同一 run，并传对应 validationRef。
- 媒体依赖编码器，图集不依赖；保存色层和加法光层是精确资产，combined 是透明合成近似。

[创作流程](../../experiments/vfx-lab/README.md) → [按问题展开的工作流](../../experiments/vfx-lab/WORKFLOWS.md) → [正式入库细则](library-installation.md)。错误按实际 recovery 恢复，原错误可经 history 查询。

局部复用使用现有inspect/search：effect sections:['reuse']列实际库依赖与导出，mechanism reuse列可替换输入，加source按需读库模块；无需新固定装配DSL。history action:bundle围绕明确run汇集原调用/错误、原图、验证和导出，返回哈希索引及可编辑报告，实际观看仅接受作者声明。完整fx_reuse / fx_explore设想仍在[目标接口设计](design/tool-interface.md)，不属于已交付工具。
