# 武器生产触发的光路/电弧能力波

用户要求14种俯视战场武器，发射/弹道/命中/爆炸分离，审批后入库；并明确工具不足优先补工具。生产前核查发现已有schedule/particle/skill/combat能承担排期、运动/材质及局部阶段，但作者仍需手解激光贯穿、折射/镜面路径，以及拷贝闪电内部的分叉与链路前缘/命中接线。

第一基石实际检查`scifi/laser-grid.js:cross/laser`（交线、色带、光）、`authoring/path.js:polyline/sample`、`skill.js:beam`、`lightning/_lib.js:zigzag/bowed/stroke/crackle`、`lightning/ball-lightning.js:draw`与`chain-lightning.js:shape/level/传播/命中`。ray保留现有Path/beam绘制，不重造光带；新有限相交/法线、封闭介质身份和Snell是缺失计算。arc直接调用成熟分叉/弯弧/分层描线，只新增自由节点链接、真实弧长前缘、纯事件与观察，不整件复制人物/地面/原招式。保留Sprite Fusion/Hugo Duprez/MIT署名。

第二基石已获取包index-Dc9n0jGG.js（SHA256 7433af92a9dc349801b6bf3d0e38fb52bc9b45aec7113e4f8e307cd94129eeba）413869附近enableCollision与circle/box/ground参数，556396碰撞体bounce/friction。它有逐步粒子碰撞，未找到可据以声称已有光学折射协议的实现；本波不移植人类编辑器或把其步进碰撞伪称精确光路。电弧仍是艺术几何，不是电磁场。

Snell/全内反射的数学交叉核查采用作者提供的主源[PBRT第四版：Specular Reflection and Transmission](https://www.pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission)。仅按标准几何法则自行实现二维方向，不复制PBRT代码/光输运/采样器；能量为作者retention，不声称Fresnel或物理测量。

有限支持segment/circle/axis-aligned box；明确拒绝重叠/嵌套折射介质、不同面同点与无唯一法线的折射角点。时间算术复用本项目已验证的十进制输入策略，随机/闪变不依赖输出fps。技术检查与新独立创作门分别记录。武器作品生产另存候选，不在用户审批前改src/fx。
