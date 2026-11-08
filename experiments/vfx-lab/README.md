# AI 创作者快速入口

用普通 JavaScript 制作特效，通过结构化工具查找、运行、看原图、局改和交付。主角是 AI 创作者；人类可预览和反馈，创作不依赖操作参数编辑器。

继续已有作品先看[生产索引](productions/README.md)。当前持久入口是`lab/fireball-master`和`lab/smoke-master`；它们随Git保存，不依赖本机drafts。

## 先得到一个可见草稿

仓库根目录使用 Node 18+，先 npm install。若本机 Node 或编码器不可用，查[运行说明](../../docs/ai-vfx-tools/ENVIRONMENT.md)。

```sh
node experiments/vfx-lab/cli.mjs tools
node experiments/vfx-lab/cli.mjs scaffold '{"name":"my-effect","brief":"要表现的用途、主轮廓和一个待验证问题","template":"blank"}'
```

编辑返回的 JS 文件，然后 render 其 id。已有参考用 search 找，再 inspect 所需的源码/契约/例子；不必先读完整 Schema 或 API 手册。blank 提供接口，默认 example 提供可改写示例，造型与材质由作者选择。

需要借用作品中的局部技法时，`inspect {id:'explosions/smoke-bomb',sections:['reuse']}`列出真实库helper、导出和对应机制；加`source`可读这些库模块，保留署名。也可按`lobe`、`cloud`等原函数名search，再inspect返回的mechanism契约及`reuse`中的可替换输入。普通JS可直接import原helper，或用material等已有SDK适配，不必复制整件作品。

## 看图、修改、再决定

1. render 保存一个 run；用 probe 的图像窗口实际看原尺寸，用真实声明对象视图检查相关事实。
2. 根据画面提出具体修改假设，再改普通 JS。结构/材质/时序可以独立变化，compare 用于比较明确版本。
3. 准备交付时明确选版，验证该冻结 run，再导出同一版。技术通过与艺术选择分别记录。

例如在已完成改稿后，固定要交付的版本：

```js
import {invoke} from './experiments/vfx-lab/invoke.mjs';
const r=await invoke('render',{id:'draft/my-effect'});
const p=await invoke('probe',{run:r.run,view:'combined',window:{from:0,to:.3}});
// 用图像工具实际查看 p.pages 中的原尺寸图；这里不自动判断已观看或美术质量。
await invoke('history',{action:'select',run:r.run,reason:'根据实际观察选择此版',evidence:[p.callRef]});
const v=await invoke('validate',{run:r.run});
if(v.passed) await invoke('export',{run:r.run,validationRef:v.validationRef});
```

不要为每次早期尝试重复完整交付步骤。需要媒体、缺源重放、边界定位、启停或保存对象观察时，再查[工作流按需说明](WORKFLOWS.md)。

## 只展开当前需要的契约

```sh
node experiments/vfx-lab/cli.mjs tools '{"name":"fx_probe"}'
node experiments/vfx-lab/cli.mjs inspect '{"ref":{"kind":"operator","id":"core/particle"}}'
```

[工具分工](../../docs/ai-vfx-tools/tool-contracts.md)帮助选入口，[公开 API](../../docs/ai-vfx-tools/authoring-api.md)供查签名。CLI 返回一行 JSON，也接受 stdin；MCP 入口为本目录 mcp.mjs，HTTP/可选本地页面用 npm run lab。三个调用端共用定义。

所有公共调用会记录 callRef；原错误和结果用 history 找回。id 是当前源码，run 是保存版本；修改当前文件不会改写旧图像。probe/compare 返回保存时刻与实际误差，不从画面猜没有声明的对象。

交接时可调用`history {action:'bundle',run:'明确run'}`：自动复制各稿调用/原错误、原尺寸图、验证和导出，返回有SHA的index.json与可编辑报告。可选annotations补意图、改动、判断及未测范围；viewed只填写自己实际看过的图像callRef，工具不会把交图算作已观看。选版、验证、审批仍保留各自身份。

## 交付和入库

export 默认保留精确图集、色层和加法光层，MP4/GIF 是可选预览并需要编码器。独立消费包可移出仓库使用；原尺寸分件与作者自己画入的场景物件需在作品中明确区分。

正式收录用 library 的 plan/install/status/recover：以选定、验证通过的冻结 run 计划搬运和逐帧核对，再按用户已有的准确批准范围执行。既有批准不重复确认；作者选版或技术通过不自动成为用户审批。[完整入库契约](../../docs/ai-vfx-tools/library-installation.md)。

需要制作什么可以直接从任务开始；研发状态、历史和未来路线不是创作的前置阅读。研发接手走[项目入口](../../docs/ai-vfx-tools/README.md)中的专门链路。
