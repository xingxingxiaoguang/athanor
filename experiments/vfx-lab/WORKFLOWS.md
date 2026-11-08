# 创作流程按需说明

从 [快速入口](README.md) 开始；本文按问题查阅，不是接手必读。准确参数/限额以公开 tools/inspect 与 [API](../../docs/ai-vfx-tools/authoring-api.md) 为准。入库另见 [library 契约](../../docs/ai-vfx-tools/library-installation.md)。

| 当前遇到的问题 | 直接展开 |
| --- | --- |
| 要拆用参考作品的一部分 | [实际库依赖与局部替换](#实际库依赖与局部替换) |
| 要把各稿/原错误/图像与交付交接出去 | [同run证据包](#同run证据包) |
| 想看清峰值或比较局改 | [原尺寸时序窗口](#一次观察原尺寸时序窗口)、[色光通道比较](#保存通道的原尺寸比较) |
| 找回失败、旧版或明确选版 | [自动记录与选版](#自动公共记录与明确选版)、[历史与重放](#返回历史与重放约定) |
| 画面越界、希望有意出画 | [输出视口与边界](#输出视口与可定位边界) |
| 交付图集、动画或独立游戏资产 | [动画交付](#从选定冻结run直接交付动画)、[素材与资产消费](#外部素材与独立游戏资产消费) |
| 需要可拆改的机制例子 | [路径与消融](#路径与消融联动)、[粒子与材质](#粒子贴图库内材质与探测)、[源轨迹](#带速度的共享源轨迹)、[接触](#接触事件与二次出生)、[历史拖尾](#真实历史拖尾)、[动作与表面](#动作目标表面与完整观察) |

## 文件和复现约定

每个 render 在 `records/vfx-lab/<run>/` 保存：

- `manifest.json`：选项、事件、原始尺度、锚点、请求/模拟时间、逐帧矩形、源码摘要。
- `sources.json`：特效及本地静态导入依赖、实验渲染器的源码快照。
- `contact.png`：均匀采样加事件前一帧/当前帧/后一帧，标注实际采样时间。
- `preview.png`：带场景和静态角色参照的动画图集。
- `color.png` / `light.png`：不含lab静态参照的颜色层与附加光层；作者自己绘制的人物/地形仍在其中，不自动成为仅特效cutout。
- `combined.png`：普通透明图片中的合成效果。
- `preview.rgba`：便于原样比较历史图像的未压缩缓存。

每次保存都有独立 run ID。修改代码后不会改写旧版本；对比和导出使用保存的图像。`revision` 标识作品源码闭包与实际选项，`sourceDigest` 标识包含求值后端的完整源码快照，run 另固定场景与采样。由旧 run 重渲染会记录 `parentRun` 并保留作品修订，不编辑工作文件。历史 v1 清单缺少作品修订时用原 sourceDigest 作兼容身份。

导出目录包含 Aseprite 风格 `atlas.json` 和三张 PNG，记录事件、pivot、源 run/digest。颜色层用普通透明混合，光层用加法混合；`combined.png` 在不同背景上的光感是近似值。此处验证了文件与元数据，尚未验证 Unity/Godot 等引擎的实际导入。

## 一次观察原尺寸时序窗口

```sh
node experiments/vfx-lab/cli.mjs probe '{"run":"选定run","view":"combined","window":{"event":"release","from":-0.1,"to":0.3}}'
node experiments/vfx-lab/cli.mjs compare '{"runs":["run-A","run-B"],"event":"release","window":{"from":-0.1,"to":0.3},"channel":"color"}'
node experiments/vfx-lab/cli.mjs probe '{"run":"选定run","view":"preview","window":{"from":2.4,"to":2.8},"layout":{"columns":3}}'
```

图像视图preview/color/light/combined的`window`是**闭区间**。有event时from/to为相对该事件的秒数，否则为绝对特效秒；compare的绝对窗口显式指定`alignment:"time"`。窗口取所有版本在区间内的保存时刻并集，加首尾的最近帧请求；默认不跳帧。跨fps/事件偏移可能重复使用某个保存帧，samples明确给出requested/actual/simulationTime、sourceIndex、误差、重复和夹边。`window.gaps`报告保存帧表中的采样缺口。没有区间内保存帧时明确提示显式冻结补采样：`render {target:{run},fps:60}`产生新子run，作者再选择，不执行当前草稿或插值伪造帧。

结果`pages`列出全部原尺寸PNG、尺寸、hash和每格对应的sampleIndex/图像矩形，`image`指向第一页。MCP直接返回全部页图；CLI可用图像查看工具打开各page.image。默认页界限1120×1024、自动列数；`layout`可设columns=1..6、maxWidth/maxHeight=480..1600。单格始终1艺术像素=1图像像素，同锚点比较；兼容不了的分数像素锚点明确拒绝，不偷偷重采样。上限122个共享时刻、12页、2400万页像素，超限拒绝；缩短窗口或显式`window.every:N`保留每N项和末项，省略位置会列出。调用端仍需确认宿主是否缩图，不能仅凭pixelScale=1声称已实际看过原尺寸。旧at.times/event+offsets查询保持原横表；加`layout:{}`可使用分页。

同一结果的`playback.file`是局部观察HTML，`playback.urlPath`可经运行中的lab服务打开（如默认`http://127.0.0.1:4173`加该路径）。它从同一批保存样本提供前后单帧、拖动、暂停、速度和窗口循环；按实际共享时间播放，不重新求值作品。画布固定原尺寸，窄窗口可滚动。文件也可在完整的同级保存run目录旁打开，部分浏览器对file资源有限制时使用本地服务。记录真正完成的观看形式：PNG密集帧、浏览器逐帧、连续观看、仅播放状态或解码检查分别报告。页面交付时viewed=false；工具不知道作者是否实际看过。

contacts仍用原半开绝对`window:{from,to}`，不接受event/every；粒子/源/历史状态继续用at。粒子/trajectory默认`selection:"active"`：优先最新请求样本时刻活跃的身份，再取其他请求时刻活跃者，最多limit条；没有活跃对象则空选并保留全组计数。`selection:"birth-order"`可回到出生顺序，`particles:[id]`可明确查询死亡或未出生状态，输出报告活跃候选与省略数量。没有声明观察的旧主体仍不补造身份。

## 自动公共记录与明确选版

每次公开CLI/MCP/HTTP工具调用保存参数、结构化结果/原始错误和关联run/分析引用，返回`callRef`。工具发现也记录；可在`history {query:""}`中查未关联作品的记录。按id/run查询默认附分页calls摘要，callCursor/callLimit控制分页；按callRef直接读取单条完整记录，不附无关作品。结构化记录不拦截任意作品额外console输出，也不把协议握手或PNG交付当作实际观看。

```sh
node experiments/vfx-lab/cli.mjs history '{"run":"选定run","callLimit":12}'
node experiments/vfx-lab/cli.mjs history '{"callRef":"替换为调用返回的callRef"}'
node experiments/vfx-lab/cli.mjs history '{"action":"select","run":"明确选定run","reason":"选择这一版的艺术依据","evidence":["比较或观察的callRef"]}'
```

选版可选，日常创作无需额外仪式。action:select要求run和非空reason，evidence可省略；若提供，必须是涉及该run的成功公开调用。它按作品保存不可变decision记录与当前明确选择，后续新render不替换选择。`history {id}`或`{run}`返回decision及验证/导出引用；跨作品查询不推断选择。选择不自动验证/导出，也不赋予审美认可。validate/export仍传同一明确run与验证引用。

记录在ignored records下，一调用一文件，查询无需自写日志系统。MCP/HTTP的invoke子进程异常退出/超时会留下interrupted记录和可查询的callRef；直接CLI被外部终止可能保留pending，表示完成状态未知。损坏记录在列表中明确skipped，单独读取拒绝伪造结果。原始失败保留；记录增长和回收策略尚未自动化。

## 实际库依赖与局部替换

```sh
node experiments/vfx-lab/cli.mjs inspect '{"id":"explosions/smoke-bomb","sections":["reuse"]}'
node experiments/vfx-lab/cli.mjs search '{"query":"lobe"}'
node experiments/vfx-lab/cli.mjs inspect '{"ref":{"kind":"mechanism","id":"library/explosion-lobes"},"sections":["contract","example","reuse"]}'
```

作品reuse列实际静态可达的src/fx模块、导出、导入边、修订与机制入口；加source返回这些库模块的实际原文，SDK/runtime实现不在其中。barrel可包含未使用函数，所以这不是“实际生效算子图”。机制reuse列可替换输入与不应破坏的单位/色阶/身份关系。没有登记的helper也可按真实模块源码适配，不把它误称已校验SDK。

优先直接import原helper，或把公共粒子State交给material等适配。保留出生/运动/随机身份，只换draw材质，可测试画法的局部影响；保留draw而改出生域/轨迹，可测试布局。lobe和合并cloud的两种烟色阶方向相反，准确契约在core/material。cloud整批调用，不逐粒子调用；probe继续查同一emitter。造型、源布局、热度曲线和艺术判断由作者决定。

## 同run证据包

选版、同run验证/导出完成后：

```js
const packet=await invoke('history',{action:'bundle',run:selectedRun,annotations:{
  intent:'这件作品想表达什么',changes:['源布局改动','材质或时序改动'],
  judgment:'根据实际观察选此版的理由',limitations:['尚未接入具体游戏'],
  viewed:[actualImageCallRef],references:[discoveryCallRef]
}});
```

annotations全部可省略。自动收集该作品各稿的原始公共调用（含失败）、对应run清单/接触图、probe/compare原尺寸pages、验证报告和导出资产。references可补未关联作品的search/inspect等调用；不会暗抓整个会话。viewed仅接受该作品历史中的成功render/probe/compare图像调用，是**作者声明、工具未验证**；不填则没有观看声明。

返回bundle.directory/index/report。index.json列每个复制文件的原路径、相对路径、SHA及用途，README可编辑；export子目录保留相对布局，可整目录移出消费。calls中原参数/原结果/原错误不改写，内部原路径可能仍指旧工作区，移交时用index定位副本。明确run的历史选择与最新选择分别保留；没有该run选择时decisionRef=null，不自动选版。缺文件列missing，坏调用列skipped，不伪造通过。

生成包不执行当前源码、不重新渲染或验证、不入库。冻结sources.json、raw observations、原始PNG资源闭包和RGBA缓存不复制，已有export里的正式资产会复制；因此这是创作证据/交付包，不是完整重放备份。轻量索引与实际图集均可保留；原run仍在records下。

## 输出视口与可定位边界

有意让束头、地景或天气出画时，在作品模块声明：

```js
export const authoring = {ending:'clear', bounds:{mode:'viewport'}};
// 独立资产要求完整边界：bounds:{mode:'asset'}
// 可选子矩形：bounds:{mode:'viewport',rect:[8,8,272,176]}
```

默认rect为完整meta.size。rect是输出画布左上角起算的[x,y,width,height]整数半开矩形，与Painter本地origin不同；子矩形必须在meta.size内。输出窗口固定，flip/angle仅改变其中画面。工具台统一裁color/软透明/light/combined/preview，窗口内原字节保持；不需要修改put/blendPx/add，直接C/L缓冲绘制也覆盖。尺寸、origin和帧表不改变，子矩形外透明。此协议现由lab执行，库内独立createFx/renderFrames及目标引擎还未接入。

AI调用`validate {run}`后，直接读取errors中的COLOR_SPILL/LIGHT_SPILL.locations或boundary.samples：seed、time/actualTime、通道pixels、canvas rect、四边计数、touchesScanBoundary。明确asset时任意非零RGB光也必须留在范围内；旧未声明模块维持旧颜色错误/强光警告策略。viewport记录INTENTIONAL_CROP及采样裁除区域，但随机性、时钟、重复draw和结束检查继续；空结束以最终输出为准。

若需更精确定位，调用`validate {run,boundsTimes:[1.23],boundsMargin:64}`，不改艺术源码、不改原run；附加时刻加入默认覆盖。边距8..96，附加时刻最多24且须在duration内，采样预算1200万帧像素，超限明确拒绝。扫描是有限栅格，触边时更远范围未知；不会声称找到了完整几何或猜主体ID。

至多三个越界样本附原尺寸pages，颜色/光分开；附加boundsTimes优先，其余取越界像素最多者，全部采样位置仍有结构化数据。图为冻结源码的未裁栅格，带真实时刻和边距，没有像素覆盖标记；MCP直接返回全部页。AI可直接看图并据数值修改，避免以GUI定位或手写包装作为验收条件。viewport/asset声明随run冻结，compare报告条件差异，atlas/delivery保留声明。完整契约按需inspect core/effect。

## 从选定冻结run直接交付动画

```sh
node experiments/vfx-lab/cli.mjs inspect '{"ref":{"kind":"run","id":"替换为选定run"}}'
node experiments/vfx-lab/cli.mjs export '{"run":"替换为选定run","validationRef":"替换为同run验证","formats":["mp4","gif"],"scale":3}'
```

inspect的`delivery`报告当前PATH中的ffmpeg/ffprobe可用性与版本；动画需要两者，MP4还需要libx264，GIF需要palettegen/paletteuse过滤器。缺失或执行失败返回可恢复错误，已有图集导出不依赖编码器。CLI/MCP/HTTP调用端应继承同一PATH。编码器不作为项目运行依赖自动安装。

`formats`默认`["atlas"]`；可选`atlas/mp4/gif`，不论是否列出atlas，都保留原生`atlas.json/color.png/light.png/combined.png`。`scale`为1..4整数，默认1，只作用媒体，最近邻放大；MP4的奇数宽高在右/下填至偶数，裁切为null。动画从保存`preview.png`的manifest矩形按序解包，不执行当前作品，当前稿损坏或移走也不影响完好的保存图交付。preview可能包含作者场景和lab站立参照；它不自动成为纯特效cutout。媒体的straight RGBA在黑底合成，原生PNG保持原字节。

默认`terminal:"preserve"`保留所有保存帧，包括终点，再持有一个名义帧间隔。例如8秒/30fps的241帧输出名义8.033秒。循环可显式`terminal:"omit-loop"`去掉最后的重复接缝样本，单次作品不能用此项；atlas仍沿用既有循环末帧去重规则。保存时刻与CFR播放时刻分别记录，非整帧时长的最后一个间隔可能不同。没有任意抽帧选项；稀疏序列返回SAMPLING_INSUFFICIENT并提示显式冻结补采样、重新选定run。

`deliveryRef`指向交付清单：源run/digest、源PNG摘要、每帧原始RGBA与编码输入摘要、来源/播放时刻、编码后实际时间和时长、尺寸/填边/无音轨、编码命令与版本、同run验证及精确资产hash。返回`media`为摘要，完整帧表在清单中。MP4是有损H264/YUV420；GIF按最多255色量化且帧延迟为百分之一秒，部分播放器会夹住短延迟。默认GIF按作品loop声明播放一次或循环；MP4只编码一轮。每个媒体都做实际帧数/尺寸/时间检查及全文件解码；这不代表已观看连续动画或艺术验收。单次媒体交付有70秒共享编码检查预算，失败会移除部分交付目录，原run不变，可按单格式或较小整数放大重试。

## 运行与验证语义

- **模拟时钟**：原运行时把 dt 拆成不大于 1/120 秒的子步；240 fps 下每步发射概率会改变结果。实验适配器使用真正的 120 Hz 固定 tick，240 fps 时保持上一完整 tick。测试覆盖 30/60/240 fps 和不规则更新。纯函数保留请求时间，并消除边界处的浮点累计误差。模拟绘制时间也从 tick 整数推导，避免 0.2 秒结束落在 0.19999… 的边界误差；新后端记录为 lab-fixed-120-v2，旧快照继续使用其原后端。原库运行时未改动。
- **透明像素**：预览画布的 paste 是合成操作，不能用它向透明精灵表复制烟雾，否则 RGB 会被透明度乘暗。导出使用原始 RGBA 行复制，测试保留部分透明像素的 RGB。
- **事件采样**：均匀抽帧会跳过 1–2 帧的峰值。现在额外保留事件附近帧；仍受输出 fps 限制，比较报告实际帧时间，不伪称精确发生在事件时刻。
- **检查的边界**：只检查默认种子和颜色不够。新检查采样两个种子，同时检查颜色与光。实测原库 `ice/frost-nova` 在 seed 7 的结束样本有残留；`melee/sword-slash` 有少量画布外亮光提示。它们不是本分支引入的主库修改，报告需结合画面判断。
- **版本检查**：`validate {id}` 检查当前文件；`validate {run}` 使用冻结源码、依赖和后端从头重放。页面“检查当前版本”检查正在预览的 run。报告明确表示 frozen-source-replay，不声称已经逐帧核对保存图像。`render {target:{run}}` 可从冻结目标生成新的运行；允许显式调整 fps、背景和事件采样，不允许暗改作品选项。
- **模块缓存**：每次工具调用在新 Node 进程中执行，改动间接依赖也会生效；同时隔离异常和限制执行时间。成本是调用有启动开销。
- **比较语义**：同尺度、同锚点，按共享事件加自选 offsets 对齐；也可用 `alignment:"time",times:[...]` 比较绝对时间。报告请求时间、保存帧时间、模拟时间、取样误差、夹边、重复帧及场景差别，不给自动美感评分。

## 返回、历史与重放约定

- render 默认 `detail:"summary"`，保留 run、target、选项、事件、尺寸、原点、诊断、关键图像和 manifest 路径；完整帧表、运行环境与依赖清单在 manifest 或 `detail:"full"`。页面播放显式请求 full。
- inspect 按 effect/operator/run/tool/mechanism 等引用和所需 sections 展开；具体引用从 tools/search 取得。旧 `inspect {id}` 仍可读取作品源码。按机制查询相关契约，不必先加载完整 API 目录。
- history 接受 id/run/query/callRef至少一项；按limit/cursor列运行，callCursor/callLimit列自动调用。run检索展开同作品上下文；显式action:select才记录选择。检查run可看到它与当前文件的变化。
- 验证分析写入 `validations/validation-*.json`；冻结 run 的分析放在该 run 下，既不覆盖 manifest，也不改旧图像。导出记录附在各自目录。
- 重放固定本地相对 JavaScript 导入闭包与保存的 renderer/clock/core，要求 Node 版本、平台和架构与记录一致。动态导入、外部包、Node 文件资源和其他环境依赖尚不完整支持。静态识别是保守的依赖检查，不是任意 JavaScript 的依赖证明或沙箱；可识别缺口返回 REPLAY_UNAVAILABLE，不以当前文件替代。保存图像仍能比较和导出。
- 结束策略可用 `authoring.ending` 声明 clear/residue/persistent/handoff/loop。默认沿用单次清空、循环周期检查；允许残留不等于证明残留稳定或交接成功，未检项会列出。

```sh
node experiments/vfx-lab/cli.mjs scaffold '{"name":"my-effect","brief":"一个原创方向性冲击","template":"blank"}'
node experiments/vfx-lab/cli.mjs render '{"target":{"run":"替换为旧 run"},"fps":60,"note":"从旧版补看更密集的时间样本"}'
node experiments/vfx-lab/cli.mjs compare '{"runs":["替换为 run A","替换为 run B"],"alignment":"time","times":[0.15,0.95,1.18]}'
node experiments/vfx-lab/cli.mjs export '{"run":"替换为选定的 run","validationRef":"替换为该 run 的 validationRef"}'
```

## 路径与消融联动

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

可用`{particle,texture,material}`与schedule/domain/motion/curve组合。`material`直接适配现有fire/arcane辅助模块的六种成熟画法；particle允许换轨迹、力、生命周期和任意Painter绘制；texture支持RGBA/ASCII、序列帧与独立轴心。不是只能调固定粒子种类。

```sh
node experiments/vfx-lab/cli.mjs inspect '{"ref":{"kind":"operator","id":"core/particle"}}'
node experiments/vfx-lab/cli.mjs inspect '{"ref":{"kind":"operator","id":"core/material"}}'
node experiments/vfx-lab/cli.mjs inspect '{"id":"lab/cinder-orbit"}'
node experiments/vfx-lab/cli.mjs render '{"id":"lab/cinder-orbit","options":{"glow":0}}'
node experiments/vfx-lab/cli.mjs probe '{"run":"替换为选定run","view":"color","at":{"event":"release","offsets":[-0.1,0,0.1,0.5]}}'
node experiments/vfx-lab/cli.mjs probe '{"run":"替换为选定run","view":"particles","layers":["release"],"at":{"times":[1.2,1.5,1.8]},"limit":4}'
```

作品可选`observe(t,o)`导出粒子组；render保存Birth/State及hash，probe默认只读这些事实，草稿损坏不影响旧证据。显式`sampling:'replay'`才在冻结后端重算非保存时刻。旧作品没有声明的粒子身份不推断；trajectory连接离散观察点，真实历史用trail；动作时钟与挂点查action。任意mask/field观察、内部画面层隔离与去修改器不在该协议范围。四个保存图像视图适用于所有run，单run即可。

搜索现在隔离 helper/坏模块，返回 RESOURCE_SKIPPED、候选 ID 和修复提示，其他结果仍可用；普通辅助文件可以直接导入，下划线命名可排除发现。源码语法/导入/导出错误指向可编辑文件，参数JSON错误指向 arguments。依赖快照改用 Node 自身模块语法解析，不把注释/字符串里的 from/import 误当依赖；未支持的动态资源仍明确拒绝重放。

## 保存通道的原尺寸比较

`compare` 现在接受 `channel:"preview"|"color"|"light"|"combined"`，与 event+offsets 或绝对 times 共同使用。直接读取保存的图像，不要求改作品、重渲染或自行裁图；返回 channel、saved-images 表示、实际时间与暗色观察底。preview 沿用保存场景；color/combined 在暗色底上显示原透明图集，light 以纯黑加法中性底展示原始RGB、exposure=1，避免极弱光被当成比底更暗的剪影。它没有推断内部层或粒子身份。页面比较沿用当前观察通道。

```sh
node experiments/vfx-lab/cli.mjs compare '{"runs":["run-A","run-B"],"alignment":"time","times":[0.9,1.1,1.3,1.5],"channel":"color"}'
node experiments/vfx-lab/cli.mjs compare '{"runs":["run-A","run-B"],"event":"release","offsets":[-0.03,0,0.03,0.1],"channel":"light"}'
```

搜索的多个词目前按同一条目的 AND 匹配；复合机制无命中时返回拆词建议，不把“没匹配”声称为能力不存在。

## 带速度的共享源轨迹

`curve.scalar`的at/derivative提供解析单侧导数；affine/combine接管共享包络的仿射、和/乘积法则。`motion.source`组合平移、旋转和父子变换，`motion.pathSource`沿弧长移动；同一source用于可见主体和emitter.transform。出生速度继承包括旋转域上实际出生点的切向速度，probe返回的birth.source保存源与pointVelocity，作者无需额外debug绘制。原transform回调与自写trajectory仍可用。

```sh
node experiments/vfx-lab/cli.mjs search '{"query":"源轨迹"}'
node experiments/vfx-lab/cli.mjs inspect '{"ref":{"kind":"operator","id":"core/motion"}}'
node experiments/vfx-lab/cli.mjs inspect '{"ref":{"kind":"operator","id":"core/curve"}}'
node experiments/vfx-lab/cli.mjs inspect '{"id":"lab/source-shuttle"}'
node experiments/vfx-lab/cli.mjs render '{"id":"lab/source-shuttle"}'
```

默认按右时间侧处理停顿/折点，left/error可显式选择，返回导数策略与corner/jump提示；hold跳跃没有有限穿越速度。PathSource不从分段切线伪造平滑角速度。任意函数可用sampledSource，但必须指定固定秒距与范围，结果报告差分模板与未知误差界，不依赖输出fps。精确单位/签名见公开API；代码来源、技术回归与独立创作范围分别记录在[当轮归档](evaluations/2026-11-06-source-trajectory/README.md)。

源本身也可真实观测：`observe(t,o)`返回`sources:[motion.observeSource(axis,t,{id:'axis'})]`，与particles数组可共存；`probe {run,view:'sources',layers:['axis'],at:{times:[...]}}`直接读源位置、平移/角速度及导数策略。无需造不绘制的粒子来查看轴状态；默认保存证据/显式冻结重放沿用原身份规则。旧run未声明源时明确不支持，effect之外的空间需显式转换。

## 接触事件与二次出生

`core/contact`提供点主体对静态水平面的解析接触，以及反弹/停留/停止/死亡响应。`contact.events`纯读取，`contact.births`依事件身份生成稳定子出生；不随draw、输出fps或窗口读取重复触发。直接复用原库水滴/涟漪画法的waterDrop/ripple可独立替换。参看可运行`lab/landing-relay`、contact-response配方和公开API。

`observe`可声明完整contacts表；`probe {run,view:"contacts",window:{from:0,to:1},limit:24}`读取保存事件或显式冻结重放，不使用最近帧时间。该视图不接受at/fields，layers为事件组、particles为父ID。范围为effect空间、恒加速度/分轴阻力；不与force/trajectory/kill混用，不是任意形状碰撞。独立创作与实际边界见[测评归档](evaluations/2026-11-06-contact-events/README.md)。

## 真实历史拖尾

`core/trail`与`particle.track`按出生锚定的固定时间网格重建过去位置，保留接触corner、停留时刻和显式break/null缺段；选择秒或采样折线的像素长度、physical/render位置、死亡后freeze/fade/shrink/clear。条带直接复用原path的连续像素栅格，宽度/颜色/横截面仍可自写，不用速度短线冒充历史。可拆参考`lab/rebound-loom`和history-ribbon配方。

`observe`声明trails后，`probe {run,view:"trails",at:{times:[1.2,1.8]},sampling:"saved"}`返回真实历史frame、点时间/实际运动时钟和原尺寸点图；layers选择组、tracks选择稳定trail ID。replay从冻结后端重建，旧run不补造。默认12条，结果报告省略数；该视图不接受fields/particles/window。

当前只保证所声明时间采样和折线语义，不保证任意曲线的空间误差。每轨道<=12秒，maxSamples默认2048、最高4096；整frame最多20000次求值/10000点，所有观察共享16MB，超限拒绝不默默降采样。自定义跳变必须显式声明，replacement trajectory的终点不猜测。独立原创、修复与剩余负担见[当轮测评](evaluations/2026-11-06-history-trails/README.md)。

## 动作、目标表面与完整观察

动作/角色创作：先search动作或hitstop，再inspect core/action与配方action-attachment。action提供负时间预备动作、显式停顿、12Hz保持姿态、真实IK挂点、事件转播放秒、自画角色和原状态观察，例子lab/action-relay。完整legacy act仍用tools/act.mjs；目标响应、摇屏与状态关系另查combat/status等契约，不由action自动推断。

身体表面创作：search身体表面、inspect core/surface与surface-fracture配方。普通JS声明局部遮罩，可绑定program body或实际IK骨段，轮廓/材质/裂纹/消失/脱离出生共用材质格，例子lab/frost-release。surface.births已映射effect位置，使用initial.velocityOffset:surface.inheritVelocity()可保留真实点速度；draw与observe传相同keepMask。

完整状态可使用无损帧封装，不丢身份、时刻或改变采样率；manifest的observation.frameEncoding/frameDecodedBytes记录实际编码和大小。probe在选取前透明展开，新旧格式均通过公开调用读取；无需作者手写解码器。容量超限按实际错误中的字节和恢复建议处理，准确限额查公开契约。

## 外部素材与独立游戏资产消费

作品可export assets对象或纯assets(options)声明本地PNG、规则图集或序列；渲染在options.assets注入Texture/Texture[]。原字节、alpha/pivot、拆帧与资源摘要独立随run冻结。缺稿/缺素材后仍用target.run重放；原素材变更不会改变旧run。见公开core/assets、core/texture和lab/asset-relay；不需手写像素数组或fs冻结。

每次export自动附哈希pack.json及playback.mjs/load-node.mjs/png.mjs；完整目录移到仓库外即可用独立模块消费，不依赖作者源码/SDK/服务器。精确帧秒、轴心、实例、loop事件、nearest采样与色光合成由模块承担。普通JS继续提供场景坐标、跟随/脱离、depth和游戏事实。见core/playback和game-delivery。烘焙资产的取消/解除需交付真实匹配版本/相位outro；stopAt只是硬截止，不冒充任意内部粒子的自然尾部。
