const ROUNDS = 8;
const STARTING_PRICE = 50;
const STARTING_CASH = 1000;
const STARTING_COINS = 20;
const COIN_VALUE = 50;
const MAIN_CARDS = [
  ...Array(4).fill(20), ...Array(7).fill(10), ...Array(4).fill(0),
  ...Array(7).fill(-10), ...Array(4).fill(-20)
];

const EFFECT_CARDS = [
  { key: "major-order", title: "神秘大单", icon: "📦", impact: 10, tone: "bull", description: "大客户突然签下长期订单" },
  { key: "insider-buy", title: "高管增持", icon: "💼", impact: 10, tone: "bull", description: "管理层用真金白银表达信心" },
  { key: "viral-product", title: "爆款出圈", icon: "🚀", impact: 20, tone: "bull", description: "新产品一夜刷屏" },
  { key: "policy-bonus", title: "政策红利", icon: "🏛️", impact: 20, tone: "bull", description: "行业获得意外扶持" },
  { key: "ceo-scandal", title: "CEO风波", icon: "🕶️", impact: -20, tone: "bear", description: "掌舵人卷入突发争议" },
  { key: "product-recall", title: "产品召回", icon: "⚠️", impact: -20, tone: "bear", description: "质量问题引发全面召回" },
  { key: "executive-exit", title: "高管出走", icon: "🚪", impact: -10, tone: "bear", description: "核心高管突然宣布离职" },
  { key: "supply-storm", title: "供应链风暴", icon: "🌪️", impact: -10, tone: "bear", description: "关键原料运输受阻" },
  { key: "exchange-halt", title: "交易所停摆", icon: "⏸️", impact: 0, tone: "halt", halt: true, description: "不可抗力导致本轮无法开盘" }
];

const OPENING_EVENTS = [
  { key: "launch-crowd", title: "上市首日排队抢购", icon: "🎉", impact: 10, description: "市场情绪热烈，但最终价格仍由开盘主牌决定。" },
  { key: "founder-interview", title: "创始人采访刷屏", icon: "🎙️", impact: 10, description: "品牌热度快速上升，乐观情绪进入首轮。" },
  { key: "patent-dispute", title: "上市即遇专利争议", icon: "⚖️", impact: -10, description: "法律阴云压住首日情绪，但危机并未盖棺定论。" },
  { key: "factory-rumour", title: "新工厂传出故障传闻", icon: "🏭", impact: -10, description: "消息真假难辨，投资者需要自行判断。" },
  { key: "quiet-listing", title: "平静上市", icon: "🔔", impact: 0, description: "没有额外风向，首轮完全交给市场主牌。" },
  { key: "celebrity-back", title: "明星投资人站台", icon: "🌟", impact: 10, description: "关注度提高，但名人光环不保证上涨。" },
  { key: "data-question", title: "用户数据遭到质疑", icon: "🔐", impact: -10, description: "隐私担忧令首日交易趋于谨慎。" },
  { key: "analyst-split", title: "分析师观点严重分裂", icon: "🌓", impact: 0, description: "多空针锋相对，没有明确的首日加成。" }
];

const ROUND_EVENTS = [
  { key: "ceo-livestream", title: "CEO直播说漏嘴", icon: "🎥", impact: -10, description: "一句未经准备的回答引发市场担忧。" },
  { key: "product-award", title: "年度产品大奖", icon: "🏆", impact: 10, description: "产品口碑突然得到权威背书。" },
  { key: "data-leak", title: "客户数据泄露", icon: "🔓", impact: -10, description: "公司紧急调查潜在的数据安全事故。" },
  { key: "patent-win", title: "专利诉讼胜诉", icon: "⚖️", impact: 10, description: "长期法律风险突然解除。" },
  { key: "executive-wedding", title: "高管世纪婚礼", icon: "💐", impact: 0, description: "全网热议，但与公司盈利似乎毫无关系。" },
  { key: "warehouse-cat", title: "仓库橘猫走红", icon: "🐈", impact: 0, description: "品牌获得流量，分析师却不知道该怎么估值。" },
  { key: "supplier-sale", title: "供应商突然降价", icon: "🏷️", impact: 10, description: "原材料成本有望下降。" },
  { key: "storm-delay", title: "暴风雨延误运输", icon: "⛈️", impact: -10, description: "部分产品交付被迫延后。" },
  { key: "celebrity-review", title: "顶流自发推荐产品", icon: "📣", impact: 10, description: "意外曝光带来巨大访问量。" },
  { key: "office-rumour", title: "办公室裁员传闻", icon: "🗞️", impact: -10, description: "未经证实的消息扰动市场情绪。" },
  { key: "analyst-day", title: "投资者开放日", icon: "🏢", impact: 0, description: "公司回答了很多问题，但没有给出新数字。" },
  { key: "green-cert", title: "获得绿色认证", icon: "🌿", impact: 10, description: "可持续经营获得外界认可。" }
];

const CHARACTERS = [
  { id: "card-master", name: "卡牌大师", avatar: "🧙‍♂️", gender: "男", type: "active", description: "开局私藏1张随机效果牌，可在任意轮开始前额外打出一次。" },
  { id: "cleaner", name: "清道夫", avatar: "👩‍💼", gender: "女", type: "active", description: "一次性指定一名玩家，使其本轮盖下的效果牌失效。" },
  { id: "prophet", name: "预言家", avatar: "🧙‍♀️", gender: "女", type: "active", description: "一次性提前私下查看本轮趣味事件的名称和具体数值，主牌仍然未知。" },
  { id: "operator", name: "操盘手", avatar: "👨‍💼", gender: "男", type: "passive", description: "游戏开始时额外获得3股股票。" },
  { id: "heir", name: "富二代", avatar: "👸", gender: "女", type: "passive", description: "游戏开始时额外获得100资金和1枚预测金币。" },
  { id: "risk-manager", name: "风控师", avatar: "👨‍✈️", gender: "男", type: "active", description: "一次性保护本轮预测，猜错时最多少损失2金币。" },
  { id: "volatility-scout", name: "波动侦探", avatar: "🕵️‍♀️", gender: "女", type: "active", description: "一次性得知本轮主牌是强波动、普通波动还是零波动，但不知道方向。" },
  { id: "negotiator", name: "谈判专家", avatar: "🤵‍♂️", gender: "男", type: "active", description: "一次性让本轮交易的前5股每股获得10资金价格优势。" },
  { id: "long-investor", name: "长线投资家", avatar: "👩‍🌾", gender: "女", type: "passive", description: "终局结算时，每持有1股额外获得8资金收益，不设上限。" },
  { id: "contrarian", name: "逆风猎手", avatar: "🧔‍♂️", gender: "男", type: "passive", description: "市场实际下跌时获得1金币，整局最多触发3次。" }
];

function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function sample(items, random) {
  return items[Math.floor(random() * items.length)];
}

function drawEffectCard(game) {
  const roll = game.random();
  let pool;
  if (roll < 0.04) pool = EFFECT_CARDS.filter((card) => card.halt);
  else if (roll < 0.22) pool = EFFECT_CARDS.filter((card) => Math.abs(card.impact) === 20);
  else pool = EFFECT_CARDS.filter((card) => Math.abs(card.impact) === 10);
  return { ...sample(pool, game.random) };
}

function createGame(players, random = Math.random) {
  const shuffled = shuffle(MAIN_CARDS, random);
  shuffled.splice(0, 6);
  const draftOrder = players.map((player, seat) => ({ playerId: player.id, roll: 1 + Math.floor(random() * 6), seat }))
    .sort((a, b) => b.roll - a.roll || a.seat - b.seat);
  const game = {
    status: "playing",
    phase: "character-draft",
    round: 1,
    totalRounds: ROUNDS,
    price: STARTING_PRICE,
    priceHistory: [STARTING_PRICE],
    marketDeck: shuffled,
    removedCount: 6,
    revealedMain: [],
    openingEvent: { ...sample(OPENING_EVENTS, random) },
    roundEvents: Array.from({ length: ROUNDS }, () => ({ ...sample(ROUND_EVENTS, random) })),
    currentEffects: [],
    roleEffects: [],
    submissions: {},
    effectOffers: {},
    nextEffects: {},
    finances: {},
    characters: {},
    availableCharacters: CHARACTERS.map((character) => character.id),
    draftOrder,
    draftIndex: 0,
    roundSkills: {},
    history: [],
    log: ["角色骰已经掷出，按点数从高到低选择商业奇才。"],
    eventSeq: 0,
    lastEvent: null,
    ranking: [],
    random
  };
  for (const player of players) game.finances[player.id] = { cash: STARTING_CASH, shares: 0, coins: STARTING_COINS };
  return game;
}

function characterById(id) { return CHARACTERS.find((character) => character.id === id); }

function requirePlaying(room, playerId) {
  const game = room.game;
  if (!game || game.status !== "playing") throw new Error("市场尚未开始或已经收盘");
  if (!game.finances[playerId]) throw new Error("你不在本局游戏中");
  return game;
}

function chooseCharacter(room, playerId, characterId) {
  const game = requirePlaying(room, playerId);
  if (game.phase !== "character-draft") throw new Error("角色选择已经结束");
  const current = game.draftOrder[game.draftIndex];
  if (current?.playerId !== playerId) throw new Error("还没轮到你选择角色");
  if (!game.availableCharacters.includes(characterId)) throw new Error("这个角色已经被选择");
  const character = characterById(characterId);
  const state = { id: character.id, skillUsed: character.type === "passive", passive: character.type === "passive", triggers: 0, secretCard: null, skillInfo: null };
  game.characters[playerId] = state;
  game.availableCharacters = game.availableCharacters.filter((id) => id !== characterId);
  const finance = game.finances[playerId];
  if (characterId === "operator") finance.shares += 3;
  if (characterId === "heir") { finance.cash += 100; finance.coins += 1; }
  if (characterId === "card-master") state.secretCard = drawEffectCard(game);
  const player = room.players.find((item) => item.id === playerId);
  game.log.unshift(`${player?.name || "玩家"} 选择了「${character.name}」。`);
  game.draftIndex += 1;
  if (game.draftIndex >= game.draftOrder.length) {
    game.phase = "decision";
    game.log.unshift(`上市事件：${game.openingEvent.title}（${game.openingEvent.impact > 0 ? "+" : ""}${game.openingEvent.impact}）。第一轮秘密交易开始。`);
  }
}

function tradeCost(game, playerId, trade, shares) {
  const negotiatorActive = game.roundSkills[playerId]?.type === "negotiator";
  const discounted = negotiatorActive ? Math.min(5, shares) : 0;
  if (trade === "buy") return shares * game.price - discounted * 10;
  if (trade === "sell") return shares * game.price + discounted * 10;
  return 0;
}

function normaliseDecision(game, playerId, payload) {
  const prediction = String(payload.prediction || "none");
  if (!["up", "down", "flat", "none"].includes(prediction)) throw new Error("请选择上涨、下跌、不变或不预测");
  const finance = game.finances[playerId];
  const wager = Number(payload.wager);
  if (prediction === "none" && wager !== 0) throw new Error("不预测时不能投入金币");
  if (prediction !== "none" && (!Number.isInteger(wager) || wager < 1 || wager > 5)) throw new Error("预测可投入 1–5 枚金币");
  if (wager > finance.coins) throw new Error("预测金币不足");
  const trade = String(payload.trade || "hold");
  if (!["buy", "sell", "hold"].includes(trade)) throw new Error("交易指令无效");
  const shares = trade === "hold" ? 0 : Number(payload.shares);
  if (!Number.isInteger(shares) || shares < 0) throw new Error("股票数量必须是整数");
  if (trade !== "hold" && shares < 1) throw new Error("请填写要交易的股票数量");
  if (trade === "buy" && finance.cash < tradeCost(game, playerId, trade, shares)) throw new Error("股票资金不足");
  if (trade === "sell" && finance.shares < shares) throw new Error("持股数量不足");
  return { prediction, wager, trade, shares };
}

function drawEffectOffer(game) { return [drawEffectCard(game), drawEffectCard(game)]; }

function submitDecision(room, playerId, payload = {}) {
  const game = requirePlaying(room, playerId);
  if (game.phase === "character-draft") throw new Error("请先完成角色选择");
  if (game.submissions[playerId]) throw new Error("本轮决定已经锁定");
  game.submissions[playerId] = normaliseDecision(game, playerId, payload);
  if (game.round < game.totalRounds) game.effectOffers[playerId] = drawEffectOffer(game);
  maybeResolve(room);
}

function chooseEffect(room, playerId, effectKey) {
  const game = requirePlaying(room, playerId);
  if (!game.submissions[playerId]) throw new Error("请先锁定本轮预测与交易");
  if (game.round >= game.totalRounds) throw new Error("最后一轮不再选择效果牌");
  if (game.nextEffects[playerId]) throw new Error("效果牌已经盖下");
  const card = (game.effectOffers[playerId] || []).find((item) => item.key === effectKey);
  if (!card) throw new Error("只能选择本轮抽到的效果牌");
  game.nextEffects[playerId] = { ...card };
  maybeResolve(room);
}

function useSkill(room, playerId, payload = {}) {
  const game = requirePlaying(room, playerId);
  if (game.phase === "character-draft") throw new Error("角色选择结束后才能发动技能");
  if (game.submissions[playerId]) throw new Error("技能必须在锁定买卖和预测前发动");
  const state = game.characters[playerId];
  const character = characterById(state?.id);
  if (!state || !character || character.type !== "active") throw new Error("你的角色没有主动技能");
  if (state.skillUsed) throw new Error("本场技能已经使用");
  const skill = { type: state.id, round: game.round };
  if (state.id === "cleaner") {
    if (game.round === 1) throw new Error("第一轮没有上一轮盖下的效果牌");
    if (!room.players.some((player) => player.id === payload.targetId && player.id !== playerId)) throw new Error("请选择另一名玩家");
    skill.targetId = payload.targetId;
  } else if (state.id === "prophet") {
    const event = game.roundEvents[game.round - 1];
    skill.info = `${event.icon} ${event.title}（${event.impact > 0 ? "+" : ""}${event.impact}）`;
    state.skillInfo = skill.info;
  } else if (state.id === "card-master") {
    if (!state.secretCard) throw new Error("没有可打出的私藏卡");
    game.roleEffects.push({ playerId, card: { ...state.secretCard, fromRole: true } });
    state.secretCard = null;
  } else if (state.id === "volatility-scout") {
    const main = game.marketDeck[0];
    skill.info = main === 0 ? "零波动（0）" : Math.abs(main) === 20 ? "强波动（±20）" : "普通波动（±10）";
    state.skillInfo = skill.info;
  }
  game.roundSkills[playerId] = skill;
  state.skillUsed = true;
  const player = room.players.find((item) => item.id === playerId);
  game.log.unshift(`${player?.name || "玩家"} 发动了「${character.name}」的本场技能。`);
}

function allReady(room) {
  const game = room.game;
  return room.players.every((player) => game.submissions[player.id])
    && (game.round === game.totalRounds || room.players.every((player) => game.nextEffects[player.id]));
}

function settlePrediction(finance, decision, direction, { halted = false, protection = false } = {}) {
  if (decision.prediction === "none") return 0;
  if (halted) {
    const loss = protection ? Math.max(0, decision.wager - 2) : decision.wager;
    finance.coins -= loss;
    return -loss;
  }
  if (decision.prediction === direction) {
    const reward = decision.wager * (direction === "flat" ? 2 : 1);
    finance.coins += reward;
    return reward;
  }
  let loss = direction === "flat" && decision.prediction !== "flat" ? 1 : decision.wager;
  if (protection) loss = Math.max(0, loss - 2);
  finance.coins -= loss;
  return -loss;
}

function characterBonus(game, playerId, finance) {
  return game.characters[playerId]?.id === "long-investor" ? finance.shares * 8 : 0;
}

function finalWealth(finance, price, bonus = 0) { return finance.cash + finance.shares * price + finance.coins * COIN_VALUE + bonus; }

function maybeResolve(room) {
  if (!allReady(room)) return false;
  const game = room.game;
  const priceBefore = game.price;
  const main = game.marketDeck.shift();
  const roundEvent = game.roundEvents[game.round - 1];
  const cleanerSkill = Object.values(game.roundSkills).find((skill) => skill.type === "cleaner");
  const effects = [...game.currentEffects, ...game.roleEffects].map((item) => ({
    ...item,
    cancelled: Boolean(cleanerSkill && item.playerId === cleanerSkill.targetId && !item.card.fromRole)
  }));
  const halted = effects.some((item) => item.card.halt && !item.cancelled);
  const rawEffect = effects.filter((item) => !item.cancelled && !item.card.halt).reduce((sum, item) => sum + item.card.impact, 0);
  const playerEffect = Math.max(-20, Math.min(20, rawEffect));
  const openingImpact = game.round === 1 ? game.openingEvent.impact : 0;
  const rawChange = main + playerEffect + openingImpact + roundEvent.impact;
  const calculatedChange = halted ? 0 : Math.max(-30, Math.min(30, rawChange));
  const priceAfter = halted ? priceBefore : Math.max(10, priceBefore + calculatedChange);
  const actualChange = priceAfter - priceBefore;
  const direction = actualChange > 0 ? "up" : actualChange < 0 ? "down" : "flat";
  const orders = [];
  for (const player of room.players) {
    const decision = game.submissions[player.id];
    const finance = game.finances[player.id];
    const amount = tradeCost(game, player.id, decision.trade, decision.shares);
    if (!halted && decision.trade === "buy") { finance.cash -= amount; finance.shares += decision.shares; }
    if (!halted && decision.trade === "sell") { finance.cash += amount; finance.shares -= decision.shares; }
    orders.push({ playerId: player.id, trade: decision.trade, shares: decision.shares, holding: finance.shares, cancelled: halted, amount });
  }
  const predictions = room.players.map((player) => {
    const decision = game.submissions[player.id];
    const protectedRound = game.roundSkills[player.id]?.type === "risk-manager";
    const reward = settlePrediction(game.finances[player.id], decision, direction, { halted, protection: protectedRound });
    return { playerId: player.id, prediction: decision.prediction, wager: decision.wager, reward };
  });
  if (actualChange < 0) {
    for (const [playerId, state] of Object.entries(game.characters)) {
      if (state.id === "contrarian" && state.triggers < 3) { game.finances[playerId].coins += 1; state.triggers += 1; }
    }
  }
  game.price = priceAfter;
  game.priceHistory.push(priceAfter);
  game.revealedMain.push(main);
  const event = {
    id: ++game.eventSeq, type: "opening", round: game.round, priceBefore, priceAfter, change: actualChange,
    calculatedChange, rawChange, main, roundEvent, playerEffect, openingImpact, halted, effects, orders, predictions
  };
  game.lastEvent = event;
  game.history.unshift(event);
  game.log.unshift(halted ? `第 ${game.round} 轮遭遇「交易所停摆」：交易取消，所有已下注预测亏损。` : `第 ${game.round} 轮开盘：主卡 ${main >= 0 ? "+" : ""}${main}，股价 ${priceBefore} → ${priceAfter}。`);
  if (game.round >= game.totalRounds) {
    game.status = "finished";
    game.phase = "finished";
    game.ranking = room.players.map((player) => {
      const finance = game.finances[player.id];
      const bonus = characterBonus(game, player.id, finance);
      return { playerId: player.id, ...finance, characterBonus: bonus, finalWealth: finalWealth(finance, priceAfter, bonus) };
    }).sort((a, b) => b.finalWealth - a.finalWealth || b.coins - a.coins || b.cash - a.cash);
  } else {
    game.round += 1;
    game.phase = "decision";
    game.currentEffects = Object.entries(game.nextEffects).map(([playerId, card]) => ({ playerId, card: { ...card } }));
    game.roleEffects = [];
    game.submissions = {};
    game.effectOffers = {};
    game.nextEffects = {};
    game.roundSkills = {};
    for (const state of Object.values(game.characters)) state.skillInfo = null;
  }
  return true;
}

function publicRoom(room, viewerId = null) {
  const game = room.game;
  if (!game) return { code: room.code, hostId: room.hostId, players: room.players.map(({ token: _token, ...player }) => player), game: null };
  const finished = game.status === "finished";
  const players = room.players.map(({ token: _token, ...player }) => {
    const finance = game.finances[player.id];
    const mine = player.id === viewerId;
    const characterState = game.characters[player.id];
    const character = characterById(characterState?.id);
    const ranking = finished ? game.ranking.findIndex((item) => item.playerId === player.id) + 1 : null;
    const bonus = characterBonus(game, player.id, finance);
    return {
      ...player, shares: finance.shares, ready: Boolean(game.submissions[player.id]), effectReady: Boolean(game.nextEffects[player.id]),
      character: character ? { ...character, skillUsed: characterState.skillUsed, triggers: characterState.triggers } : null,
      ...(mine || finished ? { cash: finance.cash, predictionCoins: finance.coins } : {}),
      ...(mine && characterState?.secretCard ? { secretRoleCard: characterState.secretCard } : {}),
      ...(mine && characterState?.skillInfo ? { skillInfo: characterState.skillInfo } : {}),
      ...(finished ? { finalWealth: finalWealth(finance, game.price, bonus), characterBonus: bonus, rank: ranking } : {})
    };
  });
  const draftCurrentPlayerId = game.draftOrder[game.draftIndex]?.playerId || null;
  return {
    code: room.code, hostId: room.hostId, players,
    game: {
      status: game.status, phase: game.phase, round: game.round, totalRounds: game.totalRounds, price: game.price,
      priceHistory: game.priceHistory, removedCount: game.removedCount, revealedMain: game.revealedMain,
      openingEvent: game.phase === "character-draft" ? null : game.openingEvent,
      history: game.history, log: game.log, lastEvent: game.lastEvent, ranking: game.ranking,
      draftOrder: game.draftOrder, draftCurrentPlayerId,
      availableCharacters: CHARACTERS.filter((character) => game.availableCharacters.includes(character.id)),
      mySubmission: game.submissions[viewerId] || null,
      myOffer: game.effectOffers[viewerId] || null,
      myEffect: game.nextEffects[viewerId] || null,
      myPendingEffect: game.currentEffects.find((item) => item.playerId === viewerId)?.card || null,
      myRoundSkill: game.roundSkills[viewerId] || null,
      waitingFor: game.phase === "character-draft" ? [] : room.players.filter((player) => !game.submissions[player.id] || (game.round < game.totalRounds && !game.nextEffects[player.id])).map((player) => player.id)
    }
  };
}

module.exports = {
  ROUNDS, STARTING_PRICE, STARTING_CASH, STARTING_COINS, COIN_VALUE,
  MAIN_CARDS, EFFECT_CARDS, OPENING_EVENTS, ROUND_EVENTS, CHARACTERS,
  createGame, chooseCharacter, submitDecision, chooseEffect, useSkill, publicRoom, finalWealth
};
