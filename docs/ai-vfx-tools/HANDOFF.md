# AI 像素特效工具台研发交接

日期：2026-11-06（Asia/Shanghai）。实验分支：`codex/ai-vfx-lab-mvp`。远程：`origin`，`git@github.com:xingxingxiaoguang/athanor.git`。

本文面向接手研发的agent，可以读实现、测试与证据并修改平台。功能验收的独立创作者使用单独上下文和隔离构建，不能读本文或工具/SDK实现。开放源码生产检验与黑盒创作门分别记录。

产品目标是参考与技法库、可组合创作能力、观察和实验流程。研发以实际创作负担为依据：既承担稳定计算与复验，也承担动作接入、主体组合、原尺寸时序观察和成片交付。独特造型、材质语言、构图与艺术取舍由作者决定。

## 1 接手后的前五件事

1. 读根目录[AGENTS.md](../../AGENTS.md)，检查工作树、分支和Node版本，不覆盖已有草稿与未提交改动。有`.codegraph/`先用CodeGraph，无则跳过，不自动索引。
2. 运行`npm run lab:test`。已记录基线为73项通过，按文件串行，因为测试写共享catalog/records；它们不代替艺术验收。
3. 执行第4节的干净仓库演练，实际看原尺寸图像、查公开状态、比较、冻结验证并导出同一个run。
4. 读[气功波生产日志](../../experiments/vfx-lab/productions/2026-11-06-anime-vfx/kamehameha/production-log.md)、[地爆天星生产日志](../../experiments/vfx-lab/productions/2026-11-06-anime-vfx/chibaku-tensei/production-log.md)及各自tool-review，区分艺术工作、重复工程、作者错误与产品缺口。按任务再查[独立测评证据](creator-evaluation.md)。
5. **从工作包3.1“冻结动画交付”开始**，按第9节推进。先补短小生产闭环，再进入动作挂点、程序主体、身体表面、技法复用与聚合；每个子闭环均需新的独立创作者。

| 文档 | 权威范围 |
| --- | --- |
| [产品全景](README.md) | 产品目标、创作职责、完整场景与阶段要求 |
| [实施状态](implementation-status.md) | 现行可用能力、未交付范围与证据索引 |
| [公开API](authoring-api.md) | 已实现SDK签名、单位、默认值、示例；被inspect按标题解析 |
| [工具目标契约](tool-contracts.md) | 完整目标语义，含未实现设计 |
| [definitions.mjs](../../experiments/vfx-lab/definitions.mjs) | 现行9工具可执行Schema |
| [实现地图](implementation-map.md) | 两大基石的代码来源、直接复用与通用化边界 |
| [独立测评](creator-evaluation.md) | 每个功能闭环的创作门与评价方法 |
| [工具使用说明](../../experiments/vfx-lab/README.md) | 当前命令、产物与限制 |

发生不一致时，以实际Schema、实现和可复现调用确认当前行为；目标设计不能证明功能已经可用。

## 2 两大实现基石与生产原则

### 2.1 原效果库是算法与代码来源

原库统计为244个效果、21个分类、20个分类辅助模块，口径见[inventory.json](inventory.json)。新增公共能力前，读相关`src/fx/<category>/<effect>.js`、`_lib.js`与`src/core/`，记录具体符号、成熟行为、直接调用或通用化理由、兼容边界和验证方法。代码中的采样、材质、角色与编排都是提炼来源。

已交付的motion/schedule/particle来自fly/flyV、cycle/looped、出生时采样源位置等机制；material直接适配fire/arcane/water成熟画法；contact与trail分别复用求根、二次响应、历史采样与连续栅格。新SDK独立入口为`src/authoring/index.js`，不改写旧效果的运行语义。保留Sprite Fusion、Hugo Duprez及MIT等来源署名。

当前优先复用入口：`tools/lib/fxlib.mjs`的writeVideo/contactSheet/renderAct、`core/act/rig/actor`的时钟与姿态、`arcane-beam/spell-charge/charge-up`的束流/蓄力、`nature/_lib`的分面石头、`status/_lib`的身体扫描、`ice/_lib`的裂纹，以及黑洞/地击/变形中的到达与主体变化。候选片段不自动成为稳定API。

### 2.2 Spine Particle提供底层机制对照

[参考平台](https://tsnm-spine-particle.com/)用于对照发射域、出生属性、运动/外观分离、速度继承、寿命、资源轴心、序列时钟、轨迹与条带等底层能力，不复刻其人类编辑器。

[研究目录](../../experiments/vfx-lab/research/tsnm-spine-particle/README.md)保存了公开生产JS的固定URL/hash、提取方法与数值探测；未取得完整开发源码。读取新机制时重新核对实际加载构建，不把记录中的压缩符号当当前源码名，不执行整包。原始bundle放ignored records，不能成为运行依赖。沿用本项目像素/秒/弧度、固定时钟和稳定身份，不照搬内部倍率或输出fps耦合。

### 2.3 创作与产品的职责

两份生产日志具体支持以下研发要求：

- 动画编码、逐帧解包、原尺寸分段拼图和公共调用记录由工具承担；艺术作者选择观察窗口、解释画面并选版。
- 视口、空间转换、动作挂点、公共时钟、分层绘制与显式观察提供可复用适配；人物剪影、岩球材质和地景设计保持自由代码。
- 束流的主体/头尾/色带、岩石的形状/分面/描边、到达/生长等方法以可拆部件和可展开配方提供，作者能跨题材重排。
- 自画主体与粒子都能接共享状态和真实观察；不强制把所有对象迁入粒子，不从像素补造身份。
- 实验围绕轮廓、节奏、因果等艺术假设控制变量；换seed只检验分布，不算结构探索。
- 不以运行成功、日志齐全或测试全绿证明美感、净节时或能力飞跃。实际观看形式与未检范围必须写清。

## 3 当前能力与阶段

现行9工具为`fx_search / fx_inspect / fx_scaffold / fx_render / fx_compare / fx_probe / fx_validate / fx_history / fx_export`；正式`fx_reuse / fx_explore`未实现。15个SDK命名空间、19族公开API和9份配方的可用子集以[实施状态](implementation-status.md)为准。

| 阶段 | 当前状态 | 完成条件 |
| --- | --- | --- |
| A 契约与证据 | 已有公开定义、冻结身份、历史、观察/验证/导出及独立证据 | 保持精确契约、旧run可复查、兼容与错误可恢复 |
| B 创作核心 | 路径/图像/粒子、源轨迹、静态平地接触与真实历史已交付；完整身体/动作未验收 | 两个完整场景都可原创、局改和复验，包含非粒子主体与因果联动 |
| C 复用与实验 | 已有保存色光、声明粒子/源/接触/历史观察 | 可拆部件、来源/依赖/替换点、真实主体观察与受控结构探索 |
| D 扩展与生产 | 完整阶段未验收 | 按真实任务分别完成媒体、资产、缓存及目标引擎验证 |

两个B场景是“非对称熔渣内收与冲拳”和“角色结霜后沿裂纹消失”。生产动画不替代这两项身体/动作验收；媒体交付和观察按生产负担提前补齐，保持子集与整阶段完成的区别。

## 4 环境与干净仓库演练

Node声明≥18，当前工作区可用v24.13.0。冻结重放要求Node版本、platform、arch与保存环境相同；新渲染不要求沿用某台机器。遇本机Node动态库缺失，选择已安装且可用的版本。仓库无新增运行依赖，开发依赖为esbuild。

从仓库根执行`node --version`、`npm ci`、`npm run lab:test`、`npm run lab:tools`、`npm run lab`。页面默认`http://127.0.0.1:4173/`；端口占用先确认归属，或用`node experiments/vfx-lab/server.mjs 4174`，不要广泛终止其他Node进程。

### 不依赖历史raw的完整技术链

从仓库根执行，使用实时返回的run/validationRef，不要求历史records存在：

```sh
node --input-type=module - <<'JS'
import { invoke } from './experiments/vfx-lab/invoke.mjs';
import { writeFileSync } from 'node:fs';
const calls = [];
async function call(tool, args) {
  const result = await invoke(tool, args);
  calls.push({ tool, arguments: args, result });
  return result;
}
await call('inspect', { ref: { kind: 'operator', id: 'core/particle' } });
const a = await call('render', { id: 'lab/cinder-orbit', note: 'handoff baseline' });
const b = await call('render', { id: 'lab/cinder-orbit', options: { glow: 0 }, note: 'same design without outer light' });
const color = await call('probe', { run: a.run, view: 'color', at: { times: [0.8, 1.2, 1.8] } });
const light = await call('probe', { run: a.run, view: 'light', at: { times: [0.8, 1.2, 1.8] } });
const states = await call('probe', {
  run: a.run, view: 'particles', layers: ['nozzle--1'], limit: 2,
  at: { times: [0.2, 0.4, 0.7] },
  fields: ['position', 'velocity', 'age01', 'texture', 'tint', 'blend']
});
const comparison = await call('compare', {
  runs: [a.run, b.run], channel: 'color', alignment: 'time', times: [0.8, 1.2, 1.8]
});
const validation = await call('validate', { run: a.run });
if (!validation.passed) throw new Error(JSON.stringify(validation.errors));
const exported = await call('export', { run: a.run, validationRef: validation.validationRef });
writeFileSync('records/vfx-lab/handoff-smoke.json', JSON.stringify(calls, null, 2) + '\n');
console.log(JSON.stringify({ run: a.run, contact: a.image, color: color.image,
  light: light.image, particles: states.image, comparison: comparison.image,
  validationRef: validation.validationRef, exported: exported.directory }, null, 2));
JS
```

实际用图像查看工具打开contact/color/comparison；也看light黑底窗口。技术脚本通过不等于已经看过图或审美成立。若需要检验连续节奏，另看连续播放/足够密集帧；不能只看接触表就声称没有帧间闪烁。

### 生产作品的接手验证

`lab/kamehameha-storm`与`lab/chibaku-tensei`已在effects目录，可直接inspect/render。它们分别需要8秒/241帧和9秒/271帧的30fps运行，接近现行帧像素预算；完整渲染应使用实际可用环境。

在干净克隆中重新渲染会生成当前工具的新run，不能沿用归档的validationRef或冒称恢复了旧后端。仅有轻量源码时，可以审查生产日志并生成新作品；历史重放需要完整冻结raw与匹配运行环境。原始大包路径、媒体与hash见[生产交付索引](../../experiments/vfx-lab/productions/2026-11-06-anime-vfx/README.md)。

## 5 代码地图与改动入口

```text
src/core/                         原运行时、Painter、颜色、粒子、角色/rig/act
src/fx/<category>/*.js            原244个作品与20个分类_lib；算法提炼来源
src/authoring/index.js            新SDK独立入口（15个命名空间）
src/authoring/contract.js         AuthoringError、单位/数值/颜色/空间检查
src/authoring/*.js                精确算子实现
experiments/vfx-lab/definitions.mjs  现行9工具Schema
experiments/vfx-lab/contracts.mjs    API家族索引、别名、文档按节解析与修订
experiments/vfx-lab/recipes.mjs      九份机制配方；不是固定作品模板
experiments/vfx-lab/lab.mjs          effect加载、采样、render/compare/validate/history/export
experiments/vfx-lab/clock.js         旧入口的实验固定tick适配
experiments/vfx-lab/source-parser.mjs Node模块语法解析、静态导入闭包
experiments/vfx-lab/replay.mjs       摘要/作品修订、支持检测、冻结临时目录重建
experiments/vfx-lab/observation.mjs  粒子/源/接触/历史观测协议、字段单位与保存序列检查
experiments/vfx-lab/history-storage.mjs 无损历史点索引/旧v1展开兼容
experiments/vfx-lab/probe.mjs        保存图或观测读取、显式冻结probe、局部表/图
experiments/vfx-lab/cli.mjs          JSON CLI，单行结果/结构化错误
experiments/vfx-lab/invoke.mjs       新子进程执行、串行队列、超时与返回体预算
experiments/vfx-lab/mcp.mjs          stdio MCP；结果图片以MCP image返回
experiments/vfx-lab/server.mjs       localhost HTTP；调用invoke，提供保存图像
experiments/vfx-lab/app.js/index.html  人类观察与比较页面
experiments/vfx-lab/effects/         开发参考与生产作品，包括cinder-orbit/rebound-loom/kamehameha-storm/chibaku-tensei
experiments/vfx-lab/templates/       blank模板
experiments/vfx-lab/*test.mjs        六份技术测试，共73项当前基线
tools/lib/png.mjs                   原编码器 + 新RGBA8解码/CRC/五种滤波
tools/lib/fxlib.mjs                 原效果发现/加载、图像/视频等通用工具
```

现行调用链：CLI直接execute；MCP和HTTP经invoke启动新的CLI进程。修改间接依赖后要用新的公开工具调用，不能依赖同一Node进程的ESM缓存自动失效。`lab.mjs`里只给入口加query不能解决整个传递依赖缓存。

新增能力的常见改动集：

1. `src/authoring/<family>.js`及必要的index导出，保持浏览器可用的算法层无Node依赖。
2. `authoring-api.md`对应`## core/name`及`### overview/contract/example/pitfalls/evidence`。inspect按这些标题解析；随意改标题会使公开契约丢失。
3. `contracts.mjs`中的摘要、英文/中文别名、源码位置，必要时`recipes.mjs`登记机制与参考。
4. 若变更工具输入/输出，更新`definitions.mjs`；若增观测字段，更新`observation.mjs`的枚举/单位及probe返回，不只修改文档。
5. 对应技术测试、可执行参考、实现来源记录、独立创作及修复证据、实施状态。新增包入口时检查`package.json`，没有实际需要不加依赖。

## 6 必须保住的运行与数据语义

### 6.1 时间、空间与身份

- 坐标为本地艺术像素，+x向右、+y向下，角度弧度。作品原点由lab放置，作者不把屏幕位置混入局部几何。其他space需明确转换，身体空间未自动适配。
- 原库createFx的“小于等于1/120子步”不等同实验固定120Hz。实验`clockedFx`对create入口只走完整tick，draw时间由tick整数推导；pure入口保留请求时间并规范边界浮点误差。不要直接替换244个效果的旧运行时。
- 新`motion.integrate`即使被pure draw调用，也以**粒子出生年龄**为120Hz格点，返回simulationAge。粒子age/age01可能比物理simulationAge稍大，表中要明确，不能拿输出fps改变求解步长。
- scene/local秒、粒子age01、path.s分别有意义。本实验未接入动作播放时间，不能将probe的effect clock冒充受击停顿后的playback clock。
- 随机按seed/layer/particle/channel隔离；属性相关性显式通过同一通道或data表达。新增颜色抽样不应改变速度/寿命/出生位置。数组重排也不能无意重排身份随机。
- cycle的copy ID不同、randomId相同；lifeMax决定前置/重叠副本窗口。终止区间通常为`[born,born+life)`，rate为`[start,end)`；修改这些边界要有专门证据。
- Mask网格、origin、space与内容修订要匹配；rank/arrival依赖原Mask，换轮廓要重建。动态差分只说明区间实际增删，不能伪造每个像素的精确出生时刻。首次到达出生走静态arrival/dissolveEvents。

### 6.2 像素、材质与观察

- 原Painter需要Color32整数（内存RGBA字节），不直接接收CSS字符串。新SDK边界检查hex/Color32；用hex/fit转换，不让空画面被当作颜色合法。
- soft透明保留straight RGB。向透明图集复制用原RGBA行复制，不能用普通paste合成导致RGB被alpha乘暗；透明像素中的RGB也可能有意义。
- light是独立加法RGB。保存light图像里的非零像素可以有opaque alpha；检查时使用**纯黑中性底、曝光1**，不能alpha贴到灰底制造弱光黑剪影。
- texture默认逆向最近像素采样；不静默平滑或缩小整个作品。blend的dither/soft/additive是作者的材质选择。
- material直接复用库内函数。程序材质不自动把所有state.scale/rotation应用成贴图变换；按公开契约将size/velocity等绑定进去。custom draw可以覆盖tint/blend，probe只报告声明状态，不反推自写shader。
- 位置的视觉offset不写回物理速度；basePosition和position分开。不要把仅按velocity伸长的spark、程序strip或probe连线称为真实历史尾迹。
- 无真实观测点的旧作品只承诺整体色光观察。当前observe接受声明的粒子、真实源、接触与历史；不能用几个层名称冒充内部层隔离或任意field探测。源状态只支持effect空间，旧run不从合成粒子反推来源。

### 6.3 冻结运行与分析身份

| 身份/产物 | 语义 |
| --- | --- |
| effect id | `category/name`当前源码；`lab/...`指开发参考，`draft/...`指ignored草稿 |
| revision | 作品依赖源码闭包+实际选项，不与整个工具后端摘要混同 |
| sourceDigest | 包含所保存求值后端的完整JS快照摘要 |
| run | 另固定场景、fps、事件、环境与输出；每次生成新身份 |
| parentRun | 显式从冻结旧run补采样生成的子运行，旧作品修订保留 |
| validationRef/probeRef/export | 引用明确运行及各自条件；不是“最新版本”的代称 |

`compare`、保存图probe和export读保存图像；默认粒子probe读保存observations。它们不执行当前草稿。`validate {run}`和明确的replay用保存源码/依赖/后端，在临时ESM目录从头重建；不回退到当前文件。`validate {id}`检查当前文件，不能拿它证明旧run。

静态导入闭包使用Node的SourceTextModule语法解析子进程，不能退回匹配`from/import`的正则。`replaySupport`另作保守的动态依赖检查；只支持相对本地JS，外部文件、包、动态import、环境依赖尚未完整冻结。缺口报REPLAY_UNAVAILABLE，不删掉检测去“修好”重放。

export必须明确选定run；validationRef必须属于同一个run。history最新条目不等于作者选定，公共history在没有决策协议时decision为null是诚实行为。验证的`savedFramesVerified:false`表示检查了冻结源码重放，不是穷举核对已保存每帧。

## 7 证据与可移植性

功能证据与原报告由[测评索引](creator-evaluation.md)连接，能力结论由[实施状态](implementation-status.md)限定。原报告、原始失败、修复构建和独立补测分别保存；现行研发文档只写当前方案，不追加修订流水。

开放源码生产检验完成六版气功波和四版地爆天星，工具/SDK未修改；安装后512帧预览与选定冻结run一致。它提供了生产方向的依据，不是黑盒可发现性验收，也没有净节时或能力跃迁的对照证据。两位作者看过原尺寸关键帧与密集帧，未连续观看媒体；维护者浏览器抽查另外登记。

Git中的轻量目录包括代码、研究记录、原报告、关键帧和构建/交付身份。`records/`、`drafts/`、node_modules及临时浏览器产物被忽略；不要假定干净克隆拥有完整raw。绝对路径是当时证据，不能冒充另一台机器的现行路径。缺包时明确未复验，不能用当前稿替代旧run。

## 8 每个功能闭环的执行方法

1. 明确一个真实创作任务、作者正在重复写的工程、输入输出与单位/空间/时间/身份，以及必须保留的艺术自由。观察、交付和算法都可以独立形成闭环。
2. 检查两大基石的相关实现，记录文件/符号、原行为、直接复用或通用化理由、兼容边界和验证方法。优先适配成熟能力。
3. 实现可组合子集，同步公开Schema、文档、别名、例子及必要技术回归。不要让未来设计字段进入未实现的公开承诺。
4. 固定隔离快照，以相对路径→SHA256清单和规范化总摘要记录实际构建，包含未提交实现；记录排除项。执行所需文件可以存在，独立作者明确禁止读工具/SDK/runtime实现、测试、sources.json、开发笔记或其他作者方案。
5. 新建`fork_turns:"none"`的独立创作者，只给任务、构建身份、公开工具发现/API/参考效果入口与可写区域。普通JavaScript编辑是正常产品使用。至少完成两类有意义局改，实际观察原尺寸图像与适合任务的时间窗口。
6. 要求作者保留调用、原始错误、作品版本、选版依据、观察形式和三维评价：创意帮助/限制、操作负担、机制复用带来的具体帮助。公共日志应由工具逐步承担，不把报告篇幅和调用数量当成功指标。
7. 明确选择同一个run做validate/export；媒体也从该run保存帧派生。历史/重放按功能相关性检验。实际播放、顺序密集帧与全文件解码分别记录，不能互相替代。
8. 修复确认问题时保留原报告/原构建，原作者在新快照仅经公开调用补测，另记结果。新功能使用新作者；修复补测可以沿用原作者。
9. 技术事实、艺术选择、作者误用和产品缺口分开。可用迁移前后等价对照证明减少某段重复工程，再用跨题材新局改检验通用性；没有匹配基线，不宣称净省时或普遍艺术提升。

功能轻量证据归档`experiments/vfx-lab/evaluations/`，大raw放`records/vfx-lab/creator-evaluations/`；用户明确开放源码的生产任务单列productions及其raw目录，不能计作黑盒门。源码、日志与原报告不随当前路线维护而改写。

## 9 后续研发路线：具体工作包与验收

以下为待实施方案，详细参数须在交付时进入现行Schema/API。一个工作包内的子项按独立功能闭环依次交付，每项都经过新独立创作者，不一次堆成大框架。

### 工作包3：生产观察与交付

**3.1 冻结动画交付——下一项。** 直接消费明确选择run的保存帧及manifest矩形，输出完整MP4/GIF与交付清单。适配`tools/lib/fxlib.mjs`的writeVideo/upscale及现行export，不另造作品求值器。编码器可用性和失败应可恢复。

验收：当前源码修改或缺失时仍能从完好的保存帧交付；validationRef只能关联同run；记录源run/digest、实际帧表/帧率/时长、端点帧、整数放大、裁切/填边、颜色量化/有损与音轨情况。默认保留完整时间序列，显式抽帧必须记录选择。精确PNG/color/additive light保留，媒体不冒充无损资产。旧atlas调用继续有效；稀疏帧不足时明确补采样，不能暗渲当前稿。

独立作者任务需包含短促爆发和长期残留/循环中的至少一种，自行选版并交付，不写图集解包或编码脚本；检查交付对应同一冻结选择。没有证明的引擎适配不计入完成。

**3.2 原尺寸时序观察与公共记录。** 事件/绝对窗口生成带真实时间的顺序密集帧、分段网格和可用的局部播放入口，控制宿主缩图风险。优先读保存帧，额外采样沿冻结后端和分析身份。适配contactSheet、compare/probe与已有页面；把公共调用、分析引用和选择记录留给工具，不要求作者另造日志系统。

验收：作者能比较前后版的释放或汇聚窗口而不用改作品/裁图/重排；请求与实际时间、重复/缺帧、像素尺度明确；调用端不能播放时提供可实际查看的原尺寸分段证据并如实标记。状态默认选择应允许找到当前时刻的活跃对象，保留显式ID选择。技术解码成功不等于已观看或动作质量通过。

### 工作包4：视口与边界定位

声明作品输出是需要完整边界的资产，还是允许内容出画的视口；从明确矩形和裁切开始。复用Painter空间变换、现行margin检查与原库actBounds。裁切保持color/light一致、冻结可复现，不让作者包装raw-write方法。

验收：有意出画无需改几何或加底层包装，画内像素保持；未声明裁切的无意越界仍失败并返回时间、通道、越界区域/范围，具备真实主体或层声明时再关联ID。不能凭像素猜对象，也不能把扩大画布或关闭验证当解决。覆盖旋转/翻转/光晕、完整场景与独立资产，记录被裁部分及交付边界。

### 工作包5：动作、程序主体与身体场景

**5.1 动作时钟与挂点。** 提炼`core/act/rig/actor/chain`、`tools/lib/fxlib.renderAct`和moves编排，将角色、手部/武器挂点、发射源与特效事件接在共享状态上。接已有motion.source，不重复发明源轨迹。明确播放与局部时间、held pose/命中停顿、父子空间和前后层。挂点速度需注明解析、显式差分或离散跳变策略。

验收：改人物动作或释放时机时，能量源、出生与可见手部同步；停顿/跳转/翻转及冻结重放一致。允许替换角色和自写绘制，不强制使用库内人物。完整act和站立参照分别声明。

**5.2 程序主体的变换、分层与观察。** 自画岩块、连续束体、符号等能把同一可声明状态用于绘制/发射/观察；复用Painter与rig投影/深度机制，先覆盖明确的变换和遮挡子集。身份、范围、空间和深度可查询，无需强制迁入particle或另维护调试副本。

验收：作者改变形状/材质而保留运动与身份；能查到自画主体在选定时刻的位置和声明状态，并观察真实支持的层。没有声明的旧模块继续整体观察。近似/占位velocity保持作者数据的属性，不能升级成已验证物理速度。

**5.3 身体表面、裂纹与变化因果。** 读取`status/_lib`的身体边界/列顶/行范围/法线，`status/frozen`、`transitions/burn-away/pixel-dissolve`、`ice/_lib`裂纹。先公共化身体特征与空间转换，再连接arrival/change、衍生碎屑与动作。

验收回到产品全景的两条B场景：非对称熔渣内收与冲拳、角色结霜后沿裂纹消失。必须包含移动身体、非粒子主体、前后遮挡、传播/变化因果、跳转不重发和明确结束/转交。每个子能力仍单独经过新作者；两部动漫生产作品不替代B验收。

### 工作包6：局部技法复用与艺术探索

**6.1 可拆部件与可展开配方。** `fx_reuse`先支持边界清楚的成熟部件，记录出处/署名、修订、依赖、输入输出、替换点和隔离预览。候选包括arcane-beam的横截面/亮丝/源与头尾、spell-charge/charge-up的内收/压缩、nature/_lib的形状/分面/描边，以及刀光/裂纹/水滴/烟材质。

阶段关系提供可重排示例：蓄力→压缩→推进→持续→退场，拔起→输送→到达→聚合→留场。它们是普通代码组合起点，不能成为固定作品DSL或必须遵循的招式模板。

验收：新作者在不同题材替换结构、材质或时序，不复制完整角色/地形；有来源和迁移前后对照，未模块化片段只承诺候选准备。艺术造型代码不作为应删除的工程量。

**6.2 围绕艺术假设的受控结构实验。** `fx_explore`接受作者指定的参数轴或已经编辑好的结构候选，固定其他运行条件，按事件窗口比较。问题可为束头是否像管口、退场是否平切、主体增长与到达是否脱节；输出证据和条件，不替作者选最美版本。

验收：作者能比较至少两种实质结构/运动选择，并说明哪些因素保持、哪些实际变动；不仅换seed。没有真实观测的场或层不补造，实验成本/采样与来源可查。

### 工作包7：到达、聚合与主体变化

从`black-hole/implosion`、地击/裂纹/生长实现、现行contact/arrival和地爆天星生产代码核对候选；参考平台用于对照延迟汇聚、目标、寿命与到达机制。先选一个明确目标域和可重建运动，打通到达事件→累计量→主体变化，保留作者自定义质量/权重/增长映射。

验收：分布、轨道、目标面、到达和累计身份稳定，跳转/跨fps不重复；同一结果驱动主体及反馈。用碎片重组、结晶或召唤等跨题材复杂原创检验，不能只复刻球体缩放。不预先承诺任意碰撞、刚体堆积、物理质量守恒或自动裂缝吻合。

### 工作包8：按实际任务扩展生产能力

外部资产冻结、向量场、scroll/warp/advect、破碎/材质包、缓存/检查点与引擎适配分别拆闭环。资源需ID、字节摘要、清单、缺失诊断和冻结重建；不删除依赖阻断来伪装修复。优化保留像素、随机和时钟语义，性能附真实环境。Unity/Godot等引擎实际导入分别验证；PNG+JSON生成成功不代替引擎测试。

## 10 测试与日常排错

```sh
npm run lab:test
git diff --check
node --test --test-concurrency=1 experiments/vfx-lab/particle.test.mjs
node experiments/vfx-lab/cli.mjs inspect '{"ref":{"kind":"operator","id":"core/motion"}}'
```

六份技术测试共73项当前基线。新增求解、身份、时钟、像素或依赖语义需有对应回归；文案与低影响可逆改动不堆实现镜像测试。对接编码器要验证真实媒体及失败恢复，不能只模拟成功返回。

| 现象 | 入口与边界 |
| --- | --- |
| 模块加载错误 | 查错误指向的作品文件和静态导入；helper可用下划线排除发现 |
| 空画面/暗剪影 | 查Color32、结束/时刻、原色层与黑底原光，不凭空断言根因 |
| 属性不可probe | 对照observations枚举/单位、definitions与probe；未声明能力明确拒绝 |
| REPLAY_UNAVAILABLE | 查完整raw、runtime和静态闭包；保存图像仍可观察/导出，不回退当前稿 |
| 间接依赖改了但工具未变 | 新CLI/invoke进程；长驻服务重启，不靠入口query解决传递缓存 |
| export验证不匹配 | 验证并传递同一个选定run的validationRef |
| 事件峰值偏差 | 查实际帧、samplingError与时钟，需要时从冻结源补采样 |
| 越界 | 当前需查margin图/坐标；视口与对象定位属于工作包4，不假定已实现 |
| 超预算/超时 | 查帧像素、force tick、16MB观察、invoke90秒/4MB；不静默降质 |

## 11 工作区与文档维护

沿用`codex/ai-vfx-lab-mvp`，新分支默认`codex/`前缀。先检查当前工作树与staged差异，保护其他工作；提交、推送、合并或发布按当前会话授权执行。不要把records、重复raw、第三方bundle或node_modules混入轻量交付。

当前方案以产品全景、实施状态、本交接和目标契约一致为准。路线或边界改变时就地整理对应章节与下一项任务，删除失效指令，不追加修订流水。原始评估、生产日志、构建与补测证据保留原样。

## 12 可直接交给下一位研发agent的任务开头

```text
接手codex/ai-vfx-lab-mvp的AI像素特效工具台。
读AGENTS.md、HANDOFF、实施状态与两份动漫生产日志；检查工作树和73项技术基线。
本角色可读实现，不把研发上下文交给黑盒创作者。

下一闭环是工作包3.1：从明确选定的冻结run直接导出完整动画与媒体身份。
先核对原库writeVideo/upscale、当前export、manifest与保存图集，复用成熟实现。
保留atlas兼容、color/additive light、实际采样与同run验证，不暗渲当前文件。

完成公开定义/实现/必要验证后，固定隔离构建，新建fork_turns:none独立作者。
作者仅用公开资料制作跨题材复杂作品、至少两类局改、原尺寸观察和同run交付。
评估创意帮助、重复工程与机制复用；原报告保持，修复后公开补测。
更新现行文档与证据，按工作包3.2、4、5、6、7、8继续，不将子集写成整阶段完成。
```
