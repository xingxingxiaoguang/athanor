# 冻结作品正式入库

`fx_library` / CLI `library` 是本地特效库的公开收录链路。仍使用普通 JavaScript；不要求艺术 DSL、手写复制脚本或 GUI。新 SDK 功能的独立创作者验收与具体作品的用户审批分别进行。

1. 创作、观察原尺寸、改稿、比较后，用 `history {action:'select',run,reason}` 明确选版，`validate {run}` 得到该 run 的通过记录。新版草稿不会自动替代已选版。一个效果 ID 可有多个已明确选过的冻结变体；后来选了另一相位，不会撤销先前变体的选版记录，入库计划始终指定准确 run。
2. `library {action:'plan',entries:[{run,validationRef,id:'weapons/my-flight',metadata:{name,description,tags}}],categories:[{id:'weapons',name:'weapons',blurb:'...'}]}`。最多 64 个分件、320M 保存帧像素，超出则显式分组。categories 可省；已有类别可复用。返回 planRef/planDigest、拟写文件及原 SHA、实际复用依赖数、每件逐帧色/光对照和来源身份。此时正式库零写入。
3. 用户已经批准这些作品后，调用 `library {action:'install',planRef,planDigest,approval:{ids:['weapons/my-flight'],reason:'用户的实际批准指令'}}`。批准 IDs 必须与整个计划精确一致；部分批准应重新生成较小计划。此参数只记录调用方提供的授权，不替用户作审美决定，也不要求已批准的用户重复确认。
4. `library {action:'status',planRef,planDigest}` 可检查文件/依赖漂移及事务。中断的安装用同参数、`action:'recover'` 恢复安装前文件，再生成/重试计划。中断进程的锁由 recover 识别；活动进程的锁不会被解除。若文件被外部编辑，恢复会明确保留并报告冲突，不能静默覆盖。

计划以保存源码和 PNG 为准，可在原稿删改后继续入库。只有冻结闭包与当前闭包完全相同时才复用当前 src 模块；其他普通源码依其依赖内容地址化到目标类别 `_sources/`，重写真实 ES module import 的位置，所有注释与署名保留。同内容依赖共享，不把开发工具后端搬进特效库。明确声明的本地 PNG 从原 run 保存的字节搬到 `_assets/`，不读当前同名图。正式入口可直接编辑，通过 provenance 保留原 run/sourceDigest/validation/selection；库的 search、inspect 和总索引都能发现它。

metadata 只改名称、描述和标签；meta.options 采用选定 run 的实际选项作为默认，画布/定位点/时长/作者声明保留。run-only 命名事件覆盖也保留。计划比较每一个已保存时刻、色层和加法光层的每个像素，并核对终帧；它不证明未保存时刻、其他参数、目标引擎或美术优越性。源码依赖、索引、分类、目录和 README 计数纳入同一计划。任何拟写文件、复用依赖、选版或冻结图像在安装前变化，都会明确拒绝并要求重新计划。完整调用/原错误可用 history 找回。

成功安装可重复调用，同内容时返回 idempotent。安装前保存备份，普通写入失败自动回滚；进程中断留事务供显式恢复。安装不会提交、推送或发布网络站点。

实现复用已有 `source-parser.moduleImports`、冻结摘要/依赖图、history 选版、validate 身份、120Hz clock、PNG 解码和共享 registry 生成器。import 位置采用 [es-module-lexer](https://github.com/guybedford/es-module-lexer) 的 lexer，不用全文件字符串替换误改艺术参数或署名。

入库后的 `inspect {id,sections:["source","provenance"]}` 同时返回正式入口与来源明确的 `sourceModules`，包含可复用的作品/原库辅助实现及 SHA 状态；不把 SDK 或运行时实现混入参考作品源码。作品仍能作为算法来源阅读与改造。对已经收录的效果再改稿、冻结、选版，也可规划同 ID 更新；原文件 SHA 和备份受同样保护。

对早期收录条目（provenance 没有逐模块清单），同一 inspect 会补充读取当前已安装的作品依赖闭包，仍排除 SDK/runtime，并明确 `matchesRegisteredDigest:null`、currentSha256 及“旧收录无逐模块摘要”。这提供可读源码，不冒充旧版冻结逐模块证明；新入库条目则核对记录的逐模块 SHA。
