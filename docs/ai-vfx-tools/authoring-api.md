# 已实现的像素特效创作 API

这是已实现的公开 SDK 契约，供 `fx_search → fx_inspect` 按需查询。Painter/颜色来自原 core，时钟来自实验适配器；首批路径、随机、曲线、排期、运动及场/mask/消融链从 `src/authoring/index.js` 导入（草稿路径 `../../../src/authoring/index.js`，安装包 `athanor/authoring`）。这里只描述真正可调用的子集，完整能力全景仍见产品计划。参考组合可 inspect `lab/ember-weave`，也可直接从空白编写自己的结构与材质。

## core/status

### overview

由游戏提供的施加/刷新/解除事实驱动**表现**生命周期。身体材质、轮廓、环绕物与已脱离粒子共用时间/身份，但不强制共用画法。角色、状态名、强度映射、刷新相位和解除方式由作者决定；不管理buff胜负、叠层或伤害tick。参考`lab/status-relay`、`status-lifecycle`配方。

### contract

- `status.lifecycle({id,target,events,fadeIn=.15,fadeOut=.3}) → StatusLifecycle`。id/target是稳定身份；events为`{id,time,action:'apply'|'refresh'|'remove',duration?,strength?,phase?,order?,data?}[]`，time为非负播放秒，事件id唯一；同秒按order（默认0）、id排序，可显式表达同帧先后；data是可自由使用的有限plain JSON载荷。duration是从该事实时刻起的正秒数，null表示直到外部解除；strength为非负、可大于1的作者输入，不是alpha。
- apply总是创建新实例/重启相位；已有实例在此时停止发射并可残留fadeOut。refresh需在活跃区间`[born,end)`内：duration未给则保留原到期，给出则替换为time+duration；strength/data未给则保留。`phase:'preserve'`（默认）不重置循环时钟/出生格，`'restart'`从该事实时刻重启相位/出生格。remove关闭当前实例，没有活跃实例时是可保留的无操作事实。自然到期同样停发。不会推断游戏叠层/延时策略。
- 结果保存不可变events/instances，实例id来自apply事件，segments保留刷新事实/strength/phaseOrigin/phaseId。fadeIn/out只控制附着表现包络，不修改脱离粒子的life。
- `status.sample(lifecycle,t)`纯读取，返回`{id,target,time,active,tails,instances}`。每个可见实例包含`id,target,status:'active'|'tail',born,end,event,releaseEvent,age,phaseTime,phaseOrigin,phaseId,strength,data,emitting,releaseAge,opacity`。active最多一个；旧实例尾部可与新apply重叠，如何合成由作者选。尾部phaseTime继续，opacity按声明淡出；到fadeOut结束不再返回。无穷end用null，不把Infinity放进公开JSON。
- `status.phase(instance,period) → {cycle,seconds,progress}`用于自己的周期材质/环绕，period为正秒数；它不发射、不绘图。
- `status.births(lifecycle,{id=lifecycle.id,rate,from=0,to,life=1}) → Birth[]`。to为明确有限结束秒，rate为固定每秒数；生命周期每个显式相位起点有出生格，refresh保相位不重排已有ID。窗口半开，移除/自然到期后不产生出生；life可以是`({born,lifecycle,target,instance,event,phaseId,phaseOrigin,phaseTime,strength,data})=>seconds`。返回出生携带`statusEffect`上述来源，不隐含位置或速度；接现有particle.emitter的domain/transform/initial即可。life不被解除时刻或fadeOut夹短。最多10000条；不同窗口可按稳定id合并，不按draw回调去重。
- `status.bind(actualBody,lifecycle|lifecycles[]) → Body`是可选状态通道，保留同一实际身体id/几何，将data设为`{target:原data,statuses:{[lifecycle.id]:status.sample(...)}}`。把返回body用于surface/body绘制与body.observe，现有`probe view:bodies fields:['data',...]`能查真实可见目标和生命周期；不需假粒子。几何anchor的data:false仍跳过载荷。多个lifecycle id必须唯一。
- `status.heat(baseColor,pixel,instance,{colors=['#491712','#c9281f','#ffc23d','#fff3a6'],period=.6,amount=.6}?) → Color32`为可选的亮度/周期材质，pixel.position来自现有surface材质格；保留原色与循环tnoise变化。instance可为active或某个tail，null时原色不变。不是必须的burning预设，颜色/amount或整个shader可替换。
- `status.flame(p,{position,height=5,width=1.2,lean=0,time=0,period=1.2,seed=1,colors,opacity=1})`直接复用status/_lib.tongue的层状像素火舌；colors暗→亮，内部转换旧画法的亮→暗顺序。position属于传入Painter的局部空间；周期/height/lean由作者控制，状态独立。

### example

```js
const coat=status.lifecycle({id:'warm',target:'hero',events:[
  {id:'on',time:.3,action:'apply',duration:2},
  {id:'renew',time:1.2,action:'refresh',duration:2,strength:1.4,phase:'preserve'},
  {id:'off',time:2.6,action:'remove'}]});
const hero=status.bind(myBody,coat); // use this actual body in surface.create
const embers=particle.emitter({id:'embers',births:status.births(coat,{rate:12,to:5,life:.9}),
  transform:body.anchor(hero,{name:'shoulder'}),initial:{velocity:[0,-30],
    data:({birth})=>birth.statusEffect},motion:{acceleration:[0,20]}});
const state=status.sample(coat,t),visible=state.active??state.tails.at(-1);
surface.draw(p,skin,t,{shade:pixel=>status.heat(myColor(pixel),pixel,visible)});
// Don't put this independent lifetime behind `if(visible)`.
particle.draw(p,embers,t,{draw:(p,s)=>myEmber(p,s)});
return {bodies:[body.observe(hero,t)],particles:[particle.observe(embers,t)]};
```

### pitfalls

强度、相位、发射与寿命是不同输入。解除后附着包络可淡出，已脱离物继续按真实出生时间走；不要用整个效果fade代替停发/自然尾部。重施加可以有两个可见实例（旧尾/新状态），工具不自动判定哪层应覆盖。refresh恰在到期点时已无活跃状态，应使用游戏明确提供的apply。状态持续秒不与输出fps绑定；跨fps比较用共同实际时刻。bind只是实际Body的可选状态通道，不从像素推断身体或状态；作者仍控制mask/形状/前后层。

### evidence

直接检查status/_lib、burning/poisoned/stunned、holy/heal与core.createFx.loop/stop；原库已有循环和0.3秒全局stop淡出，本能力新增的是显式表现事实/刷新相位/停发与自然寿命分离。shape/surface、orbit、particle/material继续复用成熟实现。heat/flame保留Sprite Fusion fire/Hugo Duprez/MIT署名。独立原创只证明实测材质/环绕两类，不宣称13种状态全部迁移或艺术收益。

## core/skill

### overview

开放的阶段时间计算与可拆视觉部件。自由命名/排序普通JS阶段，使用同一时间关系发射、命中、取消与退场；原库的刀光、束流横截面和蓄力内收可以单独用，也可完全替换。不规定招式类型、阶段名称、角色、配色或画法。参考`lab/skill-relay`和`skill-parts`配方。作品可导出`events(options)`，从同一阶段/命中记录返回事件对象，render按实际选项求值并随run固定；inspect展示默认选项事件。显式render.events覆盖同名事件，旧对象导出保持兼容。

### contract

- `skill.sequence({id,start=0,stages:[{id,duration}],cancelAt=null,tail=0}) → SkillSequence`。单位均为播放秒；阶段duration>0，id唯一，次序完全由作者决定。返回各阶段start/end/duration、计划end、实际stop、tailEnd、cancelled。cancelAt是绝对秒，早于start会取消整个序列；到计划end之后不改变成功结果。序列不可变，无事件总线/更新回调，不自动画任何东西。
- `skill.interval(sequence,stageId)`返回该阶段实际发射区间`[start,end)`、plannedEnd、emits、cancelled。取消前已出生对象的life不改变。
- `skill.at(sequence,stageId,{edge='start',offset=0}?) → number|null`从同一阶段求cue。阶段边界/cue/retime按输入数的十进制表示相加，避免1.3+.65+.35+.6累计成2.9000000000000004而落在2.9保存帧之后；不设固定舍入精度，能表达的微小偏移保留。取消时刻及之后的cue或未进入阶段返回null；自然结束的end cue仍有效。瞬时事件用cue而不是零时长阶段。得到null应显式跳过，不得转成0。
- `skill.sample(sequence,t)`返回status=pending/active/tail/expired、stage、progress、localTime、effectiveTime、emitting、cancelled、stop、tailAge。取消尾部的effectiveTime停在截断点，但time继续；恰在阶段起点取消时，tail仍关联此前已开始的阶段。tail仅为作者使用的过渡/观察时间，不自动淡出/杀死粒子。
- `skill.retime(sequence,stageId,births,{offset=0}?)`将局部born加stage.start+offset，筛去实际发射区间外的出生，保留life及其他载荷；id加sequence/stage前缀，randomId保留原identity。births仍是普通数组，可直接交particle.emitter/schedule。不是逐帧触发器。
- `skill.swing(options={})`直接适配melee/_lib.swing；字段`cx=0,cy=0,R=30,sy=1,rot=0,a0=0,dir=1,k=0`，单位像素/弧度。R>0、sy>0、|k|<sy，dir为±1；可继续带span/W/t0/sweep/hold/trail/ramp等普通字段。
- `skill.onSwing(s,r,u) → [x,y]`、`skill.slashEnd(s) → {x,y,dx,dy,a}`直接复用成熟投影；u为从a0沿dir的弧度。`skill.smear(p,s,from,to,width,shader,half=0)`直接复用成熟弧带扫描，shader(u,r,out,a)可控制所有颜色/透明/光输出；from/to是弧度，half为-1远/0全部/1近。坐标属于传入Painter的局部空间。
- `skill.slash(p,s,t,{half=0,glow=1}?)`直接调用成熟头前进/保持/尾追赶画法。s需`span,W,sweep,trail,ramp`，hold默认0、t0默认0；sweep/trail秒，W像素，ramp暗→亮自动fit为8色；保留hot/lens艺术选择。glow=0去光，Painter状态恢复。若想换头尾/材质规则，可直接smear或普通path.strip，无需沿用slash风格。
- `skill.beam(p,path,t,{from=0,to=1,width=12,colors=['#24183d','#69499c','#af8ede','#fff'],profile,shade,opacity=1,glow=.2,strands=3,taperHead=0,taperTail=0}?)`。沿任意现有Path连续绘制，不固定水平束。from/to为弧长归一化区间；width为主体全宽像素或s=>width，外围覆盖宽度另乘1.3。profile(s)替换端部宽度包络；未传时taperHead/taperTail按像素收尖，0不收尖。保留原beam的横截面色阶/时间脉冲/近侧亮丝；strands=0可去亮丝，glow=0去光。shade({s,across,time,distancePx,color})可返回颜色、null或`{color,alpha?,light?,lightStrength?}`，完全替换材质；across为外围宽度中的[-1,1]。返回连续栅格信息与真实path.sample的head/tail；不自动加束头/源端圆球。
- `skill.orb(p,{position=[0,0],radius=6,colors,opacity=1,glow=0}?)`独立复用spell-charge的分层核；可自由删掉/替换。
- `skill.chargeRing(p,{position=[0,0],radius=24,aspect=1,rotation=0,progress=1,colors,glow=.12}?)`独立复用投影环，progress∈[0,1]控制色阶/覆盖；没有旧作的固定地面裁切。收缩半径和节奏由调用方曲线决定。
- `skill.infall({id,births,source,seed=1,life=[.2,.34],radius=[20,52],endRadius=6,angles=[0,2π],spin=[.6,1.3],aspect=1,material={}}) → Emitter`。source为effect空间SourceTrajectory；radius是出生时局部径向范围（非负），endRadius是寿命终点半径。角度范围可跨负角，spin为每条寿命内的总转角弧度范围，aspect为局部y压扁。使用二次径向内收/角加速，真实速度含源平移/旋转及相对导数；出生位置/速度和birth.source保留实际源/点速度。输入birth.data原样保留（若非null）；内收参数独立在birth.infall，不占用作者的mass/bank等载荷；未传data时兼容返回内收参数。**它保持跟随源**，不是自由飞行；脱离可另用普通particle.emitter。material直接交现有粒子器，任何纹理/自写draw都可用。闭区间终点用particle.track，源本身用motion.observeSource，不添加调试粒子。

### example

```js
const flow=skill.sequence({id:'cast',start:.2,cancelAt:cancelTime,tail:.5,
  stages:[{id:'gather',duration:.6},{id:'advance',duration:.35},
          {id:'hold',duration:sustain},{id:'clear',duration:.2}]});
const births=skill.retime(flow,'gather',schedule.rate({id:'in',start:0,end:.6,rate:40}));
const motes=skill.infall({id:'gather',births,source:hand,material:{opacity:s=>1-s.age01}});
const hitTime=skill.at(flow,'advance',{edge:'end'});
const hitEvents=hitTime===null?[]:[{id:'arrival',target:'enemy',time:hitTime,
  position:particle.track(projectile,'bolt',{end:hitTime}).sample(hitTime).position,value:27}];
// Each phase may call beam/slash/custom drawing. No mandatory visual pass.
const state=skill.sample(flow,t);
if(state.status==='active'&&state.stage==='advance')
  skill.beam(p,route,t,{to:state.progress,width:8,colors:myColors,taperHead:10});
// Existing motes still consume playback t after emission is cancelled.
particle.draw(p,motes,t,{draw:(p,s)=>myMark(p,s)});
```

### pitfalls

局部动作秒先通过action.clock.at/retime转为播放秒；不要把脱离粒子重新按停顿时钟走。修改阶段时长只修改stage.duration，各cue/interval随后派生。取消只停止未来cue/出生；自由粒子自然收尾，附着身体/源可消费sample.effectiveTime或自己的时钟。sequence.tail不会证明所有粒子都已结束，作者应按life选择足够观察区间。beam程序条带、slash艺术尾段与真实历史trail不同。源、目标、网络和绘制层均须真实声明才能probe；部件不从像素猜身份，也不检测任意碰撞。

### evidence

slash/smear/onSwing为原helper直接调用；beam使用已有path/stroke的连续像素扫描，复用arcane-beam的横截面/脉冲/丝线，chargeRing/orb/infall提炼spell-charge。保留Sprite Fusion/Hugo Duprez/MIT署名。阶段偏移来源为core/chain/shiftKeys/shiftHits及moves；新纯时间表不复制旧stateful update的越界。独立原创与未测范围另见里程碑评估。

## core/combat

### overview

`combat`将游戏提供的命中事实连接到可替换的身体着色、冲击、像素文字和次级出生。普通JS控制目标、形状、画法和前后层；不计算伤害/暴击概率或碰撞。参考`lab/hit-relay`、配方`combat-feedback`。导入`{combat,body,surface,particle}`来自authoring入口。

### contract

- `combat.hits({id,events,resolve?}) → HitSequence`。events为`{id,target,time,position?,direction?,value?,critical?,kind?,data?}[]`；id/target稳定非空字符串或整数，time为非负**播放秒**。value为有限数或字符串；critical为游戏提供的boolean；kind为作者自定字符串（默认hit），不会强制枚举防御类型。方向为非零effect向量（默认[1,0]，正规化）。resolve(event)纯函数返回`{position,velocity?,direction?}`，用于在event.time查询真实挂点；没有resolve时直接用event.position。resolve提供位置，event.direction优先。targetVelocity默认[0,0]，不会自动加入粒子速度。
- 结果`{kind:'HitSequence',id,events}`按time/id排序，深度冻结并复制输入；每条保留sequence、target、time、position、direction、targetVelocity、value、critical、kind、data。重复id拒绝。没有draw回调、事件消费游标或帧率依赖。
- `combat.sample(hits,t,{target?,duration=.36}?) → HitState[]`返回`[time,time+duration)`内所有命中，含age/age01；可乱序查询，重叠命中不合并。target可筛目标。时序艺术策略由作者决定。
- `combat.births(hits,{id=hits.id,count=1,life=.25,delay=0,select=()=>true}?) → Birth[]`。count/life可为`hit=>number`；select筛事实。ID为`id/encodeURIComponent(hit.id)/ordinal`，born=time+delay；position固定为命中时真实位置，`birth.hit`保留完整事实。delay不重新采样目标。可直接接particle.emitter，跨查询不重发。多个emitter用自己的id或在各自组内共享相同出生。
- `combat.tint(baseColor,hitStates,{ramp=['#6a101c','#d42a30','#ff9a8a'],whiteSeconds=.058,duration=.36,strength=.65,rim=false}?) → Color32`。最新命中控制亮度映射/短白闪/冷却；ramp至少三色，从暗到亮。rim是调用者选出的轮廓像素标志，不扫描/强迫角色结构。用在surface.draw的shade内，或任何自己的shader；不需要换掉原绘制器。传入筛选后的states即可决定block是否变色。
- `combat.text(p,text,{position=[0,0],font='big',scale=1,scaleY=scale,opacity=1,flash=0,slant=0,fill=['#d42a2e','#ff5a4a','#ff9a86'],edge='#ffd8cc',under='#8c1420',outline='#1a0508',shadow='#1a0508'}?)`。position为底部中心；fill从下到上。直接复用ui/_lib.spell/drawWord的描边/高光/斜体/阴影。font为big（7行）或mini（5行）；支持拉丁字母大小写、0–9、空格与`+-!?.,:/%x*'()<>=#`（mini另支持_）。不支持的字形返回CAPABILITY_UNSUPPORTED及具体字符；可替换绘制/纹理，不静默丢字。
- `combat.numbers({id,hits,life=1.05,select=()=>true,text=e=>String(e.value??''),offset=[0,-8],velocity=e=>[34*e.direction[0],-175],acceleration=[0,900],drag=2,bounce=.36,size=1,material={},style={}}) → Emitter`。life/text/offset/velocity/size支持hit回调。offset是effect像素；速度px/s，加速度px/s²，drag为现有分轴阻力。沿用damage-number的弹出、抛物线、反弹、落地挤压、最后20%淡出及上抬；使用contact.trace的解析运动，接地高度为**每条文字自身出生位置**，不是世界地面。文字脱离目标，birth.hit/data.hit保存来源；全部particle.sample/observe/track接口正常可用。size乘默认弹出包络；material可覆盖scale/scaleY/opacity等。critical不强制变大、不自动加CRIT标签。style保存给drawNumbers，可为`particleState=>textStyle`。
- `combat.drawNumbers(p,emitter,t,{draw?,style=emitter.numberStyle}?)`。默认用真实particle状态画text；draw(p,state)完全替换文字画法，可改为符号/自有字体/纹理。返回实际粒子状态，可直接使用普通particle.draw。
- `combat.impact(p,hitState,{radius=12,duration=.22,spikes=8,colors=['#d42a30','#ff9a8a','#fff'],glow=.5,rotation=atan2(direction.y,direction.x)}?)`。独立的短星芒/环部件，源自hit-flash；colors为暗/亮/热三色，glow=0关闭光。不会自动绘制角色/文字/粒子，也不会替作者决定暴击形状。hitState可从sample获得；duration与sample窗口由作者共同选择。

### example

```js
const records = combat.hits({id:'fight',events:[
  {id:'cut-a',target:'enemy',time:clock.at(.8),value:27,direction:[1,-.2]},
  {id:'cut-b',target:'enemy',time:clock.at(1.1),value:128,critical:true,direction:[1,0]}
],resolve:e=>body.anchor(enemy,{name:'chest'}).sample(e.time)});
const labels = combat.numbers({id:'labels',hits:records,size:e=>e.critical?.8:.55,
  text:e=>String(e.value),velocity:e=>[e.direction[0]*24,-120]});
// draw: arbitrary material shading, keeping current moving body coordinates
const response = combat.sample(records,t,{target:'enemy'});
surface.draw(p,skin,t,{shade:s=>combat.tint(myColor(s),response)});
for(const hit of combat.sample(records,t,{duration:.22})) combat.impact(p,hit,{glow:0});
combat.drawNumbers(p,labels,t,{style:s=>({fill:s.data.hit.critical?gold:red})});
// observe: real visible bodies and labels, not synthetic debug particles
return {bodies:[surface.observe(skin,t)],particles:[particle.observe(labels,t)]};
```

### pitfalls

位置在命中时刻固定，身体着色在当前姿态求值，二者不同是有意设计；跟随/脱离由作者选择。action局部秒先经clock.at/retime映射，不能把局部时钟当播放秒。birth.hit可用probe.births读取，实时text在particle data。文字默认弹跳是可替换起点，不是伤害文字必须落地的规则。场景、伤害数值、暴击/防御事实和目标存活由调用方提供；多个命中共享事实但不强制同一美学。

### evidence

直接复用ui/_lib的文字栅格，保留Sprite Fusion/Hugo Duprez/MIT来源；motion/contact与particle沿用已有公开实现。hit-relay展示移动目标上的重复命中/critical/block与同源出生。技术与独立创作证据以里程碑评估归档为准；没有对照时不宣称净节时、艺术优越或能力飞跃。

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

## core/surface

### overview

`import {surface,mask,body,action,image,propagation,particle,material,curve} from '../../../src/authoring/index.js'`。声明自由身体/部件的**局部材质像素**，让结霜、裂纹、消融、出生位置与真实点速度共用它。`surface.create`随普通Body，`surface.bone`随实际IK骨段；造型、颜色与层次保持普通JS。例子`lab/frost-release`，配方`surface-fracture`。不是自动识别任意人物轮廓或完整网格蒙皮。

### contract

- `surface.create({id,mask,body}) → Surface`。mask必须是非effect空间的二值Mask，例如`space:'skin'`，其origin/w/h为局部材质格；占用像素≤16384。body为effect空间Body（例如body.create或hero.body）。Surface公开`mask/body/id/space`，资源视为不可变。surface.body是该表面的真实仿射Body，可接body.anchor/orbit等；身份`surface/{id}`，格范围为声明bounds，不能当作像素轮廓证明。
- `surface.bone({id,mask,action,from,to,length,widthScale=1}) → Surface`。from/to是两个不同的公开IK关节名，length>0为材质x轴的标准长度，局部`[0,0]`对应from、`[length,0]`对应to，y轴沿骨段垂线；widthScale>0调整局部横向比例。映射包括角色原source、连续x/y、scale/flip及保持姿态；肢体在保持帧之间相对骨架局部速度0，跳变有来源标记。遮罩可自由画服装、甲片、四肢、翼或其它部件，不强制内置人物。多个部分由作者明确前后绘制顺序，没有任意网格/3D遮挡承诺。
- `surface.features(surface) → {space,pixels,upper,sides,outline,top,rows}`。直接复用status/_lib.shape。pixels条目`{id,index,position,normal}`，位置是**材质格中心**，index为行主序；normal为四邻居差分归一化，内部为[0,0]。upper是`[x,y][]`点列表（不是带position的对象），每点为上方为空的实像素中心，可用`for(const [x,y] of features.upper)`；sides为`{position:[x,y],direction:-1|1}[]`；outline为`{position:[x,y],normal:[nx,ny]}[]`，是四邻接外部空格中心及八邻域加权外法线（可在原格外）。top按列给`[x,y]|null`首像素中心，rows按行给`{y,left,right}`或null，left/right是材质格边界、right不含。特征扫描不推断眼睛/语义骨骼。
- `surface.sample(surface,playback,{mask?,side='right'}) → BodyState`、`surface.observe(surface,playback,{mask?}) → BodyObservation`。mask可为同格同space的子集，如image.dissolve.keepMask；不能新增基础遮罩外像素。data.surface包含id/materialSpace/grid/pixels/remaining/parentBody，data.parent保留父动作/主体声明状态。bounds是材质格矩形的实际变换，anchors.origin是真实局部原点。把observe放到bodies数组，用probe view:bodies fields:['data','matrix','velocity','bounds']；不是新粒子或从画面反推状态。draw/observe应明确传**同一个keepMask**。
- `surface.project(surface,playback,{position,normal=[0,0],side='right'}) → {position,velocity,normal,status,opacity,space:'effect',derivative}`。输入材质位置/法线；位置和点速度由矩阵/矩阵导数计算，法线用逆转置并归一化（非零法线遇奇异映射拒绝）。点可以在遮罩外；不会自动夹到轮廓。没有按输出FPS差分。
- `surface.draw(painter,surface,playback,{mask?,color='#ffffff',shade?}) → BodyState`。通过body.draw/Painter逆采样填满变换后的像素单元，父画笔不变。shade每个被触及材质格每次绘制只调用一次，接收`{id,index,position,localNormal,effectPosition,velocity,normal,time,body}`；返回Color32/hex、`{color,alpha=1,light?,lightStrength=1}`或null。alpha为0..1，lightStrength非负；材质颜色/轮廓逻辑自由替换。position为材质坐标，effectPosition为映射位置，不能混用。该函数只填被声明的mask，不自动执行霜层/消融。
- `surface.crackField({id,surface,network,front,spreadPxPerSecond=12,delay=0}) → {distance,crackAt,removeAt}`。network为与mask同材质space的非空PropagationNetwork；front为clamped `scene.seconds → pixels`单调ScalarCurve，须覆盖[0,network.maxDistancePx]。沿投影后最近线段求横向距离，但到达时钟保留投影前继承的设计距离；同距离取更早到达。distance为px ScalarField，crackAt/removeAt为静态首次ArrivalField，removeAt=crackAt+delay+distance/spreadPxPerSecond。delay≥0、spread>0；最多800万“占用格×线段”工作量，字段grid绑定原mask revision。**这是材质空间最近裂纹及横向侵蚀，不是跨孔洞的测地传播/真实断裂求解**，遮罩只裁显示，独立岛仍可能被相邻裂段影响。不同因果场可直接用其它ArrivalField替换。
- `surface.births({id,surface,arrival,density=1,seed=1,maxEvents=10000,clock?,edge='after'}) → Birth[]`。沿用image.dissolveEvents的首次到达/稳定像素ID与密度采样；arrival必须为同格静态首次ArrivalField。默认到达为播放秒；提供ActionClock时arrival为局部动作秒，由clock.at转换为播放秒，然后在**该播放时刻**映射材料位置/法线/点速度。返回position/normal已经是effect空间，sourcePixel保留材质index，`surface={id,materialPixel,materialPosition,materialBorn,pointVelocity,derivative}`保留来源。到达发生在非alive/opacity0主体上拒绝，不默默补事件。事件表不受draw调用次数、跳转或输出FPS影响。
- `surface.inheritVelocity(factor=1) → initial.velocityOffset回调`。必须消费surface.births产生的birth，在**effect轴**返回当时点速度×有限factor。配合particle.emitter.initial.velocityOffset，发射方向/初始冲量经原source变换及继承后，再加这个effect向量一次。不要再给这些已映射births应用surface.body transform。可只用births而自由设计其它响应，继承不是强制艺术选择。
- `material.iceColor(color,{colors}) → Color32`直接复用ice/_lib.iceOf的亮度到冰色带映射（dark→bright，输入非空色带重采样为8阶），用于自由表面着色；不强制结霜造型。

### example

```js
const m=mask.make({id:'sleeve',space:'sleeve',origin:[0,-3],w:12,h:6,
  test:(x,y)=>x>1&&x<11&&Math.abs(y)<2.5});
const sleeve=surface.bone({id:'sleeve',mask:m,action:hero,
  from:'elbowN',to:'handN',length:12});
const cracks=propagation.network({id:'vein',space:'sleeve',branches:[
  {id:'root',points:[[1,0],[6,-1],[11,0]]}]});
const f=surface.crackField({id:'break',surface:sleeve,network:cracks,
  front:curve.scalar({input:'scene.seconds',outputUnit:'pixels',points:[[1.4,0],[2.2,cracks.maxDistancePx]]}),
  delay:.15,spreadPxPerSecond:9});
const chips=particle.emitter({id:'chips',births:surface.births({id:'chips',surface:sleeve,arrival:f.removeAt}),
  initial:{life:.6,velocity:[0,-25],velocityOffset:surface.inheritVelocity(.5)},motion:{acceleration:[0,90]}});
// draw(p,t):
const cut=image.dissolve({mask:m,field:f.removeAt,threshold:t});
surface.draw(p,sleeve,t,{mask:cut.keepMask,shade:s=>
  f.distance.sample(...s.position)<.6&&t>=f.crackAt.sample(...s.position)?'#ffffff':'#81cfe0'});
particle.draw(p,chips,t,{draw:(q,s)=>q.px(...s.position,0xffffffff)});
// observe(t): return {bodies:[surface.observe(sleeve,t,{mask:cut.keepMask})],particles:[particle.observe(chips,t)]};
```

### provenance

直接调用status/_lib.shape的身体/顶面/侧面/外法线扫描、ice/_lib.iceOf、body/Painter逆采样、action实际IK、propagation距离与前锋逆解、image.dissolve/dissolveEvents、particle运动/观察；原Sprite Fusion/Hugo Duprez与Hollow Crown MIT署名保留。原frozen霜蕨、burn-away的前锋扫过/像素离开及pixel-dissolve稳定分块排序提供机制依据，不复制整预设。参考平台骨骼动画求值/矩阵附着/出生继承重新核对；本能力不导入其人类编辑器或任意Spine资产。

## core/action

### overview

`import {action} from '../../../src/authoring/index.js'`。角色可见姿态、IK挂点和事件排期共享一个纯动作时钟。支持随机跳转，不需要更新回调或自行按输出FPS求手部速度。`action.draw`默认复用原库角色，也可用同一份`state.data.joints/pose/clock`自由画原创角色；并非固定角色或作品DSL。例子`lab/action-relay`，配方`action-attachment`。

### contract

- `action.clock({from=0,to,rate=1,holds=[]}) → ActionClock`。from/to是有限**局部动作秒**，to>from；from可负以容纳预备动作，rate>0是局部秒/播放秒。holds为`[{at:局部秒,duration:播放秒}]`，最多256项，at在[from,to]内，同一at只允许一项。输出`duration`包含全部停顿，没有隐式循环。
- `clock.sample(playback,{side='right'}) → {playback,local,localRate,frozen,phase,boundary,poseSide}`。playback是lab的非负播放秒；范围外查询夹持局部时间，速度0。phase为pending/active/ended，frozen仅指显式停顿。进入停顿的右侧、离开停顿的左侧速度0，另一侧恢复rate；`side:'error'`拒绝边界。完全处于停顿时，姿态固定为该局部时刻的右侧值。
- `clock.at(local,{edge='after'}) → playback`。将局部事件映射为播放时刻；停顿点可选before或after，缺省在停顿结束后发射。事件必须处于[from,to]。
- `action.retime(clock,births,{edge='after',endEdge='after'}) → Birth[]`。转换born，保留ID和附加属性，记录actionBorn。**life保留为播放秒，不自动拉伸**；如需局部结束时间，提供end，转换end并计算正life，附加actionEnd。最多10000项。输出可直接送入particle.emitter或schedule.alive。
- `action.create({id,clock,poses,source=motion.source(),scale=1,flipX=false,bounds=null,end=null}) → Action`。poses为严格递增`[[局部秒,pose,arrival?],…]`，1..512键，arrival=smooth/line/in/out/snap，写在到达键上。pose用原库字段（fx/fy近手，bx/by远手，ffx/ffy/fbx/fby脚、lean/crouch/yaw、x/y整体位移及weapon等），值是有限数、string或boolean。缺省用STAND，末键后保持。可从参考效果的act.poses读取；不会自动执行其draw/create/targets/hits。
- **保持绘制语义**：复用core/act.lerpPose，肢体插值以每段起点开始的12Hz整步保持，x/y在非snap段上按同一缓动连续插值。显式snap保持上一姿态直至到达键。最后键和姿态步边界可选left/right；`side:'error'`拒绝实际姿态跳变。边界使用浮点ULP判断，修正旧poseAt的1e-6提前换姿偏置。没有输出FPS差分，也不把跳变当作有限速度。
- source是**局部动作秒**下的effect空间SourceTrajectory，随clock冻结；x/y先乘正的常量scale并flip，再由source旋转/平移。scale只支持正标量，flipX为静态boolean；yaw/face的离散变化可用pose表达。bounds是以脚为原点的局部声明矩形，不自动包含位移/武器；end是**播放秒**，默认null（角色继续保持末姿态）。`action.body`可组合body/orbit；其来源和anchors应由action管理。
- `action.sample(action,playback,{side='right'})`返回BodyState。`data={clock,pose,joints,poseJump}`：joints是core/rig.skeleton的实际IK结果，局部[x,y,z]，x右/y下/z向观察者，不是请求的手部目标。内置20个同名body anchors为实际effect位置和速度，包含根源的平移/旋转、连续x/y、scale/flip和clock倍率。`poseJump`列出离散改变字段，肢体在保持帧之间局部速度0；导数方法action-clock-chain-rule可追溯原源与时钟。数据是声明状态，不证明像素轮廓或遮挡。
- `action.anchor(action,{joint='handN',offset=[0,0],toward?,rotation=0}) → SourceTrajectory`。joint可选pelvis/waist/chest/neck/head/crown、shoulderN/elbowN/handN、shoulderF/elbowF/handF、hipN/kneeN/ankleN/toeN、hipF/kneeF/ankleF/toeF。offset为**角色局部x/y轴**，不是沿骨轴；toward可指定另一个关节，使发射朝joint→toward的画面投影方向，再加rotation弧度；无toward则沿角色+x轴（flip后朝左）。零投影方向明确报错。方向在肢体保持间只跟根旋转，角速度不伪造跳变的旋转速度。返回实际位置/速度/方向及held-rig-anchor来源，可直接作为particle.emitter.transform；inheritVelocity只应用一次。
- `action.draw(painter,action,playback,{draw?}) → BodyState`。自定义`draw(localPainter,state)`共享姿态、局部关节和动作时间；内部复用body.draw，绘图不移动父Painter。默认用core/rig.posed的原像素画角色（每像素填充单元，保留原缓存/量化行为）。角色材质/前后层次可以自定义；不自动判定其它特效的遮挡。
- `action.observe(action,playback) → BodyObservation`，放到`observe()`的bodies数组；挂点源用motion.observeSource放sources。`probe view:'bodies',fields:['data','anchors','matrix','velocity']`可读取冻结时钟/姿态和骨架，`view:'sources'`可读发射源；不造见证粒子。旧run不自动补新状态。

角色和附着源在停顿期间冻结；**脱离粒子在播放秒上继续运动**，这是明确的局部动作停顿策略。需要整个世界停顿时，可自行对完整纯组合统一使用clock.local（包括其source、births和绘制），不能把局部秒与播放秒混传。本接口不自动执行完整legacy act的弹簧目标、hit shake、尘土、残影、onBody像素映射、外部Spine资产或连续皮肤表面。

同一动作中，`poses/source`和`clock.at`输入用局部动作秒；`action.draw/sample/anchor.sample`、retime结果和particle.draw/sample用播放秒。例如from=-.4、hold(.85,.22)，局部释放.85对应播放1.47。不要把播放1.47再次传进clock.at。

**镜像与刚性发射方向**：anchor将角色翻转体现在位置和发射朝向上，particle再按该朝向刚性旋转initial.velocity；它不会推断“只翻世界x，世界y保持向上”的意图。若无toward/额外旋转，朝左源朝向为±π（同一方向），把局部`[175,-24]`变成世界`[-175,+24]`。要保持世界向上-24，可令`sign=facingLeft?-1:1`，局部速度用`[175,-24*sign]`，世界加速度仍写`[0,70]`。任意toward角度则自行将期望世界速度逆旋转到源局部轴；先probe出生的source.rotation/velocity再调整。该提示来自逆潮铸雷原作者的真实镜像修稿，不是新速度算子。

### example

```js
import {action,particle,motion,material} from '../../../src/authoring/index.js';
const clock=action.clock({from:-.3,to:1.8,holds:[{at:.7,duration:.15}]});
const hero=action.create({id:'hero',clock,scale:1.5,end:2.3,
  poses:[[-.3,{fx:5,fy:-26}],[.7,{x:12,fx:18,fy:-25},'out'],[1.8,{}]]});
const hand=action.anchor(hero,{joint:'handN',toward:'elbowN',rotation:Math.PI});
const births=action.retime(clock,[{id:'bolt',born:.7,life:.6}]);
const bolts=particle.emitter({id:'bolts',births,transform:hand,inheritVelocity:.3,
  initial:{velocity:[100,0]}});
// draw(p,t,o):
action.draw(p,hero,t); // 或{draw:(local,state)=>自定义关节几何}
particle.draw(p,bolts,t,{draw:(q,s)=>material.ember(q,s,{colors:o.palette,size:2})});
// observe(t): return {bodies:[action.observe(hero,t)],
//   sources:[motion.observeSource(hand,t,{id:'hand'})],particles:[particle.observe(bolts,t)]};
```

### limits

这是原骨架的纯动作适配与公共组合机制，不是完整游戏动作系统或骨骼资产导入器。20个局部关节可用于自由角色绘制；离散姿态的肢体速度在保持间为0，发射冲量应由作者明确设计。没有美感、性能净收益或生产时间缩短的自动判定。具体两基石提炼路径见本波研究记录，Hollow Crown的MIT署名保留。

## core/body

### overview

`import {body,motion,curve} from '../../../src/authoring/index.js'`。普通程序绘制主体可共享源轨迹、缩放、枢轴、挂点与声明状态；不用迁为粒子或另造见证粒子。造型/材质仍是`draw(localPainter,state)`。与`core/orbit`组合让主体、远近环和附着发射点读取同一位置/扩缩，参考`lab/orrery-relay`。

### contract

- `body.create({id,source=motion.source(),scale=1,pivot=[0,0],flipX=false,opacity=1,depth=0,born=0,end=null,bounds=null,anchors={},data=null,side='right'}) → Body`。id非空字符串。source为effect空间SourceTrajectory，复用motion.source/pathSource/sampledSource或body/orbit附着源。scale为非负number/秒信号，或[x,y]两通道；opacity为[0,1]number/秒信号；depth为有限number/秒信号，越大越后画。信号沿用local.seconds或scene.seconds的**传入效果时间**，不自动减born。pivot为本地像素枢轴，映到source.position。flipX是静态布尔镜像，不推测跳变镜像速度。
- born≥0，end为大于born的有限秒或null；生命区间[born,end)。`bounds`是本地有限[x,y,width,height]、宽高非负，或null。只声明用于查询的几何范围，**不自动裁切、捕捉轮廓或证明像素归属**；完整资产越界仍用validate。anchors是至多64个`name:[x,y]`，各轴可为number/秒信号。data是有限普通JSON或`(time,state)=>JSON`纯函数，最多16层，不支持循环/函数/undefined/类实例。这里的data可以携带艺术阶段、材质参数等声明值。
- `body.sample(subject,time,{side?,data=true}) → BodyState`：`{id,space:'effect',time,born,end,status,position,velocity,rotation,angularVelocity,scale,scaleVelocity,flipX,opacity,depth,matrix,matrixVelocity,localBounds,bounds,anchors,data,derivative}`。status为pending/alive/expired。matrix为Canvas次序[a,b,c,d,tx,ty]，从本地到effect；matrixVelocity为其每秒导数。bounds若声明则含`{corners:[[x,y]×4],rect:[x,y,w,h]}`；anchors各为`{position,velocity}`。位置/速度/挂点按源、旋转、缩放和本地挂点运动的链式法则共同求值；derivative保留原源的解析/显式差分来源及通道折点。仅被声明的速度可信于其来源，不把任意自写源升级成物理解。
- `body.draw(painter,subject,time,{draw(localPainter,state)}) → BodyState`。仅alive、opacity>0、两轴scale>0时绘制。通过已有Painter正逆映射组合几何变换和fade，填充形状保持连续；返回状态可用于当帧其他艺术绘制。异常不会修改传入Painter的放置/透明度。localPainter内place/reset明确拒绝，应改共同主体状态；直接屏幕put/add或原缓冲写入仍是原屏幕语义，不自动变成本地主体几何。
- body.draw是**几何坐标变换**。Painter.dot/px及1px line保留输出像素笔触语义；大幅放大细节时用填充形状/beam/strip，或texture.draw进行最近邻位图采样。它不是离屏整图缩放。rect使用Painter的逆映射填充分支，避免原整数点快路在放大后漏点。零缩放可被采样/观察，绘制跳过；非零但数值不可逆的矩阵明确报错。width/光等如何随造型变化仍由艺术代码选择。
- `body.anchor(subject,{name?,point=[0,0],rotation=0}) → SourceTrajectory`。name选已声明挂点；不传name则point两轴可为秒信号。返回真实挂点位置/速度，直接作为particle.emitter的transform，`inheritVelocity`复用现有出生点继承。其刚性发射方向是主体source.rotation+显式rotation（number/秒信号），不自动推导椭圆切向朝向、不继承非均匀比例/镜像到发射域。零位置出生最直接；其他local birth偏移仍遵守既有刚性SourceTrajectory规则。挂点轨迹在主体生命外仍可查询；用出生表明确控制发射生命。几何挂点查询不执行body.create的自定义data回调，避免data又消费命中记录时形成初始化循环；完整sample/observe仍正常求data，显式sample的data:false仅跳过该载荷、返回data:null。
- `body.drawAll(painter,[{body,draw},...],time) → BodyState[]`。最多64个不同body ID，按depth升序、ID字典序稳定画；这只是声明的平面层次，不是任意几何深度缓冲。轨环的far→主体→near仍明确分三段画。
- `body.observe(subject,time)`返回`{kind:'BodyObservation',...BodyState}`。模块`observe(t,o)`可返回`{bodies:[body.observe(subject,t)]}`，也可与particles/sources/contacts/trails组合。每run最多64主体，ID/space/born/end/localBounds稳定，顺序会按ID标准化；变化放在state/data。`fx_probe {run,view:'bodies',layers:['id'],at:{times:[...]},fields:[...],sampling:'saved'|'replay',layout?:{...}}`读取保存状态或显式冻结重求。fields可查上述变换、matrix、bounds、anchors、data、derivative；不能用particles选择主体。原尺寸分页是声明边框/挂点的示意，原作品像素另看color/combined。旧run未声明主体时明确CAPABILITY_UNSUPPORTED，不从像素补造。

### example

```js
import {body,motion,curve,particle,schedule} from '../../../src/authoring/index.js';
const scale=curve.scalar({points:[[0,1],[1,1.6],[2,1]],interpolation:'smooth'});
const shell=body.create({id:'shell',source:motion.source({position:[0,-30]}),
  scale,bounds:[-16,-14,32,28],anchors:{nozzle:[12,0]},end:2});
const sparks=particle.emitter({id:'chips',seed:7,
  births:schedule.burst({id:'release',at:.7,count:6}),
  transform:body.anchor(shell,{name:'nozzle'}),inheritVelocity:1,
  initial:{life:.5,velocity:[5,-12]}});
// draw: body.draw(p,shell,t,{draw:(q,s)=>{q.circle(0,0,12,Color32);}});
// observe: return {bodies:[body.observe(shell,t)],particles:[particle.observe(sparks,t)]};
```

### pitfalls

保持source/curve/data纯函数；共享状态不等于工具证明你的绘制确实消费了它。bounds为声明几何，不会自动围住发光或大于声明的实际形状。observe里保持ID/生命/本地bounds稳定，不要按可见性增删主体。side:'error'会拒绝跳变/折点上的无唯一导数；显式left/right是艺术时间侧选择。完整角色act、身体表面、任意遮挡、碰撞和引擎适配仍是其他能力。

### provenance

复用`core/Painter`正逆空间采样、rect一般填充分支，及`authoring/motion.source/pathSource`、`curve`导数；原秒信号求值器提为共享signals模块。`core/rig`的局部骨架/挂点/投影及深度语义用于核对，但此处不复制其3D骨骼/逐像素深度缓冲。两基石具体实现与差异见2026-11-07-body-orbit研究；MIT/Sprite Fusion署名保留在原库/适配模块。

## core/orbit

### overview

`import {orbit} from '../../../src/authoring/index.js'`。从arcane-orb的共同中心、圆压扁、画面滚转和近远半环提炼；同一body用于可见主体、环线和环上发射点。不是黑洞引力透镜或任意3D遮挡器。

### contract

- `orbit.create({id,body,radius,aspect=.3,roll=0,center=[0,0]}) → ProjectedOrbit`。id非空字符串，body为已有Body。radius≥0、aspect（有符号压扁系数）、roll弧度和center两轴均为number/秒信号。先取[cos(angle)×radius,sin(angle)×radius×aspect]、按roll转动、加本地center，再由body矩阵投影到effect。设计角度/半径与画面距离分开。
- `orbit.sample(orbit,time,{angle=0,side?}) → {orbit,body,position,velocity,angle,relativeDepth,depth,near,space:'effect',opacity,status,tangent?}`。angle为number/秒信号，绝对值≤1e9弧度，超限需作者显式减整圈；保留未wrap angle字段。velocity计入角度、radius、aspect、roll、center、body源与缩放的共同变化。tangent是画面上对**角度增加**的几何单位切线，退化时缺省，不是粒子运行速度。relativeDepth=sin(angle)×radius，depth=body.depth+relativeDepth，是声明的平面前后约定，不从2D缩放猜3D深度比例。near为wrap角处于(0,π)；0、π接缝统一归far、relativeDepth精确为0。
- `orbit.arcs(orbit,time,{fromAngle=0,toAngle=2π,spacingPx=1,side='all'|'near'|'far'}) → Arc[]`。角区间非递减、最多一圈，端点幅度≤1e9；在每个π边界精确断开，返回`{id,near,fromAngle,toAngle,samples:[sample...]}`，不跨接空半环。按当前半径/aspect与body矩阵伸长上界采样，连接段长度≤spacingPx（浮点误差除外），不是等屏幕弧长排期；最多4096点/次，超预算拒绝。radius0、主体不活跃/透明/任一轴零缩放返回空。近远端点可共享，不作通用多环交叉排序。
- `orbit.draw(painter,orbit,time,{side='all',fromAngle=0,toAngle=2π,spacingPx=1,width=1,color='#fff',alpha=1,light=0})`。通过已有连续strip栅格器画各半环，返回每段栅格结果。width/color/alpha/light可为number/Color32/hex或`q=>value`：q含采样插值的position/angle/depth、near、across(-1..1)。width非负输出像素、alpha[0,1]，light为非负同色加法强度；最终覆盖乘body.opacity。近远可分宽度/材质。输入Painter是原effect画笔，不要在body.draw的localPainter里再次画同一effect-space环。
- 绘制顺序：`orbit.draw(p,ring,t,{side:'far',...})` → `body.draw(p,shell,t,{draw:...})` → `orbit.draw(p,ring,t,{side:'near',...})`。透明主体、环中心偏移、非球体、跨环交点等效果仍需作者明确层次/专用shader，工具不自动判遮挡正确。
- `orbit.source(orbit,{angle=0,rotation=0}) → SourceTrajectory`。直接采样同一投影点及其速度，用于particle.emitter transform/继承或motion.observeSource。angle/rotation均number/秒信号；发射方向为body源rotation+显式rotation，独立于椭圆切向，不编造切线角速度。derivative保留body、通道折点、angle及`projection:{orbit,body,angle,near,relativeDepth}`；粒子的出生source可公开查到这一来源。放大/收缩中的出生点速度不用按输出FPS差分。

### example

```js
import {body,orbit,motion,curve,particle,schedule} from '../../../src/authoring/index.js';
const shell=body.create({id:'core',source:motion.source({position:[0,-30]}),
  scale:curve.scalar({points:[[0,1],[1,1.5],[2,1]]}),bounds:[-12,-12,24,24]});
const ring=orbit.create({id:'rim',body:shell,radius:25,aspect:.3,roll:-.2});
const beadAngle=curve.scalar({points:[[0,0],[2,Math.PI*4]],outputUnit:'radians'});
const chips=particle.emitter({id:'chips',births:schedule.burst({id:'pop',at:1,count:5}),
  transform:orbit.source(ring,{angle:beadAngle}),inheritVelocity:1,
  initial:{life:.5,velocity:[0,-8]}});
// draw far, then shell, then near; draw your bead at orbit.sample(ring,t,{angle:beadAngle}).position.
```

### pitfalls

radius/scale控制几何，alpha控制覆盖，光强独立。短峰值光环应以秒声明，并检查保存帧，不让常亮描边冒充巅峰锚点。压扁后近远由原角侧决定，roll/镜像不会自动变成任意3D姿态。光环与主体共中心也需要实际原图判断比例、遮挡和节奏。

### provenance

直接提炼`arcane/arcane-orb.js:ring`的pos/near、`holy/halo.js`近厚远薄与亮点，复用body/motion/curve和path/trail共享stroke。保留Sprite Fusion energy orb / MIT / Copyright (c) 2026 Hugo Duprez归属；未复制完整预设或black-hole的引力透镜shader。参考平台局部/世界矩阵、骨骼附着和发射速度继承作机制交叉核对，具体构建身份见当轮研究。

## core/propagation

### overview

`import {propagation,curve,particle,schedule} from '../../../src/authoring/index.js'`。把设计空间的分叉路径、投影后的画面位置、距离取样、前锋到达与次级响应分开。适用于裂纹、根脉、线路唤醒、枝状生长等；没有固定作品DSL或强制材质。原尺寸窗口看连续前锋，实际响应状态用`particle.observe`和`probe view:particles`，不靠调试点假装可观测。

### contract

- `propagation.network({id,branches,space='effect',project=p=>p}) → PropagationNetwork`。branches为`{id,points:[[x,y],...],parentId?,attachPx=0}`。points是**投影前设计像素**，内部复用path.polyline清理重复点并算弧长。根从距离0开始；子枝起始距离=父枝起始距离+attachPx，attachPx是父枝**局部**弧长。也可用`attachVertex`选父枝path.polyline清理重复点后的顶点序号（从0起），由工具求attachPx；与attachPx互斥，根不能用attachVertex。子枝第一个点必须与父枝该位置吻合（1e-6像素容差），不能用碰巧重合的坐标猜parent；拒绝缺父、重复ID、环、越界附着。支持森林和分叉树，不支持合并图/循环传播。输入顺序不影响输出，按JSON编码的branch ID字典序排列。最多10000枝、合计10000输入点。
- `project([x,y],branchId)`只在创建时作用于清理后的顶点，输出空间由space声明（用于粒子通常为effect）。各段在投影后顶点间线性插值，**不会重算传播距离**。适合仿射/压扁投影；非线性映射应先细分设计路径，并自行判断近似误差。折线返回`branches[].{id,parentId,attachPx,startPx,endPx,path,projected}`，path保留设计空间；网络有`id,space,maxDistancePx`。可读取、不要修改返回结构。
- `propagation.fractures({id,seed=1,origin=[0,0],arms=7,inside,stepPx=[1.6,2.6],steps=18,fork=.16,angle?,spread=2π,space='effect',project?}) → PropagationNetwork`。提取ice库的成熟随机游走，保留随机调用顺序、每步±.55弧度扰动、逐步分叉和最多两层子枝；根ID为序号字符串，子ID记录父枝/分叉步，新增后代不重排已有枝ID。arms≤100、steps≤100为非负整数，steps是**步数**；stepPx为正的[min,max]，fork为[0,1]，spread为[0,2π]弧度。seed为uint32；为兼容旧Rng，0映射到1。inside(x,y)必须返回boolean，作用于设计空间候选终点；越界步丢弃，不裁切整段穿越凹边界。生成过程累计10000点预算（含无效短枝的起点），超预算明确报错。inside全部拒绝、arms/steps为0均可得到空网络。该封装非物理破裂求解器。
- `propagation.sites(network,{spacingPx=10,offsetPx=0,minDistancePx=0,maxDistancePx=network.maxDistancePx,minGapPx=0,limit=10000,select=()=>true}) → Site[]`。每枝局部固定距离格点`offsetPx+k*spacingPx,k≥0`，边界容差为设计空间1e-9像素，包含恰好命中的终点，不为凑终点改间距。offsetPx非负；min/maxDistancePx按**继承的根距离**筛选。site为`{id,branchId,parentId,index,localDistancePx,distancePx,position,sourcePosition,space,tangent?,normal?}`：position在输出空间，sourcePosition在设计空间；切线/法线来自画面当前线段，投影塌成点时缺省。折点取出段，终点取入段。ID由网络ID、枝ID、局部距离组成，不依赖返回序号或材质；几何/格点编辑不保证所有旧点仍存在。
- sites先按`distancePx`、再按site ID字典序排序，用屏幕`minGapPx`做确定性贪心筛选，再截limit。默认0不筛间距，可能有共根/共分叉点；正值保证被接受点两两间距≥minGapPx，并非全局最优或Poisson采样。select是纯boolean谓词，在间距/limit前运行。最多10000个候选（筛选前），limit不绕过候选预算；特别小的间距/数值不可表示的格点会明确失败。改变投影会影响画面间距选择，但同一距离的ID/到达不变。
- 前锋用现有`curve.scalar({input:'scene.seconds',outputUnit:'pixels',points,interpolation:'linear'|'smooth'|'hold',extrapolation:'clamp'})`。时间/距离均非负，outward要求非递减，inward要求非递增，允许平台。不是任意函数/ScalarSignal的通用反解；非单调生长与退场应拆为两条前锋。曲线首结点是开始时刻；首值之外已覆盖侧的点按首时刻到达，不从clamp外推到更早时间。末值仍未到达的点返回Infinity。
- `propagation.arrival(front,distancePx,{direction='outward'}) → seconds|Infinity`为首次达到/越过距离的时刻。linear解析；hold在跳变结点到达；smooth按与curve.scalar相同的分段smoothstep作48次二分，时间误差≤所在结点时段长度/2^48（另有浮点舍入）。平台取**首次**到达，不取平台结束。inward是反向退场的首次越过时间，不能用作父到子向外传播的因果保证。
- `propagation.births({id,sites,front,direction='outward',delay=0,count=1}) → Birth[]`。delay非负秒，count为每站复制数，最多10000站、10000输出。未到达站不生成记录；重复站ID拒绝。每条含`{id,randomId,index,born,reachedAt,position,tangent?,normal?,space,site}`，born=reachedAt+delay；复制关键由id+site.id+复制序号组成，与筛选顺序、材质、输出fps无关。site保存距离、枝和设计位置等因果信息的独立副本。可直接喂`particle.emitter`，initial回调通过`birth.site`作材质/运动；也可`schedule.alive(births,t,{life})`绘制非粒子响应。出生是创建时的记录，不在draw里触发/去重。反向前锋可另产退场记录并按`site.id`关联；工具不替作者决定生长高度、物理或美术结束方式。
- `propagation.segments(network,{fromPx=0,toPx=network.maxDistancePx}) → Segment[]`。在同一继承距离域连续裁切各段，再插值到画面；返回`{id,branchId,parentId,a,b,fromPx,toPx,space}`。用Painter自画宽度、冷却、光和破口。from/to必须有限；负前锋或from≥to返回空，不跨枝连接。可用同一front.sample(t)驱动toPx，用另一条退场曲线驱动fromPx或toPx。分段结果不是材质，也不是自动碰撞/拓扑碎片。

### example

普通草稿内的组合局部，meta/结束包络由作品决定：

```js
import {propagation,curve,particle,material} from '../../../src/authoring/index.js';
const veins=propagation.fractures({id:'veins',seed:42,arms:6,steps:22,
  inside:(x,z)=>x*x+z*z<75*75,stepPx:[3,5],fork:.12,
  project:([x,z])=>[x,z*.35]});
const front=curve.scalar({input:'scene.seconds',outputUnit:'pixels',
  points:[[.5,0],[1.4,veins.maxDistancePx]],interpolation:'smooth'});
const sites=propagation.sites(veins,{spacingPx:7,minDistancePx:12,minGapPx:14,limit:12});
const births=propagation.births({id:'buds',sites,front,delay:.04});
const buds=particle.emitter({id:'buds',seed:42,births,
  initial:({birth})=>({life:.8,velocity:[0,-8],data:{branch:birth.site.branchId}})});
// 在draw中：front开始前不显示；之后使用同一距离前锋和同一批births。
// for(const s of propagation.segments(veins,{toPx:front.sample(t)}))
//   p.line(...s.a,...s.b,Color32);
// particle.draw(p,buds,t,{draw:(p,s)=>material.ember(p,s,{size:1.5})});
// 在observe中：return {particles:[particle.observe(buds,t)]};
```

front.sample在首结点前clamp为首值；首值为0时segments为空，但非零首值的作品需显式按开始时刻隐藏。改变spacing/minGap是分布编辑，改变front结点是传播节奏编辑，替换particle.draw或普通几何为材质编辑；不要重新扫描原始裂枝点计算born。更完整可渲染范例：`lab/vein-relay`。

### pitfalls

设计距离不是投影后的屏幕弧长。默认分叉站点格点从每枝局部0起；它不是在整个树上共享同一格点相位。密集候选和贪心筛选可能偏爱较早/较短枝，需用select/分组设计主次；不承诺最优覆盖。branches/site/birth输出应视为只读快照，修改设计需重建。particle.observe呈现实际响应粒子状态；birth.site可用于作者的因果检查，当前probe没有独立的network拓扑视图。

### provenance

成熟分叉walk提取自`src/fx/ice/_lib.js:fractures`至`src/core/branching.js:fractureBranches`，旧helper调用同一实现并保留原始平坦[x,y,d]、随机顺序和画法。上游Sprite Fusion ice / MIT / Copyright (c) 2026 Hugo Duprez声明保留。距离继承/连续末段也对照`impacts/_lib.js:walk/makeCracks/drawCracks`；站点到达与次级生长对照`ice/frost-nova.js:front/reachedAt/sites`。复用path.polyline/sample、curve.scalar和particle/schedule契约，不复制整个预设。参考平台累计路径距离、时间参数和延迟响应的当前构建审阅见`experiments/vfx-lab/research/tsnm-spine-particle/2026-11-07-propagation.md`，不复制其动态距离延迟或人类编辑器。

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

工具台输出边界可声明为 `authoring.bounds={mode:'viewport'}`：允许有意出画，最终保存的color、软透明、light、combined和preview统一丢弃窗口外像素，窗口内不重采样、不变光强。默认窗口是完整`meta.size`；可加`rect:[x,y,width,height]`，必须为位于meta.size内的正整数矩形。坐标为**画布左上角[0,0]**，不是Painter原点坐标；左/上含、右/下不含。矩形固定在输出画布，flip/angle改变画面内部，不旋转或翻转镜头窗口。origin、尺寸、帧数不变，子矩形外透明；没有自动扩画布或自动选美观构图。

完整资产用 `authoring.bounds={mode:'asset'}`；也可声明较小rect作为资产容许范围。asset不裁切，采样到的范围外color或任何非零RGB光都使验证失败。未声明bounds的旧模块保持原颜色错误/强光警告策略（光RGB和>90才警告），不悄悄收紧旧作品；返回declared=false及具体policy。这个声明目前由lab渲染/验证/冻结交付执行，库内独立createFx/renderFrames及目标游戏引擎尚未接入此输出协议。

AI工作流：先根据意图声明asset或viewport，渲染后调用 `validate {run}`。`bounds`返回实际声明；`boundary.samples`给出seed、请求time/实际actualTime、color/light各自的pixels、画布rect、四边计数与touchesScanBoundary。后者为true时只能知道触及有限扫描外缘，不代表已找到整个物体。默认边距24px；可用 `validate {run,boundsTimes:[1.23],boundsMargin:64}` 增加精确时刻/边距，保留默认检查且不改作品。最多24个附加时刻，边距8..96，最多1200万采样帧像素，超限明确拒绝。时刻必须在作品duration内。

viewport的裁除数量作为INTENTIONAL_CROP诊断和boundary样本记录，不能据此豁免随机性、时钟、重复绘制或结束检查。结束空检查针对最终输出；原始范围外的确定性也仍检查。validate为至多三个越界样本返回原尺寸PNG pages（附加boundsTimes优先，其余取越界像素最多者），颜色/光分开；其余样本仍有结构化位置。无需GUI或写调试包装；不从像素猜对象ID。图为冻结源码在有限边距内的未裁栅格，不是原保存PNG，也不是穷举所有帧或真实发射域边界。草稿修改后应显式生成新run，旧run沿用原声明；atlas/delivery记录同一选择的bounds。

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

`until(births,ends,{match=b=>b.id,offset=0}) → Birth[]`把起止出生表按明确共同身份关联，保留出生身份/其他字段，增加`end=matchingEnd.born+offset`和`life=end-born`。match需返回非空字符串或整数；多复制start可以共同匹配一个end，但start.id须唯一、end的match须唯一。offset为有限秒（可负），life必须>0；缺end/重复end/非正寿命明确拒绝，不猜结束或静默丢站。各表最多10000条，输出保持start输入顺序。可直接喂particle.emitter，省去每件作品重复建退场Map：

```js
const grows=propagation.births({id:'grow',sites,front});
const retreats=propagation.births({id:'retire',sites,front:tail,direction:'inward'});
const lifetimes=schedule.until(grows,retreats,{match:b=>b.site.id,offset:.12});
const buds=particle.emitter({id:'buds',births:lifetimes,initial:{velocity:[0,0]}});
```

提炼schedule.resident的end-start和ice/endBy的截止寿命；不是通用事件自动匹配器。

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

## core/ray

### overview

导入`{ray}`。面向俯视游戏中明确声明的有限2D场景：点射线穿过目标、镜面反射、封闭介质折射，输出真实路径/法线/距离/能量与稳定交点。工具负担相交和方向计算，画法、目标选择、伤害与宽度仍由作者/游戏决定；可直接用skill.beam或自己的path.strip绘制。

### contract

- `ray.segment({id,a,b,mode='stop',retention=1})`，`ray.circle({id,center,radius,mode='stop',retention=1,ior=1.5})`，`ray.box({id,bounds:[x,y,w,h],mode='stop',retention=1,ior=1.5}) → RaySurface`。位置为effect/map像素，mode为stop/pass/reflect/refract；retention是每次边界交互之后保留的能量比例0..1。segment是双面线段，折射只用于有入/出边界的circle/box。ior>0是内部折射率，外部为1；不是按颜色强制决定材质。
- `ray.trace({id,origin,direction,surfaces=[],range=320,maxInteractions=32,energy=1,minEnergy=.01,epsilon=1e-7}) → RayTrace`。direction非零，自动归一；输入顺序不决定最近交点。≤256面、≤256次交互、range≤1M像素。严格正epsilon仅排除当前边界的数值自交，不移动可见端点；range/path距离连续。结果`segments:[{id,from,to,direction,distance,length,energy,medium}]`，`hits:[{id,ordinal,surface,shape,face,position,normal,incoming,outgoing,distance,entering,action,energyBefore,energyAfter,iorFrom,iorTo,totalInternalReflection}]`及origin/end/distance/energy/reason/path。path是现有Path或无可见长度时null；reason=range/stop/energy/limit。normal对封闭体朝外；线段法线朝入射侧；outgoing在stop为null。pass对封闭体分别产生入口和出口交点，按entering筛选需要的反馈。
- reflect按法线镜像方向；refract按Snell计算且自动处理全内反射，入/出介质身份保留。嵌套/重叠折射介质、不同面同点边界、折射恰好经过box角点无唯一法线时明确拒绝，不偷偷猜方向。初始点不能恰在折射边界，允许明确在一个介质内部。
- `ray.reflect(direction,normal) → unit direction`；`ray.refract(direction,normal,{from=1,to=1.5}) → {direction,totalInternalReflection}`可单独复用，normal朝向自动适配入射。所有角度/方向保持普通2D，不含固定地面重力。
- `ray.observe(trace,time,{fromPx=0,toPx=trace.distance,id='ray/'+trace.id})`直接返回该条真实光路的BodyObservation；固定bounds=null，data含traceId/head/tail/可见segments、已到达hits、visibleHits、总距离/能量/reason。from/to用像素距离，0≤from≤to≤trace.distance；和实际绘制采用同一范围，不需作者包装body.data或创建见证粒子。time为查询时刻，算子不猜光束推进速度。
- `ray.events(trace,{start=0,speed=null})`给每条hit加time。speed为像素/秒，time=start+distance/speed，用十进制输入秒加法；null表示游戏认定瞬时命中，全部time=start。查询纯粹，不自动派发游戏逻辑；hits仍由调用方接combat/gather/粒子或自定义着色。

### example

```js
const shot=ray.trace({id:'prism-shot',origin:[-90,0],direction:[1,.12],range:260,
 surfaces:[ray.box({id:'glass',bounds:[-35,-30,18,60],mode:'refract',ior:1.45}),
 ray.segment({id:'mirror',a:[20,-35],b:[55,30],mode:'reflect'}),
 ray.circle({id:'armor',center:[45,-45],radius:10,mode:'pass'})]});
if(shot.path)skill.beam(p,shot.path,t,{width:3,colors:myPalette});
// shot.hits drives separately authored reflection/impact parts at actual points.
```

### pitfalls

它是输入场景当时的2D点射线，不是连续移动碰撞、厚束体积求交、自动寻敌、物理Fresnel能量或刚体。交点能量是作者retention的明确模型，不暗含伤害。有限迭代耗尽时reason=limit且路径停在最后真实点；扩maxInteractions应有实际需要。到达事件只对这条冻结路径成立，移动世界重建时由游戏定义何时采样/重发。

## core/arc

### overview

导入`{arc}`。把原lightning/_lib的分叉/弯弧/分层描线直接用于自由节点与边，不复制整套闪电招式、站立人物或地面偏移。节点支持真实移动源，链路的传播、命中事实和可见头部共用时间；不替游戏选择攻击目标。

### contract

- `arc.bolt({id,from,to,seed=1,jag=.18,forks=.15,bow=0}) → ArcGeometry`。from/to像素，jag位移比0..1，forks分叉概率0..1，bow偏离直线的像素，seed稳定。最长800px；重合点返回空几何。公开`paths:[{pts:[[x,y]],w}]`（主干w=1）、现有Path `path`、`lengthPx`、from/to；可以完全自写材质或直接用默认draw。
- `arc.network({id,nodes,links?,seed=1,jag=.18,forks=.15,bow=0,step=.1,travel=.06,hold=.5})`。nodes为`[{id,position:[x,y]|SourceTrajectory|pure time=>[x,y]}]`；2..64节点。links为任意有向`[{id,from:nodeId,to:nodeId,start=0,travel=.06,duration=travel+hold,jag?,forks?,bow?}]`，≤64，duration包含传播秒。后续link可用`after:parentLinkId,delay=0`代替start，start从父link.hit+delay推导；按ID解析，与数组顺序无关，未知/循环依赖及同时start+after明确拒绝。可自由用显式start制造重叠或提前。links缺省时仅按节点次序串联，start=i*step；完全可换成分叉/跳跃/重连图。id唯一，时刻、形状和目标没有固定招式约束。
- `arc.sample(network,time,{flickerHz=18,period=null}) → LinkState[]`。状态pending/propagating/holding/expired，含id/source/target/time/cycle/localTime/start/hit/end/age/progress/from/to/head/geometry。头部按主干真实弧长推进，hit=start+travel；所有端点来自同一时刻实际节点。flickerHz独立于输出fps，0固定形状；period若有须覆盖全部link.end，不暗含跨周期重叠图。查询/乱序无副作用。
- `arc.draw(p,network,time,{colors=VOLT,width=.65,glow=.18,opacity=1,power=1,style='stroke',filter?,flickerHz=18,period=null})`直接调用成熟stroke/crackle分层像素画法，leader按真实弧长裁切，返回实际LinkState。colors自由暗→亮色带，width>0，glow≥0，opacity/power 0..1；filter可自选图层。未强制画节点、人物、源球或命中星芒。自定义绘制可只用sample/bolt.paths。
- `arc.events(network,{from=-1e-12,to=network.end,period=null})`返回(from,to]的真实到达记录`{id,link,source,target,cycle,time,position,from}`；位置采样目标在hit当时，身份稳定，分段可合并，无状态派发。period>=network.end，单次最多10000周期。
- `arc.observe(network,time,samplingOptions)`返回真实BodyObservation id='arc/'+network.id；固定localBounds为null，当前生成中心线的范围在data.geometryBounds（不是墨线像素边界）；data.links含与sample一致的真实头/端点/时钟/状态及lengthPx，不塞完整绘制数组。可和普通bodies/particles/sources一起observe。不是见证粒子或像素反推。

### example

```js
const links=arc.network({id:'chain',nodes:[{id:'muzzle',position:handSource},
 {id:'first',position:[45,-20]},{id:'second',position:secondTargetSource}],
 links:[{id:'one',from:'muzzle',to:'first',start:.2,travel:.08,duration:.55},
 {id:'two',from:'first',to:'second',start:.28,travel:.12,duration:.45}]});
arc.draw(p,links,t,{colors:myPalette,glow:.12});
// export observe(t) { return {bodies:[arc.observe(links,t)]}; }
// arc.events gives true target hit points for separate sparks/status feedback.
```

### pitfalls

电弧是艺术几何而非电磁场或导电路径解算。目标顺序/是否连锁由调用方决定。节点回调应纯且在查询时间有效；不要从输出fps推导随机epoch。改变普通图和造型是艺术工作，稳定距离/头部/到达/身份和成熟栅格由工具承担。保留Sprite Fusion lightning/Hugo Duprez/MIT署名，未把原球/链整件当成新预设。

## core/playback

### overview

引擎中立的成品消费入口。每次export自动附`pack.json`、`playback.mjs`、`load-node.mjs`和`png.mjs`，整目录移到仓库外即可运行。它们只读导出资产，不需要作品源码/SDK/工作台服务器。场景、游戏事实和造型仍是普通JS；模块负担图集解包、采样、轴心、时间、事件、实例和色光合成。

### contract

```js
import {loadPack,writeFrame} from './my-pack/load-node.mjs';
import {instance,scene,compose,eventsBetween} from './my-pack/playback.mjs';
const hit=loadPack('./my-pack');
const one=instance({id:'hit-1',asset:hit,start:1.2,position:[100,80]});
const two=instance({id:'hit-2',asset:hit,start:1.8,position:[130,80],scale:[-1,1]});
const states=scene([one,two],1.9); // actual instance/sourceRun/frame/clock/pose
const rgba=compose({width:256,height:192,background:[24,32,40,255]},states);
// rgba.color/light/combined RGBA bytes, original scene dimensions
writeFrame('scene.png',rgba); // native scene PNG; optional channel:color/light/combined
const cues=eventsBetween(one,1.1,1.9); // pure facts, application dispatches
```

- `loadPack(directory) → PlaybackAsset`（Node适配）。检查pack文件字节SHA、sourceRun/revision和atlas，解码color/light。丢图RESOURCE_NOT_FOUND、坏字节CONTRACT_MISMATCH，错误给具体文件、冻结来源和恢复方法。pack包含所交付运行模块的SHA。导出资料无需从当前原资源重建。浏览器/游戏自带解码器可用下一入口，不强制Node。
- `writeFrame(file,composedFrame,{channel='combined'})`（Node适配）。自动建立父目录，将compose返回的color/light/combined原尺寸RGBA保存PNG，返回路径/尺寸/通道/字节SHA；不必作者写媒体或PNG编码器。亦可直接import `{encodePNG,decodePNG}` from随包png.mjs；encodePNG(width,height,rgbaBytes)返回PNG Buffer，decodePNG(bytes)返回{width,height,data}。
- `createAsset({atlas,color,light}) → PlaybackAsset`。playback.mjs无DOM/FS/外部依赖；color/light为`{width,height,data:straight RGBA bytes}`。校验精确frame.time递增秒数、rect、尺寸、轴心和元数据版本；从atlas.meta.athanor取sourceRun/sourceDigest/revision/素材digest/events/loop/ending。旧导出没有playback v1需从原run重新export，不猜帧时长。
- `imageAsset({id,color,light=null,pivot=[0,0]}) → PlaybackAsset`。将调用方自画的静态RGBA或自行解码PNG接入scene，color/light格式同createAsset，light缺省全零。工具生成单帧rect/元数据，不需作者伪造atlas或duration。它duration=null、无事件、持续至实例stopAt；sourceRun=null且provenance.kind='caller-image'，不冒充冻结作品。位置/轴心/色光与普通实例相同。
- `instance({id,asset,start=0,position=[0,0],scale=1,rotation=0,opacity=1,depth=0,rate=1,stopAt=null,hold=false})`。稳定非空id；start/stopAt全局秒，rate>0。position为目标轴心的场景坐标；scale可负轴镜像，rotation弧度；这五个pose字段可为全局time=>值的纯函数，跟随或脱离由作者决定。hold显式保留单次作品末帧，否则寿命半开至duration；loop按精确duration取模。stopAt为硬截止，不伪造未烘焙尾部。
- `sample(instance,time)`返回id/assetId/sourceRun/status/time/age/cycle/localTime/frameIndex/rect/pivot/position/scale/rotation/opacity/depth/asset；scene(items,time)检查实例ID唯一并按depth/id稳定排序。跳转/乱序无累积状态；时间差和周期加法按输入数的十进制表示计算，例如.7-.2保持.5，不用epsilon或fps网格吞掉微小偏移。
- `eventsBetween(instance,from,to)`返回`(from,to]`中的事件，首次零时cue需from<start；每条含稳定id=[instance,name,cycle]、来源run、实例、周期、局部/全局秒。loop自动展开，stopAt之后不发；分段查询可合并，无隐式dispatch。应用不要重复派发同一范围；寻址不是再次执行游戏逻辑。单查询≤10000周期。
- `compose({width,height,background=null},states)`用像素中心逆映射/最近邻采样、真实pivot/镜像/旋转，返回`{width,height,color,light,combined}` RGBA bytes。background可null或RGBA四字节；color按depth/id straight alpha over，light独立饱和相加，再以与core.composite一致约定合成透明/有底图。light在完整场景之上相加，不提供动态光遮挡。画布≤16M像素，裁切按场景视口明确发生；不自动缩小。

atlas保留通用rounded duration(ms)，消费模块使用新增精确time秒与playback.duration。sourceRun/revision/JS闭包摘要/原素材摘要分别保持，pack.json为该次交付的文件身份；末样本仍保存，one-shot默认不额外增加末帧时长，hold才保留。

### example

公开game-hit/game-skill/game-status/game-status-outro/game-particles为同配色透明部件，展示重复命中、取消版本、状态loop与匹配相位outro及多个脱离粒子。可以inspect源码替换结构/材质；它们是可选参考，不是强制游戏技能格式。

### pitfalls

导出图集是烘焙结果。取消/解除无法从成品恢复未导出的粒子内部状态；制作取消版本，或把附着loop和脱离tail分别交付。outro应匹配实际移交相位，不能硬停loop冒充自然尾部。runtime不推断命中目标、跟随意图、遮挡层次或游戏buff规则。只认证本次有限中立消费任务，未认证Unity/Godot/Spine或通用并发性能。combined PNG的透明发光是近似；场景消费请用独立color/light。

## core/gather

### overview

导入`{gather}`。已知闭合轨迹终点或外部事实→稳定到达记录→纯权重累计→作者自己的形状/材质/动作响应。没有逐帧记账，不接管增长轮廓、质量规则或冲拳造型；普通JS可读全部events另写模型。

### contract

- `gather.records({id,events}) → ArrivalSequence`。events为`{id,target,time,position,velocity=[0,0],weight=1,parent=null,data=null}`；target稳定ID，时间秒，位置effect像素；weight任意有限数（可负），data/parent为有限普通JSON。按time/id稳定排序，重复ID拒绝，复制并冻结。适用于游戏给出的已知到达/移除事实，也可适配contact.events，不声称推断碰撞。
- `gather.fromTracks({id,tracks,target,weight=1,accept=()=>true,data=null})`。tracks须有id/end/sample，sample(end)是真实闭区间终点；位置与速度来自此采样。target/weight/data可为`({track,time,endpoint})=>...`；accept同上下文，显式检查作者的有限目标域，false记录到omitted。没有accept时表示调用方承诺已知目标，无暗含半径/屏幕碰撞。event.id是track.id，parent保留track.parent。
- `gather.fromParticles(emitter,{id=emitter.id+'/arrivals',target,ends?,weight=1,accept?,data=null,select=()=>true})`。复用真实particle.track(position:'physical')。ends可为birth=>绝对终点时间或birthID→时间表；自定义trajectory必须明确ends；不能超过首次死亡。各回调多一项birth，select只接birth。原birth/父layer/particle/copy身份保留，渲染offset不伪装成物理到达。
- `gather.sample(sequence,time,{target?,initial=0,from?}) → {id,time,target,initial,total,count,latest,events}`。选择from≤event.time≤time；target缺省全部。total是initial加已选权重，没有夹值或艺术平滑。乱序/跨fps不会重记；查询不会改变序列，已选events可供作者任意归约。
- `gather.births(sequence,{id=sequence.id+'/response',count=1,life=.35,delay=0,select=()=>true})`。事件连接的真实出生，包含arrival完整事实、位置与稳定ID；可接任意particle.emitter。life/delay秒，delay≥0；不强制火花/光环。
- `gather.bind(body,sequences,{initial=0,from?}) → Body`。可选的真实主体观察绑定，保留body几何/ID，data为`{target:原data,accumulation:[sample...]}`（按body.id筛target）。data:false跳过。造型、强度、释放消耗仍是作者普通JS，工具不会把累计强行映射成uniform scale。

### example

```js
const arrivals=gather.fromParticles(inward,{target:'arm',ends:b=>b.born+b.life,
  weight:({birth})=>birth.data.mass,accept:({endpoint})=>insideMyKnownArm(endpoint.position)});
const state=gather.sample(arrivals,t,{target:'arm'});
// Your own asymmetric shape/material model consumes state.total and events.
const visible=bodyWithMyShape;
export function observe(t){return {bodies:[body.observe(gather.bind(visible,arrivals),t)]};}
```

公开参考lab/gather-relay及arrival-body配方演示左侧熔渣内收、移动挂点、真实到达闪光、非对称手臂增长和冲拳。skill.infall可复用既有内收运动，也可替换任意闭合track。

### pitfalls

从已知终点建立到达不等于任意移动碰撞解算。初始/目标/随动规则要自行声明；accept只是终点域检查。step积分轨迹的闭合端点保留原精度，gather不会提高它。物理质量守恒、刚体堆积、任意蒙皮不在此契约。body.data累计是实际生产数据，不要添加假粒子充当观察证据。

## core/assets

### overview

这是工作台资源契约，不是SDK导入命名空间。作品导出`assets`声明，运行时在`options.assets`中收到Texture或Texture[]。原PNG字节、资源ID、帧布局、pivot与摘要作为独立闭包冻结；图像内容不会塞进JS源码。

### contract

```js
export const assets = {
  actor: {file:'./art/actor.png', pivot:[16,40]},
  sparks: {file:'./art/sparks.png', frameSize:[8,8], pivots:[[4,4],[4,4]]},
  smoke: {files:['./art/s0.png',{file:'./art/s1.png',pivot:[5,7]}],pivots:[[4,6],[5,7]]}
};
// Or export function assets(options) { return declarations; }.
// draw/observe/events receive options.assets.actor / sparks / smoke.
```

相对路径以作品JS所在目录为基准，亦支持明确本地绝对路径；不支持URL、动态未声明读文件。`file`与`files`二选一。单图得到Texture；规则图集用frameSize拆为Texture[]（从左到右、从上到下）；files序列按声明顺序。每帧pivot从帧左上起算，默认中心，允许在图外。可直接接texture.sequence、texture.draw、texture.mask/sample、surface和particle。用户不能通过render.options覆盖保留键assets。

支持非交错RGBA8、RGB8、灰度/索引1/2/4/8位、gray-alpha8及对应tRNS。保留straight RGBA与透明RGB，不作ICC/gamma转换。16位、Adam7、APNG明确拒绝；先转成支持的PNG或显式帧序列。每源图≤4096轴/16M像素，总源解码≤32M像素、原字节≤64MB，≤128资源/1024源文件；它们是当前有限边界。

inspect当前作品返回assets可用性、源路径/字节SHA/编码/pivot，错误包含资源ID和恢复办法。render把原字节存为assets.json，资源digest参与revision/run身份，JS sourceDigest保持独立。validate/probe/重放使用保存的字节，不读取新源图；inspect旧run的currentAssets只报告源图已改/缺失。源图损坏、缺失或格式不支持时不回退占位图。保存闭包损坏则REPLAY_UNAVAILABLE，不偷读现文件。

同run export附`source-assets.json`与`source-asset-i-j.png`，清单给逻辑ID、原字节SHA、frameSize/pivots和冻结digest；atlas.json也引用资源身份。成品图集与原素材都来自明确选择的同一run。

### example

公开参考`lab/asset-relay`把外部PNG角色alpha接到真实surface，受击变色，PNG图集接到脱离火花。先inspect它的assets和依赖，再编辑自己的声明。素材路径只是工程连接；造型、动画帧、颜色、遮罩阈值和运动均由作者决定。

### pitfalls

普通fs.readFile或网络请求不会自动冻结。不要从当前文件重新构造旧run的资源；通过target.run重放。纹理资源按不可变值使用，需要改图时写新PNG并明确render，产生新的revision。

## core/texture

### overview

导入 `{texture}`。把Painter.sprite、身体压缩与局部逆向采样的实现路径提炼为有轴心、可旋转/翻转/缩放的像素贴图；参考平台的序列模式与资源轴心。支持普通代码内资产及core/assets声明的本地PNG资源，两者都随run冻结。

### contract

- `texture.rgba({id,w,h,data,pivot=[w/2,h/2]}) → Texture`。w/h整数1..4096（ASCII仍最多480）；data恰好w*h*4个0..255整数字节，straight RGBA，复制保存；透明像素RGB原样保留。pivot是纹理左上起算的像素坐标，允许在图外。
- `texture.ascii({id,rows,palette,pivot?}) → Texture`。等宽字符串，`.`/空格透明，其他ASCII字符必须在palette有hex/Color32。palette没有未知字符回退；Color32的alpha会保留。
- `texture.mask(image,{id=image.id+'/mask',space='material',origin=-pivot,alphaThreshold=0}) → Mask`。只取alpha>threshold的像素，透明RGB不生成实心格；mask尺寸仍≤480且surface占用≤16384，较大图集请先拆帧。
- `texture.sample(image,position,{space='local'}) → {color,alpha,rgba,index}|null`。local加pivot后向下取整，pixel直接图像坐标；越界null。color为不含覆盖率的opaque Color32，alpha独立保留0..1，可直接用于surface shade，避免二次乘透明度。
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

本地PNG通过core/assets声明，无须手写像素数组；网络URL不在此契约内。additive的中性观察底是黑色。材质切换不必换运动；反过来运动修改也不必重画图集。

## core/particle

### overview

导入 `{particle}`，与schedule/domain/motion/curve/texture/material组合。提炼库内burst/stream/cycle/looped、出生源采样、独立运动与冷却/膨胀画法；补齐稳定属性通道与观测。普通代码仍可自写轨迹、力、生命周期、画法，不限于固定粒子类型。

### contract

`particle.emitter({id,births,seed=1,domain?,measure='area',direction?,transform?,inheritVelocity=0,initial={},textures?,motion={},material={}}) → Emitter`。

- births来自schedule或image.dissolveEvents，有唯一字符串id和born。已有position优先；否则从domain取样；都没有则[0,0]。出生位置采样以birth.randomId或id为键，不因列表重排或添加其他粒子而漂移。cycle的同slot副本共享随机属性、身份仍分开。
- domain使用domain公开契约；另有`domain.point({id,position=[0,0],space='effect'})`、`domain.sector({id,radius,innerRadius=0,angle=0,spread=PI/2,space='effect'})`，sector按扇环面积均匀采样，仅支持area。domain.sample还可传与count等长、唯一的`ids`，用身份而不是数组序号采样；返回仍有index。
- direction是`{mode:'angle'|'outward'|'inward'|'normal'|'tangent',angle?,spread=0,center=[0,0]}`或`context=>[dx,dy]`。angle模式默认向上(-PI/2)，其他模式angle默认0为相对偏转；spread是总弧度宽度。in/outward以center独立计算，normal/tangent仅在域提供时可用，不为mask伪造法线。零speed不要求方向。也可在initial直接给velocity。
- transform为静态对象、`birthTime=>{position=[0,0],rotation=0,velocity=[0,0],angularVelocity=0}`或motion的SourceTrajectory，只在出生时采样。域坐标/初速度先旋转，再平移位置；实际出生点的源速度为`velocity+angularVelocity*[-旋转后域y,旋转后域x]`，乘inheritVelocity加到初速度。旧回调不声明angularVelocity时保持原来仅继承平移速度的行为。SourceTrajectory接管导数，也可继续显式提供velocity(px/s)/angularVelocity(rad/s)；不从输出帧猜速度。出生后默认脱离源，不自动追随。源声明space时须与出生域/已有birth.space一致。Birth中的source保存位置、平移速度、旋转/角速度、pointVelocity和可用的derivative策略，fx_probe返回的births可直接查询；这不是任意场/绘制层的观测协议。
- initial.velocityOffset可为effect空间[x,y]或`context=>[x,y]`，在源旋转和inheritVelocity之后加一次；不旋转此向量。surface.inheritVelocity(factor)可直接提供真实表面出生点速度，其来源保留在birth.surface中，不改写成虚构SourceTrajectory。
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

`fx_probe({run,at?,view='color',sampling='saved',layers?,particles?,fields?,limit=12})`：at为`{times:[seconds],clock:'effect'}`或`{event,offsets,clock:'effect'}`，最多24个时刻，默认用已选事件帧。preview/color/light/combined直接读单run保存图，支持旧作品，不需重复传run；这四视图不接受粒子fields/layers或replay。particles/trajectory默认读保存观测，即使当前草稿无法导入仍可查；sampling:'replay'明确在冻结源码重算，可查非保存时刻。layers为已声明粒子组ID，particles为字符串birth ID；默认selection:"active"优先最新请求样本时刻活跃的身份，再取其他请求时刻活跃者，最多limit条；无活跃对象时返回空选及全组计数。selection:"birth-order"取声明顺序，particles显式身份仍可查未出生/死亡状态；结果报告候选、锚定时刻与省略数。fields可选status/position/basePosition/velocity/age/age01/simulationAge/opacity/scale/rotation/tint/blend/tintMode/texture/offset/data/contact，结果附单位、births、每时刻全组数量和选中状态。tint为Color32整数，blend/tintMode为已声明状态；custom draw可以自行改画法，这些字段不从最终像素反推自写shader。未知组/身份/字段报错。trajectory按时间连接**离散观察点**，不是推断连续物理轨迹；稀疏时刻只提供稀疏证据。at范围外会明确夹边。无observer的旧run仍可查保存图，不从最终像素反推身份；不支持任意mask/field、内部绘制层隔离、去修改器或动作播放时钟。

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
- `material.lobe(p,s,{fireColors,smokeColors,size=5,heat=1-s.age01,innerGlow=0,depth=0,dark=0,style='smooth',glow=1})`：直接复用`explosions/_lib.lobe`的火核、暗缝、顶光、内部余热和软烟边。fireColors热→暗（重采样9阶），smokeColors**亮→暗**（8阶）；size>0是当前半径px，不另加生长包络；heat/innerGlow非负，可独立于年龄，depth∈[-1,1]，dark整数0..3，style为smooth/cel。state.opacity按原helper语义只传一次；glow是加法光倍率，内部余热着色由innerGlow控制。布局/出生/运动不变时，可单独改热度、色带或画法。
- `material.cloud(p,states,{colors,warmColors=colors,size=4,brightness=1,warmth=0,density=1.5,maxOpacity=.86,lighting=1,clip})`：把**整批存活状态一次**交给`projectiles/_lib.cloud`，密度合并、模糊梯度顶光与阶梯软透明仍为原算法。states为数组，每项position为local px、opacity∈[0,1]；size>0为当前半径px、brightness/warmth∈[0,1]，三项均可为`state=>number`，不自动乘scale或年龄。colors/warmColors均**暗→亮**8阶（与lobe烟色相反）。density/lighting非负，maxOpacity∈[0,1]；clip为local `(x,y)=>boolean`。不推进运动、不新增随机、不生成假对象；同一批particle.sample状态可继续用于观察。Painter状态不变；现有Painter.fade仍作用于覆盖。不是流体/全局体积光求解。

### example

```js
particle.draw(p,hotDebris,t,{draw(p,s){
  const colors=['#fff5cf','#ffbe76','#b95c39','#3a2732'];
  if(s.age01<.4) material.spark(p,s,{colors,glow:.04});
  else material.smoke(p,{...s,age01:(s.age01-.4)/.6},{size:2.5*s.scale[0]});
}});
// Same emitter, positions, identities and timing; replace only the renderer.
const states=particle.sample(steam,t).filter(s=>s.status==='alive');
material.cloud(p,states,{colors:['#222536','#596574','#a2bdc4'],
  size:s=>3+6*s.age01,brightness:s=>1-.5*s.age01});
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
