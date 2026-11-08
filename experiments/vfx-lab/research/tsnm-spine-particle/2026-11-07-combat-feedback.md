# 0.7 命中反馈：从成熟画法到开放组合

本波直接阅读ui/_lib.spell/drawWord/tintActor/lightActor/haloActor、ui/damage-number、ui/crit-number、impacts/hit-flash和core/act.Target.hit；并检查现行body/surface/particle/contact，避免新建目标状态机或粒子器。

| 路径 | 保留与提炼 | 边界 |
| --- | --- | --- |
| ui/_lib.spell/drawWord | 直接import，保留逐字形像素高光、描边、阴影、斜体与闪白 | 明确字形支持，不静默丢未知文字；自有字体可替换draw |
| ui/damage-number.create | 弹出弹簧、弹道、反弹挤压、末段上抬/淡出拆到真实Emitter | 解析contact.trace替代逐帧Euler；不是逐像素迁移原作品，不复制火花与文字的强绑定 |
| impacts/hit-flash.create / ui.tintActor | 提炼按原色亮度映射、白闪/冷却和hot-spikes/ring，移除standing胸口假定 | tint是普通shader组合，impact是独立可替换pass；不强迫角色或暴击美学 |
| ui/crit-number.starburst/shake | 检查星芒/震动与文字分解，保留原作品为公开参考 | 不把CRIT标签、巨大星芒或摇屏强制加入每个critical |
| core/act.Target.hit | 保留冲量、flash、skin分解的思路；原稻草人及状态机保持 | 游戏提供命中事实，不迁移完整Target、不造事件总线或结算系统 |
| body.anchor / surface.draw / contact.trace / particle.emitter | 直接复用精确挂点、材质格、解析接触及真实观察 | hit位置在事件时固定，着色在当前姿态，脱离粒子按播放秒 |

新增combat.hits固定外部事实，sample纯读取，births保留hit身份；numbers是普通Emitter。作者控制目标、文字、颜色、方向、时间、层次及防御表达。来源保留Sprite Fusion power-up/Hugo Duprez/MIT署名。

第二基石重新读取首页实际加载脚本：`https://tsnm-spine-particle.com/assets/index-Dc9n0jGG.js`，1,345,727字节，SHA256 `7433af92a9dc349801b6bf3d0e38fb52bc9b45aec7113e4f8e307cd94129eeba`。原始bundle仅在ignored `records/vfx-lab/milestone-07-reference/bundle.js`，没有执行整包或将其变成依赖。

UTF-8字符529963附近的Cl出生分支区分burst与其他模式的出生时输入/seed；537630附近先计算出生opacity，再独立读取opacityCurve；416427–416829的配置规范化区分burst寿命和持续发射。用于复核“出生事实/初值、寿命、外观”分离，沿用现有particle/schedule而非复制新配置系统。没有把其出生burst初始透明或内部帧倍率当本项目协议，也没有推断其具有游戏命中身份。

同时修真实AI摩擦：战斗中文别名/整词相关性；crit不再误取critters，hit不再因white子串命中；保留精确ID和同条目多词AND。active探针在最新采样优先级内跨组轮询，返回逐组selected/omittedActive，作者显式ID仍优先。独立创作结论另见评估目录，技术检查不能替代创作门。
