# 距离传播与次级响应提炼

本波依据是“陨种开脉”原报告及v3作品中实际手写的工程：遍历裂枝顶点、i%4筛点、按屏幕距离排斥、11个站点截断、impact+.13+d/74出生，以及按最大d反向退场。原始文件与报告保持在上一波评估，未用推测替代反馈。此次把这一条链合并成一个功能波次；不把每个别名/文案单开创作验收。

## 第一基石：真实实现路径

| 已读实现 | 本波处理 | 保留边界 |
| --- | --- | --- |
| `src/fx/ice/_lib.js:fractures` | 将原walk抽到`src/core/branching.js:fractureBranches`，在真实分叉点记录父ID/局部附着距离，旧helper映射回原平坦三元点列表；SDK包装复用同一walk | 原随机消耗顺序、递归深度2、候选终点inside、累计d、后序列表；不猜拓扑或重新造裂枝算法 |
| `src/fx/ice/_lib.js:drawFractures` | 保留原画法；新segments提炼同一“累计距离域连续裁末段”，返回可替换材质的几何 | 不复制整套裂纹预设；未改变旧draw |
| `src/fx/impacts/_lib.js:walk/makeCracks/drawCracks` | 复核子枝d0继承、地面钳制、末段线性插值与heat(d)分离 | 不把此处len像素范围与ice的len步数混用；未改偏前地面生成器 |
| `src/fx/ice/frost-nova.js:front/reachedAt/sites` | 提炼一个前锋决定站点到达、同到达生成主体与碎屑；将手写特定三次反函数推广到现有ScalarCurve的linear/hold/smooth单调结点 | 非单调/任意回调没有自动反函数；生长/反向退场分开 |
| `src/authoring/path.js:polyline/sample/resample` | 用现有清理/弧长/父枝位置查询；sites采用固定局部距离格点 | resample原本按ceil后等分含终点，不能假称固定格点；新sites不改变它 |
| `src/authoring/curve.js:scalar` | 前锋复用同一时钟、单位、smoothstep和hold语义；反解前验证单调 | 48次二分只适用于该分段smooth，非任意曲线的精度保证 |
| `src/authoring/contact.js:births`与schedule/particle | 提炼稳定因果复制ID、创建时生成/非逐帧触发、跳转纯查询；直接接现有emitter/observe | 路径到达不是物理接触；不伪造contact事件或新的网络probe |

在抽取前固定16组原helper输出：几何JSON SHA256、后续4个随机数、64张240×200的原color/light整数栅格摘要。回归逐一比较。该证据针对成熟walk与画法，不等于所有旧效果全动画逐像素对照。原Sprite Fusion ice / MIT / Copyright (c) 2026 Hugo Duprez声明在共享模块和原helper保留。

新SDK是`propagation.network/fractures/sites/arrival/births/segments`。显式森林/树，不支持合并/循环图；设计距离保持独立于投影；站点按距离/身份稳定排序，画面间距采用有明确预算的贪心格网筛选，不宣称全局最优。出生兼容现有粒子状态与公开probe。材质/主体形状/高度是艺术代码，不将其计为该由工具替代的工程。

## 第二基石：当前加载构建核对

重新读取[参考平台首页](https://tsnm-spine-particle.com/)，下载其实际加载的[index-Drqq4zQI.js](https://tsnm-spine-particle.com/assets/index-Drqq4zQI.js)，1,340,528字节，SHA256 `5969ff4d8b883c13dc477223ae8e690a4c8a88e825bb9615bc9efd05f74296af`，与上一波同构建。仅阅读，不执行整包。raw/检索偏移与片段在ignored `records/vfx-lab/propagation-research/`。

- 解码字符偏移444285的`bv`：根据累计路径段长度表把归一进度映射到段，处理闭环wrap/开放clamp，再求三次曲线位置与切向角。吸收“距离参数/位置与方向/边界策略分开”的机制，与Athanor已实现path互证；它不是任意曲线精确弧长求逆的证明。没有复制其源码。
- 默认`pathDuration/pathReverse/pathLoop/pathSpeedMode`位于413101之后的配置段；与既有路径运动分离复核，配置本身不当作运行时证据。
- 偏移551282、569605、731731附近三条更新路径的`blackholeDistanceDelay`：delay与当前距离/1000乘系数合成，再判断粒子年龄触发吸引；随后按寿命和运动更新。吸收“距离决定延后响应”和出生/运动/寿命分离；**未照搬动态距离不断改变触发阈值**，本SDK首次到达由固定设计距离和声明前锋在创建时确定，便于AI查询、修改与重放。

两基石用于算法与机制，未复制人类编辑器，也未将距离延迟说成平台已经具备稳定分叉事件。共同投影环/主体状态和完整物理破裂仍待后续。

## 验证边界

新增回归覆盖旧算法/RNG/栅格等价、父子距离与乱序、设计/投影分离、生成与候选预算、格点/间距/身份、首次越过和反向/平台/hold/smooth误差、真实emitter跳转、半开存活、因果数据副本与连续裁段、坏拓扑和公开发现。独立作者报告与原图证据另归档；技术通过不赋予审美通过、净节时或全面能力跃迁结论。

独立闭环现已完成，见[深海雷珊瑚证据](../../evaluations/2026-11-07-propagation/README.md)。三版/16页、显式树的16站因果与反向退场、157帧同run交付及缺稿重放，原报告和维护者数值边界的原作者补测分离。随机fractures/压扁投影未在该作品实际使用；艺术与未测边界按原报告保留。
