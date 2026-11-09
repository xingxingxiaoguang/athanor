# Athanor

可编辑、可组合的像素特效资产库。特效源码是唯一母版，演示台、图集、视频和交付包都从源码按需生成。

```sh
npm ci
npm run demo                 # http://127.0.0.1:4173/，唯一通用演示台
npm run assets -- list smoke  # JSON 检索，不需要启动服务
npm run assets -- inspect weapons/acid-flight
```

资产按 `src/fx/<category>/<name>.js` 组织。已有 ID 保持稳定；最新原创作品在 `studies/` 分类，保留独立的美术验收状态。演示台自动加载整库，可搜索、播放、换色并生成透明图集。[资产规范](docs/ASSETS.md)说明目录、依赖、署名和入库流程。

```js
import {createFrame, clearFrame, createFx, composite} from 'athanor';
import * as effect from 'athanor/fx/ice/frost-nova';

const frame = createFrame(320, 180);
const fx = createFx(effect, {x:160, y:140, seed:7});
// 每一帧：
fx.update(dt);
clearFrame(frame);
fx.draw(frame);
composite(frame, imageData.data, null);
```

游戏可直接使用源码；任意引擎可生成透明 PNG + Aseprite JSON：

```sh
node tools/render.mjs ice/frost-nova --sheet
```

输出写入 ignored `records/`。AI 创作、冻结版本、原尺寸观察和同版导出从[公开创作者指南](experiments/vfx-lab/README.md)开始。带加法光层或本地 PNG 资源的作品使用该工作流交付，游戏消费端见 `athanor/playback`。

```sh
npm run assets:check          # 元数据、完整依赖、来源摘要、仓库产物门禁
npm run repo:check            # 提交内容、清理基线和完整待推送历史
npm run lab:test              # 创作/入库/回放测试
npm run build                # 生成 dist/demo，供静态部署
npm run assets:clean          # 预览可清理的生成物
npm run assets:clean -- --apply
```

`.cache/`、`records/`、`dist/`、`sheets/`、`output/`、草稿及交付包不入 Git。`npm ci` 自动安装提交前和推送前钩子；CI 独立复检。改名伪装、先提交后删除以及旧历史回灌也会检查，详见[仓库护栏](docs/REPOSITORY-GUARDS.md)。克隆后可从源码重新生成所有预览，不携带历史运行记录。[研发入口](docs/ai-vfx-tools/README.md)。

上游来自 [pixelfx / Patch](https://github.com/patch-gg/pixelfx)；部分成熟算法改编自 Sprite Fusion / Hugo Duprez，动作机制参考 Hollow Crown。保留每个源码中的署名、[LICENSE](LICENSE) 和 [NOTICE](NOTICE.md)。演示字体另见 [字体声明](demo/fonts/NOTICE.md)。
