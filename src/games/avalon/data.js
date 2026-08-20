const PLAYER_COUNTS = {
  5: { good: 3, evil: 2, quests: [2, 3, 2, 3, 3] },
  6: { good: 4, evil: 2, quests: [2, 3, 4, 3, 4] },
  7: { good: 4, evil: 3, quests: [2, 3, 3, 4, 4] },
  8: { good: 5, evil: 3, quests: [3, 4, 4, 5, 5] },
  9: { good: 6, evil: 3, quests: [3, 4, 4, 5, 5] },
  10: { good: 6, evil: 4, quests: [3, 4, 4, 5, 5] }
};

const ROLES = {
  merlin: { id: "merlin", name: "梅林", side: "good", icon: "🧙", title: "洞悉黑暗的先知", detail: "你知道除莫德雷德外的邪恶玩家，但必须隐藏身份，否则会在终局遭到刺杀。" },
  percival: { id: "percival", name: "派西维尔", side: "good", icon: "🛡️", title: "梅林的守护骑士", detail: "你会看到梅林与莫甘娜，但无法分辨谁才是真正的梅林。" },
  loyal: { id: "loyal", name: "亚瑟忠臣", side: "good", icon: "⚜️", title: "圆桌骑士", detail: "你没有额外情报。观察组队、投票与任务结果，找出潜藏的邪恶。" },
  assassin: { id: "assassin", name: "刺客", side: "evil", icon: "🗡️", title: "莫德雷德的利刃", detail: "邪恶同伴会被你看见。若正义先完成三项任务，你仍可刺杀梅林翻盘。" },
  morgana: { id: "morgana", name: "莫甘娜", side: "evil", icon: "🔮", title: "伪装的先知", detail: "你会在派西维尔的视野中伪装成梅林。" },
  mordred: { id: "mordred", name: "莫德雷德", side: "evil", icon: "👑", title: "藏于迷雾的黑王", detail: "梅林无法看见你的邪恶身份，但其他邪恶玩家仍能认出你。" },
  oberon: { id: "oberon", name: "奥伯伦", side: "evil", icon: "🌑", title: "孤独的暗影", detail: "你属于邪恶，但你看不到邪恶同伴，他们也看不到你；梅林仍能看见你。" },
  minion: { id: "minion", name: "莫德雷德爪牙", side: "evil", icon: "🐍", title: "潜伏的叛徒", detail: "你知道除奥伯伦外的邪恶同伴，可以在任务中秘密打出失败。" }
};

const PRESETS = {
  base: { name: "基础对局", description: "梅林、刺客与普通忠臣/爪牙，最适合第一次游玩。" },
  classic: { name: "经典角色", description: "加入派西维尔和莫甘娜；7–9人加入奥伯伦，10人再加入莫德雷德。" },
  shadow: { name: "暗影对局", description: "加入派西维尔、莫甘娜与莫德雷德，邪恶方隐藏得更深。" }
};

function roleIdsFor(count, preset = "classic") {
  const config = PLAYER_COUNTS[count];
  if (!config) throw new Error("阿瓦隆仅支持5至10人");
  const good = ["merlin"];
  const evil = ["assassin"];
  if (preset !== "base") {
    good.push("percival");
    evil.push("morgana");
    if (preset === "shadow" && config.evil >= 3) evil.push("mordred");
    if (preset === "classic" && config.evil >= 3) evil.push("oberon");
    if (preset === "classic" && config.evil >= 4) evil.push("mordred");
  }
  while (good.length < config.good) good.push("loyal");
  while (evil.length < config.evil) evil.push("minion");
  return [...good.slice(0, config.good), ...evil.slice(0, config.evil)];
}

module.exports = { PLAYER_COUNTS, ROLES, PRESETS, roleIdsFor };
