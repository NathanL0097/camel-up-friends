const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../src/games/seven-duel/rules");

test("基础版牌库、奇迹与进步标记数量完整且编号唯一", () => {
  assert.equal(rules.CARDS.filter((card) => card.age === 1).length, 23);
  assert.equal(rules.CARDS.filter((card) => card.age === 2).length, 23);
  assert.equal(rules.CARDS.filter((card) => card.age === 3 && card.type !== "guild").length, 20);
  assert.equal(rules.CARDS.filter((card) => card.type === "guild").length, 7);
  assert.equal(rules.WONDERS.length, 12);
  assert.equal(rules.PROGRESS.length, 10);
  assert.equal(new Set(rules.CARDS.map((card) => card.id)).size, rules.CARDS.length);
});

const players = [{ id: "p1", name: "雅典", connected: true }, { id: "p2", name: "斯巴达", connected: true }];
const room = (random = () => 0.314159) => ({ code: "DUEL77", hostId: "p1", players: structuredClone(players), game: rules.createGame(players, random) });
function finishDraft(r) {
  while (r.game.phase === "wonder-draft") rules.pickWonder(r, r.game.actorId, r.game.wonderDraft.offers[0].id);
}

test("奇迹采用1-2-1再反向1-2-1选择且双方各四座", () => {
  const r = room();
  const sequence = [...r.game.wonderDraft.sequence];
  const secondPlayerId = r.game.playerIds.find((id) => id !== r.game.firstPlayerId);
  assert.deepEqual(sequence, [r.game.firstPlayerId, secondPlayerId, secondPlayerId, r.game.firstPlayerId, secondPlayerId, r.game.firstPlayerId, r.game.firstPlayerId, secondPlayerId]);
  finishDraft(r);
  assert.equal(r.game.cities.p1.wonders.length, 4);
  assert.equal(r.game.cities.p2.wonders.length, 4);
  assert.equal(r.game.phase, "playing");
  assert.equal(r.game.age, 1);
});

test("每时代使用20张牌且时代一开始只有最下方六张可取", () => {
  const r = room(); finishDraft(r);
  assert.equal(r.game.cardSlots.length, 20);
  assert.equal(r.game.cardSlots.filter((slot) => rules.isAccessible(r.game, slot)).length, 6);
  assert.equal(r.game.cardSlots.filter((slot) => slot.revealed).length, 12);
});

test("动态交易价格由对手棕灰资源产量提高并支持商业折扣", () => {
  const r = room(); finishDraft(r);
  r.game.cities.p2.buildings.push({ id: "opp-stone", type: "raw", produces: { stone: 2 } });
  let cost = rules.constructionCost(r.game, "p1", { type: "civilian", cost: { stone: 2 } });
  assert.equal(cost.total, 8);
  r.game.cities.p1.buildings.push({ id: "stone-reserve", type: "commercial", trades: ["stone"] });
  cost = rules.constructionCost(r.game, "p1", { type: "civilian", cost: { stone: 2 } });
  assert.equal(cost.total, 2);
});

test("取得第二个相同科学符号后暂停并选择进步标记", () => {
  const r = room(); finishDraft(r);
  const actor = r.game.actorId;
  r.game.cities[actor].buildings.push({ id: "old-science", type: "scientific", science: "wheel" });
  r.game.cardSlots = [{ id: "science", row: 1, column: 1, revealed: true, taken: false, card: { id: "new-science", name: "科学建筑", type: "scientific", science: "wheel" } }, { id: "spare", row: 1, column: 4, revealed: true, taken: false, card: { id: "spare-card", name: "备用建筑", type: "civilian", vp: 1 } }];
  rules.takeCard(r, actor, { cardId: "science", mode: "build" });
  assert.equal(r.game.phase, "pending");
  assert.equal(r.game.pending.kind, "progress");
  const tokenId = r.game.pending.options[0];
  rules.chooseProgress(r, actor, tokenId);
  assert.equal(r.game.cities[actor].progress.length, 1);
  assert.equal(r.game.phase, "playing");
});

test("军事推进抵达对方首都会立即结束游戏", () => {
  const r = room(); finishDraft(r);
  const actor = r.game.playerIds[0];
  r.game.actorId = actor; r.game.military = 8;
  r.game.cardSlots = [{ id: "army", row: 1, column: 1, revealed: true, taken: false, card: { id: "army-card", name: "终局军团", type: "military", shields: 1 } }];
  rules.takeCard(r, actor, { cardId: "army", mode: "build" });
  assert.equal(r.game.status, "finished");
  assert.equal(r.game.victoryType, "military");
  assert.equal(r.game.winnerId, actor);
});

test("时代结束由军事弱势方选择下一时代先手", () => {
  const r = room(); finishDraft(r);
  const actor = r.game.playerIds[0], weaker = r.game.playerIds[1];
  r.game.actorId = actor; r.game.military = 2;
  r.game.cardSlots = [{ id: "last", row: 1, column: 1, revealed: true, taken: false, card: { id: "last-card", name: "时代末牌", type: "civilian" } }];
  rules.takeCard(r, actor, { cardId: "last", mode: "discard" });
  assert.equal(r.game.phase, "choose-starter");
  assert.equal(r.game.actorId, weaker);
  rules.chooseStarter(r, weaker, actor);
  assert.equal(r.game.age, 2);
  assert.equal(r.game.actorId, actor);
});

test("双方可以连续弃牌完整走完三个时代并进入文明结算", () => {
  const r = room(); finishDraft(r);
  let turns = 0;
  while (r.game.status === "playing" && turns < 80) {
    if (r.game.phase === "choose-starter") rules.chooseStarter(r, r.game.actorId, r.game.actorId);
    else {
      const slot = r.game.cardSlots.find((item) => !item.taken && item.revealed && rules.isAccessible(r.game, item));
      assert.ok(slot);
      rules.takeCard(r, r.game.actorId, { cardId: slot.id, mode: "discard" });
      turns += 1;
    }
  }
  assert.equal(turns, 60);
  assert.equal(r.game.status, "finished");
  assert.equal(r.game.victoryType, "civilian");
  assert.equal(r.game.ranking.length, 2);
});

test("未翻开的牌在公开房间状态中不会泄露内容", () => {
  const r = room(); finishDraft(r);
  const view = rules.publicRoom(r, "p1");
  const hidden = view.game.cardSlots.find((slot) => !slot.revealed && !slot.taken);
  assert.ok(hidden);
  assert.equal(hidden.card, null);
  assert.deepEqual(view.game.playerIds, r.game.playerIds);
});

test("终局文明计分包含建筑、奇迹、进步、军事和金币", () => {
  const r = room(); finishDraft(r);
  r.game.cities.p1.coins = 8;
  r.game.cities.p1.buildings = [{ id: "blue", type: "civilian", vp: 5 }];
  r.game.cities.p1.wonders = [{ id: "wonder", built: true, vp: 4 }];
  r.game.cities.p1.progress = [{ id: "philosophy", vp: 7 }];
  r.game.military = 1;
  const score = rules.scoreCity(r.game, "p1");
  assert.deepEqual({ building: score.building, wonder: score.wonder, progress: score.progress, military: score.military, treasury: score.treasury, total: score.total }, { building: 5, wonder: 4, progress: 7, military: 2, treasury: 2, total: 20 });
});
