const HEROES = {
  knight:{id:"knight",name:"铁皮骑士",icon:"🛡️",maxHp:18,power:3,skill:"格挡反击",desc:"护甲厚实；每场战斗首次受伤减少2点。"},
  ranger:{id:"ranger",name:"纸上游侠",icon:"🏹",maxHp:14,power:4,skill:"稳准一击",desc:"每场战斗可发动一次技能，让下一击至少命中。"},
  alchemist:{id:"alchemist",name:"墨水炼金师",icon:"⚗️",maxHp:15,power:3,skill:"爆裂墨水",desc:"每场战斗可投掷一次无视靶心的5点伤害药剂。"}
};

const ENEMIES = [
  {name:"钉书钉史莱姆",icon:"🟢",hp:7,attack:2,quote:"它黏住了书页，也黏住了你的靴子。"},
  {name:"橡皮地精",icon:"👺",hp:9,attack:2,quote:"它最喜欢擦掉冒险者的遗言。"},
  {name:"墨渍幽灵",icon:"👻",hp:8,attack:3,quote:"黑墨从空白处渗了出来。"},
  {name:"卷尺蜘蛛",icon:"🕷️",hp:11,attack:3,quote:"每一条腿都精确得令人不安。"},
  {name:"碎纸机魔像",icon:"🗿",hp:13,attack:4,quote:"它的胸腔里传来纸张粉碎的声音。"}
];

const BOSSES = [
  {name:"装订深渊之口",icon:"📕",hp:27,attack:4,quote:"封面裂开，整座地牢开始翻页。"},
  {name:"千眼绘图师",icon:"👁️",hp:24,attack:5,quote:"它已经画好了你的结局。"}
];

const RELICS = [
  {id:"sharp",name:"永不折断的铅芯",icon:"✏️",desc:"所有命中额外造成1点伤害。",effect:"power"},
  {id:"armor",name:"硬壳速写本",icon:"📓",desc:"最大生命+4并恢复4点。",effect:"hp"},
  {id:"clover",name:"四叶书签",icon:"🍀",desc:"擦伤会按照普通命中结算。",effect:"graze"},
  {id:"ink",name:"猩红墨水",icon:"🩸",desc:"暴击额外造成3点伤害。",effect:"crit"},
  {id:"thermos",name:"冒险者保温杯",icon:"☕",desc:"进入新房间时恢复1点生命。",effect:"regen"},
  {id:"eraser",name:"命运橡皮",icon:"⬜",desc:"每场战斗第一次落空不受反击。",effect:"missGuard"}
];

module.exports={HEROES,ENEMIES,BOSSES,RELICS};
