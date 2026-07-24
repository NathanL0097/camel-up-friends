const { deck, compare, bestHoldem, bestOmaha } = require("./evaluator");
const TURN_MS = 30_000;
const EXTENSION_CARDS = 5;
const DISCONNECT_GRACE_MS = 10_000;
const RECONNECT_GRACE_MS = 15_000;
const MODES = ["holdem", "omaha", "mixed"];
const TABLE_MODES = ["cash", "sng"];
const SNG_HANDS_PER_LEVEL = 5;
const SNG_BLIND_MULTIPLIERS = [1, 2, 3, 5, 8, 12, 20, 30, 50, 80, 120];

function shuffle(items, random = Math.random) { const out = [...items]; for (let i = out.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; }
function defaults() { return { mode: "holdem", tableMode: "cash", buyIn: 1000, smallBlind: 5, bigBlind: 10 }; }
function configure(room, playerId, payload) {
  if (room.hostId !== playerId) throw new Error("只有房主可以设置牌桌");
  if (room.game) throw new Error("牌局开始后不能修改设置");
  const buyIn = Math.round(Number(payload.buyIn));
  const smallBlind = Math.round(Number(payload.smallBlind ?? room.settings?.smallBlind ?? 5));
  const bigBlind = Math.round(Number(payload.bigBlind ?? room.settings?.bigBlind ?? 10));
  const tableMode = TABLE_MODES.includes(payload.tableMode) ? payload.tableMode : "cash";
  const mode = tableMode === "sng" ? "holdem" : payload.mode;
  if (!MODES.includes(mode)) throw new Error("请选择正确的游戏模式");
  if (!Number.isFinite(buyIn) || buyIn < 100 || buyIn > 1_000_000) throw new Error("每人带入须为100至1,000,000");
  if (!Number.isFinite(smallBlind) || smallBlind < 1 || smallBlind > 1_000_000) throw new Error("小盲须为1至1,000,000");
  if (!Number.isFinite(bigBlind) || bigBlind <= smallBlind || bigBlind > 1_000_000) throw new Error("大盲必须高于小盲且不超过1,000,000");
  room.settings = { mode, tableMode, buyIn, smallBlind, bigBlind };
}
function gameType(game) { return game.mode === "mixed" ? (game.handNumber % 2 ? "holdem" : "omaha") : game.mode; }
function activeSeats(room) { return room.players.map((p, i) => ({ p, i })).filter(({ p }) => p.chips > 0 && p.connected !== false); }
function nextIndex(room, from, predicate) { for (let n = 1; n <= room.players.length; n += 1) { const i = (from + n) % room.players.length; if (predicate(room.players[i], i)) return i; } return null; }
function createGame(players, settings = {}, random = Math.random, now = Date.now()) {
  const config = { ...defaults(), ...settings };
  if (config.tableMode === "sng") config.mode = "holdem";
  players.forEach((p) => Object.assign(p, { chips: config.buyIn, timeCards: EXTENSION_CARDS, rebuyRequest: false, sittingOut: false, eliminated: false, eliminatedAtHand: null }));
  const smallBlind = Math.max(1, Math.round(config.smallBlind)), bigBlind = Math.max(smallBlind + 1, Math.round(config.bigBlind));
  const game = { status: "playing", mode: config.mode, tableMode: config.tableMode, buyIn: config.buyIn, baseSmallBlind: smallBlind, baseBigBlind: bigBlind, smallBlind, bigBlind, blindLevel: 1, handsPerLevel: SNG_HANDS_PER_LEVEL, nextBlindHand: config.tableMode === "sng" ? SNG_HANDS_PER_LEVEL + 1 : null, handNumber: 0, handType: null, dealerIndex: -1, street: "waiting", board: [], pot: 0, currentBet: 0, lastRaise: 0, raiseLocked: [], actorIndex: null, deadline: null, deck: [], log: [], showdown: null, tournamentWinner: null, random };
  startHand({ players, game }, now); return game;
}
function postBlind(player, amount) { const paid = Math.min(player.chips, amount); player.chips -= paid; player.bet += paid; player.contributed += paid; if (!player.chips) player.allIn = true; return paid; }
function startHand(room, now = Date.now()) {
  const game = room.game;
  if (game.tableMode === "sng") {
    room.players.forEach((p) => { if (p.chips <= 0) { p.eliminated = true; p.eliminatedAtHand ??= game.handNumber; } });
    const survivors = room.players.filter((p) => p.chips > 0);
    if (survivors.length <= 1) {
      const winner = survivors[0] || [...room.players].sort((a, b) => b.chips - a.chips)[0];
      game.status = "finished"; game.street = "tournament-end"; game.actorIndex = null; game.deadline = null;
      game.tournamentWinner = winner ? { id: winner.id, name: winner.name, chips: winner.chips } : null;
      if (winner) game.log.unshift(`🏆 ${winner.name}赢得本场SNG锦标赛`);
      return;
    }
  }
  const seats = activeSeats(room);
  if (seats.length < 2) { game.street = "waiting"; game.actorIndex = null; game.deadline = null; return; }
  game.handNumber += 1;
  if (game.tableMode === "sng") {
    const levelIndex = Math.min(SNG_BLIND_MULTIPLIERS.length - 1, Math.floor((game.handNumber - 1) / SNG_HANDS_PER_LEVEL));
    const multiplier = SNG_BLIND_MULTIPLIERS[levelIndex];
    game.blindLevel = levelIndex + 1; game.smallBlind = game.baseSmallBlind * multiplier; game.bigBlind = game.baseBigBlind * multiplier;
    game.nextBlindHand = levelIndex < SNG_BLIND_MULTIPLIERS.length - 1 ? (levelIndex + 1) * SNG_HANDS_PER_LEVEL + 1 : null;
  }
  game.handType = gameType(game); game.board = []; game.deck = shuffle(deck(), game.random); game.pot = 0; game.currentBet = 0; game.lastRaise = game.bigBlind; game.raiseLocked = []; game.showdown = null; game.runoutFromStreet = null;
  room.players.forEach((p) => Object.assign(p, { hole: [], shownCards: [], folded: p.chips <= 0 || p.sittingOut || p.connected === false, allIn: false, bet: 0, contributed: 0, acted: false, lastAction: p.eliminated ? "已淘汰" : "" }));
  game.dealerIndex = nextIndex(room, game.dealerIndex, (p) => !p.folded);
  const headsUp = seats.length === 2;
  const sb = headsUp ? game.dealerIndex : nextIndex(room, game.dealerIndex, (p) => !p.folded);
  const bb = nextIndex(room, sb, (p) => !p.folded);
  const cardsEach = game.handType === "omaha" ? 4 : 2;
  for (let c = 0; c < cardsEach; c += 1) for (let i = 0; i < room.players.length; i += 1) if (!room.players[i].folded) room.players[i].hole.push(game.deck.pop());
  postBlind(room.players[sb], game.smallBlind); postBlind(room.players[bb], game.bigBlind);
  room.players[sb].lastAction = `小盲 ${room.players[sb].bet}`; room.players[bb].lastAction = `大盲 ${room.players[bb].bet}`;
  game.currentBet = Math.max(room.players[sb].bet, room.players[bb].bet); refreshPot(room); game.street = "preflop";
  game.actorIndex = headsUp ? sb : nextIndex(room, bb, (p) => !p.folded && !p.allIn); game.deadline = now + TURN_MS;
  game.log.unshift(`${game.tableMode === "sng" ? `SNG第${game.blindLevel}级 · 盲注${game.smallBlind}/${game.bigBlind} · ` : ""}第${game.handNumber}手 · ${game.handType === "holdem" ? "无限注德州" : "底池限注奥马哈"}`); game.log = game.log.slice(0, 30);
}
function contenders(room) { return room.players.filter((p) => !p.folded && p.hole?.length); }
function refreshPot(room) { room.game.pot = room.players.reduce((sum, p) => sum + (p.contributed || 0), 0); }
function roundDone(room) { const live = contenders(room).filter((p) => !p.allIn); return live.length === 0 || live.every((p) => p.acted && p.bet === room.game.currentBet); }
function awardSingle(room, winner, now = Date.now()) { refreshPot(room); winner.chips += room.game.pot; room.game.showdown = { reason: "fold", winners: [{ id: winner.id, amount: room.game.pot, hand: "其他玩家弃牌" }], hands: [] }; room.game.street = "showdown"; room.game.actorIndex = null; room.game.deadline = now + 8000; }
function showdown(room, now = Date.now()) {
  const game = room.game; refreshPot(room); const live = contenders(room);
  const evaluated = live.map((p) => ({ player: p, result: game.handType === "omaha" ? bestOmaha(p.hole, game.board) : bestHoldem(p.hole, game.board) }));
  const levels = [...new Set(room.players.map((p) => p.contributed).filter(Boolean))].sort((a, b) => a - b); let previous = 0; const winnings = new Map();
  for (const level of levels) { const contributors = room.players.filter((p) => p.contributed >= level); const amount = (level - previous) * contributors.length; const eligible = evaluated.filter(({ player }) => player.contributed >= level); if (!eligible.length) continue; const best = eligible.reduce((top, item) => compare(item.result.score, top.result.score) > 0 ? item : top, eligible[0]); const winners = eligible.filter((item) => compare(item.result.score, best.result.score) === 0); const share = Math.floor(amount / winners.length); let odd = amount - share * winners.length; for (const item of winners) { winnings.set(item.player.id, (winnings.get(item.player.id) || 0) + share + (odd-- > 0 ? 1 : 0)); } previous = level; }
  for (const [id, amount] of winnings) room.players.find((p) => p.id === id).chips += amount;
  game.showdown = { reason: "cards", winners: [...winnings].map(([id, amount]) => ({ id, amount, hand: evaluated.find((x) => x.player.id === id).result.name })), hands: evaluated.map(({ player, result }) => ({ id: player.id, cards: player.hole, hand: result.name })) };
  game.street = "showdown"; game.actorIndex = null; game.deadline = now + (game.runoutFromStreet === "preflop" ? 13_000 : 8000);
}
function advanceStreet(room, now) {
  const game = room.game,fromStreet=game.street; room.players.forEach((p) => { p.bet = 0; p.acted = false; }); game.currentBet = 0; game.lastRaise = game.bigBlind; game.raiseLocked = [];
  if (game.street === "preflop") { game.board.push(game.deck.pop(), game.deck.pop(), game.deck.pop()); game.street = "flop"; }
  else if (game.street === "flop") { game.board.push(game.deck.pop()); game.street = "turn"; }
  else if (game.street === "turn") { game.board.push(game.deck.pop()); game.street = "river"; }
  else { showdown(room, now); return; }
  const possible = contenders(room).filter((p) => !p.allIn);
  if (possible.length <= 1) { if (game.board.length < 5) { game.runoutFromStreet = fromStreet; while (game.board.length < 5) game.board.push(game.deck.pop()); } showdown(room, now); return; }
  game.actorIndex = nextIndex(room, game.dealerIndex, (p) => !p.folded && !p.allIn); game.deadline = now + TURN_MS;
}
function continueHand(room, fromIndex, now = Date.now()) {
  const live = contenders(room); if (live.length === 1) { awardSingle(room, live[0], now); return; }
  if (roundDone(room)) { advanceStreet(room, now); return; }
  room.game.actorIndex = nextIndex(room, fromIndex, (p) => !p.folded && !p.allIn); room.game.deadline = now + TURN_MS;
}
function legalActions(room, playerId) {
  const game = room.game; const index = room.players.findIndex((p) => p.id === playerId); const p = room.players[index]; if (!p || index !== game.actorIndex || !["preflop", "flop", "turn", "river"].includes(game.street)) return null;
  const call = Math.min(p.chips, Math.max(0, game.currentBet - p.bet)); const maxTotal = game.handType === "holdem" ? p.bet + p.chips : Math.min(p.bet + p.chips, p.bet + call + game.pot + call); const minTotal = game.currentBet ? game.currentBet + game.lastRaise : game.bigBlind;
  const raiseLocked = game.raiseLocked.includes(playerId); const canRaise = !raiseLocked && maxTotal > game.currentBet && (maxTotal >= minTotal || maxTotal === p.bet + p.chips);
  return { call, canCheck: call === 0, minTotal: Math.min(p.bet + p.chips, minTotal), maxTotal, canRaise, canAllIn: canRaise && (game.handType === "holdem" || p.bet + p.chips <= maxTotal) };
}
function act(room, playerId, payload, now = Date.now()) {
  const legal = legalActions(room, playerId); if (!legal) throw new Error("现在还没轮到你"); const game = room.game; const i = game.actorIndex; const p = room.players[i]; const action = payload.type;
  if (action === "fold") { p.folded = true; p.acted = true; p.lastAction = "弃牌"; }
  else if (action === "check") { if (!legal.canCheck) throw new Error("当前不能过牌"); p.acted = true; p.lastAction = "过牌"; }
  else if (action === "call") { const paid = legal.call; p.chips -= paid; p.bet += paid; p.contributed += paid; p.acted = true; if (!p.chips) p.allIn = true; p.lastAction = paid ? `跟注 ${paid}` : "过牌"; }
  else if (["raise", "allin"].includes(action)) { if (!legal.canRaise) throw new Error("本轮下注尚未重新开放"); let total = action === "allin" ? p.bet + p.chips : Math.round(Number(payload.amount)); if (!Number.isFinite(total)) throw new Error("请输入下注总额"); if (game.handType === "omaha" && total > legal.maxTotal) throw new Error(`奥马哈本次最多下注到 ${legal.maxTotal}`); total = Math.min(total, p.bet + p.chips); if (total <= game.currentBet || (total < legal.minTotal && total !== p.bet + p.chips)) throw new Error(`至少需要加注到 ${legal.minTotal}`); const paid = total - p.bet; const raiseSize = total - game.currentBet; const fullRaise = raiseSize >= game.lastRaise; if (!fullRaise) game.raiseLocked = room.players.filter((x) => x.acted && !x.folded && !x.allIn).map((x) => x.id); p.chips -= paid; p.bet = total; p.contributed += paid; p.acted = true; if (!p.chips) p.allIn = true; if (fullRaise) { game.raiseLocked = []; room.players.forEach((x) => { if (!x.folded && !x.allIn && x.id !== p.id) x.acted = false; }); game.lastRaise = raiseSize; } game.currentBet = total; p.lastAction = `${p.allIn ? "全下" : "加注"} ${total}`; }
  else throw new Error("未知操作"); refreshPot(room); continueHand(room, i, now);
}
function useTimeCard(room, playerId) { const game = room.game; const p = room.players[game.actorIndex]; if (!p || p.id !== playerId) throw new Error("只有当前行动玩家可以延时"); if (p.timeCards <= 0) throw new Error("延时卡已经用完"); p.timeCards -= 1; game.deadline += TURN_MS; p.lastAction = "使用延时卡 +30秒"; }
function handleDisconnect(room, player, now = Date.now()) {
  const game = room.game;
  if (!game || game.status !== "playing") return false;
  player.disconnectedAt = now;
  if (game.actorIndex != null && room.players[game.actorIndex]?.id === player.id && game.deadline) {
    game.deadline = Math.min(game.deadline, now + DISCONNECT_GRACE_MS);
    player.lastAction = "网络中断 · 保留10秒";
    game.log.unshift(`${player.name}网络中断，行动保留10秒`);
    game.log = game.log.slice(0, 30);
  }
  return true;
}
function handleReconnect(room, player, now = Date.now()) {
  const game = room.game;
  delete player.disconnectedAt;
  player.timeCards = EXTENSION_CARDS;
  if (!game || game.status !== "playing") return false;
  if (game.actorIndex != null && room.players[game.actorIndex]?.id === player.id && game.deadline) {
    game.deadline = Math.max(game.deadline, now + RECONNECT_GRACE_MS);
    player.lastAction = "已重连 · 恢复行动";
    game.log.unshift(`${player.name}已重连，至少保留15秒行动时间`);
    game.log = game.log.slice(0, 30);
  }
  return true;
}
function requestRebuy(room, playerId) { if (room.game?.tableMode === "sng") throw new Error("SNG锦标赛不能补码"); const p = room.players.find((x) => x.id === playerId); if (!p) throw new Error("找不到玩家"); p.rebuyRequest = true; }
function approveRebuy(room, hostId, payload) { if (room.game?.tableMode === "sng") throw new Error("SNG锦标赛不能补码"); if (room.hostId !== hostId) throw new Error("只有房主可以审批补码"); const p = room.players.find((x) => x.id === payload.playerId); const amount = Math.round(Number(payload.amount)); if (!p?.rebuyRequest) throw new Error("该玩家没有补码申请"); if (!Number.isFinite(amount) || amount < 1 || amount > 1_000_000) throw new Error("补码数量无效"); p.chips += amount; p.timeCards = EXTENSION_CARDS; p.rebuyRequest = false; p.sittingOut = false; }
function revealCards(room, playerId, payload = {}) {
  const game = room.game; const p = room.players.find((x) => x.id === playerId);
  if (!p?.hole?.length) throw new Error("你当前没有可以展示的底牌");
  if (game.street !== "showdown" || game.showdown?.reason !== "fold") throw new Error("只有弃牌结束后可以自行亮牌");
  const indexes = payload.all ? p.hole.map((_card, i) => i) : [Math.round(Number(payload.index))];
  if (indexes.some((i) => !Number.isInteger(i) || i < 0 || i >= p.hole.length)) throw new Error("请选择要展示的牌");
  p.shownCards = [...new Set([...(p.shownCards || []), ...indexes])].sort((a, b) => a - b);
}
function tick(room, now = Date.now()) { const g = room.game; if (!g || g.status === "finished") return false; if (g.street === "waiting") { if (activeSeats(room).length >= 2) { startHand(room, now); return true; } return false; } if (g.street === "showdown" && now >= g.deadline) { startHand(room, now); return true; } if (g.actorIndex != null && now >= g.deadline) { const p = room.players[g.actorIndex]; const legal = legalActions(room, p.id); act(room, p.id, { type: legal.canCheck ? "check" : "fold" }, now); return true; } return false; }
function publicRoom(room, viewerId) {
  const g = room.game; const cardShowdown = g?.street === "showdown" && g.showdown?.reason === "cards";
  return { code: room.code, hostId: room.hostId, settings: room.settings || defaults(), players: room.players.map(({ token:_t, hole, ...p }) => ({ ...p, hole: (hole || []).map((card, i) => p.id === viewerId || (cardShowdown && !p.folded) || (p.shownCards || []).includes(i) ? card : null) })), game: g ? { ...g, random:undefined, deck:undefined, legal:legalActions(room, viewerId) } : null };
}
module.exports = { TURN_MS, EXTENSION_CARDS, DISCONNECT_GRACE_MS, RECONNECT_GRACE_MS, MODES, TABLE_MODES, SNG_HANDS_PER_LEVEL, SNG_BLIND_MULTIPLIERS, defaults, configure, createGame, act, useTimeCard, requestRebuy, approveRebuy, revealCards, handleDisconnect, handleReconnect, tick, publicRoom, startHand, legalActions };
