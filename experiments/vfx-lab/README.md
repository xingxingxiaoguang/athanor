# VFX Lab · 实验性 AI 创作工具

这是一条用来验证方案的纵向切片：AI 读取配方、写普通 JavaScript，再用工具渲染、观察、比较、检查和导出。没有接入模型服务，也没有把自然语言需求自动解释成作品。已有 AI 编码助手就是创作者。

## 运行

Node 18+，不新增运行依赖。在仓库根目录执行：

```sh
npm run lab
# http://127.0.0.1:4173
npm run lab:test
```

页面点击“运行示例实验”，生成 Cryo bloom 的“晶冠”和“碎冰波”。可切换背景、单独观察颜色/光、拖动时间、跳到事件、对齐版本、检查并导出。原项目的图库仍使用 `npm run gallery`。

## AI 的入口

七个工具共享同一份 [JSON Schema](definitions.mjs)。CLI 只向标准输出写一行 JSON；命令执行失败时返回 `ok: false` 并以非零状态退出。技术检查发现不合格作品仍是一次成功执行，结果中的 `passed` 为 `false`。

```sh
npm run lab:tools
node experiments/vfx-lab/cli.mjs search '{"query":"冰霜"}'
node experiments/vfx-lab/cli.mjs inspect '{"id":"ice/frost-nova"}'
node experiments/vfx-lab/cli.mjs scaffold '{"name":"my-frost","brief":"低矮冰波向外扩散，中心保持清楚","question":"减少中心晶体是否让扩散方向更明确？"}'
```

编辑返回的 `drafts/my-frost.js`，然后：

```sh
node experiments/vfx-lab/cli.mjs render '{"id":"draft/my-frost","note":"先验证主轮廓"}'
node experiments/vfx-lab/cli.mjs render '{"id":"draft/my-frost","options":{"direction":"wave"},"note":"比较较低的碎冰波"}'
node experiments/vfx-lab/cli.mjs compare '{"runs":["替换为第一个 run","替换为第二个 run"],"event":"release"}'
node experiments/vfx-lab/cli.mjs validate '{"id":"draft/my-frost"}'
node experiments/vfx-lab/cli.mjs export '{"run":"替换为选定的 run"}'
```

也支持从标准输入传 JSON，方便避免 shell 引号问题。`scaffold` 目前只复制冰晶示例并保存 brief/question，不会根据描述生成新设计；换材质、运动或构图需创作者编辑代码。草稿默认忽略提交，值得保留的作品需主动移到正式目录或明确加入 Git。

需要 MCP 的 AI 客户端可配置本地 stdio server：

```json
{
  "command": "node",
  "args": ["/absolute/path/to/athanor/experiments/vfx-lab/mcp.mjs"]
}
```

最小实现支持 `initialize`、`notifications/initialized`、`tools/list`、`tools/call`、`ping`，协议版本为 `2025-11-25` / `2025-06-18`。渲染与比较返回 PNG 图片内容，AI 不必只拿到一个无法观察的文件路径。它尚未经过独立 MCP 客户端的兼容性认证；自动测试覆盖了 stdio 握手、发现、调用、错误及图片返回。

## 创作者的工作流程

1. 写明用途、尺度、主轮廓、材质、节奏及一个待验证的问题。工具不代替这一步。
2. `search` / `inspect` 找相近机制。配方里有参考、待作的选择和常见失败。
3. 编辑草稿，保持普通 `meta` + `draw(p,t,o)` / `create(o)` 接口；可直接使用完整 core API。
4. 将 release/contact/melt 等时间导出为 `events`，让相关层共享定义。已有作品没有 events 时可在 render 输入中补充。
5. 渲染并实际打开 `contact.png` 或在页面播放。检查原尺寸、关键事件前后连续帧、颜色与光以及不同背景。
6. 写出最重要的问题和修改假设，再改代码或参数。方向探索要改变结构或运动，更换种子只是同一设计的变化。
7. 用相同条件比较版本。技术检查单独处理；检查通过并不授予审美认可。
8. 根据 brief 选择版本，从该保存版本导出。

## 文件和复现约定

每个 render 在 `records/vfx-lab/<run>/` 保存：

- `manifest.json`：选项、事件、原始尺度、锚点、请求/模拟时间、逐帧矩形、源码摘要。
- `sources.json`：特效及本地静态导入依赖、实验渲染器的源码快照。
- `contact.png`：均匀采样加事件前一帧/当前帧/后一帧，标注实际采样时间。
- `preview.png`：带场景和静态角色参照的动画图集。
- `color.png` / `light.png`：不含参照角色的颜色层与附加光层。
- `combined.png`：普通透明图片中的合成效果。
- `preview.rgba`：便于原样比较历史图像的未压缩缓存；MVP 用磁盘换简单实现。

每次保存都有独立 run ID。修改代码后不会改写旧版本；对比和导出使用保存的图像。`sourceDigest` 用来标记当前检查代码是否仍与预览一致。

导出目录包含 Aseprite 风格 `atlas.json` 和三张 PNG，记录事件、pivot、源 run/digest。颜色层用普通透明混合，光层用加法混合；`combined.png` 在不同背景上的光感是近似值。此处验证了文件与元数据，尚未验证 Unity/Godot 等引擎的实际导入。

## 已验证的坑与选择

- **模拟时钟**：原运行时把 dt 拆成不大于 1/120 秒的子步；240 fps 下每步发射概率会改变结果。实验适配器使用真正的 120 Hz 固定 tick，240 fps 时保持上一完整 tick。测试覆盖 30/60/240 fps 和不规则更新。纯函数保留请求时间，并消除边界处的浮点累计误差。原库运行时未改动。
- **透明像素**：预览画布的 paste 是合成操作，不能用它向透明精灵表复制烟雾，否则 RGB 会被透明度乘暗。导出使用原始 RGBA 行复制，测试保留部分透明像素的 RGB。
- **事件采样**：均匀抽帧会跳过 1–2 帧的峰值。现在额外保留事件附近帧；仍受输出 fps 限制，比较报告实际帧时间，不伪称精确发生在事件时刻。
- **检查的边界**：只检查默认种子和颜色不够。新检查采样两个种子，同时检查颜色与光。实测原库 `ice/frost-nova` 在 seed 7 的结束样本有残留；`melee/sword-slash` 有少量画布外亮光提示。它们不是本分支引入的主库修改，报告需结合画面判断。
- **版本检查**：检查运行磁盘上的当前代码；导出使用保存版本。界面明确提示二者源码是否一致。源码快照便于审查，尚无一键从快照恢复并重放的打包器。
- **模块缓存**：每次工具调用在新 Node 进程中执行，改动间接依赖也会生效；同时隔离异常和限制执行时间。成本是调用有启动开销。
- **比较语义**：同尺度、同锚点、按共享事件对齐。缺少事件就报错；边界截断和最近采样时间写进结果，不给自动美感评分。

## MVP 范围

支持整个现有特效目录和实验/草稿效果。四份配方用于检索指导，只有冰晶配方提供 scaffold 示例。草稿编辑由编码 AI 的常规文件工具承担。

检查是**采样检查**：覆盖约 13 个均匀时间点加命名事件、两个种子、24 px 外边距、颜色/光复现、结束残留、循环周期及跨更新率结果。不证明所有帧都不越界，不证明循环速度连续，不进行性能认证或审美判断。最大渲染预算为 2400 万帧像素，昂贵调用串行执行，单次工具调用限时 90 秒。

页面中的角色仅作站立尺度参照，不播放完整 act、受击停顿或姿态映射；这些仍用原库 `tools/act.mjs` 检查。当前也没有场景截图输入、专用代码编辑器、版本选择器、自动修复或云服务。页面默认对比最近两个保存版本，更早的版本可用 run ID 从 CLI/MCP 比较。

服务仅监听 `127.0.0.1` 并检查 Host/Origin。只运行可信本地代码：特效本身仍是拥有 Node 权限的 JavaScript，子进程隔离不是不可信代码执行沙箱。

## 独立创作者测评

[2026-11-05 黑盒测评归档](evaluations/2026-11-05/README.md)保留了一个未读工具实现的 AI 创作者的意图、三版原创作品、操作记录与图像证据。正式复核以 tool definitions 的接口及其与正常作品代码编辑的组合作为评估对象；第一轮混入 GUI 和不恰当的 A/B 判据，相关结论已标注撤回。

## 基础创作能力调研

[Spine Particle 调研](research/tsnm-spine-particle/README.md)分析其发射、生命周期、运动、路径、资源和光带机制，记录实现探测与适用边界，并提出面向 AI 的算子、工具定义及创作验证建议。建议尚未实现，不改变当前七个工具的能力范围。

[AI 像素特效创作工具产品全景设计](../../docs/ai-vfx-tools/README.md)进一步结合全库实现，定义参考与技法、局部复用、基础算子、观察实验、AI 工具接口、创作流程和分期验收。新接口均为产品方案。
