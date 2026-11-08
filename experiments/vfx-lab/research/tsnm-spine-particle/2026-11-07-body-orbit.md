# 程序主体、共同投影与附着源

里程碑目标为AI场景主体协同0.4：同一主体状态驱动普通程序绘制、投影环、真实附着源及保存状态观察，并完成新独立复杂创作/原图局改/缺稿重放/同run交付。不是工作包5或完整身体场景整体完成。

## 真实反馈

“陨种开脉”原报告手写共同中心、sy压扁、roll和近远半环；“深海雷珊瑚”原报告手写父枝长度、inward出生到寿命Map，以及缓存/observe与证据连接。早期地爆天星和用户引力炸弹反馈暴露主体/环/光锚点各写中心和节奏时易失配，自画主体缺少真实状态查询。造型、杯腔釉壳、材质主次和艺术时序仍由作者设计，不把它们列为该工具替代的工程。

## 第一基石的具体提炼

| 读取路径 | 保留/提炼 | 未扩大承诺 |
| --- | --- | --- |
| `fx/arcane/arcane-orb.js:setup/ring/pos` | 提炼共同center、圆→sy压扁→画面roll、sin角侧和同路径亮点为orbit；普通圆点和环上源共用同一求值 | 未复制整个法球/循环；保留Sprite Fusion energy orb、MIT、Hugo Duprez署名 |
| `fx/holy/halo.js:draw` | 近厚远薄、亮点/尘出生在同一环几何的分离，保留为可替换width/color/alpha与轨道源 | 近远只是平面分层约定 |
| `fx/shadow/black-hole.js:disk/hole` | 对照真正的反向扭曲采样/远盘透镜，与普通半环明确区分 | 未把椭圆当作引力透镜或任意3D遮挡 |
| `core/Painter:place/toX/toY/fromX/fromY/each/rect` | 正逆变换与逆采样用于body局部几何画笔；rect复用一般填充分支，避免放大整数点快路产生孔 | 不修改旧Painter；点/1px线仍为输出像素笔触，整位图缩放用texture |
| `core/rig:boneFrame/solve/render`及深度缓冲 | 复核局部帧/挂点/矩阵和深度语义，保留真实身体机制待5.1/5.3 | 新body仅2D源+缩放；drawAll声明排序不是复制骨架或逐像素Z缓冲 |
| `authoring/motion:secondsSignal/source/pathSource/sampledSource/observeSource` | 将已有secondsSignal提为共享模块，复用完整SourceTrajectory；body.anchor/orbit.source用链式法则连接缩放/旋转/局部运动与源速度 | 发射方向独立，不捏造椭圆切线角速度，不将显式差分升级为解析 |
| `authoring/path:polyline/sample`、`core/branching` | attachVertex直接读成熟path清理后的顶点/段start，保留所有旧attachPx行为 | 不猜原始重复点索引，仍拒绝不吻合附着 |
| `schedule:resident`、`fx/ice/_lib:endBy`、propagation.births | until连接明确身份的起止Birth表，沿用end-start和截止寿命，消掉作品反复Map关联 | 缺止点/重复止点/非正寿命明确拒绝，不做任意事件自动匹配 |
| `observationSeries/probe/sourceProbe/saved-view/fxlib.canvas` | 增加真实BodyObservation/稳定描述与frame状态；原尺寸分页复用既有canvas/网格预算，CLI/MCP/HTTP共用Schema与返回 | 状态页为声明bounds/anchors示意，不推断像素归属；旧run不补造主体 |

body不要求固定艺术对象DSL；create/sample/draw/anchor/observe只是普通JS可组合对象。body.bounds不裁切绘制，不从像素估主体；颜色与光仍由原Painter/整幅验证处理。轨环采样对每个π缝断段，使用矩阵伸长上界控制段长，复用连续strip，不重新发明点串带。

## 第二基石的当前机制核对

本波重新读取[网站首页](https://tsnm-spine-particle.com/)实际加载的[生产脚本](https://tsnm-spine-particle.com/assets/index-Drqq4zQI.js)，1,340,528字节、SHA256 `5969ff4d8b883c13dc477223ae8e690a4c8a88e825bb9615bc9efd05f74296af`。只下载阅读，没有执行整包或移植网站源码；raw/hash/片段在ignored `records/vfx-lab/milestone-04/`。

- 解码字符447444附近`sf`，通过父矩阵乘局部旋转/比例，区分onlyTranslation/noScale/normal等继承；复核可共享矩阵与挂点投影的机制。Athanor本波不实现完整Spine继承模式，只用自己的source和有限2D缩放，保留已有rig为后续身体基石。
- 517178附近attachedBone路径，发射偏移由骨骼a/b/c/d变换后加骨骼位置，再独立选择是否继承旋转。吸收“附着位置与发射方向分开”，对应body.anchor的真实点位置/速度与显式刚性方向；没有继承网站字段或人类面板。
- 532380附近enableVelocityInheritance，按源相邻采样位置差/时间加进初速度，随后寿命/贴图/缩放单独初始化。Athanor复用既有SourceTrajectory解析/显式差分来源，本波把扩缩轨道点的导数接入，**不用输出FPS作差分步长**。曲线跳变/折点仍保留side与不连续信息。

这些是机制交叉核对，不是取得完整开发源码、网站性能/导出认证或任意3D能力的证明。

## 验证边界

新增11项回归覆盖共享源、扩缩/枢轴/反射/运动挂点的数值导数、真实出生速度单次继承、生命/JSON/异常、放大填充/贴图、原成熟投影公式/近远接缝/段长/预算、轨道全通道速度、far→body→near像素、attachVertex/until错误恢复、主体描述/存储、缺稿冻结查询/同run交付与MCP全部原尺寸页。完整119项通过，零skip；首轮新测试的palette字段/有符号Color32/MCP isError断言错误保留，修正的是测试调用与预期，未删真实断言。

开发示例lab/orrery-relay已公开render/主体probe/原图/验证；这只算开发验证。里程碑须新独立AI作者，仅用公开契约完成跨题材复杂作品、至少两类局改、实际原图与冻结交付；原报告和修复补测分开归档。未覆盖的完整act、身体表面、任意3D/碰撞/外部资产/引擎不能写成完成。

独立闭环已完成：[巡游的琥珀星炉](../../evaluations/2026-11-07-body-orbit/README.md)四版/26页、真实共同主体与源/出生/脱离核对、145帧同run交付和无草稿重放；v3艺术出界失败、v3.1参数修正和平台提示修复定向补测分开。最终119项零skip，原报告保持；未测变体/艺术局限不扩大为通用效率或完整身体阶段结论。
