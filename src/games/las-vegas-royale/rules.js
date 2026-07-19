const COLORS = ["ruby", "cyan", "gold", "violet", "emerald"];
const MONEY_COUNTS = { 30: 11, 40: 11, 50: 13, 60: 15, 70: 13, 80: 11, 90: 9, 100: 7 };
const TILES = [
  { id: "A1", name: "幸运一拳", icon: "✊" }, { id: "A2", name: "累积大奖", icon: "🎰" },
  { id: "B1", name: "黄金时刻", icon: "🌟" }, { id: "B2", name: "猜高猜低", icon: "↕" },
  { id: "C1", name: "五骰同堂", icon: "🖐" }, { id: "C2", name: "霉运临头", icon: "☠" },
  { id: "D1", name: "发薪日", icon: "💵" }, { id: "D2", name: "强势控场", icon: "⚡" },
  { id: "E1", name: "禁止入场", icon: "⛔" }, { id: "E2", name: "淘汰出局", icon: "🥊" },
  { id: "F1", name: "堵住它", icon: "🧱" }, { id: "F2", name: "让分局", icon: "♿" },
  { id: "G1", name: "黑箱", icon: "⬛" }, { id: "G2", name: "双倍下注", icon: "×2" },
  { id: "H1", name: "妙骰", icon: "✨" }, { id: "H2", name: "任我选", icon: "👑" }
];

const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};
const die = () => 1 + Math.floor(Math.random() * 6);
const requireGame = (room) => {
  if (!room.game || room.game.status !== "playing") throw new Error("游戏尚未开始或已经结束");
  return room.game;
};
const activeId = (game) => game.turnOrder[game.turnIndex];
const requireActive = (game, playerId) => {
  if (activeId(game) !== playerId) throw new Error("还没有轮到你");
  if (game.pending) throw new Error("请先完成当前板块效果");
};
const log = (game, text) => game.log.unshift(text);
const playerState = (game, id) => game.playerState[id];
const weight = (item) => item.big ? 2 : 1;
const casinoWeights = (casino) => {
  const result = {};
  casino.dice.forEach((item) => { result[item.playerId] = (result[item.playerId] || 0) + weight(item); });
  if (casino.blankDice) result.__blank = casino.blankDice;
  return result;
};
const untiedRanking = (casino) => {
  const values = casinoWeights(casino);
  const frequencies = {};
  Object.values(values).forEach((count) => { frequencies[count] = (frequencies[count] || 0) + 1; });
  return Object.entries(values).filter(([, count]) => frequencies[count] === 1).sort((a, b) => b[1] - a[1]);
};
const uniqueLeader = (casino) => untiedRanking(casino)[0]?.[0] || null;
const addCash = (game, playerId, value) => {
  if (!playerState(game, playerId)) return;
  playerState(game, playerId).cash += value;
  playerState(game, playerId).awards += 1;
};

function makeDeck() {
  return shuffle(Object.entries(MONEY_COUNTS).flatMap(([value, count]) => Array(Number(count)).fill(Number(value))));
}

function makeRoundMoney(deck) {
  const pairs = Array.from({ length: 6 }, () => [deck.pop(), deck.pop()].sort((a, b) => b - a));
  return pairs.sort((a, b) => (b[0] + b[1]) - (a[0] + a[1]) || b[0] - a[0]);
}

function setupRound(game) {
  const money = game.roundMoney[game.round - 1];
  const selected = shuffle(TILES).slice(0, 3);
  game.casinos = Array.from({ length: 6 }, (_, index) => ({
    number: index + 1, money: money[index], dice: [], blankDice: 0,
    tile: index < 3 ? { ...selected[index], state: {} } : null
  }));
  game.closedCasino = null;
  game.bar = {};
  game.niceDice = [];
  game.doubleDown = {};
  game.powerToken = null;
  game.currentRoll = null;
  game.pending = null;
  game.settlement = null;
  Object.values(game.playerState).forEach((state) => {
    state.supply = Array.from({ length: 7 }, (_, i) => ({ id: `${state.id}-r${game.round}-d${i}`, big: false }));
    state.supply.push({ id: `${state.id}-r${game.round}-big`, big: true });
    state.chips += 2;
  });
  if (game.turnOrder.length === 2) {
    const neutral = Array.from({ length: 7 }, (_, i) => ({ id: `neutral-r${game.round}-${i}`, playerId: "__neutral", big: false }));
    neutral.push({ id: `neutral-r${game.round}-big`, playerId: "__neutral", big: true });
    neutral.forEach((item) => game.casinos[die() - 1].dice.push(item));
  }
  for (const casino of game.casinos) {
    if (casino.tile?.id === "A2") casino.tile.state.jackpot = 30;
    if (casino.tile?.id === "C1") casino.tile.state.available = true;
    if (casino.tile?.id === "E1") casino.tile.state.step = 0;
    if (casino.tile?.id === "F1") casino.tile.state.clusters = [1, 1, 2, 2, 3];
    if (casino.tile?.id === "F2") {
      game.casinos.forEach((target, i) => { target.blankDice = i < 3 ? 1 : 2; });
      casino.tile.state.slots = ["chip", "chip", "30", "30", "30", "choice", "choice", "choice", "choice"];
    }
  }
  log(game, `第 ${game.round} 轮开始：奖金和三块豪华板块已经就位。`);
}

function createGame(players) {
  const deck = makeDeck();
  const game = {
    status: "playing", round: 1, turnOrder: players.map((p) => p.id), turnIndex: 0,
    playerState: {}, roundMoney: [makeRoundMoney(deck), makeRoundMoney(deck), makeRoundMoney(deck)],
    bank: deck, casinos: [], currentRoll: null, pending: null, settlement: null, log: []
  };
  players.forEach((player, index) => {
    game.playerState[player.id] = { id: player.id, color: COLORS[index], cash: 0, chips: 0, awards: 0, supply: [] };
  });
  setupRound(game);
  return game;
}

function roll(room, playerId) {
  const game = requireGame(room);
  requireActive(game, playerId);
  const state = playerState(game, playerId);
  if (!state.supply.length) throw new Error("你本轮已经没有骰子");
  if (game.currentRoll) throw new Error("请先选择一个点数");
  if (game.powerToken === playerId) game.powerToken = null;
  game.currentRoll = state.supply.map((item) => ({ ...item, face: die() }));
  log(game, `${room.players.find((p) => p.id === playerId).name} 掷出了 ${game.currentRoll.map((d) => d.face).join("、")}`);
}

function removeSupply(state, ids) {
  const chosen = state.supply.filter((item) => ids.includes(item.id));
  state.supply = state.supply.filter((item) => !ids.includes(item.id));
  return chosen;
}

function place(room, playerId, rawFace) {
  const game = requireGame(room);
  requireActive(game, playerId);
  if (!game.currentRoll) throw new Error("请先掷骰子");
  const face = Number(rawFace);
  if (!Number.isInteger(face) || face < 1 || face > 6) throw new Error("请选择有效点数");
  if (game.closedCasino === face) throw new Error("这座赌场当前禁止入场");
  const rolled = game.currentRoll.filter((item) => item.face === face);
  if (!rolled.length) throw new Error("这次没有掷出该点数");
  const state = playerState(game, playerId);
  const moved = removeSupply(state, rolled.map((item) => item.id)).map((item) => ({ ...item, playerId }));
  game.casinos[face - 1].dice.push(...moved);
  game.currentRoll = null;
  log(game, `${room.players.find((p) => p.id === playerId).name} 将 ${moved.length} 颗骰子放进 ${face} 号赌场${moved.some((d) => d.big) ? "（含 Biggy）" : ""}。`);
  refreshPowerToken(game);
  activateTile(room, playerId, face, moved);
}

function pass(room, playerId) {
  const game = requireGame(room);
  requireActive(game, playerId);
  if (!game.currentRoll) throw new Error("掷骰后才能使用筹码跳过");
  const state = playerState(game, playerId);
  const hasLegalFace = game.currentRoll.some((item) => item.face !== game.closedCasino);
  if (hasLegalFace && state.chips < 1) throw new Error("你没有筹码");
  if (hasLegalFace) state.chips -= 1;
  game.currentRoll = null;
  log(game, hasLegalFace
    ? `${room.players.find((p) => p.id === playerId).name} 支付 1 枚筹码，放弃本次结果。`
    : `${room.players.find((p) => p.id === playerId).name} 的结果全数落在封锁赌场，免费跳过。`);
  finishTurn(room);
}

function usePowerPlay(room, playerId, rawFace) {
  const game = requireGame(room);
  requireActive(game, playerId);
  if (game.powerToken !== playerId) throw new Error("你没有强势控场标记");
  const face = Number(rawFace);
  if (face < 1 || face > 6 || game.closedCasino === face) throw new Error("该赌场不可选择");
  const state = playerState(game, playerId);
  if (!state.supply.length) throw new Error("没有可放置的骰子");
  const item = state.supply.shift();
  game.casinos[face - 1].dice.push({ ...item, playerId });
  game.powerToken = null;
  log(game, `${room.players.find((p) => p.id === playerId).name} 使用强势控场，将一颗骰子翻到 ${face}。`);
  activateTile(room, playerId, face, [{ ...item, playerId }]);
}

function reward(game, playerId, cash = 0, chips = 0) {
  addCash(game, playerId, cash);
  playerState(game, playerId).chips += chips;
}

function activateTile(room, playerId, face, moved, chained = false) {
  const game = room.game;
  const casino = game.casinos[face - 1];
  const tile = casino.tile;
  if (!tile || (!chained && face > 3)) return finishTurn(room);
  const actorName = room.players.find((p) => p.id === playerId)?.name || "玩家";
  log(game, `${actorName} 激活了「${tile.name}」。`);
  switch (tile.id) {
    case "A1": game.pending = { type: "luckyChoose", actorId: playerId, casino: face }; break;
    case "A2": {
      const a = die(); const b = die();
      if (a + b === 7 || a === b) { reward(game, playerId, tile.state.jackpot); log(game, `累积大奖命中 ${tile.state.jackpot}K！`); tile.state.jackpot = 30; }
      else { tile.state.jackpot = Math.min(80, tile.state.jackpot + 10); log(game, `未命中，奖池升至 ${tile.state.jackpot}K。`); }
      finishTurn(room); break;
    }
    case "B2": game.pending = { type: "fifty", actorId: playerId, casino: face, last: die() + die(), step: 1, reward: 0 }; break;
    case "C1": {
      const ownWeight = casino.dice.filter((d) => d.playerId === playerId).reduce((sum, d) => sum + weight(d), 0);
      if (tile.state.available && ownWeight >= 5) { tile.state.available = false; tile.state.ownerId = playerId; log(game, `${actorName} 拿到了五骰同堂的 100K 奖励标记。`); }
      finishTurn(room); break;
    }
    case "D1": {
      const occupied = game.casinos.filter((c) => c.dice.some((d) => d.playerId === playerId)).length;
      occupied <= 2 ? reward(game, playerId, 0, occupied) : reward(game, playerId, occupied * 10);
      log(game, `发薪日结算：覆盖 ${occupied} 座赌场。`); finishTurn(room); break;
    }
    case "D2": refreshPowerToken(game); finishTurn(room); break;
    case "E1": game.pending = { type: "noEntry", actorId: playerId, casino: face }; break;
    case "E2": {
      for (const id of game.turnOrder) {
        if (id === playerId || (game.bar[id] || []).length >= 2) continue;
        const target = playerState(game, id);
        if (target.supply.length) (game.bar[id] ||= []).push(target.supply.shift());
      }
      const returned = game.bar[playerId] || [];
      playerState(game, playerId).supply.push(...returned); game.bar[playerId] = [];
      finishTurn(room); break;
    }
    case "F1":
      if (!tile.state.clusters.length) finishTurn(room);
      else game.pending = { type: "block", actorId: playerId, casino: face, clusters: tile.state.clusters };
      break;
    case "F2":
      if (!tile.state.slots.length || !game.casinos.some((target) => target.blankDice && target.number !== game.closedCasino)) finishTurn(room);
      else game.pending = { type: "handicap", actorId: playerId, casino: face, slots: tile.state.slots };
      break;
    case "G2": game.pending = { type: "doubleDown", actorId: playerId, casino: face, max: casino.dice.filter((d) => d.playerId === playerId).length }; break;
    case "H1": game.pending = { type: "niceDice", actorId: playerId, casino: face, dieIds: moved.map((d) => d.id) }; break;
    case "H2": game.pending = { type: "myChoice", actorId: playerId, casino: face, options: [...new Set([die(), die()])] }; break;
    default: finishTurn(room);
  }
}

function refreshPowerToken(game) {
  const powerCasino = game.casinos.find((c) => c.tile?.id === "D2");
  if (!powerCasino) return;
  const values = casinoWeights(powerCasino);
  const maximum = Math.max(0, ...Object.values(values));
  const leaders = Object.entries(values).filter(([, count]) => count === maximum);
  if (maximum === 0 || leaders.length !== 1 || leaders[0][0].startsWith("__")) game.powerToken = null;
  else game.powerToken = leaders[0][0];
  powerCasino.tile.state.ownerId = game.powerToken;
}

function nextPlayableIndex(game, start) {
  for (let offset = 1; offset <= game.turnOrder.length; offset += 1) {
    const index = (start + offset) % game.turnOrder.length;
    if (playerState(game, game.turnOrder[index]).supply.length) return index;
  }
  return -1;
}

function finishTurn(room) {
  const game = room.game;
  if (game.pending) return;
  refreshPowerToken(game);
  const next = nextPlayableIndex(game, game.turnIndex);
  if (next === -1) return beginSettlement(room);
  game.turnIndex = next;
}

function resolvePending(room, playerId, payload = {}) {
  const game = requireGame(room);
  const pending = game.pending;
  if (!pending) throw new Error("当前没有待处理的选择");
  if (pending.actorId !== playerId) throw new Error("正在等待另一位玩家选择");
  const state = playerState(game, playerId);
  const casino = game.casinos[pending.casino - 1];
  switch (pending.type) {
    case "luckyChoose": {
      const count = Math.max(1, Math.min(3, Number(payload.count)));
      const leftIndex = (game.turnOrder.indexOf(playerId) + 1) % game.turnOrder.length;
      game.pending = { type: "luckyGuess", actorId: game.turnOrder[leftIndex], ownerId: playerId, casino: pending.casino, secretCount: count };
      return;
    }
    case "luckyGuess": {
      const guess = Number(payload.count);
      if (guess !== pending.secretCount) {
        if (pending.secretCount === 1) reward(game, pending.ownerId, 0, 2);
        else reward(game, pending.ownerId, pending.secretCount === 2 ? 30 : 40);
        log(game, "猜错了，幸运一拳的奖励由激活者获得。");
      } else log(game, "猜中了！幸运一拳没有发出奖励。");
      game.pending = null; finishTurn(room); return;
    }
    case "fifty": {
      if (payload.choice === "cashout") { reward(game, playerId, pending.reward); game.pending = null; finishTurn(room); return; }
      if (!["higher", "lower"].includes(payload.choice)) throw new Error("请选择收手、猜大或猜小");
      const next = die() + die();
      const won = payload.choice === "higher" ? next > pending.last : next < pending.last;
      if (!won) { log(game, `猜高猜低失败（${pending.last} → ${next}），本次无奖励。`); game.pending = null; finishTurn(room); return; }
      const step = Math.min(5, pending.step + 1);
      game.pending = { ...pending, last: next, step, reward: [0, 10, 20, 30, 40, 60][step] };
      return;
    }
    case "noEntry": {
      const target = Number(payload.casino);
      if (target < 1 || target > 6 || target === pending.casino) throw new Error("请选择另一座赌场");
      if (target === game.closedCasino) { game.pending = null; finishTurn(room); return; }
      game.closedCasino = target;
      casino.tile.state.step = Math.min(5, (casino.tile.state.step || 0) + 1);
      const prize = [0, 0, 10, 20, 0, 40][casino.tile.state.step];
      if (prize) reward(game, playerId, prize);
      game.pending = null; finishTurn(room); return;
    }
    case "block": {
      const cluster = Number(payload.cluster); const target = Number(payload.casino);
      if (!pending.clusters.includes(cluster) || target < 1 || target > 6 || target === game.closedCasino) throw new Error("请选择有效的灰骰组和未封锁赌场");
      casino.tile.state.clusters.splice(casino.tile.state.clusters.indexOf(cluster), 1);
      game.casinos[target - 1].blankDice += cluster;
      game.pending = null; refreshPowerToken(game); finishTurn(room); return;
    }
    case "handicap": {
      if (payload.skip) { game.pending = null; finishTurn(room); return; }
      const source = Number(payload.source); const slot = Number(payload.slot);
      if (source < 1 || source > 6 || source === game.closedCasino || !game.casinos[source - 1].blankDice || slot < 0 || slot >= casino.tile.state.slots.length) throw new Error("请选择未封锁赌场中的灰骰和有效奖励格");
      game.casinos[source - 1].blankDice -= 1;
      const kind = casino.tile.state.slots.splice(slot, 1)[0];
      if (kind === "chip") reward(game, playerId, 0, 1);
      if (kind === "30") reward(game, playerId, 30);
      if (kind === "choice") manipulateOwnDie(game, playerId, payload);
      game.pending = null; refreshPowerToken(game); finishTurn(room); return;
    }
    case "doubleDown": {
      const count = Math.max(0, Math.min(pending.max, Number(payload.count) || 0));
      const own = casino.dice.filter((d) => d.playerId === playerId).slice(0, count);
      casino.dice = casino.dice.filter((d) => !own.some((x) => x.id === d.id));
      (game.doubleDown[pending.casino] ||= []).push(...own);
      game.pending = null; refreshPowerToken(game); finishTurn(room); return;
    }
    case "niceDice": {
      if (!payload.dieId) { game.pending = null; finishTurn(room); return; }
      const item = casino.dice.find((d) => d.id === payload.dieId && d.playerId === playerId && pending.dieIds.includes(d.id));
      if (!item) throw new Error("请选择刚放下的骰子");
      casino.dice = casino.dice.filter((d) => d.id !== item.id);
      const occupied = game.niceDice.find((d) => d.face === pending.casino);
      if (occupied) game.casinos[occupied.face - 1].dice.push(occupied);
      game.niceDice = game.niceDice.filter((d) => d.face !== pending.casino);
      game.niceDice.push({ ...item, face: pending.casino });
      game.pending = null; refreshPowerToken(game); finishTurn(room); return;
    }
    case "myChoice": {
      const option = Number(payload.option);
      if (!pending.options.includes(option)) throw new Error("请选择黑骰掷出的结果");
      if (option === 1) reward(game, playerId, 0, 1);
      else if (option === 2) reward(game, playerId, 0, 2);
      else if (option === 3) reward(game, playerId, 30);
      else if (option === 4) {
        const target = Number(payload.casino);
        if (target < 1 || target > 6 || target === game.closedCasino || !game.casinos[target - 1].tile || target === pending.casino) throw new Error("请选择另一块未封锁的豪华板块");
        game.pending = null; activateTile(room, playerId, target, [], true); return;
      } else if (option === 5) manipulateOwnDie(game, playerId, payload);
      else if (option === 6 && state.supply.length) { casino.tile.state.goldenOwner = playerId; casino.tile.state.goldenDie = state.supply.shift(); }
      game.pending = null; finishTurn(room); return;
    }
    case "primeTime": {
      const selected = Array.isArray(payload.indices) ? payload.indices.map(Number) : [];
      pending.roll.forEach((face, index) => {
        if (selected.includes(index) && game.closedCasino !== face) game.casinos[face - 1].dice.push({ id: `prime-${Date.now()}-${index}`, playerId, big: false, extra: true });
      });
      game.pending = null; continueSettlement(room); return;
    }
    case "blackDivide": {
      const indices = Array.isArray(payload.indices) ? [...new Set(payload.indices.map(Number))] : [];
      if (!indices.length || indices.length >= 6 || indices.some((i) => i < 0 || i > 5)) throw new Error("请把奖励分成两个非空组");
      game.pending = { ...pending, type: "blackChoose", actorId: pending.winnerId, piles: [indices, [0, 1, 2, 3, 4, 5].filter((i) => !indices.includes(i))] };
      return;
    }
    case "blackChoose": {
      const pile = Number(payload.pile);
      if (![0, 1].includes(pile)) throw new Error("请选择一组黑箱奖励");
      const rewards = ["chip", "chip", 40, 60, 80, 100];
      pending.piles[pile].forEach((i) => rewards[i] === "chip" ? reward(game, playerId, 0, 1) : reward(game, playerId, rewards[i]));
      game.pending = null; game.settlement.casinoIndex += 1; continueSettlement(room); return;
    }
    default: throw new Error("未知的板块选择");
  }
}

function manipulateOwnDie(game, playerId, payload) {
  const state = playerState(game, playerId);
  if (payload.mode === "return") {
    for (const casino of game.casinos) {
      if (casino.number === game.closedCasino) continue;
      const item = casino.dice.find((d) => d.playerId === playerId && d.id === payload.dieId);
      if (item) { casino.dice = casino.dice.filter((d) => d.id !== item.id); state.supply.push({ id: item.id, big: item.big }); return; }
    }
    throw new Error("请选择一颗已放置的己方骰子");
  }
  const face = Number(payload.face);
  if (face < 1 || face > 6 || !state.supply.length || game.closedCasino === face) throw new Error("请选择有效点数并确认还有骰子");
  const item = state.supply.shift();
  game.casinos[face - 1].dice.push({ ...item, playerId });
}

function beginSettlement(room) {
  const game = room.game;
  game.currentRoll = null;
  game.settlement = { phase: "prime", primeIndex: 0, casinoIndex: 0, nextStarter: null, badLuckDone: false };
  continueSettlement(room);
}

function continueSettlement(room) {
  const game = room.game; const settlement = game.settlement;
  const primeCasinos = game.casinos.filter((c) => c.tile?.id === "B1");
  if (settlement.phase === "prime" && settlement.primeIndex < primeCasinos.length) {
    const casino = primeCasinos[settlement.primeIndex++];
    const winnerId = uniqueLeader(casino);
    if (winnerId && !winnerId.startsWith("__")) {
      game.pending = { type: "primeTime", actorId: winnerId, casino: casino.number, roll: [die(), die()] };
      return;
    }
    return continueSettlement(room);
  }
  settlement.phase = "payout";
  if (!settlement.badLuckDone) {
    settlement.badLuckDone = true;
    for (const casino of game.casinos.filter((c) => c.tile?.id === "C2")) {
      const weights = casinoWeights(casino);
      const counts = game.turnOrder.map((id) => weights[id] || 0); const low = Math.min(...counts);
      game.turnOrder.filter((id) => (weights[id] || 0) === low).forEach((id) => {
        const state = playerState(game, id); const due = Math.min(50, state.cash + state.chips * 10);
        const chipPay = Math.min(state.chips, Math.ceil(Math.max(0, due - state.cash) / 10));
        state.chips -= chipPay; state.cash = Math.max(0, state.cash - (due - chipPay * 10));
      });
    }
  }
  if (settlement.casinoIndex < 6) {
    const casino = game.casinos[settlement.casinoIndex];
    const ranking = untiedRanking(casino).slice(0, 2);
    const winners = ranking.map(([id]) => id.startsWith("__") ? null : id);
    casino.money.forEach((value, index) => { if (winners[index]) addCash(game, winners[index], value); });
    if (!settlement.nextStarter && winners[0]) settlement.nextStarter = winners[0];
    if (casino.tile?.id === "C1" && casino.tile.state.ownerId) addCash(game, casino.tile.state.ownerId, 100);
    if (casino.tile?.id === "G2") {
      const side = { dice: game.doubleDown[casino.number] || [], blankDice: 0 };
      const sideRanks = untiedRanking(side).filter(([id]) => !id.startsWith("__"));
      if (sideRanks[0]) addCash(game, sideRanks[0][0], 60);
      if (sideRanks[1]) addCash(game, sideRanks[1][0], 30);
    }
    if (casino.tile?.id === "H1") {
      const payouts = { 1: [0, 1], 2: [0, 2], 3: [30, 0], 4: [40, 0], 5: [50, 0], 6: [60, 0] };
      game.niceDice.filter((d) => d.face === casino.number).forEach((d) => reward(game, d.playerId, ...payouts[d.face]));
    }
    if (casino.tile?.id === "H2" && casino.tile.state.goldenOwner) addCash(game, casino.tile.state.goldenOwner, 60);
    if (casino.tile?.id === "G1" && winners[0]) {
      const winnerId = winners[0]; const left = game.turnOrder[(game.turnOrder.indexOf(winnerId) + 1) % game.turnOrder.length];
      game.pending = { type: "blackDivide", actorId: left, winnerId, casino: casino.number };
      return;
    }
    settlement.casinoIndex += 1;
    return continueSettlement(room);
  }
  endRound(room);
}

function endRound(room) {
  const game = room.game;
  const totals = game.turnOrder.map((id) => ({ id, total: playerState(game, id).cash + playerState(game, id).chips * 10 }));
  log(game, `第 ${game.round} 轮结算完成。当前最高资产 ${Math.max(...totals.map((x) => x.total))}K。`);
  if (game.round === 3) {
    game.status = "finished"; game.pending = null; game.currentRoll = null;
    game.finalRanking = totals.sort((a, b) => b.total - a.total || (playerState(game, b.id).awards + playerState(game, b.id).chips) - (playerState(game, a.id).awards + playerState(game, a.id).chips));
    log(game, "三轮结束，最终资产已经公开。");
    return;
  }
  const nextStarter = game.settlement.nextStarter || game.turnOrder[0];
  game.round += 1; game.turnIndex = game.turnOrder.indexOf(nextStarter); setupRound(game);
}

function publicRoom(room, viewerId) {
  const game = room.game;
  const players = room.players.map(({ token: _token, ...player }) => {
    if (!game) return player;
    const state = game.playerState[player.id];
    const reveal = game.status === "finished" || player.id === viewerId;
    return { ...player, color: state.color, chips: state.chips, diceLeft: state.supply.length, cash: reveal ? state.cash : null, total: reveal ? state.cash + state.chips * 10 : null };
  });
  if (!game) return { ...room, players };
  const safePending = game.pending ? { ...game.pending } : null;
  if (safePending?.type === "luckyGuess") delete safePending.secretCount;
  if (safePending?.type === "blackChoose") safePending.piles = safePending.piles.map((pile) => Array(pile.length).fill(null));
  return {
    code: room.code, hostId: room.hostId, players,
    game: {
      status: game.status, round: game.round, currentTurnId: activeId(game), currentRoll: game.currentRoll,
      casinos: game.casinos, closedCasino: game.closedCasino, bar: game.bar, niceDice: game.niceDice,
      doubleDown: game.doubleDown, powerToken: game.powerToken, pending: safePending, log: game.log.slice(0, 40),
      finalRanking: game.finalRanking || null
    }
  };
}

module.exports = { COLORS, TILES, createGame, publicRoom, roll, place, pass, usePowerPlay, resolvePending, untiedRanking };
