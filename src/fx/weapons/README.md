# 俯视武器分件

2026-11-08 用户验收通过的九类、49 个分件：冷气、喷水、酸液、加特林、霰弹、穿甲弹、贯穿激光、特斯拉电球、闪电链。完整 ID 见总目录的 weapons 分类。

```js
import {createFx} from '../../core/index.js';
import * as impact from './cold-hit.js';
const fx=createFx(impact,{x:200,y:120});
```

每件独立透明，以局部 +X 为发射方向，绕 meta.origin 转向。连续武器按 intro → loop → outro 组合，任意相位停火给 outro 传 stopPhase；普通弹体图集定位点的地图移动交给游戏。穿甲入口与出口独立，霰弹含12枚不等距弹道；贯穿激光预烘焙图集的目标布局固定，动态布局可用普通源码和公开 ray 修改。

冷气命中是目标贴图的寒霜表面层。默认匹配示例车体；用 targetTexture:{id,w,h,pivot,data} 的 RGBA 字节和 targetBody 替换目标，impact 指定入口位置。只用图集的项目应按自己的目标轮廓重烘焙。

入口是可编辑普通 JS，provenance 锁定验收 run/验证/选版。共享作品源码按依赖内容存于 _modules/，现有一致库依赖直接复用，署名保留。通过公开 inspect 的 source/provenance 可读实际作品及原库 helper，SDK/runtime 源码不混入该返回。复制源码到其他项目时应保留相对依赖闭包，包括 src/core、src/authoring 和原库辅助模块；使用整包或工作台导出的便携包最直接。

用户批准后再改稿入库，使用公开 fx_library plan/install/status/recover；文档见 ../../../docs/ai-vfx-tools/library-installation.md。地图、武器底座和整套审批演示不属于这些正式分件。
