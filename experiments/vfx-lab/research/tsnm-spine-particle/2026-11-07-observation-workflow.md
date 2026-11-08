# 原尺寸时序观察与公共记录：实现提炼

2026-11-07（Asia/Shanghai）。本轮以真实作者负担为输入：气功波的4424px横表被缩图，作者自己重排3×4；浮空灯塔为12张相邻帧做四次三帧probe并手管run/验证/导出引用；气功波默认probe选中已死亡的最早出生项。原日志不改写。

## 原有代码的具体提炼

| 来源 | 成熟行为 | 本轮采用与边界 |
| --- | --- | --- |
| `tools/act.mjs`连续时序条带 | from/to/step筛选有序帧、标签、逐格而非均匀稀疏关键帧 | 变成保存帧的事件/绝对窗口；取跨版本保存时刻并集与边界，保留真实/模拟时钟，不另写作品求值器 |
| `tools/lib/fxlib.mjs:contactSheet/canvas` | 标签、行列、边距与原RGBA合成 | 直接调用canvas；提炼布局到有界原尺寸分页，固定1倍，不采用pickFrames的默认稀疏抽样；跳项必须显式every并列明省略位置 |
| `lab.mjs:compare`、`png.decodePNG` | 保存通道、manifest矩形、共同锚点、请求/实际时间、重复与条件差异 | 新savedView路径复用语义与PNG解码、逐行复制，不读当前草稿。旧离散查询横表保持；新window或layout启用分页。light仍黑底、exposure1 |
| `app.js:show/draw/pause` | 保存atlas选帧、原尺寸canvas、暂停/时间轴、最近保存帧 | 拆成独立局部观察页，数据与PNG分页相同；前后逐帧、局部循环/速度，显示请求/保存/模拟时间。只是播放保存帧，不改变120Hz求解或主库 |
| `core/particles.stream/cycle`及新particle/observation | 按出生/寿命决定alive，稳定出生表和实际状态 | probe直接按已保存或明确冻结重算的状态选活跃者，最新样本优先，再选其他样本；显式ID和birth-order保留。未声明对象不反推身份 |
| `lab.search`的坏模块隔离、既有history/validate/export引用 | 保留其他可用资源、冻结版本与分析身份、明确run交付 | 公共journal对损坏记录列表隔离并报告，单条读取拒绝；记录成功/失败/中断，显式selection与证据引用；不推断最新即最终 |

新入口为saved-view.mjs、saved-player.js和journal.mjs；SDK命名空间保持15，公开工具仍9个。上游MIT/Sprite Fusion/Hugo Duprez来源不改写，本轮无第三方代码移植。

## 参考平台当次核对

重新获取首页指向`https://tsnm-spine-particle.com/assets/index-Drqq4zQI.js`，SHA256 `5969ff4d8b883c13dc477223ae8e690a4c8a88e825bb9615bc9efd05f74296af`，1,340,528字节；与前轮固定构建相同。只检查局部源码，没有执行整包，raw在ignored `records/vfx-lab/observation-workflow-research/`。

本次检查的循环/单帧说明位于字符偏移约678146，currentFrame/isPlaying及cycleDuration×fps的段落约901110，正倒播放与帧边界操作约1194456。这些是此固定构建的定位，不是未来稳定API。可吸收点是暂停、逐帧、循环范围与状态显式；不复制人类面板和独立实时重算路径，也不宣称已比对其全部预览/烘焙时钟。

本项目保持发射/生命周期/运动结果与观察采样分离：本地播放器使用同一冻结帧表，输出/观察节奏不会重新产生出生、接触或历史。观察页的循环是观察窗口循环，和作品的loop/结束声明分别记录。

## 技术与创作证据边界

维护者将灯塔原12帧从四次公开probe迁入一次窗口，原尺寸288×192、896×982单页，逐帧零像素变化；它只证明这一观察组织替代，不是净省时或艺术提升对照。浏览器实际检查了逐帧、native canvas大小、播放状态推进及关闭循环后终止；没有把静态截图说成完整连续视觉审片。

新独立作者将以另一原创题材检验公开发现、复杂创作与两类局改、窗口比较、活跃对象查找、公共记录/选版和同run交付。原始发现和修复补测分别保存；具体完成状态见实施状态与本轮测评。
