# 粒子闭环：参考构建与代码提炼对照

当次核对跨越2026-11-05/06（Asia/Shanghai）。[站点](https://tsnm-spine-particle.com/)现公开脚本为[index-CV5L3uYa.js](https://tsnm-spine-particle.com/assets/index-CV5L3uYa.js)，1,329,331字节，SHA256 `24145c3c55336361fa6528a44ee7aea75bee9a590b5d6dc7a738dd3e1122ba01`。与前次CFDvMOEj构建不同；不沿用旧构建的压缩符号作为当前源码名。只读取公开生产脚本，未声称获得完整开发仓库或原始TS源码；未将第三方bundle引入项目运行时代码。

读取范围：当前默认系统字段、出生创建段、主更新段、资源与序列选帧段、汇聚/到达杀死与碰撞分支。源文本定位以此hash的属性名和字节位置为辅助：默认速度继承约410251；出生速度继承约532258；出生差异力和相位约536424；汇聚路径约553195；序列选帧约740012。压缩文本位置只是核对入口，不是跨版本稳定接口。

| 观察到的底层机制 | 本项目采用方式 | 不直接继承的耦合/差异 |
| --- | --- | --- |
| 爆发、连续、常驻；区域/边界与内收发射 | schedule输出显式出生，domain与direction分别选择；补point/sector与resident/cycle | 内收不绑定边界；不默认到达就死 |
| 随机寿命、速度、旋转、尺寸、资源权重与相位 | 每出生/属性具名通道，支持显式相关data；加权资源与frameOffset | 不使用临时时间构造可观测ID；新增属性不扰动已有随机序列 |
| 从前后发射源位移估算并继承速度 | 作者在出生源变换明确提供velocity，再按系数继承 | 不从输出fps求导；比例采用倍率，不沿用百分比面板 |
| 重力、风、空气阻力、径向/切向加速度 | 库内解析drift通用化；复杂力用120Hz出生年龄时钟；radial/attract可组合 | 不继承重力50、风10、径向1.5等内部倍率；单位为px/s²、1/s |
| 延迟汇聚、路径混合、到达/越过后杀死 | 延迟阻尼吸引force与独立kill/trajectory回调；自写轨道无需维护积分循环 | 本轮没有直接实现其完整黑洞路径混合/扫掠半径算法；采样杀死只承诺tick精度 |
| 生命周期透明、尺寸、旋转、色带；单图/加权图与序列 | ScalarCurve/ColorCurve和普通回调；Texture/Sequence按age01或age秒选帧，独立轴心与着色 | 不把邻点Hermite误称Bezier；本项目smooth明确为逐段smoothstep，默认颜色hold保有限色 |
| 运动轨迹与独立条带、碰撞与衍生 | 保留作为下一轮提炼候选，已读库内sparkAt/sim接触实现 | 本轮probe连线只是离散状态可视化，不是历史拖尾、碰撞或二次发射 |

另一基石的具体代码出处与直接复用记录见[实现地图](../../../../docs/ai-vfx-tools/implementation-map.md)。新material适配器直接调用现有库画法；新motion与原fly/flyV/drift有数值对照，六个material入口与原函数有颜色/光逐像素对照。参考开发作品为`lab/cinder-orbit`；独立作者只读公开契约，不读这些开发说明或实现。

原先的[研究记录](README.md)和[evidence.json](evidence.json)保留，属于各自hash的观察，不用新bundle的变化覆写旧证据。原始公开bundle仅存ignored `records/vfx-lab/research/tsnm-spine-particle/index-CV5L3uYa.js`，供本地hash复核；不作为运行依赖。
