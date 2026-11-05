# VFX Lab · 实验性 AI 创作工具

这是像素特效工具台的本地实验实现，已交付契约/证据底座、首批路径/图像/粒子能力，完整状态见[实施状态](../../docs/ai-vfx-tools/implementation-status.md)，接手续研见[交接文档](../../docs/ai-vfx-tools/HANDOFF.md)。最初的 MVP 是一条用来验证方案的纵向切片：AI 读取配方、写普通 JavaScript，再用工具渲染、观察、比较、检查和导出。没有接入模型服务，也没有把自然语言需求自动解释成作品。已有 AI 编码助手就是创作者。

## 运行

Node 18+，不新增运行依赖。在仓库根目录执行：

```sh
npm run lab
# http://127.0.0.1:4173
npm run lab:test
```

页面点击“运行示例实验”，生成 Cryo bloom 的“晶冠”和“碎冰波”。可切换背景、单独观察颜色/光、拖动时间、跳到事件、对齐版本、检查并导出。原项目的图库仍使用 `npm run gallery`。

## AI 的入口

九个工具共享同一份[输入/输出 JSON Schema](definitions.mjs)，包括 `fx_history` 和首批 `fx_probe`。17个公开API家族的精确绘制、运动、贴图、粒子和材质接口见[已实现的创作 API](../../docs/ai-vfx-tools/authoring-api.md)，可通过 `fx_inspect` 按需查询。CLI 只向标准输出写一行 JSON；命令执行失败时返回 `ok: false` 并以非零状态退出。技术检查发现不合格作品仍是一次成功执行，结果中的 `passed` 为 `false`。

```sh
npm run lab:tools
node experiments/vfx-lab/cli.mjs search '{"query":"冰霜"}'
node experiments/vfx-lab/cli.mjs inspect '{"ref":{"kind":"operator","id":"core/painter"}}'
node experiments/vfx-lab/cli.mjs inspect '{"ref":{"kind":"operator","id":"core/color"}}'
node experiments/vfx-lab/cli.mjs inspect '{"id":"ice/frost-nova"}'
node experiments/vfx-lab/cli.mjs scaffold '{"name":"my-frost","brief":"低矮冰波向外扩散，中心保持清楚","question":"减少中心晶体是否让扩散方向更明确？"}'
```

编辑返回的 `drafts/my-frost.js`，然后：

```sh
node experiments/vfx-lab/cli.mjs render '{"id":"draft/my-frost","note":"先验证主轮廓"}'
node experiments/vfx-lab/cli.mjs render '{"id":"draft/my-frost","options":{"direction":"wave"},"note":"比较较低的碎冰波"}'
node experiments/vfx-lab/cli.mjs compare '{"runs":["替换为第一个 run","替换为第二个 run"],"event":"release","offsets":[-0.1,0,0.08,0.3,0.6]}'
node experiments/vfx-lab/cli.mjs validate '{"run":"替换为选定的 run"}'
node experiments/vfx-lab/cli.mjs history '{"id":"draft/my-frost","limit":6}'
node experiments/vfx-lab/cli.mjs export '{"run":"替换为选定的 run"}'
```

也支持从标准输入传 JSON，方便避免 shell 引号问题。`scaffold` 默认复制冰晶示例，也可指定 `template:"blank"` 创建真正空白的模块。brief 必填，question 可选；工具不会根据描述生成新设计。换材质、运动或构图需创作者编辑代码。草稿默认忽略提交，值得保留的作品需主动移到正式目录或明确加入 Git。

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
8. 根据 brief 选择版本，用 `validate {run}` 检查该冻结目标，再从同一个 run 导出。可把返回的 `validationRef` 传给 export；跨 run 引用会被拒绝，未提供时明确标为 unvalidated。

## 文件和复现约定

每个 render 在 `records/vfx-lab/<run>/` 保存：

- `manifest.json`：选项、事件、原始尺度、锚点、请求/模拟时间、逐帧矩形、源码摘要。
- `sources.json`：特效及本地静态导入依赖、实验渲染器的源码快照。
- `contact.png`：均匀采样加事件前一帧/当前帧/后一帧，标注实际采样时间。
- `preview.png`：带场景和静态角色参照的动画图集。
- `color.png` / `light.png`：不含参照角色的颜色层与附加光层。
- `combined.png`：普通透明图片中的合成效果。
- `preview.rgba`：便于原样比较历史图像的未压缩缓存；MVP 用磁盘换简单实现。

每次保存都有独立 run ID。修改代码后不会改写旧版本；对比和导出使用保存的图像。`revision` 标识作品源码闭包与实际选项，`sourceDigest` 标识包含求值后端的完整源码快照，run 另固定场景与采样。由旧 run 重渲染会记录 `parentRun` 并保留作品修订，不编辑工作文件。历史 v1 清单缺少作品修订时用原 sourceDigest 作兼容身份。

导出目录包含 Aseprite 风格 `atlas.json` 和三张 PNG，记录事件、pivot、源 run/digest。颜色层用普通透明混合，光层用加法混合；`combined.png` 在不同背景上的光感是近似值。此处验证了文件与元数据，尚未验证 Unity/Godot 等引擎的实际导入。

## 已验证的坑与选择

- **模拟时钟**：原运行时把 dt 拆成不大于 1/120 秒的子步；240 fps 下每步发射概率会改变结果。实验适配器使用真正的 120 Hz 固定 tick，240 fps 时保持上一完整 tick。测试覆盖 30/60/240 fps 和不规则更新。纯函数保留请求时间，并消除边界处的浮点累计误差。模拟绘制时间也从 tick 整数推导，避免 0.2 秒结束落在 0.19999… 的边界误差；新后端记录为 lab-fixed-120-v2，旧快照继续使用其原后端。原库运行时未改动。
- **透明像素**：预览画布的 paste 是合成操作，不能用它向透明精灵表复制烟雾，否则 RGB 会被透明度乘暗。导出使用原始 RGBA 行复制，测试保留部分透明像素的 RGB。
- **事件采样**：均匀抽帧会跳过 1–2 帧的峰值。现在额外保留事件附近帧；仍受输出 fps 限制，比较报告实际帧时间，不伪称精确发生在事件时刻。
- **检查的边界**：只检查默认种子和颜色不够。新检查采样两个种子，同时检查颜色与光。实测原库 `ice/frost-nova` 在 seed 7 的结束样本有残留；`melee/sword-slash` 有少量画布外亮光提示。它们不是本分支引入的主库修改，报告需结合画面判断。
- **版本检查**：`validate {id}` 检查当前文件；`validate {run}` 使用冻结源码、依赖和后端从头重放。页面“检查当前版本”检查正在预览的 run。报告明确表示 frozen-source-replay，不声称已经逐帧核对保存图像。`render {target:{run}}` 可从冻结目标生成新的运行；允许显式调整 fps、背景和事件采样，不允许暗改作品选项。
- **模块缓存**：每次工具调用在新 Node 进程中执行，改动间接依赖也会生效；同时隔离异常和限制执行时间。成本是调用有启动开销。
- **比较语义**：同尺度、同锚点，按共享事件加自选 offsets 对齐；也可用 `alignment:"time",times:[...]` 比较绝对时间。报告请求时间、保存帧时间、模拟时间、取样误差、夹边、重复帧及场景差别，不给自动美感评分。

## MVP 范围

支持整个现有特效目录和实验/草稿效果。六份配方用于检索指导；scaffold 提供冰晶示例和空白模块。草稿编辑由编码 AI 的常规文件工具承担。

检查是**采样检查**：覆盖约 13 个均匀时间点加命名事件、两个种子、24 px 外边距、颜色/光复现、结束残留、循环周期及跨更新率结果。不证明所有帧都不越界，不证明循环速度连续，不进行性能认证或审美判断。最大渲染预算为 2400 万帧像素，昂贵调用串行执行，单次工具调用限时 90 秒。

页面中的角色仅作站立尺度参照，不播放完整 act、受击停顿或姿态映射；这些仍用原库 `tools/act.mjs` 检查。当前也没有场景截图输入、专用代码编辑器、版本选择器、自动修复或云服务。页面默认对比最近两个保存版本，更早的版本可用 run ID 从 CLI/MCP 比较。

服务仅监听 `127.0.0.1` 并检查 Host/Origin。只运行可信本地代码：特效本身仍是拥有 Node 权限的 JavaScript，子进程隔离不是不可信代码执行沙箱。

## 独立创作者测评

[2026-11-05 黑盒测评归档](evaluations/2026-11-05/README.md)保留了一个未读工具实现的 AI 创作者的意图、三版原创作品、操作记录与图像证据。正式复核以 tool definitions 的接口及其与正常作品代码编辑的组合作为评估对象；第一轮混入 GUI 和不恰当的 A/B 判据，相关结论已标注撤回。

## 基础创作能力调研

[Spine Particle 调研](research/tsnm-spine-particle/README.md)分析其发射、生命周期、运动、路径、资源和光带机制，记录实现探测与适用边界，并提出面向 AI 的算子、工具定义及创作验证建议。研究中的部分建议已在SDK交付，完整建议不等于已实现；当前交付子集与后续计划以实施状态文档为准。

[AI 像素特效创作工具产品全景设计](../../docs/ai-vfx-tools/README.md)进一步结合全库实现，定义参考与技法、局部复用、基础算子、观察实验、AI 工具接口、创作流程和分期验收。完整目标仍是产品方案；A 阶段已落地的子集见实施状态和实时工具定义。

## A 阶段：返回、历史与重放约定

- render 默认 `detail:"summary"`，保留 run、target、选项、事件、尺寸、原点、诊断、关键图像和 manifest 路径；完整帧表、运行环境与依赖清单在 manifest 或 `detail:"full"`。页面播放显式请求 full。
- inspect 支持 `ref.kind` 为 effect/operator/run，以及按需 sections。旧 `inspect {id}` 仍返回作品源码。当前登记17个契约族：原有 Painter/颜色/时钟/模块，加 path/random/curve/domain/schedule/motion/mask/field/image/light 和 texture/particle/material；可按机制搜索，不是全部未来算子已经实现的声明。
- history 接受 id/run/query 至少一项；按 limit/cursor 分页，返回修订、父运行、创作说明、验证和导出引用。run 检索展开同作品上下文；不推断最终选择。检查 run 可看到它与当前文件的变化。
- 验证分析写入 `validations/validation-*.json`；冻结 run 的分析放在该 run 下，既不覆盖 manifest，也不改旧图像。导出记录附在各自目录。
- 重放固定本地相对 JavaScript 导入闭包与保存的 renderer/clock/core，要求 Node 版本、平台和架构与记录一致。动态导入、外部包、Node 文件资源和其他环境依赖尚不完整支持。静态识别是保守的依赖检查，不是任意 JavaScript 的依赖证明或沙箱；可识别缺口返回 REPLAY_UNAVAILABLE，不以当前文件替代。保存图像仍能比较和导出。
- 结束策略可用 `authoring.ending` 声明 clear/residue/persistent/handoff/loop。默认沿用单次清空、循环周期检查；允许残留不等于证明残留稳定或交接成功，未检项会列出。

```sh
node experiments/vfx-lab/cli.mjs scaffold '{"name":"my-effect","brief":"一个原创方向性冲击","template":"blank"}'
node experiments/vfx-lab/cli.mjs render '{"target":{"run":"替换为旧 run"},"fps":60,"note":"从旧版补看更密集的时间样本"}'
node experiments/vfx-lab/cli.mjs compare '{"runs":["替换为 run A","替换为 run B"],"alignment":"time","times":[0.15,0.95,1.18]}'
node experiments/vfx-lab/cli.mjs export '{"run":"替换为选定的 run","validationRef":"替换为该 run 的 validationRef"}'
```

## 首批创作算子：路径与消融联动

从 `src/authoring/index.js`（包入口 `athanor/authoring`）导入普通代码算子：

```js
import {path, curve, random, domain, schedule, motion, mask, field, image, light}
  from '../../../src/authoring/index.js';
```

它们负责弧长/切法线、连续条带、具名随机、曲线插值、面积/边界/密度采样、稳定出生、解析运动，以及程序mask、排序/首次到达场、保留/边缘/变化区域和衍生出生；造型、路径、材质和节奏仍由作者定义。颜色在新接口边界接受并检查 hex/Color32，原始 Painter 契约保持不变。

```sh
node experiments/vfx-lab/cli.mjs search '{"query":"消融"}'
node experiments/vfx-lab/cli.mjs inspect '{"ref":{"kind":"operator","id":"core/path"}}'
node experiments/vfx-lab/cli.mjs inspect '{"ref":{"kind":"operator","id":"core/image"}}'
node experiments/vfx-lab/cli.mjs inspect '{"id":"lab/ember-weave"}'
node experiments/vfx-lab/cli.mjs render '{"id":"lab/ember-weave","options":{"bend":-0.5,"burnAxis":-1,"glow":0}}'
```

`lab/ember-weave` 是可拆读和改写的组合参考；用相同到达场供给颜色轮廓、边缘光和碎屑出生。不要把动态mask的区间变化误作精确瞬时出生；首次到达的稳定birth records不依赖输出fps/跳转顺序，任意动态场则只能报告实际区间变化。

## 粒子、贴图、库内材质与探测

新增`{particle,texture,material}`，与原有schedule/domain/motion/curve组合。`material`直接适配现有fire/arcane辅助模块的六种成熟画法；particle允许换轨迹、力、生命周期和任意Painter绘制；texture支持RGBA/ASCII、序列帧与独立轴心。不是只能调固定粒子种类。

```sh
node experiments/vfx-lab/cli.mjs inspect '{"ref":{"kind":"operator","id":"core/particle"}}'
node experiments/vfx-lab/cli.mjs inspect '{"ref":{"kind":"operator","id":"core/material"}}'
node experiments/vfx-lab/cli.mjs inspect '{"id":"lab/cinder-orbit"}'
node experiments/vfx-lab/cli.mjs render '{"id":"lab/cinder-orbit","options":{"glow":0}}'
node experiments/vfx-lab/cli.mjs probe '{"run":"替换为选定run","view":"color","at":{"event":"release","offsets":[-0.1,0,0.1,0.5]}}'
node experiments/vfx-lab/cli.mjs probe '{"run":"替换为选定run","view":"particles","layers":["release"],"at":{"times":[1.2,1.5,1.8]},"limit":4}'
```

新作品可选`observe(t,o)`导出粒子组；render保存Birth/State及hash，probe默认只读这些事实，草稿损坏不影响旧证据。显式`sampling:'replay'`才在冻结后端重算非保存时刻。旧作品没有声明的粒子身份不推断；任意mask/field观察、内部画面层隔离、去修改器、连续轨迹和动作播放时钟仍未支持。四个保存图像视图适用于所有run，单run即可，不再需要复制run ID来比较同一版本。

搜索现在隔离 helper/坏模块，返回 RESOURCE_SKIPPED、候选 ID 和修复提示，其他结果仍可用；普通辅助文件可以直接导入，下划线命名可排除发现。源码语法/导入/导出错误指向可编辑文件，参数JSON错误指向 arguments。依赖快照改用 Node 自身模块语法解析，不把注释/字符串里的 from/import 误当依赖；未支持的动态资源仍明确拒绝重放。

每个功能闭环均需通过[独立创作者复杂任务](../../docs/ai-vfx-tools/creator-evaluation.md)再复核。实现测试、开发者示例和技术通过都不能代替这一门槛。

## 保存通道的原尺寸比较

`compare` 现在接受 `channel:"preview"|"color"|"light"|"combined"`，与 event+offsets 或绝对 times 共同使用。直接读取保存的图像，不要求改作品、重渲染或自行裁图；返回 channel、saved-images 表示、实际时间与暗色观察底。preview 沿用保存场景；color/combined 在暗色底上显示原透明图集，light 以纯黑加法中性底展示原始RGB、exposure=1，避免极弱光被当成比底更暗的剪影。它没有推断内部层或粒子身份。页面比较沿用当前观察通道。

```sh
node experiments/vfx-lab/cli.mjs compare '{"runs":["run-A","run-B"],"alignment":"time","times":[0.9,1.1,1.3,1.5],"channel":"color"}'
node experiments/vfx-lab/cli.mjs compare '{"runs":["run-A","run-B"],"event":"release","offsets":[-0.03,0,0.03,0.1],"channel":"light"}'
```

搜索的多个词目前按同一条目的 AND 匹配；复合机制无命中时返回拆词建议，不把“没匹配”声称为能力不存在。
