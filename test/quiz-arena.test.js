const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const rules = require("../src/games/quiz-arena/rules");
const questions = require("../src/games/quiz-arena/questions");
const { CLASSIC_TV_QUESTIONS } = require("../src/games/quiz-arena/classic-tv-questions");
const { auditQuestionBank, validateQuestion } = require("../src/games/quiz-arena/question-quality");

function makeRoom(count = 3, settings = rules.defaultSettings(), random = () => 0, now = 1000) {
  const players = Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, name: `玩家${index + 1}`, connected: true }));
  const room = { code: "QUIZ88", hostId: "p1", settings, players, game: null };
  room.game = rules.createGame(players, settings, random, now);
  return room;
}

test("本地精品题库恰好包含五千个独立知识点并覆盖全部领域", () => {
  assert.equal(questions.LOCAL_QUESTIONS.length, 5000);
  assert.deepEqual([...new Set(questions.LOCAL_QUESTIONS.map((item) => item.category))].sort(), [...rules.CATEGORIES].sort());
  assert.equal(new Set(questions.LOCAL_QUESTIONS.map((item) => item.knowledgeKey)).size, questions.LOCAL_QUESTIONS.length);
  assert.ok(questions.LOCAL_QUESTIONS.every((item) => item.prompt && item.answer && item.explanation));
  assert.ok(questions.LOCAL_QUESTIONS.filter((item) => item.kind === "judge").every((item) => item.options.length === 2));
  assert.ok(questions.LOCAL_QUESTIONS.every((item) => !item.prompt.includes("下面这道题的答案是")));
  assert.deepEqual(questions.questionPackInfo().difficulty, { easy: 3000, medium: 1500, hard: 500 });
  assert.equal(auditQuestionBank(questions.LOCAL_QUESTIONS, { expectedCount: 5000 }).valid, true);
  assert.ok(questions.LOCAL_QUESTIONS.every((item) => validateQuestion(item).valid));
  assert.ok(questions.LOCAL_QUESTIONS.filter((item) => item.kind === "choice").every((item) => item.options.length === 4 && new Set(item.options).size === 4 && item.options.includes(item.answer)));
});

test("角色识图以国产动画为主并只保留全球知名海外角色", () => {
  const characterQuestions = questions.LOCAL_QUESTIONS.filter((item) => item.category === "动漫角色");
  assert.equal(characterQuestions.length, 60);
  assert.ok(characterQuestions.every((item) => item.id.startsWith("character-v3-") && item.pack === "party"));
  assert.equal(characterQuestions.filter((item) => item.chinaFeatured).length, 40);
  assert.equal(characterQuestions.filter((item) => item.worldFamous).length, 20);
  assert.ok(characterQuestions.some((item) => item.answer === "大头儿子" && item.aliases.includes("头太元")));
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
  assert.equal(characterQuestions.length, 60);
  assert.ok(characterQuestions.every((item) => item.kind === "image-fill" && item.aliases.includes(item.answer)));
  assert.ok(characterQuestions.every((item) => questions.CHARACTER_IMAGE_QUERIES[item.imageUrl.split("/").at(-1).split("?")[0]]));
  assert.ok(characterQuestions.every((item) => !item.imageUrl.includes("AniList") && !item.imageUrl.includes("search")));
});

test("影视音乐只保留中国内容并彻底移除儿童童话题", () => {
  const foreignMedia = /泰勒·斯威夫特|迈克尔·杰克逊|泰坦尼克号|盗梦空间|侏罗纪公园|千与千寻/;
  const fairy = /童话|安徒生|格林|白雪公主|灰姑娘|小红帽|睡美人|匹诺曹|豌豆公主|拇指姑娘|长发公主|彼得潘|爱丽丝|小王子|儿童文学/;
  assert.ok(questions.LOCAL_QUESTIONS.filter((item) => item.category === "影视").every((item) => item.chinaFeatured || item.source === "公开电影常识核验题"));
  assert.ok(questions.LOCAL_QUESTIONS.filter((item) => item.category === "音乐").every((item) => item.chinaFeatured));
  assert.ok(questions.LOCAL_QUESTIONS.every((item) => !foreignMedia.test(`${item.prompt} ${item.answer}`)));
  assert.ok(questions.LOCAL_QUESTIONS.every((item) => !fairy.test(`${item.prompt} ${item.answer} ${item.explanation}`)));
  assert.equal(questions.questionPackInfo().properNounPolicy, "china-film-music-only-no-fairy-tales");
});

test("中国影视生活常识与网络文化题显著扩充并保持人工核验选项", () => {
  const expanded = questions.LOCAL_QUESTIONS.filter((item) => item.source === "中国大众知识人工核验题");
  assert.ok(expanded.filter((item) => item.category === "影视").length >= 90);
  assert.ok(expanded.filter((item) => item.category === "生活常识").length >= 25);
  assert.ok(expanded.filter((item) => item.category === "游戏与网络文化").length >= 30);
  assert.ok(expanded.filter((item) => item.id.includes("school-science")).length >= 40);
  assert.ok(expanded.filter((item) => item.id.includes("school-math")).length >= 20);
  assert.ok(expanded.filter((item) => item.id.includes("school-sports")).length >= 20);
  assert.ok(expanded.filter((item) => item.id.includes("school-geography")).length >= 30);
  assert.ok(expanded.every((item) => item.chinaFeatured && item.options.length === 4 && new Set(item.options).size === 4));
  assert.ok(expanded.some((item) => item.prompt.includes("霸王别姬")));
  assert.ok(expanded.filter((item) => item.id.includes("tv-plot")).length >= 30);
  assert.ok(expanded.some((item) => item.prompt.includes("身份证号码")));
  assert.ok(expanded.some((item) => item.prompt.includes("YYDS")));
});

test("国产经典电视剧专题包含四部剧各二十五道同类选项题", () => {
  assert.equal(CLASSIC_TV_QUESTIONS.length, 100);
  assert.equal(new Set(CLASSIC_TV_QUESTIONS.map((item) => item.knowledgeKey)).size, 100);
  for (const show of ["甄嬛传", "武林外传", "亮剑", "还珠格格"]) {
    assert.equal(CLASSIC_TV_QUESTIONS.filter((item) => item.prompt.includes(`《${show}》`)).length, 25);
  }
  assert.ok(CLASSIC_TV_QUESTIONS.every((item) => item.category === "影视" && item.chinaFeatured));
  assert.ok(CLASSIC_TV_QUESTIONS.every((item) => item.options.length === 4 && new Set(item.options).size === 4 && item.options.includes(item.answer)));
  assert.ok(CLASSIC_TV_QUESTIONS.every((item) => validateQuestion(item).valid));
  assert.ok(CLASSIC_TV_QUESTIONS.every((item) => questions.LOCAL_QUESTIONS.some((active) => active.knowledgeKey === item.knowledgeKey)));
});

test("题库拒绝机器翻译残片、错类选项和外国娱乐冷知识", () => {
  const allText = (item) => `${item.prompt} ${item.answer} ${(item.options || []).join(" ")}`;
  const broken = /确切文本未知|文本未知|答案未知|麻将[^？]*(?:乒乓球|松狮犬|金刚)|七个主要国家流域|哪个国家仅次于长江的第二大河流/;
  const foreignEntertainment = /电视节目|电视剧|连续剧|动画|电影|影集|剧集|演员|角色|哈利[·・\s]*波特|霍格沃茨|星球大战|漫威|迪士尼/;
  assert.ok(questions.LOCAL_QUESTIONS.every((item) => !broken.test(allText(item))));
  assert.ok(questions.LOCAL_QUESTIONS.filter((item) => item.category === "趣味冷知识").every((item) => !foreignEntertainment.test(allText(item))));
  assert.ok(questions.LOCAL_QUESTIONS.filter((item) => /地域标签/.test(item.prompt)).every((item) => item.options.every((option) => !/节$/.test(option))));
  assert.ok(questions.LOCAL_QUESTIONS.filter((item) => /哪个传统节日/.test(item.prompt)).every((item) => item.options.every((option) => /节$/.test(option))));
});

test("永久废题会从候补库补位并保持五千道可用题", () => {
  assert.ok(questions.QUESTION_RESERVE.length > 5000);
  const retired = new Set(questions.LOCAL_QUESTIONS.slice(0, 120).map((item) => item.knowledgeKey));
  const replenished = questions.activeLocalQuestions(retired);
  assert.equal(replenished.length, 5000);
  assert.ok(replenished.every((item) => !retired.has(item.knowledgeKey)));
});

test("角色图片服务使用角色本名检索并由本站转发图像", () => {
  const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
  const characters = fs.readFileSync(path.join(__dirname, "../src/games/quiz-arena/characters-v3.js"), "utf8");
  assert.match(characters, /CHARACTER_IMAGE_TERMS/);
  assert.match(server, /wikipediaCharacterImage/);
  assert.match(characters, /wikiTitles/);
  assert.doesNotMatch(server, /generator:\s*"search"/);
  assert.match(server, /fetchImageBytes/);
  assert.match(server, /res\.set\("Cache-Control", "public, max-age=604800, immutable"\)\.type\(image\.contentType\)\.send\(image\.bytes\)/);
  assert.doesNotMatch(server, /redirect\(302, imageUrl\)/);
});

test("任何正式出现的题都会进入数据库永久废题库", () => {
  const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
  const database = fs.readFileSync(path.join(__dirname, "../src/platform/database.js"), "utf8");
  assert.match(database, /CREATE TABLE IF NOT EXISTS quiz_retired_questions/);
  assert.match(server, /retireQuizQuestion/);
  assert.match(server, /INSERT INTO quiz_retired_questions/);
  assert.match(server, /void retireQuizQuestion\(room\)/);
});

test("客户端使用环形站台、生命核心和淘汰坠落反馈", () => {
  const client = fs.readFileSync(path.join(__dirname, "../public/games/quiz-arena.js"), "utf8");
  const styles = fs.readFileSync(path.join(__dirname, "../public/games/quiz-arena.css"), "utf8");
  assert.match(client, /player-count-\$\{room\.players\.length\}/);
  assert.match(client, /quiz-life-cores/);
  assert.match(client, /paintElimination/);
  assert.match(styles, /@keyframes quiz-seat-drop/);
  assert.match(styles, /@keyframes quiz-fall-avatar/);
  assert.match(client, /永久进入废题库/);
  assert.doesNotMatch(client, /"儿童动画角色"|时事政治|"科学", "科技"/);
});

test("在线题包只接受结构完整且领域合法的题目", () => {
  const count = questions.installRemoteQuestions([{ id: "fresh-1", category: "科学与科技", prompt: "太阳系中离太阳最近的行星是？", answer: "水星", options: ["水星", "金星", "地球", "火星"], optionType: "planet", explanation: "水星离太阳最近。" }, { category: "不存在", prompt: "无效", answer: "无效" }]);
  assert.equal(count, 1);
  assert.equal(questions.questionPackInfo().remoteCount, 1);
  questions.installRemoteQuestions([]);
});

test("只有房主能选择模式、题包和至少一个领域", () => {
  const room = { hostId: "p1", game: null, settings: rules.defaultSettings() };
  assert.throws(() => rules.configure(room, "p2", { mode: "buzzer" }), /只有房主/);
  assert.throws(() => rules.configure(room, "p1", { categories: [] }), /至少选择/);
  assert.throws(() => rules.configure(room, "p1", { pack: "party", categories: ["历史"] }), /没有可用题目/);
  rules.configure(room, "p1", { mode: "buzzer", pack: "party", categories: ["影视", "游戏与网络文化"] });
  assert.deepEqual(room.settings, { mode: "buzzer", pack: "party", categories: ["影视", "游戏与网络文化"] });
});

test("永久废题编号会在所有新局继续排除", () => {
  const previous = questions.LOCAL_QUESTIONS.filter((item) => item.category === "地理").slice(0, 30).map((item) => item.knowledgeKey);
  const players = [{ id: "p1", name: "房主" }, { id: "p2", name: "朋友" }];
  const game = rules.createGame(players, { mode: "survival", pack: "classic", categories: ["地理"] }, () => 0, 1000, previous);
  assert.ok(!previous.includes(game.question.knowledgeKey));
  assert.ok(previous.every((key) => game.retiredKnowledgeKeys.includes(key)));
});

test("站神模式每人三颗生命和一次跳过且选项只对当前玩家公开", () => {
  const room = makeRoom();
  assert.ok(room.players.every((item) => item.lives === 3 && item.skips === 1));
  const active = room.game.activePlayerId, other = room.players.find((item) => item.id !== active).id;
  assert.equal(rules.publicRoom(room, active, 1000).game.question.options.length, 4);
  assert.equal(rules.publicRoom(room, other, 1000).game.question.options.length, 0);
  assert.equal(rules.publicRoom(room, other, 1000).game.question.answer, undefined);
});

test("站神模式连续答对五题奖励一次跳过并重新计算连胜", () => {
  const room = makeRoom(2), active = room.game.activePlayerId;
  const item = room.players.find((entry) => entry.id === active);
  for (let index = 0; index < 5; index += 1) {
    // 让同一玩家连续答题，单独验证个人连胜；其他玩家的回合不影响他的记录。
    room.game.activePlayerId = active;
    rules.submitSurvival(room, active, room.game.question.answer, 2000 + index * 10_000);
    if (index < 4) rules.tick(room, room.game.deadline);
  }
  assert.equal(item.skips, 2);
  assert.equal(item.earnedSkips, 1);
  assert.equal(item.answerStreak, 0);
  assert.equal(room.game.result.skipAwarded, true);
});

test("答错、超时和主动跳过都会中断连续答对记录", () => {
  const room = makeRoom(3), active = room.game.activePlayerId, item = room.players.find((entry) => entry.id === active);
  item.answerStreak = 4;
  rules.submitSurvival(room, active, "错误答案", 2000);
  assert.equal(item.answerStreak, 0);
  rules.tick(room, room.game.deadline);
  const skipper = room.players.find((entry) => entry.id === room.game.activePlayerId); skipper.answerStreak = 3;
  rules.skipSurvival(room, skipper.id, 9000); assert.equal(skipper.answerStreak, 0);
});

test("所有领域抽题统一执行中国优先与全球知名例外规则", () => {
  assert.equal(questions.questionPackInfo().localePolicy, "china-first");
  for (const category of rules.CATEGORIES) {
    const suitable = questions.LOCAL_QUESTIONS.filter((item) => item.category === category && questions.chinaFirstQuestion(item));
    assert.ok(suitable.length >= 20, `${category}的中国优先题不足`);
  }
  assert.ok(questions.LOCAL_QUESTIONS.filter((item) => item.category === "音乐" && item.chinaFeatured).length >= 50);
  assert.ok(questions.LOCAL_QUESTIONS.filter((item) => item.category === "美食" && item.chinaFeatured).length >= 50);
});

test("站神模式跳过后由下一位回答全新题目", () => {
  const room = makeRoom();
  const questionId = room.game.question.id, first = room.game.activePlayerId;
  rules.skipSurvival(room, first, 5000);
  const second = room.game.activePlayerId;
  assert.notEqual(second, first); assert.notEqual(room.game.question.id, questionId); assert.equal(room.game.deadline, 25_000);
  const secondQuestionId = room.game.question.id;
  rules.skipSurvival(room, second, 7000);
  assert.notEqual(room.game.question.id, secondQuestionId); assert.equal(room.game.deadline, 27_000);
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

test("每一题均由捣蛋鬼轮流指定下一题领域", () => {
  const room = makeRoom(4); room.players[2].eliminated = true; room.players[2].lives = 0; room.players[3].eliminated = true; room.players[3].lives = 0;
  room.game.phase = "result"; room.game.deadline = 5000;
  rules.tick(room, 5000); assert.equal(room.game.phase, "category-vote"); assert.equal(room.game.categoryVote.selectorId, "p3");
  assert.equal(room.game.categoryVote.options.length, 3);
  const chosen = room.game.categoryVote.options[1]; rules.voteCategory(room, "p3", chosen, 5100);
  assert.equal(room.game.phase, "question"); assert.equal(room.game.question.category, chosen);
  room.game.phase = "result"; room.game.deadline = 6000;
  rules.tick(room, 6000); assert.equal(room.game.categoryVote.selectorId, "p4");
});

test("站神能给每位失败者分别选择三类挑战且本人可免费刷新一次", () => {
  const room = makeRoom(); room.game.status = "finished"; room.game.phase = "finished"; room.game.championId = "p1"; room.game.ranking = ["p1", "p2", "p3"];
  rules.chooseChallenge(room, "p1", "p2", "truth"); rules.chooseChallenge(room, "p1", "p3", "fun");
  assert.equal(room.game.challenges.p2.type, "truth"); assert.equal(room.game.challenges.p3.type, "fun");
  const original = room.game.challenges.p2.prompt; rules.rerollChallenge(room, "p2"); assert.notEqual(room.game.challenges.p2.prompt, original);
  assert.throws(() => rules.rerollChallenge(room, "p2"), /已经使用/);
  rules.completeChallenge(room, "p2"); assert.equal(room.game.challenges.p2.completed, true);
});
