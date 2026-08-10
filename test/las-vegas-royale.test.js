const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../src/games/las-vegas-royale/rules");
const { definition } = require("../src/games/las-vegas-royale");

const players = [
  { id: "a", name: "安娜", connected: true },
  { id: "b", name: "本", connected: true },
  { id: "c", name: "卡拉", connected: true },
  { id: "d", name: "戴维", connected: true }
];

test("纯真人版限定2至6人并生成三轮、七颗骰子和赌场奖金", () => {
  const game = rules.createGame(players);
  assert.equal(definition.minPlayers, 2);
  assert.equal(definition.maxPlayers, 6);
  assert.equal(definition.minimumToStart, 2);
  assert.equal(game.roundMoney.length, 3);
  assert.equal(game.casinos.length, 6);
  assert.equal(game.casinos.filter((casino) => casino.tile).length, 3);
  assert.equal(game.playerState.a.supply.length, 7);
  assert.equal(game.playerState.a.supply.filter((die) => die.big).length, 1);
  assert.equal(game.playerState.a.chips, 2);
  assert.ok(game.casinos.every((casino) => casino.money.length === 2));
  const totals = game.casinos.map((casino) => casino.money.reduce((sum, value) => sum + value, 0));
  assert.deepEqual(totals, [...totals].sort((a, b) => a - b));
  assert.ok(game.animationEvents.some((event) => event.type === "round-start"));
  assert.equal(game.animationEvents.filter((event) => event.type === "chips").length, players.length);
});

test("随机模块不会同时抽到同一实体板的正反面", () => {
  for (let run = 0; run < 100; run += 1) {
    const selected = rules.chooseTiles(6);
    assert.equal(new Set(selected.map((tile) => tile.id[0])).size, selected.length);
  }
});

test("房主可以选择无模块基础局或官方三模块豪华局", () => {
  const room = { hostId: "a", settings: rules.defaults(), game: null };
  rules.configure(room, "a", { mode: "base", tileCount: 6 });
  assert.deepEqual(room.settings, { mode: "base", tileCount: 0 });
  assert.equal(rules.createGame(players, room.settings).casinos.filter((casino) => casino.tile).length, 0);
  rules.configure(room, "a", { mode: "royale", tileCount: 3 });
  assert.equal(rules.createGame(players, room.settings).casinos.filter((casino) => casino.tile).length, 3);
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

test("双人至六人局均不生成电脑或中立骰", () => {
  const game = rules.createGame(players.slice(0, 2));
  const neutral = game.casinos.flatMap((casino) => casino.dice).filter((die) => die.playerId.startsWith("__neutral"));
  assert.equal(neutral.length, 0);
  assert.equal(rules.COLORS.length, 6);
});

test("Biggy可选择不发动踢骰能力", () => {
  const room = { code: "ABC234", hostId: "a", players, game: rules.createGame(players, { mode: "base", tileCount: 0 }) };
  const target = room.game.playerState.b.supply.shift();
  room.game.casinos[1].dice.push({ ...target, playerId: "b", face: 2 });
  const biggy = room.game.playerState.a.supply.find((item) => item.big);
  room.game.currentRoll = [{ ...biggy, face: 2 }];
  rules.place(room, "a", 2);
  assert.equal(room.game.pending.type, "biggyKick");
  rules.resolvePending(room, "a", { skip: true });
  assert.equal(room.game.pending, null);
  assert.equal(room.game.casinos[1].dice.some((item) => item.id === target.id), true);
});

test("Biggy可把所选对手普通骰踢回骰池但不能选择大骰", () => {
  const room = { code: "ABC234", hostId: "a", players, game: rules.createGame(players, { mode: "base", tileCount: 0 }) };
  const small = room.game.playerState.b.supply.shift();
  const otherBiggy = room.game.playerState.c.supply.find((item) => item.big);
  room.game.playerState.c.supply = room.game.playerState.c.supply.filter((item) => item.id !== otherBiggy.id);
  room.game.casinos[2].dice.push({ ...small, playerId: "b", face: 3 }, { ...otherBiggy, playerId: "c", face: 3 });
  const biggy = room.game.playerState.a.supply.find((item) => item.big);
  room.game.currentRoll = [{ ...biggy, face: 3 }];
  rules.place(room, "a", 3);
  assert.deepEqual(room.game.pending.targets, [{ id: small.id, playerId: "b" }]);
  assert.throws(() => rules.resolvePending(room, "a", { dieId: otherBiggy.id }), /请选择一颗/);
  const before = room.game.playerState.b.supply.length;
  rules.resolvePending(room, "a", { dieId: small.id });
  assert.equal(room.game.playerState.b.supply.length, before + 1);
  assert.equal(room.game.casinos[2].dice.some((item) => item.id === small.id), false);
  assert.equal(room.game.animationEvents.at(-1).type, "dice-kick");
});

test("秘密猜拳与黑箱奖励不会通过公开状态泄底", () => {
  const room = { code: "ABC234", hostId: "a", players, game: rules.createGame(players) };
  room.game.pending = { type: "luckyGuess", actorId: "b", ownerId: "a", secretCount: 3 };
  assert.equal(rules.publicRoom(room, "b").game.pending.secretCount, undefined);
  room.game.pending = { type: "blackChoose", actorId: "a", piles: [[0, 5], [1, 2, 3, 4]] };
  const publicPiles = rules.publicRoom(room, "a").game.pending.piles;
  assert.deepEqual(publicPiles, [[null, null], [null, null, null, null]]);
});

test("所有主掷骰结果先写入统一动画事件队列", () => {
  const room = { code: "ABC234", hostId: "a", players, game: rules.createGame(players, { mode: "base", tileCount: 0 }) };
  const before = room.game.animationEvents.length;
  rules.roll(room, "a");
  const event = room.game.animationEvents.at(-1);
  assert.equal(room.game.animationEvents.length, before + 1);
  assert.equal(event.type, "dice-roll");
  assert.deepEqual(event.dice.map((item) => item.face), room.game.currentRoll.map((item) => item.face));
  assert.ok(event.dice.every((item) => item.face >= 1 && item.face <= 6));
});

test("公开房间状态携带有序动画事件供所有玩家同步播放", () => {
  const room = { code: "ABC234", hostId: "a", players, game: rules.createGame(players) };
  rules.roll(room, "a");
  const events = rules.publicRoom(room, "b").game.animationEvents;
  assert.ok(events.length > 0);
  assert.deepEqual(events.map((event) => event.id), [...events.map((event) => event.id)].sort((a, b) => a - b));
});
