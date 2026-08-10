const { deck, bestHoldem, compare } = require("../poker-night/evaluator");
const { createFairRound, shuffle } = require("./fair-rng");

const TABLES = new Set(["roulette", "blackjack", "holdem"]);
const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const ROULETTE_ODDS = { straight: 35, red: 1, black: 1, odd: 1, even: 1, low: 1, high: 1, dozen1: 2, dozen2: 2, dozen3: 2, column1: 2, column2: 2, column3: 2 };

const clone = (value) => JSON.parse(JSON.stringify(value));
function clampChips(value, fallback = 1000) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(100, Math.min(100000, number)) : fallback;
}
function defaults() { return { defaultChips: 1000, allocations: {} }; }
function configure(room, playerId, payload = {}) {
  if (room.hostId !== playerId) throw new Error("只有房主可以派发开局筹码");
  if (room.game) throw new Error("开局后请使用荷官台补发筹码");
  room.settings.defaultChips = clampChips(payload.defaultChips, room.settings.defaultChips);
  const allocations = payload.allocations && typeof payload.allocations === "object" ? payload.allocations : {};
  room.settings.allocations = Object.fromEntries(room.players.map((player) => [player.id, clampChips(allocations[player.id], room.settings.defaultChips)]));
}
function player(game, playerId) {
  const found = game.players.find((item) => item.playerId === playerId);
  if (!found) throw new Error("你不在赌场房间内");
  return found;
}
function log(game, text) {
  game.eventSeq += 1;
  game.log.unshift(text);
  game.log = game.log.slice(0, 16);
}
function createGame(players, settings = {}) {
  return {
    status: "playing", table: "roulette", round: 0, phase: "betting", eventSeq: 0,
    players: players.map((item) => ({ playerId: item.id, playerName: item.name, chips: clampChips(settings.allocations?.[item.id], clampChips(settings.defaultChips)), pendingBet: 10, rouletteBets: [], blackjack: null, holdem: null, lastNet: 0 })),
    dealer: { cards: [] }, board: [], wheel: null, fairness: null, deck: [], deckIndex: 0,
    log: ["AI 荷官已就位。请选择筹码并开始第一局。"]
  };
}
function idle(game) {
  if (game.phase !== "betting") throw new Error("本局进行中，请等待荷官结算");
}
function nextRound(game) {
  game.round += 1;
  const fair = createFairRound(`${game.table}-${game.round}`);
  game.fairness = { roundId: `${game.table}-${game.round}`, commit: fair.commit, seed: null };
  game._fairSeed = fair.seed;
  return fair;
}
function revealFairness(game) {
  if (game.fairness) game.fairness.seed = game._fairSeed;
  delete game._fairSeed;
}
function selectTable(room, playerId, payload = {}) {
  if (room.hostId !== playerId) throw new Error("只有房主可以切换牌桌");
  const game = room.game; idle(game);
  if (!TABLES.has(payload.table)) throw new Error("没有这张牌桌");
  game.table = payload.table; game.wheel = null; game.dealer.cards = []; game.board = [];
  for (const seat of game.players) { seat.rouletteBets = []; seat.blackjack = null; seat.holdem = null; seat.lastNet = 0; }
  log(game, `房主带大家来到${payload.table === "roulette" ? "单零轮盘" : payload.table === "blackjack" ? "Blackjack" : "Casino Hold’em"}桌。`);
}
function grantChips(room, playerId, payload = {}) {
  if (room.hostId !== playerId) throw new Error("只有房主可以派发筹码");
  idle(room.game);
  const target = player(room.game, String(payload.playerId || ""));
  const amount = Math.floor(Number(payload.amount));
  if (!Number.isFinite(amount) || amount < 1 || amount > 100000) throw new Error("每次可派发 1–100000 枚筹码");
  target.chips += amount;
  log(room.game, `房主向${target.playerName}派发 ${amount} 枚娱乐筹码。`);
}
function validStake(seat, amount) {
  const stake = Math.floor(Number(amount));
  if (!Number.isFinite(stake) || stake < 1) throw new Error("下注至少 1 枚筹码");
  if (stake > seat.chips) throw new Error("筹码不足");
  return stake;
}
function rouletteNumbers(type, value) {
  if (type === "straight") { const number = Number(value); return Number.isInteger(number) && number >= 0 && number <= 36 ? [number] : []; }
  const all = Array.from({ length: 36 }, (_, i) => i + 1);
  if (type === "red") return all.filter((n) => REDS.has(n));
  if (type === "black") return all.filter((n) => !REDS.has(n));
  if (type === "odd") return all.filter((n) => n % 2);
  if (type === "even") return all.filter((n) => n % 2 === 0);
  if (type === "low") return all.filter((n) => n <= 18);
  if (type === "high") return all.filter((n) => n >= 19);
  if (type.startsWith("dozen")) { const d = Number(type.at(-1)); return all.filter((n) => n > (d - 1) * 12 && n <= d * 12); }
  if (type.startsWith("column")) { const c = Number(type.at(-1)); return all.filter((n) => ((n - c) % 3) === 0); }
  return [];
}
function rouletteBet(room, playerId, payload = {}) {
  const game = room.game; idle(game);
  if (game.table !== "roulette") throw new Error("请先进入轮盘桌");
  const seat = player(game, playerId), type = String(payload.type || ""), amount = validStake(seat, payload.amount);
  if (!(type in ROULETTE_ODDS) || !rouletteNumbers(type, payload.value).length) throw new Error("轮盘下注位置无效");
  seat.chips -= amount;
  seat.rouletteBets.push({ id: `${Date.now()}-${seat.rouletteBets.length}`, type, value: type === "straight" ? Number(payload.value) : null, amount, odds: ROULETTE_ODDS[type] });
  log(game, `${seat.playerName}在轮盘桌放下 ${amount} 枚筹码。`);
}
function rouletteClear(room, playerId) {
  const game = room.game; idle(game); const seat = player(game, playerId);
  seat.chips += seat.rouletteBets.reduce((sum, bet) => sum + bet.amount, 0); seat.rouletteBets = [];
}
function rouletteSpin(room) {
  const game = room.game; idle(game);
  if (game.table !== "roulette") throw new Error("当前不是轮盘桌");
  if (!game.players.some((seat) => seat.rouletteBets.length)) throw new Error("至少一位玩家下注后才能转动轮盘");
  const fair = nextRound(game), result = fair.randomInt(37);
  game.phase = "result";
  game.wheel = { result, color: result === 0 ? "green" : REDS.has(result) ? "red" : "black" };
  for (const seat of game.players) {
    const stake = seat.rouletteBets.reduce((sum, bet) => sum + bet.amount, 0);
    let returned = 0;
    for (const bet of seat.rouletteBets) if (rouletteNumbers(bet.type, bet.value).includes(result)) returned += bet.amount * (bet.odds + 1);
    seat.chips += returned; seat.lastNet = returned - stake;
  }
  revealFairness(game); log(game, `轮盘停在 ${result} ${game.wheel.color === "red" ? "红" : game.wheel.color === "black" ? "黑" : "绿"}。`);
}
function resetRound(room) {
  const game = room.game;
  if (game.phase !== "result") throw new Error("荷官还没有完成结算");
  game.phase = "betting"; game.wheel = null; game.dealer.cards = []; game.board = [];
  for (const seat of game.players) { seat.rouletteBets = []; seat.blackjack = null; seat.holdem = null; seat.lastNet = 0; }
  log(game, "新一局开始，请下注。");
}
function draw(game) { return game.deck[game.deckIndex++]; }
function blackjackValue(cards) {
  let total = 0, aces = 0;
  for (const card of cards) { const rank = card[0]; if (rank === "A") { total += 11; aces++; } else total += "TJQK".includes(rank) ? 10 : Number(rank); }
  while (total > 21 && aces) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}
function isNatural(hand) { return hand.cards.length === 2 && blackjackValue(hand.cards).total === 21 && !hand.fromSplit; }
function blackjackBet(room, playerId, payload = {}) {
  const game = room.game; idle(game); if (game.table !== "blackjack") throw new Error("请先进入 Blackjack 桌");
  const seat = player(game, playerId), amount = validStake(seat, payload.amount);
  seat.blackjack = { bet: amount, hands: [], active: 0, outcome: null }; seat.pendingBet = amount;
}
function blackjackDeal(room) {
  const game = room.game; idle(game); if (game.table !== "blackjack") throw new Error("当前不是 Blackjack 桌");
  const active = game.players.filter((seat) => seat.blackjack?.bet);
  if (!active.length) throw new Error("至少一位玩家下注后才能发牌");
  const fair = nextRound(game); game.deck = shuffle(Array.from({ length: 6 }, () => deck()).flat(), fair.randomInt); game.deckIndex = 0; game.dealer.cards = [];
  for (const seat of active) { seat.chips -= seat.blackjack.bet; seat.blackjack.hands = [{ cards: [], bet: seat.blackjack.bet, done: false, fromSplit: false, result: null }]; seat.lastNet = 0; }
  for (let pass = 0; pass < 2; pass++) { for (const seat of active) seat.blackjack.hands[0].cards.push(draw(game)); game.dealer.cards.push(draw(game)); }
  game.phase = "playing";
  const dealerNatural = blackjackValue(game.dealer.cards).total === 21;
  for (const seat of active) if (isNatural(seat.blackjack.hands[0])) seat.blackjack.hands[0].done = true;
  if (dealerNatural || active.every((seat) => seat.blackjack.hands.every((hand) => hand.done))) settleBlackjack(game);
  else log(game, `AI 荷官发出 Blackjack 第 ${game.round} 局。`);
}
function currentHand(seat) {
  if (!seat.blackjack) throw new Error("你没有参与这一手");
  const hand = seat.blackjack.hands[seat.blackjack.active];
  if (!hand || hand.done) throw new Error("你的行动已经结束");
  return hand;
}
function advanceBlackjack(game, seat) {
  while (seat.blackjack.active < seat.blackjack.hands.length && seat.blackjack.hands[seat.blackjack.active].done) seat.blackjack.active += 1;
  if (game.players.filter((item) => item.blackjack?.bet).every((item) => item.blackjack.hands.every((hand) => hand.done))) settleBlackjack(game);
}
function blackjackAction(room, playerId, payload = {}) {
  const game = room.game; if (game.table !== "blackjack" || game.phase !== "playing") throw new Error("当前不能进行 Blackjack 操作");
  const seat = player(game, playerId), hand = currentHand(seat), action = String(payload.action || "");
  if (action === "hit") { hand.cards.push(draw(game)); if (blackjackValue(hand.cards).total >= 21) hand.done = true; }
  else if (action === "stand") hand.done = true;
  else if (action === "double") {
    if (hand.cards.length !== 2 || seat.chips < hand.bet) throw new Error("只有两张牌且筹码足够时才能加倍");
    seat.chips -= hand.bet; hand.bet *= 2; hand.cards.push(draw(game)); hand.done = true;
  } else if (action === "split") {
    if (hand.cards.length !== 2 || hand.cards[0][0] !== hand.cards[1][0] || seat.blackjack.hands.length >= 4 || seat.chips < hand.bet) throw new Error("这手牌不能分牌");
    seat.chips -= hand.bet; const second = hand.cards.pop(), aces = hand.cards[0][0] === "A";
    hand.fromSplit = true; hand.cards.push(draw(game)); hand.done = aces || blackjackValue(hand.cards).total >= 21;
    seat.blackjack.hands.splice(seat.blackjack.active + 1, 0, { cards: [second, draw(game)], bet: hand.bet, done: aces, fromSplit: true, result: null });
  } else throw new Error("未知的 Blackjack 操作");
  advanceBlackjack(game, seat);
}
function settleBlackjack(game) {
  while (blackjackValue(game.dealer.cards).total < 17) game.dealer.cards.push(draw(game));
  const dealer = blackjackValue(game.dealer.cards), dealerNatural = game.dealer.cards.length === 2 && dealer.total === 21;
  for (const seat of game.players.filter((item) => item.blackjack?.bet)) {
    const spent = seat.blackjack.hands.reduce((sum, hand) => sum + hand.bet, 0); let returned = 0;
    for (const hand of seat.blackjack.hands) {
      const value = blackjackValue(hand.cards), natural = isNatural(hand);
      if (value.total > 21) hand.result = "爆牌";
      else if (natural && !dealerNatural) { returned += hand.bet * 2.5; hand.result = "Blackjack 3:2"; }
      else if (dealerNatural && !natural) hand.result = "庄家 Blackjack";
      else if (natural && dealerNatural) { returned += hand.bet; hand.result = "和局"; }
      else if (dealer.total > 21 || value.total > dealer.total) { returned += hand.bet * 2; hand.result = "获胜"; }
      else if (value.total === dealer.total) { returned += hand.bet; hand.result = "和局"; }
      else hand.result = "落败";
    }
    seat.chips += returned; seat.lastNet = returned - spent;
  }
  game.phase = "result"; revealFairness(game); log(game, `Blackjack 结算：庄家 ${dealer.total}${dealer.total > 21 ? " 爆牌" : " 点"}。`);
}
function holdemBet(room, playerId, payload = {}) {
  const game = room.game; idle(game); if (game.table !== "holdem") throw new Error("请先进入 Casino Hold’em 桌");
  const seat = player(game, playerId), ante = Math.floor(Number(payload.ante)), aa = Math.max(0, Math.floor(Number(payload.aa || 0)));
  if (!Number.isFinite(ante) || ante < 1 || !Number.isFinite(aa) || ante * 3 + aa > seat.chips) throw new Error("至少下注 1 枚 Ante，并预留两倍跟注筹码");
  seat.holdem = { ante, aa, cards: [], decision: null, result: null, handName: null }; seat.pendingBet = ante;
}
function holdemDeal(room) {
  const game = room.game; idle(game); if (game.table !== "holdem") throw new Error("当前不是 Casino Hold’em 桌");
  const active = game.players.filter((seat) => seat.holdem?.ante);
  if (!active.length) throw new Error("至少一位玩家下注后才能发牌");
  const fair = nextRound(game); game.deck = shuffle(deck(), fair.randomInt); game.deckIndex = 0; game.dealer.cards = [draw(game), draw(game)];
  for (const seat of active) { seat.chips -= seat.holdem.ante + seat.holdem.aa; seat.holdem.cards = [draw(game), draw(game)]; seat.lastNet = 0; }
  game.board = [draw(game), draw(game), draw(game)]; game.phase = "decision"; log(game, `Casino Hold’em 第 ${game.round} 局翻牌，请选择弃牌或跟注。`);
}
function anteOdds(score) { return score[0] === 8 && score[1] === 14 ? 100 : score[0] === 8 ? 20 : score[0] === 7 ? 10 : score[0] === 6 ? 3 : score[0] === 5 ? 2 : 1; }
function aaOdds(score) { return score[0] === 8 && score[1] === 14 ? 100 : score[0] === 8 ? 50 : score[0] === 7 ? 20 : score[0] >= 2 || (score[0] === 1 && score[1] === 14) ? 7 : 0; }
function dealerQualifies(hand) { return hand.score[0] > 1 || (hand.score[0] === 1 && hand.score[1] >= 4); }
function holdemDecision(room, playerId, payload = {}) {
  const game = room.game; if (game.table !== "holdem" || game.phase !== "decision") throw new Error("当前不能进行 Hold’em 操作");
  const seat = player(game, playerId); if (!seat.holdem || seat.holdem.decision) throw new Error("你已经完成选择");
  const decision = String(payload.decision || "");
  if (decision === "call") { const call = seat.holdem.ante * 2; if (seat.chips < call) throw new Error("筹码不足以跟注"); seat.chips -= call; seat.holdem.decision = "call"; }
  else if (decision === "fold") seat.holdem.decision = "fold";
  else throw new Error("请选择弃牌或跟注");
  if (game.players.filter((item) => item.holdem?.ante).every((item) => item.holdem.decision)) settleHoldem(game);
}
function settleHoldem(game) {
  game.board.push(draw(game), draw(game)); const dealerHand = bestHoldem(game.dealer.cards, game.board), qualifies = dealerQualifies(dealerHand);
  for (const seat of game.players.filter((item) => item.holdem?.ante)) {
    const bet = seat.holdem, hand = bestHoldem(bet.cards, game.board); bet.handName = hand.name;
    const spent = bet.ante + bet.aa + (bet.decision === "call" ? bet.ante * 2 : 0); let returned = 0;
    if (bet.aa && aaOdds(hand.score)) returned += bet.aa * (aaOdds(hand.score) + 1);
    if (bet.decision === "fold") bet.result = "弃牌";
    else if (!qualifies) { returned += bet.ante * (anteOdds(hand.score) + 1) + bet.ante * 2; bet.result = "庄家未成牌"; }
    else {
      const result = compare(hand.score, dealerHand.score);
      if (result > 0) { returned += bet.ante * (anteOdds(hand.score) + 1) + bet.ante * 4; bet.result = "战胜庄家"; }
      else if (result === 0) { returned += bet.ante * 3; bet.result = "和局"; }
      else bet.result = "庄家获胜";
    }
    seat.chips += returned; seat.lastNet = returned - spent;
  }
  game.phase = "result"; revealFairness(game); log(game, `Casino Hold’em 摊牌：庄家${qualifies ? `以${dealerHand.name}成牌` : "未达到四点对子"}。`);
}
function publicRoom(room, viewerId) {
  const base = { code: room.code, hostId: room.hostId, players: room.players.map(({ token, ...item }) => item), settings: room.settings, game: null };
  if (!room.game) return base;
  const source = room.game, showDealer = source.phase === "result";
  base.game = {
    status: source.status, table: source.table, round: source.round, phase: source.phase, eventSeq: source.eventSeq,
    players: source.players.map((seat) => ({ ...clone(seat), blackjack: seat.blackjack ? { ...clone(seat.blackjack), hands: seat.playerId === viewerId || source.phase === "result" ? clone(seat.blackjack.hands) : seat.blackjack.hands.map((hand) => ({ ...hand, cards: hand.cards.map(() => "back") })) } : null, holdem: seat.holdem ? { ...clone(seat.holdem), cards: seat.playerId === viewerId || source.phase === "result" ? clone(seat.holdem.cards) : seat.holdem.cards.map(() => "back") } : null })),
    dealer: { cards: source.dealer.cards.map((card, index) => showDealer || index === 0 ? card : "back") }, board: clone(source.board), wheel: clone(source.wheel), fairness: clone(source.fairness), log: clone(source.log),
    blackjackRules: { decks: 6, dealer: "S17", blackjack: "3:2", splitHands: 4 },
    rouletteRules: { wheel: "single-zero", rtp: "97.30%" },
    holdemRules: { qualification: "四点对子或更高", call: "2× Ante" }
  };
  return base;
}

module.exports = { defaults, configure, createGame, publicRoom, selectTable, grantChips, rouletteBet, rouletteClear, rouletteSpin, resetRound, blackjackBet, blackjackDeal, blackjackAction, blackjackValue, holdemBet, holdemDeal, holdemDecision, dealerQualifies, rouletteNumbers, anteOdds, aaOdds };
