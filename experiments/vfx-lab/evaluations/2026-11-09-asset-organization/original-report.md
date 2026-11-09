# 独立创作者原始报告：铜青断层炉

记录日期：2026-11-09。本报告在任何产品修复补测之前固定，后续只能另写 retest，不改写本报告。

## 身份与边界

隔离快照 `/tmp/athanor-asset-creator-20261109-210834`；实际 HEAD `b7d2d880b10c3ab8e3ad9fc8653a330fc1d0e475`。交付给创作者的构建 SHA-256 为 `f13c8899f20bc1557c650049de75470f078e7199acc8cfb26ae20735249e4f1b`（未通过读取实现重新计算）；Node v24.22.1，darwin arm64。详见 build-identity.json。

我只从公开 README、资产规范、公开 authoring/library 文档、tools/search/inspect 契约和公开 inspect 返回的参考作品/helper 源码进行创作。没有读取 tool/runtime/SDK 实现、实现测试、sources.json、HANDOFF、其他作者解法或研发解释，没有子代理。所有操作只发生于隔离快照；没有向父仓库新增艺术资产或提交。

## 已完成的作品与真实复用

创作了原生 240×192、2.8秒单次效果：偏斜能量束击穿带铜色边缘的石壳，角形裂片/尘烟在中段展开，冷青电弧沿移动裂片接力，最后只留短冷辉并清空。不是照抄某个完整预设。石壳、射线、裂片轮廓和阶段关系由普通 JS 写成。

先用 `node tools/assets.mjs list` 得到301个入口，再 inspect `studies/drift` 和 `weapons/laser-pierce-flight`。实际使用：

- `src/fx/studies/drift.js` 的 `draw`：完整连续密度烟体渲染及其内部流动，作为局部烟层；没有复制 solver。
- 武器真实依赖 `src/fx/weapons/_modules/_common-f8537791.js` 的 `local`：直接做烟层缩放/倾斜和裂片局部旋转。通过 laser 的公开 reuse/source 发现，无需手写 Painter 变换代理。
- `src/fx/explosions/_lib.js` 的 `rock`：小型有明暗/热量的石屑；较大的角形裂片是自己的几何。
- 公开 SDK `arc.network/draw/observe`：沿实际移动碎片位置传播的任意接力图，after 与 travel 派生到达时刻；复用成熟电弧笔触。SDK 只读了 contract/example，没有请求 implementation source。

原模块/署名通过 import 保留；作品注释明确 Athanor / Sprite Fusion / Hugo Duprez / MIT 以及 DRIFT 的概念数值参考。原始公开返回在 calls/inspect-drift.json、inspect-laser.json、inspect-arc.json，资产完整依赖与摘要在 assets-inspect-*.json。

## 两轮局改与原图观察

所有查看均实际调用 `tools.view_image(detail=original)`，查看 `probe/compare` 返回的原尺寸 PNG；页面内每格保持240×192，pixelScale=1，没有缩略图冒充原图。没有 GUI-only 标准或自动审美分数。

| 版本 | frozen run | render call | 实际观察及改动 |
|---|---|---|---|
| V1 | `22e9966025ed-18fcd21c` | `call-d15f020a-de43-4dc2-a4c2-a795cdb81a07` | .1667/.4333s石壳像分离齿轮，.6s裂片偏圆；灰烟遮挡中段，2.1333s仍残留烟 |
| V2 | `8c7bd4d0c68c-8311ca06` | `call-bffc0c5a-c254-47e7-ac24-117a1b6d2609` | 封闭石壳、加暗缝；部分圆石改成不对称大角片。烟体/时序保持，用比较隔离几何效果 |
| V3 | `0d45fecd43da-78899ade` | `call-cd6dae1b-a2b3-41e2-bd2f-85abfb9f895c` | 烟缩小倾斜、68%透明包络、加快独立寿命，碎片提前淡出；电弧冷青；2.1333s只余冷缝，2.8s空白 |

实际看过：V1 probe `call-3b70ca87-044d-43b7-9076-f90e9241eeb3`（1000×510）；V1/V2 compare `call-2e5ab45d-9973-4b50-b3a7-1a337dcea990`（752×510）；V2/V3 compare `call-98c59214-e7e2-4af8-be2a-2b415e2e96ed`（1000×746）。PNG复制在 images/，具体判断保存在 observations.md。V2封壳仍有设计过的径向图案；我接受它作为本作品艺术选择。

技术对象观察 `call-155fdf7d-fb78-4060-a62e-b9a7ebaa5927` 查询真实 `arc/copper-relay` bodies：1.1s首链传播，1.3s首链保持/次链传播，1.5s西链到达，1.8s全部expired。没有从像素虚构粒子身份；自写大裂片未声明独立 body，工具不提供其独立对象查询。

## 查回、冻结重放、选版、验证与交付

公开 history 查回V1/V2/V3；随后把当前 V3 草稿暂时移出 drafts，实际 `render {run:V1}` 得到 `22e9966025ed-c6b6f273`，parentRun为原V1，call `call-cdc957ba-18f2-43b2-b8ba-b73ae26af535`。色层、光层、合成 PNG 的 SHA-256 均与原V1相同（replay-hashes.json）。完成后恢复自己的当前草稿。这实际证明本次相对JS闭包重放不依赖当前草稿。

明确选V3，decision `decision-06d93aa6-59fc-4c6f-8efc-f47685865789`（call `call-4f0ba534-4a64-4fe4-adbe-ca7167f5199d`），理由是角形石片更清楚、烟/电弧分离、末段独立冷辉。选择是创作者判断，不是用户艺术验收。

同一V3的 sourceDigest `7e0d3b5f1553e0f0270ff2f7cfccdd5376a12e3109a83738592adabcd463fb1b`。验证 `validation-d4c35fef-d891-4107-9f29-76733331f358`，call `call-e2097c1e-c492-49cb-9f46-14bb309e301b`，passed=true，无errors/diagnostics。抽样19时刻、seed73/7、色/光、时钟30/60/240；bounds与clear在声明窗口内通过。它不是逐帧穷举边界认证，savedFramesVerified=false。

export仍指定同一V3与上述validationRef，call `call-117a3d07-3ce2-4d71-86a8-3741ed307c6c`，导出目录 `raw-runs/0d45fecd43da-78899ade/export-be986f48/`，含原生atlas、色/光层和独立消费包。未请求MP4/GIF。

## 测试入库与资产边界

按任务明确的测试授权，向隔离快照 `evaluation/copper-fault` 做plan/install；approval理由明确“仅一次可丢弃快照测试，不代表真实入库或用户美术批准”。

plan `library-6bc244f6-44b9-49b6-8439-a375680b0603`，digest `25a057f8dc68e8e2861918a4346fa34115f6a26a65e96cbb49a2cd40f2bf9ec7`。plan call `call-af8fec42-2eaf-4a65-a4e8-9d01945de35b`，install call `call-a80f7f33-dc57-4dd8-87f5-a5d813b1fdde`。85帧×色/光=170帧通道逐像素比较，differentPixels=0，61个已有依赖复用，仅新增入口与自己的模块。

安装后 `assets inspect evaluation/copper-fault` 成功，63项静态依赖；公共render成功 `0fd1e7252374-7333ee0c` / `call-afd7bbdd-4db7-43d8-8435-a0e842875d4b`，无诊断。其probe `call-9e35017b-b846-4ad9-be22-dbc6a4a4915e`也实际原图查看：.7s裂片/.1.3s烟电接力/2.1333s冷缝/2.8s空白（images/installed-native.png）。

生成注册文件只有 `.cache/athanor/library.js`、`catalog.md`、`catalog.json`，均被ignore。README SHA前后相同 `91db92f54d36c720cf352c3a8e90d335112c2b56f10b6c7e36972909ada01c3b`。tracked diff只有新类别的 `src/fx/categories.js`，没有改写README或源注册索引；新艺术入口只在该隔离快照内。详见plan文件列表、build-identity、git状态与ignored-boundary.txt。

## 原始错误、诊断和阻碍

1. **尚未修复的流程阻碍**：安装后公开 `node tools/assets.mjs check` 输出 `{"error":"EISDIR: illegal operation on a directory, read"}`。原调用结果 calls/assets-check.json；相同命令独立重复仍报同错，exit=1，见 assets-check-repeated.json/.exit。该错误没有提供文件路径或恢复建议，不能由黑盒调用者定位。已立即报告研发方，等待修复再定向补测；本报告不判定底层根因。不能报告完整资产检查通过。
2. **调用者错误，恢复成功**：history bundle的viewed同时包含安装后另一个ID的图像，被 `CONTRACT_MISMATCH` 拒绝：`Viewed image is outside this artwork history`，指出准确callRef/ID。原失败 `call-ccaf921c-7919-44cf-a29a-dc13cdcb473b`，calls/bundle-error.json。移除跨ID viewed声明后成功，bundle `bundle-78f8730f-0d99-4748-b6e0-642e9e2a3315` / call `call-e43471a0-dc62-4de5-b0db-5bb7333fcb90`，21调用、5版本、49文件，missing=[]。安装后原图观察单独记在本报告。
3. 多词search第一次为0条，明确提示每词AND并建议拆开查询，之后可继续；这不是工具异常。

## 创作者评估：三个方面

**创意自由与具体帮助**：普通JS能自由决定闭合石壳、斜束、非圆裂片、任意移动节点和短冷辉，不需接受整件预设或固定DSL。DRIFT提供连续流动且受光的烟，而非仅一张可看的参考图；local提供可组合变换；rock和arc提供成熟材质。两轮局改分别改变几何和材料/时序，可通过冻结比较看出具体差异。

**契约发现、诊断与可避免手写基础设施**：assets list/inspect将新studies/武器入口、完整闭包和归属展示出来，plan/install替我做了依赖复用、import重定位与逐像素核对；history/compare/export供应版本身份，我不需自建渲染/冻结/图集管线。原生分页对AI直接看图有用。负担是inspect laser的reuse+source返回约89k tokens静态闭包，包含未实际调用的许多模块；我必须自行筛选local等函数，不能把可达等同活跃使用。带摘要的私有模块路径可用但不如语义化可发现helper友好。本次不需要手写变换代理，复用了真实local；创作本身的几何和时间包络属于艺术选择。为审计复制文件/写报告属于本次评估工程，bundle大部分可代办；跨ID viewed限制清晰可恢复。assets check的无路径EISDIR则是当前最需要修复的诊断阻碍。

**机制复用具体完成的难点**：在小画布、短单次窗口内，将成熟连续密度烟缩放/倾斜并独立加速退场，同时让会移动的碎片端点参与有父链到达关系的电弧；取得同一run的实际head/hit/expired状态，而非靠画面猜时序。没有写烟流求解器、电弧分叉栅格器、冻结重放或依赖搬运器。这里只证明上述组合确实完成；没有对照实验，不能推断净省时、美术优越或能力跃迁。

## 未测范围与证据位置

未测目标游戏引擎导入、性能/内存认证、媒体编码、原始PNG纹理搬运（本作无PNG依赖）、安装中断recover/漂移冲突、任意options、全时间穷举边界、其他画布/背景或用户最终美术接受。没有宣称完整角色行为或独立大裂片对象诊断。

完整原始证据位于本报告同目录：calls/原始返回与错误，artwork/v1-v3.js各稿，images/实际看过的原图，raw-runs/冻结run与验证/导出/bundle，raw-library/计划事务，observations.md、replay-hashes.json、build-identity.json。初始EISDIR必须保留，修复只能附加retest记录。
