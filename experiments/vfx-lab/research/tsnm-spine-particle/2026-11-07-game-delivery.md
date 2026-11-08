# 引擎中立消费基线来源

第一基石沿用lab.mjs:exportRun的TexturePacker样式frame rect、pivot、loop、events、bounds和独立color/light。保留旧rounded毫秒字段，新增exact frame.time秒及authored duration，避免消费端按四舍五入毫秒累计漂移。不会再烘焙当前效果，成品和源PNG都来自选择的run。

实际检查`src/core/fx.js:composite`对透明straight color和饱和additive light的处理、`src/core/painter.js:blendPx/add`的像素和亮度约定、`src/authoring/texture.js:draw`的像素中心逆采样与pivot。`src/playback/index.js`在无SDK/DOM/文件依赖的独立模块内适配同一合成约定和最近邻几何；不是把完整authoring SDK塞给游戏。Node loader只是文件SHA/PNG适配，PNG decoder直接随包保留原模块。文件身份在pack.json，每包独立copy到仓库外也能加载。

第二基石参考已核查生产包的resource/sequence/pivot/blend分离与生命周期拆解。它的编辑器烘焙不是我方游戏消费认证；不移植Spine运行时、人类编辑器或引擎插件。本波以真实中立场景组合为验收来源。

新的可选game-*示例是原创透明部件：命中、可取消技能、2秒相位loop、匹配零相位outro、脱离粒子。它们只演示怎样拆交付，不强迫固定技能DSL或状态形状。烘焙图集不能恢复任意内部粒子尾部，公开契约明确要求选用匹配取消/移交版本，避免虚假功能承诺。

独立作者原报告发现消费时间的十进制边界与静态美术单帧atlas样板。修复保留原报告：输入十进制差/乘/周期取整不走epsilon/fps网格；imageAsset复用同一PlaybackAsset/instance/compose路径，但caller-image的sourceRun=null，不伪造冻结run。writeFrame为Node图像输出适配，直接使用随包PNG writer。原场景/像素对照和专项错误恢复分别由原作者补测，见Clockglass两份报告；没有改画作者的场景或代替艺术决策。
