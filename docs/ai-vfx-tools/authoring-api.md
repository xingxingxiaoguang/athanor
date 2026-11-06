# 已实现的像素特效创作 API

这是已实现的公开 SDK 契约，供 `fx_search → fx_inspect` 按需查询。Painter/颜色来自原 core，时钟来自实验适配器；首批路径、随机、曲线、排期、运动及场/mask/消融链从 `src/authoring/index.js` 导入（草稿路径 `../../../src/authoring/index.js`，安装包 `athanor/authoring`）。这里只描述真正可调用的子集，完整能力全景仍见产品计划。参考组合可 inspect `lab/ember-weave`，也可直接从空白编写自己的结构与材质。

## core/color

### overview

Painter 的颜色参数是 **Color32 整数**，不是 CSS 字符串，也不是普通 `0xRRGGBB`。低到高字节为 R、G、B、A；JavaScript 有符号与无符号的 32 位表示均可。`0` 表示空像素，不能用它擦除。选项中的色带可用 hex 字符串，进入 Painter 前必须转换。

### contract

| 函数 | 输入、默认值与返回 |
| --- | --- |
| `rgb(r,g,b) → Color32` | 整数通道 0..255，返回不透明色；底层按字节取值，不执行类型诊断 |
| `hex(value) → Color32` | `#rgb`、`#rrggbb` 或已转换的整数；不支持 CSS 名称和含 alpha 的 hex。整数原样返回 |
| `ramp(colors) → Color32[]` | 非空的上述颜色列表，逐个转换；不插值 |
| `fit(colors,n) → Color32[]` | 非空列表，正整数 n；转换并用最近索引重采样为 n 阶，保留两端；不是渐变插值 |
| `at(ramp,t) → Color32` | 已转换的非空色带，t 按 0..1 选离散色阶并夹住索引 |
| `blend(ramp,t) → Color32` | 至少两阶已转换色带，t 夹到 0..1，阶间线性混色 |
| `mix(a,b,t) → Color32` | 两个 Color32，t 夹到 0..1，逐通道插值 |
| `scale(c,k) → Color32` | Color32、非负亮度倍率；RGB 上限 255，返回不透明色 |
| `red(c), green(c), blue(c) → number` | Color32 → 整数通道 0..255 |
| `toHex(c) → string` | Color32 → `#rrggbb`，忽略 alpha |
| `luma(c) → number` | Color32 → 加权亮度 0..1 |

旧高速 API 假定输入有效，错误颜色可能导致空画面，不保证抛异常。新算子后续应在其边界诊断；本阶段不改变主库的底层行为。

### example

```js
import { hex, fit } from '../../../src/core/index.js';
const C = fit(['#241015', '#b43d20', '#ffc477', '#fff1c9'], 8);
// draw(p,t,o) 内：
p.circle(0, -10, 4, C[5]);
p.line(-5, -10, 5, -10, hex('#ffffff'));
p.glow(0, -10, 8, C[6], 0.15);
```

### pitfalls

`p.circle(0,0,4,'#fff')` 不符合契约。用 `hex('#fff')` 或 `fit(o.palette,8)[7]`。`fit` 同时负责转换和固定阶数；不能只把它理解为调整数组长度。`combined.png` 的透明光是近似值，正式组合用颜色透明层和加法光层。

## core/painter

### overview

`draw(p,t,o)` 收到已经放置到作品原点的 Painter。默认使用作品本地艺术像素，+x 向右、+y 向下；角度为弧度。颜色参数统一为 Color32，除 `sprite` 的字符色表允许 hex。普通形状的 alpha 用屏幕坐标锁定的 4×4 Bayer 覆盖；`blend/disc` 保留软 alpha。颜色、附加光分别写入两缓冲。

### contract

| 方法 | 签名和语义 |
| --- | --- |
| 像素 | `px(x,y,c)` 不透明；`dot(x,y,c,a=1)` 抖动覆盖；`blend(x,y,c,a)` 软透明；`get(x,y) → Color32` 空/越界返回 0 |
| 线 | `line(x0,y0,x1,y1,c,a=1)` 含两端的 1px 线；`polyline(points,c,a=1)` 连接点对；c/a 可为 `(u)=>value`，u 从 0 到 1 |
| 厚线 | `beam(x0,y0,x1,y1,width,c,a=1)` 圆头，width 是全宽；c/a 可为 `(u,v)=>value`，v 从中心 0 到边缘 1 |
| 圆/椭圆 | `circle(cx,cy,r,c,a=1)`、`ellipse(cx,cy,rx,ry,c,a=1)` 填充；c/a 可为 `(d,angle)=>value`，d 为归一化半径、angle 为弧度 |
| 软透明圆 | `disc(cx,cy,r,c,a)` 填充软 alpha 圆；c/a 可为 `(d,angle)=>value`，参数意义同 circle；alpha 必填 |
| 环 | `ring(cx,cy,r,w,c,a=1)` 外半径 r、向内宽 w；c/a 可为 `(v,angle)=>value`，v 从内到外 |
| 弧带 | `arc(cx,cy,r,w,a0,a1,c,a=1)` a1>a0、跨度至多一圈；w 可为 `(u)=>width`，c/a 可为 `(u,v)=>value`；不是带旋转椭圆或通用路径 |
| 面 | `rect(x,y,w,h,c,a=1)`；`poly(points,c,a=1)` 偶奇填充，c/a 可为本地 `(x,y)=>value`；`tri(x0,y0,x1,y1,x2,y2,c,a=1)` |
| 光 | `light(x,y,c,k=1)` 单像素；`glow(x,y,r,c,k=0.5)` 径向；`glowLine(x0,y0,x1,y1,r,c,k=0.5)` 线周半径 r；`glowRing(x,y,R,r,c,k=0.5)` 半径 R 周围宽度 r。k 是强度，不是 alpha；叠加后通道饱和 |
| 像素着色 | `shade(x0,y0,x1,y1,fn)` fn(lx,ly,out) 返回 Color32 或写 `out.c/out.a/out.l/out.k`；不返回内容保留原像素；out 是复用对象，不可留作状态 |
| 扫描 | `each(x0,y0,x1,y1,fn)` 遍历变换后包围框的屏幕像素中心，fn(lx,ly,sx,sy)；自定义形状仍需自己测试是否在区域内 |
| mask | `mask({w,h,data},x,y,c,a=1)` 非零为覆盖，不把 data 视为 alpha；`outline(mask,x,y,c,a=1)` 4 邻域外侧 1px 边；c/a 可为 mask 坐标 `(mx,my)=>value` |
| 精灵 | `sprite(rows,pal,x,y,opts={})` 字符串行、字符→Color32/hex 映射；`.`/空格透明；opts 为 `scale=1,a=1,flip=false,flipY=false,tint`，tint 必须 Color32 |
| 文字 | `text(str,x,y,c,opts={})` opts 为 `font='mini',scale=1,align='left',outline,shadow,a=1`；另一字体 big。outline/shadow 为 Color32；`measure(str,opts={}) → [w,h]` |
| 变换 | `place(x,y,flip=false,angle=0)` 重设位置/镜像/旋转；`toX/toY(x,y)` 本地到场景，`fromX/fromY(sx,sy)` 逆变换；`cellX/cellY(x,y)` 映射整个像素格 |
| 原始写入 | `put(sx,sy,c,a=1)` 抖动；`blendPx(sx,sy,c,a)` 软透明；`add(sx,sy,c,k=1)` 光；这些使用整数场景坐标，不再做本地变换 |

坐标、半径、宽度为艺术像素。a 的有效范围 0..1；k 为非负强度。`fade=1` 同时调制颜色与光；`lightK=1` 只调制光。正常作品无需调用 `reset()`；运行器每次绘制会重置 Painter。写入越界时裁切，不自动扩展画布。方法一般返回 undefined，`reset/place` 返回 Painter；不能默认链式调用形状。

### example

```js
// C 已通过 fit/hex 转换。透明体积与硬边可以并用。
p.disc(0, -12, 6, C[2], 0.25);
p.arc(0, -12, 10, u => 3 * Math.sin(Math.PI*u), -1.2, 1.2, C[5]);
p.glowLine(-4, -12, 4, -12, 6, C[6], 0.12);
```

### pitfalls

`p.light(x,y,c,k)` 是单像素光；圆形光用 `glow`。形状采样像素中心，单点落在包含该点的像素格。`each` 的回调并不自动排除包围框以外的旋转局部区域。alpha 不改变抖动网格的坐标锁定方式。所有方法都不创建可查询的粒子身份或命名层。

## core/clock

### overview

实验工具台使用 120 Hz 固定 tick，主库 `createFx` 保持原有最大 1/120 秒子步行为。输出 fps 只控制观察时刻。当前工具台时钟只支持非负特效时间；完整 act 的负时间蓄力、命中停顿和播放时间尚未接入。

### contract

`clockedFx(module,options={}) → {options,t,update(dt),draw(frame,layer?)}`，从 `experiments/vfx-lab/clock.js` 导入。dt 必须是有限、非负秒，非法值抛异常。

解析型模块直接求值到请求时间（归一化浮点累加误差）。带 create 的模块从头按 120 Hz 推进，输出不足一个 tick 时保持上一个完整 tick。manifest 的 `frames[].t` 为请求时间，`simulationTime` 为实际求值时间；二者不能互换。循环 draw 时间取 `t % duration`，单次取 `min(t,duration)`。

`draw(frame,'back')` 只绘后层、`'front'` 只绘前层、省略为两层。draw 不得改变模拟状态。输出帧率当前为 12/24/30/60；验证另检查 30/60/240 更新率和两个种子。循环相位相同不能证明速度连续。

### example

```js
import { clockedFx } from '../clock.js'; // 例如 drafts/ 下的测试脚本
const instance = clockedFx(module, {seed:7});
instance.update(1/240); // 模拟模块仍在 0 秒
instance.update(1/240); // 模拟模块到 1/120 秒
```

### pitfalls

绘制中的 t 是本地特效时间，事件也使用该时间。站立角色仅作尺度参照，不是完整动作场景。跳转通过从头重放完成；目前没有模拟状态序列化或检查点。

## core/effect

### overview

普通 JavaScript 模块通过 `meta + draw` 或 `meta + create` 接入。内部层、轨迹和中间字段不会从源码中自动推断；整体与颜色/光可直接观察，已声明粒子还可选用observe协议。正式的结束约定可通过 `authoring.ending` 声明。

### contract

`meta` 必须包含 `size:[w,h]`（整数 8..480）、`origin:[x,y]`（有限艺术像素）、`duration`（0<秒<=12）；可声明 `name,desc,tags,loop=false,fps=30,bg='dark',actor,options={}`。

解析入口：`draw(p,t,o)` 必须存在；`drawBack(p,t,o)` 可选。模拟入口：`create(o) → {update(dt,o),draw(p,t,o),drawBack?(p,t,o)}`；create 在每次重放时重新创建状态。draw 无副作用；可读取闭包中的模拟状态。随机性使用种子，不能用 Math.random/Date 作为创作时钟。

`events={name:seconds}` 可选，事件必须在 `[0,duration]`。`authoring={ending:'clear'|'residue'|'persistent'|'handoff'|'loop'}` 可选，未声明时按 `meta.loop` 选择 loop/clear。residue/persistent/handoff 只免除空结束要求，不自动认证残留是否稳定或下游是否收到交接。

`observe(t,resolvedOptions)`可选纯函数，返回`{particles:[particle.observe(emitter,t),...]}`。render按与draw一致的实际本地时间保存稳定出生表与状态；fx_probe可读保存证据或明确重放冻结源码。只写层名不产生观测，旧作品无需改写；完整协议和限制见core/particle。

`o` 为实际默认选项与调用参数合并；`palette` 等色带选项若长度与默认色带不同，运行器用最近索引重采样并保留 hex 表示；进入 Painter 时仍用 fit/hex。seed、light 没有统一艺术范围，light 的运行时默认是 1。x/y/actor 由工具台提供，不能从工具 options 覆盖。flip 为左右镜像，angle 为弧度。自定义选项的类型与范围未声明时，inspect 如实返回未知约束。

### example

```js
import { fit } from '../../../src/core/index.js';
export const meta = {name:'Pulse',desc:'Short directional pulse',tags:['pulse'],
  size:[64,64],origin:[32,48],duration:0.4,loop:false,
  options:{seed:1,palette:['#441620','#e86830','#fff3c0'],light:1}};
export const events = {release:0.1};
export const authoring = {ending:'clear'};
export function draw(p,t,o) {
  if(t<events.release || t>=meta.duration) return;
  const C=fit(o.palette,3), u=(t-events.release)/(meta.duration-events.release);
  p.beam(0,-12,12*u,-12,4*(1-u),C[1]);
  p.glow(12*u,-12,5,C[2],0.12*(1-u));
}
```

### pitfalls

导入路径相对作品文件。纯 JavaScript 相对导入依赖随 run 冻结；动态 import、第三方包、读文件资产与进程环境目前不能完整重放，工具明确报告 REPLAY_UNAVAILABLE。代码仍以 Node 权限执行，仅运行可信作品。技术通过不是美感通过。

## core/path

### overview

从 `src/authoring/index.js` 导入 `{path}`（安装包为 `athanor/authoring`；draft 相对路径 `../../../src/authoring/index.js`）。同一 Path 可供出生、沿线运动与连续条带共用。单位为艺术像素，s 始终是归一化**弧长**，不是贝塞尔参数。所有新算子失败带 code/path/recovery，不会静默改设计。

### contract

- `path.polyline({id,points,closed=false,space='effect'}) → Path`。points 为至少两个有限 `[x,y]`；相邻重复点被移除，全退化报错。返回 kind/id/space/points/segments/lengthPx/closed。路径空间只是契约，当前 Painter 用 effect 本地空间；其他空间须作者显式变换。
- `path.bezier({id,points,tolerancePx=.25,maxDepth=12,space='effect'}) → Path`。四个三次控制点，自适应细分同时检查横向误差及控制多边形长度差；达到 maxDepth 仍未满足容差报 BUDGET_EXCEEDED，不冒充精确弧长。
- `path.sample(path,s,{boundary}) → {position,tangent,normal,s,distancePx,space}`。open 默认 clamp、closed 默认 wrap；另有 error。切线在角点取出段，最终端点取入段；normal 为 `[-ty,tx]`，不是形状的“向外”。闭合 wrap 的 s=1 等于 s=0。
- `path.resample(path,{spacingPx=1,from=0,to=1}) → Sample[]`。包含精确两个端点，间距最多 spacingPx，最多10000段；`0<=from<=to<=1`，跨接缝须拆区间。
- `path.strip(painter,path,{from=0,to=1,width=2,color='#fff',alpha=1,spacingPx=1}) → {segments,bounds?}`。主体是连续带，不是串珠。width 为全宽艺术像素或 `(s)=>width`，在重采样节点求值并线性插值；color/alpha 可为 `(s,v)=>value`，v 是带左右符号的中心线距离/半宽（圆端帽处为径向距离），范围 -1..1。端帽为圆头；宽度可为0，负宽报错。新边界接受 #rgb/#rrggbb 或 Color32；alpha 0..1 为抖动覆盖，光可独立绘制。spacing 控制近似，不能保证未被采样的极窄宽度尖峰。

### example

```js
const route = path.bezier({id:'main',points:[[0,-20],[20,-40],[45,0],[70,-15]]});
const head = Math.min(1, Math.max(0, (t-.4)/.3));
const tail = Math.min(1, Math.max(0, (t-.5)/.5));
if(head>tail) path.strip(p,route,{from:tail,to:head,width:s=>2+7*Math.sin(Math.PI*s),color:'#ffba70'});
```

### pitfalls

条带 geometry 与材质回调开放；自行写独特轮廓不是失败。头尾控制仍是艺术选择，可用 curve 避免重复插值实现。当前不提供历史轨迹缓存、自动碰撞或内部层探测；闭合形状的法线不被当作自动向外。

## core/random

### overview

从 authoring SDK 导入 `{random}`。这是无状态具名采样，不是需要按顺序消耗的 RNG。新增颜色抽样不会使运动随机数移位。

### contract

`random.unit({seed=1,layer='effect',id,channel}) → number [0,1)`；seed 有限，layer/id/channel 为非空字符串或整数。完整身份元组决定结果。`random.range(key,min,max)` 映射到给定有限范围，也支持反向 min/max。作者可显式共享一次抽样来关联尺寸与寿命，或用不同 channel 隔离。层 ID 与粒子 ID 应稳定，不要依赖数组插入后的索引。

### example

```js
const key={seed:o.seed,layer:'ash',id:b.id,channel:'velocity'};
const vx=random.range(key,-12,28);
const colorJitter=random.unit({...key,channel:'color'}); // 不改变 vx
```

## core/curve

### overview

导入 `{curve}`，用明确输入域与输出单位的曲线替代每件作品的重复分段插值。任意自定义函数仍可作为艺术入口。

### contract

`curve.scalar({points,input='local.seconds',outputUnit='unitless',interpolation='linear',extrapolation='clamp',limits?}) → {kind,input,outputUnit,points,interpolation,extrapolation,limits,sample(x)}`。points 至少两个严格递增 `[x,value]`，不自动排序。input 支持 scene.seconds/local.seconds/particle.age01/path.s。interpolation 支持 linear/hold/smooth；smooth 是逐段 `u*u*(3-2*u)`，端点斜率0、不越过相邻节点，**不是任意贝塞尔**。hold 在节点处采用新值。extrapolation 为 clamp/extend/error；extend 用首尾段割线，即使原插值为 hold/smooth。limits 为 `[min,max]`，超出报错，不夹住艺术超调。input/outputUnit 是可查询声明，sample 的数值由作者放在正确时间域中。

`curve.color({points,input='particle.age01',interpolation='hold',extrapolation='clamp'}) → ColorCurve`。节点为 `[x,hex或Color32]`，严格递增。hold保留有限色阶；linear/smooth分别逐RGBA字节插值、取整，不做感知色彩空间转换。外推只支持clamp/error；sample返回Color32。可直接绑定particle.material.tint。来自库内热色优先冷却阶梯和混色色带的公共化。

ScalarCurve另有 `at(x,{side='right'}) → {value,derivative,side,discontinuity}` 与 `derivative(x,{side='error'}) → number`。导数单位为outputUnit/input单位；如pixels/local.seconds为px/s，radians/local.seconds为rad/s。side为left/right/error；at同时选择单侧值与导数，hold跳变处left取得旧值、right取得新值；sample仍保持原有右连续取值。discontinuity为null/corner/jump；error在左右值或导数不同时报CONTRACT_MISMATCH并给出选侧建议，不把跳变解释成有限穿越速度。clamp区间外导数0，extend使用首尾割线；extrapolation:error的端点只有区间内单侧可用，使用该侧，不凭空外推。smooth节点与夹边停顿导数0。

`curve.affine(value,{scale=1,offset=0,outputUnit=value.outputUnit或'unitless'}) → ScalarSignal`：数值或ScalarCurve/ScalarSignal的输出乘scale加offset，导数乘scale；不改变输入时钟。`curve.combine({operation='sum'|'product',values,outputUnit='unitless'}) → ScalarSignal`：非空数值/标量列表，使用和/乘积法则；零因子不通过除法求导。所有非数值输入必须使用同一input；不隐式换算秒与age01。ScalarSignal同样提供sample/at/derivative，可绑定材质、源坐标或角度。outputUnit是作者声明，乘积与仿射变换不自动推断物理量纲。

### example

```js
const size=curve.scalar({input:'particle.age01',outputUnit:'pixels',points:[[0,1],[.2,5],[1,0]],interpolation:'smooth'});
const width=size.sample(b.age01);
```

## core/domain

### overview

导入 `{domain}`。位置域与速度/方向独立；圆盘面积均匀用平方根半径，路径按弧长。增加 count 保留既有 index 对应的抽样。

### contract

`domain.circle({id,x=0,y=0,radius,space='effect'})`、`domain.rectangle({id,x=0,y=0,w,h,space='effect'})` 创建域。Mask 与 Path 可直接当域。`domain.point({id,position=[0,0],space='effect'})`为固定点；`domain.sector({id,radius,innerRadius=0,angle=0,spread=PI/2,space='effect'})`为以[0,0]为中心的扇环，按面积均匀抽样，内径小于外径、0<spread<=2PI；point/sector只支持area，出生方向独立。

`domain.sample({domain,measure='area',count,seed=1,channel='position',densityField?,ids?}) → {id,index,position,space,tangent?,normal?,pixelIndex?,s?,distancePx?}[]`。count 整数0..10000；支持 area/boundary。可选ids为与count等长的唯一身份数组，随机值据身份而非数组序号产生；重排时位置保持，index仍是本次数组位置。Path 只接受 boundary，返回左法线；圆/矩形边界有向外法线，面积样本无方向；Mask 样本为像素中心、允许重复，不伪造法线。Mask 的 boundary 是本域内4邻域边缘。

densityField 目前只支持 Mask，必须同空间、非负，按像素权重采样；其他域返回 CAPABILITY_UNSUPPORTED。没有正权重像素而 count>0 返回 EMPTY_DOMAIN。抽样不隐含速度；densityField 按 time=0 求出生权重，动态密度需显式构建本轮场。

### example

```js
const rim=domain.circle({id:'inward',x:0,y:-20,radius:20});
const samples=domain.sample({domain:rim,measure:'boundary',count:24,seed:o.seed});
// normal 是几何信息；向内、切向、固定方向由作者选择。
```

## core/schedule

### overview

导入 `{schedule}`。出生记录与运动/画法分离；可以从绝对时间任意查询年龄，不要求 draw 维护状态。

### contract

- `schedule.burst({id,at,count,spread=0}) → Birth[]`。出生 id=`id/index`，born 从 at 到 at+spread 均匀排期；count=1 只在 at。count 0..10000。改 count 时身份保持，但 spread 的排期会随数量重分布。
- `schedule.rate({id,start,end,rate}) → Birth[]`。每秒 rate，第一粒在 start，区间 `[start,end)`，不在 end 额外发射；最多10000条。
- `schedule.resident({id,start,end,count}) → Birth[]`。固定一批身份在start出生，记录life=end-start；位置抖动、呼吸或固定画法由后续运动/材质决定，不隐含随机重生。
- `schedule.cycle({id,period,count,seed=1,start=0,end,lifeMax}) → Birth[]`。提炼自core/particles.cycle、fire/_lib.looped：每个slot有稳定随机出生相位，展开所有可能在`[start,end)`存活的周期副本，包括负出生时刻和寿命大于period时的重叠。每条有唯一id、index、copy、born、randomId、lifeMax；randomId按slot相同，用于同一周期外观/属性重复，copy身份不同。必须明确生命周期上界；particle.emitter拒绝life>lifeMax，避免缺前置副本。展开后最多10000条；它是有限窗口排期，不是自动无限运行器。
- `schedule.alive(births,time,{life}) → {…birth,age,life,age01}[]`。life 为正秒或 `(birth)=>seconds`，存活条件 `0<=age<life`，不修改出生记录。出生记录可来自 image.dissolveEvents；额外 position 等字段会保留。

### example

```js
const births=schedule.rate({id:'sparks',start:.2,end:.8,rate:30});
for(const b of schedule.alive(births,t,{life:.6})) { /* b.id/age/age01，绘制你选择的形状 */ }
```

## core/motion

### overview

导入 `{motion}`。解析弹道/分轴阻力从core.fly与fire/_lib.drift提炼；力场保留加速度、速度、位置的明确顺序，并使用可重放固定时钟。静态水平面接触与二次出生见core/contact；力场碰撞尚未提供。

### contract

`motion.ballistic({position,velocity,acceleration=[0,0],drag=0,age}) → {position,velocity}`。位置艺术像素，速度px/s，加速度px/s²，drag为非负1/s或`[dragX,dragY]`，age 非负秒。解析求解线性阻力与恒加速度，含接近0阻力的数值稳定分支，不依赖更新频率。分轴阻力保留烟柱与火团的非均匀漂移。

`motion.along(path,{age,duration,from=0,to=1,easing=u=>u}) → PathSample`。age/duration 秒，duration>0，归一年龄夹到0..1，easing 必须返回0..1；from/to可反向但须落在路径范围。返回位置、切线/法线/弧长，不伪造未知导数的速度。

`motion.source({position=[0,0],rotation=0,parent?,space=parent.space或'effect',side='right'}) → SourceTrajectory`。position的x/y及rotation各为有限常量或秒域ScalarCurve/ScalarSignal，接受local.seconds或scene.seconds；本实验均映射effect秒，不能直接绑定age01/path.s。坐标为px、角度为**不折返的弧度**。`source.sample(time,{side=source.side}) → {position,velocity,rotation,angularVelocity,space,derivative}`；time可负（用于前置出生），位置/速度为px/px/s，角度/角速度为rad/rad/s。source与可见主体共用，不需要再手写导数。默认右时间侧，left取左时间侧，error拒绝不可微处；derivative保存method/side及各通道corner/jump提示。跳变不是连续运动，也没有有限的“跳跃速度”。

parent必须是同空间SourceTrajectory。子位置先旋转再平移；速度=`父速度+R*局部速度+父角速度*[-旋转后y,旋转后x]`，角度/角速度相加。父子统一使用请求的时间side，父derivative元数据保留在derivative.parent。用 `motion.source({parent:pivot,position:[radius,0]})` 可构造移动轴上的针尖，作者仍决定几何、开合曲线与时序。不会自动平滑折点或自动对齐运动方向。

`motion.pathSource(path,{progress,rotation=0,parent?,space=path.space,side='right',boundary=closed?'wrap':'clamp'}) → SourceTrajectory`。progress为秒域标量信号或常量，值是归一化**弧长**，导数是1/s；速度为 `切线*path.lengthPx*progress导数`，不是贝塞尔参数速度。geometry沿用Path的分段直线近似，Bezier误差仍以Path容差为准。默认不沿切线自动旋转；rotation独立指定，避免把折线切线伪造成平滑角速度。折点的left/right按**时间**取侧，反向运动会换用相反的几何段；停在折点时速度0。clamp外停止，端点按时间侧取停止/运动速度；wrap接缝同样报告corner，开放路径wrap还报告jump并取对应端点。边界error拒绝越域。非零速折点可用side:error拒绝，也可明确选侧；不会替作者圆角。

`motion.sampledSource({sample,stepSeconds,range,parent?,space='effect',side='right'}) → SourceTrajectory`：任意纯 `sample(t)→{position,rotation?}` 的**显式近似**出口。必须给固定秒距stepSeconds>0和有限`range:[min,max]`，跨度至少2个步距；不使用输出fps或上次调用。内部用中心差分，靠近范围端点改用前向/后向一阶差分，超出range报错；返回derivative.method='finite-difference'、实际stencil、stepSeconds、range、errorBound:null、discontinuities:'unchecked'。对任意函数无法给出通用误差界或自动识别跳变，缩小步距也可能放大舍入误差；不要用它认证连续性。rotation需先由作者保持展开的弧度，不能把π/-π换边当真实高速旋转。需要精确自写导数时，原emitter.transform回调仍直接接受position/velocity/rotation/angularVelocity。

数值差分还返回实际`derivative.sampleTimes:[lo,hi]`；秒距小到浮点时间无法区分时，错误直接定位stepSeconds并提示增大步距。解析导数溢出同样报非有限数值错误，不返回Infinity。路径折点识别只保留浮点舍入量级的容差，不把可区分的近邻时刻强行吸附到折点。

`motion.observeSource(source,time,{id}) → SourceObservation`：为真实SourceTrajectory声明稳定非空字符串ID，返回其position/velocity/rotation/angularVelocity/space/derivative及kind/id。作品的`observe(t,o)`可返回`{sources:[motion.observeSource(axis,t,{id:'axis'}), ...]}`，也可与particles数组共存；不需要造不绘制的粒子。当前只接受effect空间，其他空间必须显式转换，最多64个稳定来源；来源ID/space须在全run保持，所有状态是有限JSON。

`fx_probe({run,view:'sources',layers?:[sourceId],fields?,at?,sampling:'saved'|'replay',limit=12})`查看真实声明源；可查询position/velocity/rotation/angularVelocity/space/derivative，默认前五项（不含space）。layers在本视图指source ID，不能传particles；返回sources清单、各时刻states、单位、实际时间/误差、选择/省略数量和原尺寸点位图，不返回伪造births。位置点附5px朝向线及0.05秒速度线，其比例在scope中说明；不是实际路径或连续动画。默认读保存证据，显式replay用冻结后端；仅有旧粒子/像素的run返回CAPABILITY_UNSUPPORTED，不从粒子反推源轨迹。保存的粒子与源观测共享16MB预算。

`motion.radial({center=[0,0],strength=0,tangential=0,startAge=0}) → force(state)`。strength正向外、负向内，tangential沿`[-dy,dx]`，单位px/s²；中心处返回零。center可为常量或`state=>[x,y]`。startAge为粒子秒龄。出生域和发射方向与力场独立。

`motion.attract({target,stiffness=60,damping=10,startAge=0}) → force(state)`。阻尼弹簧：`(target-position)*stiffness-velocity*damping`，stiffness单位1/s²，damping单位1/s。target可为坐标或回调；支持延迟、移动目标。没有自动吸死半径；按需显式给integrate/particle.motion.kill回调。

`motion.integrate({position,velocity,age,born=0,life=1,acceleration=[0,0],drag=0,forces=[],kill?,birth=null}) → {position,velocity,alive,simulationAge,killedAge}`。每次从出生状态重建，固定120Hz，以出生年龄为格点，保留最后完整tick；不依赖调用顺序/fps，无尾部可变dt。每tick在上一个状态采所有力、求加速度之和，再用ballistic核推进1/120秒，最后执行kill。kill出生时也执行，命中后持久死亡；精度为tick，不宣称连续碰撞解。最多1440tick/12秒，超预算报错。force/kill收到`{position,velocity,age,age01,time,born,life,birth}`，time=born+age。自写纯force返回加速度向量即可，无需自己维护积分器。

### example

```js
const q=motion.ballistic({position:b.position,velocity:[12,-20],acceleration:[0,60],drag:.8,age:b.age});
p.rect(q.position[0],q.position[1],2,1,C[3]);
```

移动源可执行参考：effect inspect `lab/source-shuttle`。最小组合如下（模块顶层创建轨迹，draw与emitter共享它）：

```js
const opening=curve.scalar({points:[[.2,0],[.8,1],[1.1,1],[1.7,0]],interpolation:'smooth'});
const angle=curve.affine(opening,{scale:.8,offset:-1.6,outputUnit:'radians'});
const pivot=motion.source({position:[0,-40],rotation:angle});
const tip=motion.source({parent:pivot,position:[24,0]});
const emitter=particle.emitter({id:'tip',births:schedule.rate({id:'bits',start:.3,end:1.5,rate:20}),
  transform:tip,inheritVelocity:.7,initial:{life:.4,speed:8}});
// draw中的可见针尖用 tip.sample(t).position；particle.draw另选texture或custom draw。
// probe births[].source可查源位置/速度/角速度、实际出生点速度和导数策略。
// export function observe(t){return {sources:[motion.observeSource(tip,t,{id:'tip'})]};}
```

## core/mask

### overview

导入 `{mask}`。Mask 是带空间、栅格原点和内容修订的布尔区域，不是 alpha 图片。返回 data 请视为只读；改轮廓应重新 make/derive，以更新修订。

### contract

- `mask.make({id,w,h,origin=[0,0],space='effect',test}) → Mask`。w/h整数1..480；test(x,y,index) 在艺术像素中心求值，只接受 boolean/0/1。origin 是此栅格左上在空间中的位置。返回 kind/id/w/h/origin/space/data/revision。
- `mask.derive(source,id,test)` 共用栅格，重新求区域；`mask.at(mask,x,y) → boolean` 按包含该点的像素取样，越界false。
- `mask.polygon({id,points,origin?,w?,h?,space='effect'}) → Mask`。至少三个有限顶点，按像素中心做偶奇填充（可凹、多边形自交按偶奇规则）。省略栅格时自动用 floor(min)/ceil(max) 包围；显式栅格可裁切、共用布尔运算坐标。顶点和切口仍由作者选择，不需要重复写点内判定。可用 derive 继续施加独特开口。
- `mask.combine(a,b,{id,operation='union'})` 支持 union/intersect/subtract/xor；栅格尺寸、原点、空间必须一致，不做隐式缩放。
- `mask.outline(source,{id=source.id+'/edge',side='inside'})` 返回4邻域 inside/outside 边。outside 仍裁切在原栅格；贴边时作者显式扩栅格。
- `mask.change(previous,current,{id,fromTime,toTime}) → {id,interval,removedMask,addedMask,identity}`。两图真实差分，不只比较阈值；toTime>fromTime。identity 对同一对内容和时间区间稳定；它是区间观察，**不代表已知每个像素的精确变化时刻**，也不自动给任意动态场提供跨不同区间分割的一次性发射语义。静态首次到达驱动出生请用 image.dissolveEvents。

### example

```js
const shell=mask.make({id:'shell',w:48,h:48,origin:[-24,-48],test:(x,y)=>Math.hypot(x,y+24)<20});
const rim=mask.outline(shell);

// 多边形轮廓＋作者自己的斜开口，不必手写点内扫描。
const paper=mask.polygon({id:'paper',points:[[-18,-40],[10,-47],[20,-16],[-12,-8]]});
const opened=mask.derive(paper,'opened',(x,y,i)=>!!paper.data[i] && !(x>0 && y<-28));
```

## core/field

### overview

导入 `{field}`。明确区分标量范围、排序与第一次到达时间。排序不是距离，edgeBand 使用场的单位，不暗中变成固定像素宽度。

### contract

- `field.scalar({id,space='effect',range,unit='unitless',sample}) → ScalarField`；range 为有限有序[min,max]；`.sample(x,y,time=0)` 检查输入/输出有限性和声明范围，不静默归一化。
- `field.noise({id,space='effect',scalePx=16,seed=1,octaves=3}) → ScalarField`；范围[-1,1]，使用现有 value fbm，octaves整数1..8。不是0..1，也不是向量/流体噪声。
- `field.rank({id,mask,score}) → RankField`。在 mask 有效像素中心计算 score(x,y,index)，按值排序，相同值按像素索引分开；最早0、最晚1，单像素0，空域/域外 sample=NaN。固定 mask 的尺寸、原点与内容修订。
- `field.arrival({id,rank,start,end}) → ArrivalField`；仅接受静态 RankField，有限秒且 end>start，`.sample(x,y)` 为 start+rank*(end-start)，域外Infinity，unit='seconds'。它是明确单调排序的首次到达，不对任意动态前沿猜反函数。

### example

```js
const grain=field.noise({id:'grain',seed:o.seed,scalePx:6});
const rank=field.rank({id:'burn-order',mask:shell,score:(x,y)=>x+8*grain.sample(x,y)});
const arrival=field.arrival({id:'burn-time',rank,start:.8,end:1.4});
```

## core/image

### overview

导入 `{image}`。首批图像链处理程序 Mask 的保留、边缘、真实变化与绘制；外部 RGBA 图片、图像流动、重采样未在此接口冒充已实现。

### contract

- `image.dissolve({mask,field,threshold,edgeBand=0,time=0,previous?}) → {time,threshold,fieldUnit,keepMask,edgeMask,interval?,removedMask?,addedMask?,identity?}`。保留条件为 source有效且field>threshold；edge为保留区域中 field-threshold<=edgeBand。阈值和带宽均为 field.unit（ArrivalField 即秒），不夹到0..1。field必须同空间；排序/到达场必须对应同一 mask 修订。previous 为上一结果，比较真实 keepMask，time必须递增；动态场可同时有新增和移除。
- `image.dissolveEvents({id,mask,arrival,density=1,seed=1,maxEvents=10000}) → Birth[]`。仅静态首次到达场，为每个选中的源像素生成稳定 `id/pixel/index`、born、position（原像素中心）、space/sourcePixel。density 0..1 是按稳定像素通道的抽选；不是从变化区间猜瞬时发射。不依赖 fps/访问顺序，纯函数重放不会累计出生；maxEvents可显式增至230400，超限报错不暗减数量。
- `image.draw(painter,mask,{color,alpha=1,transparency='dither'})`。color/alpha 可为本地 `(x,y,index)=>value`，接受 #rgb/#rrggbb 或 Color32、alpha0..1。transparency为dither/soft；dither沿用场景坐标Bayer，soft保留真正透明度。当前 Painter 为本地effect空间；其他空间需要作者先变换。

### example

```js
const births=image.dissolveEvents({id:'ash',mask:shell,arrival,density:.08,seed:o.seed});
// draw 内：同一 arrival 共用轮廓、边缘光、出生，不重写扫描或排期。
const state=image.dissolve({mask:shell,field:arrival,threshold:t,edgeBand:.03,time:t});
image.draw(p,state.keepMask,{color:'#57302b'});
image.draw(p,state.edgeMask,{color:'#ffbf73'});
for(const b of schedule.alive(births,t,{life:.5})) { /* motion.ballistic(b.age) 与你自己的碎片画法 */ }
```

### pitfalls

changes是观察区间，births是首次到达事件，不能混为一谈。只有 keepMask/edgeMask 不等于获得轨迹、命名图层或完整身体映射。修改原mask后应重建rank/arrival；改色带不需要重建运动随机通道。

## core/light

### overview

导入 `{light}`。用同一个可复用 mask 驱动独立光缓冲，低辉光或完全无光仍由作者选择。不是一套固定亮核风格。

### contract

`light.fromMask(painter,mask,{color,intensity=.2,radius=0})`。color/intensity可为本地 `(x,y,index)=>value`；颜色接受hex/Color32，intensity非负倍率。radius=0只点光，radius>=1为逐源像素径向光，0<radius<1报错。多个源的光相加并饱和；强度还受 Painter.lightK 调制。绘制不会改变源mask或颜色层，未做自动降采样/减光。

### example

```js
light.fromMask(p,state.edgeMask,{color:'#ffc478',intensity:.025,radius:2});
// 禁用外光时不调用，主体 image.draw 保留。
```

## core/texture

### overview

导入 `{texture}`。把Painter.sprite、身体压缩与局部逆向采样的实现路径提炼为有轴心、可旋转/翻转/缩放的像素贴图；参考平台的序列模式与资源轴心。构造的是普通代码内资产，可随源码冻结；不要求外部图片或GUI。

### contract

- `texture.rgba({id,w,h,data,pivot=[w/2,h/2]}) → Texture`。w/h整数1..480；data恰好w*h*4个0..255整数字节，straight RGBA，复制保存；透明像素RGB原样保留。pivot是纹理左上起算的像素坐标，允许在图外。
- `texture.ascii({id,rows,palette,pivot?}) → Texture`。等宽字符串，`.`/空格透明，其他ASCII字符必须在palette有hex/Color32。palette没有未知字符回退；Color32的alpha会保留。
- `texture.sheet({id,image,frameSize:[w,h],pivots?}) → Texture[]`。image是RGBA/ASCII构造的Texture。帧宽高必须整除图集，按从左到右、从上到下拆出；pivots可按帧指定一份像素轴心。
- `texture.sequence({id,frames,mode='lifetime',fps=12,loop=false}) → TextureSequence`。最多1024帧，帧尺寸/轴心可以不同。lifetime按age01等分帧；fps按粒子age秒推进。loop控制帧号取模；否则夹到首末帧。
- `texture.frame(resource,{age=0,age01=0,frameOffset=0}) → {index,texture}`。frameOffset为整数帧偏移，lifetime在age01=1使用末帧；不依赖输出fps。单Texture恒返回index0。
- `texture.draw(p,resource,{position=[0,0],scale=1,rotation=0,opacity=1,tint='#fff',tintMode='multiply',blend='dither',age=0,age01=0,frameOffset=0})`。scale是数或[x,y]，0不绘制、负轴镜像；rotation弧度、position是轴心的effect坐标。逆向最近像素采样，按原像素中心/轴心计算，不做双线性平滑或缩小作品。multiply逐RGB相乘，replace保留纹理coverage而用tint着色。source alpha*tint alpha*opacity合并后送到Painter；blend可为dither/soft/additive，additive只写light层。返回实际选帧。

### example

```js
const shard=texture.ascii({id:'chip',rows:['.H.','HBo','.o.'],palette:{H:'#ffe8b2',B:'#a9553a',o:'#3a2931'},pivot:[1.5,1.5]});
const smoke=texture.sequence({id:'opening',frames:[shard,texture.ascii({id:'open',rows:['H..','..B','.o.'],palette:{H:'#eeb',B:'#965',o:'#423'}})],mode:'lifetime'});
texture.draw(p,smoke,{position:[4,-20],rotation:.6,scale:[2,1],age01:.7,opacity:.4,blend:'soft'});
```

### pitfalls

外部URL/PNG文件读取与资产打包尚未接入；用代码数组/ASCII或编辑本地JS资产模块，可随现有相对导入闭包冻结。additive的中性观察底是黑色。材质切换不必换运动；反过来运动修改也不必重画图集。

## core/particle

### overview

导入 `{particle}`，与schedule/domain/motion/curve/texture/material组合。提炼库内burst/stream/cycle/looped、出生源采样、独立运动与冷却/膨胀画法；补齐稳定属性通道与观测。普通代码仍可自写轨迹、力、生命周期、画法，不限于固定粒子类型。

### contract

`particle.emitter({id,births,seed=1,domain?,measure='area',direction?,transform?,inheritVelocity=0,initial={},textures?,motion={},material={}}) → Emitter`。

- births来自schedule或image.dissolveEvents，有唯一字符串id和born。已有position优先；否则从domain取样；都没有则[0,0]。出生位置采样以birth.randomId或id为键，不因列表重排或添加其他粒子而漂移。cycle的同slot副本共享随机属性、身份仍分开。
- domain使用domain公开契约；另有`domain.point({id,position=[0,0],space='effect'})`、`domain.sector({id,radius,innerRadius=0,angle=0,spread=PI/2,space='effect'})`，sector按扇环面积均匀采样，仅支持area。domain.sample还可传与count等长、唯一的`ids`，用身份而不是数组序号采样；返回仍有index。
- direction是`{mode:'angle'|'outward'|'inward'|'normal'|'tangent',angle?,spread=0,center=[0,0]}`或`context=>[dx,dy]`。angle模式默认向上(-PI/2)，其他模式angle默认0为相对偏转；spread是总弧度宽度。in/outward以center独立计算，normal/tangent仅在域提供时可用，不为mask伪造法线。零speed不要求方向。也可在initial直接给velocity。
- transform为静态对象、`birthTime=>{position=[0,0],rotation=0,velocity=[0,0],angularVelocity=0}`或motion的SourceTrajectory，只在出生时采样。域坐标/初速度先旋转，再平移位置；实际出生点的源速度为`velocity+angularVelocity*[-旋转后域y,旋转后域x]`，乘inheritVelocity加到初速度。旧回调不声明angularVelocity时保持原来仅继承平移速度的行为。SourceTrajectory接管导数，也可继续显式提供velocity(px/s)/angularVelocity(rad/s)；不从输出帧猜速度。出生后默认脱离源，不自动追随。源声明space时须与出生域/已有birth.space一致。Birth中的source保存位置、平移速度、旋转/角速度、pointVelocity和可用的derivative策略，fx_probe返回的births可直接查询；这不是任意场/绘制层的观测协议。
- initial可为对象或`context=>object`。life(秒，默认birth.life或1)、speed(px/s，默认0)、scale(默认1)、scaleY(相对Y倍率，默认1)、rotation(弧度，默认0)、spin(rad/s，默认0)、opacity(默认1)、frameOffset(整数帧，默认0)各自支持常量、`[min,max]`或`context=>number`。velocity是常量向量或回调，覆盖speed/direction。data为JSON对象或回调；先求data再求各属性。所有回调收到`{birth,index,seed,data,position,normal?,tangent?,source,rand(channel,min=0,max=1)}`（position为变换前域坐标，source为出生源变换）；同channel可显式相关、不同channel互不影响。frameOffset范围要用`c=>Math.floor(c.rand('frame',0,3))`，不自动把连续范围取整。scale/scaleY可负值用于镜像。opacity最终必须0..1。
- textures为`[{texture:Texture或Sequence,weight=1}]`出生加权选资源，weight>0；使用独立texture通道。否则用material.texture。没有贴图也可仅计算/观察，绘制时需custom draw。
- motion的acceleration/drag调用ballistic；forces/kill调用固定120Hz integrate。force可直接使用motion.radial/attract或自写。`trajectory(state)=>{position,velocity,alive?}`可完整替换求解，velocity必须明确提供。`offset(state)=>[dx,dy]`最后加到渲染位置；basePosition保留物理位置，velocity不包含视觉偏移导数。`contact:contact.floor(...)`提供解析水平面接触，事件与二次出生见core/contact；不能与forces/kill/trajectory混用。历史尾迹见core/trail；尚无任意形状碰撞、完整约束或运动阶段列表。
- material的scale/scaleY/rotation/opacity/tint支持常量、Curve或`state=>value`。ScalarCurve/ScalarSignal/ColorCurve的particle.age01映射年龄，local.seconds/scene.seconds在本实验均映射effect time；path.s须作者显式回调。scaleX=birth.scale*material.scale，scaleY=birth.scale*birth.scaleY*(material.scaleY或material.scale)；旋转=birth.rotation+spin*age+material.rotation。opacity=birth.opacity*material.opacity，严格0..1。alignVelocity=true把物理速度朝向加到旋转。tint是hex/Color32或ColorCurve；tintMode='multiply'|'replace'。blend可常量或回调返回dither/soft/additive。texture可为Texture/Sequence或`state=>resource`，支持火团转烟等分阶段材质。

`particle.track(emitter,particleId,{position='render',end?}) → ParticleTrack`：不求材质的闭区间轨道，含id/born/end/space、parent:{layer,particle,copy}、positionMode和knots。sample(effectSeconds)仅接受[born,end]，返回position/velocity/simulationTime；可取准确终点，不伪造expired粒子State。render包括motion.offset，physical只取物理位置，velocity均为物理速度。解析/接触轨道复用原求解；force/kill轨道复用相同120Hz积分顺序并保存最多1441个tick，乱序查询不重跑整条历史；simulationTime报告实际tick。end默认首次接触kill/force kill或自然寿命，stop/settle继续到寿命；可显式提前结束，不能晚于首次死亡。replacement trajectory必须提供已知绝对end；若在此前返回alive:false则拒绝，不猜任意函数的首次死亡。可用core/trail自定义track以null表示缺段。仅effect空间、每粒子<=12秒。contact事件自动成为corner knots，精确event.time查询使用该事件的age返回撞后状态，不因born加减舍入落到撞前；任意视觉跳变需显式break，不推断连续性。

`particle.sample(emitter,time,{includeInactive=false}) → State[]`。纯查询，可乱序跳转。State有id/index/born/life/age/age01/time/data/status、position/basePosition/velocity/simulationAge/offset、scale/rotation/opacity/tint/blend/tintMode、texture帧摘要和sprite实际Texture。alive State另有只读使用的`birth`引用：已解析出生属性及来源，接触子出生可直接读取`state.birth.event`（完整父接触）、`birth.parentEvent/parentParticle/copy`，不必在initial.data重复搬运。回调不可修改birth或共享event；艺术派生参数仍可放data。contact运动还给出`contact:{phase,count,lastEventId}`。`particle.observe`不复制整份birth到每帧State；probe的births表保留同样因果信息，fields不接受birth/event。寿命区间[born,born+life)，默认只返回alive。includeInactive还返回pending/expired/killed，其未存在的年龄/材质不伪造；killed保留停止时的位置/速度与killedAge。

`particle.draw(p,emitter,time,{draw?,filter?}) → alive States`。默认画贴图；draw(p,state)可换任意Painter或material画法。filter(state)用于作者自己的遮挡/层次规则。`particle.observe(emitter,time) → ParticleObservation`返回稳定births及去掉像素资产字节的states，适合下述协议。

### example

```js
import {particle,schedule,domain,motion,curve,texture,material} from '../../../src/authoring/index.js';
const mark=texture.ascii({id:'mark',rows:['.#.','###','.#.'],palette:{'#':'#fff'}});
const opacity=curve.scalar({input:'particle.age01',points:[[0,0],[.1,1],[.75,1],[1,0]]});
function make(o){ return particle.emitter({id:'iron',seed:o.seed,
  births:schedule.rate({id:'iron-born',start:.1,end:.6,rate:24}),
  domain:domain.circle({id:'rim',radius:12}), direction:{mode:'inward',spread:.5},
  initial:{life:[.7,1],speed:[15,30],rotation:[0,6.28],spin:[-4,4]},
  motion:{forces:[motion.radial({strength:-12,tangential:50}),motion.attract({target:[0,-8],startAge:.25,stiffness:40,damping:6})]},
  material:{texture:mark,opacity,tint:curve.color({points:[[0,'#fff1ba'],[.3,'#ca653c'],[.8,'#47303a'],[1,'#252033']]})}
}); }
export function draw(p,t,o){particle.draw(p,make(o),t);}
export function observe(t,o){return {particles:[particle.observe(make(o),t)]};}
// 也可复用库内画法：particle.draw(p,make(o),t,{draw:(p,s)=>material.mote(p,s,{glow:.02})});
```

### evidence

可选公开协议：作品导出纯函数`observe(effectTime,resolvedOptions) → {particles:[particle.observe(...),...]}`，不调用Painter、不修改作品。render在实际绘制时间执行，校验每组稳定id/births与每出生恰一条状态，写observations.json及SHA256；单次<=16MB，超限明确报错。循环结尾observe接收与draw相同的wrapped localTime。普通旧作品不必补observer。

`fx_probe({run,at?,view='color',sampling='saved',layers?,particles?,fields?,limit=12})`：at为`{times:[seconds],clock:'effect'}`或`{event,offsets,clock:'effect'}`，最多24个时刻，默认用已选事件帧。preview/color/light/combined直接读单run保存图，支持旧作品，不需重复传run；这四视图不接受粒子fields/layers或replay。particles/trajectory默认读保存观测，即使当前草稿无法导入仍可查；sampling:'replay'明确在冻结源码重算，可查非保存时刻。layers为已声明粒子组ID，particles为字符串birth ID；默认取声明顺序前limit条，结果报告全部数与省略数。fields可选status/position/basePosition/velocity/age/age01/simulationAge/opacity/scale/rotation/tint/blend/tintMode/texture/offset/data/contact，结果附单位、births、每时刻全组数量和选中状态。tint为Color32整数，blend/tintMode为已声明状态；custom draw可以自行改画法，这些字段不从最终像素反推自写shader。未知组/身份/字段报错。trajectory按时间连接**离散观察点**，不是推断连续物理轨迹；稀疏时刻只提供稀疏证据。at范围外会明确夹边。无observer的旧run仍可查保存图，不从最终像素反推身份；不支持任意mask/field、内部绘制层隔离、去修改器或动作播放时钟。

### pitfalls

复杂设计可把emitter缓存在由艺术参数决定的design(o)内，颜色局改只影响材质；不要用每帧Date/Math.random。forces组合的复杂轨道用固定tick；恒力用解析核更快。不要把物理velocity当作offset后的速度。周期副本ID不同、randomId相同；用随机颜色通道不改变运动，但修改seed会改变所有用seed的通道。完整效果参考`lab/cinder-orbit`，可通过effect inspect读取。

## core/material

### overview

导入 `{material}`。直接调用原库成熟实现（fire/_lib的firePuff/smokePuff/ember/spark，arcane/_lib的mote/streak，water/_lib的bead/ring及Ripples年龄包络），不是重新近似这些效果。只增加公共粒子State适配，保留原文件上游来源与MIT署名。可逐粒子换画法，也可完全自写Painter。

### contract

下列函数均`(p,state,options)`，state至少含position/age01/opacity，方向型另需velocity。size为像素基准；glow非负。颜色以原作者指定色带为准，fire/ember/spark为**热色优先**，允许任意非空长度，内部用原core.fit离散重采样。不会自动乘state.scale或旋转shape（方向型使用velocity），作者可把scale映射到size；opacity作用于颜色和光，绘制后恢复Painter.fade/lightK。

- `material.fire(p,s,{colors,size=3,heatOffset=0,glow=1,direction=[0,-1]})`：分层火团、偏上高光、冷却末段转软透明，方向为小火舌向量，原firePuff算法；glow乘原0.18强度。
- `material.smoke(p,s,{size=3,tint=null,big=false})`：三层软透明体积、随年龄膨胀/变稀、年轻时顶盖；tint=null使用库内烟色阶，无独立外光。
- `material.ember(p,s,{colors,size=1,phase=0,glow=1})`：热像素或带暗边十字，末段按phase闪烁，glow为原光倍率。
- `material.spark(p,s,{colors,glow=1})`：按物理速度伸长的亮头与冷尾，随age冷却，glow为原光倍率。
- `material.mote(p,s,{tint=s.tint,size=1,glow=.4})`：速度方向暗尾/亮体，末段淡出，glow为原函数强度。
- `material.streak(p,s,{tint=s.tint,maxLength=7,glow=.4})`：白头/色体/暗点尾，速度决定长度。state.opacity控制覆盖；保留作者自己的生命周期曲线。
- `material.waterDrop(p,s,{colors=WATER,size=2,glow=0})`：直接复用bead速度尾迹/高光水珠，以及Drops的小光池。colors按深→亮，重采样8阶；size的1/2/3档沿用原画法。默认无附加光，glow为原光倍率。
- `material.ripple(p,s,{colors=WATER,radius=18,startRadius=1,sy=.22,n=2,gap=3,strength=1,hot=.1,glint=0,seed=1,glow=0})`：直接复用ring，及Ripples的半径`start+(radius-start)*(1-(1-age01)^2.6)`、强度`strength*(1-age01)^1.7`和gap包络。radius/startRadius为非负px，sy>0为纵向投影比例，n为1..16整数，gap/strength/hot/glint非负；hot是秒，按state.age（否则age01*life，缺life用1秒）判断。seed固定纹理，不从全局顺序取种子。默认glow=0，glow=1保留原光。颜色与运动可独立替换，不代表真实流体；需要不同增长法可自写draw。

### example

```js
particle.draw(p,hotDebris,t,{draw(p,s){
  const colors=['#fff5cf','#ffbe76','#b95c39','#3a2732'];
  if(s.age01<.4) material.spark(p,s,{colors,glow:.04});
  else material.smoke(p,{...s,age01:(s.age01-.4)/.6},{size:2.5*s.scale[0]});
}});
```

### pitfalls

这些是可选、已归纳的库内画法，不是新的强制粒子类型。motion仍独立。需要完整旋转、多帧形变或自定义轴心时使用texture；需要新的像素shader时自写draw。未声称所有画法都经过独立创作案例；见创作测评的实际覆盖。

## core/contact

### overview

从`athanor/authoring`或本地index导入`{contact}`。从fire/_lib.sparkAt的解析飞行/接触二分、core/sim的反弹/停留/落地，以及water/_lib的落地涟漪提炼。保留原实现与上游MIT署名。接触是稳定的因果记录，二次出生消费记录，不在draw或逐帧回调中累积。当前只处理**点主体与静态水平面**、恒加速度和分轴线性阻力；不是任意形状/地形/力场碰撞。

### contract

- `contact.floor({id='floor',y=0,response='bounce',restitution=.45,tangentRetention=.7,settleSpeed=3,maxEvents=32,timeTolerance=1e-8}) → ContactFloor`。本地effect空间，+y向下，合法区域y<=floor.y，法线[0,-1]。response为bounce/stop/kill；bounce在法向翻转并乘非负restitution（可>1），切向乘有限tangentRetention（可负、可>1，均为显式艺术选择）。反弹后法向速度绝对值<=settleSpeed(px/s)即settle，stop/settle都冻结位置并置两轴速度0，寿命继续；kill无后续状态，velocityAfter为null。maxEvents为每父粒子1..64次预算，超出明确BUDGET_EXCEEDED，不截断；不插入旧算法的0.25px避碰跳跃。
- `contact.trace({position,velocity,acceleration=[0,0],drag=0,born=0,life,floor,layer='effect',particle='body',copy=null,randomId=particle,data=null}) → ContactTrack`。单位px/px/s/px/s²，drag为非负1/s或[x,y]，life为正秒且<=12；data为有限JSON。出生在面下方报错，不自动投影。按完整寿命一次构建分段解析轨道；水平面求交在竖直速度转向点拆单调区间，再二分到浮点精度，避免两端都在面上方时漏掉中间的下穿。precision是双精度ballistic方程的父年龄时间夹逼范围；timeErrorMax保留段内求根宽度与最终ageBracket宽度两者的较大值，避免分段偏移的舍入扩张少报或折叠成伪零误差，不是任意精度证明。timeTolerance是允许夹逼宽度；64次细分仍达不到时拒绝。
- `track.sample(age)`给出position/velocity/alive/simulationAge/killedAge及contact:{phase,count,lastEventId}，age为非负秒。事件时刻采用**撞后**状态；phase为flight/resting/killed/expired。初始恰在面上、向下或静止且向下加速，接触在age=0；初始朝上先离开，后续返回再触发。沿向下运动到达面的零法向速度接触也可产生事件。寿命为[born,born+life)，**接触恰在死亡时刻则死亡优先，不产生接触或子出生**。已杀死粒子在其原寿命之后仍沿用particle的expired分类，历史事件不删除。
- 粒子入口为`particle.emitter({...,motion:{acceleration,drag,contact:floor}})`，构建稳定轨道并共享给draw/sample/observe。不能同时使用forces/kill/trajectory，返回CAPABILITY_UNSUPPORTED；offset可用，但只改变视觉位置，不改变接触点、速度和事件。事件/来源空间当前为effect；不是贴图尺寸扫掠，作者需按真实接触点选择出生坐标和面的位置。
- `contact.events(emitter或track,{from?,to?}) → ContactEvent[]`。每次纯读取完整或`[from,to)`绝对effect秒窗口，返回副本，不依赖调用顺序或输出fps。每条含id、kind:'contact'、layer、particle、copy、randomId、collider、ordinal、time、age、position、normal、velocityBefore、velocityAfter、response、父data，以及precision:{method,timeTolerance,ageBracket,timeErrorMax}。ordinal每父copy从0开始，ID是无歧义的layer/parent/collider/ordinal元组；不同周期copy不同ID，randomId按原slot保留。事件数全emitter最多10000。
- `contact.births({id,events,count=1,delay=0,select=e=>true}) → Birth[]`。count为0..10000整数或纯event=>整数；delay为非负秒。出生时刻为event.time+delay，position/normal来自接触；保留event、parentEvent、parentParticle、copy。多次传入同一事件会去重，重复ID但内容冲突报错；子ID由id/eventID/子index决定，周期copy的randomId复用父slot/collider/ordinal。返回稳定排序、最多10000条，可直接作为另一emitter的births。自定义draw可直接用`state.birth.event.ordinal/collider/velocityBefore`及`state.birth.parentEvent/parentParticle`控制画法，不必复制到data（不要修改这些共享出生信息）。不会隐式继承父速度；用initial回调的`context.birth.event`选择撞前/后速度、法线或data，也可direction:{mode:'normal'}。从未构造的父周期copy不会被自动补算，周期窗口需覆盖子寿命所需的历史父事件。
- `contact.observe(emitter) → ContactObservation`。在作品`observe(t,o)`中返回`{contacts:[contact.observe(primary)],particles?:...,sources?:...}`；接触父ID与完整事件表在整run保持不可变（不要只返回截至t的累计事件）。空事件表也是有效声明。事件表保存一次，与粒子/源观察共享16MB；不从旧像素或隐藏回调推断。
- `fx_probe({run,view:'contacts',window?:{from,to},layers?:[groupId],particles?:[parentId],sampling='saved',limit=12})`返回完整events、units、窗口和选择/省略数量，limit最多64。window默认[0,run.duration)，支持负/超范围请求但报告夹边；from>to拒绝。该视图不接受at/fields，事件带自己的求解时间，不取最近输出帧。sampling:saved读带hash的静态事件表；replay用冻结后端。旧run无声明明确不支持。原尺寸点位图的入/出速度线代表0.05秒，不是连续历史轨迹。保存事件与二次出生可在独立窗口查询、乱序跳转或冻结复验，不重复触发。

### example

```js
import {contact,particle,material} from '../../../src/authoring/index.js';
const surface=contact.floor({id:'pool',response:'kill'});
const drops=particle.emitter({id:'drops',births:[{id:'drop/0',born:.1,position:[0,-24]}],
  initial:{life:2,velocity:[8,-12]},motion:{acceleration:[0,120],contact:surface}});
const rings=particle.emitter({id:'rings',births:contact.births({id:'ring',events:contact.events(drops)}),initial:{life:.7}});
export function draw(p,t){
  particle.draw(p,drops,t,{draw:(p,s)=>material.waterDrop(p,s,{glow:0})});
  particle.draw(p,rings,t,{draw:(p,s)=>material.ripple(p,s,{radius:14,glow:0})});
}
export function observe(t){return {particles:[particle.observe(drops,t),particle.observe(rings,t)],contacts:[contact.observe(drops)]};}
// 补完整meta即可使用；完整可运行组合可effect inspect lab/landing-relay。
```

### pitfalls

接触数据是物理点位置；纹理、视觉offset和非粒子主体可能越过画布，不能用中心点替代完整像素边界。出生在地面且零速度的子粒子若也选带重力的接触，会在age=0产生支持接触；这是显式规则，避免无意递归构造响应。多级响应通过新的emitter及同一事件记录组合，不提供无限递归监听器。自写force/地形/半径/斜面/容器与真实历史拖尾仍未交付。低辉光、不同材质与非粒子响应都可由作者决定。

### evidence

core/contact公开契约、CLI/MCP/HTTP同一Schema、contact.test.mjs技术回归与独立创作者归档分别说明范围。现有库源码不被重写；源算法和当轮参考平台构建见实现地图/研究记录。技术测试不是艺术认证。

## core/trail

### overview

导入`{trail}`。这是真实历史位置的**采样折线**，区别于material.streak的速度外推或独立Path的头尾条带。通用化core/shapes.trail的过去时刻查询、arcane-missiles的历史路径/命中后消散，以及path.strip的连续像素画法；保留MIT/Hugo Duprez来源。普通JS可定义任意纯轨道和画法，没有固定作品DSL。

### contract

- `trail.history(track,{id=track.id,length={seconds:.4},stepSeconds=1/120,death={mode:'fade',seconds:.2},maxSamples=2048}) → HistoryTrail`。track为`{id?,born,end,space='effect',sample(time),parent?,positionMode?,knots?}`；sample接受闭区间effect秒，返回`{position:[x,y],velocity?,simulationTime?,breakBefore?}`或null（缺段）。position为effect像素，velocity若有为px/s，simulationTime默认请求时刻；不由位置差伪造速度。born/end有限，0<=end-born<=12，可负出生；单点轨道有效但不画虚假圆点。采样和回调必须纯，不依赖draw顺序或输出fps。可直接传particle.track，也可传非粒子自写轨道/source.sample。
- length只接受一种单位：`{seconds:正秒}`或`{pixels:正像素}`。seconds截取历史时间窗口；pixels从最新点向后按**已采样折线长度**裁切，末端可在段上线性插值，标记interpolated:true/source:'polyline-trim'，不是新物理采样；不将首尾直线距离当走过的长度。恰好落在已有样本时直接保留该点，不生成重复端点；插值速度仅在两端均声明时给出。断段不计跨越距离。当前没有点数长度/空间误差自适应保证。
- stepSeconds为显式正秒，网格固定在born+k*stepSeconds；额外采样窗口边界、终点及knots。不是每输出帧加一条。knots为`[{time,kind:'corner'|'break',...}]`，time在轨道内；corner保留真实转折位置，break从该时刻开始断段，不连接跳跃，跳跃前末段止于前一个样本（未伪造左极限）。同一时刻有多个knots时break优先于corner，与输入顺序无关。sample返回null后下一有效点也断段。已知急转/高频运动应选适当step或提供knots；不能声称恢复任意采样间运动。
- death.mode为fade/shrink/clear。fade在end冻结最后窗口、整体线性淡出death.seconds，t>=end+seconds消失；shrink仅seconds长度，从当前时间继续过期旧点，t>=end+length.seconds消失；clear在t>=end立即删除。宽度/颜色仍由作者控制；历史年龄historyAge在freeze期间保持，ageSeconds继续增长。pixels不支持shrink，明确拒绝；可freeze/fade或自写策略。
- `trail.emitter(emitter,{id=emitter.id,position='render',ends={},...historyOptions}) → TrailSet`为每条出生创建particle.track和独立尾迹；稳定ID为id与父layer/birth的元组，保留copy。position为render/physical；ends按birth ID给replacement trajectory或提前结束的绝对时间。最多256条track；不会把不同父轨道连起来。父出生及其data可从particle观察查询，不复制像素资源进历史。
- `trail.sample(history或set,time,{tracks?:[trailId]}) → TrailFrame`；含id/time/trails/evaluationCount/pointCount。每条含id/parent/space/positionMode、phase:pending/alive/fading/expired、opacity、window:{from,to,sampledFrom}、lengthPx、sampleCount、sampling及points。点按**最旧→最新**，含time/simulationTime/position/可选velocity、source、interpolated、breakBefore、distancePx、s、time01、ageSeconds、historyAge。s为保留折线累计长度归一化0..1（全静止为0）；time01为保留时间跨度0..1；ageSeconds=time-point.time，historyAge=headTime-point.time。停留的相同位置但不同时间不删除，不丢失驻留年龄。pending/expired无点，不伪造位置。全静止点列不画圆点。
- 预算：maxSamples为每track每次2..4096，默认2048，包括边界/knots及null样本；pixels模式需回查完整出生至head区间。每frame最多20000次轨道求值和10000保留点。超出BUDGET_EXCEEDED，可显式改变预算/步距/时间窗；不默默降采样。history不维护有状态帧队列，跳转可重建。
- `trail.draw(p,history或set,time,{width=2,color='#fff',alpha=1,filter?})`或`trail.draw(p,TrailFrame,undefined,style)`，返回{frame,drawing}。width为全宽像素或point=>width；color为hex/Color32或(point,across)=>color；alpha为0..1或(point,across)=>coverage，乘死亡fade的opacity。point有id/parent和上述历史坐标；像素着色的time/s/historyAge等是段内线性插值的**材质坐标**，不是额外物理查询。across为横截面归一化-1..1。filter(state)可筛父轨道。宽度在采样点求值并沿段线性变化；连续nearest-centerline绘制，圆帽/圆角并集，无尖锐miter，不在接缝叠加alpha。重合段等距离时最新段优先，其余按归一化中心距离选；不是透明多层织物合成。保持Painter状态，颜色/光由普通Painter/API扩展。
- `trail.observe(history或set,time,{tracks?}) → TrailObservation`。observe(t,o)返回`{trails:[trail.observe(...)],particles?,sources?,contacts?}`；稳定group/track描述和可变states。可声明少量真实track，避免为了观察制造粒子或手写历史表。所有观察共享16MB，超出拒绝。历史落盘采用无损point-table-v1（observations version 2）：重复点的静态数据共用索引，逐帧年龄/长度等浮点原样保留，不丢帧/降采样/量化；fx_probe自动展开完整点，旧v1逐帧记录仍可读取，不需作者手写解码器。旧run不由像素/稀疏particle观察推断历史。
- `fx_probe({run,view:'trails',at?,layers?:[groupId],tracks?:[trailId],sampling='saved',limit=12})`返回trails描述、各时刻完整states和原尺寸折线点图；带单位、请求/实际时间、夹边/误差及选择/省略数。saved取最近保存**历史frame**，其中每个点仍保留原历史时刻；replay显式用冻结后端在请求时间重建。新后端对pure作品使用绝对时间，不将请求舍入为十位小数；simulation仍报告实际120Hz tick，旧run保持其冻结时钟。无需调试改稿。该视图不接受fields/particles/window；最多12000个所选点、800万图像像素，超限拒绝。未声明的旧run明确不支持。

### example

```js
import {particle,contact,trail} from '../../../src/authoring/index.js';
export const meta={name:'Rebound ink',desc:'A real bounce leaves ink',tags:['trail'],size:[120,100],origin:[40,75],duration:2.5,options:{}};
const head=particle.emitter({id:'head',births:[{id:'one',born:0,position:[0,-30]}],initial:{life:1.8,velocity:[22,-20]},motion:{acceleration:[0,160],contact:contact.floor({y:0})}});
const wake=trail.emitter(head,{id:'ink',length:{seconds:.55},death:{mode:'fade',seconds:.3}});
export function draw(p,t){trail.draw(p,wake,t,{width:q=>.5+4*q.s,color:(q,a)=>Math.abs(a)<.3?'#fff1bc':'#517f9b'});}
export function observe(t){return {trails:[trail.observe(wake,t)]};}
```

完整可拆参考`lab/rebound-loom`还包含非粒子轨道、停顿/折返、像素长度及死亡后消散。作者可读取TrailFrame再用自写绘制，或只替换带宽/材料；不要求使用同一外观。

### pitfalls

- 时间采样不保证空间误差；高速度/高曲率需要显式步距/knots。接触corner保持折返，不自动抹平弹跳。
- pixels长度来自折线；裁切点与像素shader插值不是新的动力学证据。world/body空间需要显式变换至effect。
- arbitrary trajectory的死亡/不连续性不能自动推断；particle.track要求显式end，自写track可给null和break。
- 不是刚体带状碰撞、流体、纹理UV ribbon或动态Spine导出。旧速度尾迹与程序刀光保持原入口。

### evidence

trail.test.mjs验证与core/shapes.trail的采样等价、实际反弹拐角/终点、驻留时间、像素弧长裁切/缺段、死亡策略、固定力场求值与实际时钟、path.strip像素等价/自交、预算、观察身份及保存/缺源码冻结probe。开发参考不替代独立创作者；每轮build、原报告与修复补测另存测评目录。技术通过不代表艺术认证或净省时证明。
