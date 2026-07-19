const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../src/games/las-vegas-royale/rules");

const players = [
  { id: "a", name: "安娜", connected: true },
  { id: "b", name: "本", connected: true },
  { id: "c", name: "卡拉", connected: true }
];

test("豪华版按官方结构生成三轮、八颗骰子和赌场奖金", () => {
  const game = rules.createGame(players);
  assert.equal(game.roundMoney.length, 3);
  assert.equal(game.casinos.length, 6);
  assert.equal(game.casinos.filter((casino) => casino.tile).length, 3);
  assert.equal(game.playerState.a.supply.length, 8);
  assert.equal(game.playerState.a.supply.filter((die) => die.big).length, 1);
  assert.equal(game.playerState.a.chips, 2);
  assert.ok(game.casinos.every((casino) => casino.money.length === 2));
});

test("Biggy计作两票，相同票数玩家一起淘汰", () => {
  const casino = {
    dice: [
      { playerId: "a", big: true },
      { playerId: "b", big: false }, { playerId: "b", big: false },
      { playerId: "c", big: false }
    ],
    blankDice: 0
  };
  assert.deepEqual(rules.untiedRanking(casino), [["c", 1]]);
});

test("未结束时只向本人公开资产，终局后向所有人公开", () => {
  const room = { code: "ABC234", hostId: "a", players, game: rules.createGame(players) };
  room.game.playerState.a.cash = 80;
  room.game.playerState.b.cash = 40;
  let publicState = rules.publicRoom(room, "a");
  assert.equal(publicState.players[0].cash, 80);
  assert.equal(publicState.players[1].cash, null);
  room.game.status = "finished";
  publicState = rules.publicRoom(room, "a");
  assert.equal(publicState.players[1].cash, 40);
});

test("两人局每轮加入八颗中立骰", () => {
  const game = rules.createGame(players.slice(0, 2));
  const neutral = game.casinos.flatMap((casino) => casino.dice).filter((die) => die.playerId === "__neutral");
  assert.equal(neutral.length, 8);
  assert.equal(neutral.filter((die) => die.big).length, 1);
});

test("秘密猜拳与黑箱奖励不会通过公开状态泄底", () => {
  const room = { code: "ABC234", hostId: "a", players, game: rules.createGame(players) };
  room.game.pending = { type: "luckyGuess", actorId: "b", ownerId: "a", secretCount: 3 };
  assert.equal(rules.publicRoom(room, "b").game.pending.secretCount, undefined);
  room.game.pending = { type: "blackChoose", actorId: "a", piles: [[0, 5], [1, 2, 3, 4]] };
  const publicPiles = rules.publicRoom(room, "a").game.pending.piles;
  assert.deepEqual(publicPiles, [[null, null], [null, null, null, null]]);
});
