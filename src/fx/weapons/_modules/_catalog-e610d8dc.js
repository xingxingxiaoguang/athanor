// Artwork source: src/fx/weapons/_sources/4ea5012003a4fa325724/_catalog.js
// Approval candidates only. This catalog is deliberately outside src/fx.
import {buildBallistic,drawBallistic,observeBallistic} from './_ballistic-9dd753b8.js';
import {buildFluid,drawFluid,observeFluid} from './_fluids-064f8c5a.js';
import {buildEnergy,drawEnergy,observeEnergy,optics,chain} from './_energy-29204fac.js';
import {hex,body,particle,ray,arc,phase} from './_common-85a33fd1.js';
export {optics,chain};
export const WEAPONS=[
 {id:'gatling',name:'加特林机枪',family:'ballistic',stages:['launch-intro','launch','launch-outro','flight','hit'],desc:'12发/秒错相枪口、黄铜抛壳、独立曳光弹与金属击屑'},
 {id:'shotgun',name:'霰弹枪',family:'ballistic',stages:['launch','flight','hit'],desc:'宽焰扇与药烟、12枚独立散布弹丸、逐丸命中'},
 {id:'tank-he',name:'坦克榴弹',family:'ballistic',stages:['launch','flight','hit','explosion'],desc:'重炮膛压、榴弹高抛飞行、触地刺穿与高爆火烟破片'},
 {id:'tank-ap',name:'坦克穿甲弹',family:'ballistic',stages:['launch','flight','hit','exit'],desc:'细长高速弹芯、入口装甲火花、出口前向金属破片；无高爆火球'},
 {id:'tank-incendiary',name:'坦克燃烧弹',family:'ballistic',stages:['launch','flight','hit','explosion'],desc:'热封药罐、破壳溅射、非对称燃料铺火与烟炱'},
 {id:'tank-gas',name:'坦克毒气弹',family:'ballistic',stages:['launch','flight','hit','explosion'],desc:'密封毒气罐、破壳、贴地滚动低密度/高密度毒云'},
 {id:'water',name:'喷水枪',family:'fluid',stages:['launch-intro','launch','flight-intro','flight','hit-intro','hit','launch-outro','flight-outro','hit-outro'],desc:'压水口、连贯透明水柱、偏向反溅与圆形湿痕、真实停流尾部'},
 {id:'acid',name:'酸液枪',family:'fluid',stages:['launch-intro','launch','flight-intro','flight','hit-intro','hit','launch-outro','flight-outro','hit-outro'],desc:'粘稠分节酸柱、湿亮酸滴、蚀斑气泡与挥发余尾'},
 {id:'cold',name:'冷气枪',family:'fluid',stages:['launch-intro','launch','flight-intro','flight','hit-intro','hit','launch-outro','flight-outro','hit-outro'],desc:'冷凝喷口、锥状冷雾与晶粒、分叉冰脉及霜层退场'},
 {id:'sonic',name:'音波枪',family:'energy',stages:['launch','flight','hit'],desc:'空气压缩口、四重弧形压力前沿、低饱和冲压反馈'},
 {id:'laser-pierce',name:'贯穿激光',family:'energy',stages:['launch','flight','hit'],desc:'红白热切割束连续穿过三层装甲，真实入口/出口距离及能量衰减'},
 {id:'laser-bounce',name:'折射弹跳激光',family:'energy',stages:['launch','flight','reflect','hit'],desc:'玻璃入/出折射、两次镜面反射、独立转折节点与终点灼烧'},
 {id:'tesla',name:'特斯拉球状闪电',family:'energy',stages:['launch','flight','hit','explosion'],desc:'电荷汇聚、涡动电球与皮层电弧、接触放电和过载崩解'},
 {id:'chain',name:'闪电链',family:'energy',stages:['launch','flight','hit'],desc:'先导电击、按父链到达时刻推进与分叉、独立电灼节点'},
];
export const STAGE_LABELS={launch:'发射',flight:'弹道',hit:'击中',explosion:'爆炸/释放',exit:'穿甲出口',reflect:'反射节点','launch-intro':'开始发射','flight-intro':'启流弹道','hit-intro':'首次命中','launch-outro':'停火枪口余尾','flight-outro':'停流弹道余尾','hit-outro':'命中残留退场'};
function settings(w,stage){const base=stage.replace(/-(intro|outro)$/,''),outro=stage.includes('outro'),intro=stage.includes('intro'),fluid=w.family==='fluid',laser=w.id.startsWith('laser');let size,origin,duration,loop=false;
 if(fluid){size=base==='flight'?[240,160]:[192,192];origin=base==='flight'?[32,80]:[72,96];loop=!outro&&!intro;duration=intro?1:outro?(base==='hit'?1.8:1.2):1;}
 else if(base==='launch'){size=w.id.startsWith('tank')?[256,192]:[208,160];origin=w.id.startsWith('tank')?[80,96]:[56,80];duration=w.id==='gatling'?(outro?.9:1):w.id==='shotgun'?1.2:.7;if(w.id.startsWith('tank'))duration=1.6;loop=w.id==='gatling'&&!outro&&!intro;}
 else if(base==='flight'){if(w.id==='shotgun'){size=[240,160];origin=[32,80];duration=.7;}else if(w.family==='ballistic'){size=[176,112];origin=[128,56];duration=1;loop=true;}else if(w.id==='tesla'){size=[176,144];origin=[112,72];duration=1;loop=true;}else if(w.id==='sonic'){size=[240,192];origin=[32,96];duration=.8;}else{size=[352,256];origin=[32,96];duration=1.4;}}
 else if(base==='explosion'){size=[304,288];origin=[152,144];duration=w.id==='tank-incendiary'?3.6:w.id==='tank-gas'?4: w.id==='tesla'?1.4:3.4;}
 else{size=[224,208];origin=[112,104];duration=w.id==='tank-ap'?1.4:w.family==='ballistic'?.9:1.1;}
 if(w.id==='tesla'&&stage==='hit')duration=.3;
 if(w.id==='shotgun'&&base==='flight')duration=.65;
 return {size,origin,duration,loop};
}
export function part(weaponId,stage){const w=WEAPONS.find(w=>w.id===weaponId);if(!w||!w.stages.includes(stage))throw Error('Unknown candidate part');const config=settings(w,stage),meta={name:`${w.name} · ${STAGE_LABELS[stage]} [待审批]`,desc:w.desc+'；俯视、独立透明部件，以局部+x为发射方向，审批前不入正式库。',tags:['weapon','top-down','candidate',weaponId,stage,w.name,STAGE_LABELS[stage]],...config,fps:60,bg:'dark',options:{seed:53,...(stage.includes('outro')?{stopPhase:0}:{}),...(w.family==='fluid'||w.id==='sonic'?{range:128}:w.id==='laser-pierce'?{range:224}:{})}},authoring={ending:meta.loop?'loop':stage.includes('intro')?'handoff':'clear'};let cached;
 function model(o){const {frostActive,targetSampleTime,...stable}=o;const key=JSON.stringify(stable);if(cached?.key!==key){const build=w.family==='ballistic'?buildBallistic:w.family==='fluid'?buildFluid:buildEnergy;cached={key,value:build(weaponId,stage,stable)};}return cached.value;}
 function draw(p,t,o){if(!meta.loop&&(t>meta.duration||t===meta.duration&&authoring.ending==='clear'))return;if(weaponId==='tank-incendiary'&&stage==='explosion')o={...o,paintLayer:'front'};const tt=meta.loop?phase(t):t,m=model(o),fn=w.family==='ballistic'?drawBallistic:w.family==='fluid'?drawFluid:drawEnergy;fn(p,tt,o,m);}
 function drawBack(p,t,o){if(weaponId==='tank-incendiary'&&stage==='explosion'&&t<meta.duration)drawBallistic(p,t,{...o,paintLayer:'back'},model(o));}

 function observe(t,o){const tt=meta.loop?phase(t):t,m=model(o),fn=w.family==='ballistic'?observeBallistic:w.family==='fluid'?observeFluid:observeEnergy;return fn(m,tt,o);}
 function events(o){if(weaponId==='tesla'&&stage==='explosion'){const b=particle.observe(model(o).afterArcs,0).births;return {blast:0,...Object.fromEntries(b.map((x,i)=>['afterArc'+i,x.born+x.life*.5])),clear:meta.duration};}if(stage==='flight'&&w.id.startsWith('laser'))return Object.fromEntries(ray.events(optics(weaponId,o),{speed:1800}).map((h,i)=>['boundary'+i,h.time]));if(stage==='flight'&&w.id==='shotgun'){const births=particle.observe(model(o).pellets,0).births,times=births.map(b=>b.born+b.life);return {release:0,arrival:Math.min(...times),lastArrival:Math.max(...times),clear:meta.duration};}if(stage==='flight'&&w.id==='chain')return Object.fromEntries(arc.events(chain(o)).map((e,i)=>['hit'+i,e.time]));return meta.loop?{cycle:0}:stage.includes('outro')?{stop:0,clear:meta.duration}:stage==='flight'&&weaponId==='shotgun'?{release:0,arrival:.3,clear:meta.duration}:{release:0,clear:meta.duration};}
 return {meta,authoring,draw,drawBack,observe,events};
}
