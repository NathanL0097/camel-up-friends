const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../src/games/market-opening/rules");

function room(random = () => 0.25) {
  const players = [{ id: "p1", name: "甲", connected: true }, { id: "p2", name: "乙", connected: true }];
  return { code: "STOCK1", hostId: "p1", players, game: rules.createGame(players, random) };
}

function draft(testRoom, first = "card-master", second = "cleaner") {
  testRoom.game.draftOrder = [{ playerId: "p1", roll: 6, seat: 0 }, { playerId: "p2", roll: 3, seat: 1 }];
  rules.chooseCharacter(testRoom, "p1", first);
  rules.chooseCharacter(testRoom, "p2", second);
  testRoom.game.roundEvents.forEach((event) => { event.impact = 0; });
}

function submitRound(testRoom, first = {}, second = {}) {
  rules.submitDecision(testRoom, "p1", { prediction: "up", wager: 2, trade: "buy", shares: 5, ...first });
  rules.submitDecision(testRoom, "p2", { prediction: "down", wager: 3, trade: "hold", shares: 0, ...second });
  if (testRoom.game.round < 8) {
    rules.chooseEffect(testRoom, "p1", testRoom.game.effectOffers.p1[0].key);
    rules.chooseEffect(testRoom, "p2", testRoom.game.effectOffers.p2[0].key);
  }
}

test("开局掷骰决定顺序并依次选择不重复角色", () => {
  const testRoom = room();
  assert.equal(testRoom.game.phase, "character-draft");
  assert.equal(testRoom.game.availableCharacters.length, 10);
  testRoom.game.draftOrder = [{ playerId: "p1", roll: 6 }, { playerId: "p2", roll: 2 }];
  assert.throws(() => rules.chooseCharacter(testRoom, "p2", "cleaner"), /还没轮到/);
  rules.chooseCharacter(testRoom, "p1", "card-master");
  assert.throws(() => rules.chooseCharacter(testRoom, "p2", "card-master"), /已经被选择/);
  rules.chooseCharacter(testRoom, "p2", "cleaner");
  assert.equal(testRoom.game.phase, "decision");
  assert.equal(testRoom.game.characters.p1.secretCard.title.length > 0, true);
});

test("操盘手和富二代的开局被动价值保持接近", () => {
  const testRoom = room();
  draft(testRoom, "operator", "heir");
  assert.equal(testRoom.game.finances.p1.shares, 3);
  assert.equal(testRoom.game.finances.p2.cash, 1100);
  assert.equal(testRoom.game.finances.p2.coins, 21);
});

test("开局秘密移除六张主牌且只公开玩家自己的资金与角色秘密", () => {
  const testRoom = room();
  draft(testRoom);
  assert.equal(testRoom.game.marketDeck.length, 20);
  const state = rules.publicRoom(testRoom, "p1");
  assert.equal(state.players[0].cash, 1000);
  assert.equal(state.players[1].cash, undefined);
  assert.equal(typeof state.players[0].secretRoleCard.title, "string");
  assert.equal(state.players[1].secretRoleCard, undefined);
  assert.equal(typeof state.game.openingEvent.title, "string");
});

test("股票好友房在比赛开始前可以安全公开大厅状态", () => {
  const lobby = { code: "STOCK1", hostId: "p1", players: [{ id: "p1", token: "secret", name: "甲", connected: true }], game: null };
  const state = rules.publicRoom(lobby, "p1");
  assert.equal(state.game, null);
  assert.equal(state.players[0].token, undefined);
});

test("玩家可以不预测或最多投入五枚金币", () => {
  const testRoom = room();
  draft(testRoom);
  rules.submitDecision(testRoom, "p1", { prediction: "none", wager: 0, trade: "hold", shares: 0 });
  assert.equal(testRoom.game.submissions.p1.wager, 0);
  assert.throws(() => rules.submitDecision(testRoom, "p2", { prediction: "up", wager: 6, trade: "hold", shares: 0 }), /1–5/);
});

test("预测与交易保持秘密，所有人选完效果后统一开盘", () => {
  const testRoom = room();
  draft(testRoom);
  testRoom.game.openingEvent.impact = 0;
  rules.submitDecision(testRoom, "p1", { prediction: "up", wager: 2, trade: "buy", shares: 5 });
  const opponentView = rules.publicRoom(testRoom, "p2");
  assert.equal(opponentView.game.mySubmission, null);
  assert.equal(opponentView.players[0].shares, 0);
  rules.submitDecision(testRoom, "p2", { prediction: "down", wager: 3, trade: "hold", shares: 0 });
  rules.chooseEffect(testRoom, "p1", testRoom.game.effectOffers.p1[0].key);
  assert.equal(testRoom.game.history.length, 0);
  rules.chooseEffect(testRoom, "p2", testRoom.game.effectOffers.p2[0].key);
  assert.equal(testRoom.game.history.length, 1);
  assert.equal(testRoom.game.finances.p1.shares, 5);
  assert.equal(testRoom.game.finances.p1.cash, 750);
});

test("每位玩家只能看到自己上一轮盖下且尚未揭示的效果牌", () => {
  const testRoom = room();
  draft(testRoom);
  testRoom.game.round = 2;
  testRoom.game.currentEffects = [
    { playerId: "p1", card: { key: "mine", title: "我的牌", icon: "📦", impact: 10, tone: "bull" } },
    { playerId: "p2", card: { key: "other", title: "对手的牌", icon: "🚪", impact: -10, tone: "bear" } }
  ];
  assert.equal(rules.publicRoom(testRoom, "p1").game.myPendingEffect.title, "我的牌");
  assert.equal(rules.publicRoom(testRoom, "p2").game.myPendingEffect.title, "对手的牌");
});

test("上市事件只在第一轮加入最终涨跌计算", () => {
  const testRoom = room();
  draft(testRoom);
  testRoom.game.openingEvent = { title: "首日红利", impact: 10 };
  testRoom.game.marketDeck[0] = 0;
  submitRound(testRoom, { prediction: "up", trade: "hold", shares: 0 });
  assert.equal(testRoom.game.lastEvent.openingImpact, 10);
  assert.equal(testRoom.game.lastEvent.change, 10);
});

test("实际横盘时涨跌预测只扣一枚，不变预测净赚双倍", () => {
  const testRoom = room();
  draft(testRoom);
  testRoom.game.openingEvent.impact = 0;
  testRoom.game.marketDeck[0] = 0;
  submitRound(testRoom, { prediction: "up", wager: 5, trade: "hold", shares: 0 }, { prediction: "flat", wager: 5 });
  assert.equal(testRoom.game.lastEvent.change, 0);
  assert.equal(testRoom.game.finances.p1.coins, 19);
  assert.equal(testRoom.game.finances.p2.coins, 30);
});

test("停牌会取消交易并让所有已下注预测亏损，不预测不受影响", () => {
  const testRoom = room();
  draft(testRoom);
  testRoom.game.round = 2;
  testRoom.game.currentEffects = [{ playerId: "p2", card: rules.EFFECT_CARDS.find((card) => card.halt) }];
  submitRound(testRoom, { prediction: "up", wager: 5, trade: "buy", shares: 5 }, { prediction: "none", wager: 0 });
  assert.equal(testRoom.game.lastEvent.halted, true);
  assert.equal(testRoom.game.finances.p1.shares, 0);
  assert.equal(testRoom.game.finances.p1.cash, 1000);
  assert.equal(testRoom.game.finances.p1.coins, 15);
  assert.equal(testRoom.game.finances.p2.coins, 20);
});

test("清道夫可以让指定玩家本轮盖牌失效", () => {
  const testRoom = room();
  draft(testRoom, "cleaner", "operator");
  testRoom.game.round = 2;
  testRoom.game.currentEffects = [{ playerId: "p2", card: { key: "bad", title: "坏消息", impact: -20, tone: "bear" } }];
  rules.useSkill(testRoom, "p1", { targetId: "p2" });
  submitRound(testRoom, { prediction: "up", trade: "hold", shares: 0 });
  assert.equal(testRoom.game.lastEvent.effects[0].cancelled, true);
  assert.equal(testRoom.game.lastEvent.playerEffect, 0);
});

test("预言家提前私下查看本轮趣味事件且不会额外罚金币", () => {
  const testRoom = room();
  draft(testRoom, "prophet", "operator");
  testRoom.game.roundEvents[0] = { title: "CEO直播说漏嘴", icon: "🎥", impact: -10 };
  rules.useSkill(testRoom, "p1");
  const mine = rules.publicRoom(testRoom, "p1");
  const opponent = rules.publicRoom(testRoom, "p2");
  assert.equal(mine.players[0].skillInfo, "🎥 CEO直播说漏嘴（-10）");
  assert.equal(opponent.players[0].skillInfo, undefined);
  assert.equal(testRoom.game.finances.p1.coins, 20);
});

test("风控师最多减少两枚错误预测损失", () => {
  const testRoom = room();
  draft(testRoom, "risk-manager", "operator");
  testRoom.game.openingEvent.impact = 0;
  testRoom.game.marketDeck[0] = -20;
  rules.useSkill(testRoom, "p1");
  submitRound(testRoom, { prediction: "up", wager: 5, trade: "hold", shares: 0 });
  assert.equal(testRoom.game.finances.p1.coins, 17);
});

test("波动侦探只看到幅度类别而看不到方向", () => {
  const testRoom = room();
  draft(testRoom, "volatility-scout", "operator");
  testRoom.game.marketDeck[0] = -20;
  rules.useSkill(testRoom, "p1");
  const state = rules.publicRoom(testRoom, "p1");
  assert.equal(state.players[0].skillInfo, "强波动（±20）");
});

test("谈判专家让本轮前五股每股获得十资金优势", () => {
  const testRoom = room();
  draft(testRoom, "negotiator", "operator");
  rules.useSkill(testRoom, "p1");
  submitRound(testRoom, { prediction: "none", wager: 0, trade: "buy", shares: 5 });
  assert.equal(testRoom.game.finances.p1.cash, 800);
  assert.equal(testRoom.game.finances.p1.shares, 5);
});

test("每轮趣味事件随主牌一起影响价格并被公开", () => {
  const testRoom = room();
  draft(testRoom);
  testRoom.game.openingEvent.impact = 0;
  testRoom.game.marketDeck[0] = 10;
  testRoom.game.roundEvents[0] = { key: "award", title: "年度产品大奖", icon: "🏆", impact: 10, description: "获奖" };
  submitRound(testRoom, { prediction: "up", trade: "hold", shares: 0 });
  assert.equal(testRoom.game.lastEvent.change, 20);
  assert.equal(testRoom.game.lastEvent.roundEvent.title, "年度产品大奖");
});

test("最终财富按最后股价结算并加入长线投资家每股八资金收益", () => {
  const finance = { cash: 300, shares: 15, coins: 24 };
  assert.equal(rules.finalWealth(finance, 70), 2550);
  assert.equal(rules.finalWealth(finance, 70, 120), 2670);
});

test("持股不设上限但仍不能透支或做空", () => {
  const testRoom = room();
  draft(testRoom);
  testRoom.game.finances.p1.cash = 2000;
  rules.submitDecision(testRoom, "p1", { prediction: "none", wager: 0, trade: "buy", shares: 21 });
  assert.equal(testRoom.game.submissions.p1.shares, 21);
  assert.throws(() => rules.submitDecision(testRoom, "p2", { prediction: "none", wager: 0, trade: "sell", shares: 1 }), /持股数量不足/);
  rules.submitDecision(testRoom, "p2", { prediction: "none", wager: 0, trade: "hold", shares: 0 });
  rules.chooseEffect(testRoom, "p1", testRoom.game.effectOffers.p1[0].key);
  rules.chooseEffect(testRoom, "p2", testRoom.game.effectOffers.p2[0].key);
  assert.equal(testRoom.game.finances.p1.shares, 21);
});

test("八轮结束后公布完整排名和角色终局加成", () => {
  const testRoom = room();
  draft(testRoom, "long-investor", "operator");
  testRoom.game.finances.p1.shares = 15;
  testRoom.game.openingEvent.impact = 0;
  for (let round = 1; round <= 8; round += 1) submitRound(testRoom, { prediction: "none", wager: 0, trade: "hold", shares: 0 }, { prediction: "none", wager: 0 });
  assert.equal(testRoom.game.status, "finished");
  assert.equal(testRoom.game.history.length, 8);
  const state = rules.publicRoom(testRoom, "p1");
  assert.equal(state.players[0].characterBonus, 120);
  assert.equal(typeof state.players[1].cash, "number");
  assert.equal(typeof state.players[1].finalWealth, "number");
});
