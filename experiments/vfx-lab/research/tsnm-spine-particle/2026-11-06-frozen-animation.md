# 冻结动画交付：两大基石与真实反馈

日期：2026-11-06。该闭环来自两份生产日志中重复出现的交付工程，不新增粒子求解器。

## 已有项目实现

| 路径/符号 | 成熟行为 | 本轮保留与适配 |
| --- | --- | --- |
| `tools/lib/fxlib.mjs:writeVideo` | 原render/act工具的raw RGBA→ffmpeg、H264 CRF14、GIF palettegen/paletteuse、偶数填边 | 直接调用；旧参数仍返回boolean，旧命令默认行为保持。新增显式选项让编码器做nearest缩放，避免在Node内保留k²倍原始输入；记录实际命令，超时可恢复，GIF播放次数遵循run声明 |
| `tools/lib/fxlib.mjs:upscale/canvas` | 整数最近邻、RGBA在指定观察底合成 | PNG不缩放；媒体采用等价nearest过滤器。直接调用canvas在黑底合成，避免把丢弃alpha误称黑底合成；原RGBA与编码输入分别hash |
| `tools/lib/png.mjs:decodePNG` | RGBA8、CRC与五种过滤器解码、预算限制 | 直接读取冻结PNG并按manifest.frames.rect复制原RGBA行，不通过paste生成精确资产 |
| `experiments/vfx-lab/lab.mjs:exportRun/readRun` | 明确run、同run验证、原color/light/combined复制与atlas循环末帧规则 | 保持旧调用。媒体默认保留全部帧，显式omit-loop只影响媒体，分别记录来源与播放时间；当前源码不参与导出 |
| 气功波/地爆天星原生产日志及media-provenance | 241/271帧全部解包，30fps分别8.033/9.033秒；自己写编码/日志脚本 | 提炼为公共export，原日志与历史媒体不改写。手工解包器raw未随Git归档到本工作区，未冒称直接读过不存在的脚本 |

没有复制完整效果。原库及作品的Sprite Fusion/Hugo Duprez/MIT署名保持；本轮新代码是交付适配。

## 参考平台实际构建对照

重新获取公开首页指向的生产JS：`https://tsnm-spine-particle.com/assets/index-Drqq4zQI.js`，SHA256 `5969ff4d8b883c13dc477223ae8e690a4c8a88e825bb9615bc9efd05f74296af`，1,340,528字节。原包在ignored `records/vfx-lab/frozen-animation-research/bundle.js`。仅检查局部源码，没有执行整包；不沿用旧研究中另一构建的压缩符号或偏移。

当次`dv`序列包分支（字符偏移425,489附近）按输入帧顺序调用`cv`的PNG toBlob，区分intro/loop/outro，附fps、尺寸、通道及可选Spine JSON。可吸收点是固定序列及通道/时钟/阶段说明和交付清单；本轮使用本项目保存帧和稳定run身份，不复制其编辑器、重新求值路径或Spine包装。不把检查过的PNG ZIP分支声称为已验证其全部媒体导出功能。

本项目已保存的发射、运动、寿命与光结果在导出时不重新计算，输出fps不改变出生/物理时钟。视频编码复用本库，而非臆造参考平台并未确认的能力。

## 编码器语义依据与边界

核对FFmpeg官方[GIF muxer定义](https://github.com/FFmpeg/FFmpeg/blob/master/doc/muxers.texi)中的百分之一秒延迟、loop/final_delay，与[GIF encoder定义](https://github.com/FFmpeg/FFmpeg/blob/master/doc/encoders.texi)中的offsetting/transdiff。实际验证使用本机安装到ignored records的FFmpeg4.4和ffprobe n4.4.1，版本进入每份交付清单。

GIF读取检查显式min_delay=0，以免demuxer的短延迟夹值被误当文件真实时间；客户端仍可能另行夹值。实际检查尺寸/帧数/逐帧时间与全文件解码，独立创作者另记录真正看过的原尺寸图像或播放。引擎导入、净节时、艺术优越不在这些技术检查结论内。
