const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rules = require("../src/games/colt-express/rules");
const { definition } = require("../src/games/colt-express");

const makePlayers = (count) => Array.from({ length: count }, (_unused, index) => ({ id: `p${index + 1}`, name: `玩家${index + 1}`, connected: true }));
const makeRoom = (count = 4, random = () => 0.37) => ({ code: "TRAIN1", hostId: "p1", players: makePlayers(count), game: rules.createGame(makePlayers(count), {}, random) });

test("基础盒支持2至6人、五轮与玩家数对应列车", () => {
  assert.equal(definition.minPlayers, 2);
  assert.equal(definition.maxPlayers, 6);
  for (let count = 2; count <= 6; count += 1) {
    const room = makeRoom(count);
    assert.equal(room.game.players.length, count);
    assert.equal(room.game.roundCards.length, 5);
    assert.equal(room.game.trainCars.length, count === 2 ? 4 : count + 1);
    assert.equal(room.game.trainCars.at(-1).type, "locomotive");
    assert.equal(room.game.marshalCarIndex, room.game.trainCars.length - 1);
    assert.ok(room.game.players.every((player) => player.hand.length === (player.character.id === "doc" ? 7 : 6)));
  }
  assert.throws(() => rules.createGame(makePlayers(1)), /2至6/);
  assert.throws(() => rules.createGame(makePlayers(7)), /2至6/);
});

test("每名强盗拥有标准十张行动牌、六颗子弹和起始钱袋", () => {
  const game = makeRoom().game;
  for (const player of game.players) {
    assert.equal(player.hand.length + player.drawPile.length, 10);
    assert.equal(player.bulletsRemaining, 6);
    assert.equal(player.loot.reduce((sum, loot) => sum + loot.value, 0), 250);
  }
});

test("隧道回合与Ghost每轮首张牌会正确进入暗牌状态", () => {
  const room = makeRoom();
  const game = room.game;
  const ghost = game.players[0];
  ghost.character = { ...rules.CHARACTERS.find((character) => character.id === "ghost") };
  game.firstPlayerIndex = 0;
  game.planningSteps = [{ playerId: ghost.id, turnType: "standard", turnNumber: 0, substep: 0, hidden: false }];
  game.planningIndex = 0;
  game.phase = "planning";
  game.actorId = ghost.id;
  const first = ghost.hand.find((card) => card.kind === "action");
  rules.playCard(room, ghost.id, { cardId: first.id });
  assert.equal(game.actionStack[0].isHidden, true);

  const tunnel = makeRoom();
  const tunnelActor = tunnel.game.players[0];
  tunnel.game.planningSteps = [{ playerId: tunnelActor.id, turnType: "tunnel", turnNumber: 0, substep: 0, hidden: true }];
  tunnel.game.planningIndex = 0;
  tunnel.game.phase = "planning";
  tunnel.game.actorId = tunnelActor.id;
  tunnelActor.character = { ...rules.CHARACTERS.find((character) => character.id === "django") };
  const tunnelCard = tunnelActor.hand.find((card) => card.kind === "action");
  rules.playCard(tunnel, tunnelActor.id, { cardId: tunnelCard.id });
  assert.equal(tunnel.game.actionStack[0].isHidden, true);
});

test("车内只能移动一节，车顶可以移动一至三节", () => {
  const game = makeRoom(5).game;
  const player = game.players[0];
  player.position = { carIndex: 2, isRoof: false };
  assert.deepEqual(rules.getMoveOptions(game, player.id).map((item) => item.carIndex), [1, 3]);
  player.position.isRoof = true;
  assert.deepEqual(rules.getMoveOptions(game, player.id).map((item) => item.carIndex).sort((a, b) => a - b), [0, 1, 3, 4, 5]);
});

test("车顶射击只命中每个方向最近车厢，车内只命中相邻车厢", () => {
  const game = makeRoom(5).game;
  const [shooter, nearLeft, farLeft, nearRight, same] = game.players;
  shooter.position = { carIndex: 3, isRoof: true };
  nearLeft.position = { carIndex: 2, isRoof: true };
  farLeft.position = { carIndex: 0, isRoof: true };
  nearRight.position = { carIndex: 5, isRoof: true };
  same.position = { carIndex: 3, isRoof: true };
  assert.deepEqual(rules.getShootTargets(game, shooter.id).map((item) => item.playerId).sort(), [nearLeft.id, nearRight.id].sort());
  shooter.position = { carIndex: 2, isRoof: false };
  nearLeft.position = { carIndex: 1, isRoof: false };
  farLeft.position = { carIndex: 0, isRoof: false };
  nearRight.position = { carIndex: 3, isRoof: false };
  assert.deepEqual(rules.getShootTargets(game, shooter.id).map((item) => item.playerId).sort(), [nearLeft.id, nearRight.id].sort());
});

test("Belle有其他合法目标时不会出现在射击或拳击目标中", () => {
  const game = makeRoom(3).game;
  const [shooter, belle, other] = game.players;
  shooter.position = { carIndex: 1, isRoof: true };
  belle.position = { carIndex: 1, isRoof: true };
  other.position = { carIndex: 1, isRoof: true };
  belle.character = { ...rules.CHARACTERS.find((character) => character.id === "belle") };
  assert.deepEqual(rules.__test.getPunchTargets(game, shooter.id).map((item) => item.playerId), [other.id]);
  other.position.carIndex = 2;
  assert.deepEqual(rules.__test.getPunchTargets(game, shooter.id).map((item) => item.playerId), [belle.id]);
});

function mountAction(game, player, type) {
  game.phase = "executing";
  game.actorId = player.id;
  game.currentAction = { id: `test-${type}`, cardType: type, ownerId: player.id, isHidden: false };
  game.executionOptions = rules.__test.executionOptions(game, game.currentAction);
}

test("Cheyenne拳击掉落钱袋时直接偷走，珠宝仍落在原地", () => {
  const room = makeRoom(2);
  const [cheyenne, target] = room.game.players;
  cheyenne.character = { ...rules.CHARACTERS.find((character) => character.id === "cheyenne") };
  cheyenne.position = { carIndex: 1, isRoof: false };
  target.position = { carIndex: 1, isRoof: false };
  target.loot = [{ id: "purse", type: "purse", value: 400 }, { id: "jewel", type: "jewel", value: 500 }];
  mountAction(room.game, cheyenne, "punch");
  rules.executeAction(room, cheyenne.id, { targetId: target.id, destination: 0, lootId: "purse" });
  assert.equal(cheyenne.loot.some((loot) => loot.id === "purse"), true);
  assert.equal(room.game.trainCars[1].insideLoot.some((loot) => loot.id === "purse"), false);
});

test("Django射击会把目标向远离自己的方向击退一节", () => {
  const room = makeRoom(4);
  const [django, target, spare] = room.game.players;
  django.character = { ...rules.CHARACTERS.find((character) => character.id === "django") };
  django.position = { carIndex: 1, isRoof: false };
  target.position = { carIndex: 2, isRoof: false };
  spare.position = { carIndex: 0, isRoof: true };
  mountAction(room.game, django, "shoot");
  rules.executeAction(room, django.id, { targetId: target.id });
  assert.equal(target.position.carIndex, 3);
  assert.equal(target.bulletsReceived.length, 1);
});

test("警长进入车厢会驱赶全部强盗并发中立子弹", () => {
  const room = makeRoom(3);
  const [actor, first, second] = room.game.players;
  first.position = second.position = { carIndex: room.game.marshalCarIndex - 1, isRoof: false };
  actor.position = { carIndex: 0, isRoof: true };
  mountAction(room.game, actor, "marshal");
  rules.executeAction(room, actor.id, { carIndex: room.game.marshalCarIndex - 1 });
  assert.equal(first.position.isRoof, true);
  assert.equal(second.position.isRoof, true);
  assert.equal(first.bulletsReceived.length, 1);
  assert.equal(second.bulletsReceived.length, 1);
});

test("无目标行动会产生可读的无效结果并等待全员确认", () => {
  const room = makeRoom(2);
  const actor = room.game.players[0];
  room.game.players[1].position = { carIndex: room.game.trainCars.length - 1, isRoof: true };
  actor.position = { carIndex: 0, isRoof: false };
  mountAction(room.game, actor, "shoot");
  room.game.executionOptions = [];
  rules.__test.resolveCurrentAction(room.game, actor.id, { fallback: true });
  assert.equal(room.game.phase, "execution-result");
  assert.equal(room.game.lastEvent.fallback, true);
  assert.match(room.game.lastEvent.detail, /没有任何合法目标/);
});

test("公共状态隐藏他人手牌和钱袋金额，但公开行动栈保留隧道秘密", () => {
  const room = makeRoom(3);
  const game = room.game;
  game.actionStack = [{ id: "hidden", sourceCardId: "x", cardType: "shoot", ownerId: "p2", isHidden: true, turnType: "tunnel", turnNumber: 0 }];
  const view = rules.publicRoom(room, "p1");
  assert.equal(view.game.players.length, 3);
  assert.equal(view.game.players[0].position.carIndex, game.players[0].position.carIndex);
  assert.equal(view.game.actionStack[0].cardType, null);
  assert.equal(view.game.you.hand.length, game.players[0].hand.length);
  assert.equal(view.players.find((player) => player.id === "p2").hand, undefined);
  assert.equal(view.players.find((player) => player.id === "p2").loot[0].value, null);
});

test("每轮先公开完整特殊事件简报，所有玩家确认后才开始策划", () => {
  const room = makeRoom(3);
  room.game.roundCard.event = "angry-marshal";
  assert.equal(room.game.phase, "round-briefing");
  assert.equal(room.game.actorId, null);
  const view = rules.publicRoom(room, "p1");
  assert.equal(view.game.roundEventPreview.name, "愤怒的警长");
  assert.match(view.game.roundEventPreview.detail, /本轮全部行动执行完后/);
  assert.match(view.game.roundEventPreview.detail, /警长向车尾移动1节/);
  rules.acknowledge(room, "p1");
  assert.equal(room.game.phase, "round-briefing");
  rules.acknowledge(room, "p2");
  rules.acknowledge(room, "p3");
  assert.equal(room.game.phase, "planning");
  assert.equal(room.game.actorId, room.game.planningSteps[0].playerId);
});

function acknowledgeAll(room) {
  for (const player of room.players) if (room.game.status === "playing" && ["round-briefing", "planning-result", "execution-result", "round-result"].includes(room.game.phase)) rules.acknowledge(room, player.id);
}
function executeFirstOption(room) {
  const game = room.game, actor = game.actorId, type = game.currentAction.cardType, first = game.executionOptions[0];
  if (type === "move" || type === "marshal") return rules.executeAction(room, actor, { carIndex: first.carIndex });
  if (type === "shoot") return rules.executeAction(room, actor, { targetId: first.playerId });
  if (type === "rob") return rules.executeAction(room, actor, { lootId: first.id });
  if (type === "punch") return rules.executeAction(room, actor, { targetId: first.playerId, destination: first.destinations[0], lootId: first.loot[0]?.id });
}

test("自动玩家巡检：2至6人均可完整走完五轮且没有软锁", () => {
  for (let count = 2; count <= 6; count += 1) {
    const room = makeRoom(count, () => 0.41);
    let guard = 0;
    while (room.game.status === "playing" && guard < 3000) {
      const game = room.game;
      if (game.phase === "planning") {
        const player = game.players.find((item) => item.id === game.actorId);
        const card = player.hand.find((item) => item.kind === "action");
        if (card) rules.playCard(room, player.id, { cardId: card.id }); else rules.drawCards(room, player.id);
      } else if (game.phase === "executing") executeFirstOption(room);
      else if (["round-briefing", "planning-result", "execution-result", "round-result"].includes(game.phase)) acknowledgeAll(room);
      else throw new Error(`未处理阶段：${game.phase}`);
      guard += 1;
    }
    assert.equal(room.game.status, "finished", `${count}人局应在限制内结束`);
    assert.equal(room.game.round, 5);
    assert.ok(room.game.winner.ranking.length === count);
  }
});

test("客户端包含移动端列车导航、滑动视口、底部手牌抽屉和两步确认", () => {
  const client = fs.readFileSync(require.resolve("../public/games/colt-express.js"), "utf8");
  const css = fs.readFileSync(require.resolve("../public/games/colt-express.css"), "utf8");
  assert.match(client, /ceMini/);
  assert.match(client, /ceHandToggle/);
  assert.match(client, /ceConfirmAction/);
  assert.match(client, /scrollIntoView/);
  assert.match(client, /ceStackButton/);
  assert.match(client, /roundEventPreview/);
  assert.match(client, /本轮结束事件/);
  assert.match(css, /scroll-snap-type:x mandatory/);
  assert.match(css, /ce-hand-dock\.open/);
  assert.match(css, /@media\(hover:none\)/);
});
