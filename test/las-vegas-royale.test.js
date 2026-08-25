const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rules = require("../src/games/las-vegas-royale/rules");
const { definition } = require("../src/games/las-vegas-royale");

const players = [
  { id: "a", name: "安娜", connected: true },
  { id: "b", name: "本", connected: true },
  { id: "c", name: "卡拉", connected: true },
  { id: "d", name: "戴维", connected: true }
];

test("纯真人版限定2至6人并生成三轮、八颗骰子和赌场奖金", () => {
  const game = rules.createGame(players);
  assert.equal(definition.minPlayers, 2);
  assert.equal(definition.maxPlayers, 6);
  assert.equal(definition.minimumToStart, 2);
  assert.equal(game.roundMoney.length, 3);
  assert.equal(game.casinos.length, 6);
  assert.equal(game.casinos.filter((casino) => casino.tile).length, 3);
  assert.equal(game.playerState.a.supply.length, 8);
  assert.equal(game.playerState.a.supply.filter((die) => die.big).length, 1);
  assert.equal(game.playerState.a.chips, 2);
  assert.ok(game.casinos.every((casino) => casino.money.length === 2));
  const totals = game.casinos.map((casino) => casino.money.reduce((sum, value) => sum + value, 0));
  assert.deepEqual(totals, [...totals].sort((a, b) => a - b));
  assert.ok(game.animationEvents.some((event) => event.type === "round-start"));
  assert.equal(game.animationEvents.filter((event) => event.type === "chips").length, 0);
  assert.deepEqual(game.animationEvents.find((event) => event.type === "round-start").playerIds, players.map((player) => player.id));
});

test("随机模块不会同时抽到同一实体板的正反面", () => {
  for (let run = 0; run < 100; run += 1) {
    const selected = rules.chooseTiles(6);
    assert.equal(new Set(selected.map((tile) => tile.id[0])).size, selected.length);
  }
});

test("全部豪华板块都随公开状态提供可查看的完整玩法说明", () => {
  assert.equal(rules.TILES.length, 16);
  assert.ok(rules.TILES.every((tile) => typeof tile.rule === "string" && tile.rule.length >= 35));
  assert.ok(rules.TILES.every((tile) => ["trigger", "action", "result", "example"].every((key) => tile.guide?.[key]?.length >= 12)));
  const room = { code: "ABC234", hostId: "a", players, game: rules.createGame(players, { mode: "royale", tileCount: 6 }) };
  assert.ok(rules.publicRoom(room, "a").game.casinos.filter((casino) => casino.tile).every((casino) => casino.tile.rule && casino.tile.guide?.example));
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

test("豪华板块先解释触发原因再播放特殊掷骰与判定", () => {
  const room = { code: "ABC234", hostId: "a", players, game: rules.createGame(players, { mode: "base", tileCount: 0 }) };
  room.game.casinos[0].tile = { ...rules.TILES.find((tile) => tile.id === "A2"), state: { jackpot: 30 } };
  const item = room.game.playerState.a.supply[0];
  room.game.currentRoll = [{ ...item, face: 1 }];
  const before = room.game.animationEvents.length;
  const originalRandom = Math.random;
  Math.random = () => 0; // 两颗黑骰固定为1、1，确保命中对子并产生派彩事件。
  try { rules.place(room, "a", 1); } finally { Math.random = originalRandom; }
  const types = room.game.animationEvents.slice(before).map((event) => event.type);
  assert.deepEqual(types.slice(0, 5), ["dice-place", "tile-activate", "dice-roll", "judgement", "money"]);
  const rollEvent = room.game.animationEvents.slice(before).find((event) => event.type === "dice-roll");
  assert.match(rollEvent.explanation, /对子/);
  assert.match(rollEvent.outcome, /=/);
});

test("公开房间状态携带有序动画事件供所有玩家同步播放", () => {
  const room = { code: "ABC234", hostId: "a", players, game: rules.createGame(players) };
  rules.roll(room, "a");
  const events = rules.publicRoom(room, "b").game.animationEvents;
  assert.ok(events.length > 0);
  assert.deepEqual(events.map((event) => event.id), [...events.map((event) => event.id)].sort((a, b) => a - b));
});

test("客户端使用环形赌场、清晰骰点、主动玩家确认与板块规则按钮", () => {
  const client = fs.readFileSync(require.resolve("../public/games/las-vegas-royale.js"), "utf8");
  const css = fs.readFileSync(require.resolve("../public/games/las-vegas-royale.css"), "utf8");
  assert.match(client, /casino-sector-content/);
  assert.match(client, /我已看清 · 开始选择赌场/);
  assert.match(client, /event\.reason === "行动掷骰" && event\.playerId !== getMyId\(\)/);
  assert.match(client, /showTileRules/);
  assert.match(client, /tile-demo-stage/);
  assert.match(client, /Math\.max\(8000, Math\.min\(13000/);
  assert.match(client, /pauseTileDemo/);
  assert.doesNotMatch(client, /setInterval\(\(\) => paintStep\(step \+ 1\), 2200\)/);
  assert.match(client, /face-choice/);
  assert.match(client, /tile-activate/);
  assert.match(client, /waitForEventContinue/);
  assert.match(client, /5200/);
  assert.match(client, /casino-banknote/);
  assert.match(client, /die-face face-/);
  assert.match(client, /visualViewport\?\.width/);
  assert.match(client, /visualViewport\?\.height/);
  assert.match(client, /Math\.min\(1, widthScale, heightScale\)/);
  assert.match(client, /fitBoardToViewport/);
  assert.match(css, /--sector:polygon/);
  assert.match(css, /scale\(var\(--board-fit,1\)\)/);
  assert.match(css, /casino-2 \.casino-sector-content,.casino-3 \.casino-sector-content\{right:112px;width:195px\}/);
  assert.match(css, /casino-5 \.casino-sector-content,.casino-6 \.casino-sector-content\{left:112px;width:195px\}/);
  assert.match(css, /DICE ARENA/);
  assert.match(css, /die-cube\.show-6 \.face-6/);
});

function roomWithBaseGame() {
  return { code: "ABC234", hostId: "a", players, game: rules.createGame(players, { mode: "base", tileCount: 0 }) };
}

function mountTile(game, face, id) {
  const tile = { ...rules.TILES.find((item) => item.id === id), state: {} };
  if (id === "A2") tile.state.jackpot = 30;
  if (id === "C1") tile.state.available = true;
  if (id === "E1") tile.state.step = 0;
  if (id === "F1") tile.state.clusters = [1, 1, 2, 2, 3];
  if (id === "F2") {
    game.casinos.forEach((casino, index) => { casino.blankDice = index < 3 ? 1 : 2; });
    tile.state.slots = ["chip", "chip", "30", "30", "30", "choice", "choice", "choice", "choice"];
  }
  game.casinos[face - 1].tile = tile;
  return tile;
}

function placeOne(room, playerId, face) {
  room.game.turnIndex = room.game.turnOrder.indexOf(playerId);
  const state = room.game.playerState[playerId];
  const item = state.supply.find((die) => !die.big) || state.supply[0];
  room.game.currentRoll = [{ ...item, face }];
  rules.place(room, playerId, face);
}

test("1至6号赌场上的豪华板块都会触发，变体不会让后三区模块失效", () => {
  for (const face of [1, 2, 3, 4, 5, 6]) {
    const room = roomWithBaseGame();
    mountTile(room.game, face, "A1");
    placeOne(room, "a", face);
    assert.equal(room.game.pending?.type, "luckyChoose", `${face}号赌场应触发板块`);
  }
});

test("所有即时型豪华板块都有可完成的触发状态或明确判定", () => {
  const expected = {
    A1: "luckyChoose", B2: "fifty", E1: "noEntry", F1: "block", F2: "handicap",
    G2: "doubleDown", H1: "niceDice", H2: "myChoice"
  };
  for (const [id, pendingType] of Object.entries(expected)) {
    const room = roomWithBaseGame();
    mountTile(room.game, 1, id);
    placeOne(room, "a", 1);
    assert.equal(room.game.pending?.type, pendingType, `${id}应进入${pendingType}`);
  }
  for (const id of ["A2", "C1", "D1", "D2"]) {
    const room = roomWithBaseGame();
    const tile = mountTile(room.game, 1, id);
    if (id === "C1") {
      room.game.casinos[0].dice.push(...room.game.playerState.a.supply.splice(0, 4).map((die) => ({ ...die, playerId: "a", face: 1 })));
    }
    const beforeEvents = room.game.animationEvents.length;
    placeOne(room, "a", 1);
    assert.equal(room.game.pending, null, `${id}不应遗留待处理选择`);
    assert.ok(room.game.animationEvents.length > beforeEvents, `${id}应产生可见反馈`);
    if (id === "C1") assert.equal(tile.state.ownerId, "a");
    if (id === "D2") assert.equal(room.game.powerToken, "a");
  }
});

test("淘汰出局让每名对手亲自选择普通骰或Biggy，而不是系统擅自替玩家决定", () => {
  const room = roomWithBaseGame();
  mountTile(room.game, 1, "E2");
  placeOne(room, "a", 1);
  assert.equal(room.game.pending.type, "knockoutGive");
  assert.equal(room.game.pending.actorId, "b");
  assert.ok(room.game.pending.options.some((item) => item.big));
  const bBiggy = room.game.pending.options.find((item) => item.big);
  rules.resolvePending(room, "b", { dieId: bBiggy.id });
  assert.equal(room.game.bar.b[0].big, true);
  assert.equal(room.game.pending.actorId, "c");
  for (const id of ["c", "d"]) rules.resolvePending(room, id, { dieId: room.game.pending.options.find((item) => !item.big).id });
  assert.equal(room.game.pending, null);
  assert.equal(Object.values(room.game.bar).flat().length, 3);
  assert.match(room.game.animationEvents.at(-1).explanation, /交出Biggy/);
});

test("猜高猜低按0、10、20、30、40、60K逐级推进且相同点数判失败", () => {
  const room = roomWithBaseGame();
  mountTile(room.game, 1, "B2");
  room.game.pending = { type: "fifty", actorId: "a", casino: 1, last: 2, step: 1, reward: 0 };
  const originalRandom = Math.random;
  Math.random = () => .999;
  try { rules.resolvePending(room, "a", { choice: "higher" }); } finally { Math.random = originalRandom; }
  assert.equal(room.game.pending.reward, 10);
  assert.equal(room.game.pending.step, 2);

  room.game.pending = { type: "fifty", actorId: "a", casino: 1, last: 12, step: 2, reward: 10 };
  Math.random = () => .999;
  try { rules.resolvePending(room, "a", { choice: "higher" }); } finally { Math.random = originalRandom; }
  assert.equal(room.game.pending, null);
  assert.match(room.game.log[0], /失败/);
});

test("禁止入场可以保留原封锁，但不会错误推进奖励轨", () => {
  const room = roomWithBaseGame();
  const tile = mountTile(room.game, 1, "E1");
  room.game.closedCasino = 4;
  room.game.pending = { type: "noEntry", actorId: "a", casino: 1 };
  rules.resolvePending(room, "a", { casino: 4 });
  assert.equal(room.game.closedCasino, 4);
  assert.equal(tile.state.step, 0);
  assert.match(room.game.animationEvents.at(-1).formula, /奖励轨不前进/);
});

test("任我选在效果无法执行时不会锁死，并会把金色格原骰退回", () => {
  const room = roomWithBaseGame();
  const tile = mountTile(room.game, 1, "H2");
  room.game.pending = { type: "myChoice", actorId: "a", casino: 1, options: [4] };
  rules.resolvePending(room, "a", { option: 4, casino: 0 });
  assert.equal(room.game.pending, null);
  assert.match(room.game.animationEvents.at(-1).formula, /无法执行/);

  const oldDie = room.game.playerState.b.supply.shift();
  tile.state.goldenOwner = "b"; tile.state.goldenDie = oldDie;
  const beforeB = room.game.playerState.b.supply.length;
  const beforeA = room.game.playerState.a.supply.length;
  room.game.pending = { type: "myChoice", actorId: "a", casino: 1, options: [6] };
  rules.resolvePending(room, "a", { option: 6 });
  assert.equal(room.game.playerState.b.supply.length, beforeB + 1);
  assert.equal(room.game.playerState.a.supply.length, beforeA - 1);
  assert.equal(tile.state.goldenOwner, "a");
});

test("操纵骰子和黄金时刻额外骰都会保留正确点数供界面显示", () => {
  const room = roomWithBaseGame();
  rules.__test.manipulateOwnDie(room.game, "a", { mode: "force", face: 6 });
  assert.equal(room.game.casinos[5].dice.at(-1).face, 6);

  room.game.round = 3;
  room.game.settlement = { casinoIndex: 0, awards: [], badLuckPrepared: true, badLuckApplied: true, badLuckPenalties: [], nextStarter: null, phase: "payout" };
  room.game.pending = { type: "primeTime", actorId: "a", casino: 1, roll: [4, 5] };
  rules.resolvePending(room, "a", { indices: [0, 1] });
  assert.equal(room.game.casinos[3].dice.at(-1).face, 4);
  assert.equal(room.game.casinos[4].dice.at(-1).face, 5);
});

test("霉运临头在全部赌场派彩之后罚款，不会让后来到账的奖金逃过处罚", () => {
  const room = roomWithBaseGame();
  room.game.round = 3;
  mountTile(room.game, 1, "C2");
  room.game.casinos.forEach((casino) => { casino.dice = []; casino.money = [30, 30]; });
  const bDie = room.game.playerState.b.supply.shift();
  room.game.casinos[0].dice.push({ ...bDie, playerId: "b", face: 1 });
  room.game.casinos[1].money = [80, 30];
  Object.values(room.game.playerState).forEach((state) => { state.supply = []; state.cash = 0; state.chips = 0; });
  room.game.playerState.a.supply = [{ id: "a-final", big: false }];
  room.game.turnIndex = 0;
  room.game.currentRoll = [{ id: "a-final", big: false, face: 2 }];
  rules.place(room, "a", 2);
  assert.equal(room.game.status, "finished");
  assert.equal(room.game.playerState.a.cash, 30, "先获得80K，再支付50K");
});

test("结算型板块B1、G1都在正确玩家处暂停等待选择", () => {
  const prime = roomWithBaseGame();
  prime.game.round = 3;
  mountTile(prime.game, 1, "B1");
  prime.game.casinos[0].dice.push({ id: "a-prime", playerId: "a", face: 1, big: false });
  rules.__test.beginSettlement(prime);
  assert.equal(prime.game.pending?.type, "primeTime");
  assert.equal(prime.game.pending?.actorId, "a");

  const black = roomWithBaseGame();
  black.game.round = 3;
  mountTile(black.game, 1, "G1");
  black.game.casinos[0].dice.push({ id: "a1", playerId: "a", face: 1, big: false }, { id: "a2", playerId: "a", face: 1, big: false }, { id: "b1", playerId: "b", face: 1, big: false });
  rules.__test.beginSettlement(black);
  assert.equal(black.game.pending?.type, "blackDivide");
  assert.equal(black.game.pending?.actorId, "b", "赢家左手边玩家负责分组");
  rules.resolvePending(black, "b", { indices: [0, 2, 4] });
  assert.equal(black.game.pending?.type, "blackChoose");
  assert.equal(black.game.pending?.actorId, "a");
});

test("基础赌场结算按赌场整体展示排名、平票淘汰与两张奖金，不再碎成瞬时数字", () => {
  const room = roomWithBaseGame();
  room.game.round = 3;
  room.game.casinos.forEach((casino) => { casino.dice = []; casino.money = [60, 40]; });
  room.game.casinos[0].dice.push(
    { id: "a1", playerId: "a", face: 1, big: false },
    { id: "a2", playerId: "a", face: 1, big: false },
    { id: "b1", playerId: "b", face: 1, big: false },
    { id: "b2", playerId: "b", face: 1, big: false },
    { id: "c1", playerId: "c", face: 1, big: false }
  );
  const before = room.game.animationEvents.length;
  rules.__test.beginSettlement(room);
  const events = room.game.animationEvents.slice(before);
  const first = events.find((event) => event.type === "casino-payout" && event.casino === 1);
  assert.ok(first);
  assert.deepEqual(first.standings.filter((row) => row.tied).map((row) => row.playerId).sort(), ["a", "b"]);
  assert.equal(first.payouts[0].playerId, "c");
  assert.equal(first.payouts[1].returnedToBank, true);
  assert.equal(events.some((event) => event.type === "money" && /号赌场派彩/.test(event.reason)), false);
});

test("客户端把灰骰、副桌、等待区和模块持续状态显示在桌面", () => {
  const client = fs.readFileSync(require.resolve("../public/games/las-vegas-royale.js"), "utf8");
  assert.match(client, /blank-die-cube/);
  assert.match(client, /double-down-table/);
  assert.match(client, /淘汰等待区/);
  assert.match(client, /tileStateMarkup/);
  assert.match(client, /myChoiceDetails/);
  assert.match(client, /handicapManipulation/);
  assert.match(client, /casino-payout/);
  assert.match(client, /旁观画面将在2秒后自动继续/);
});

test("只向每位玩家公开自己的剩余骰，并允许明确识别Biggy", () => {
  const room = roomWithBaseGame();
  const aView = rules.publicRoom(room, "a");
  const bView = rules.publicRoom(room, "b");
  assert.equal(aView.game.mySupply.length, 8);
  assert.equal(aView.game.mySupply.filter((die) => die.big).length, 1);
  assert.ok(aView.game.mySupply.every((die) => die.id.startsWith("a-")));
  assert.ok(bView.game.mySupply.every((die) => die.id.startsWith("b-")));
});

test("强势控场由玩家明确选择普通骰或Biggy，不会擅自消耗第一颗骰", () => {
  const room = roomWithBaseGame();
  mountTile(room.game, 1, "D2");
  room.game.powerToken = "a";
  room.game.casinos[0].tile.state.ownerId = "a";
  const biggy = room.game.playerState.a.supply.find((die) => die.big);
  rules.usePowerPlay(room, "a", { face: 6, dieId: biggy.id });
  assert.equal(room.game.casinos[5].dice.some((die) => die.id === biggy.id && die.big && die.face === 6), true);
  assert.equal(room.game.playerState.a.supply.some((die) => die.id === biggy.id), false);
});

test("双倍下注可以精确移动Biggy，主桌与副桌不会混淆", () => {
  const room = roomWithBaseGame();
  mountTile(room.game, 1, "G2");
  const state = room.game.playerState.a;
  const biggy = state.supply.find((die) => die.big);
  const small = state.supply.find((die) => !die.big);
  room.game.currentRoll = [{ ...biggy, face: 1 }, { ...small, face: 1 }];
  rules.place(room, "a", 1);
  rules.resolvePending(room, "a", { dieIds: [biggy.id] });
  assert.equal(room.game.doubleDown[1].length, 1);
  assert.equal(room.game.doubleDown[1][0].big, true);
  assert.equal(room.game.casinos[0].dice.some((die) => die.id === small.id), true);
});

test("妙骰由玩家选择具体骰子，Biggy进入奖励格后身份不会丢失", () => {
  const room = roomWithBaseGame();
  mountTile(room.game, 1, "H1");
  const state = room.game.playerState.a;
  const biggy = state.supply.find((die) => die.big);
  const small = state.supply.find((die) => !die.big);
  room.game.currentRoll = [{ ...biggy, face: 1 }, { ...small, face: 1 }];
  rules.place(room, "a", 1);
  rules.resolvePending(room, "a", { dieId: biggy.id });
  assert.equal(room.game.niceDice[0].id, biggy.id);
  assert.equal(room.game.niceDice[0].big, true);
  assert.equal(room.game.casinos[0].dice.some((die) => die.id === small.id), true);
});

test("让分局操纵选择无效时不消耗灰骰或奖励格", () => {
  const room = roomWithBaseGame();
  const tile = mountTile(room.game, 1, "F2");
  room.game.pending = { type: "handicap", actorId: "a", casino: 1, slots: tile.state.slots };
  const beforeGray = room.game.casinos[1].blankDice;
  const beforeSlots = tile.state.slots.length;
  assert.throws(() => rules.resolvePending(room, "a", { source: 2, slot: 5, mode: "force", face: 3, dieId: "not-mine" }), /请选择一颗自己的剩余骰/);
  assert.equal(room.game.casinos[1].blankDice, beforeGray);
  assert.equal(tile.state.slots.length, beforeSlots);
});

test("任我选金格先验证所选骰子，再替换原占有者", () => {
  const room = roomWithBaseGame();
  const tile = mountTile(room.game, 1, "H2");
  const oldDie = room.game.playerState.b.supply.shift();
  tile.state.goldenOwner = "b";
  tile.state.goldenDie = oldDie;
  room.game.pending = { type: "myChoice", actorId: "a", casino: 1, options: [6] };
  const beforeB = room.game.playerState.b.supply.length;
  assert.throws(() => rules.resolvePending(room, "a", { option: 6, dieId: "not-mine" }), /请选择一颗自己的剩余骰/);
  assert.equal(room.game.playerState.b.supply.length, beforeB);
  assert.equal(tile.state.goldenOwner, "b");
});

test("封锁赌场中的骰子不能被让分局或任我选收回", () => {
  const room = roomWithBaseGame();
  const die = room.game.playerState.a.supply.shift();
  room.game.casinos[2].dice.push({ ...die, playerId: "a", face: 3 });
  room.game.closedCasino = 3;
  assert.throws(() => rules.__test.manipulateOwnDie(room.game, "a", { mode: "return", dieId: die.id }), /请选择一颗已放置/);
  assert.equal(room.game.casinos[2].dice.some((item) => item.id === die.id), true);
});

function resolveLikeHuman(room, tick) {
  const pending = room.game.pending;
  if (!pending) return;
  const actor = pending.actorId;
  if (pending.type === "biggyKick") return rules.resolvePending(room, actor, tick % 2 ? { skip: true } : { dieId: pending.targets[0].id });
  if (pending.type === "luckyChoose") return rules.resolvePending(room, actor, { count: (tick % 3) + 1 });
  if (pending.type === "luckyGuess") return rules.resolvePending(room, actor, { count: ((tick + 1) % 3) + 1 });
  if (pending.type === "fifty") return rules.resolvePending(room, actor, { choice: "cashout" });
  if (pending.type === "noEntry") return rules.resolvePending(room, actor, { casino: room.game.casinos.find((casino) => casino.number !== pending.casino)?.number });
  if (pending.type === "block") return rules.resolvePending(room, actor, { cluster: pending.clusters[0], casino: room.game.casinos.find((casino) => casino.number !== room.game.closedCasino)?.number });
  if (pending.type === "knockoutGive") return rules.resolvePending(room, actor, { dieId: pending.options[tick % pending.options.length].id });
  if (pending.type === "handicap") return rules.resolvePending(room, actor, { skip: true });
  if (pending.type === "doubleDown") return rules.resolvePending(room, actor, { dieIds: pending.dieOptions.filter((_die, index) => index % 2 === tick % 2).map((die) => die.id) });
  if (pending.type === "niceDice") return rules.resolvePending(room, actor, { dieId: tick % 2 ? "" : pending.dieOptions[0]?.id || "" });
  if (pending.type === "myChoice") {
    const option = pending.options[tick % pending.options.length];
    const payload = { option };
    if (option === 4) payload.casino = room.game.casinos.find((casino) => casino.tile && casino.number !== pending.casino && casino.number !== room.game.closedCasino)?.number || 0;
    if (option === 5) {
      const supply = room.game.playerState[actor].supply;
      const placed = room.game.casinos.find((casino) => casino.number !== room.game.closedCasino && casino.dice.some((die) => die.playerId === actor));
      if (supply.length) Object.assign(payload, { mode: "force", face: room.game.casinos.find((casino) => casino.number !== room.game.closedCasino).number, dieId: supply[0].id });
      else if (placed) Object.assign(payload, { mode: "return", dieId: placed.dice.find((die) => die.playerId === actor).id });
    }
    if (option === 6) payload.dieId = room.game.playerState[actor].supply[0]?.id || "";
    return rules.resolvePending(room, actor, payload);
  }
  if (pending.type === "primeTime") return rules.resolvePending(room, actor, { indices: pending.roll.map((_face, index) => index) });
  if (pending.type === "blackDivide") return rules.resolvePending(room, actor, { indices: [0, 2, 4] });
  if (pending.type === "blackChoose") return rules.resolvePending(room, actor, { pile: tick % 2 });
  throw new Error(`未覆盖待处理类型：${pending.type}`);
}

function mountModuleSet(game, ids) {
  game.casinos.forEach((casino) => { casino.tile = null; casino.blankDice = 0; });
  ids.forEach((id, index) => mountTile(game, index + 1, id));
}

test("资深玩家自动巡检：2至6人、多组豪华板块均可完整玩完三轮且不会软锁", () => {
  const moduleSets = [
    ["A1", "B1", "C1", "D1", "E1", "F1"],
    ["A2", "B2", "C2", "D2", "E2", "F2"],
    ["G1", "H1", "A1", "B2", "C1", "D2"],
    ["G2", "H2", "A2", "B1", "C2", "E1"]
  ];
  for (let playerCount = 2; playerCount <= 6; playerCount += 1) {
    for (const ids of moduleSets) {
      const activePlayers = players.concat([
        { id: "e", name: "伊森", connected: true }, { id: "f", name: "菲欧娜", connected: true }
      ]).slice(0, playerCount);
      const room = { code: "SIM888", hostId: "a", players: activePlayers, game: rules.createGame(activePlayers, { mode: "base", tileCount: 0 }) };
      mountModuleSet(room.game, ids);
      let mountedRound = room.game.round;
      let tick = 0;
      while (room.game.status === "playing" && tick < 1000) {
        if (room.game.round !== mountedRound) { mountedRound = room.game.round; mountModuleSet(room.game, ids); }
        if (room.game.pending) resolveLikeHuman(room, tick);
        else {
          const actor = room.game.turnOrder[room.game.turnIndex];
          const state = room.game.playerState[actor];
          if (room.game.powerToken === actor && state.supply.length && tick % 3 === 0) {
            const face = room.game.casinos.find((casino) => casino.number !== room.game.closedCasino).number;
            rules.usePowerPlay(room, actor, { face, dieId: state.supply.at(-1).id });
          } else if (!room.game.currentRoll) rules.roll(room, actor);
          else {
            const legal = room.game.currentRoll.find((die) => die.face !== room.game.closedCasino);
            if (legal) rules.place(room, actor, legal.face);
            else rules.pass(room, actor);
          }
        }
        tick += 1;
      }
      assert.equal(room.game.status, "finished", `${playerCount}人局 ${ids.join("/")} 在${tick}步内应完成`);
      assert.ok(room.game.finalRanking.every((entry) => Number.isFinite(entry.total) && entry.total >= 0));
    }
  }
});
