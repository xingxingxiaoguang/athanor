# 真实历史拖尾：两大实现基石核对

2026-11-06，Asia/Shanghai。重新读取站点HTML与当前生产脚本`https://tsnm-spine-particle.com/assets/index-CV5L3uYa.js`，1,329,331字节，SHA256 `24145c3c55336361fa6528a44ee7aea75bee9a590b5d6dc7a738dd3e1122ba01`。仅读取，没有执行整个bundle，没有取得开发仓库。raw位于ignored `records/vfx-lab/research/history-trails-20261106/`。

## 参考平台实际机制

粒子trail默认参数约411725字节；历史更新约559270/573850：累计实际位置，达到最小位移才入列，按长度预算shift；导出更新分支另按输出fps缩放保留数量。绘制约579250：反向整理历史、累计走过的长度、等距再采样、切法线生成两侧，宽度/锥度/资源和混合分开。独立ribbon逻辑约481000按过去归一化轨迹进度求点；约489200按中心点和邻点方向生成两侧、另处理材质/纹理。因此粒子历史、速度短线和程序ribbon不应被合并成一种“拖尾”。

本项目继承其历史/几何/材质分解与累计弧长思路，不复制人类编辑器、内部尺寸倍率或输出fps关联；也不宣称本轮包含纹理UV带、动态Spine导出或空间误差自适应。没有移植该bundle代码作为依赖。

## 原库代码提炼

| 路径 | 保留/通用化 | 边界 |
| --- | --- | --- |
| `src/core/shapes.js` `trail(pos,t,n,dt)` | 从过去时刻重建位置；推广为出生锚定网格、明确时间窗口和边界 | 保留不同时间的相同位置，不把驻留年龄丢掉；不是无限帧队列 |
| `src/fx/arcane/arcane-missiles.js` `b.trail`/`ribbon` | 保留真实经过位置、命中后冻结淡出、按尾龄改变带宽/颜色 | 原定向/追踪算法未重写；画法不强制导弹外观 |
| `src/fx/arcane/_lib.js` `mote/streak`与fire/fireball的余烬 | 识别为当前速度方向的短线，保留成熟材质入口 | 不称其为真实历史，原实现不改写 |
| `src/fx/melee/_lib.js` `slash`、sword-slash | 保留独立头/尾推进、宽度与材质分离的程序条带 | 不把程序刀光替换为稀疏粒子 |
| `src/authoring/path.js` `strip` | 实际提取nearest-centerline像素栅格到共享strip.js；path与history共用 | 保留圆帽/并集接缝；历史增加断段和重合时新段优先，不生成miter尖刺 |
| `src/authoring/particle.js`与motion.integrate | 材质无关的闭区间track；接触终点/拐角、真实120Hz时刻；积分表避免每个历史点重算全部过去 | 任意replacement trajectory需显式终点；不从不可见State猜死亡 |

arcane-missiles及melee原文件包含Sprite Fusion/Hugo Duprez MIT来源；新trail模块明确署名，原core/fx保持。固定时间采样不保证任意曲线的空间误差，known corner/break是公开艺术选择。像素长度按保留折线算，裁切点明确标插值，不冒充新物理样本。

`trail.history/emitter/sample/draw/observe`与`probe view:trails`形成观察/修改链。开发参考`lab/rebound-loom`与技术测试不替代独立作者复杂原创，测评另存`experiments/vfx-lab/evaluations/2026-11-06-history-trails/`。
