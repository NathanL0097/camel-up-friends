const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const rules = require("../src/games/witch-town/rules");

const makePlayers = (count) => Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, name: `玩家${index + 1}`, connected: true }));
const makeRoom = (count = 6, random = () => 0.3719) => {
  const players = makePlayers(count);
  return { code: "WITCH1", hostId: players[0].id, players, settings: {}, game: rules.createGame(players, {}, random) };
};

function startDay(room) {
  const game = room.game;
  const publicSeats = rules.publicRoom(room, game.actorId).game.seats;
  const targetView = publicSeats.find((seat) => seat.playerId !== game.actorId && !seat.blackCatImmune);
  const target = game.seats.find((seat) => seat.playerId === targetView.playerId);
  rules.chooseBlackCat(room, game.actorId, { targetId: target.playerId });
  return target;
}

test("4至12人标准审判牌数量、女巫数量和每人份数正确", () => {
  for (let count = 4; count <= 12; count += 1) {
    const room = makeRoom(count);
    const trials = room.game.seats.flatMap((seat) => seat.tryals);
    const expectedWitches = count <= 6 ? 1 : 2;
    assert.equal(trials.filter((trial) => trial.kind === "witch").length, expectedWitches, `${count}人女巫牌数`);
    assert.equal(trials.filter((trial) => trial.kind === "constable").length, 1);
    assert.ok(room.game.seats.every((seat) => seat.tryals.length === trials.length / count));
  }
});

test("基础牌堆为58张加独立黑猫，数量与卡种正确", () => {
  const deck = rules.makeDeck();
  assert.equal(deck.length, 58);
  assert.equal(deck.filter((card) => card.kind === "accusation").length, 35);
  assert.equal(deck.filter((card) => card.kind === "evidence").length, 5);
  assert.equal(deck.filter((card) => card.kind === "witness").length, 1);
  assert.equal(deck.filter((card) => card.kind === "night").length, 1);
  assert.equal(deck.filter((card) => card.kind === "conspiracy").length, 1);
  const room = makeRoom(6);
  assert.equal(room.game.deck.filter((card) => card.kind === "night").length, 0, "夜幕不应混入白天牌堆");
  assert.equal(room.game.deck.filter((card) => card.kind === "conspiracy").length, 1, "每个白天恰好一张阴谋");
});

test("黎明只能由女巫主持且黑猫主人获得白天先手", () => {
  const room = makeRoom();
  const leader = room.game.seats.find((seat) => seat.playerId === room.game.actorId);
  assert.equal(leader.everWitch, true);
  const target = startDay(room);
  assert.equal(room.game.phase, "day");
  assert.equal(room.game.actorId, target.playerId);
  assert.equal(target.blackCat, true);
});

test("私人手牌与隐藏审判牌不会泄漏给其他玩家", () => {
  const room = makeRoom();
  const [viewer, other] = room.game.seats;
  const view = rules.publicRoom(room, viewer.playerId).game;
  const otherView = view.seats.find((seat) => seat.playerId === other.playerId);
  assert.equal(otherView.hand, undefined);
  assert.equal(otherView.tryals, undefined);
  assert.equal(otherView.handCount, other.hand.length);
  assert.equal(otherView.hiddenTryalCount, other.tryals.length);
  assert.deepEqual(view.you.hand, viewer.hand);
  assert.deepEqual(view.you.tryals, viewer.tryals);
  assert.ok(view.you.tryals.every((trial) => ["innocent", "witch", "constable"].includes(trial.kind)), "本人始终能看到每张身份牌内容");
  assert.deepEqual(view.finalReveals, []);
});

test("黎明主持人与夜间提交进度不会向无关玩家泄露身份", () => {
  const room = makeRoom();
  const game = room.game;
  const town = game.seats.find((seat) => !seat.everWitch);
  const witch = game.seats.find((seat) => seat.everWitch);
  assert.equal(rules.publicRoom(room, town.playerId).game.actorId, null);
  assert.equal(rules.publicRoom(room, witch.playerId).game.actorId, game.actorId);

  startDay(room);
  game.discard.push(...rules.makeDeck().filter((card) => !["night", "conspiracy"].includes(card.kind)).slice(0, 12));
  game.deck = [];
  rules.drawCards(room, game.actorId);
  const target = game.seats.find((seat) => seat.alive && !seat.everWitch);
  rules.chooseNightTarget(room, witch.playerId, { targetId: target.playerId });
  const townView = rules.publicRoom(room, town.playerId).game;
  assert.ok(townView.seats.every((seat) => seat.submitted === false));
  assert.equal(townView.night.witchSubmitted, false);
  assert.equal(townView.night.protectSubmitted, false);
});

test("终局才公开所有身份、角色与审判牌", () => {
  const room = makeRoom();
  const viewerId = room.game.seats[0].playerId;
  assert.deepEqual(rules.publicRoom(room, viewerId).game.finalReveals, []);
  room.game.status = "finished";
  room.game.phase = "result";
  const reveals = rules.publicRoom(room, viewerId).game.finalReveals;
  assert.equal(reveals.length, room.game.seats.length);
  assert.ok(reveals.every((seat) => seat.character?.name && seat.tryals.length > 0));
});

test("玩家回合只能抽牌或出牌二选一，抽2张后自动换人", () => {
  const room = makeRoom();
  startDay(room);
  const actor = room.game.actorId;
  const before = rules.publicRoom(room, actor).game.you.hand.length;
  rules.drawCards(room, actor);
  assert.notEqual(room.game.actorId, actor);
  assert.equal(rules.publicRoom(room, actor).game.you.hand.length, before + 2);
  assert.throws(() => rules.endTurn(room, actor), /还没轮到你/);
});

test("服务器不会把女巫镇抽牌误当成你画我猜画笔轨迹", () => {
  const serverSource = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "server.js"), "utf8");
  assert.match(serverSource, /data\.action === "draw" && activeRoom\?\.gameId === "draw-and-guess"/);
});

test("7点指控会暂停并由最后指控者选择审判牌", () => {
  const room = makeRoom();
  startDay(room);
  const game = room.game;
  const actor = rules.publicRoom(room, game.actorId).game.you;
  const target = game.seats.find((seat) => seat.alive && seat.playerId !== actor.playerId && seat.character.id !== "george");
  const witness = { id: "test-witness", kind: "witness", label: "目击证人", color: "red", icon: "⚖", text: "测试", accusation: 7 };
  game.seats.find((seat) => seat.playerId === actor.playerId).hand.push(witness);
  rules.playCard(room, actor.playerId, { cardId: witness.id, targetId: target.playerId });
  assert.equal(game.phase, "trial");
  assert.equal(game.pendingTrial.targetId, target.playerId);
  const view = rules.publicRoom(room, actor.playerId).game;
  assert.equal(view.trialOptions.length, target.tryals.length);
  const innocent = target.tryals.find((trial) => trial.kind === "innocent") || target.tryals[0];
  rules.revealTrial(room, actor.playerId, { trialId: innocent.id });
  assert.equal(target.front.filter((card) => card.kind === "witness").length, 0);
  assert.equal(innocent.revealed, true);
});

test("阴谋会让每人从左邻取一张隐藏审判牌且新女巫永久转阵营", () => {
  const room = makeRoom();
  startDay(room);
  const game = room.game;
  const actor = game.actorId;
  const cat = game.seats.find((seat) => seat.blackCat);
  game.deck.unshift({ id: "conspiracy-test", kind: "conspiracy", label: "阴谋", color: "black", icon: "🕸", text: "测试" });
  rules.drawCards(room, actor);
  assert.equal(game.phase, "conspiracy-cat");
  rules.revealTrial(room, actor, { trialId: cat.tryals.find((trial) => !trial.revealed).id });
  assert.equal(game.phase, "conspiracy-pass");
  const beforeOwners = new Map(game.seats.flatMap((seat) => seat.tryals.map((trial) => [trial.id, seat.playerId])));
  for (const viewer of [...game.seats]) {
    if (!viewer.alive) continue;
    const privateView = rules.publicRoom(room, viewer.playerId).game.you;
    assert.ok(privateView.tryals.every((trial) => trial.kind), "交换前本人身份均有明确牌面");
    assert.ok(privateView.leftNeighbor.trials.every((trial) => trial.kind === undefined), "左邻身份仍为盲选");
    rules.conspiracyPick(room, viewer.playerId, { trialId: privateView.leftNeighbor.trials[0].id });
  }
  assert.equal(game.phase, "conspiracy-result");
  const moved = game.seats.flatMap((seat) => seat.tryals.map((trial) => ({ id: trial.id, owner: seat.playerId }))).filter((item) => beforeOwners.get(item.id) !== item.owner);
  assert.equal(moved.length, game.seats.filter((seat) => seat.alive).length);
  for (const viewer of game.seats) {
    const privateView = rules.publicRoom(room, viewer.playerId).game.you;
    assert.ok(privateView.tryals.every((trial) => trial.kind), "交换后本人可以重新核对全部身份");
  }
  for (const seat of game.seats) rules.ackEvent(room, seat.playerId);
  assert.equal(game.phase, "day");
});

test("夜晚等待女巫、警长与所有忏悔决定后才结算", () => {
  const room = makeRoom();
  startDay(room);
  const game = room.game;
  const actor = game.actorId;
  game.discard.push(...rules.makeDeck().filter((card) => !["night", "conspiracy"].includes(card.kind)).slice(0, 16));
  game.deck = [];
  rules.drawCards(room, actor);
  assert.equal(game.phase, "night-choice");
  const target = game.seats.find((seat) => seat.alive && !seat.everWitch);
  for (const witch of game.seats.filter((seat) => seat.alive && seat.everWitch)) rules.chooseNightTarget(room, witch.playerId, { targetId: target.playerId });
  const constable = game.seats.find((seat) => seat.alive && seat.tryals.some((trial) => trial.kind === "constable" && !trial.revealed));
  const protectedPlayer = game.seats.find((seat) => seat.alive && seat.playerId !== constable.playerId && seat.playerId !== target.playerId) || target;
  rules.chooseNightProtection(room, constable.playerId, { targetId: protectedPlayer.playerId });
  assert.equal(game.phase, "night-confession");
  for (const player of [...game.seats]) if (player.alive) rules.nightPass(room, player.playerId);
  assert.equal(game.phase, "night-result");
  assert.equal(target.alive, false);
  assert.equal(game.deck.filter((card) => card.kind === "night").length, 0);
  assert.equal(game.deck.filter((card) => card.kind === "conspiracy").length, 1, "新一天重新放入且只放入一张阴谋");
  for (const player of game.seats.filter((seat) => seat.alive)) rules.ackEvent(room, player.playerId);
  assert.equal(game.phase, "day");
});

test("牌堆未摸空不会进入夜晚，摸空后才进入夜晚", () => {
  const room = makeRoom();
  startDay(room);
  assert.equal(room.game.deck.some((card) => card.kind === "night"), false);
  rules.drawCards(room, room.game.actorId);
  assert.equal(room.game.phase, "day");
  const actor = room.game.actorId;
  room.game.discard.push(...rules.makeDeck().filter((card) => !["night", "conspiracy"].includes(card.kind)).slice(0, 10));
  room.game.deck = [];
  rules.drawCards(room, actor);
  assert.equal(room.game.phase, "night-choice");
});

test("女巫阵营始终看到全部已传染队友，镇民看不到", () => {
  const room = makeRoom(6);
  const game = room.game;
  const original = game.seats.find((seat) => seat.everWitch);
  const infected = game.seats.find((seat) => !seat.everWitch);
  infected.everWitch = true;
  const witchView = rules.publicRoom(room, original.playerId).game.you;
  assert.deepEqual(new Set(witchView.witchTeam.map((item) => item.playerId)), new Set([original.playerId, infected.playerId]));
  const town = game.seats.find((seat) => !seat.everWitch);
  assert.deepEqual(rules.publicRoom(room, town.playerId).game.you.witchTeam, []);
});

test("累计五名玩家成为女巫时立即获胜", () => {
  const room = makeRoom(8);
  room.game.seats.forEach((seat, index) => { seat.everWitch = index < 5; });
  assert.equal(rules.checkVictory(room.game), true);
  assert.equal(room.game.winner.side, "witch");
  assert.match(room.game.winner.detail, /5名玩家/);
});

test("手机端有专属单列私密区与双列玩家席位，避免强制横屏", () => {
  const css = fs.readFileSync(path.join(__dirname, "../public/games/witch-town.css"), "utf8");
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(css, /\.wt-seats\{grid-template-columns:repeat\(2/);
  assert.match(css, /\.wt-private\{grid-template-columns:1fr/);
  assert.match(css, /\.wt-log\{display:block/);
  assert.match(css, /\.wt-hand-count/);
  assert.match(css, /\.wt-private\{position:relative/);
  assert.doesNotMatch(css, /min-width:\s*\d{4}px/);
});

function simulateGame(playerCount) {
  let seed = 1000 + playerCount;
  const random = () => ((seed = (seed * 48271) % 0x7fffffff) / 0x7fffffff);
  const room = makeRoom(playerCount, random);
  startDay(room);
  let steps = 0;
  while (room.game.status === "playing" && steps < 1200) {
    const game = room.game;
    if (game.phase === "day") {
      const actor = game.seats.find((seat) => seat.playerId === game.actorId);
      const target = game.seats.find((seat) => seat.alive && seat.playerId !== actor.playerId && !seat.front.some((card) => card.kind === "piety") && seat.tryals.some((trial) => !trial.revealed));
      const red = actor.hand.find((card) => ["accusation", "evidence", "witness"].includes(card.kind));
      const blue = actor.hand.find((card) => ["asylum", "matchmaker", "stocks"].includes(card.kind));
      if (target && (red || blue)) {
        rules.playCard(room, actor.playerId, { cardId: (red || blue).id, targetId: target.playerId });
        if (game.phase === "day") rules.endTurn(room, actor.playerId);
      } else rules.drawCards(room, actor.playerId);
    } else if (game.phase === "trial") {
      const target = game.seats.find((seat) => seat.playerId === game.pendingTrial.targetId);
      rules.revealTrial(room, game.actorId, { trialId: target.tryals.find((trial) => !trial.revealed).id });
      if (game.status === "playing" && game.phase === "day" && game.actorId) rules.endTurn(room, game.actorId);
    } else if (game.phase === "conspiracy-cat") {
      const cat = game.seats.find((seat) => seat.blackCat && seat.alive && seat.character.id !== "mary");
      if (cat) rules.revealTrial(room, game.actorId, { trialId: cat.tryals.find((trial) => !trial.revealed).id });
    } else if (game.phase === "conspiracy-pass") {
      for (const player of game.seats.filter((seat) => seat.alive && !seat.conspiracyPick)) {
        const view = rules.publicRoom(room, player.playerId).game.you;
        rules.conspiracyPick(room, player.playerId, { trialId: view.leftNeighbor.trials[0].id });
      }
    } else if (game.phase === "conspiracy-result" || game.phase === "night-result") {
      for (const player of game.seats.filter((seat) => seat.alive && !game.eventAcks.includes(seat.playerId))) rules.ackEvent(room, player.playerId);
    } else if (game.phase === "night-choice") {
      const target = game.seats.find((seat) => seat.alive && !seat.everWitch && !seat.front.some((card) => card.kind === "asylum"))
        || game.seats.find((seat) => seat.alive && !seat.everWitch)
        || game.seats.find((seat) => seat.alive);
      for (const witch of game.seats.filter((seat) => seat.alive && seat.everWitch && !game.night.targetVotes[seat.playerId])) rules.chooseNightTarget(room, witch.playerId, { targetId: target.playerId });
      const constable = game.seats.find((seat) => seat.alive && seat.tryals.some((trial) => trial.kind === "constable" && !trial.revealed));
      if (game.phase === "night-choice" && constable && !game.night.protectSubmitted) {
        const protect = game.seats.find((seat) => seat.alive && seat.playerId !== constable.playerId && seat.playerId !== target.playerId) || target;
        rules.chooseNightProtection(room, constable.playerId, { targetId: protect.playerId });
      }
    } else if (game.phase === "night-confession") {
      for (const player of [...game.seats].filter((seat) => seat.alive && !game.night.confession[seat.playerId])) rules.nightPass(room, player.playerId);
    } else throw new Error(`模拟遇到无法处理的阶段：${game.phase}`);
    steps += 1;
  }
  assert.equal(room.game.status, "finished", `${playerCount}人局在${steps}步内应正常结束，实际阶段${room.game.phase}；夜晚=${JSON.stringify(room.game.night)}；存活=${JSON.stringify(room.game.seats.filter((seat) => seat.alive).map((seat) => ({ id: seat.playerId, witch: seat.everWitch, constable: seat.tryals.some((trial) => trial.kind === "constable" && !trial.revealed) })))}`);
  assert.ok(["town", "witch"].includes(room.game.winner.side));
  return steps;
}

test("4、6、8、12人随机合法行动均可完整走到胜负且不会卡局", () => {
  for (const count of [4, 6, 8, 12]) assert.ok(simulateGame(count) < 1200);
});
