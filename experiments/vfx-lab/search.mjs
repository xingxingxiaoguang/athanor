// Deterministic game vocabulary and whole-word relevance. Alternatives are OR
// within one query term; separate query terms remain AND on the same entry.
const aliases = {
  '伤害':['damage'], '暴击':['critical','crit'], crit:['critical','crit'],
  '命中':['hit','impact'], '受击':['hurt','hit','damage'], '闪白':['flash'],
  '技能':['skill','spell','moves','projectile','melee','beam','charge'],
  '状态':['status'], '增益':['buff','heal','holy'], '减益':['status','poison','burning','frozen'],
  '防御':['block','shield','parry'], '格挡':['block','parry'], '招架':['parry'],
  '伤害数字':['damage-number','crit-number'], '伤害文字':['damage-number','crit-number'],
};
const tokens = text => String(text??'').toLowerCase().match(/[a-z0-9]+/g)??[];
export function relevance(query,{id='',name='',description='',tags=[],words=''}={}) {
  const terms=String(query??'').toLowerCase().trim().split(/\s+/).filter(Boolean);
  const fields=[[id,100],[tags.join(' '),80],[name,60],[words,40],[description,10]];
  let score=0;
  for(const term of terms){
    const alternatives=aliases[term]??[term];let best=0;
    for(const alternative of alternatives)for(const [field,weight]of fields){
      const text=String(field).toLowerCase(),needle=tokens(alternative);
      const found=/[^\x00-\x7f]/.test(alternative)?text.includes(alternative):needle.length>1?text.includes(alternative):tokens(text).some(w=>w===alternative||w===`${alternative}s`);
      if(found)best=Math.max(best,weight+(text===alternative?100:0));
    }
    if(!best)return 0;score+=best;
  }
  return score+(id.toLowerCase()===String(query).toLowerCase()?1000:0)||1;
}
