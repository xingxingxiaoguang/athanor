# AI 像素特效工具台研发交接

交接日期：2026-11-06（Asia/Shanghai）。实验分支：`codex/ai-vfx-lab-mvp`。远程：`origin`，`git@github.com:xingxingxiaoguang/athanor.git`。

本文面向**接手研发的 agent**，允许它阅读实现、测试、历史报告并修改平台。后续用于检验创作体验的**独立创作者 agent**有不同的信息边界，不能读本文、工具/SDK实现或开发者解释。两种角色必须分开；不要让熟悉实现的研发 agent 兼任黑盒创作者。

这版完成的是契约与冻结证据底座、首批路径/图像创作链，以及粒子/贴图/库内材质/粒子探测闭环。**整体实施计划尚未完成：B阶段完整场景未验收，C只提前交付部分probe，D尚未验收。** 下一步有具体任务，不需要重新讨论产品方向。

## 1 接手后的前五件事

1. 读根目录[AGENTS.md](../../AGENTS.md)，再读本文。检查Git状态、分支和Node版本；不要覆盖已有草稿或别人的未提交改动。有`.codegraph/`时先用CodeGraph，无则跳过，不自动索引。
2. 跑`npm run lab:test`。本版交接基线为**45项通过**，包括HTTP/MCP契约、冻结重放、SDK数值/像素回归；测试按文件串行，因为会修改共享catalog/records。它们不是艺术验收。
3. 执行第4节的干净仓库演练：发现公开工具、渲染`lab/cinder-orbit`、实际看原尺寸图像、probe、比较、冻结validate、同run export。确认你理解当前接口，而非按目标规划猜API。
4. 阅读最新[潮汐罗盘封印原报告](../../experiments/vfx-lab/evaluations/2026-11-06-particle-loop/creator/report-original.zh.md)及[修复补测](../../experiments/vfx-lab/evaluations/2026-11-06-particle-loop/retest-material-fields/retest.zh.md)。重点看“源速度仍需手算”的真实负担，再读自己的实现地图和相关源码。
5. 从第9节的**工作包0：带速度的源轨迹**开始，先提炼现有代码路径、写精确契约，再实施、验证、交给新的独立创作者。不要跳去做参数编辑器或扩大预设数量。

研发时按需阅读的资料如下，不必再次通读所有归档日志：

| 文件 | 用途与权威边界 |
| --- | --- |
| [产品全景](README.md) | 项目目标、两个完整场景、A–D分期；其中概念API属于目标设计 |
| [实施状态](implementation-status.md) | 当前已经交付什么、哪些范围没完成 |
| [公开API](authoring-api.md) | 已实现SDK的签名、单位、默认值、例子与限制；也被inspect解析 |
| [工具目标契约](tool-contracts.md) | 11工具的完整方向；不能把其中所有字段当成现行参数 |
| [definitions.mjs](../../experiments/vfx-lab/definitions.mjs) | 当前9工具的可执行输入/输出Schema，CLI/MCP/HTTP共用 |
| [实现地图](implementation-map.md) | 从原库的哪些算法和代码路径提炼能力，哪些直接复用、哪些尚未提炼 |
| [独立测评方法](creator-evaluation.md) | 每个功能闭环的门槛、评估维度与已归档案例 |
| [实验工具使用说明](../../experiments/vfx-lab/README.md) | 命令、运行产物、当前限制与观察页面 |

发生不一致时先以实际Schema、实现和可复现调用判断当前行为，修正文档/实现的不一致；产品全景负责方向，不能用它证明一个不存在的能力已经可用。

## 2 从哪里来：两大实现基石与用户要求

### 2.1 Athanor原库是算法与代码来源

原项目是普通JavaScript驱动的像素特效库，统计口径见[inventory.json](inventory.json)：244个效果、21个分类、20个分类辅助模块；有直接draw和create模拟两种入口，也有角色、骨架、姿态、动作与受击编排。统计是当次源码快照的事实，增加库内容后应重新核对。

它同时提供视觉语言、实际需求、**大量可提炼的实现路径**。不能只看图、总结风格，然后把已有采样、运动、扫描和材质算法重新写一遍。研发要读相关`src/fx/<分类>/<作品>.js`、`_lib.js`与`src/core/`，识别重复的计算和可替换的艺术选择。成熟实现可以直接适配公共State，不必一律改写成最低层原语。

本版已经采取的几条路径：

| 原实现 | 已提炼/复用的能力 |
| --- | --- |
| `core/particles.fly/flyV`、`fire/_lib.drift` | 解析位置+速度、恒加速度/线性阻力、分轴阻力与近零数值稳定分支 |
| `core/particles.cycle`、`fire/_lib.looped` | 稳定出生表、负出生时间、寿命超过周期的重叠副本、copy身份与randomId分离 |
| `fire/_lib.burn`在`t-age`采样源位置 | 出生源transform、出生后脱离源、明确的源velocity继承、运动与阶段画法分离 |
| `fire/_lib.firePuff/smokePuff/ember/spark`、`arcane/_lib.mote/streak` | `material`六个入口直接导入原函数，适配粒子State，不近似重画 |
| `Painter.each/sprite`、`arcane/_lib.squeezed` | 逆空间像素中心采样、贴图轴心、旋转/镜像/缩放、透明策略 |
| 刀光头尾、转场排序/边缘、传播到达等实现 | 路径/条带、rank/arrival、mask变化与稳定首次到达出生的首批通用接口 |

原`src/core`和`src/fx`在这一版没有被重写。新SDK用独立的`src/authoring/index.js`及包入口`athanor/authoring`，保留旧效果导入闭包。部分旧实现适配自Sprite Fusion，原文件有MIT来源和署名，直接复用或迁移时必须保留，不能把上游成果改称新算法。

### 2.2 Spine Particle提供底层机制对照

用户明确指定[tsnm-spine-particle.com](https://tsnm-spine-particle.com/)作为另一基石，范围**包括但不限于发射、运动、贴图、生命周期**。借鉴其底层能力与分解方式，不复制人类参数面板，不建设Spine兼容导出作为当前优先项。

已读[首次研究](../../experiments/vfx-lab/research/tsnm-spine-particle/README.md)和[粒子闭环当次核对](../../experiments/vfx-lab/research/tsnm-spine-particle/2026-11-06-particle-loop.md)。研究依据是公开生产JS及隔离数值探测，**没有取得完整开发源码**。历史记录分别固定bundle URL/hash：

- `index-CFDvMOEj.js`：`468e534eabb2221f3c090c130787d357a17962aac9d6a1a795c2f3a4ef82b7c0`。
- 后一次`index-CV5L3uYa.js`：`24145c3c55336361fa6528a44ee7aea75bee9a590b5d6dc7a738dd3e1122ba01`。

这些是历史构建，压缩符号/资源名会变。下次研究先重新检查站点实际加载的脚本，再记日期、URL/hash、读取或执行的方法；不要把旧符号当当前源码名，不执行整个第三方bundle。原始大bundle放ignored records，不作为项目运行依赖。

需要继承的是通用发射域、出生属性、速度继承、生命周期绑定、径向/切向力、延迟汇聚、资源权重、序列时钟、轴心、轨迹/条带等能力。需要重新明确的是像素/秒/弧度、时间域、随机身份和执行阶段；不照搬内部重力/风倍率，也不把“向内运动”与“边界出生”绑死。

### 2.3 用户确定的产品评价标准

工具面向能写普通代码、调用接口、看图并改稿的AI。用户负责方向与取舍；工具应承担公共计算、采样、求解、观察和重放，不是让人类替AI操作GUI。

每个闭环都要用独立复杂创作检验三点：

1. **创意表达**：有没有限制新的结构、运动、材质？哪项能力具体帮助了表达？
2. **顺手程度**：哪些本应交给工具的基础设施仍被迫手写？区别艺术造型与重复工程，不能用“写了代码”判失败。
3. **能力提升**：流程引导和机制复用让哪个难点变得可组合？没有匹配基线就不能宣称净省时、艺术优越或“原来绝对做不出”。

不要以运行成功、测试全绿、预设看起来漂亮或开发者自己会用来替代这三项判断。也不要引入强制亮核/辉光风格、固定作品DSL、自动审美评分或GUI-only标准。

## 3 到哪里去：本版位置与产品终点

目标是**参考与技法库 + 可组合创作能力 + 可观察、可修改、可复验的工具流程**。可创作战斗特效、环境循环、身体状态/变形、生成消失、界面反馈、屏幕转场；粒子、程序主体、mask、像素shader、文字和角色动作都应有位置。

| 阶段 | 当前状态 | 继续推进/验收条件 |
| --- | --- | --- |
| A 契约与证据 | 首批完成，已有独立案例及修复证据 | 保持精确契约、旧版本复验、原库兼容与错误可恢复 |
| B 创作核心 | 已有路径/图像链与粒子闭环，尚未完成整阶段 | 身体表面、裂纹/动作联动、接触等能力；两个完整场景均可原创、局改与复验 |
| C 局部复用与实验 | 提前做了保存色光及已声明粒子probe子集 | 正式`fx_reuse`、`fx_explore`、部件来源/依赖/替换点、其他真实观测口 |
| D 扩展与生产 | 尚未验收 | 向量场/图像流动、复杂挂点、资产包、目标引擎与缓存，分别由真实任务推动 |

B阶段完整场景是产品全景第10节的“非对称熔渣内收与冲拳”及“角色结霜后沿裂纹消失”。`lab/ember-weave`、`lab/cinder-orbit`和潮汐罗盘证明了各自子集；它们没有替代完整身体/动作场景验收。

现有9工具：`fx_search / fx_inspect / fx_scaffold / fx_render / fx_compare / fx_probe / fx_validate / fx_history / fx_export`。目标11工具中`fx_reuse`、`fx_explore`未实现，probe也未实现完整目标语义。

17个公开API家族为原Painter/color/clock/effect，加random/curve/path/domain/schedule/motion/mask/field/image/light/texture/particle/material。下面只作能力地图；精确参数仍查公开API：

| 能力群 | 可用子集 | 当前重要边界 |
| --- | --- | --- |
| path | polyline/adaptive cubic、弧长、切法线、重采样、连续可变宽strip | strip不是粒子真实历史尾迹，along返回几何采样而非伪造速度 |
| random/curve | 具名稳定通道、scalar/color、linear/hold/smooth | 无导数API；smooth是逐段smoothstep，不是任意Bezier/Hermite |
| domain/schedule | 点/扇环/圆/矩形/Path/Mask，burst/rate/resident/cycle | Mask不伪造法线；cycle是有限窗口展开，非无限运行器；distance排期未交付 |
| motion/particle | 解析分轴阻力、120Hz force/radial/attract/kill；独立出生域、方向、属性、transform/速度继承、生命周期、替换轨迹/画法 | 源velocity仍需明确给出；无通用碰撞事件/二次发射、历史尾迹或完整约束 |
| texture/material | 代码内RGBA/ASCII/拆帧/序列/轴心/最近采样、六种库内成熟材质 | 无外部PNG/URL资源冻结包；只对mote完成此轮独立创作，其他材质有技术等价回归 |
| mask/field/image/light | make/polygon/derive、布尔/轮廓/差分，标量/噪声/rank/arrival，dissolve/首次出生、同源光 | 区间变化不等于精确瞬时事件；无完整向量场/图像advect或身体表面协议 |
| probe | 单run保存四通道、已声明粒子Birth/State、离散轨迹、显式冻结重放 | 无任意mask/field/命名绘制层隔离、without修改器或playback动作时钟 |

## 4 环境与干净仓库演练

### 4.1 环境

仓库声明Node>=18，没有新增运行依赖；devDependency为原有esbuild。交接实际用Node **v24.22.1** 验证，不代表每个较早版本都已认证。

本机默认Homebrew Node22因为缺少`libsimdjson.31.dylib`无法启动。遇到同一问题，在命令前加可用Node路径：

```sh
env PATH=/opt/homebrew/opt/node@24/bin:$PATH node --version
env PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run lab:test
env PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run lab
```

其他机器使用自己的可用Node即可。冻结重放要求与原manifest记录的**Node版本、platform、arch完全一致**；普通新渲染不要求沿用本机Node，但会生成新运行身份。

标准启动（确保当前shell已选中可用Node）：

```sh
git status --short
git branch --show-current
node --version
npm ci
npm run lab:test
node experiments/vfx-lab/cli.mjs tools
node experiments/vfx-lab/cli.mjs help
npm run lab
```

页面为`http://127.0.0.1:4173/`。若端口被占用，先确认已有进程归属，也可用`node experiments/vfx-lab/server.mjs 4174`。不要用广泛的`pkill node`影响其他任务。原图库仍用`npm run gallery`；完整act观察仍用原库`tools/act.mjs`，当前实验页面只提供站立尺度参照。

### 4.2 不依赖任何历史run的完整技术链

下面从仓库根执行，使用本次实时生成的run/validationRef，不包含占位ID，也不要求被忽略的records已存在。Mac本机把第一行命令前加上述`env PATH=...`：

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
  particles: states.image, comparison: comparison.image,
  validationRef: validation.validationRef, exported: exported.directory }, null, 2));
JS
```

实际用图像查看工具打开contact/color/comparison；也看light黑底窗口。技术脚本通过不等于已经看过图或审美成立。若需要检验连续节奏，另看连续播放/足够密集帧；不能只看接触表就声称没有帧间闪烁。

### 4.3 从Git里的最新独立作品重建新运行

最新作品的v3源码已随轻量测评归档。干净克隆可以这样生成自己的ignored draft，`COPYFILE_EXCL`避免覆盖现有创作：

```sh
node --input-type=module - <<'JS'
import { mkdirSync, copyFileSync, constants } from 'node:fs';
mkdirSync('experiments/vfx-lab/drafts', { recursive: true });
copyFileSync(
  'experiments/vfx-lab/evaluations/2026-11-06-particle-loop/creator/versions/v3.js',
  'experiments/vfx-lab/drafts/handoff-tidal-compass.js', constants.COPYFILE_EXCL
);
JS
node experiments/vfx-lab/cli.mjs render '{"id":"draft/handoff-tidal-compass","note":"historical artwork evaluated by current backend"}'
```

它是**当前后端的新运行**，不是恢复原选定`ce17fef07e46-df037939`的完整冻结包；不能沿用旧validationRef，也不能因为图像近似就改写原测评结论。

## 5 代码地图与改动入口

```text
src/core/                         原运行时、Painter、颜色、粒子、角色/rig/act
src/fx/<category>/*.js            原244个作品与20个分类_lib；算法提炼来源
src/authoring/index.js            新SDK独立入口（13个命名空间）
src/authoring/contract.js         AuthoringError、单位/数值/颜色/空间检查
src/authoring/*.js                精确算子实现
experiments/vfx-lab/definitions.mjs  现行9工具Schema
experiments/vfx-lab/contracts.mjs    API家族索引、别名、文档按节解析与修订
experiments/vfx-lab/recipes.mjs      六份机制配方；不是固定作品模板
experiments/vfx-lab/lab.mjs          effect加载、采样、render/compare/validate/history/export
experiments/vfx-lab/clock.js         旧入口的实验固定tick适配
experiments/vfx-lab/source-parser.mjs Node模块语法解析、静态导入闭包
experiments/vfx-lab/replay.mjs       摘要/作品修订、支持检测、冻结临时目录重建
experiments/vfx-lab/observation.mjs  粒子观测协议/字段单位/保存序列检查
experiments/vfx-lab/probe.mjs        保存图或观测读取、显式冻结probe、局部表/图
experiments/vfx-lab/cli.mjs          JSON CLI，单行结果/结构化错误
experiments/vfx-lab/invoke.mjs       新子进程执行、串行队列、超时与返回体预算
experiments/vfx-lab/mcp.mjs          stdio MCP；结果图片以MCP image返回
experiments/vfx-lab/server.mjs       localhost HTTP；调用invoke，提供保存图像
experiments/vfx-lab/app.js/index.html  人类观察与比较页面
experiments/vfx-lab/effects/         可读开发参考cryo-bloom/ember-weave/cinder-orbit
experiments/vfx-lab/templates/       blank模板
experiments/vfx-lab/*.test.mjs       三份技术测试，共45项交接基线
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
- 无真实观测点的旧作品只承诺整体色光观察。当前observe只接受稳定粒子出生表+状态，不能用几个层名称冒充内部层隔离或任意field探测。

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

静态导入闭包使用Node的SourceTextModule语法解析子进程，不能退回匹配`from/import`的正则（曾误识别普通字符串）。`replaySupport`另作保守的动态依赖检查；只支持相对本地JS，外部文件、包、动态import、环境依赖尚未完整冻结。缺口报REPLAY_UNAVAILABLE，不删掉检测去“修好”重放。

export必须明确选定run；validationRef必须属于同一个run。history最新条目不等于作者选定，公共history在没有决策协议时decision为null是诚实行为。验证的`savedFramesVerified:false`表示检查了冻结源码重放，不是穷举核对已保存每帧。

## 7 现有证据、已修问题与可移植性

| 案例/目录 | 完成的创作与发现 | 当前状态 |
| --- | --- | --- |
| [phase-a 断环引雷](../../experiments/vfx-lab/evaluations/2026-11-05-phase-a/README.md) | 原创三版；普通helper/坏模块阻断搜索，模块语法错误误报参数JSON | 逐候选搜索诊断及模块/参数错误分类修复，独立补测通过 |
| [phase-b 纸灯解缚](../../experiments/vfx-lab/evaluations/2026-11-05-phase-b/README.md) | 四版原创；颜色/光裁图与手写polygon扫描负担 | compare.channel、mask.polygon及发现入口/示例修复，独立补测通过 |
| [phase-c 暗潮墨蝶](../../experiments/vfx-lab/evaluations/2026-11-05-phase-c/README.md) | 三版原创；极弱光被贴成灰底上的暗剪影 | 黑色加法中性底修复，1794个原非背景像素不变，独立补测通过 |
| [particle-loop 潮汐罗盘封印](../../experiments/vfx-lab/evaluations/2026-11-06-particle-loop/README.md) | 三版原创、4组80出生；tint/blend不可probe；共享源速度需手算导数 | 状态字段修复并7次公开补测通过；源速度减负仍待研发 |

目录里的phase-c/作者D是案例编号，**不是产品C/D阶段已经完成**。更早`evaluations/2026-11-05/`的首轮方法混入GUI/不合适A/B判断，相关结论已标撤回；不要把旧的撤回意见当现行门槛。

最新选定历史身份供核对：run `ce17fef07e46-df037939`；sourceDigest `3a0676787b4370f92c3797f96574205f1bfd9226fb87d1fc12d65e1713e1b5c3`；validation `validation-a3e344f1-689c-4034-ac64-cca3fa81c2f0`；export `export-c0e0ba35`。

原报告SHA256 `3e64cf65e7c2fc3b3fdcbc310bdf72ab28b547c904f7b77f060c71098b535445`；修复补测 `41003a14c81ff4016c3bd61fa206b65fa63ddd46e15607ae0c43973857e22a81`。原报告、作品、图像、observations均未为了修复改写；独立作者未重render原run来伪装修复。

### Git包含什么，干净克隆没有什么

提交内容包括实现、测试、公开文档、研究记录，以及轻量测评的原报告、输入输出、三/四版作品、关键图、选择/验证/导出引用和build hashes。历史日志的临时绝对路径保留原样，它们是证据，不是新机器上的有效路径。

以下目录被忽略，不随推送自动到远程：

- `records/`：完整manifest/sources/observations/raw RGBA与运行、分析、完整隔离构建。
- `experiments/vfx-lab/drafts/`：当前工作草稿。
- `output/playwright/`、`.playwright-cli/`、node_modules等本地产物。

本机原工作区为`/Users/xxxg/demo/athanor`。稳定raw副本在`records/vfx-lab/creator-evaluations/`下的`phase-a-20261105`、`phase-b-20261105`、`phase-c-20261105`及`particle-loop-20261106/{original,repair}`；本机原run也已复制到records/vfx-lab根。先检查目录存在，**不要把它们当干净克隆必有文件**。

只有Git轻量证据时，可以审查历史结论、读取作品版本并按第4.3节产生新运行；不能用旧run ID调用不存在的manifest，也不能声称复验了旧后端。若任务必须原样重放历史冻结包，需要实际取得raw包并满足原环境，缺失时明确记录。不要把完整第三方bundle、重复raw缓冲或所有records强制加入Git来掩盖这一边界。

## 8 每一轮研发的执行方法

### 8.1 选一个真实创作负担，形成可独立验收的闭环

先写清：哪个任务需要它、作者现在手写了什么、输入/输出/单位/空间/时间/身份是什么、旧代码有哪些路径、参考平台有哪些对应机制、哪些艺术自由必须保留。一个闭环要能从公开发现走到实际作品、观察、局改和冻结交付；不能只加函数名或只有开发者demo。

源码提炼时建立小表：来源文件/符号、原算法要点、直接复用或通用化的理由、兼容边界、验证方法。若直接调用原函数就能满足开放接口，先适配；需要解耦状态/绘制或稳定身份时再重构。避免巨型配置对象与一套私有求值器承担所有逻辑。

完成最小可组合实现、公开契约/别名/例子和必要技术测试，再固定隔离构建。独立作者发现问题后，研发者也要审查其作品，识别被习惯性接受的通用数学接线，而非只修被明确报错的调用。

### 8.2 独立创作门：不能省略

根AGENTS对此有明确持续要求。每个新的功能闭环都要**新建**不继承开发上下文的创作者（例如`fork_turns:'none'`），给固定隔离快照与build hash；旧作者可复测同一缺陷，新功能不能只重复用已经知道实现的作者。

隔离快照需能运行CLI：src、tools、lab runtime/templates/reference effects、公开API文档、package文件等。不要把records、开发笔记、其他作者方案或本交接文档作为创作者阅读材料；实现文件为执行可以存在，但必须明确禁止阅读。当前没有npm运行依赖，黑盒调用无需自行寻找内部实现来“安装SDK”。

可复用任务提示（替换路径、hash及当轮能力，不给实现解释）：

```text
你是独立像素特效作者，只在固定隔离副本 <path> 工作，build=<sha>。
可调用CLI tools/search/inspect，读公开authoring-api与参考效果源码，编辑自己的作品。
禁止读SDK/工具/runtime实现、测试、sources.json、开发者说明和其他作者方案；
operator inspect不得请求source。不要修改平台，错误先按公开提示恢复并原样记录。

围绕 <当轮能力> 自选原创游戏特效概念，必须需要该能力且包含非粒子主体或
足以检验边界的结构，先写brief：用途、尺度、材质、时序、核心视觉问题。
实际查看初稿原尺寸图像，再完成至少两类有意义的局部修改，保留各版源码。
用公开probe/compare观察相关事实、弱光/有限色等适合本问题的条件；
检验改材质保运动、跳转/帧率/历史复验中与本能力有关的事实。
明确选一个run，对它validate，携它的validationRef export同一run。
保存所有公开调用I/O、原始错误、读过的资料、实际看过的图、选择与恢复记录。

坦诚判断：创意有无受限、能力具体帮助；哪些重复工程仍手搓；
流程/复用使哪个难点可组合。区分艺术设计与基础设施，不宣称未测净省时或艺术提升。
发现bug尽早发最小公共复现；原报告封存，修复只另写公开retest。
```

实测可用的构建固定方法是对隔离副本相对路径→SHA256建表，再对规范化JSON计算build hash。记录排除项（records、其他测评、测试、开发说明等），不要把一个Git hash当作包含未提交文件的实际测试构建身份。直接复制固定快照比让作者在研发工作区与开发者并发改文件更可控。

### 8.3 修复、复测与归档

1. 保留原报告、原build、原作品/图像/观测摘要；原问题不能被“修复后的成功”覆盖掉。
2. 用最小公共复现确认问题。补合适的技术回归，修公开定义/文档/实现的完整链。
3. 生成新的修复快照，原作者只通过公开调用补测，另写retest；不要透露内部实现来引导通过。
4. 检查旧run可观察/可重放、无关字段/图像未变，或明确说明有意变化；不是所有修复都要求所有像素不变。
5. 轻量证据放`experiments/vfx-lab/evaluations/<date-capability>/`，大raw放ignored records。维护者README解释原构建/修复构建、范围、发现和剩余负担，原作者报告原样保留。
6. 更新implementation-status、实现地图及测评索引。单独说明技术验证、创作可用、表达收益与未检范围。

## 9 后续研发路线：具体工作包与验收

下面是**待实施工作包**，不是对现有API的承诺。按真实需求拆闭环；不要一次把后面所有能力打成巨大重构。

### 工作包0（下一步）：带速度的可复用源轨迹

真实负担：潮汐罗盘v3的`gateOpen/gateSpeed`手工同步开合曲线与导数，再计算针尖位置/速度，传给emitter.transform。用户需要工具接管可公共化的数学接线，仍保留自定义曲线、源路径和造型。

先读：最新作者v3及报告；`src/authoring/curve.js`、`path.js`、`motion.js`、`particle.js`的transformAt；`src/core/particles.js`的flyV；`src/fx/fire/_lib.js`的tip/burn/drift；原库移动招式的共享时序。对照参考平台的源运动/速度继承，但不要重引入按输出帧率求源速度的耦合。

建议实施顺序：

1. 定义曲线/路径/参数轨迹如何返回位置与速度；说明seconds→progress→arc length的链式单位、旋转的angular velocity、端点/停顿/折点策略。
2. 可解析部分直接求速度。hold跳变、折线拐角或作者任意函数不可微时，明确诊断/单侧策略；若提供数值差分回退，采样秒距和误差范围显式，不用输出fps做差分间隔。
3. 与现有emitter.transform接合，保留作者显式velocity及自写trajectory出口，不要求每件作品换一种DSL。
4. 用罗盘共享运动作等价迁移回归，确认减少的是手写导数、不是限制其开门构图。它是已有作者作品的技术回归，不代替下一位新创作者。
5. 新独立作者做多移动源、速度继承、停顿/反向、序列材质结合的复杂原创，至少两类局改，并用probe核验出生源/初速度。

验收：公共契约可发现；停止与折点语义明确；源速度不依赖30/60fps或调用顺序；改材质不改运动；迁移已有任务减少重复数学；独立原创/局改/冻结交付完成。`motion.along`当前只返回几何信息，不要偷偷加一个不正确的速度来凑接口。

### 工作包1：接触事件与一次性二次发射

来源：`fire/_lib.sparkAt`的解析轨迹/接触求根、`core/sim`的GRIT/SPARK/BRAND、`Bits`反弹/停留、`water/_lib`接触与涟漪、爆炸/地击落地衍生。参考平台的碰撞分支作为对照。

先打通一个明确几何（如平地）的闭环，再扩展类型。输出接触time/position/normal、撞前后速度、parent particle/copy ID、稳定ordinal与event ID；二次出生消费事件，不让作者自己去重。明确寿命边界、接触与死亡顺序、刚好位于边界时的规则。

验收：高速跨越仍按所选精度找到接触；跳转、不同观察区间划分、重放不重复发射；回弹后多次接触各有身份；低辉光下水/石/火的不同材质可替换；新独立作者以接触驱动复杂响应并局改。不要把当前kill回调的tick级删除称作连续碰撞或一次性事件系统。

### 工作包2：真实历史拖尾

区分粒子经过的位置历史、当前速度拉出的streak和独立程序条带。接触之后折返、停留再移动、视觉offset等情况不能只用两点速度外推。

来源：原库各速度尾迹与投射物残迹、path.strip，以及参考平台的粒子trail/独立ribbon分离。契约明确历史采样时钟、物理/渲染位置、长度按秒/像素/点数、死亡后淡出、宽度/色带年龄、预算与拐角。

验收：反向/回弹路径保留，跳转可重建，30/60fps共同时间一致；预算不默默降采样；作者能借用运动历史而替换材质/宽度；新独立作者完成复杂轨迹创作，原尺寸动态核验。

### 工作包3：身体表面、裂纹传播与动作联动，完成B验收

先读`status/_lib`的身体边界/列顶/行范围/法线，status/frozen、transitions/burn-away/pixel-dissolve，ice/_lib裂纹生长，以及core/actor、rig、act/chain和moves里的动作编排。

先公共化身体像素/轮廓/表面特征与空间转换，再接裂纹/到达场/变化区域/衍生。明确静态身体与逐帧姿态的区别；动作时间、受击停顿、效果局部时间要可查。优先复用扫描与映射实现，避免每个状态效果再手写一遍。

验收回到两个完整B场景；必须有非粒子主体、移动身体/前后层、传播与变化因果、跳帧不重发、明确结束/转交、新独立原创与局改。实验页面站立角色和原工具act预览不能被笼统写成“实验平台已支持完整动作”。

### 工作包4：C的正式复用、更多观测与受控实验

`fx_reuse`要提供局部机制/部件的来源、修订、依赖、替换点、适用边界和隔离预览，不只是复制整件文件。可先登记已有成熟material、头尾条带、传播到达、接触响应、身体轮廓、文字扫光等部件。

命名Path/Mask/Field/绘制层需要真实协议和保存/重放规则；保持粒子观测兼容，未声明的旧模拟只承诺整体。`fx_explore`按明确艺术假设组织受控变体，保存各运行条件、不同项和证据，不自动替用户选“最好看”，不要只换seed当结构探索。

验收：独立作者能借局部机制改结构/材质，能隔离真实支持的部分，有修改/归因证据；旧run身份不被变体工具混淆。工具数量到11也不自动代表C全部完成。

### 工作包5：D按实际作品进入生产能力

逐项推进vector field、图像scroll/warp/advect（不同操作不能混名）、破碎/材质包、复杂挂点、外部资产冻结、缓存/检查点及目标引擎。

外部图片资产首先要补资源ID/字节摘要/清单/失效诊断/冻结重建；不能只让texture在运行时fetch后把replaySupport阻断检测删掉。优化保留像素与时钟语义；按具体任务测耗时/内存，不能把本机某次毫秒数当跨设备保证。Unity/Godot等实际导入分别做相应测试，导出PNG+JSON成功不等于已导入引擎。

## 10 测试与日常排错

```sh
npm run lab:test
git diff --check
node --test --test-concurrency=1 experiments/vfx-lab/particle.test.mjs
node experiments/vfx-lab/cli.mjs inspect '{"ref":{"kind":"operator","id":"core/motion"}}'
node experiments/vfx-lab/cli.mjs search '{"query":"粒子"}'
```

本版测试职责：`test.mjs`覆盖协议/时钟/冻结/HTTP/MCP等；`authoring.test.mjs`覆盖首批路径/图像链、颜色PNG与创作者缺陷；`particle.test.mjs`覆盖库内算法/画法等价、粒子/贴图/观测、冻结状态字段。新增数值/求解/身份行为需有有意义的回归；简单文案或可逆低影响调整不必堆镜像实现测试。

| 现象 | 先检查/修复入口 |
| --- | --- |
| Node还没进JS就退出 | 本机Node22动态库问题，换可用Node24，不先改项目代码 |
| CLI INVALID_INPUT指arguments | JSON语法或Schema组合；未知字段/互斥target/clock先查tools |
| CONTRACT_MISMATCH指作品文件 | 修当前JS语法/导入/exports/meta；不要误报成参数JSON错误 |
| search部分候选坏了 | 看RESOURCE_SKIPPED；普通helper可用下划线排除发现，不能让它阻断全部结果 |
| 空画面 | 实看color/light，查Painter颜色整数、局部坐标、当前时间/结束；不要仅凭空图编造根因 |
| 字段在State里却不能probe | 同时检查observation字段枚举/单位、definitions和probe；最新tint/blend缺陷就是这类断链 |
| 未声明粒子的旧run不能probe | CAPABILITY_UNSUPPORTED是正确边界，可读保存色光，不能无损反推身份 |
| REPLAY_UNAVAILABLE | 看runtime精确版本/平台、snapshot摘要、静态闭包与动态依赖阻断，不回退当前文件 |
| 改helper后工具似乎没变 | 用新CLI/invoke进程；长驻HTTP的Schema/静态模块变更需重启该服务 |
| 弱光像黑剪影 | light查看底/alpha合成语义，保持黑色加法中性底和原RGB |
| export不认validationRef | 必须是这同一个run的验证，重新明确选定目标，不能借另一个run的通过 |
| 事件峰值时间有偏差 | 查nearest saved frame和samplingError，补显式更密fps或冻结probe，不改标签假装精确 |

已实现预算包括2400万渲染帧像素、单粒子力场1440tick/12秒、16MB观测序列，以及invoke的90秒/4MB返回上限；具体其他预算以契约/实现为准。超预算应显式诊断，不静默改变分辨率、数量或时钟。当前force从出生重算，checkpoint/性能认证尚未完成。

## 11 研发交付与Git协作

完成一个闭环的交付应包含：可调用实现及来源、同步公开契约/发现/例子、必要技术回归、独立复杂作品与两类局改、缺陷修复和独立补测、轻量归档与raw位置、更新的实施状态和明确未检范围。

本版所有这些实现与四组测评此前尚未分批提交，交接提交会一起包含，提交规模比单个粒子模块大。原有Git阶段节点可用于理解来路：`1af6fe8`最初MVP，`1cf4049`首次独立测评，`0d31482`修正测评对象，`7a3c4a8`参考机制研究，`6693d66`产品全景和目标契约。本版之后以实际Git log为准，不把这些旧hash当当前实现。

沿用`codex/ai-vfx-lab-mvp`；新分支默认`codex/`前缀。提交前检查staged清单、空白错误、测试及是否误加records/草稿/第三方bundle；推送当前授权分支，不force、不自动合并main或发布站点。今后新会话的提交/推送授权以该会话用户指令为准，不把本次授权当永久发布授权。

## 12 可直接交给下一位研发agent的任务开头

```text
请接手codex/ai-vfx-lab-mvp的AI像素特效工具台研发。
先读AGENTS.md与docs/ai-vfx-tools/HANDOFF.md，跑45项交接基线并完成干净仓库演练。
这是研发角色，可读实现；不要把该上下文交给后续黑盒创作者。

以原244效果/辅助模块的代码实现和tsnm-spine-particle底层机制为两大来源，
从“带速度的可复用源轨迹”工作包开始，解决最新独立作者手算源速度导数的真实负担。
先核对相关库内代码、公开契约和最新作者作品；保留普通JS、自写轨迹与显式速度出口。
完成实现/文档/发现/必要测试后，固定隔离构建，找一个fork_turns:none的新独立作者，
仅通过公开资料完成相关复杂原创、至少两类局改、实际原尺寸观察、冻结验证及同run导出。
按创意表达、使用负担、能力提升三个维度评估，修复后独立公开补测，原报告不改写。
不要把局部能力通过写成B–D全部完成；更新来源地图、测评归档和实施状态后继续下一闭环。
```
