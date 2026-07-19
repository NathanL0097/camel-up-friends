const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../src/games/market-opening/rules");

function room(random = () => 0.25) {
  const players = [
    { id: "p1", name: "甲", connected: true },
    { id: "p2", name: "乙", connected: true }
  ];
  return { code: "STOCK1", hostId: "p1", players, game: rules.createGame(players, random) };
}

function submitBoth(testRoom, first = {}, second = {}) {
  rules.submitDecision(testRoom, "p1", { prediction: "up", wager: 2, trade: "buy", shares: 5, ...first });
  rules.submitDecision(testRoom, "p2", { prediction: "down", wager: 3, trade: "hold", shares: 0, ...second });
  rules.chooseEffect(testRoom, "p1", testRoom.game.effectOffers.p1[0]);
  rules.chooseEffect(testRoom, "p2", testRoom.game.effectOffers.p2[0]);
}

test("开局秘密移除六张主牌且只公开玩家自己的资金", () => {
  const testRoom = room();
  assert.equal(testRoom.game.marketDeck.length, 20);
  assert.equal(testRoom.game.removedCount, 6);
  assert.equal(testRoom.game.price, 50);
  const state = rules.publicRoom(testRoom, "p1");
  assert.equal(state.players[0].cash, 1000);
  assert.equal(state.players[0].predictionCoins, 20);
  assert.equal(state.players[1].cash, undefined);
  assert.equal(state.players[1].shares, 0);
});

test("股票好友房在比赛开始前可以安全公开大厅状态", () => {
  const lobby = { code: "STOCK1", hostId: "p1", players: [{ id: "p1", token: "secret", name: "甲", connected: true }], game: null };
  const state = rules.publicRoom(lobby, "p1");
  assert.equal(state.game, null);
  assert.equal(state.players[0].token, undefined);
});

test("预测与交易保持秘密，所有人选完下轮效果后统一开盘", () => {
  const testRoom = room();
  rules.submitDecision(testRoom, "p1", { prediction: "up", wager: 2, trade: "buy", shares: 5 });
  const opponentView = rules.publicRoom(testRoom, "p2");
  assert.equal(opponentView.game.mySubmission, null);
  assert.equal(opponentView.players[0].ready, true);
  assert.equal(opponentView.players[0].shares, 0);
  rules.submitDecision(testRoom, "p2", { prediction: "down", wager: 3, trade: "hold", shares: 0 });
  rules.chooseEffect(testRoom, "p1", testRoom.game.effectOffers.p1[0]);
  assert.equal(testRoom.game.history.length, 0);
  rules.chooseEffect(testRoom, "p2", testRoom.game.effectOffers.p2[0]);
  assert.equal(testRoom.game.history.length, 1);
  assert.equal(testRoom.game.finances.p1.shares, 5);
  assert.equal(testRoom.game.finances.p1.cash, 750);
  assert.equal(testRoom.game.history[0].orders[0].holding, 5);
  assert.equal(testRoom.game.round, 2);
});

test("实际横盘时涨跌预测只扣一枚，不变预测净赚双倍", () => {
  const testRoom = room();
  testRoom.game.marketDeck[0] = 0;
  submitBoth(testRoom, { prediction: "up", wager: 3, trade: "hold", shares: 0 }, { prediction: "flat", wager: 3 });
  assert.equal(testRoom.game.lastEvent.change, 0);
  assert.equal(testRoom.game.finances.p1.coins, 19);
  assert.equal(testRoom.game.finances.p2.coins, 26);
});

test("最终财富以最后股价结算持股并按五十兑换预测金币", () => {
  const finance = { cash: 300, shares: 15, coins: 24 };
  assert.equal(rules.finalWealth(finance, 70), 2550);
});

test("不能透支、做空或持有超过二十股", () => {
  const testRoom = room();
  assert.throws(() => rules.submitDecision(testRoom, "p1", { prediction: "up", wager: 1, trade: "buy", shares: 21 }), /最多持有/);
  assert.throws(() => rules.submitDecision(testRoom, "p1", { prediction: "up", wager: 1, trade: "sell", shares: 1 }), /持股数量不足/);
});

test("八轮结束后公布完整排名和最终财富", () => {
  const testRoom = room();
  for (let round = 1; round <= 8; round += 1) {
    rules.submitDecision(testRoom, "p1", { prediction: "up", wager: 1, trade: "hold", shares: 0 });
    rules.submitDecision(testRoom, "p2", { prediction: "down", wager: 1, trade: "hold", shares: 0 });
    if (round < 8) {
      rules.chooseEffect(testRoom, "p1", testRoom.game.effectOffers.p1[0]);
      rules.chooseEffect(testRoom, "p2", testRoom.game.effectOffers.p2[0]);
    }
  }
  assert.equal(testRoom.game.status, "finished");
  assert.equal(testRoom.game.history.length, 8);
  assert.equal(testRoom.game.ranking.length, 2);
  const state = rules.publicRoom(testRoom, "p1");
  assert.equal(typeof state.players[1].cash, "number");
  assert.equal(typeof state.players[1].finalWealth, "number");
});
