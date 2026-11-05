export const RECIPES = [
  {
    id: "propagation", name: "传播 → 到达 → 生长", words: "ice frost crystal nova 冰霜 晶体 扩散 生长",
    mechanism: "Use one expanding front. Invert its distance curve to obtain each site's arrival time; trigger growth and fragments from that same time.",
    references: ["ice/frost-nova", "nature/earth-spike", "lab/cryo-bloom"],
    decisions: ["Is the silhouette a crown, a flat wave, or a directional wedge?", "Should growth overtake the wave or follow it?"],
    failures: ["Simultaneous growth loses the propagation cue.", "Too many equally tall spikes destroy the focal point."],
  },
  {
    id: "head-tail", name: "快速前缘 + 延迟尾迹", words: "slash sword arc trail melee 刀光 拖尾 斩击",
    mechanism: "Move the leading edge with a fast curve, then let a separately timed tail consume the shape. Width, color age and tip accents follow the trajectory.",
    references: ["melee/sword-slash", "melee/heavy-cleave"],
    decisions: ["Which direction should read in the first two frames?", "How much silhouette should survive after contact?"],
    failures: ["Constant-width arcs look mechanical.", "Sparks cannot rescue a weak main gesture."],
  },
  {
    id: "burst-decay", name: "释放 → 碎屑 → 落地 → 残留", words: "explosion fire smoke impact debris 爆炸 火 烟 碎屑",
    mechanism: "Share release timing across flash, rings and burst emitters. Let debris contact spawn dust; cool fire into smoke and give residue its own decay.",
    references: ["explosions/small-explosion", "impacts/ground-slam"],
    decisions: ["Where is the mass concentrated?", "What environmental trace should remain?"],
    failures: ["Uniform emission reads as confetti.", "An oversized glow erases material and structure."],
  },
  {
    id: "periodic-flow", name: "周期场 + 连贯流动", words: "loop portal waterfall fire noise 循环 传送门 水流 火焰",
    mechanism: "Derive motion from phase, tile noise over whole lattice periods and key random values by particle identity. A particle may have multiple live copies across the loop boundary.",
    references: ["water/waterfall", "arcane/portal", "fire/torch"],
    decisions: ["Which large shape stays stable?", "Where should fine detail flow, break off or collect?"],
    failures: ["Reseeding every frame causes flicker.", "Matching only the first and last image can still hide a velocity discontinuity."],
  },
];
