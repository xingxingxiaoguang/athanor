# 资产组织独立创作验证 / 2026-11-09

[创作者原报告](original-report.md)保留原始结果与EISDIR阻碍；修复结果另见[补测报告](retest-report.md)，不改写原结论。[构建摘要](build-summary.json)记录隔离身份。

公开起点：experiments/vfx-lab/README.md、docs/ASSETS.md、tools/assets list/inspect、tools/search/inspect。任务为240×192、2.8秒的“铜青断层炉”：真实复用新组织的studies/武器依赖，至少两轮局改，实际看原图、比较、缺草稿重放、同run选版/验证/导出，并在隔离库内测试一次收录。

原结果：三个作品版本；重放三PNG摘要相同；85帧×色/光入库核对零差异、61项已有依赖复用；新增入口inspect/render成功；README不变，注册表只写.cache。检查遇到无路径EISDIR，原报告判定该步骤未通过；另有一次调用者跨ID viewed错误，工具准确诊断并成功恢复。

完整公开调用、原始错误、原图、各稿源码、冻结run、交付与逐文件构建清单保存在ignored records/vfx-lab/creator-evaluations；本次清理结束时归档至仓库外的同次恢复目录，Git只保留上述轻量文字。复现实作可从公开指南重新生成run，旧validationRef不能跨克隆使用。

本次证明具体组合及依赖搬运/重放可行；没有美术优越、净省时或能力跃迁的对照实验。大闭包source inspect的返回量与带摘要私有helper的可发现性仍有改善空间，见原报告。

补测：原环境返回带路径/recovery的 SOURCE_ENTRY_UNSUPPORTED；移除隔离环境误跟踪依赖链接并 npm ci 后，工作区与暂存区检查通过。重载渲染三PNG摘要保持一致，README与原报告摘要不变。检查器从此明确拒绝源码软链接/子模块，避免底层EISDIR泄露。
