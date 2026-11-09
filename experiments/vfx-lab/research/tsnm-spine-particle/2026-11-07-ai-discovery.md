# AI按需发现与原库机制入口

日期：2026-11-07。来源是星帆坞原始AI报告的完整tools/API被宿主截断、includeSource错猜字段，以及用户指出环/山体/裂纹问题后公开检索的零结果与helper不可inspect。小而确定的检索、诊断和契约优化合为一个波次，契约/流程影响由同一个新独立作者实测，不为每个别名单开验收。

## 实际实现路径

- `definitions.mjs:TOOLS/validateInput`仍为唯一输入/输出Schema；新`discovery.mjs`只派生短目录、单工具完整定义和修订，不复制另一套参数表。CLI裸tools改变为短对象，显式full保留完整数组；MCP标准tools/list、默认HTTP列表保留旧数组。`invoke`为非阻塞tools选择器传显式JSON参数；`inspect ref.kind:'tool'`让所有适配器按需查询。错误恢复直接给对应工具契约，无自动猜参数。
- `contracts.mjs:inspectApi`的按sections文档读取、`lab.mjs:search/inspect`的效果/算子区分是机制入口的基础。新`mechanisms.mjs`登记4组原库代码，单独maturity与callable标识；search不把它们冒称SDK。`source-parser.mjs:moduleImports`使用原Node ESM解析器提取真实直接依赖；不另写import正则。来源修订包含登记、文档与所读源码。
- `ice/_lib.js:fractures/drawFractures`与`impacts/_lib.js:makeCracks/drawCracks`：确认随机步长、inside停止、递归分叉、继承累计距离和末段插值；登记现有函数的准确单位、默认值、返回平坦列表/非拓扑ID的边界。source返回原文，不改裂纹算法。
- `arcane/arcane-orb.js:RINGS/setup/ring`：压扁、滚转、共中心、近远半环、环上亮点；`holy/halo`和`heal-aoe`作为完整参考。明确私有ring不能直接import，只是参考片段。保持原Sprite Fusion/Hugo Duprez/MIT说明。
- `nature/_lib.js:stoneShape/drawRock`：单位石形、分面与受光边，核对64×64工作区/N≤62，说明不是可任意放大的山体生成器。现有原函数直接import，不新造材质或放宽边界。
- `nature/quake.js:JOLTS/shake`、`nature/boulder`、`impacts/heavy-landing/ground-slam`：核对绝对时间局部衰减、触地后响应和层次。core/act已存在但lab未接完整播放，文档明确区分，不通过机制source暴露runtime。

注册源片段按固定边界截取原文，缺失/重复起点会拒绝，不静默返回别段；附原文件preamble保留出处。无任意文件读取。helper沿用旧参数语义，没有自动SDK诊断、身份与观察；不同阶段的代码不统一标“可调用算子”。

## 第二基石核对

重新获取参考平台首页实际脚本`https://tsnm-spine-particle.com/assets/index-Drqq4zQI.js`，1,340,528字节，SHA256 `5969ff4d8b883c13dc477223ae8e690a4c8a88e825bb9615bc9efd05f74296af`，与上一轮同构建。仅下载阅读，不执行整包，不移植第三方代码。raw与identity在ignored `records/vfx-lab/discovery-research/`。

核对默认配置的emissionMode（解码字符偏移409682）、scaleCurve（410627）、opacityMode（410967）、blackholeKillRadius（412833），与此前已读的出生、运动/寿命分离和吞噬机制相符。本波吸收的是**按可组合机制组织能力、给属性明确语义**，没有把界面选项直接变成工具或宣称取得完整开发源码。公开契约/短目录属于Athanor的AI工作流设计，参考网站没有作为现成AI发现API来复制。

## 验证与承诺边界

技术验证覆盖非阻塞短目录、精确单工具/显式完整列表、原错误与定向恢复、中文检索、helper/私有片段区分、原文与真实依赖、修订冲突、受限读取，以及HTTP/MCP兼容。完整回归还覆盖冻结运行与导出。

裸CLI tools默认返回形状有明确迁移成本：原媒体测试的数组.find调用在首轮回归失败，保留原日志；消费者显式请求detail:full后继续原测试，未删其媒体断言。MCP和默认HTTP旧列表仍直接验证完整Schema等价。

输出字节可用于证明指定返回更短，不推断总上下文、净节时或艺术提高。新的隔离独立作者已完成三版复杂原创、两类局改、12页原图、175帧移走草稿后的冻结重放/同run交付；发现负担、宿主批读截断、艺术局限与未实际触发的错误恢复体验见本波证据（清理前历史记录已移出当前仓库）。没有确认产品故障，未实施裂纹SDK、共同主体变换或自动审美评价。
