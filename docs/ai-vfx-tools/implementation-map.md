# 特效库实现与创作能力地图

本文为[产品全景设计](README.md)提供实现依据，并把可复用机制映射到目标能力。当前能力指实际源码；下列全景 API 仍以设计为主；B 阶段已实现其中首批 path/random/curve/domain/schedule/motion/mask/field/image/light 子集，具体签名不能直接用表中目标代替。A 阶段已经登记原有 Painter/颜色/时钟/模块契约，见[公开创作 API](authoring-api.md)和[实施状态](implementation-status.md)。

## 1 库的实际结构

| 部分 | 实现方式 | 产品应保留或改善的内容 |
| --- | --- | --- |
| [fx.js](../../src/core/fx.js) | 模块默认选项、本地变换、解析或模拟入口、颜色光合成 | 模块兼容、输入语义、公共求值时钟和一致交付 |
| [painter.js](../../src/core/painter.js) | 像素中心采样、形状、逐像素着色、硬与软透明、独立光缓冲 | 稳定像素基础，明确颜色类型及采样、透明策略 |
| [math.js](../../src/core/math.js) | 缓动、哈希、随机、value noise、分形、平铺与循环噪声 | 具名随机通道、场对象及可查询元数据 |
| [particles.js](../../src/core/particles.js) | 爆发、流、周期粒子与解析弹道 | 稳定出生记录、通用发射域、生命周期绑定 |
| [sim.js](../../src/core/sim.js) | 粒子、碎片、持续燃烧、光及火烟等特定行为 | 分离可组合行为与画法，继续支持成熟类型 |
| [shapes.js](../../src/core/shapes.js) | 闪电点集、分叉、多边形和时间轨迹 | 公共路径与采样，支持头尾、法线和条带 |
| [actor.js](../../src/core/actor.js)与[rig.js](../../src/core/rig.js) | 角色像素、三维骨架及姿态投影 | 身体资产、挂点与映射适配；支持其他角色的明确边界 |
| [act.js](../../src/core/act.js)与[chain.js](../../src/core/chain.js) | 姿态、受击停顿、场景反馈与多效果时间编排 | 命名事件、两种时间、可探测因果关系 |
| [分类辅助模块](../../src/fx) | 各材质与场景下的部件，当前共 20 个 `_lib.js` | 优先登记已有成熟能力，避免从零再造 |
| [工作流工具](../../experiments/vfx-lab/README.md) | 检索、阅读、建稿、渲染、比较、检查与导出 | 补创作契约、历史验证、可选观察窗口和上下文效率 |

实际模块统计见 [inventory.json](inventory.json)。`create` 入口包含状态模拟与组合，不等于 132 种物理系统；直接导出 `drawBack` 的数量也不覆盖所有实例内部的后层画法。静态导入或文本出现次数不能当作实际使用频率或质量证明。

### 2026-11-06 粒子闭环：从实现路径提炼

两大来源都用于算法与代码能力建设。原库不是只供“看效果”：本轮实际阅读core粒子/模拟器、火焰和奥术辅助模块，以及爆炸、地击、火炬、传送门的实现；下表区分直接复用、通用化和仍待提炼部分。[参考平台当次构建核对](../../experiments/vfx-lab/research/tsnm-spine-particle/2026-11-06-particle-loop.md)另记其底层机制及差异。

| 原库实现路径 | 提炼/复用方式 | 新公共入口与证据 |
| --- | --- | --- |
| core/particles.fly、flyV；fire/_lib.along、drift | 统一位置+速度，保持解析恒力/阻力，增加分轴阻力与近零稳定分支；不重写旧效果 | motion.ballistic；与原fly/flyV/drift数值等价回归 |
| core/particles.burst、stream、cycle；fire/_lib.looped | 排期变成稳定Birth[]；周期副本区分身份与randomId，显式前置寿命窗口和重叠副本；rate采用明确半开区间 | schedule.burst/rate/cycle/resident；周期超过一轮寿命与重复像素回归 |
| fire/_lib.burn里tip(i,t-age)、出生时保留羽流摆动与火转烟 | 将出生源采样、位置/速度、阶段材质拆开；源velocity明确给出，避免按输出帧率推导 | particle.emitter transform/initial/motion/material；出生变换与速度继承数值回归 |
| fire/_lib.firePuff、smokePuff、ember、spark | **直接导入原函数**，只适配粒子State、颜色与Painter状态；保留上游署名 | material.fire/smoke/ember/spark；原函数颜色/光逐像素等价回归 |
| arcane/_lib.mote、streak；portal的infall/skaters | 速度方向画法直接复用；轨道与时序可由trajectory/offset替换，未冒称把整件portal改成物理解 | material.mote/streak、particle.motion.trajectory/offset；画法等价、物理/视觉位置分离回归 |
| Painter.sprite；arcane/_lib.squeezed与Painter.each的逆空间采样 | 通用像素轴心、旋转/缩放/镜像、最近采样；纹理、序列选帧与画法分开 | texture.rgba/ascii/sheet/sequence/frame/draw；真实RGBA、轴心与90°旋转回归 |
| sim里各类粒子独立的生命、尺寸、冷却、延迟与前后层画法 | 脱离固定kind开关，抽出属性与生命周期回调；稳定通道使改色/换资源不扰动出生和速度 | particle.emitter/sample/draw，curve.color；通道独立与显式相关回归 |
| sim.BRAND落地生火、GRIT/SPARK反弹；fire/_lib.sparkAt连续接触求根 | 已读实现，保留为下一轮接触/衍生/历史尾迹的候选；**本轮未提炼完成** | 后续需精确碰撞时间、事件身份与重复触发证据，不能从radial/attract已实现推断 |

参考平台补足的方向包括通用发射域、独立发射方向、出生范围与速度继承、径向/切向力、延迟汇聚、加权资源、序列帧与轴心、生命周期曲线。实现采用本项目像素/秒/弧度、具名随机与解析/固定tick求值，不复刻它的参数界面或任意内部倍率。库内提炼与外部机制对照共同落在普通代码接口上。

## 2 代表性效果的制作机制

| 参考实现 | 形成表现的机制 | 可复用边界与作者选择 |
| --- | --- | --- |
| [sword-slash.js](../../src/fx/melee/sword-slash.js) | 椭圆弧带、快前缘与慢尾缘、厚度分布、内侧回声、尖端闪亮、接触火星 | 分离路径、可见区间和材质；作者设计弧线、最厚位置、速度与回声关系 |
| [melee 辅助模块](../../src/fx/melee/_lib.js) | 正反空间映射、前后半弧、弧带着色、沿弧光与残迹 | `smear`、`slash`、`trace` 等可先成为部件；避免只暴露颜色与半径 |
| [small-explosion.js](../../src/fx/explosions/small-explosion.js) | 闪光与环、火烟冷却、碎片、燃烧物落地生火、焦痕 | 共享释放和接触事件；作者决定质量分布、爆发方向和环境残留 |
| [explosions 辅助模块](../../src/fx/explosions/_lib.js) | 火球着色、上升气流、烟柱、团块与边缘管理 | 复杂体积先保留为部件，不强行归约为单一噪声阈值 |
| [frost-nova.js](../../src/fx/ice/frost-nova.js) | 传播前沿与其反函数给出到达时间，晶体随后生长，前后层交错，退场融化 | 传播与生长解耦；作者设计分布、主次高度、到达与生长的关系 |
| [ice 辅助模块](../../src/fx/ice/_lib.js) | 多边形切割、玻璃片、晶体叶片、雪花设计、裂纹生长 | 几何、绘制和状态分别包装，允许替换材质 |
| [waterfall.js](../../src/fx/water/waterfall.js) | 深度与下落时间的非线性映射，周期噪声纹理，水帘分裂，水花、雾与池面 | 复用材质坐标和流动场；落差与分裂位置属于艺术决定 |
| [water 辅助模块](../../src/fx/water/_lib.js) | 水滴尺寸画法、速度尾迹、低视角投影、落地回调、涟漪和泡沫 | 把投影与接触事件显式化，水滴运动与池面响应共用接触位置 |
| [chain-lightning.js](../../src/fx/lightning/chain-lightning.js) | 连接目标、传播头部、分叉、主支层次与余热，逐段到达 | 路径图与传播时序可复用；不把闪电简化为每帧独立随机折线 |
| [black-hole.js](../../src/fx/shadow/black-hole.js) | 倾斜盘、空间映射、色阶抖动、方向明暗、轨道碎屑和遮挡 | 保留自定义像素着色、投影和遮挡；不能用通用粒子配置完整替代 |
| [frozen.js](../../src/fx/status/frozen.js) | 身体边界分析、霜纹路径、原色映射、上边积雪、下缘冰柱与周期颤动 | 身体空间和轮廓特征先公共化；霜纹生长和表现保留定制入口 |
| [status 辅助模块](../../src/fx/status/_lib.js) | 身体、上边、侧边、轮廓法线、列顶和行范围缓存 | mask 特征应一次计算后共用，避免每个身体效果重复扫描 |
| [burn-away.js](../../src/fx/transitions/burn-away.js) | 多尺度排序场控制覆盖与揭露，边缘方向、热度、裂缝和衍生粒子共用像素信息 | 提炼到达场、边缘及变化事件；保留燃烧构图与冷却画法 |
| [pixel-dissolve.js](../../src/fx/transitions/pixel-dissolve.js) | 多尺度块、场排序、出现与消失时间、轮廓变化和角点闪光 | 复用分块与排序排期，作者决定尺寸层次和先后关系 |
| [achievement.js](../../src/fx/ui/achievement.js) | 面板进退与回弹、奖章放大闪亮、文字布局与共同扫光 | 层级运动、文字、图标和局部高光都进入能力模型 |
| [fireball-throw.js](../../src/fx/moves/fireball-throw.js) | 蓄力、移动火球、命中爆炸由共享常量编排，身体动作与停顿配合 | 子效果整体复用与共享事件；作者设计动作与能量过程 |

本次另生成并查看了刀光、瀑布、黑洞、冻结、燃烧转场和成就提示的接触表，用于核对这些机制在画面中的角色。接触表是有限采样，不代替动态节奏审查，也不是全库质量评定。

## 3 从实现提炼创作原则

| 原则 | 代码上的对应方式 | 对产品的要求 |
| --- | --- | --- |
| 主体先于装饰 | 主轮廓、体积或条带决定动作，细粒子与光补充 | 能单独观察主体和去光结果，不只提供粒子数量调节 |
| 时间具有层次 | 头尾差、传播延迟、峰值、衰减、残留 | 公共曲线、事件与阶段关系，可使用一两帧的明确峰值 |
| 材质是形状 运动与着色的组合 | 水下落加速，火上升冷却，岩块翻滚停留 | 支持组合并开放替换；不能靠换色就宣称换了材质 |
| 主次来自有组织的变化 | 非均匀尺寸、方向偏置、少量焦点、分布与属性相关性 | 提供密度、相关采样和具名随机；不只有独立均匀随机 |
| 细节应服务尺度 | 单像素边缘、有限色阶、透明策略、像素簇 | 原尺寸证据、可选约束与采样控制，避免默认平滑一切 |
| 联动应共享原因 | 到达生长、落地涟漪、边缘烟灰、接触停顿 | 输出事件和变化区域，让其他层响应同一结果 |
| 深度需要遮挡与位置关系 | 远近半环、身体映射、投影高度、前后粒子 | 显式空间、挂点、前后层及观察场景 |
| 风格可以选择 | 当前库常用亮边和辉光，也存在暗色主体和软透明体积 | 技法作为可选知识，技术检查不强制一种美学 |

## 4 目标基础能力与 API 形态

下列签名表示目标契约的粒度。具体实现可分批交付；所有公共算子都需可查询的精确类型、单位、例子和错误语义。

| 能力与概念 API | 输入与输出 | 已有基础及待补部分 |
| --- | --- | --- |
| `geometry.band / deform / fracture` | 几何、形变或裂纹规则 → 可查询几何、mask 或片段 | 已有形状、弧带、多边形和裂纹；补统一结果和组合方式 |
| `domain.sample` | 域、面积或边界、密度、种子和数量 → 稳定样本、切法线、权重 | 大量作品自行循环；补通用域与 mask 密度采样 |
| `schedule.burst / rate / distance / resident` | 时间区间或轨迹、数量或速率 → 出生记录 | 已有 burst/stream/cycle；补距离发射、身份与绑定 |
| `attribute.sample` | 属性分布、具名随机和相关规则 → 初始属性 | 已有哈希与 Rng；补隔离通道与显式相关变量 |
| `curve.scalar / color / envelope` | 输入域、节点、插值、输出单位 → 可绑定函数 | 缓动与局部曲线已存在；补通用契约、超调与范围诊断 |
| `motion.ballistic / forces / follow / constrain` | 初始状态、力或目标、坐标和时钟 → 轨迹或状态 | 解析 fly、特定粒子和局部求解已存在；补可组合修饰器与执行阶段 |
| `path.sample / tangent / resample / strip` | 曲线、距离、容差、宽度与区间 → 轨迹或条带 | 已有点集和专用弧带；补通用弧长、切法线和条带 |
| `field.noise / fbm / tile / loop / gradient / vector` | 空间、种子、频率、范围、周期 → 字段 | 已有标量噪声；补字段类型、向量与组合设施 |
| `field.arrival / rank` | 距离或排序场、传播规则 → 到达时间或顺序 | 冰波、转场已有特定实现；补单调条件、首次到达与重复经过语义 |
| `image.make / material.sample` | 程序形状、像素生成器或资产、色带 → 图像或材质 | 保留无外部图片的程序创作；补导入资产、程序材质与缓存契约 |
| `image.scroll / warp / advect` | 图像、位移或速度场、时间和边界 → 图像 | 有局部流动坐标和变形；补可复用图像算法，明确三者区别 |
| `image.dissolve / mask.change` | 图像、阈值场与前次区域 → 保留、边缘及变化区域 | 已有复杂转场；补中间结果与跨时间差分 |
| `mask.analyze / distance / outline / morph / combine` | mask 与参数 → 特征、场或新 mask | 已有身体特征、描边和局部分析；补公共类型、距离与形态学 |
| `pixel.quantize / dither / resize` | 图像、调色板和采样规则 → 像素结果 | 已有色阶、Bayer 和导出放大；补独立算子及坐标语义 |
| `light.source / halo / along / fromMask` | 几何或 mask、颜色、半径与强度 → 光层 | 已有点线环光、Lights；补包络绑定、来源 mask 和可观察拆分 |
| `body.analyze / attach / surface` | 身体资产、挂点或对应映射 → 可用特征与变换 | 已有 stockActor、rig 和 onBody；补外部角色适配与能力声明 |
| `event.contact / crossing / change / chain` | 运动、场或像素变化 → 稳定事件与子效果 | 已有回调和 chain；补事件身份、重放和预算 |
| `text.layout / reveal / shine` | 字形、文字、布局与时间 → 几何或像素内容 | 已有 font 与 UI 辅助模块；补可复用布局、动画和字形能力查询 |

### 4.1 几何与运动的组合

出生域只负责采样，不隐含初速度。方向策略可以取路径切线、边界法线、固定方向或目标方向。面积均匀和半径均匀是不同分布，圆盘采样不能直接使用线性随机半径。

现有 `chain` 按子效果数组索引偏移种子，插入一个子效果可能改变后续随机性；`cycle` 则按稳定粒子索引求周期，并允许寿命跨越多个周期的存活副本。新能力应保留后者的周期处理，并为组合层引入稳定 ID，避免局部新增层扰动整件作品。旧作品的兼容模式仍保留原行为。

运动明确四类作用：加速度改变速度、速度控制移动、位置偏移改变显示位置、约束引导或覆盖位置。工具提供确定的执行阶段并允许作者调整；同一阶段多个覆盖约束应报告冲突。发射器的移动、出生时速度继承和已出生粒子是否跟随，分别声明。

低视角水面等效果可以使用轻量投影坐标，不必引入完整三维物理。身体表面映射也不能泛化为任意角色自动重定向：缺少像素对应关系时，只开放该资产确实支持的挂点、轮廓和空间变换。

### 4.2 字段与图像需要精确类型

| 数据 | 含义 | 必须避免的混用 |
| --- | --- | --- |
| `ScalarField` | 声明数值范围的标量场 | 把当前 `noise2` 的有符号值直接当 0 到 1 阈值 |
| `VectorField` | 声明是像素位移、速度还是其他向量 | 用速度场直接作为像素偏移而忽略时间 |
| `DistanceField` | 到指定边界的距离，单位为像素 | 将归一化排序值当作固定宽度边缘 |
| `ArrivalField` | 每个位置首次到达的时间或明确未到达 | 对非单调前沿求一个含义不明的反函数 |
| `RankField` | 一组位置或片段的出现顺序 | 把顺序等同于空间距离或真实传播速度 |
| `Mask` | 某空间内的布尔或覆盖区域 | 混淆 alpha、颜色和空值 |

`image.scroll` 改材质坐标；`image.warp` 用位移重映射；`image.advect` 用速度场和求解步长搬运内容。采样的最近邻或其他方式、边界循环或裁切、是否周期都明确。平流是艺术可控的图像算子，不预先承诺完整流体守恒。

消融的场值带宽与固定像素边缘宽度分别控制。变化区域由前后区域差分得到，附带时间区间；任意跳帧的差分不冒充一帧事件。动态场需要比较实际区域，不能只比较两个阈值。

### 4.3 中间结果应继续可用

以“侵蚀边缘冒火”为例：

```text
轮廓与噪声 → 到达或排序场 → 保留区域
                              ├→ 颜色与表面材质
                              ├→ 边缘 mask → 外光与亮核
                              └→ 变化区域 → 出生采样 → 火星与烟
```

这里减少的是重复扫描、阈值计算、法线估计和重复发射管理。作者仍选择轮廓、推进方向、边缘表现和烟火比例。变化事件具有稳定身份，重放不累积到上一次运行的状态；超预算时按照显式策略报错或丢弃，并报告数量。

## 5 最小算子契约示例

以下为设计示例，并非当前可执行代码：

```text
domain.sample({
  domain, measure: "area" | "boundary", densityField?,
  count, seed, channel, space
}) -> SampleSet<id, positionPx, tangent?, normal?, weight>

curve.scalar({
  input: "scene.seconds" | "local.seconds" | "particle.age01",
  points, interpolation, outputUnit, extrapolation,
  limits?, overshootPolicy
}) -> BoundCurve

image.dissolve({
  image, field, threshold, edgePolicy,
  previousKeepMask?, previousTime?, time, sampling
}) -> { image, keepMask, edgeMask, removedMask?, addedMask?, interval? }

trail.history({
  trajectory, length: { seconds? | pixels? }, spacing,
  width, material, deathPolicy
}) -> DrawableStrip
```

`count`、`measure` 与方向独立。曲线声明具体插值参数，不能把“平滑”和“贝塞尔”视为同义词。拖尾长度不能含混地同时表示秒、距离和历史点数。新公共 API 对非法颜色类型给出定位与转换方式；旧底层高速路径仍可以要求 Color32，但该要求必须出现在公开定义中。

## 6 能力成熟度与部件登记

目标目录采用四种状态：

| 状态 | 可作何种承诺 |
| --- | --- |
| 参考片段 | 可阅读和学习，有明确源码边界；不能直接调用 |
| 可执行部件 | 有固定依赖、签名、示例和隔离预览 |
| 契约已验证 | 增加类型、时钟、种子、边界与局部修改的验证证据 |
| 创作已测评 | 独立创作者使用公开接口完成创作和修改，记录负担与表达结果 |

这些状态可以分别记录最近验证版本，不用一个笼统的“可复用”标签覆盖全部情况。字段、图像和路径在内部可保留高效数组表示，但对作者暴露其数据含义和稳定身份。

优先包装已经反复使用且边界清楚的辅助函数；为耦合片段先制作候选与对照，再决定抽象。只有真实创作暴露出公共需求时才把专用画法提升为通用 API，避免为了统一而抹掉部件独有的表现力。
