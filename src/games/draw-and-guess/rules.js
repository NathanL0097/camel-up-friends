const { WORDS } = require("./words");
const { TRUTHS, DARES } = require("./challenges");

const DRAW_SECONDS = 75;
const CHOOSE_SECONDS = 18;
const REVEAL_SECONDS = 8;
const ROUNDS_PER_PLAYER = 3;
const NO_GUESS_PENALTY = 60;
const COLORS = ["#172b2b", "#ffffff", "#ef5350", "#ff9f43", "#f5c842", "#39a96b", "#3498db", "#845ec2", "#e35d9f"];

function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function choiceSet(game) {
  let available = WORDS.filter((item) => !game.seenWords.includes(item.word));
  if (available.length < 3) {
    game.seenWords = [];
    available = WORDS;
  }
  const choices = shuffle(available, game.random).slice(0, 3).map((item) => ({ ...item }));
  game.seenWords.push(...choices.map((item) => item.word));
  return choices;
}

function currentArtistId(game) {
  return game.turnOrder[(game.turnNumber - 1) % game.turnOrder.length];
}

function beginChoosing(game, now) {
  game.phase = "choosing";
  game.artistId = currentArtistId(game);
  game.wordChoices = choiceSet(game);
  game.word = null;
  game.category = null;
  game.deadline = now + CHOOSE_SECONDS * 1000;
  game.startedAt = null;
  game.strokes = [];
  game.guesses = [];
  game.messages = [];
  game.reactions = [];
  game.turnScores = {};
  game.lastResult = null;
}

function createGame(players, random = Math.random, now = Date.now()) {
  players.forEach((player) => { player.score = 0; });
  const game = {
    status: "playing",
    phase: "choosing",
    turnNumber: 1,
    totalTurns: players.length * ROUNDS_PER_PLAYER,
    roundsPerPlayer: ROUNDS_PER_PLAYER,
    turnOrder: shuffle(players.map((player) => player.id), random),
    artistId: null,
    wordChoices: [],
    seenWords: [],
    word: null,
    category: null,
    deadline: null,
    startedAt: null,
    strokes: [],
    guesses: [],
    messages: [],
    reactions: [],
    turnScores: {},
    lastResult: null,
    ranking: [],
    finalChallenge: null,
    random
  };
  beginChoosing(game, now);
  return game;
}

function requirePlaying(room) {
  if (!room.game || room.game.status !== "playing") throw new Error("游戏尚未开始或已经结束");
}

function startDrawing(game, selected, now) {
  game.word = selected.word;
  game.category = selected.category;
  game.phase = "drawing";
  game.startedAt = now;
  game.deadline = now + DRAW_SECONDS * 1000;
}

function refreshWords(room, playerId, now = Date.now()) {
  requirePlaying(room);
  const game = room.game;
  if (game.phase !== "choosing") throw new Error("现在不是选词阶段");
  if (game.artistId !== playerId) throw new Error("只有本轮画家可以刷新词语");
  game.wordChoices = choiceSet(game);
  game.deadline = now + CHOOSE_SECONDS * 1000;
}

function selectWord(room, playerId, word, now = Date.now()) {
  requirePlaying(room);
  const game = room.game;
  if (game.phase !== "choosing") throw new Error("现在不是选词阶段");
  if (game.artistId !== playerId) throw new Error("只有本轮画家可以选词");
  const selected = game.wordChoices.find((item) => item.word === String(word || ""));
  if (!selected) throw new Error("请选择当前提供的词语");
  startDrawing(game, selected, now);
}

function normalizeGuess(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s，。！？、,.!?]/g, "");
}

function finishTurn(room, now) {
  const game = room.game;
  game.phase = "reveal";
  game.deadline = now + REVEAL_SECONDS * 1000;
  const artist = room.players.find((player) => player.id === game.artistId);
  const correctPlayers = game.guesses.filter((guess) => guess.correct).map((guess) => ({
    playerId: guess.playerId,
    playerName: guess.playerName,
    score: game.turnScores[guess.playerId] || 0
  }));
  let artistPenalty = 0;
  const penaltyWaived = correctPlayers.length === 0 && room.players.length === 2;
  if (correctPlayers.length === 0 && artist && !penaltyWaived) {
    artistPenalty = NO_GUESS_PENALTY;
    artist.score = (artist.score || 0) - artistPenalty;
    game.turnScores[game.artistId] = (game.turnScores[game.artistId] || 0) - artistPenalty;
  }
  game.lastResult = {
    word: game.word,
    category: game.category,
    artistId: game.artistId,
    artistName: artist?.name || "画家",
    correctPlayers,
    artistPenalty,
    penaltyWaived,
    turnScores: { ...game.turnScores }
  };
}

function submitGuess(room, playerId, text, now = Date.now()) {
  requirePlaying(room);
  const game = room.game;
  if (game.phase !== "drawing") throw new Error("现在不能猜词");
  if (game.artistId === playerId) throw new Error("画家不能参与猜词");
  const player = room.players.find((item) => item.id === playerId);
  if (!player) throw new Error("找不到玩家");
  if (game.guesses.some((guess) => guess.playerId === playerId && guess.correct)) throw new Error("你已经猜中了");
  const cleanText = String(text || "").trim().slice(0, 40);
  if (!cleanText) throw new Error("请输入答案");
  const correct = normalizeGuess(cleanText) === normalizeGuess(game.word);
  if (correct) {
    const secondsLeft = Math.max(0, Math.ceil((game.deadline - now) / 1000));
    const score = 100 + Math.min(DRAW_SECONDS, secondsLeft) * 2;
    player.score = (player.score || 0) + score;
    const artist = room.players.find((item) => item.id === game.artistId);
    if (artist) artist.score = (artist.score || 0) + 40;
    game.turnScores[playerId] = (game.turnScores[playerId] || 0) + score;
    game.turnScores[game.artistId] = (game.turnScores[game.artistId] || 0) + 40;
    game.guesses.push({ playerId, playerName: player.name, correct: true, at: now });
    game.messages.push({ id: `${now}-${playerId}`, playerId, playerName: player.name, correct: true, text: "猜中了！" });
    const eligible = room.players.filter((item) => item.id !== game.artistId && item.connected !== false);
    if (eligible.length && eligible.every((item) => game.guesses.some((guess) => guess.playerId === item.id && guess.correct))) finishTurn(room, now);
  } else {
    game.messages.push({ id: `${now}-${playerId}`, playerId, playerName: player.name, correct: false, text: cleanText });
    game.messages = game.messages.slice(-40);
  }
}

function reactToDrawing(room, playerId, type, now = Date.now()) {
  requirePlaying(room);
  const game = room.game;
  if (game.phase !== "reveal") throw new Error("只能在答案揭晓时评价画作");
  if (game.artistId === playerId) throw new Error("不能评价自己的画作");
  if (!room.players.some((player) => player.id === playerId)) throw new Error("找不到玩家");
  if (!["like", "egg"].includes(type)) throw new Error("请选择点赞或扔鸡蛋");
  game.reactions = game.reactions.filter((reaction) => reaction.playerId !== playerId);
  game.reactions.push({ playerId, type });
  const eligible = room.players.filter((player) => player.id !== game.artistId && player.connected !== false);
  if (eligible.every((player) => game.reactions.some((reaction) => reaction.playerId === player.id))) {
    game.deadline = Math.min(game.deadline, now + 1500);
  }
}

function addStroke(room, playerId, payload) {
  requirePlaying(room);
  const game = room.game;
  if (game.phase !== "drawing" || game.artistId !== playerId) throw new Error("现在只有画家可以作画");
  const strokeId = String(payload.strokeId || "").slice(0, 50);
  if (!/^[a-zA-Z0-9_-]+$/.test(strokeId)) throw new Error("画笔数据无效");
  const points = Array.isArray(payload.points) ? payload.points.slice(0, 32).map((point) => ({
    x: Math.max(0, Math.min(1, Number(point.x) || 0)),
    y: Math.max(0, Math.min(1, Number(point.y) || 0))
  })) : [];
  if (!points.length) return;
  let stroke = game.strokes.find((item) => item.id === strokeId && item.playerId === playerId);
  if (!stroke) {
    if (game.strokes.length >= 900) game.strokes.shift();
    stroke = {
      id: strokeId,
      playerId,
      color: COLORS.includes(payload.color) ? payload.color : COLORS[0],
      width: Math.max(2, Math.min(24, Number(payload.width) || 5)),
      tool: payload.tool === "eraser" ? "eraser" : "brush",
      points: []
    };
    game.strokes.push(stroke);
  }
  stroke.points.push(...points);
  if (stroke.points.length > 600) stroke.points = stroke.points.slice(-600);
}

function undoStroke(room, playerId) {
  requirePlaying(room);
  if (room.game.phase !== "drawing" || room.game.artistId !== playerId) throw new Error("现在只有画家可以撤销");
  const index = room.game.strokes.map((stroke) => stroke.playerId).lastIndexOf(playerId);
  if (index >= 0) room.game.strokes.splice(index, 1);
}

function clearCanvas(room, playerId) {
  requirePlaying(room);
  if (room.game.phase !== "drawing" || room.game.artistId !== playerId) throw new Error("现在只有画家可以清空画板");
  room.game.strokes = [];
}

function finishGame(room) {
  const game = room.game;
  game.status = "finished";
  game.phase = "finished";
  game.deadline = null;
  game.ranking = room.players.slice().sort((a, b) => (b.score || 0) - (a.score || 0)).map((player) => player.id);
}

function chooseFinalChallenge(room, playerId, type) {
  const game = room.game;
  if (!game || game.status !== "finished") throw new Error("游戏结束后才能选择趣味惩罚");
  if (game.ranking[0] !== playerId) throw new Error("只有本局冠军可以选择");
  if (game.finalChallenge) throw new Error("本局趣味惩罚已经选好了");
  if (!["truth", "dare"].includes(type)) throw new Error("请选择真心话或大冒险");
  const prompts = type === "truth" ? TRUTHS : DARES;
  const prompt = prompts[Math.floor(game.random() * prompts.length)];
  game.finalChallenge = { type, prompt, targetId: game.ranking[game.ranking.length - 1] };
}

function tick(room, now = Date.now()) {
  const game = room.game;
  if (!game || game.status !== "playing") return false;
  if (now < game.deadline) return false;
  if (game.phase === "choosing") {
    startDrawing(game, game.wordChoices[0], now);
    return true;
  }
  if (game.phase === "drawing") {
    finishTurn(room, now);
    return true;
  }
  if (game.phase === "reveal") {
    if (game.turnNumber >= game.totalTurns) finishGame(room);
    else {
      game.turnNumber += 1;
      beginChoosing(game, now);
    }
    return true;
  }
  return false;
}

function hintFor(game) {
  return game.word ? [...game.word].map((char) => (/\s/.test(char) ? " " : "＿")).join(" ") : "";
}

function publicRoom(room, viewerId = null) {
  const source = room.game;
  let game = null;
  if (source) {
    const isArtist = source.artistId === viewerId;
    const revealWord = isArtist || ["reveal", "finished"].includes(source.phase);
    game = {
      ...source,
      random: undefined,
      seenWords: undefined,
      wordChoices: isArtist && source.phase === "choosing" ? source.wordChoices : [],
      word: revealWord ? source.word : undefined,
      hint: source.phase === "drawing" && !isArtist ? hintFor(source) : undefined,
      isArtist
    };
  }
  const players = room.players.map(({ token: _token, ...player }) => player);
  return { code: room.code, hostId: room.hostId, players, game };
}

module.exports = {
  DRAW_SECONDS, CHOOSE_SECONDS, REVEAL_SECONDS, ROUNDS_PER_PLAYER, NO_GUESS_PENALTY, WORDS,
  createGame, currentArtistId, refreshWords, selectWord, submitGuess, reactToDrawing, addStroke, undoStroke, clearCanvas,
  chooseFinalChallenge, tick, publicRoom
};
