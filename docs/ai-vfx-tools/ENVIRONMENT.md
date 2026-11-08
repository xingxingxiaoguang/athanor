# 运行与本机环境

按问题查阅；默认端口不代表服务此刻运行。通用入口在[创作者指南](../../experiments/vfx-lab/README.md)，研发接手在 [HANDOFF](HANDOFF.md)。

## 常用命令

在仓库根目录，使用 Node 18+ 并先 npm install 安装工具依赖：

```sh
node experiments/vfx-lab/cli.mjs tools
npm run lab                 # 默认 127.0.0.1:4173
npm run gallery             # 默认 :8080/gallery/
npm run lab:test            # 改动需要时运行，串行测试文件
```

俯视武器审批/收录预览为独立静态入口：

```sh
node experiments/vfx-lab/productions/2026-11-07-arsenal/serve-preview.mjs 4197
```

重启前检查端口与对应进程，不广泛结束其他任务的服务。需要持续预览时用终端或宿主支持的持久进程方式启动；不把工具调用返回当成服务持续存活的证明。

## 本机已知差异（2026-11-08）

默认 Node 22 曾因动态库缺失无法启动。此机器已验证可用：

```sh
/opt/homebrew/Cellar/node@24/24.22.1/bin/node experiments/vfx-lab/cli.mjs tools
```

需要 npm 或多个子进程时，将该 Node 目录前置 PATH。冻结重放要求与原 run 记录的 Node/platform/arch 一致；不能换解释器后仍声称相同后端。

MP4/GIF 另需 PATH 中的 ffmpeg 与 ffprobe，图集导出不需要。本机已有 4.4 编码器位于 ignored `records/vfx-lab/encoder-tools/node_modules/@ffmpeg-installer/darwin-arm64` 与 `@ffprobe-installer/darwin-arm64`。它们是本机调试路径，不是可移植安装承诺；用 inspect run 的 delivery 查实际可用性。新版 ffprobe 兼容测试仅在配置 ATHANOR_TEST_FFPROBE_MODERN 后运行。

## 故障应按实际返回恢复

| 情况 | 下一步 |
| --- | --- |
| 参数或未知字段 | 依 recovery 查询单个工具 Schema |
| 冻结运行缺源/运行时不符 | inspect run；恢复其保存闭包/环境，不替换成当前草稿 |
| 媒体编码器不可用 | 配置编码器或先导出图集，保留原错误 |
| 入库计划冲突/事务中断 | 按 [library](library-installation.md) 的 status/recover 检查，不覆盖外部改稿 |

资源限额、时钟、空间和支持格式查实际工具/算子契约；本页不复制一份易过时的容量表。
