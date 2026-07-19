const test = require("node:test");
const assert = require("node:assert/strict");
const { createGame, getRanking, moveCamel, moveCamelInDirection, chooseCrazyCamel, rollDie, takeLegBet, placeTile, enterPartnership, settleLeg, predict, publicRoom } = require("../src/game");

function room() {
  const players = [{ id: "a", name: "甲" }, { id: "b", name: "乙" }];
  return { players, game: createGame(players, () => 0), hostId: "a" };
}

function largeRoom(count = 6) {
  const players = Array.from({ length: count }, (_, index) => ({ id: String.fromCharCode(97 + index), name: `玩家${index + 1}` }));
  return { players, game: createGame(players, () => 0), hostId: "a" };
}

test("下方骆驼移动时带走上方骆驼", () => {
  const game = createGame([], () => 0);
  game.stacks = { 2: ["red", "blue", "green"] };
  game.camels.red.space = game.camels.blue.space = game.camels.green.space = 2;
  moveCamel(game, "blue", 3);
  assert.deepEqual(game.stacks[2], ["red"]);
  assert.deepEqual(game.stacks[5], ["blue", "green"]);
});

test("同格时上方骆驼排名更高", () => {
  const game = createGame([], () => 0);
  game.stacks = { 3: ["red", "blue"], 2: ["green"], 1: ["yellow", "purple"] };
  Object.assign(game.camels.red, { space: 3 }); Object.assign(game.camels.blue, { space: 3 });
  Object.assign(game.camels.green, { space: 2 }); Object.assign(game.camels.yellow, { space: 1 }); Object.assign(game.camels.purple, { space: 1 });
  assert.deepEqual(getRanking(game), ["blue", "red", "green", "purple", "yellow"]);
});

test("行动严格按回合并发放掷骰奖励", () => {
  const r = room(); const before = r.players[0].coins;
  rollDie(r, "a", () => 0);
  assert.equal(r.players[0].coins, before + 1); assert.equal(r.game.turn, 1);
  assert.equal(r.game.lastEvent.type, "roll");
  assert.equal(r.game.lastEvent.amount, 1);
  assert.ok(r.game.lastEvent.moving.length >= 1);
  assert.throws(() => rollDie(r, "a", () => 0), /还没轮到你/);
});

test("赛段投注会消耗最高价值牌", () => {
  const r = room(); takeLegBet(r, "a", "red");
  assert.equal(r.game.legBets[0].value, 5); assert.deepEqual(r.game.bets.red, [3, 3, 2, 1]);
});

test("赛道板块不能相邻", () => {
  const r = room(); r.game.stacks = {};
  placeTile(r, "a", 8, "oasis");
  assert.throws(() => placeTile(r, "b", 9, "mirage"), /不能相邻/);
});

test("结盟行动只在六人以上开放并消耗回合", () => {
  const fivePlayerRoom = largeRoom(5);
  assert.throws(() => enterPartnership(fivePlayerRoom, "a", "b"), /仅在 6 人或以上/);
  const r = largeRoom();
  enterPartnership(r, "a", "b");
  assert.deepEqual(r.game.partnerships, [{ players: ["a", "b"] }]);
  assert.equal(r.game.turn, 1);
  assert.throws(() => enterPartnership(r, "b", "c"), /已经结盟/);
});

test("赛段结算时双方复制伙伴最佳正收益并自动解盟", () => {
  const r = largeRoom();
  r.players.find((player) => player.id === "a").coins = 4;
  r.game.partnerships = [{ players: ["a", "b"] }];
  r.game.legBets = [
    { playerId: "a", color: "green", value: 5 },
    { playerId: "b", color: "red", value: 5 },
    { playerId: "b", color: "blue", value: 3 }
  ];
  r.game.pyramidTickets = [{ playerId: "a" }];
  r.game.stacks = { 8: ["red"], 7: ["blue"], 6: ["green"], 5: ["yellow"], 4: ["purple"], 14: ["black"], 15: ["white"] };
  Object.entries(r.game.stacks).forEach(([space, stack]) => stack.forEach((color) => { r.game.camels[color].space = Number(space); }));
  settleLeg(r);
  assert.equal(r.players.find((player) => player.id === "a").coins, 8);
  assert.equal(r.players.find((player) => player.id === "b").coins, 10);
  assert.deepEqual(r.game.partnerships, []);
  assert.deepEqual(r.game.pyramidTickets, []);
});

test("公开房间状态不会泄露重连令牌", () => {
  const r = room(); r.players[0].token = "secret";
  assert.equal(publicRoom(r).players[0].token, undefined);
  assert.equal(publicRoom(r).players[0].coins, undefined);
});

test("比赛中只向玩家本人公开金币", () => {
  const r = room();
  const viewForA = publicRoom(r, "a");
  assert.equal(viewForA.players.find((player) => player.id === "a").coins, 3);
  assert.equal(viewForA.players.find((player) => player.id === "b").coins, undefined);
});

test("同一玩家的每张颜色终局卡只能使用一次", () => {
  const r = room();
  predict(r, "a", "red", "winner");
  assert.throws(() => predict(r, "a", "red", "loser"), /颜色卡已经用于/);
  assert.doesNotThrow(() => predict(r, "a", "blue", "loser"));
});

test("终局预测只向本人公开颜色", () => {
  const r = room();
  predict(r, "a", "red", "winner");
  assert.equal(publicRoom(r, "a").game.predictions[0].color, "red");
  assert.equal(publicRoom(r, "b").game.predictions[0].color, undefined);
  assert.equal(publicRoom(r, "b").game.predictions[0].secret, true);
});

test("正确终局预测按先后获得 8 和 5，错误预测扣 1", () => {
  const r = room();
  r.players.push({ id: "c", name: "丙", coins: 3 });
  predict(r, "a", "red", "winner");
  predict(r, "b", "blue", "winner");
  predict(r, "c", "red", "winner");
  r.game.stacks = { 16: ["red"], 8: ["blue"], 7: ["green"], 6: ["yellow"], 5: ["purple"], 14: ["black"], 15: ["white"] };
  Object.entries(r.game.stacks).forEach(([space, stack]) => stack.forEach((color) => { r.game.camels[color].space = Number(space); }));
  r.game.dice = ["red"];
  r.game.rollsRemaining = 2;
  rollDie(r, "a", () => 0);
  assert.equal(r.players.find((player) => player.id === "a").coins, 12);
  assert.equal(r.players.find((player) => player.id === "b").coins, 2);
  assert.equal(r.players.find((player) => player.id === "c").coins, 8);
  assert.equal(publicRoom(r).players.find((player) => player.id === "a").coins, 12);
});

test("疯狂骆驼逆向移动并驮走上方比赛骆驼", () => {
  const game = createGame([], () => 0);
  game.stacks = { 12: ["white", "red"] };
  game.camels.white.space = game.camels.red.space = 12;
  moveCamelInDirection(game, "white", 2, -1);
  assert.deepEqual(game.stacks[10], ["white", "red"]);
  assert.equal(game.camels.red.space, 10);
});

test("只有一匹疯狂骆驼背着比赛骆驼时必须移动它", () => {
  const game = createGame([], () => 0);
  game.stacks = { 12: ["white", "green"], 14: ["black"] };
  game.camels.white.space = game.camels.green.space = 12;
  game.camels.black.space = 14;
  assert.equal(chooseCrazyCamel(game, "black"), "white");
});

test("黑白疯狂骆驼直接叠放时移动上面一匹", () => {
  const game = createGame([], () => 0);
  game.stacks = { 14: ["black", "white"] };
  game.camels.black.space = game.camels.white.space = 14;
  assert.equal(chooseCrazyCamel(game, "black"), "white");
});

test("第五次掷骰事件包含赛段冠军供所有客户端高亮", () => {
  const r = room();
  r.players = [r.players[0]];
  r.game.dice = ["red"];
  r.game.rollsRemaining = 1;
  r.game.stacks = { 8: ["blue"], 7: ["green"], 6: ["yellow"], 5: ["purple"], 4: ["red"], 14: ["black"], 15: ["white"] };
  Object.entries(r.game.stacks).forEach(([space, stack]) => stack.forEach((color) => { r.game.camels[color].space = Number(space); }));
  rollDie(r, "a", () => 0);
  assert.deepEqual(r.game.lastEvent.legEnd, { leg: 1, first: "blue", second: "green", wealth: { highest: 4, lowest: 4 } });
  assert.equal(r.game.leg, 2);
});
