# 资产目录入口

目录由可执行源码生成，避免与实际资产不同步：

```sh
npm run assets -- list
npm run assets -- list fire
npm run assets -- inspect studies/drift
npm run assets:build
```

生成结果在 ignored `.cache/athanor/catalog.json` 和 `.cache/athanor/catalog.md`。打开 `npm run demo` 可浏览整库。目录组织、来源和入库约定见 [ASSETS](ASSETS.md)。
