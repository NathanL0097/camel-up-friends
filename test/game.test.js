const test = require("node:test");
const assert = require("node:assert/strict");
const { createGame, getRanking, moveCamel, moveCamelInDirection, chooseCrazyCamel, rollDie, takeLegBet, placeTile, predict, publicRoom } = require("../src/game");

function room() {
  const players = [{ id: "a", name: "甲" }, { id: "b", name: "乙" }];
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

test("公开房间状态不会泄露重连令牌", () => {
  const r = room(); r.players[0].token = "secret";
  assert.equal(publicRoom(r).players[0].token, undefined);
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
  assert.deepEqual(r.game.lastEvent.legEnd, { leg: 1, first: "blue", second: "green" });
  assert.equal(r.game.leg, 2);
});
