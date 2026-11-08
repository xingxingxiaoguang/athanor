# 可发现的原库机制

这些是库实现的使用契约与参考片段，与`core/*`SDK分开。通过`search`的`mechanisms`结果和`inspect {ref:{kind:'mechanism',id},sections:[...]}`按需读取。默认返回overview/contract/example；source只返回登记的原文片段，dependencies返回真实直接静态导入，provenance给出来源修订。没有任意文件读取入口。已提炼为SDK的组合会给出对应operator入口，原helper仍保留自己的旧语义。

`library-helper`表示可直接import现有辅助函数，保留旧函数语义与限制；`reference-fragment`表示效果内部的私有片段，需阅读相应完整参考效果后适配。两者都不自动获得SDK数值校验、对象身份或probe协议。source片段不是完整可粘贴模块；使用原模块import可保留私有依赖。保留原文件的MIT与Sprite Fusion/Hugo Duprez等来源说明。

示例路径以`experiments/vfx-lab/drafts/*.js`为起点；完整作品入口先inspect `core/effect`，Painter颜色用Color32。原尺寸观察、技术验证和同一明确选择run的导出仍由现行工作流完成。

作品`inspect {id,sections:['reuse']}`列出其真实静态可达的库模块、导出和登记机制；加source可读这些库模块的原文，不返回SDK/runtime实现。静态可达（尤其barrel）不证明函数在画面中实际生效。机制`sections:['reuse']`列出可替换输入和共用约定；没有登记的函数仍可从作品的库依赖原文研究，不能猜为已认证SDK。

## library/explosion-lobes

### overview

直接复用`explosions/_lib.js`的fireBall/lobe。fireBall保留按年龄冷却的火团暗边/火舌；lobe保留分瓣体的热核、暗缝、顶光和内部余热。它们只画一个局部体，不绑定圆形爆炸布局；作者可排成双腔、弯曲排气、非对称裂隙。公开函数名lobe/fireBall/fireRamp可直接搜索。

### contract

- `fireRamp(F)`把暗→亮8阶Color32转换成热→暗9阶。`fireBall(p,q,FR)`接收`{x,y,size,life,max,seed}`；life是**剩余秒**、max是总秒，size像素；不能把age01直接放进life。FR热→暗，冷却、尺寸包络和原光由helper决定。
- `lobe(p,x,y,r,FR,SM,fire,glow,a,z=0,dark=0,style=0)`：local px，FR热→暗，SM亮→暗；fire/内部glow为非负艺术热度，a覆盖，z通常[-1,1]近远，style=1为cel。dark应为小非负整数，受SM长度制约。没有自动运动/寿命/随机或对象ID。
- 公共粒子适配`material.lobe`见core/material：接position/age01/opacity，当前半径、热度、内部余热可分别控制；不必把公共State重写成旧粒子。`material.fire`是另一种成熟firePuff画法，并不等于lobe。

### example

```js
import {material,particle} from '../../../src/authoring/index.js';
// keep myEmitter's births, paths and identities; replace this callback only.
particle.draw(p,myEmitter,t,{draw(p,s){
  material.lobe(p,s,{size:(4+5*s.age01)*s.scale[0],
    fireColors:['#fff3b4','#f8a543','#b94b35','#342735'],
    smokeColors:['#aab6bb','#65727d','#303744','#1c202d'],
    heat:Math.max(0,1.25-2*s.age01),innerGlow:1-s.age01,style:'cel'});
}});
```

### pitfalls

lobe的烟色是亮→暗，与cloud相反。单独降低glow只关闭加法光，不会抹掉内热着色。它不是Plume涡环运动；改变源布局不用复制Plume或整个爆炸。直接helper需作者保持输入有限，SDK适配提供明确参数诊断。

### evidence

来源为small-explosion、smoke-bomb及explosions/_lib中的实际算法，保留Sprite Fusion explosion / Hugo Duprez / MIT署名。单体材质不自动认证任意大体积/遮挡或艺术效果。

## library/merged-smoke

### overview

直接复用`projectiles/_lib.cloud`：整批团块的球厚度密度相加，对密度做双向模糊求顶光梯度，分级覆盖与火光混色。作者只需提供团块状态和材质，不再重写扫描/模糊。适合连续蒸汽、烟尾和弯曲排气；不提供流体运动。

### contract

- `cloud(p,list,R,WR,{dens=1.5,max=.86,clip,lit=1}={})`。list为`[{x,y,r,a,b,w}]`：位置/半径local px，r>0，a覆盖、b亮度、w火光均0..1；R与WR为相同长度暗→亮Color32色阶。dens密度倍率，max最大alpha，clip本地裁域，lit顶光倍率。原helper没有SDK输入校验。
- 必须一次传整批，逐团调用会失去密度融合。private blur留在原模块内，import cloud，不把source片段当独立模块复制。
- `puff(p,x,y,r,a,c,cap=1,warm=0,wc=0,wa=0)`是另一种分层软团画法，不做跨团合并。`Smoke`是旧状态模拟容器，不是使用cloud的前提。
- 公共适配`material.cloud(p,states,...)`见core/material：直接接particle.sample返回的存活状态数组，size/brightness/warmth可以按状态求值。运动与材质独立；观察继续用同一emitter，不添加假ID。

### example

```js
import {material,particle} from '../../../src/authoring/index.js';
const states=particle.sample(mySteam,t);
material.cloud(p,states,{colors:['#242935','#62717c','#b8c5c6'],
  warmColors:['#34232d','#b07155','#e5bc83'],
  size:s=>3+8*s.age01,brightness:s=>1-.6*s.age01,
  warmth:s=>Math.max(0,1-3*s.age01),density:1.4});
```

### pitfalls

半径/透明度不自动乘年龄、scale或自己的曲线；由作者传入，避免双重衰减。软边与密度阈值使很薄的尾端不可见，这不是粒子死亡；probe真实状态与色图分别检查。不是三维光照、流体或自动云形生成。

### evidence

projectiles/_lib的puff/cloud/Smoke与spark等保留Sprite Fusion muzzle-flash/explosion / Hugo Duprez / MIT来源。新层只做公共状态和参数适配，未改写原密度算法。

## library/branching-fractures

### overview

从`ice/_lib.js`直接复用不规则放射/分叉和按累计距离连续生长；从`impacts/_lib.js`参考偏向地面前侧的裂缝、热尖与冷却暗痕。几何与reach可以重用，投影、裂口宽度、颜色、发光、起播与退场由作者替换。检索词包括裂纹/裂痕/裂缝/地裂/放射/分叉/蔓延及crack/fracture。

需要稳定父子身份、投影前距离取样、画面间距、首次到达和次级出生时，inspect `core/propagation`；不必自行扫描旧平坦数组。成熟walk现提取至`src/core/branching.js:fractureBranches`，旧fractures调用它再返回原平坦结构，原有几何/随机顺序保留；登记的source也包含这一共享库算法，非SDK包装实现。

### contract

直接导入`{fractures,drawFractures}`自`src/fx/ice/_lib.js`，`Rng/fit`自`src/core/index.js`。

- `fractures(R,inside,x,y,n,opts={}) → Array<Array<[x,y,d]>>`。R为`new Rng(seed)`，不是authoring.random命名空间；inside(nx,ny)返回是否继续，(x,y)为共同起点，n为主枝数。输入应由作者保持有限、n为正整数、step正值，旧helper没有SDK参数诊断。
- opts实际默认：`step:[1.6,2.6]`（每步像素范围），`len:18`（最大步数，**不是像素长度**），`fork:.16`（逐步分叉概率），`a0:R.range(0,TAU)`，`spread:TAU`。每步角度扰动±.55弧度，递归深度最多2。越界步不加入结果；inside不裁切跨越边界的整段，也不做复杂碰撞。
- d为从根沿分支路径累计的像素距离；子枝继承其分叉处d，因此同一reach只会在父前锋抵达后显示子枝。返回的是平坦折线列表，**没有显式parent/ID/事件拓扑**；不把列表顺序当生长顺序。
- `drawFractures(p,cracks,reach,C,opts={})`。reach为同一距离域的像素；C为Color32色阶，建议至少4阶。opts实际默认`ox:0,oy:0,hot:true,a:1`。末段按reach插值，先画下方暗边，再画裂线/热尖和加法光。并非任意材质渲染器；自画沟宽/错岸可消费同样的[x,y,d]。
- `makeCracks(R,n,{len:[14,40],dive:.85,maxY:22,forks:.5,x0:[1,5]}={})`及`drawCracks(p,cracks,g,heat,hot,dark,lip,k=1)`位于`impacts/_lib.js`。这里len是像素范围，与ice版本不同。g(c)为该主裂缝已长出的距离，heat(d)为局部热度0..1，hot为亮到暗4色。主枝有`pts,len,t0,kids`，子枝仍继承距离；生成几何偏向(0,0)下方和左右，不能当任意全平面放射域。

### example

普通草稿中的局部组合；meta/结束包络由作品决定：

```js
import {Rng,fit} from '../../../src/core/index.js';
import {fractures,drawFractures} from '../../../src/fx/ice/_lib.js';
const cracks=fractures(new Rng(42),(x,z)=>x*x+z*z<70*70,0,0,8,
  {step:[3,5],len:24,fork:.12});
// 保留原空间累计d，只改变画面投影；不要用投影后的线段索引作生长时钟。
const ground=cracks.map(pts=>pts.map(([x,z,d])=>[x,z*.3,d]));
const colors=fit(['#17202d','#394452','#8f9d9b','#d8ead0'],5);
export function draw(p,t){
  const reach=Math.max(0,t-.7)*100;
  drawFractures(p,ground,reach,colors,{hot:false,a:1});
}
```

从同一d可在**线性**reach下求到达时刻`.7+d/100`，用以安排沿线尘屑；其他reach曲线需明确反函数或采样策略，helper不会自动生成稳定contact事件。局改几何时重建一次设计；不要在逐帧draw中消耗同一个可变Rng导致闪烁。多seed作品应按实际seed构建设计。

### pitfalls

增加数量不能替代可读的主支层次；尘和主体遮住前锋时先看原尺寸窗口与去光图。投影压缩会改变屏幕速度，d仍属于原设计空间。该helper不是可查询的拓扑SDK，也不提供大地网格破碎或刚体碰撞。

### evidence

完整参考效果：`ice/ice-shatter`、`ice/freeze`；另一地面画法见`impacts/heavy-landing`、`impacts/ground-slam`。在公开inspect中读效果source可看到参数与分层的实际接法。直接函数保留原算法，本轮只登记发现/契约/来源，不宣称其所有组合都已做独立审美验收。

## library/projected-rings

### overview

`arcane/arcane-orb`把同一圆压成深度椭圆，再在画面滚转，按近/远半环分层，在两次绘制之间画主体；`holy/halo`提供近厚远薄和行进亮点，`holy/heal-aoe`把光点放到增长的环上。它们是可重组的原效果片段，尚无独立“万能投影环”SDK。

### contract

`arcane-orb`内部`ring(p,C,s,R,near)`不是export，不能从该模块import ring。s为`{ph,cx,cy}`，R有`r,sy,rot,beads,turn,c`；原实现还读取D/Y0/TAU/WHITE等上下文。source返回原片段，完整上下文用effect inspect `arcane/arcane-orb`。

通用投影环已提炼为`core/orbit`并与`core/body`共享状态；需要共同中心/扩缩/环上发射速度时按需inspect这两份SDK契约。此处仍保留原私有参考片段及其原语义。

核心关系：先取`lx=cos(g)*r,ly=sin(g)*r*sy`，再用画面角rot旋转并加共同中心。`sin(g)>0`作为近侧标识；先远半环、再主体、后近半环。它是分层约定，不是任意球体/轨道的三维遮挡求解。亮点的g由时间推进；r、alpha和光强可分别绑定公开curve，但程序绘图不会自动读取particle.scale。

### example

以下是普通代码的组合起点，投影公式来自参考效果；不是新增SDK调用：

```js
const point=(cx,cy,r,sy,rot,g)=>{
  const x=Math.cos(g)*r,y=Math.sin(g)*r*sy,c=Math.cos(rot),s=Math.sin(rot);
  return [cx+x*c-y*s,cy+x*s+y*c];
};
// 中心/投影状态同样用于环上粒子、亮点和主体的锚点。
// 为远、近半环分别组点，用Painter线或core/path条带绘制；中间绘制主体。
const center=[0,-24],r=30,sy=.35,rot=-.2;
const near=[],far=[];
for(let i=0;i<=96;i++){
  const g=i/96*Math.PI*2;
  (Math.sin(g)>0?near:far).push(point(...center,r,sy,rot,g));
}
```

参考效果用逐点绘制，没有连接不连续片段的风险。改成连续条带时，在半环边界断开，不能跨接far/near空档。峰值持续时间用秒声明并检查实际保存帧；例如4/30秒在30fps是4个名义帧，在其他fps不能仍声称4帧。

### pitfalls

中心相同仍可能因倾角、压扁比例和遮挡不一致而显得脱离。短亮环与长期低亮主体描边分开设计；是否发光、何时扩缩消失由作者决定。black-hole的光线弯折是更专用的画法，不能拿一条平面椭圆替代其全部机制。

### evidence

完整公开参考：`arcane/arcane-orb`、`holy/halo`、`holy/heal-aoe`、`shadow/black-hole`。使用source时保留Sprite Fusion/Hugo Duprez/MIT署名。其私有函数仍是参考片段，不被标成可直接调用SDK。

## library/faceted-rocks

### overview

直接调用`nature/_lib.js`的单位不规则石形、分面光照、描边与受光边。适合碎石、飞散岩块与小型实体；山峰的宏观剪影、岩层与坍塌编排仍由作者设计。

### contract

- `stoneShape(R,n=R.int(5,7)) → [[u,v],...]`，R为core的Rng实例。单位尺度的不规则角序轮廓，生成时消耗Rng。
- `drawRock(p,x,y,s,a,pts,S,alpha=1,white=false)`，s为像素尺度、a为弧度、pts通常来自stoneShape，S为暗到亮Color32色阶，建议至少7阶；white使轮廓内部变为白色冲击帧。旧helper不做SDK级参数校验。
- s<1.4时使用小像素画法；大石头用模块内64×64工作区，扫描N上限62。不要假设任意放大仍完整；默认stoneShape配小碎石（例如s≤20）较适合，需要大山体时自写poly/shade或参考earth-spike的岩层/缺口。任意自定义pts也需检查范围。
- 同一shape应随角度旋转，避免逐帧新生成；多个碎块可拥有各自seed/shape。运动与接触可接SDK motion/contact，drawRock本身不求物理，也不返回观察身份。

### example

```js
import {Rng,fit} from '../../../src/core/index.js';
import {stoneShape,drawRock} from '../../../src/fx/nature/_lib.js';
const shape=stoneShape(new Rng(7));
const stone=fit(['#101522','#303442','#62616b','#a49b92','#e7d7ae'],8);
// 在作品draw中调用；位置/角度可由contact.trace或自己的共享状态决定。
// drawRock(p,x,y,9,angle,shape,stone,opacity);
```

### pitfalls

一个碎石helper不是大山体生成器；不要通过放大到工作区之外后再放宽asset验证来隐藏裁缺。分面明暗、尺寸层级和大块/细屑的接替应从原尺寸时序判断。

### evidence

完整参考`nature/boulder`、`nature/earth-spike`、`nature/quake`；源文件保留材料与上游来源说明。直接import现有helper，本轮没有重新实现其材质。

## library/impact-feedback

### overview

把同一次触地的短闪、暂停、压入、余震、裂痕和碎屑看作共享原因的响应。`nature/quake`提供可按绝对时间求值的指数衰减正弦；`heavy-landing/ground-slam`提供地面尘浪、裂痕与碎屑层次，`boulder`提供下落到撞击的接替。

### contract

这里是参考片段，没有export的通用shake/hitstop算子。quake的局部位移约为各冲击叠加`exp(-age*9)*sin(age*80)*amplitude`，age由同一触地时刻计算，单位为秒，输出为本地像素位移。作者可替换幅度/频率/衰减，并让主体与地面反馈消费同一状态。

core/act已有全局播放暂停和画面shake，**lab当前不播放完整act**；只在meta旁写act.hits不会在lab产生完整命中停顿。程序主体可显式映射局部时间，或在已支持的水平面范围中用contact的到达记录驱动响应。点与静态水平面的contact不等同于整个山体几何碰撞。

### example

```js
// 从nature/quake的局部衰减方式适配，普通艺术代码；保留原来源说明。
const impact=1.2;
const shake=t=>t<impact?0:Math.exp(-(t-impact)*9)*Math.sin((t-impact)*80)*3;
// 同一impact可驱动裂纹reach、一次性出生记录、短闪和退场。
// p.poly(bodyPoints.map(([x,y])=>[x+shake(t),y]),bodyColor);
```

暂停需明确谁暂停：主体、粒子、播放时间或整个画面。使用纯时间与稳定出生记录，避免在draw里反复累积二次发射。艺术化触地常量可用于演出；若声称真实接触时刻，应使用相应求解器的实际记录。

### pitfalls

镜头震动不替代山体压入/反冲和环境响应；过多细屑可能遮住触地与裂前锋。分别观察冲击前、接触帧、峰后与残留；验证通过不代表重量感成立。

### evidence

公开参考`nature/quake`、`nature/boulder`、`impacts/heavy-landing`、`impacts/ground-slam`。core/act这里只说明接入边界，不通过机制inspect暴露运行时实现。
