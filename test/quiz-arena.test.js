const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const rules = require("../src/games/quiz-arena/rules");
const questions = require("../src/games/quiz-arena/questions");

function makeRoom(count = 3, settings = rules.defaultSettings(), random = () => 0, now = 1000) {
  const players = Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, name: `玩家${index + 1}`, connected: true }));
  const room = { code: "QUIZ88", hostId: "p1", settings, players, game: null };
  room.game = rules.createGame(players, settings, random, now);
  return room;
}

test("本地基础题库提供3000多题并覆盖动漫角色等十六个领域", () => {
  assert.equal(questions.LOCAL_QUESTIONS.length, 3054);
  assert.deepEqual([...new Set(questions.LOCAL_QUESTIONS.map((item) => item.category))], rules.CATEGORIES);
  assert.ok(questions.LOCAL_QUESTIONS.every((item) => item.prompt && item.answer && item.explanation));
  assert.ok(questions.LOCAL_QUESTIONS.filter((item) => item.kind === "judge").every((item) => item.options.length === 2));
  assert.ok(questions.LOCAL_QUESTIONS.every((item) => !item.prompt.includes("下面这道题的答案是")));
});

test("动漫角色题公开图片但隐藏答案并要求当前玩家填全名", () => {
  const settings = { mode: "survival", pack: "party", categories: ["动漫角色"] };
  const room = makeRoom(3, settings);
  const active = room.game.activePlayerId;
  assert.equal(room.game.question.kind, "image-fill");
  assert.match(room.game.question.imageUrl, /^\/api\/games\/quiz-arena\/character-image\//);
  const view = rules.publicRoom(room, active, 1000);
  assert.equal(view.game.question.imageUrl, room.game.question.imageUrl);
  assert.equal(view.game.question.answer, undefined);
  rules.submitSurvival(room, active, room.game.question.answer.replaceAll("·", ""), 2000);
  assert.equal(room.game.result.correct, true);
});

test("每道动漫角色题都有受控图片查询且不会把搜索词发给客户端", () => {
  const characterQuestions = questions.LOCAL_QUESTIONS.filter((item) => item.category === "动漫角色");
  assert.equal(characterQuestions.length, 54);
  assert.ok(characterQuestions.every((item) => item.kind === "image-fill" && item.aliases.includes(item.answer)));
  assert.deepEqual(new Set(characterQuestions.map((item) => item.imageUrl.split("/").at(-1))), new Set(Object.keys(questions.CHARACTER_IMAGE_QUERIES)));
  assert.ok(characterQuestions.every((item) => !item.imageUrl.includes("AniList") && !item.imageUrl.includes("search")));
});

test("客户端使用环形站台、生命核心和淘汰坠落反馈", () => {
  const client = fs.readFileSync(path.join(__dirname, "../public/games/quiz-arena.js"), "utf8");
  const styles = fs.readFileSync(path.join(__dirname, "../public/games/quiz-arena.css"), "utf8");
  assert.match(client, /player-count-\$\{room\.players\.length\}/);
  assert.match(client, /quiz-life-cores/);
  assert.match(client, /paintElimination/);
  assert.match(styles, /@keyframes quiz-seat-drop/);
  assert.match(styles, /@keyframes quiz-fall-avatar/);
});

test("在线题包只接受结构完整且领域合法的题目", () => {
  const count = questions.installRemoteQuestions([{ id: "fresh-1", category: "科学", prompt: "测试问题？", answer: "答案", options: ["答案", "其他"], explanation: "测试解析" }, { category: "不存在", prompt: "无效", answer: "无效" }]);
  assert.equal(count, 1);
  assert.equal(questions.questionPackInfo().remoteCount, 1);
  questions.installRemoteQuestions([]);
});

test("只有房主能选择模式、题包和至少一个领域", () => {
  const room = { hostId: "p1", game: null, settings: rules.defaultSettings() };
  assert.throws(() => rules.configure(room, "p2", { mode: "buzzer" }), /只有房主/);
  assert.throws(() => rules.configure(room, "p1", { categories: [] }), /至少选择/);
  assert.throws(() => rules.configure(room, "p1", { pack: "party", categories: ["历史"] }), /没有可用题目/);
  rules.configure(room, "p1", { mode: "buzzer", pack: "party", categories: ["影视", "游戏"] });
  assert.deepEqual(room.settings, { mode: "buzzer", pack: "party", categories: ["影视", "游戏"] });
});

test("站神模式每人三颗生命和一次跳过且选项只对当前玩家公开", () => {
  const room = makeRoom();
  assert.ok(room.players.every((item) => item.lives === 3 && item.skips === 1));
  const active = room.game.activePlayerId, other = room.players.find((item) => item.id !== active).id;
  assert.equal(rules.publicRoom(room, active, 1000).game.question.options.length, 4);
  assert.equal(rules.publicRoom(room, other, 1000).game.question.options.length, 0);
  assert.equal(rules.publicRoom(room, other, 1000).game.question.answer, undefined);
});

test("站神模式可以连续传递同一道题且每次重新获得20秒", () => {
  const room = makeRoom();
  const questionId = room.game.question.id, first = room.game.activePlayerId;
  rules.skipSurvival(room, first, 5000);
  const second = room.game.activePlayerId;
  assert.notEqual(second, first); assert.equal(room.game.question.id, questionId); assert.equal(room.game.deadline, 25_000);
  rules.skipSurvival(room, second, 7000);
  assert.equal(room.game.question.id, questionId); assert.equal(room.game.deadline, 27_000);
  assert.equal(room.players.find((item) => item.id === first).skips, 0);
  rules.skipSurvival(room, room.game.activePlayerId, 7500);
  assert.throws(() => rules.skipSurvival(room, first, 8000), /跳过机会/);
});

test("站神模式答错公开玩家答案、正确答案和解析并扣一颗生命", () => {
  const room = makeRoom(), active = room.game.activePlayerId, expected = room.game.question.answer;
  rules.submitSurvival(room, active, "明显错误答案", 3000);
  assert.equal(room.players.find((item) => item.id === active).lives, 2);
  assert.equal(room.game.phase, "result"); assert.equal(room.game.result.value, "明显错误答案"); assert.equal(room.game.result.answer, expected);
  const view = rules.publicRoom(room, "p2", 3000);
  assert.equal(view.game.question.answer, expected); assert.ok(view.game.question.explanation);
});

test("站神模式三次失误淘汰并由最后存活者成为站神", () => {
  const room = makeRoom(2), doomed = room.game.activePlayerId, rival = room.players.find((item) => item.id !== doomed).id;
  for (let life = 0; life < 3; life += 1) {
    rules.submitSurvival(room, doomed, "错误", 2000 + life * 20_000);
    rules.tick(room, room.game.deadline);
    if (life < 2) {
      assert.equal(room.game.activePlayerId, rival);
      rules.submitSurvival(room, rival, room.game.question.answer, room.game.deadline - 1000);
      rules.tick(room, room.game.deadline);
      assert.equal(room.game.activePlayerId, doomed);
    }
  }
  assert.equal(room.game.status, "finished"); assert.equal(room.game.championId, rival);
  assert.equal(room.players.find((item) => item.id === rival).eliminated, false);
});

test("抢答题干8秒逐字揭示且客户端永远收不到未揭晓答案", () => {
  const room = makeRoom(3, { mode: "buzzer", pack: "all", categories: [...rules.CATEGORIES] });
  const early = rules.publicRoom(room, "p1", 1000), full = rules.publicRoom(room, "p1", 9000);
  assert.ok(early.game.question.prompt.length < full.game.question.prompt.length);
  assert.equal(full.game.question.fullyRevealed, true);
  assert.equal(full.game.question.answer, undefined);
  assert.equal(full.game.question.options.length, 0);
});

test("抢到题后暂停公共30秒并独享20秒输入时间", () => {
  const room = makeRoom(3, { mode: "buzzer", pack: "all", categories: [...rules.CATEGORIES] });
  rules.buzz(room, "p1", 6000);
  assert.equal(room.game.phase, "buzz-answer");
  assert.equal(room.game.mainRemaining, 25_000);
  assert.equal(room.game.deadline, 26_000);
  rules.submitBuzz(room, "p1", "错误", 10_000);
  assert.equal(room.game.phase, "buzz-open");
  assert.equal(room.game.mainDeadline, 35_000);
});

test("同一道抢答题累计两人答错立即揭晓且每人扣一颗生命", () => {
  const room = makeRoom(3, { mode: "buzzer", pack: "all", categories: [...rules.CATEGORIES] });
  rules.buzz(room, "p1", 2000); rules.submitBuzz(room, "p1", "错一", 3000);
  rules.buzz(room, "p2", 4000); rules.submitBuzz(room, "p2", "错二", 5000);
  assert.equal(room.game.phase, "result"); assert.equal(room.game.result.reason, "two-wrong");
  assert.equal(room.players[0].lives, 2); assert.equal(room.players[1].lives, 2);
});

test("抢答正确按按下按钮时间计分且答对七题立即获胜", () => {
  const room = makeRoom(3, { mode: "buzzer", pack: "all", categories: [...rules.CATEGORIES] });
  room.players[0].correct = 6;
  rules.buzz(room, "p1", 2000); const answer = room.game.question.answer; rules.submitBuzz(room, "p1", answer, 4000);
  assert.equal(room.game.status, "finished"); assert.equal(room.game.championId, "p1"); assert.equal(room.players[0].correct, 7); assert.equal(room.players[0].score, 975);
});

test("捣蛋鬼能发送有限频率表情但存活玩家不能发送", () => {
  const room = makeRoom(); room.players[1].eliminated = true; room.players[1].lives = 0;
  assert.throws(() => rules.react(room, "p1", "egg", 3000), /只有已淘汰/);
  rules.react(room, "p2", "tomato", 3000); assert.equal(room.game.reactions[0].type, "tomato");
  assert.throws(() => rules.react(room, "p2", "egg", 3500), /太快/);
});

test("每完成三题由捣蛋鬼从三个领域中投票决定下一题", () => {
  const room = makeRoom(); room.players[2].eliminated = true; room.players[2].lives = 0; room.game.questionNumber = 3;
  room.game.phase = "result"; room.game.deadline = 5000;
  rules.tick(room, 5000); assert.equal(room.game.phase, "category-vote"); assert.equal(room.game.categoryVote.options.length, 3);
  const chosen = room.game.categoryVote.options[1]; rules.voteCategory(room, "p3", chosen, 5100);
  assert.equal(room.game.phase, "question"); assert.equal(room.game.question.category, chosen);
});

test("站神能给每位失败者分别选择三类挑战且本人可免费刷新一次", () => {
  const room = makeRoom(); room.game.status = "finished"; room.game.phase = "finished"; room.game.championId = "p1"; room.game.ranking = ["p1", "p2", "p3"];
  rules.chooseChallenge(room, "p1", "p2", "truth"); rules.chooseChallenge(room, "p1", "p3", "fun");
  assert.equal(room.game.challenges.p2.type, "truth"); assert.equal(room.game.challenges.p3.type, "fun");
  const original = room.game.challenges.p2.prompt; rules.rerollChallenge(room, "p2"); assert.notEqual(room.game.challenges.p2.prompt, original);
  assert.throws(() => rules.rerollChallenge(room, "p2"), /已经使用/);
  rules.completeChallenge(room, "p2"); assert.equal(room.game.challenges.p2.completed, true);
});
