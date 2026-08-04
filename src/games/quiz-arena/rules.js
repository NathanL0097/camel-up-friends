const { CATEGORIES, getQuestionBank, questionPackInfo } = require("./questions");
const CHALLENGES = require("./challenges");

const SURVIVAL_SECONDS = 20;
const BUZZ_WINDOW_SECONDS = 30;
const PROMPT_REVEAL_SECONDS = 8;
const BUZZ_ANSWER_SECONDS = 20;
const RESULT_SECONDS = 6;
const VOTE_SECONDS = 12;
const STARTING_LIVES = 3;
const SURVIVAL_SKIPS = 1;
const BUZZ_WIN_CORRECT = 7;
const REACTIONS = ["egg", "tomato", "question", "applause"];
const PACKS = ["all", "classic", "party"];
const PARTY_CATEGORIES = ["网络文化", "影视", "音乐", "游戏", "美食", "动漫角色", "儿童动画角色"];
function packAllowsCategory(pack, category) { return pack === "all" || (pack === "party" ? PARTY_CATEGORIES.includes(category) : !PARTY_CATEGORIES.includes(category) && category !== "时事政治"); }

function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function defaultSettings() { return { mode: "survival", pack: "all", categories: [...CATEGORIES] }; }

function configure(room, playerId, payload = {}) {
  if (room.hostId !== playerId) throw new Error("只有房主可以修改答题设置");
  if (room.game) throw new Error("比赛开始后不能修改设置");
  const mode = ["survival", "buzzer"].includes(payload.mode) ? payload.mode : "survival";
  const pack = PACKS.includes(payload.pack) ? payload.pack : "all";
  const categories = [...new Set((Array.isArray(payload.categories) ? payload.categories : CATEGORIES).filter((item) => CATEGORIES.includes(item)))];
  if (!categories.length) throw new Error("至少选择一个题目领域");
  if (!categories.some((category) => packAllowsCategory(pack, category))) throw new Error("当前题库组合与所选领域没有可用题目");
  room.settings = { mode, pack, categories };
}

function eligibleQuestions(game, forcedCategory = null) {
  const bank = getQuestionBank();
  const categories = forcedCategory ? [forcedCategory] : game.settings.categories;
  const packMatch = (question) => game.settings.pack === "all" || (game.settings.pack === "classic" ? question.pack !== "party" && question.pack !== "current" : question.pack === "party");
  return bank.filter((question) => categories.includes(question.category) && packMatch(question) && !game.usedKnowledgeKeys.includes(question.knowledgeKey));
}

function pickQuestion(game, forcedCategory = null) {
  let choices = eligibleQuestions(game, forcedCategory);
  if (!choices.length) {
    game.usedKnowledgeKeys = [];
    choices = eligibleQuestions(game, forcedCategory);
  }
  if (!choices.length && forcedCategory) choices = eligibleQuestions(game, null);
  if (!choices.length) throw new Error("当前题库设置下没有可用题目");
  const question = choices[Math.floor(game.random() * choices.length)];
  game.usedQuestionIds.push(question.id);
  game.usedKnowledgeKeys.push(question.knowledgeKey);
  return { ...question, options: shuffle(question.options, game.random) };
}

function alivePlayers(room) { return room.players.filter((player) => !player.eliminated); }
function player(room, playerId) { const found = room.players.find((item) => item.id === playerId); if (!found) throw new Error("找不到玩家"); return found; }
function nextAliveId(room, currentId) {
  const start = Math.max(0, room.game.turnOrder.indexOf(currentId));
  for (let step = 1; step <= room.game.turnOrder.length; step += 1) {
    const id = room.game.turnOrder[(start + step) % room.game.turnOrder.length];
    if (!player(room, id).eliminated) return id;
  }
  return null;
}

function normalize(value) {
  return String(value || "").normalize("NFKC").trim().toLowerCase().replace(/[\s，。！？、,.!?；;：:'‘’“”"《》〈〉（）()\-—_]/g, "");
}
function isCorrect(question, value) { const clean = normalize(value); return [question.answer, ...(question.aliases || [])].some((answer) => normalize(answer) === clean); }

function resetPlayers(players, mode) {
  players.forEach((item) => Object.assign(item, { lives: STARTING_LIVES, skips: mode === "survival" ? SURVIVAL_SKIPS : 0, correct: 0, score: 0, eliminated: false, ghostScore: 0, lastReactionAt: 0 }));
}

function createGame(players, settings = defaultSettings(), random = Math.random, now = Date.now()) {
  const cleanSettings = { ...defaultSettings(), ...settings, categories: Array.isArray(settings.categories) && settings.categories.length ? settings.categories.filter((item) => CATEGORIES.includes(item)) : [...CATEGORIES] };
  resetPlayers(players, cleanSettings.mode);
  const game = {
    status: "playing", mode: cleanSettings.mode, phase: "question", settings: cleanSettings,
    questionNumber: 0, turnOrder: shuffle(players.map((item) => item.id), random), activePlayerId: null,
    question: null, usedQuestionIds: [], usedKnowledgeKeys: [], deadline: null, mainDeadline: null, mainRemaining: null,
    questionStartedAt: null, answererId: null, attempts: [], result: null, reactions: [], categoryVote: null,
    ranking: [], championId: null, challenges: {}, challengeRerolls: {}, random, packInfo: questionPackInfo()
  };
  game.activePlayerId = game.turnOrder[0];
  beginQuestion({ players, game }, now);
  return game;
}

function beginQuestion(room, now = Date.now(), forcedCategory = null) {
  const game = room.game;
  game.questionNumber += 1;
  game.question = pickQuestion(game, forcedCategory);
  game.phase = game.mode === "buzzer" ? "buzz-open" : "question";
  game.questionStartedAt = now;
  game.deadline = now + (game.mode === "buzzer" ? BUZZ_WINDOW_SECONDS : SURVIVAL_SECONDS) * 1000;
  game.mainDeadline = game.deadline;
  game.mainRemaining = null;
  game.answererId = null;
  game.attempts = [];
  game.result = null;
}

function finishGame(room, championId, now = Date.now()) {
  const game = room.game;
  game.status = "finished"; game.phase = "finished"; game.deadline = null; game.mainDeadline = null; game.championId = championId;
  const champion = player(room, championId);
  const others = room.players.filter((item) => item.id !== championId).sort((a, b) => b.correct - a.correct || b.score - a.score || b.lives - a.lives);
  game.ranking = [championId, ...others.map((item) => item.id)];
  game.finishedAt = now;
}

function eliminateIfNeeded(room, item) {
  if (item.lives > 0) return;
  item.lives = 0; item.eliminated = true;
  if (room.game.activePlayerId === item.id) room.game.activePlayerId = nextAliveId(room, item.id);
}

function setResult(room, data, now = Date.now()) {
  room.game.phase = "result";
  room.game.result = { ...data, answer: room.game.question.answer, explanation: room.game.question.explanation, source: room.game.question.source, at: now };
  room.game.deadline = now + RESULT_SECONDS * 1000;
  room.game.mainDeadline = null;
  room.game.answererId = null;
}

function submitSurvival(room, playerId, value, now = Date.now()) {
  const game = room.game;
  if (game.mode !== "survival" || game.phase !== "question") throw new Error("现在不能回答这道题");
  if (game.activePlayerId !== playerId) throw new Error("现在还没有轮到你");
  const item = player(room, playerId);
  const correct = isCorrect(game.question, value);
  if (correct) { item.correct += 1; item.score += 100; }
  else { item.lives -= 1; eliminateIfNeeded(room, item); }
  game.activePlayerId = nextAliveId(room, playerId) || playerId;
  setResult(room, { playerId, value: String(value || ""), correct, lostLife: !correct }, now);
}

function skipSurvival(room, playerId, now = Date.now()) {
  const game = room.game;
  if (game.mode !== "survival" || game.phase !== "question" || game.activePlayerId !== playerId) throw new Error("现在不能跳过");
  const item = player(room, playerId);
  if (item.skips < 1) throw new Error("你的跳过机会已经用完");
  item.skips -= 1;
  game.activePlayerId = nextAliveId(room, playerId) || playerId;
  game.deadline = now + SURVIVAL_SECONDS * 1000;
  game.result = null;
}

function buzz(room, playerId, now = Date.now()) {
  const game = room.game;
  if (game.mode !== "buzzer" || game.phase !== "buzz-open") throw new Error("现在不能抢答");
  const item = player(room, playerId);
  if (item.eliminated) throw new Error("捣蛋鬼不能抢答");
  if (game.attempts.some((attempt) => attempt.playerId === playerId)) throw new Error("你已经回答过这道题");
  if (now >= game.mainDeadline) throw new Error("本题抢答时间已经结束");
  game.mainRemaining = game.mainDeadline - now;
  game.answererId = playerId;
  game.phase = "buzz-answer";
  game.deadline = now + BUZZ_ANSWER_SECONDS * 1000;
  item.lastBuzzElapsed = BUZZ_WINDOW_SECONDS * 1000 - game.mainRemaining;
}

function buzzScore(elapsed) { return Math.max(300, 1000 - Math.floor(Math.max(0, elapsed) / 1000) * 25); }

function submitBuzz(room, playerId, value, now = Date.now()) {
  const game = room.game;
  if (game.mode !== "buzzer" || game.phase !== "buzz-answer" || game.answererId !== playerId) throw new Error("你当前没有答题权");
  const item = player(room, playerId);
  const correct = isCorrect(game.question, value);
  const attempt = { playerId, value: String(value || ""), correct, at: now };
  game.attempts.push(attempt);
  if (correct) {
    const points = buzzScore(item.lastBuzzElapsed || 0);
    item.correct += 1; item.score += points;
    if (item.correct >= BUZZ_WIN_CORRECT) return finishGame(room, playerId, now);
    setResult(room, { playerId, value: attempt.value, correct: true, points, attempts: [...game.attempts] }, now);
    return;
  }
  item.lives -= 1;
  eliminateIfNeeded(room, item);
  if (game.attempts.length >= 2 || alivePlayers(room).length <= 1) {
    const survivors = alivePlayers(room);
    if (survivors.length === 1) return finishGame(room, survivors[0].id, now);
    setResult(room, { playerId, value: attempt.value, correct: false, lostLife: true, attempts: [...game.attempts], reason: "two-wrong" }, now);
  } else {
    game.phase = "buzz-open";
    game.answererId = null;
    game.mainDeadline = now + Math.max(0, game.mainRemaining);
    game.deadline = game.mainDeadline;
  }
}

function offerCategoryVote(room, now = Date.now()) {
  const game = room.game;
  const ghosts = room.players.filter((item) => item.eliminated);
  if (!ghosts.length || game.questionNumber % 3 !== 0) return false;
  game.phase = "category-vote";
  game.categoryVote = { options: shuffle(game.settings.categories, game.random).slice(0, Math.min(3, game.settings.categories.length)), votes: {}, deadline: now + VOTE_SECONDS * 1000 };
  game.deadline = game.categoryVote.deadline;
  return true;
}

function resolveCategoryVote(room, now = Date.now()) {
  const vote = room.game.categoryVote;
  if (!vote) return beginQuestion(room, now);
  const counts = Object.values(vote.votes).reduce((map, category) => (map[category] = (map[category] || 0) + 1, map), {});
  const best = Math.max(0, ...Object.values(counts));
  const tied = vote.options.filter((category) => (counts[category] || 0) === best);
  const chosen = tied[Math.floor(room.game.random() * tied.length)] || vote.options[0];
  room.game.categoryVote = { ...vote, chosen };
  beginQuestion(room, now, chosen);
}

function voteCategory(room, playerId, category, now = Date.now()) {
  const game = room.game;
  const item = player(room, playerId);
  if (game.phase !== "category-vote" || !game.categoryVote) throw new Error("现在没有领域投票");
  if (!item.eliminated) throw new Error("只有捣蛋鬼可以投票");
  if (!game.categoryVote.options.includes(category)) throw new Error("请选择本轮提供的领域");
  game.categoryVote.votes[playerId] = category;
  const ghosts = room.players.filter((candidate) => candidate.eliminated && candidate.connected !== false);
  if (ghosts.length && ghosts.every((candidate) => game.categoryVote.votes[candidate.id])) resolveCategoryVote(room, now);
}

function react(room, playerId, type, now = Date.now()) {
  const game = room.game;
  const item = player(room, playerId);
  if (!item.eliminated || game.status !== "playing") throw new Error("只有已淘汰的捣蛋鬼可以发送表情");
  if (!REACTIONS.includes(type)) throw new Error("不支持这个表情");
  if (now - item.lastReactionAt < 1200) throw new Error("表情发送得太快了");
  item.lastReactionAt = now;
  game.reactions.push({ id: `${now}-${playerId}`, playerId, playerName: item.name, type, at: now });
  game.reactions = game.reactions.filter((entry) => now - entry.at < 8000).slice(-20);
}

function chooseChallenge(room, playerId, targetId, type) {
  const game = room.game;
  if (game.status !== "finished" || game.championId !== playerId) throw new Error("只有本场站神可以选择赛后挑战");
  if (targetId === playerId || !room.players.some((item) => item.id === targetId)) throw new Error("请选择一位失败玩家");
  if (!CHALLENGES[type]) throw new Error("请选择真心话、大冒险或欢乐挑战");
  if (game.challenges[targetId]) throw new Error("这位玩家已经抽取了挑战");
  const prompts = CHALLENGES[type];
  game.challenges[targetId] = { type, prompt: prompts[Math.floor(game.random() * prompts.length)], completed: false };
}

function rerollChallenge(room, playerId) {
  const game = room.game;
  const current = game.challenges[playerId];
  if (game.status !== "finished" || !current) throw new Error("你还没有赛后挑战");
  if (game.challengeRerolls[playerId]) throw new Error("你的免费刷新已经使用过了");
  const prompts = CHALLENGES[current.type].filter((prompt) => prompt !== current.prompt);
  current.prompt = prompts[Math.floor(game.random() * prompts.length)];
  game.challengeRerolls[playerId] = true;
}

function completeChallenge(room, playerId) {
  const challenge = room.game.challenges[playerId];
  if (!challenge) throw new Error("你还没有赛后挑战");
  challenge.completed = true;
}

function finishResult(room, now) {
  const survivors = alivePlayers(room);
  if (survivors.length === 1) return finishGame(room, survivors[0].id, now);
  if (offerCategoryVote(room, now)) return;
  beginQuestion(room, now);
}

function timeoutSurvival(room, now) {
  const item = player(room, room.game.activePlayerId);
  item.lives -= 1; eliminateIfNeeded(room, item);
  const oldId = item.id;
  room.game.activePlayerId = nextAliveId(room, oldId) || oldId;
  setResult(room, { playerId: oldId, value: "未作答", correct: false, lostLife: true, reason: "timeout" }, now);
}

function timeoutBuzzAnswer(room, now) {
  const game = room.game;
  const item = player(room, game.answererId);
  game.attempts.push({ playerId: item.id, value: "未作答", correct: false, at: now });
  item.lives -= 1; eliminateIfNeeded(room, item);
  if (game.attempts.length >= 2 || alivePlayers(room).length <= 1) {
    const survivors = alivePlayers(room);
    if (survivors.length === 1) return finishGame(room, survivors[0].id, now);
    return setResult(room, { playerId: item.id, value: "未作答", correct: false, lostLife: true, attempts: [...game.attempts], reason: "timeout" }, now);
  }
  game.phase = "buzz-open"; game.answererId = null; game.mainDeadline = now + Math.max(0, game.mainRemaining); game.deadline = game.mainDeadline;
}

function tick(room, now = Date.now()) {
  const game = room.game;
  if (!game || game.status !== "playing") return false;
  game.reactions = game.reactions.filter((entry) => now - entry.at < 8000);
  if (game.mode === "buzzer" && game.phase === "buzz-open" && now < game.deadline) return true;
  if (now < game.deadline) return false;
  if (game.phase === "question") timeoutSurvival(room, now);
  else if (game.phase === "buzz-open") setResult(room, { playerId: null, value: "无人抢答", correct: false, reason: "no-buzz", attempts: [...game.attempts] }, now);
  else if (game.phase === "buzz-answer") timeoutBuzzAnswer(room, now);
  else if (game.phase === "result") finishResult(room, now);
  else if (game.phase === "category-vote") resolveCategoryVote(room, now);
  return true;
}

function visiblePrompt(game, now = Date.now()) {
  if (!game.question) return "";
  if (game.mode !== "buzzer" || !["buzz-open", "buzz-answer"].includes(game.phase)) return game.question.prompt;
  const elapsed = Math.max(0, now - game.questionStartedAt);
  const count = Math.max(1, Math.ceil([...game.question.prompt].length * Math.min(1, elapsed / (PROMPT_REVEAL_SECONDS * 1000))));
  return [...game.question.prompt].slice(0, count).join("");
}

function publicRoom(room, viewerId = null, now = Date.now()) {
  const source = room.game;
  const game = source ? {
    ...source,
    random: undefined,
    usedQuestionIds: undefined,
    usedKnowledgeKeys: undefined,
    question: source.question ? {
      id: source.question.id,
      category: source.question.category,
      kind: source.question.kind,
      prompt: visiblePrompt(source, now),
      fullyRevealed: source.mode !== "buzzer" || now - source.questionStartedAt >= PROMPT_REVEAL_SECONDS * 1000,
      answerLength: source.question.answerLength,
      imageUrl: source.question.imageUrl,
      options: source.mode === "survival" && source.phase === "question" && source.activePlayerId === viewerId ? source.question.options : [],
      answer: ["result", "finished"].includes(source.phase) ? source.question.answer : undefined,
      explanation: ["result", "finished"].includes(source.phase) ? source.question.explanation : undefined
    } : null
  } : null;
  return { code: room.code, hostId: room.hostId, settings: room.settings || defaultSettings(), players: room.players.map(({ token: _token, lastReactionAt: _lastReactionAt, lastBuzzElapsed: _lastBuzzElapsed, ...item }) => item), game };
}

module.exports = {
  SURVIVAL_SECONDS, BUZZ_WINDOW_SECONDS, PROMPT_REVEAL_SECONDS, BUZZ_ANSWER_SECONDS, RESULT_SECONDS, VOTE_SECONDS,
  STARTING_LIVES, SURVIVAL_SKIPS, BUZZ_WIN_CORRECT, CATEGORIES, defaultSettings, configure, createGame, submitSurvival,
  skipSurvival, buzz, submitBuzz, voteCategory, react, chooseChallenge, rerollChallenge, completeChallenge, tick, publicRoom,
  normalize, isCorrect, buzzScore, beginQuestion
};
