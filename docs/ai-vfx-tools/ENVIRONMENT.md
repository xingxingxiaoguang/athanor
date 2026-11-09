# 运行环境

Node 18+，`npm ci` 安装开发依赖。`npm run demo` 是唯一通用演示台，默认 `http://127.0.0.1:4173/`；`lab` 和 `gallery` 是兼容命令。

本机默认 Node 22 曾缺少动态库，可在本次会话使用：

```sh
export PATH=/opt/homebrew/Cellar/node@24/24.22.1/bin:$PATH
npm run demo
```

图集不需要媒体编码器；MP4/GIF 需要 PATH 中的 ffmpeg/ffprobe。本机已有编码器移到仓库外 `/Users/xxxg/.cache/athanor/encoder-tools/`；干净克隆不依赖该位置。按 inspect run 返回的 delivery 能力配置自己的编码器。冻结重放要求与记录的 Node/platform/arch 一致。

不要广泛结束其他任务的服务。参数、缺源、验证或入库冲突按公开错误的 recovery 恢复；新克隆从源码生成新 run，不重用本机旧验证。
