const RESOURCE_META = {
  wood: { name: "木材", icon: "🪵" }, stone: { name: "石材", icon: "🪨" }, clay: { name: "黏土", icon: "🧱" },
  glass: { name: "玻璃", icon: "🔷" }, papyrus: { name: "纸莎草", icon: "📜" }
};

const TYPE_META = {
  raw: { name: "原材料", color: "brown", icon: "⛏" }, manufactured: { name: "制成品", color: "gray", icon: "⚙" },
  civilian: { name: "市政", color: "blue", icon: "🏛" }, scientific: { name: "科学", color: "green", icon: "⚗" },
  commercial: { name: "商业", color: "yellow", icon: "⚖" }, military: { name: "军事", color: "red", icon: "⚔" },
  guild: { name: "行会", color: "purple", icon: "♛" }
};

const c = (id, name, age, type, effect = {}) => ({ id, name, age, type, ...effect });

const CARDS = [
  c("lumber-yard", "林场", 1, "raw", { produces: { wood: 1 } }),
  c("stone-pit", "采石坑", 1, "raw", { coinCost: 1, produces: { stone: 1 } }),
  c("clay-pool", "黏土池", 1, "raw", { produces: { clay: 1 } }),
  c("logging-camp", "伐木营地", 1, "raw", { coinCost: 1, produces: { wood: 1 } }),
  c("quarry", "石料场", 1, "raw", { produces: { stone: 1 } }),
  c("clay-pit", "黏土坑", 1, "raw", { coinCost: 1, produces: { clay: 1 } }),
  c("glassworks", "玻璃工坊", 1, "manufactured", { coinCost: 1, produces: { glass: 1 } }),
  c("press", "造纸坊", 1, "manufactured", { coinCost: 1, produces: { papyrus: 1 } }),
  c("guard-tower", "警戒塔", 1, "military", { shields: 1 }),
  c("workshop", "工艺作坊", 1, "scientific", { cost: { papyrus: 1 }, science: "geometry", vp: 1 }),
  c("apothecary", "药剂铺", 1, "scientific", { cost: { glass: 1 }, science: "wheel", vp: 1 }),
  c("stone-reserve", "石材储备所", 1, "commercial", { coinCost: 3, trades: ["stone"] }),
  c("clay-reserve", "黏土储备所", 1, "commercial", { coinCost: 3, trades: ["clay"] }),
  c("wood-reserve", "木材储备所", 1, "commercial", { coinCost: 3, trades: ["wood"] }),
  c("stable", "马厩", 1, "military", { cost: { wood: 1 }, shields: 1, link: "stable" }),
  c("scriptorium", "缮写室", 1, "scientific", { coinCost: 2, science: "writing", link: "scriptorium" }),
  c("theater", "剧场", 1, "civilian", { vp: 3, link: "theater" }),
  c("tavern", "酒馆", 1, "commercial", { coins: 4, link: "tavern" }),
  c("altar", "祭坛", 1, "civilian", { vp: 3, link: "altar" }),
  c("baths", "浴场", 1, "civilian", { cost: { stone: 1 }, vp: 3, link: "baths" }),
  c("garrison", "驻军营", 1, "military", { cost: { clay: 1 }, shields: 1, link: "garrison" }),
  c("pharmacist", "药师", 1, "scientific", { coinCost: 2, science: "mortar", link: "pharmacist" }),
  c("palisade", "木栅", 1, "military", { coinCost: 1, shields: 1, link: "palisade" }),

  c("sawmill", "锯木厂", 2, "raw", { coinCost: 2, produces: { wood: 2 } }),
  c("shelf-quarry", "层岩采石场", 2, "raw", { coinCost: 2, produces: { stone: 2 } }),
  c("brickyard", "砖窑", 2, "raw", { coinCost: 2, produces: { clay: 2 } }),
  c("forum", "广场市场", 2, "commercial", { coinCost: 1, cost: { clay: 1 }, producesOneOf: ["glass", "papyrus"] }),
  c("caravansery", "商旅驿站", 2, "commercial", { coinCost: 2, cost: { glass: 1, papyrus: 1 }, producesOneOf: ["wood", "stone", "clay"] }),
  c("customs-house", "海关", 2, "commercial", { coinCost: 4, trades: ["glass", "papyrus"] }),
  c("tribunal", "审判庭", 2, "civilian", { cost: { wood: 2, glass: 1 }, vp: 5 }),
  c("glass-blower", "吹玻璃坊", 2, "manufactured", { produces: { glass: 1 } }),
  c("drying-room", "晾纸房", 2, "manufactured", { produces: { papyrus: 1 } }),
  c("walls", "城墙", 2, "military", { cost: { wood: 2 }, shields: 2 }),
  c("brewery", "酿酒坊", 2, "commercial", { coins: 6, link: "brewery" }),
  c("archery-range", "射箭场", 2, "military", { cost: { stone: 1, wood: 1, papyrus: 1 }, shields: 2, link: "archery-range" }),
  c("parade-ground", "阅兵场", 2, "military", { cost: { clay: 2, papyrus: 1 }, shields: 2, link: "parade-ground" }),
  c("horse-breeders", "育马场", 2, "military", { cost: { clay: 1, wood: 1 }, shields: 1, freeLink: "stable" }),
  c("library", "图书馆", 2, "scientific", { cost: { stone: 1, wood: 1, glass: 1 }, science: "writing", vp: 2, freeLink: "scriptorium" }),
  c("statue", "雕像", 2, "civilian", { cost: { clay: 2 }, vp: 4, link: "statue", freeLink: "theater" }),
  c("temple", "神庙", 2, "civilian", { cost: { wood: 1, papyrus: 1 }, vp: 4, link: "temple", freeLink: "altar" }),
  c("rostrum", "演说台", 2, "civilian", { cost: { stone: 1, wood: 1 }, vp: 4, link: "rostrum" }),
  c("aqueduct", "引水渠", 2, "civilian", { cost: { stone: 3 }, vp: 5, freeLink: "baths" }),
  c("school", "学堂", 2, "scientific", { cost: { wood: 1, papyrus: 2 }, science: "wheel", vp: 1, link: "school" }),
  c("barracks", "军营", 2, "military", { coinCost: 3, shields: 1, freeLink: "garrison" }),
  c("dispensary", "医务所", 2, "scientific", { cost: { clay: 2, stone: 1 }, science: "mortar", vp: 2, freeLink: "pharmacist" }),
  c("laboratory", "实验室", 2, "scientific", { cost: { wood: 1, glass: 2 }, science: "geometry", vp: 1, link: "laboratory" }),

  c("chamber-commerce", "商会", 3, "commercial", { cost: { papyrus: 2 }, vp: 3, coinsPer: { manufactured: 3 } }),
  c("port", "港口", 3, "commercial", { cost: { wood: 1, glass: 1, papyrus: 1 }, vp: 3, coinsPer: { raw: 2 } }),
  c("armory", "军械库", 3, "commercial", { cost: { stone: 2, glass: 1 }, vp: 3, coinsPer: { military: 1 } }),
  c("arsenal", "兵工厂", 3, "military", { cost: { clay: 3, wood: 2 }, shields: 3 }),
  c("praetorium", "禁卫营", 3, "military", { coinCost: 8, shields: 3 }),
  c("academy", "学院", 3, "scientific", { cost: { stone: 1, wood: 1, glass: 2 }, science: "sundial", vp: 3 }),
  c("study", "研究院", 3, "scientific", { cost: { wood: 2, glass: 1, papyrus: 1 }, science: "sundial", vp: 3 }),
  c("palace", "宫殿", 3, "civilian", { cost: { stone: 1, wood: 1, clay: 1, glass: 2 }, vp: 7 }),
  c("town-hall", "市政厅", 3, "civilian", { cost: { stone: 3, wood: 2 }, vp: 7 }),
  c("obelisk", "方尖碑", 3, "civilian", { cost: { stone: 2, glass: 1 }, vp: 5 }),
  c("lighthouse", "灯塔", 3, "commercial", { cost: { clay: 2, glass: 1 }, coinsPer: { commercial: 1 }, freeLink: "tavern" }),
  c("gardens", "空中花园", 3, "civilian", { cost: { wood: 2, clay: 2 }, vp: 6, freeLink: "statue" }),
  c("arena", "竞技场", 3, "commercial", { cost: { clay: 1, stone: 1, wood: 1 }, vp: 3, coinsPer: { wonder: 2 }, freeLink: "brewery" }),
  c("pantheon", "万神殿", 3, "civilian", { cost: { clay: 1, wood: 1, papyrus: 2 }, vp: 6, freeLink: "temple" }),
  c("senate", "元老院", 3, "civilian", { cost: { clay: 1, stone: 1, papyrus: 2 }, vp: 6, freeLink: "rostrum" }),
  c("university", "大学", 3, "scientific", { cost: { clay: 1, glass: 1, papyrus: 1 }, science: "astrolabe", vp: 2, freeLink: "school" }),
  c("siege-workshop", "攻城工坊", 3, "military", { cost: { wood: 3, glass: 1 }, shields: 2, freeLink: "archery-range" }),
  c("observatory", "天文台", 3, "scientific", { cost: { stone: 1, papyrus: 2 }, science: "astrolabe", vp: 2, freeLink: "laboratory" }),
  c("circus", "大竞技场", 3, "military", { cost: { clay: 2, stone: 2 }, shields: 2, freeLink: "parade-ground" }),
  c("fortifications", "防御工事", 3, "military", { cost: { stone: 2, clay: 1, papyrus: 1 }, shields: 2, freeLink: "palisade" }),

  c("guild-merchants", "商人行会", 3, "guild", { guildMetric: "commercial", coinPer: 1, vpPer: 1, cost: { wood: 1, clay: 1, glass: 1, papyrus: 1 } }),
  c("guild-shipowners", "船主行会", 3, "guild", { guildMetric: "resources", coinPer: 1, vpPer: 1, cost: { stone: 1, clay: 1, glass: 1, papyrus: 1 } }),
  c("guild-builders", "建筑师行会", 3, "guild", { guildMetric: "wonder", vpPer: 2, cost: { stone: 2, wood: 1, clay: 1, glass: 1 } }),
  c("guild-magistrates", "执政官行会", 3, "guild", { guildMetric: "civilian", coinPer: 1, vpPer: 1, cost: { wood: 2, clay: 1, papyrus: 1 } }),
  c("guild-scientists", "科学家行会", 3, "guild", { guildMetric: "scientific", coinPer: 1, vpPer: 1, cost: { clay: 2, wood: 2 } }),
  c("guild-moneylenders", "放贷人行会", 3, "guild", { guildMetric: "coins", vpPer: 1, cost: { stone: 2, wood: 2 } }),
  c("guild-tacticians", "战术家行会", 3, "guild", { guildMetric: "military", coinPer: 1, vpPer: 1, cost: { stone: 2, clay: 1, papyrus: 1 } })
];

const w = (id, name, cost, effect) => ({ id, name, cost, ...effect });
const WONDERS = [
  w("appian-way", "亚壁古道", { stone: 2, clay: 2, papyrus: 1 }, { coins: 3, destroyCoins: 3, vp: 3, extraTurn: true, icon: "🛤️" }),
  w("circus-maximus", "马克西穆斯竞技场", { stone: 2, wood: 1, glass: 1 }, { destroyType: "manufactured", shields: 1, vp: 3, icon: "🏟️" }),
  w("colossus", "罗德岛巨像", { clay: 3, glass: 1 }, { shields: 2, vp: 3, icon: "🗿" }),
  w("great-library", "亚历山大图书馆", { wood: 3, papyrus: 1, glass: 1 }, { special: "hidden-progress", vp: 4, icon: "📚" }),
  w("great-lighthouse", "法罗斯灯塔", { wood: 1, stone: 1, papyrus: 2 }, { producesOneOf: ["wood", "stone", "clay"], vp: 4, icon: "🗼" }),
  w("hanging-gardens", "巴比伦空中花园", { wood: 2, papyrus: 1, glass: 1 }, { coins: 6, vp: 3, extraTurn: true, icon: "🌿" }),
  w("mausoleum", "摩索拉斯陵墓", { clay: 2, glass: 2, papyrus: 1 }, { special: "discard-build", vp: 2, icon: "⚱️" }),
  w("piraeus", "比雷埃夫斯港", { wood: 2, stone: 1, clay: 1 }, { producesOneOf: ["glass", "papyrus"], vp: 2, extraTurn: true, icon: "⛵" }),
  w("pyramids", "吉萨金字塔", { stone: 3, papyrus: 1 }, { vp: 9, icon: "🔺" }),
  w("sphinx", "狮身人面像", { stone: 1, clay: 1, glass: 2 }, { vp: 6, extraTurn: true, icon: "🦁" }),
  w("statue-zeus", "宙斯神像", { wood: 1, stone: 1, clay: 1, papyrus: 2 }, { destroyType: "raw", shields: 1, vp: 3, icon: "⚡" }),
  w("temple-artemis", "阿耳忒弥斯神庙", { wood: 1, stone: 1, glass: 1, papyrus: 1 }, { coins: 12, extraTurn: true, icon: "🌙" })
];

const p = (id, name, effect) => ({ id, name, ...effect });
const PROGRESS = [
  p("agriculture", "农业", { coins: 6, vp: 4, icon: "🌾", text: "立即获得6金币，并价值4分。" }),
  p("architecture", "建筑学", { discount: "wonder", icon: "📐", text: "今后建造奇迹少支付2个资源。" }),
  p("economy", "经济学", { special: "economy", icon: "🪙", text: "对手购买资源时，你获得其资源交易费用。" }),
  p("law", "法学", { science: "law", icon: "⚖️", text: "提供一种独立的科学符号。" }),
  p("masonry", "砌筑术", { discount: "civilian", icon: "🧱", text: "今后建造蓝色市政建筑少支付2个资源。" }),
  p("mathematics", "数学", { special: "mathematics", icon: "∑", text: "终局时每枚进步标记价值3分，包括本标记。" }),
  p("philosophy", "哲学", { vp: 7, icon: "🦉", text: "价值7分。" }),
  p("strategy", "战略", { special: "strategy", icon: "♞", text: "今后每张红色军事建筑额外增加1盾。" }),
  p("theology", "神学", { special: "theology", icon: "☀️", text: "今后建造的奇迹都视为拥有额外回合。" }),
  p("urbanism", "城市规划", { coins: 6, special: "urbanism", icon: "🏙️", text: "立即获得6金币；连锁免费建造时再获得4金币。" })
];

const LAYOUTS = [
  [[2,5],[2,7],[3,4],[3,6],[3,8],[4,3],[4,5],[4,7],[4,9],[5,2],[5,4],[5,6],[5,8],[5,10],[6,1],[6,3],[6,5],[6,7],[6,9],[6,11]],
  [[2,1],[2,3],[2,5],[2,7],[2,9],[2,11],[3,2],[3,4],[3,6],[3,8],[3,10],[4,3],[4,5],[4,7],[4,9],[5,4],[5,6],[5,8],[6,5],[6,7]],
  [[1,5],[1,7],[2,4],[2,6],[2,8],[3,3],[3,5],[3,7],[3,9],[4,4],[4,8],[5,3],[5,5],[5,7],[5,9],[6,4],[6,6],[6,8],[7,5],[7,7]]
];
const VISIBLE_ROWS = [[2,4,6],[2,4,6],[1,3,5,7]];

module.exports = { RESOURCE_META, TYPE_META, CARDS, WONDERS, PROGRESS, LAYOUTS, VISIBLE_ROWS };
