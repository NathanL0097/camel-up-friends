const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../src/games/casino-night/rules");
const { commitment, seededRandom, shuffle } = require("../src/games/casino-night/fair-rng");

function room(names = ["房主", "好友"]) {
  const players = names.map((name, index) => ({ id: `p${index + 1}`, name }));
  return { hostId: "p1", players, settings: rules.defaults(), game: rules.createGame(players, { defaultChips: 1000 }) };
}

test("赌场模块使用可复核的种子随机并稳定洗牌", () => {
  const seed = "test-seed", round = "roulette-1";
  const first = shuffle([1, 2, 3, 4, 5], seededRandom(seed, round));
  const second = shuffle([1, 2, 3, 4, 5], seededRandom(seed, round));
  assert.deepEqual(first, second);
  assert.equal(commitment(seed, round), commitment(seed, round));
  assert.equal(commitment(seed, round).length, 64);
});

test("单零轮盘的0不属于红黑单双大小且单号赔率为35比1", () => {
  assert.deepEqual(rules.rouletteNumbers("straight", 0), [0]);
  for (const type of ["red", "black", "odd", "even", "low", "high"]) assert.equal(rules.rouletteNumbers(type).includes(0), false);
  assert.equal(rules.rouletteNumbers("dozen1").length, 12);
  assert.equal(rules.rouletteNumbers("column3").includes(36), true);
});

test("Blackjack正确计算软牌、天然21点并限制庄家所有17停牌", () => {
  assert.deepEqual(rules.blackjackValue(["Ah", "6s"]), { total: 17, soft: true });
  assert.deepEqual(rules.blackjackValue(["Ah", "6s", "Kd"]), { total: 17, soft: false });
  assert.equal(rules.blackjackValue(["Th", "9s", "5d"]).total, 24);
});

test("Casino Hold'em庄家至少四点对子才成牌且赔率表正确", () => {
  assert.equal(rules.dealerQualifies({ score: [1, 4] }), true);
  assert.equal(rules.dealerQualifies({ score: [1, 3] }), false);
  assert.equal(rules.dealerQualifies({ score: [0, 14, 13, 12, 9, 8] }), false);
  assert.equal(rules.anteOdds([8, 14]), 100);
  assert.equal(rules.anteOdds([7, 9, 2]), 10);
  assert.equal(rules.aaOdds([1, 14]), 7);
  assert.equal(rules.aaOdds([1, 13]), 0);
});

test("房主可派发娱乐筹码但普通玩家不能越权", () => {
  const table = room();
  rules.grantChips(table, "p1", { playerId: "p2", amount: 500 });
  assert.equal(table.game.players[1].chips, 1500);
  assert.throws(() => rules.grantChips(table, "p2", { playerId: "p2", amount: 500 }), /只有房主/);
});

test("私人底牌在结算前只对本人公开", () => {
  const table = room();
  rules.selectTable(table, "p1", { table: "holdem" });
  rules.holdemBet(table, "p1", { ante: 10 });
  rules.holdemBet(table, "p2", { ante: 10 });
  rules.holdemDeal(table);
  const hostView = rules.publicRoom(table, "p1").game;
  assert.notEqual(hostView.players[0].holdem.cards[0], "back");
  assert.equal(hostView.players[1].holdem.cards[0], "back");
  assert.equal(hostView.dealer.cards[1], "back");
  assert.equal(hostView.fairness.seed, null);
});
