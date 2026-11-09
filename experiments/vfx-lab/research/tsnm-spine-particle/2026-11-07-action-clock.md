# 0.5 动作时钟与实际骨骼挂点

## 真实需求依据

气功波原生产日志（清理前历史记录已移出当前仓库）第16行和tool-review记录：作者已直接用原库skeleton IK与poseAt的12fps保持插值，却仍自行画角色、查询手部并连接统一动作/释放时间、前后层。lab不自动执行完整act。这是实际生产的接线负担；角色橙蓝服装、尖发和材质属于艺术选择，不应固定进工具。0.4星炉原报告的多源/观察登记仍保留为后续组合候选，本轮没有把它泛化为场景DSL。

## 第一基石：代码实现的提炼路径

| 实际读取路径 | 保留/提炼的具体机制 | 本轮边界 |
| --- | --- | --- |
| `src/core/act.js:lerpPose/poseAt/isHeld/createAct/actTiming/actSpan` | 直接调用lerpPose，保留每段起点12Hz保持肢体、连续x/y、到达键缓动、snap；把数据里的命中stop抽象为纯局部→播放时间映射 | 不复制stateful update的dt越界和stop递减，事件边界精确可查询；不自动加呼吸、目标、摇屏、残影和尘土 |
| `src/core/rig.js:solve/ik/skeleton/posed/render/keyOf` | 直接调用真实IK后的20关节，复用默认角色像素；自画角色与源取同一局部pose/joints，再共用body矩阵 | 不用手部请求坐标冒充实际挂点；默认像素绘制保留原缓存量化，非连续皮肤/socket导入 |
| `src/core/chain.js:chain/shiftKeys/shiftHits` | 沿用局部时间编排、起始事件偏移和可替换普通JS子效果的组合思想；显式retime保留出生ID | 不把chain的stateful实例/回调触发复制到纯动作，不自动执行旧moves链 |
| `tools/lib/fxlib.mjs:renderAct`、`experiments/vfx-lab/clock.js:clockedFx` | 对照完整act的角色与前后效果顺序、固定更新时钟和纯seek；新能力独立opt-in，不改变旧播放 | lab仍fullAct:false；作者明确用action.draw/anchor/retime，脱离粒子按播放秒继续飞 |
| `src/fx/moves/fireball-throw.js:act/create` | 蓄势→THROW snap→飞行→HIT freeze→恢复，实际动作姿态与释放时刻的关系 | 可通过公共inspect复用act.poses；不会强迫套用整预设或静态手部偏移 |
| `src/fx/moves/sword-combo.js:act/create` | shiftKeys/shiftHits的多阶段连接、root x位移与武器属性 | 本轮只接受普通pose键，不把多段整招复制成强制模板 |
| `authoring/body/motion/particle` | 共用现成矩阵、源与出生时采样/单次速度继承、真实观察；连续root按局部→播放倍率链式求导 | 肢体保持间局部速度0，跳变声明并选侧；不按输出FPS差分，不虚构跨跳变速度 |

原act的Hollow Crown MIT、Copyright (c) 2026 rehan-remade署名保留，适配模块头再次注明。新增ActionClock、事件retime及纯采样是Athanor组合实现；没有改动原244效果及其helper/core的算法。原poseAt中的1e-6提前换姿偏置不复制，精确保持步边界使用ULP尺度判断。

## 第二基石：当前公开构建的机制核对

2026-11-07重新下载[首页](https://tsnm-spine-particle.com/)实际加载的[生产JS](https://tsnm-spine-particle.com/assets/index-Drqq4zQI.js)。1,340,528字节，SHA256 `5969ff4d8b883c13dc477223ae8e690a4c8a88e825bb9615bc9efd05f74296af`。原始HTML/JS保存在ignored `records/vfx-lab/milestone-05/`，未执行整包或作为运行依赖。

- 解码字符447444附近`sf`：父子矩阵及不同旋转/缩放继承；449500附近`kl`：动画时间采样局部旋转/平移/比例，再合成骨骼世界矩阵。本轮吸收“可见动作与挂点在同一个动画时间/矩阵上求值”，直接用原库IK与body，不重新实现Spine骨架或编辑器。
- 516900附近attachedBone：`kl(skeleton,activeAnimation,Pe%duration)`后，用骨骼a/b/c/d变换发射偏移再加骨骼位置；是否继承旋转单独选择。action.anchor使位置/偏移和朝向独立声明；toward用实际关节投影，offset的轴明确为角色局部轴，不冒称3D骨帧。
- 532100附近enableVelocityInheritance：相邻发射位置差/时间乘继承因子加入初始速度，寿命/缩放随后初始化。本轮继续用现成SourceTrajectory链式导数，不采用输出FPS差分；离散保持姿态没有跨跳变有限速度，必须由作者给launch impulse。

以上为机制交叉核对，未取得完整开发源码，也没有宣称参考站导出/性能或任意骨骼格式认证。

## 维护者验证与原构建之后的修复

原0.5构建364文件`12d7eb4a4401193a48202bf2df695904187a68467da1d0fc58e57cd2235488ab`：126项技术回归通过、零skip。开发示例`lab/action-relay`已公开渲染、原图窗口、验证通过；这仅是开发检查。

原构建交给新独立作者后，维护者检查出同一局部保持步恰好遇到hitstop时，poseJump会在离开停顿时重复标记，尽管播放左右姿态相同。修复为比较播放时间左右极限；还规范缺省x/y为0、范围边缘标记。原构建已明确拒绝极小停顿的浮点塌缩。保留原构建/报告，另做定向公开补测；修复不改原艺术像素和运动轨迹。新回归明确检查进入停顿跳变一次、内部/离开不重复。

独立作者实际公开probe又发现：from=-.4，hold(.85,.22)与hold(1.61,.16)后，播放2.39的右侧仍frozen=true/localRate=0，与公开契约相反。原调用`call-b187eb36-cf01-4365-abc5-4a7500f58975`和018-bodies.json保留。原因是浮点相邻值同时被判断为“近似终点”和“严格内部”；修复先明确ULP边界归属，再判断区间内部，边界local对齐hold.at，并拒绝小到左右边界无法区分的停顿。新增回归覆盖2.389999/2.39/2.390001、左右侧、clock.at反查与极小区间。这个缺陷来自实际AI使用，和作者自己的镜像初速度修正分开记录。

独立创作、全部原错误、实际原尺寸观察、选版和冻结交付范围见本波评估（清理前历史记录已移出当前仓库）。技术通过不代表完整身体/动作阶段完成、艺术定稿或净节时。

最终独立原创/修复闭环已完成：原49次调用/15页原尺寸与修复23次调用/17项核对/2页复看、128项完整回归零skip。最后从实际公开joints数据勘误20个关节，并依据原作者镜像/时间接线反馈补两个公开文档示例；这是文档小修，运行时/测试与独立补测构建相同，公开inspect核对但不额外启动创作门或宣称测得人效改善。原报告和两次构建身份/差异均保留。
