# 到达、累计与主体变化（0.11候选）

实际检查第一基石`src/fx/shadow/black-hole.js:draw/at`的寿命幂次径向/螺旋接近、前后遮挡与阈值发亮，`src/fx/explosions/implosion.js:create`的反求内收速度/分批收环/寿命位移。这些仍主要按时间和半径判断，不能冒充已有到达累计协议；没有整件移植或移除源署名（black-hole与implosion内Sprite Fusion MIT署名保留）。

运动直接复用0.8已提炼`skill.infall`（原spell-charge内收与可动源导数），任意其他路径可用`particle.track`闭合端点。`gather.js:fromParticles/fromTracks`调用现有track.sample(end)，保留真实终点/速度与父身份；没有复制运动内核。新的records/sample/births/bind只补原地爆天星生产中手写的到达表、权重归约、响应出生与真实Body数据绑定，不替作者决定增长美术。

第二基石重新检查已获取生产包`index-Dc9n0jGG.js` SHA256 7433af92a9dc349801b6bf3d0e38fb52bc9b45aec7113e4f8e307cd94129eeba：字符414344起为blackholeDelay/DistanceDelay/KillRadius/TravelTime；553408距离延迟，554872半径阈值与逐步加速度，555524路径travelTime。它区分等待、输送、寿命/消失；其步进半径销毁不等于我方精确到达证明。因此首波限已知目标/闭合轨迹，accept为作者声明的终点域筛选，未新建连续碰撞求交。

权重允许负数和任意有限值，轮廓、沉积位置、热度、夸张、释放消耗都是普通JS；body.data携带真实累计，不用假粒子作见证。稳定事件按时间/ID排序，查询无副作用，乱序/跨fps不重记。技术测试与下一份独立作者B场景验证分开。
