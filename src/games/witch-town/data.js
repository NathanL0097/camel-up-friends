const CHARACTERS = [
  { id: "abigail", name: "阿比盖尔·威廉姆斯", icon: "🕯️", title: "执拗的证人", text: "你打出最后一点指控并触发审判时，移除自己面前的全部指控。" },
  { id: "ann", name: "安·普特南", icon: "🪶", title: "敏锐的控告者", text: "你触发审判时，在揭示审判牌前额外抽2张牌。" },
  { id: "cotton", name: "科顿·马瑟", icon: "📖", title: "受敬重的牧师", text: "别人对你打出的“证据”只计1点指控。" },
  { id: "giles", name: "贾尔斯·科里", icon: "🪨", title: "坚毅的农夫", text: "抽牌行动抽到2张普通“指控”时，公开它们并再抽1张。" },
  { id: "george", name: "乔治·伯勒斯", icon: "⛪", title: "强韧的牧师", text: "你需要累计8点而非7点指控才会受审。" },
  { id: "john", name: "约翰·普罗克特", icon: "🔑", title: "遗物保管人", text: "其他玩家出局时，你接收其手牌与蓝色持续牌。" },
  { id: "martha", name: "玛莎·科里", icon: "🪞", title: "善于仿效", text: "你拥有右手边第一位存活玩家的角色能力。" },
  { id: "mary", name: "玛丽·沃伦", icon: "🐈", title: "不受牵连", text: "黑猫与媒人的不利效果对你无效。" },
  { id: "rebecca", name: "丽贝卡·纳斯", icon: "🌿", title: "冷静的观察者", text: "其他玩家因指控或黑猫揭示审判牌时，你抽1张牌。" },
  { id: "samuel", name: "塞缪尔·帕里斯", icon: "♻️", title: "旧案重提", text: "每局2次：用回合行动从弃牌堆取至多2张普通牌。" },
  { id: "sarah", name: "莎拉·古德", icon: "🔥", title: "无处可夺", text: "对你使用的“纵火”和“抢劫”无效。" },
  { id: "thomas", name: "托马斯·丹福斯", icon: "⚖️", title: "严厉法官", text: "你使一名玩家恰好达到6点指控时，立即触发一次审判。" },
  { id: "tituba", name: "蒂图芭", icon: "🔮", title: "窥见牌堆", text: "每局1次：抽牌前查看并重新排列牌堆顶部5张牌。" },
  { id: "will", name: "威尔·格里格斯", icon: "🩺", title: "扭转证词", text: "你可把“脱罪证词”当作7点“目击证人”打出。" },
  { id: "william", name: "威廉·菲普斯", icon: "🛡️", title: "免证忏悔", text: "每局1次：夜晚忏悔时不必揭示审判牌。" }
];

const CARD_KINDS = {
  accusation: { color: "red", icon: "✕", label: "指控" },
  evidence: { color: "red", icon: "✕✕✕", label: "证据" },
  witness: { color: "red", icon: "⚖", label: "目击证人" },
  alibi: { color: "green", icon: "🪶", label: "脱罪证词" },
  arson: { color: "green", icon: "🔥", label: "纵火" },
  curse: { color: "green", icon: "🕯", label: "诅咒" },
  robbery: { color: "green", icon: "🗝", label: "抢劫" },
  scapegoat: { color: "green", icon: "🐐", label: "替罪羊" },
  asylum: { color: "blue", icon: "🏠", label: "庇护所" },
  matchmaker: { color: "blue", icon: "💞", label: "媒人" },
  piety: { color: "blue", icon: "🙏", label: "虔诚" },
  stocks: { color: "blue", icon: "⛓", label: "枷锁" },
  conspiracy: { color: "black", icon: "🕸", label: "阴谋" },
  night: { color: "black", icon: "🌙", label: "夜幕" }
};

const CARD_TEXT = {
  accusation: "放在另一名玩家面前，增加1点指控。",
  evidence: "放在另一名玩家面前，增加3点指控。",
  witness: "放在另一名玩家面前，增加7点指控。",
  alibi: "移除另一名玩家面前最多3张红色指控牌。",
  arson: "令另一名玩家弃掉全部手牌。",
  curse: "弃掉另一名玩家面前1张蓝色持续牌。",
  robbery: "把一名玩家的全部手牌交给另一名玩家。",
  scapegoat: "把一名玩家面前全部红、绿、蓝牌移到另一名玩家面前。",
  asylum: "该玩家不会被夜袭杀死。",
  matchmaker: "场上两名媒人持有者命运相连；其中一人出局时另一人也出局。",
  piety: "任何红色指控牌都不能打到该玩家面前。",
  stocks: "该玩家下一个白天回合被跳过；多张会分别跳过。",
  conspiracy: "每个白天牌堆只有1张。抽到后黑猫揭牌，所有人同时从左邻取走1张隐藏审判牌。",
  night: "不会混入白天牌堆；牌堆摸完时才自动进入夜晚。"
};

const TRIAL_COUNTS = {
  4: { innocent: 18, witch: 1, constable: 1 },
  5: { innocent: 23, witch: 1, constable: 1 },
  6: { innocent: 28, witch: 1, constable: 1 },
  7: { innocent: 32, witch: 2, constable: 1 },
  8: { innocent: 29, witch: 2, constable: 1 },
  9: { innocent: 33, witch: 2, constable: 1 },
  10: { innocent: 27, witch: 2, constable: 1 },
  11: { innocent: 30, witch: 2, constable: 1 },
  12: { innocent: 33, witch: 2, constable: 1 }
};

function makeDeck() {
  const specs = [
    ["accusation", 35], ["evidence", 5], ["witness", 1],
    ["alibi", 3], ["arson", 1], ["curse", 1], ["robbery", 1], ["scapegoat", 2],
    ["asylum", 1], ["matchmaker", 2], ["piety", 1], ["stocks", 3],
    ["conspiracy", 1], ["night", 1]
  ];
  const cards = [];
  for (const [kind, count] of specs) for (let i = 0; i < count; i += 1) {
    const meta = CARD_KINDS[kind];
    cards.push({ id: `${kind}-${i + 1}`, kind, ...meta, text: CARD_TEXT[kind], accusation: kind === "accusation" ? 1 : kind === "evidence" ? 3 : kind === "witness" ? 7 : 0 });
  }
  return cards;
}

module.exports = { CHARACTERS, CARD_KINDS, CARD_TEXT, TRIAL_COUNTS, makeDeck };
