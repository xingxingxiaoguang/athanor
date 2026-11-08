# 局部技法复用与连续改稿

2026-11-08 重新获取[参考平台](https://tsnm-spine-particle.com/)入口与生产包`/assets/index-Dc9n0jGG.js`，1,345,727 bytes，SHA256 `7433af92a9dc349801b6bf3d0e38fb52bc9b45aec7113e4f8e307cd94129eeba`，与1.1研究构建一致。没有将第三方脚本存入仓库。

第二基石核对：约411194位置保留发射/继承旋转与stream、inward等运动配置；约246852位置存在独立colorStops/alphaStops材质配置，约411022位置blendMode默认lighter。此前同构建研究已经跟踪其出生、年龄和生命周期着色/大小与发光。这里借鉴的是**出生/运动/寿命和材质独立控制**，不是其人类面板或像素烟云算法；本波没有移植第三方代码，也不从配置名推断完整流体/光照。

第一基石实际检查：

| 文件/路径 | 原实现保留 | 新增/适配 |
| --- | --- | --- |
| `src/fx/explosions/_lib.js:fireRamp/fireBall/lobe`；`small-explosion.js`、`smoke-bomb.js` | 冷却色阶、暗缝、分瓣顶光、余热、软烟边，原helper原样import | material.lobe只桥接公开position/age01/opacity和可换半径/热度，明确旧fireBall的life为剩余秒 |
| `src/fx/projectiles/_lib.js:puff/cloud/blur/Smoke`；`rocket.js:draw`、`muzzle-shotgun.js` | 密度叠加、双向blur梯度、顶光与火光混色、阶梯软alpha | material.cloud将整批存活State桥接为原puff列表；size/brightness/warmth可逐状态控制；不复制扫描与blur，不新增运动 |
| `src/authoring/material.js`；`core/painter.js` | Painter覆盖/加法光、局部坐标/变换、共享粒子状态 | 对lobe的opacity只传一次，保留它依赖alpha的软边；cloud与lobe色阶方向分别声明；字节对照覆盖旋转/flip/透明/外层Painter倍率 |
| `mechanisms.mjs`、`source-parser.mjs`、原effect inspect | 机制原文片段/修订、实际静态闭包 | 原符号可搜索、作品到库模块导出/机制映射；不返回SDK/runtime实现，不把静态可达误称实际生效 |
| `journal.mjs`、`lab.mjs` history/selection/validate/export | 原始公共调用/错误、冻结run、独立选择与交付关系 | history bundle聚合已有文件与作者说明，不重渲染/验证；观看仍为未核实的作者声明 |

原库爆炸与projectile文件保留Sprite Fusion / Hugo Duprez / MIT署名；适配代码注明直接调用来源。新结构发现和证据整理为本项目工具逻辑，不声称为参考平台能力。

明确范围：不是通用装配图、源码语义分析/自动安全抽取、流体、任意体积光或自动审美评价。普通JavaScript仍承担布局、造型和艺术包络；可直接导入成熟helper，也可替换画法。独立报告检验实际帮助，技术字节一致不代替创作可用性结论。
