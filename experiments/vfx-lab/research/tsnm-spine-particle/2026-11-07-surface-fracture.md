# 0.6 身体表面与裂纹变化因果

## 真实反馈与交付范围

气功波原[tool-review](../../productions/2026-11-06-anime-vfx/kamehameha/tool-review.md)明确区分：造型是作者选择，统一身体/手部/动作空间和重复变换应由工具承担。0.5逆潮铸雷的[原报告](../../evaluations/2026-11-07-action-clock/creator/ARTWORK-REPORT.md)验证了实际IK/时钟、脱离粒子与body/source查询，也明确未覆盖身体表面和复杂遮挡。根交接5.3与用户确认的下一闭环是“移动角色结霜→裂纹蔓延→碎裂消失→碎屑继续运动”。本轮不由此前无对照反馈推断净节时或艺术提升。

## 第一基石的实际代码提炼

| 读取的实现路径 | 提炼/直接调用 | 保留边界 |
| --- | --- | --- |
| `src/fx/status/_lib.js:shape/colorAt` | 直接调用shape，保留占用格、上边、左右边、四邻接外部轮廓、八邻域加权外法线、列顶与行范围；新增显式材质origin和稳定像素ID | 不自动识别眼睛/服装语义；扫描二值声明遮罩，不从渲染像素反推身份 |
| `src/fx/status/frozen.js:plan/draw` | 核对霜蕨由侧边向内生长、雪顶/icicle roots取自真实形状、色彩按亮度拉向冰；提炼“同一材质格驱动覆盖/轮廓/生长” | 霜蕨造型仍可自由设计，不把整frozen循环固定为新预设 |
| `src/fx/ice/_lib.js:iceOf/cracks`、`core/branching`、已公共propagation | iceColor直接调用iceOf；裂纹仍用已提炼的原裂枝/设计距离/前锋逆解；crackField连接最近投影线段到达与横向侵蚀 | 不是测地传播或真实拓扑破裂；遮罩裁显示不阻止跨孔洞近距离影响 |
| `src/fx/transitions/burn-away.js:inField/outField/shed/update`及`transitions/_lib.field` | 前锋排序、首次扫过的像素脱离与次级响应。复用现有image.dissolve/dissolveEvents，不复制有状态pin/pout回调 | 静态首次到达表，普通draw/跳转不重发；任意动态场没有被自动逆解 |
| `src/fx/transitions/pixel-dissolve.js:layout/rank` | 核对稳定单元身份、独立入/出时间、形状/着色与调度分离 | 本轮基本单元为材质格，可自定义响应；没有强迫固定20px分块 |
| `core/rig.js:boneFrame/solve/skeleton/finish/srcFor`、`core/act` onBody映射 | 实际读取3D骨帧、IK和standing-rest像素对应，保留原算法不改；surface.bone调用0.5实际IK，提炼二维骨段帧，并复用body矩阵和矩阵导数 | 不依赖特定standing人物图、不复制其3D深度缓冲；明确为2D仿射部件，非任意网格蒙皮 |
| `authoring/body`、`core/Painter.each/shade` | 直接复用逆采样；同材质格在缩放/翻转/旋转后仍填满，shader每次绘制每格缓存一次 | 自由mask/颜色/层次，边界是声明格矩形，不称轮廓像素所有权 |
| `authoring/image.dissolveEvents`、`particle.emitter` | 先按静态到达为每个像素定时，再在它自己的播放时刻采样真实表面位置/法线/点速度；新增initial.velocityOffset在源继承后加effect向量一次 | birth.surface明确记录来源；不造位置0却有假速度的SourceTrajectory，不再对世界birth套表面变换 |

原Sprite Fusion冰/火适配的MIT、Copyright (c) 2026 Hugo Duprez及Hollow Crown的MIT署名保留；新surface/material适配头再次注明。原266个fx/helper及legacy core不改。

## 第二基石的当前构建核对

2026-11-07重新读取[首页](https://tsnm-spine-particle.com/)实际加载的[生产JS](https://tsnm-spine-particle.com/assets/index-Drqq4zQI.js)，1,340,528字节，SHA256 `5969ff4d8b883c13dc477223ae8e690a4c8a88e825bb9615bc9efd05f74296af`。只下载/读取，未执行整包或作为运行依赖；HTML/JS/identity保存在ignored `records/vfx-lab/milestone-06/`。

- 解码字符447444附近sf与449500附近kl：骨骼局部关键帧在动画时刻求值，再合父子矩阵。本轮将可见材质格与骨段附着共用同一时刻/矩阵；保持2D子集，不实现Spine导入或完整继承模式。
- 516900附近attachedBone：先求当前骨骼，再用a/b/c/d变换发射偏移、加世界位置；方向继承单独处理。本轮在**每个实际离开时刻**投影局部格，不把旧站立坐标直接送世界粒子。
- 532100附近出生速度继承与随后寿命/比例初始化：继续使用Athanor现成解析矩阵导数，离散pose只保留单侧/跳变来源；没有使用输出FPS差分。初始冲量与表面点速度明确分离，用effect velocityOffset连接。

## 技术与创作证据的边界

新增10项测试覆盖真实shape特征/孔洞/原点、逆采样填充/子集计数、非均匀反射法线/点导数、实际IK骨段/停顿、投影前继承距离、同字段消失/出生、速度继承单次/跳转、时间映射、预算/错误、冰色等价与公开冻结body/particle/同run导出。首轮公共发现尚未注册导致的失败原日志保留；注册契约后通过。旧128项和含新项138项完整回归均零skip通过；最后资源输入校验由同10项定向复核。

开发示例lab/frost-release有10个自由骨段表面，实际观察一张472×746原尺寸六时刻页，看到运动中的覆盖/裂纹/消失和脱离碎屑；技术验证通过。这是开发核查，不替代独立创作门。新隔离367文件构建`8cacc8d13fe39c6c2fe29dc5368f7323889f2e01463f66c2b412b5dfdbdbbff5`交由新fork_turns:none作者，通过公开契约完成另一复杂原创作品、两类局改、原图与冻结交付；原报告/修复补测分开。

## 独立作者发现的完整观测容量摩擦

《寒棘蜕甲》首次完整声明11主体、30粒子组、10组接触、181帧，触到原16MB观察保存上限；原调用`call-377e37bd-e375-4928-bb1f-6e765f5150dc`和失败源码不改。作者在原构建仅选关键真实对象继续三版、原图/数值/冻结交付，诚实记录其余对象观测缺失。这是容量边界的实际生产负担，不是把预期BUDGET错误说成渲染逻辑故障。

沿既有history-storage的无损索引/透明展开链扩展大帧保存：小于16MB的原v1/v2字节布局不变；超过时对完整帧JSON用Node内置deflate封装，带解码长度、SHA256和帧索引时钟核验。保存文件仍16MB硬限，新增解码总观测64MB明确界限；所有状态视图在选取前展开，旧history索引同样可组合。没有丢状态/ID、缩小帧数或另造粒子。Node18的[maxOutputLength官方文档](https://nodejs.org/download/release/v18.9.0/docs/api/zlib.html)已核对；实际测试环境仍为Node24，不据此声称已实跑Node18。

原完整失败源码在维护者修复快照成功：16,702,253字节逻辑观测保存为3,904,742字节，保留全部30/11/10组和181帧。相同背景后四张艺术图集逐字节相同；维护者另用draft/capacity-repro ID导致contact标题不同，原false结果和原因单列，不冒称五图相等。新增两个技术用例检验全部状态类型/组合history的JSON值无损、破损/超限/索引拒绝、公开saved/replay与缺稿重放。第一次严格JS对象比较中-0与JSON的0差异保留，改为比较原JSON语义，未量化浮点。140项完整回归零skip通过。

修复构建367文件`7ed0cbd879e571aee6cc4e1e15843bf788563d07cdf2271ce918862931f2acee`与原构建的6文件差异（存储/读取/manifest/文档/对应测试）明确记录。原表面算法、原fx/helper/core与艺术代码不改；同作者在全新干净快照定向补测完整v1及最终v3的全部真实声明，结果另存，不重做原创三版或覆盖原报告。

独立容量补测闭环已完成：22次公开调用全成功、另看2页原尺寸；原完整v1与仅恢复observe的v3均保留11/30/10组成功，五图与原画面相同，原共同状态/三个精确碎片数值保持，原133文件不改。新全声明v3为3,811,701字节，181帧缺稿重放的五图与packed observations同hash。完整状态/未测范围见分离RETEST-REPORT，未把旧少声明观察与新全声明观察说成同hash。
