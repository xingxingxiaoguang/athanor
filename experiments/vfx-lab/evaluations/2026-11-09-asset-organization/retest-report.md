# 独立定向补测：资产检查诊断与依赖环境

日期2026-11-09。此为原报告的附加记录，未改写 original-report.md；其SHA-256仍为 `e7a99dbbb68ac050ab783489ac623758839778ce3a0956bc06463dc41408baf1`。

同一隔离快照保留了原作品/测试安装状态。研发方只更新了公开工具与门禁；补测构建 SHA-256 `c21416461615896efb51339f14722b368e50f7e77e241f04df525315b877ea73`，逐文件摘要由研发方提供于 retest-build.json。我只读元数据，没有读取实现或测试，也没有改产品代码。Node仍v24.22.1。

1. **原环境、先不修正依赖**：原样公开调用 `node tools/assets.mjs check`。得到 `passed:false`、exit1，结构化错误明确 `file:node_modules`、`code:SOURCE_ENTRY_UNSUPPORTED`，指出不能将symlink/submodule作源文件，并建议从Git索引移除链接、用npm ci安装依赖。证据 calls/retest-check-diagnostic.json/.exit。相较原始裸EISDIR，现在能由公开结果定位并采取下一步。
2. **依公开建议恢复环境**：Git索引显示node_modules是120000链接；lstat/readlink表明它指向父仓库的node_modules。只在隔离快照中 `git rm --cached -- node_modules` 并unlink这个链接，未操作父目标。然后 `npm ci` 成功，exit0，安装3包；现在node_modules是独立普通目录。npm记录有esbuild安装脚本未覆盖allowScripts的警告，本次已验证路径不受阻。未批准额外脚本或修改产品。
3. **相同公开检查通过**：`node tools/assets.mjs check` 返回passed=true，scope=worktree，302 effects、24 categories、498 dependencyFiles、errors=[]，exit0。证据 calls/retest-check-pass.json/.exit。
4. **暂存门禁通过**：只stage隔离测试入口、自己的模块及categories.js；先前node_modules链接删除已在索引。`check --staged` 返回passed=true，scope=index，302 effects、24 categories、498 dependencyFiles、errors=[]，exit0。retest-staged-paths.txt没有records或.cache，没有提交。
5. **安装入口仍可发现/渲染**：`assets inspect evaluation/copper-fault` 成功，63项静态依赖；公共render成功 `0fd1e7252374-3c5d7e6d`，call `call-22f84cc2-ce35-4643-959e-7c49693e92ae`，diagnostics=[]。色/光/合成PNG的SHA-256均与原安装入口render `0fd1e7252374-7333ee0c`相同，见 retest-result-identity.json；本次是同一艺术作品和安装状态，未重做或替换艺术选择。
6. **边界与原证据保留**：README SHA仍 `91db92f54d36c720cf352c3a8e90d335112c2b56f10b6c7e36972909ada01c3b`；原报告及原EISDIR不变。原测试的生成文件位置仍由library plan列为.cache中的三个文件；本次暂存清单没有生成目录。

结论：原先失败的触发环境是隔离快照中误跟踪的node_modules链接；本次修复使公开检查给出准确路径和恢复建议，按建议恢复独立依赖后，工作区及暂存检查均通过。新组织资产的发现、复用和已安装入口保持可用。此补测只验证已报告问题的诊断/恢复路径，不替代原始创作者评估，也不扩张到其他异常、目标引擎、媒体编码、性能、美术优越性或正式用户验收。

所有原始补测输出见 calls/retest-*；新run完整冻结证据在 raw-runs/0fd1e7252374-3c5d7e6d/。原报告不再有待修复的已确认阻碍；原报告记载的历史失败仍真实保留。
