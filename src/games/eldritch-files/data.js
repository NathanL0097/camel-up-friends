const INVESTIGATORS=[
 {id:"detective",name:"伊莱亚斯·沃德",title:"不眠侦探",icon:"🕵️",will:3,intellect:4,combat:3,agility:2,health:8,sanity:6,ability:"每轮第一次调查获得+1技能值。"},
 {id:"doctor",name:"薇奥拉·摩尔",title:"战地医生",icon:"👩‍⚕️",will:4,intellect:3,combat:2,agility:3,health:6,sanity:8,ability:"每轮一次，行动：自己或同地点队友恢复1点生命。"},
 {id:"professor",name:"阿瑟·贝尔",title:"禁书教授",icon:"👨‍🏫",will:4,intellect:5,combat:1,agility:2,health:5,sanity:9,ability:"揭示触手标记时可改为-2，每局一次。"},
 {id:"veteran",name:"露丝·凯恩",title:"退役探员",icon:"🧥",will:2,intellect:2,combat:5,agility:3,health:9,sanity:5,ability:"每轮第一次攻击造成额外1点伤害。"}
];
const LOCATIONS={
 foyer:{id:"foyer",name:"黑荆宅邸门厅",icon:"🕯️",shroud:2,clues:1,connections:["study","garden"],text:"雨水沿着画像的眼眶缓慢流下。"},
 study:{id:"study",name:"封闭书房",icon:"📚",shroud:3,clues:2,connections:["foyer","archive"],text:"书架之后传来规律的敲击声。"},
 garden:{id:"garden",name:"枯死温室",icon:"🥀",shroud:2,clues:2,connections:["foyer","cellar"],text:"没有根的藤蔓缠住了玻璃。"},
 archive:{id:"archive",name:"家族档案室",icon:"🗄️",shroud:4,clues:2,connections:["study","tower"],lockedAct:2,text:"失踪者的姓名全用同一种墨水写成。"},
 cellar:{id:"cellar",name:"潮湿地下室",icon:"⛓️",shroud:3,clues:2,connections:["garden","tower"],lockedAct:2,text:"地板之下有某种东西正在呼吸。"},
 tower:{id:"tower",name:"无窗塔楼",icon:"🌘",shroud:5,clues:3,connections:["archive","cellar"],lockedAct:3,text:"月光从不存在的窗户照了进来。"}
};
const PLAYER_CARDS=[
 {id:"lens",name:"黄铜放大镜",type:"asset",cost:2,stat:"intellect",bonus:1,icon:"🔍",text:"调查时学识+1。"},
 {id:"revolver",name:"旧式左轮",type:"asset",cost:3,stat:"combat",bonus:1,damage:1,icon:"🔫",text:"攻击+1，命中额外造成1点伤害。"},
 {id:"charm",name:"银质护符",type:"asset",cost:2,stat:"will",bonus:1,icon:"📿",text:"意志检定+1。"},
 {id:"boots",name:"轻便长靴",type:"asset",cost:2,stat:"agility",bonus:1,icon:"🥾",text:"敏捷检定+1。"},
 {id:"coat",name:"厚呢大衣",type:"asset",cost:2,health:2,icon:"🧥",text:"可额外承受2点伤害。"},
 {id:"notes",name:"潦草笔记",type:"event",cost:1,icon:"📝",text:"发现1条线索。",event:"clue"},
 {id:"firstaid",name:"急救绷带",type:"event",cost:1,icon:"🩹",text:"恢复2点生命。",event:"heal"},
 {id:"courage",name:"液体勇气",type:"event",cost:1,icon:"🥃",text:"恢复2点神智。",event:"sanity"}
];
const ENEMIES=[
 {name:"失声管家",icon:"🤵",fight:2,evade:3,health:3,damage:1,horror:1},
 {name:"墙中猎犬",icon:"🐕",fight:3,evade:2,health:4,damage:2,horror:0,hunter:true},
 {name:"缝脸信徒",icon:"🧟",fight:3,evade:3,health:3,damage:1,horror:1},
 {name:"月影眷族",icon:"🦑",fight:4,evade:3,health:5,damage:1,horror:2,hunter:true}
];
const TREACHERIES=[
 {name:"门后的低语",icon:"🚪",stat:"will",difficulty:3,damage:0,horror:2,text:"失败：受到2点恐惧。"},
 {name:"腐朽地板",icon:"🪵",stat:"agility",difficulty:3,damage:2,horror:0,text:"失败：受到2点伤害。"},
 {name:"禁忌记忆",icon:"🕳️",stat:"will",difficulty:4,damage:0,horror:2,text:"失败：受到2点恐惧。"},
 {name:"抓挠的黑暗",icon:"🫳",stat:"agility",difficulty:2,damage:1,horror:1,text:"失败：受到1点伤害与1点恐惧。"}
];
module.exports={INVESTIGATORS,LOCATIONS,PLAYER_CARDS,ENEMIES,TREACHERIES};
