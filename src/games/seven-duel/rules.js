const { RESOURCE_META, TYPE_META, CARDS, WONDERS, PROGRESS, LAYOUTS, VISIBLE_ROWS } = require("./data");

const RESOURCES = Object.keys(RESOURCE_META);
const clone = (value) => JSON.parse(JSON.stringify(value));
function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function byId(items, id) { return items.find((item) => item.id === id); }
function city(game, playerId) { return game.cities[playerId]; }
function opponentId(game, playerId) { return game.playerIds.find((id) => id !== playerId); }
function playerName(room, id) { return room.players.find((player) => player.id === id)?.name || "玩家"; }
function record(game, type, details = {}) { game.eventSeq += 1; game.lastEvent = { seq: game.eventSeq, type, ...details }; }

function createGame(players, random = Math.random) {
  const firstIndex = Math.floor(random() * 2);
  const first = players[firstIndex].id, other = players[1 - firstIndex].id;
  const wonderPool = shuffle(WONDERS, random);
  const progressPool = shuffle(PROGRESS, random);
  const game = {
    status: "playing", phase: "wonder-draft", age: 0, playerIds: players.map((player) => player.id),
    firstPlayerId: first, actorId: first, lastActorId: null, military: 0,
    militaryTokens: { "-6": 5, "-3": 2, "3": 2, "6": 5 },
    availableProgress: progressPool.slice(0, 5), hiddenProgress: progressPool.slice(5),
    cities: {}, discard: [], cardSlots: [], pending: null, eventSeq: 0, lastEvent: null, log: [], ranking: [], random,
    wonderDraft: { step: 0, stage: 1, offers: wonderPool.slice(0, 4), remaining: wonderPool.slice(4), sequence: [first, other, other, first, other, first, first, other] }
  };
  for (const player of players) game.cities[player.id] = { coins: 7, buildings: [], wonders: [], progress: [] };
  record(game, "draft-start", { actorId: first });
  game.log.push(`${playerName({ players }, first)} 赢得先手，奇迹选择开始。`);
  return game;
}

function requireGame(room, playerId) {
  const game = room.game;
  if (!game || game.status !== "playing") throw new Error("对决尚未开始或已经结束");
  if (!game.playerIds.includes(playerId)) throw new Error("你不在本局对决中");
  return game;
}
function requireActor(game, playerId) { if (game.actorId !== playerId) throw new Error("现在不是你的回合"); }

function pickWonder(room, playerId, wonderId) {
  const game = requireGame(room, playerId);
  if (game.phase !== "wonder-draft") throw new Error("奇迹选择已经结束");
  requireActor(game, playerId);
  const wonder = byId(game.wonderDraft.offers, wonderId);
  if (!wonder) throw new Error("这座奇迹不在当前选择区");
  city(game, playerId).wonders.push({ ...clone(wonder), built: false, removed: false });
  game.wonderDraft.offers = game.wonderDraft.offers.filter((item) => item.id !== wonderId);
  game.log.unshift(`${playerName(room, playerId)} 选择了「${wonder.name}」。`);
  record(game, "wonder-picked", { playerId, wonder: clone(wonder) });
  game.wonderDraft.step += 1;
  if (game.wonderDraft.step === 4) {
    game.wonderDraft.stage = 2;
    game.wonderDraft.offers = game.wonderDraft.remaining.slice(0, 4);
    game.wonderDraft.remaining = game.wonderDraft.remaining.slice(4);
  }
  if (game.wonderDraft.step >= 8) return setupAge(room, 1, game.firstPlayerId);
  game.actorId = game.wonderDraft.sequence[game.wonderDraft.step];
}

function setupAge(room, age, starterId) {
  const game = room.game;
  const base = shuffle(CARDS.filter((card) => card.age === age && card.type !== "guild"), game.random).slice(3);
  const deck = age === 3 ? shuffle([...base, ...shuffle(CARDS.filter((card) => card.type === "guild"), game.random).slice(0, 3)], game.random) : base;
  game.age = age; game.phase = "playing"; game.actorId = starterId; game.pending = null;
  game.cardSlots = LAYOUTS[age - 1].map(([row, column], index) => ({
    id: `age-${age}-${index}`, row, column, revealed: VISIBLE_ROWS[age - 1].includes(row), taken: false, card: clone(deck[index])
  }));
  revealAccessible(game);
  game.log.unshift(`时代 ${["Ⅰ", "Ⅱ", "Ⅲ"][age - 1]} 开始，由 ${playerName(room, starterId)} 先行动。`);
  record(game, "age-start", { age, actorId: starterId });
}

function isAccessible(game, slot) {
  if (!slot || slot.taken) return false;
  return !game.cardSlots.some((other) => !other.taken && other.row === slot.row + 1 && (other.column === slot.column - 1 || other.column === slot.column + 1));
}
function revealAccessible(game) {
  const revealed = [];
  for (const slot of game.cardSlots) if (!slot.taken && !slot.revealed && isAccessible(game, slot)) { slot.revealed = true; revealed.push(slot.id); }
  return revealed;
}

function fixedProduction(cityState) {
  const output = Object.fromEntries(RESOURCES.map((key) => [key, 0]));
  for (const item of [...cityState.buildings, ...cityState.wonders.filter((wonder) => wonder.built)]) {
    for (const [resource, amount] of Object.entries(item.produces || {})) output[resource] += amount;
  }
  return output;
}
function flexibleProduction(cityState) {
  return [...cityState.buildings, ...cityState.wonders.filter((wonder) => wonder.built)].filter((item) => item.producesOneOf).map((item) => item.producesOneOf);
}
function hasProgress(cityState, id) { return cityState.progress.some((token) => token.id === id); }
function tradePrice(game, playerId, resource) {
  const own = city(game, playerId);
  if (own.buildings.some((card) => card.trades?.includes(resource))) return 1;
  const opposing = fixedProduction(city(game, opponentId(game, playerId)));
  return 2 + opposing[resource];
}

function minimumTrade(game, playerId, requirement, discount = 0) {
  const fixed = fixedProduction(city(game, playerId));
  const missing = Object.fromEntries(RESOURCES.map((resource) => [resource, Math.max(0, (requirement?.[resource] || 0) - fixed[resource])]));
  const flexible = flexibleProduction(city(game, playerId));
  let best = Infinity, bestDetail = {};
  function evaluate(index) {
    if (index < flexible.length) {
      let used = false;
      for (const resource of flexible[index]) if (missing[resource] > 0) { used = true; missing[resource] -= 1; evaluate(index + 1); missing[resource] += 1; }
      if (!used) evaluate(index + 1);
      return;
    }
    const units = [];
    for (const resource of RESOURCES) for (let i = 0; i < missing[resource]; i += 1) units.push({ resource, price: tradePrice(game, playerId, resource) });
    units.sort((a, b) => b.price - a.price);
    const paid = units.slice(Math.min(discount, units.length));
    const total = paid.reduce((sum, unit) => sum + unit.price, 0);
    if (total < best) {
      best = total; bestDetail = {};
      for (const unit of paid) bestDetail[unit.resource] = (bestDetail[unit.resource] || 0) + 1;
    }
  }
  evaluate(0);
  return { trade: Number.isFinite(best) ? best : 0, missing: bestDetail };
}

function constructionCost(game, playerId, item, kind = "building") {
  const own = city(game, playerId);
  if (kind === "building" && item.freeLink && own.buildings.some((card) => card.link === item.freeLink)) return { total: 0, trade: 0, coin: 0, chain: true, missing: {} };
  let discount = 0;
  if (kind === "wonder" && hasProgress(own, "architecture")) discount = 2;
  if (kind === "building" && item.type === "civilian" && hasProgress(own, "masonry")) discount = 2;
  const result = minimumTrade(game, playerId, item.cost || {}, discount);
  const coin = item.coinCost || 0;
  return { ...result, coin, total: result.trade + coin, chain: false };
}
function payConstruction(game, playerId, cost) {
  const own = city(game, playerId);
  if (own.coins < cost.total) throw new Error("金币不足，无法完成建造");
  own.coins -= cost.total;
  const opponent = city(game, opponentId(game, playerId));
  if (cost.trade > 0 && hasProgress(opponent, "economy")) opponent.coins += cost.trade;
}

function metric(game, metricName) {
  const values = game.playerIds.map((id) => {
    const c = city(game, id);
    if (metricName === "wonder") return c.wonders.filter((wonder) => wonder.built).length;
    if (metricName === "coins") return Math.floor(c.coins / 3);
    if (metricName === "resources") return c.buildings.filter((card) => card.type === "raw" || card.type === "manufactured").length;
    return c.buildings.filter((card) => card.type === metricName).length;
  });
  return Math.max(...values);
}
function applyCoinsPer(game, playerId, card) {
  const own = city(game, playerId);
  if (card.guildMetric && card.coinPer) own.coins += metric(game, card.guildMetric) * card.coinPer;
  for (const [kind, amount] of Object.entries(card.coinsPer || {})) {
    const count = kind === "wonder" ? own.wonders.filter((wonder) => wonder.built).length : own.buildings.filter((building) => building.type === kind).length;
    own.coins += count * amount;
  }
}
function scienceSymbols(cityState) {
  return [...cityState.buildings.map((card) => card.science), ...cityState.progress.map((token) => token.science)].filter(Boolean);
}
function finishVictory(room, playerId, victoryType) {
  const game = room.game;
  game.status = "finished"; game.phase = "finished"; game.actorId = null; game.pending = null;
  game.winnerId = playerId; game.victoryType = victoryType;
  game.log.unshift(`${playerName(room, playerId)} 以${victoryType === "military" ? "军事霸权" : "科技霸权"}立即获胜！`);
  record(game, "victory", { playerId, victoryType });
}
function checkScience(room, playerId) {
  const symbols = scienceSymbols(city(room.game, playerId));
  if (new Set(symbols).size >= 6) { finishVictory(room, playerId, "science"); return true; }
  return false;
}
function applyMilitary(room, playerId, shields) {
  if (!shields) return false;
  const game = room.game, sign = game.playerIds[0] === playerId ? 1 : -1, before = game.military;
  game.military = Math.max(-9, Math.min(9, before + sign * shields));
  for (const threshold of [-6, -3, 3, 6]) {
    const crossed = sign > 0 ? before < threshold && game.military >= threshold : before > threshold && game.military <= threshold;
    if (crossed && game.militaryTokens[String(threshold)]) {
      const loss = game.militaryTokens[String(threshold)];
      const target = city(game, opponentId(game, playerId));
      target.coins = Math.max(0, target.coins - loss);
      delete game.militaryTokens[String(threshold)];
    }
  }
  if (Math.abs(game.military) >= 9) { finishVictory(room, playerId, "military"); return true; }
  return false;
}

function pending(game, kind, playerId, options, after) {
  game.phase = "pending"; game.actorId = playerId; game.pending = { kind, playerId, options, after };
}
function applyBuilding(room, playerId, card, { free = false, after = { extraTurn: false } } = {}) {
  const game = room.game, own = city(game, playerId);
  own.buildings.push(clone(card));
  if (card.coins) own.coins += card.coins;
  applyCoinsPer(game, playerId, card);
  if (card.freeLink && own.buildings.some((other) => other.id !== card.id && other.link === card.freeLink) && hasProgress(own, "urbanism")) own.coins += 4;
  const shields = (card.shields || 0) + (card.type === "military" && hasProgress(own, "strategy") ? 1 : 0);
  if (applyMilitary(room, playerId, shields) || checkScience(room, playerId)) return true;
  if (card.science) {
    const matches = own.buildings.filter((building) => building.science === card.science).length;
    if (matches === 2 && game.availableProgress.length) { pending(game, "progress", playerId, game.availableProgress.map((token) => token.id), after); return true; }
  }
  return false;
}
function applyWonder(room, playerId, wonder, after) {
  const game = room.game, own = city(game, playerId), other = city(game, opponentId(game, playerId));
  if (wonder.coins) own.coins += wonder.coins;
  if (wonder.destroyCoins) other.coins = Math.max(0, other.coins - wonder.destroyCoins);
  if (applyMilitary(room, playerId, wonder.shields || 0)) return true;
  const extraTurn = Boolean(wonder.extraTurn || hasProgress(own, "theology"));
  const continuation = { ...after, extraTurn };
  if (wonder.destroyType) {
    const targets = other.buildings.filter((card) => card.type === wonder.destroyType).map((card) => card.id);
    if (targets.length) { pending(game, "destroy", playerId, targets, continuation); return true; }
  }
  if (wonder.special === "hidden-progress" && game.hiddenProgress.length) {
    const options = shuffle(game.hiddenProgress, game.random).slice(0, 3).map((token) => token.id);
    pending(game, "hidden-progress", playerId, options, continuation); return true;
  }
  if (wonder.special === "discard-build" && game.discard.length) {
    pending(game, "discard-build", playerId, game.discard.map((card) => card.id), continuation); return true;
  }
  return false;
}

function finishTurn(room, playerId, extraTurn = false) {
  const game = room.game;
  if (game.status === "finished") return;
  game.lastActorId = playerId;
  if (game.cardSlots.every((slot) => slot.taken)) {
    if (game.age === 3) return finishCivilian(room);
    const chooser = game.military > 0 ? game.playerIds[1] : game.military < 0 ? game.playerIds[0] : playerId;
    game.phase = "choose-starter"; game.actorId = chooser; game.pending = { kind: "age-starter", playerId: chooser, options: [...game.playerIds], nextAge: game.age + 1 };
    game.log.unshift(`${playerName(room, chooser)} 决定下一时代的先手。`);
    record(game, "age-ended", { age: game.age, chooserId: chooser });
    return;
  }
  game.phase = "playing"; game.pending = null;
  game.actorId = extraTurn ? playerId : opponentId(game, playerId);
}

function takeCard(room, playerId, payload = {}) {
  const game = requireGame(room, playerId);
  if (game.phase !== "playing") throw new Error("当前需要先完成其他选择");
  requireActor(game, playerId);
  const slot = game.cardSlots.find((item) => item.id === payload.cardId);
  if (!slot || slot.taken || !slot.revealed || !isAccessible(game, slot)) throw new Error("只能选择没有被覆盖的明牌");
  const card = slot.card, mode = String(payload.mode || "");
  let wonder = null, cost = null;
  if (mode === "build") {
    cost = constructionCost(game, playerId, card, "building");
    if (city(game, playerId).coins < cost.total) throw new Error("金币不足，无法建造这张建筑");
  } else if (mode === "wonder") {
    wonder = city(game, playerId).wonders.find((item) => item.id === payload.wonderId && !item.built && !item.removed);
    if (!wonder) throw new Error("请选择一座尚未建成的奇迹");
    if (game.playerIds.flatMap((id) => city(game, id).wonders).filter((item) => item.built).length >= 7) throw new Error("本局已经建成七座奇迹");
    cost = constructionCost(game, playerId, wonder, "wonder");
    if (city(game, playerId).coins < cost.total) throw new Error("金币不足，无法建造这座奇迹");
  } else if (mode !== "discard") throw new Error("请选择建造、弃牌换钱或建造奇迹");

  slot.taken = true;
  const revealed = revealAccessible(game);
  const event = { playerId, mode, card: clone(card), slotId: slot.id, revealed };
  let deferred = false;
  if (mode === "discard") {
    const value = 2 + city(game, playerId).buildings.filter((building) => building.type === "commercial").length;
    city(game, playerId).coins += value; game.discard.push(clone(card)); event.coins = value;
  }
  if (mode === "build") {
    payConstruction(game, playerId, cost); event.cost = cost.total; event.chain = cost.chain;
    deferred = applyBuilding(room, playerId, card, { after: { extraTurn: false } });
  }
  if (mode === "wonder") {
    payConstruction(game, playerId, cost); wonder.built = true; event.cost = cost.total; event.wonder = clone(wonder);
    const builtCount = game.playerIds.flatMap((id) => city(game, id).wonders).filter((item) => item.built).length;
    if (builtCount === 7) for (const id of game.playerIds) for (const item of city(game, id).wonders) if (!item.built) item.removed = true;
    deferred = applyWonder(room, playerId, wonder, { extraTurn: false });
  }
  game.log.unshift(`${playerName(room, playerId)} ${mode === "discard" ? "弃置" : mode === "wonder" ? `用其建造「${wonder.name}」` : "建造"}了「${card.name}」。`);
  if (game.status !== "finished") record(game, mode === "wonder" ? "wonder-built" : mode === "discard" ? "card-discarded" : "card-built", event);
  if (!deferred && game.status !== "finished") finishTurn(room, playerId, mode === "wonder" && (wonder.extraTurn || hasProgress(city(game, playerId), "theology")));
}

function chooseProgress(room, playerId, tokenId) {
  const game = requireGame(room, playerId);
  if (game.phase !== "pending" || !game.pending || !["progress", "hidden-progress"].includes(game.pending.kind)) throw new Error("当前不需要选择进步标记");
  requireActor(game, playerId);
  if (!game.pending.options.includes(tokenId)) throw new Error("这枚进步标记不在可选范围内");
  const hidden = game.pending.kind === "hidden-progress";
  const source = hidden ? game.hiddenProgress : game.availableProgress;
  const token = byId(source, tokenId);
  if (!token) throw new Error("进步标记不存在");
  const after = game.pending.after;
  if (hidden) {
    const optionSet = new Set(game.pending.options);
    game.hiddenProgress = game.hiddenProgress.filter((item) => !optionSet.has(item.id));
  } else game.availableProgress = game.availableProgress.filter((item) => item.id !== tokenId);
  city(game, playerId).progress.push(clone(token));
  if (token.coins) city(game, playerId).coins += token.coins;
  game.log.unshift(`${playerName(room, playerId)} 获得进步标记「${token.name}」。`);
  record(game, "progress-taken", { playerId, token: clone(token) });
  game.pending = null;
  if (!checkScience(room, playerId)) finishTurn(room, playerId, after?.extraTurn);
}

function resolveSpecial(room, playerId, payload = {}) {
  const game = requireGame(room, playerId);
  if (game.phase !== "pending" || !game.pending || !["destroy", "discard-build"].includes(game.pending.kind)) throw new Error("当前没有需要处理的奇迹效果");
  requireActor(game, playerId);
  const cardId = payload.cardId;
  if (!game.pending.options.includes(cardId)) throw new Error("目标不在可选范围内");
  const kind = game.pending.kind, after = game.pending.after;
  game.pending = null;
  if (kind === "destroy") {
    const opposing = city(game, opponentId(game, playerId));
    const index = opposing.buildings.findIndex((card) => card.id === cardId);
    if (index < 0) throw new Error("目标建筑已经不存在");
    const [card] = opposing.buildings.splice(index, 1); game.discard.push(card);
    game.log.unshift(`${playerName(room, playerId)} 摧毁了「${card.name}」。`);
    record(game, "building-destroyed", { playerId, card: clone(card) });
    return finishTurn(room, playerId, after?.extraTurn);
  }
  const index = game.discard.findIndex((card) => card.id === cardId);
  if (index < 0) throw new Error("弃牌堆中已经没有这张牌");
  const [card] = game.discard.splice(index, 1);
  const deferred = applyBuilding(room, playerId, card, { free: true, after });
  game.log.unshift(`${playerName(room, playerId)} 从弃牌堆免费建造「${card.name}」。`);
  record(game, "discard-rebuilt", { playerId, card: clone(card) });
  if (!deferred && game.status !== "finished") finishTurn(room, playerId, after?.extraTurn);
}

function chooseStarter(room, playerId, starterId) {
  const game = requireGame(room, playerId);
  if (game.phase !== "choose-starter" || game.pending?.kind !== "age-starter") throw new Error("当前不需要选择先手");
  requireActor(game, playerId);
  if (!game.playerIds.includes(starterId)) throw new Error("先手玩家无效");
  setupAge(room, game.pending.nextAge, starterId);
}

function militaryScore(game, playerId) {
  const advantage = game.playerIds[0] === playerId ? game.military : -game.military;
  if (advantage <= 0) return 0;
  if (advantage >= 6) return 10;
  if (advantage >= 3) return 5;
  return 2;
}
function scoreCity(game, playerId) {
  const own = city(game, playerId);
  const building = own.buildings.reduce((sum, card) => sum + (card.vp || 0), 0);
  const wonder = own.wonders.filter((item) => item.built).reduce((sum, item) => sum + (item.vp || 0), 0);
  let progress = own.progress.reduce((sum, token) => sum + (token.vp || 0), 0);
  if (hasProgress(own, "mathematics")) progress += own.progress.length * 3;
  const guild = own.buildings.filter((card) => card.type === "guild").reduce((sum, card) => sum + metric(game, card.guildMetric) * (card.vpPer || 0), 0);
  const military = militaryScore(game, playerId), treasury = Math.floor(own.coins / 3);
  return { building, wonder, progress, guild, military, treasury, total: building + wonder + progress + guild + military + treasury, blue: own.buildings.filter((card) => card.type === "civilian").reduce((sum, card) => sum + (card.vp || 0), 0) };
}
function finishCivilian(room) {
  const game = room.game;
  const ranking = game.playerIds.map((playerId) => ({ playerId, ...scoreCity(game, playerId) })).sort((a, b) => b.total - a.total || b.blue - a.blue);
  game.status = "finished"; game.phase = "finished"; game.actorId = null; game.pending = null; game.ranking = ranking;
  game.winnerId = ranking[0].total === ranking[1].total && ranking[0].blue === ranking[1].blue ? null : ranking[0].playerId;
  game.victoryType = "civilian";
  game.log.unshift(game.winnerId ? `${playerName(room, game.winnerId)} 以文明分数赢得对决！` : "两座文明势均力敌，共享胜利！");
  record(game, "victory", { playerId: game.winnerId, victoryType: "civilian", ranking: clone(ranking) });
}

function citySummary(game, playerId) {
  const own = city(game, playerId);
  return { fixed: fixedProduction(own), flexible: flexibleProduction(own), science: scienceSymbols(own), shields: own.buildings.reduce((sum, card) => sum + (card.shields || 0), 0) + own.wonders.filter((wonder) => wonder.built).reduce((sum, wonder) => sum + (wonder.shields || 0), 0) };
}
function legalFor(game, viewerId) {
  if (game.phase !== "playing" || game.actorId !== viewerId) return null;
  const result = {};
  for (const slot of game.cardSlots.filter((item) => !item.taken && item.revealed && isAccessible(game, item))) {
    const build = constructionCost(game, viewerId, slot.card, "building");
    const wonders = city(game, viewerId).wonders.filter((wonder) => !wonder.built && !wonder.removed).map((wonder) => ({ id: wonder.id, cost: constructionCost(game, viewerId, wonder, "wonder") }));
    result[slot.id] = { build, canBuild: city(game, viewerId).coins >= build.total, discardValue: 2 + city(game, viewerId).buildings.filter((card) => card.type === "commercial").length, wonders };
  }
  return result;
}
function publicRoom(room, viewerId) {
  const players = room.players.map(({ token: _token, ...player }) => player);
  const game = room.game;
  if (!game) return { code: room.code, hostId: room.hostId, players, game: null };
  const pendingView = game.pending ? { ...game.pending } : null;
  if (pendingView?.kind === "hidden-progress") pendingView.options = pendingView.playerId === viewerId ? game.hiddenProgress.filter((token) => pendingView.options.includes(token.id)) : [];
  else if (pendingView?.kind === "progress") pendingView.options = game.availableProgress.filter((token) => pendingView.options.includes(token.id));
  else if (pendingView?.kind === "discard-build") pendingView.options = game.discard.filter((card) => pendingView.options.includes(card.id));
  return {
    code: room.code, hostId: room.hostId, players,
    game: {
      status: game.status, phase: game.phase, age: game.age, playerIds: [...game.playerIds], firstPlayerId: game.firstPlayerId, actorId: game.actorId,
      military: game.military, militaryTokens: game.militaryTokens, availableProgress: game.availableProgress,
      cities: Object.fromEntries(game.playerIds.map((id) => [id, { ...game.cities[id], summary: citySummary(game, id) }])),
      cardSlots: game.cardSlots.map((slot) => ({ ...slot, card: slot.revealed || slot.taken ? slot.card : null })),
      discard: game.discard, pending: pendingView, legal: legalFor(game, viewerId),
      wonderDraft: game.phase === "wonder-draft" ? { step: game.wonderDraft.step, stage: game.wonderDraft.stage, offers: game.wonderDraft.offers, sequence: game.wonderDraft.sequence } : null,
      eventSeq: game.eventSeq, lastEvent: game.lastEvent, log: game.log.slice(0, 40), ranking: game.ranking,
      winnerId: game.winnerId ?? null, victoryType: game.victoryType || null
    }
  };
}

module.exports = {
  createGame, pickWonder, takeCard, chooseProgress, resolveSpecial, chooseStarter, publicRoom,
  constructionCost, isAccessible, revealAccessible, scoreCity, setupAge,
  CARDS, WONDERS, PROGRESS, LAYOUTS, VISIBLE_ROWS, RESOURCE_META, TYPE_META
};
