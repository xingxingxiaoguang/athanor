# 本地素材闭包提炼（0.10候选）

第一基石实际保留`src/authoring/texture.js:rgba/sheet/sequence/frame/draw`与`src/core/painter.js`的最近像素、pivot、straight coverage和独立light。新增texture.mask/sample仅适配现行mask/surface，避免作者重复alpha扫描/Color32打包。PNG宿主沿用`tools/lib/png.mjs:decodePNG`的CRC与五类滤波，有限扩展RGB/tRNS、灰度/索引低位深、gray-alpha；writer及旧RGBA8读取形状不变。格式依据W3C PNG Third Edition（https://www.w3.org/TR/png-3/），没有ICC/gamma转换、Adam7或16位支持。

冻结沿用`experiments/vfx-lab/replay.mjs`的源闭包/renderer隔离和`lab.mjs`的run/revision/validate/export路径。新增`assets.mjs`只处理显式本地资源声明，原字节另存assets.json；逻辑digest不含机器路径，sourceDigest仍只表示JS。旧run没有assets时身份算法不变；新run禁止用当前源图补失落冻结字节。导出原图及逻辑清单，可再消费其来源身份。

第二基石对照首页生产包index-Dc9n0jGG.js（SHA256 7433af92a9dc349801b6bf3d0e38fb52bc9b45aec7113e4f8e307cd94129eeba）的imageResources、pivot、sequence与blend分离。只吸收显式资源/选帧/轴心/混合的机制分解，不复建人类资源面板或抄取其美术。参考与出生/寿命曲线保持独立；无需另造粒子资源权重API。

公开lab/asset-relay的两幅PNG为本项目新增原创像素小样，未拷贝外站。测试fixtures由Pillow独立生成实际编码字节，测试运行不依赖Pillow。技术有限边界和独立创作结论分开记录。
