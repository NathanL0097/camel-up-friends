const test = require("node:test");
const assert = require("node:assert/strict");
const { createGame, getRanking, moveCamel, rollDie, takeLegBet, placeTile, publicRoom } = require("../src/game");

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
  assert.throws(() => rollDie(r, "a", () => 0), /还没轮到你/);
});

test("赛段投注会消耗最高价值牌", () => {
  const r = room(); takeLegBet(r, "a", "red");
  assert.equal(r.game.legBets[0].value, 5); assert.deepEqual(r.game.bets.red, [3, 2]);
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
