# 0.8 技能部件与时间关系提炼

实际阅读melee/_lib全部swing/onSwing/plane/smear/slash/slashEnd，arcane-beam.draw的横截面/亮丝/源端/末端，spell-charge.orb/ringAt/draw的分层核/投影环/内收轨迹，core/chain.chain/shiftKeys/shiftHits与moves/fireball-throw的共享THROW/FLY/HIT。

直接调用melee helper并保留Sprite Fusion slash/Hugo Duprez/MIT署名；beam将原横截面/脉冲/亮丝适配已有path/stroke连续扫描，允许自由Path、头尾区间、宽度和完整shader；源端/末端不强制绑定。orb/ring独立，移除旧ringAt的固定地面裁切。infall保留二次内收/旋转机制，解析导数包含实际移动/转动源，作为普通Emitter开放材质与track，不复制原整件loop。

sequence将chain的局部cue偏移提升为普通命名阶段的纯计算，阶段名/顺序/绘制仍由作者决定。interval/at/retime共用实际截断；取消抑制未来出生而不裁掉已脱离寿命。没有迁移旧chain stateful更新时跨cue步长的误差，也没有固定技能树/招式DSL。

实际组合发现另一重复常量：作品修改charge时长后，静态events元数据仍停在旧时刻。lab现在兼容events(options)纯函数，按实际运行选项派生并冻结；inspect查默认值，显式事件覆盖仍有效。旧对象和旧冻结后端保持。skill-relay/hit-relay从同一阶段/命中记录生成事件，不要求作者再抄一份cue。

第二基石沿本轮首页实际加载的index-Dc9n0jGG.js（SHA256 7433af92a9dc349801b6bf3d0e38fb52bc9b45aec7113e4f8e307cd94129eeba）核对出生/寿命/opacity分离及start/duration、stream/burst/persistent分支。bundle保留在ignored milestone-07-reference；不执行整包、不复制编辑器、不耦合输出fps。本项目的取消事实与稳定身份协议自行明确，不把参考站逐步销毁当成精确事件。

维护者阶段核对发现默认taper在浮点端点可能得到微小负值，已将内部几何包络夹回其数学[0,1]范围；自写profile仍按作者值校验，不夹艺术超调。首次rate参数误用perSecond、来源method断言猜错属于开发者误用，未归咎产品。独立创作门另存。
