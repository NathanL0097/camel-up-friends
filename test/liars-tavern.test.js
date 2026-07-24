const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../src/games/liars-tavern/rules");

const players = (count) => Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, name: `骗子${index + 1}` }));
const room = (count = 4, random = () => 0.37) => ({ code: "LIAR66", hostId: "p1", players: players(count), settings: {}, game: rules.createGame(players(count), {}, random) });

test("2至6人每轮各发五张且恶魔牌一定进入玩家手中", () => {
  for (let count = 2; count <= 6; count++) {
    const game = rules.createGame(players(count), {}, () => 0.42);
    assert.ok(game.players.every((player) => player.hand.length === 5));
    assert.equal(game.players.flatMap((player) => player.hand).filter((card) => card.rank === "DEVIL").length, 1);
    assert.ok(rules.RANKS.includes(game.tableRank));
  }
});

test("其他玩家只看到手牌数量而看不到牌面和子弹位置", () => {
  const r = room(3);
  const view = rules.publicRoom(r, "p1");
  assert.equal(view.game.you.hand.length, 5);
  assert.equal(view.game.seats.find((player) => player.playerId === "p2").hand.length, 0);
  assert.equal(view.game.seats[0].bulletPosition, undefined);
  assert.equal(view.game.random, undefined);
});

test("每次只能盖下一至三张且恶魔牌必须单独打出", () => {
  const r = room(3);
  const game = r.game, actor = game.players[game.currentIndex];
  const devil = actor.hand.find((card) => card.rank === "DEVIL");
  if (!devil) actor.hand[0] = { ...actor.hand[0], rank: "DEVIL" };
  const devilCard = actor.hand.find((card) => card.rank === "DEVIL");
  assert.throws(() => rules.play(r, actor.playerId, { cardIds: [devilCard.uid, actor.hand.find((card) => card.uid !== devilCard.uid).uid] }), /恶魔牌只能单独/);
  rules.play(r, actor.playerId, { cardIds: [devilCard.uid] }, 1000);
  assert.equal(game.previousPlay.count, 1);
});

test("质疑诚实出牌时由质疑者扣动左轮", () => {
  const r = room(3);
  const game = r.game, actor = game.players[game.currentIndex];
  actor.hand[0].rank = game.tableRank;
  rules.play(r, actor.playerId, { cardIds: [actor.hand[0].uid] }, 1000);
  const challenger = game.players[game.currentIndex];
  challenger.bulletPosition = 6;
  rules.challenge(r, challenger.playerId, {}, 2000);
  assert.equal(game.lastChallenge.truthful, true);
  assert.equal(game.roulette.current.playerId, challenger.playerId);
  assert.equal(challenger.shots, 1);
  assert.equal(game.roulette.current.bullet, false);
});

test("抓到谎言时由出牌者扣动左轮", () => {
  const r = room(3);
  const game = r.game, actor = game.players[game.currentIndex];
  actor.hand[0].rank = rules.RANKS.find((rank) => rank !== game.tableRank);
  actor.bulletPosition = 6;
  rules.play(r, actor.playerId, { cardIds: [actor.hand[0].uid] }, 1000);
  const challenger = game.players[game.currentIndex];
  rules.challenge(r, challenger.playerId, {}, 2000);
  assert.equal(game.lastChallenge.truthful, false);
  assert.equal(game.roulette.current.playerId, actor.playerId);
  assert.equal(actor.shots, 1);
});

test("恶魔牌被质疑后除出牌者外依次接受左轮判定", () => {
  const r = room(4);
  const game = r.game;
  const holderIndex = game.players.findIndex((player) => player.hand.some((card) => card.rank === "DEVIL"));
  game.currentIndex = holderIndex;
  const holder = game.players[holderIndex], devil = holder.hand.find((card) => card.rank === "DEVIL");
  game.players.forEach((player) => { player.bulletPosition = 6; });
  rules.play(r, holder.playerId, { cardIds: [devil.uid] }, 1000);
  const challenger = game.players[game.currentIndex];
  rules.challenge(r, challenger.playerId, {}, 2000);
  assert.equal(game.lastChallenge.devil, true);
  assert.notEqual(game.roulette.current.playerId, holder.playerId);
  assert.equal(game.roulette.remaining.length, 2);
  rules.tick(r, game.roulette.nextAt);
  assert.equal(game.roulette.remaining.length, 1);
});

test("子弹位置固定且击中后玩家淘汰，最后存活者获胜", () => {
  const r = room(2);
  const game = r.game, actor = game.players[game.currentIndex];
  actor.hand[0].rank = rules.RANKS.find((rank) => rank !== game.tableRank);
  actor.bulletPosition = 1;
  rules.play(r, actor.playerId, { cardIds: [actor.hand[0].uid] }, 1000);
  rules.challenge(r, game.players[game.currentIndex].playerId, {}, 2000);
  assert.equal(actor.alive, false);
  assert.equal(game.roulette.current.bullet, true);
  rules.tick(r, game.roulette.nextAt);
  assert.equal(game.status, "finished");
  assert.notEqual(game.winnerId, actor.playerId);
});

test("出空手牌后下家只能质疑，不能继续盖牌", () => {
  const r = room(2);
  const game = r.game, actor = game.players[game.currentIndex];
  actor.hand = [actor.hand[0]];
  rules.play(r, actor.playerId, { cardIds: [actor.hand[0].uid] }, 1000);
  assert.equal(game.mustChallenge, true);
  const next = game.players[game.currentIndex];
  assert.throws(() => rules.play(r, next.playerId, { cardIds: [next.hand[0].uid] }, 2000), /必须质疑/);
});
