# 带速度源轨迹：两大基石核对

2026-11-06（Asia/Shanghai）。本轮重新读取站点实际HTML及其生产脚本；当前仍是 `https://tsnm-spine-particle.com/assets/index-CV5L3uYa.js`，1,329,331字节，SHA256 `24145c3c55336361fa6528a44ee7aea75bee9a590b5d6dc7a738dd3e1122ba01`。仅读取相关代码，没有执行整个bundle，也没有取得原始开发仓库。

核对路径：默认velocityInheritance约410251字节；出生初速度的继承分支约532285字节。该分支用前后源位置差除时间差，再乘配置中的百分比倍率。它提供了速度继承的机制对照，本项目不继承与更新帧绑定的求导方式或面板百分比。

| 基石中的实现 | 本轮保留/提炼 | 差异与边界 |
| --- | --- | --- |
| `src/core/particles.js` fly/flyV | 位置与速度共享运动规律，单位px/s；沿用现有ballistic解析核 | 旧库入口不变，源变换与粒子出生后的运动分开 |
| `src/fx/fire/_lib.js` burn的tip(i,t-age)与drift | 保留出生时采样源位置、出生后脱离源的成熟行为 | source给视觉主体与emitter共用，同时返回速度；不是复制整个火焰预设 |
| `src/fx/moves/fireball-throw.js` THROW/HIT/SPEED | 主体与发射共享时间定义，减少重复时序同步 | 未接入完整act时钟，不宣称已完成身体适配 |
| `src/authoring/path.js` sample/segments/lengthPx | 直接复用弧长分段与切线，速度=切线×总长×每秒进度 | 自适应Bezier仍是分段近似；折点选时间侧，不伪造平滑角速度 |
| `src/authoring/curve.js` 分段插值 | 对现有linear/hold/smooth解析求导，补显式单侧、sum/product/affine链式计算 | sample值兼容；hold跳变不具有有限穿越速度 |
| 参考平台的源速度继承 | 继承平移及旋转出生点的速度；出生表保存source/pointVelocity供公开probe | 解析源不读输出fps；任意函数只在显式固定秒距下近似，并报告未知误差界 |

库内实现原有署名保留。新运动合成使用刚性变换链式法则，没有从第三方bundle复制实现；此bundle不是运行依赖。通用创作起点为可替换的source/pathSource及示例`lab/source-shuttle`，保留自写transform/trajectory入口。

原始下载与提取记录保存在ignored `records/vfx-lab/research/source-trajectory-20261106/`；本次检查与上一轮hash相同，不覆盖前轮研究。等价迁移、独立作者与适用边界记录在`experiments/vfx-lab/evaluations/2026-11-06-source-trajectory/`。
