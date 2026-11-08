# 0.9 状态表现生命周期

实际阅读status/_lib的shape/tnoise/travel/tongue/smoke/ember、burning.spots/draw/drawBack、poisoned.body/offsets、stunned.ring/draw1、holy/heal的行扫描/恢复，以及core/fx.createFx.loop/stop。

原库已经有循环和0.3秒整体停止淡出，不能宣称首次支持生命周期。本波将游戏明确给出的apply/refresh/remove、强度与到期输入变为纯查询表现状态；保相位/重启相位由作者指定，不移植伤害tick、叠层或buff管理。出生格在保相位刷新时不重排；解除停发但不夹短已脱离粒子的life。

身体扫描/材质坐标继续用surface，不造第二套body mask；可选heat使用成熟tnoise/亮度映射，flame直接调用tongue并保留Sprite Fusion fire/Hugo Duprez/MIT。环绕状态复用orbit的同投影/近远部件，参考stunned的后/前层关系但不强制星星/小鸟。status.bind只是同一可见Body的可选状态通道，沿body.observe/probe.data读真实生命周期，不用调试粒子。形状、颜色、强度映射与合成顺序仍自由绘制。

参考平台沿本轮实际生产构建index-Dc9n0jGG.js（SHA256 7433af92a9dc349801b6bf3d0e38fb52bc9b45aec7113e4f8e307cd94129eeba）核对stream/burst/persistent、birth lifetime/opacity曲线及系统duration与活粒子结束分离；环带intro/loop/outro仅作为该机制的分解参考，不冒称所有普通粒子已有统一状态协议。没有复制人类面板或将其全局状态当游戏规则。

本波只先验证身体材质/轮廓与环绕/附着粒子两类。legacy的13件状态未全部迁移，任意刷新策略、外部骨架与游戏规则仍不是承诺。新独立创作者的实际结论与原报告另存。
