const ROUNDS = 8;
const STARTING_PRICE = 50;
const STARTING_CASH = 1000;
const STARTING_COINS = 20;
const MAX_SHARES = 20;
const COIN_VALUE = 50;
const MAIN_CARDS = [
  ...Array(4).fill(20),
  ...Array(7).fill(10),
  ...Array(4).fill(0),
  ...Array(7).fill(-10),
  ...Array(4).fill(-20)
];

function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function createGame(players, random = Math.random) {
  const shuffled = shuffle(MAIN_CARDS, random);
  const removed = shuffled.splice(0, 6);
  const game = {
    status: "playing",
    phase: "decision",
    round: 1,
    totalRounds: ROUNDS,
    price: STARTING_PRICE,
    priceHistory: [STARTING_PRICE],
    marketDeck: shuffled,
    removedCount: removed.length,
    revealedMain: [],
    currentEffects: [],
    submissions: {},
    effectOffers: {},
    nextEffects: {},
    finances: {},
    history: [],
    log: ["市场开幕：第一轮交易开始。"],
    eventSeq: 0,
    lastEvent: null,
    ranking: [],
    random
  };
  for (const player of players) {
    game.finances[player.id] = { cash: STARTING_CASH, shares: 0, coins: STARTING_COINS };
  }
  return game;
}

function requirePlaying(room, playerId) {
  const game = room.game;
  if (!game || game.status !== "playing") throw new Error("市场尚未开始或已经收盘");
  if (!game.finances[playerId]) throw new Error("你不在本局游戏中");
  return game;
}

function normaliseDecision(game, playerId, payload) {
  const prediction = String(payload.prediction || "");
  if (!["up", "down", "flat"].includes(prediction)) throw new Error("请选择上涨、下跌或不变");
  const finance = game.finances[playerId];
  const wager = Number(payload.wager);
  const minimumWager = finance.coins > 0 ? 1 : 0;
  if (!Number.isInteger(wager) || wager < minimumWager || wager > 3) throw new Error(finance.coins > 0 ? "每轮需下注 1–3 枚预测金币" : "预测金币耗尽后本轮下注应为 0");
  if (wager > finance.coins) throw new Error("预测金币不足");

  const trade = String(payload.trade || "hold");
  if (!["buy", "sell", "hold"].includes(trade)) throw new Error("交易指令无效");
  const shares = trade === "hold" ? 0 : Number(payload.shares);
  if (!Number.isInteger(shares) || shares < 0) throw new Error("股票数量必须是整数");
  if (trade !== "hold" && shares < 1) throw new Error("请填写要交易的股票数量");
  if (trade === "buy" && finance.shares + shares > MAX_SHARES) throw new Error(`每人最多持有 ${MAX_SHARES} 股`);
  if (trade === "buy" && finance.cash < shares * game.price) throw new Error("股票资金不足");
  if (trade === "sell" && finance.shares < shares) throw new Error("持股数量不足");
  return { prediction, wager, trade, shares };
}

function drawEffectOffer(game) {
  return [game.random() < 0.5 ? "bull" : "bear", game.random() < 0.5 ? "bull" : "bear"];
}

function submitDecision(room, playerId, payload = {}) {
  const game = requirePlaying(room, playerId);
  if (game.submissions[playerId]) throw new Error("本轮决定已经锁定");
  game.submissions[playerId] = normaliseDecision(game, playerId, payload);
  if (game.round < game.totalRounds) {
    game.effectOffers[playerId] = drawEffectOffer(game);
    game.phase = "effect";
  }
  maybeResolve(room);
}

function chooseEffect(room, playerId, effect) {
  const game = requirePlaying(room, playerId);
  if (!game.submissions[playerId]) throw new Error("请先锁定本轮预测与交易");
  if (game.round >= game.totalRounds) throw new Error("最后一轮不再选择效果牌");
  if (game.nextEffects[playerId]) throw new Error("效果牌已经盖下");
  const offer = game.effectOffers[playerId] || [];
  if (!offer.includes(effect)) throw new Error("只能选择本轮抽到的效果牌");
  game.nextEffects[playerId] = effect;
  maybeResolve(room);
}

function allReady(room) {
  const game = room.game;
  return room.players.every((player) => game.submissions[player.id])
    && (game.round === game.totalRounds || room.players.every((player) => game.nextEffects[player.id]));
}

function settlePrediction(finance, decision, direction) {
  if (decision.prediction === direction) {
    const multiplier = direction === "flat" ? 2 : 1;
    const reward = decision.wager * multiplier;
    finance.coins += reward;
    return reward;
  }
  const loss = direction === "flat" && decision.prediction !== "flat" ? 1 : decision.wager;
  finance.coins -= loss;
  return -loss;
}

function finalWealth(finance, price) {
  return finance.cash + finance.shares * price + finance.coins * COIN_VALUE;
}

function maybeResolve(room) {
  if (!allReady(room)) return false;
  const game = room.game;
  const priceBefore = game.price;
  const orders = [];
  for (const player of room.players) {
    const decision = game.submissions[player.id];
    const finance = game.finances[player.id];
    if (decision.trade === "buy") {
      finance.cash -= decision.shares * priceBefore;
      finance.shares += decision.shares;
    } else if (decision.trade === "sell") {
      finance.cash += decision.shares * priceBefore;
      finance.shares -= decision.shares;
    }
    orders.push({ playerId: player.id, trade: decision.trade, shares: decision.shares, holding: finance.shares });
  }

  const main = game.marketDeck.shift();
  const bulls = game.currentEffects.filter((effect) => effect.effect === "bull").length;
  const bears = game.currentEffects.filter((effect) => effect.effect === "bear").length;
  const playerEffect = bulls === bears ? 0 : bulls > bears ? 10 : -10;
  const calculatedChange = main + playerEffect;
  const priceAfter = Math.max(10, priceBefore + calculatedChange);
  const actualChange = priceAfter - priceBefore;
  const direction = actualChange > 0 ? "up" : actualChange < 0 ? "down" : "flat";
  const predictions = room.players.map((player) => {
    const decision = game.submissions[player.id];
    const reward = settlePrediction(game.finances[player.id], decision, direction);
    return { playerId: player.id, prediction: decision.prediction, wager: decision.wager, reward };
  });

  game.price = priceAfter;
  game.priceHistory.push(priceAfter);
  game.revealedMain.push(main);
  const event = {
    id: ++game.eventSeq,
    type: "opening",
    round: game.round,
    priceBefore,
    priceAfter,
    change: actualChange,
    calculatedChange,
    main,
    playerEffect,
    bulls,
    bears,
    effects: game.currentEffects.map((item) => ({ ...item })),
    orders,
    predictions
  };
  game.lastEvent = event;
  game.history.unshift(event);
  const directionName = direction === "up" ? "上涨" : direction === "down" ? "下跌" : "不变";
  game.log.unshift(`第 ${game.round} 轮开盘：主卡 ${main >= 0 ? "+" : ""}${main}，股价 ${priceBefore} → ${priceAfter}（${directionName}）。`);

  if (game.round >= game.totalRounds) {
    game.status = "finished";
    game.phase = "finished";
    game.ranking = room.players.map((player) => ({
      playerId: player.id,
      ...game.finances[player.id],
      finalWealth: finalWealth(game.finances[player.id], priceAfter)
    })).sort((a, b) => b.finalWealth - a.finalWealth || b.coins - a.coins || b.cash - a.cash);
    game.log.unshift("第八轮收盘，最终财富已经公布。");
  } else {
    game.round += 1;
    game.phase = "decision";
    game.currentEffects = Object.entries(game.nextEffects).map(([playerId, effect]) => ({ playerId, effect }));
    game.submissions = {};
    game.effectOffers = {};
    game.nextEffects = {};
  }
  return true;
}

function publicRoom(room, viewerId = null) {
  const game = room.game;
  if (!game) {
    return {
      code: room.code,
      hostId: room.hostId,
      players: room.players.map(({ token: _token, ...player }) => player),
      game: null
    };
  }
  const finished = game.status === "finished";
  const players = room.players.map(({ token: _token, ...player }) => {
    const finance = game.finances[player.id];
    const mine = player.id === viewerId;
    const ranking = finished ? game.ranking.findIndex((item) => item.playerId === player.id) + 1 : null;
    return {
      ...player,
      shares: finance.shares,
      ready: Boolean(game.submissions[player.id]),
      effectReady: Boolean(game.nextEffects[player.id]),
      ...(mine || finished ? { cash: finance.cash, predictionCoins: finance.coins } : {}),
      ...(finished ? { finalWealth: finalWealth(finance, game.price), rank: ranking } : {})
    };
  });
  const mySubmission = game.submissions[viewerId] || null;
  const myOffer = game.effectOffers[viewerId] || null;
  const myEffect = game.nextEffects[viewerId] || null;
  return {
    code: room.code,
    hostId: room.hostId,
    players,
    game: {
      status: game.status,
      phase: game.phase,
      round: game.round,
      totalRounds: game.totalRounds,
      price: game.price,
      priceHistory: game.priceHistory,
      removedCount: game.removedCount,
      revealedMain: game.revealedMain,
      history: game.history,
      log: game.log,
      lastEvent: game.lastEvent,
      ranking: game.ranking,
      mySubmission,
      myOffer,
      myEffect,
      waitingFor: room.players.filter((player) => !game.submissions[player.id] || (game.round < game.totalRounds && !game.nextEffects[player.id])).map((player) => player.id)
    }
  };
}

module.exports = {
  ROUNDS, STARTING_PRICE, STARTING_CASH, STARTING_COINS, MAX_SHARES, COIN_VALUE, MAIN_CARDS,
  createGame, submitDecision, chooseEffect, publicRoom, finalWealth
};
