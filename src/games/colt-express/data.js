const CHARACTERS = [
  { id: "ghost", name: "幽灵 Ghost", icon: "👻", color: "#e8e5dd", skill: "每轮第一次行动牌可以面朝下打出；若第一次行动选择摸牌，本轮失去该能力。" },
  { id: "belle", name: "贝尔 Belle", icon: "🌹", color: "#8d3d91", skill: "射击或拳击有其他合法目标时，不能选择贝尔。" },
  { id: "cheyenne", name: "夏安 Cheyenne", icon: "🪶", color: "#2e9365", skill: "拳击令对方掉落钱袋时，直接偷走该钱袋；珠宝和保险箱仍掉在地上。" },
  { id: "django", name: "姜戈 Django", icon: "💥", color: "#b64838", skill: "射击命中后，目标会沿远离姜戈的方向被击退一节车厢。" },
  { id: "doc", name: "医生 Doc", icon: "🧠", color: "#386fa8", skill: "每轮起手抽7张牌，而不是6张。" },
  { id: "tuco", name: "图科 Tuco", icon: "🎯", color: "#d59d2c", skill: "可以射击同一节车厢另一层的强盗。" }
];

const ACTION_COUNTS = { move: 2, floor: 2, shoot: 2, punch: 1, rob: 2, marshal: 1 };
const ACTION_NAMES = { move: "横向移动", floor: "上下车顶", shoot: "射击", punch: "拳击", rob: "抢劫", marshal: "移动警长" };
const ACTION_ICONS = { move: "➜", floor: "⇅", shoot: "✹", punch: "✊", rob: "💰", marshal: "★" };

const ROUND_PATTERNS = {
  small: [
    ["standard", "tunnel", "standard", "standard"],
    ["standard", "reverse", "tunnel", "standard"],
    ["tunnel", "standard", "double"],
    ["standard", "double", "standard"],
    ["reverse", "standard", "tunnel", "standard"],
    ["standard", "tunnel", "double"],
    ["tunnel", "reverse", "standard", "standard"]
  ],
  large: [
    ["standard", "tunnel", "standard"],
    ["standard", "reverse", "standard"],
    ["tunnel", "standard", "double"],
    ["standard", "double", "tunnel"],
    ["reverse", "tunnel", "standard"],
    ["standard", "tunnel", "double"],
    ["tunnel", "reverse", "standard"]
  ]
};

const EVENTS = ["braking", "angry-marshal", "swivel-arm", "take-it-all", "passenger-rebellion", "pickpocketing", "hostage-conductor", "marshal-revenge"];
const EVENT_INFO = {
  "braking": { name: "紧急刹车", icon: "⚠️", detail: "本轮全部行动执行完后，所有位于车顶的强盗都向车头方向移动1节车厢。" },
  "angry-marshal": { name: "愤怒的警长", icon: "💢", detail: "本轮全部行动执行完后，警长所在车厢顶部的强盗各获得1张中立子弹；随后警长向车尾移动1节，并照常赶走新车厢内的强盗。" },
  "swivel-arm": { name: "旋转吊臂", icon: "🪝", detail: "本轮全部行动执行完后，所有位于车顶的强盗都会被吊臂扫到车尾最后一节车厢的车顶。" },
  "take-it-all": { name: "全部拿走", icon: "🧰", detail: "本轮全部行动执行完后，在警长当前所在车厢的内部额外放置1个价值$1000的保险箱，之后可以被抢劫。" },
  "passenger-rebellion": { name: "乘客反抗", icon: "💢", detail: "本轮全部行动执行完后，所有仍位于车厢内部的强盗各获得1张中立子弹；车顶强盗不受影响。" },
  "pickpocketing": { name: "顺手牵羊", icon: "🫳", detail: "本轮全部行动执行完后，若一名强盗独自占据某节车厢的一层，且该位置有钱袋，他会自动拿走其中1个钱袋。" },
  "hostage-conductor": { name: "劫持列车长", icon: "🎩", detail: "本轮全部行动执行完后，位于车头内部或车头顶部的每名强盗都会获得价值$250的赎金。" },
  "marshal-revenge": { name: "警长复仇", icon: "⭐", detail: "本轮全部行动执行完后，位于警长所在车厢顶部的每名强盗，都要把自己价值最低的1个钱袋丢在当前车顶。" }
};

module.exports = { CHARACTERS, ACTION_COUNTS, ACTION_NAMES, ACTION_ICONS, ROUND_PATTERNS, EVENTS, EVENT_INFO };
