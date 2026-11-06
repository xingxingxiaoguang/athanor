# 接触与二次出生：两大基石核对

2026-11-06（Asia/Shanghai）。本轮重新读取参考站点HTML与当前生产脚本：`https://tsnm-spine-particle.com/assets/index-CV5L3uYa.js`，1,329,331字节，SHA256 `24145c3c55336361fa6528a44ee7aea75bee9a590b5d6dc7a738dd3e1122ba01`。仅静态阅读相关分支，没有执行整个第三方bundle，也没有取得开发仓库。

参考平台的碰撞默认项约412139字节，更新逻辑约553934–556950字节。可见ground/circle/rectangle、反弹与摩擦分解；水平ground在更新后检查位置与法向速度，钳回平面、反射法向、衰减切向，低于阈值转为零法向速度。另有旋转平面和容器分支。本轮取其接触响应的分解方式作对照，不移植面板或内部倍率，也不宣称已实现其所有几何体。

| 原实现路径 | 提炼或保留 | 本轮差异与边界 |
| --- | --- | --- |
| `src/fx/fire/_lib.js` `drift`、`sparkAt` | 解析飞行、夹逼首次到达、法向反弹/切向保留 | 复用现有ballistic，转向点分段后64次二分；覆盖帧间下穿；去掉0.25px避碰偏移 |
| `src/core/sim.js` `GRIT`/`SPARK`/`BRAND`、`Bits` | 反弹、低速停留、落地通知、死亡响应 | 稳定事件含父ID/copy/ordinal及撞前后速度；纯读取与稳定子出生不依赖更新帧 |
| `src/fx/water/_lib.js` `Drops.onLand`、`bead`、`ring`、`Ripples` | 落地驱动涟漪；直接导入成熟水滴/涟漪画法 | `material.waterDrop/ripple`适配公共State，保留可替换调色、半径、扁率、包络与独立光量 |
| `src/fx/explosions/small-explosion.js` `BRAND.onLand`→`Blazes` | 接触后衍生另一材料/生命周期 | 通用事件→births，不复制整个爆炸预设；允许作者自写材质/响应选择 |
| 参考平台ground响应 | 显式恢复系数、切向保留与低速阈值 | effect坐标+y向下，静态水平面/点主体；仅恒加速度和分轴阻力，不支持force组合 |

`contact.trace`、`contact.events`、`contact.births`和事件观察/冻结探测分开。死亡边界为半开寿命；事件表一次建立、全run不可变，窗口读取不消费。工程上复用既有运动与画法，艺术上不强制“水滴落水”构图。可拆示例为`lab/landing-relay`，不是独立创作测评。

原库MIT/Hugo Duprez署名保留；适配模块注明来源。原`src/core`、`src/fx`没有改写。第三方生产脚本不是运行依赖。原始下载/代码摘录留在ignored `records/vfx-lab/research/contact-events-20261106/`；独立测评另存`experiments/vfx-lab/evaluations/2026-11-06-contact-events/`。
