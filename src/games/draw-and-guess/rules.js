const DRAW_SECONDS = 75;
const CHOOSE_SECONDS = 18;
const REVEAL_SECONDS = 6;
const ROUNDS_PER_PLAYER = 2;
const COLORS = ["#172b2b", "#ffffff", "#ef5350", "#ff9f43", "#f5c842", "#39a96b", "#3498db", "#845ec2", "#e35d9f"];

const WORDS = [
  ["动物", "长颈鹿"], ["动物", "企鹅"], ["动物", "刺猬"], ["动物", "袋鼠"], ["动物", "海豚"], ["动物", "章鱼"], ["动物", "孔雀"], ["动物", "蜗牛"], ["动物", "松鼠"], ["动物", "斑马"],
  ["食物", "火锅"], ["食物", "冰淇淋"], ["食物", "汉堡包"], ["食物", "爆米花"], ["食物", "生日蛋糕"], ["食物", "珍珠奶茶"], ["食物", "煎鸡蛋"], ["食物", "西瓜"], ["食物", "甜甜圈"], ["食物", "方便面"],
  ["物品", "雨伞"], ["物品", "闹钟"], ["物品", "牙刷"], ["物品", "剪刀"], ["物品", "望远镜"], ["物品", "吹风机"], ["物品", "行李箱"], ["物品", "灭火器"], ["物品", "遥控器"], ["物品", "充电器"],
  ["地点", "游乐园"], ["地点", "电影院"], ["地点", "动物园"], ["地点", "图书馆"], ["地点", "飞机场"], ["地点", "火车站"], ["地点", "健身房"], ["地点", "海底世界"], ["地点", "便利店"], ["地点", "露营地"],
  ["职业", "消防员"], ["职业", "宇航员"], ["职业", "魔术师"], ["职业", "厨师"], ["职业", "摄影师"], ["职业", "牙医"], ["职业", "快递员"], ["职业", "潜水员"], ["职业", "理发师"], ["职业", "程序员"],
  ["动作", "打喷嚏"], ["动作", "梦游"], ["动作", "跳绳"], ["动作", "自拍"], ["动作", "钓鱼"], ["动作", "堆雪人"], ["动作", "坐过山车"], ["动作", "刷牙"], ["动作", "打篮球"], ["动作", "放风筝"],
  ["自然", "龙卷风"], ["自然", "火山爆发"], ["自然", "彩虹"], ["自然", "流星雨"], ["自然", "日落"], ["自然", "沙漠"], ["自然", "瀑布"], ["自然", "闪电"], ["自然", "雪山"], ["自然", "海浪"],
  ["娱乐", "电子游戏"], ["娱乐", "卡拉OK"], ["娱乐", "桌游"], ["娱乐", "摇滚乐队"], ["娱乐", "烟花"], ["娱乐", "摩天轮"], ["娱乐", "鬼屋"], ["娱乐", "滑雪"], ["娱乐", "冲浪"], ["娱乐", "露营"],
  ["奇思妙想", "外星人"], ["奇思妙想", "时间机器"], ["奇思妙想", "隐形人"], ["奇思妙想", "会飞的猪"], ["奇思妙想", "机器人"], ["奇思妙想", "独角兽"], ["奇思妙想", "藏宝图"], ["奇思妙想", "魔法扫帚"], ["奇思妙想", "恐龙"], ["奇思妙想", "超级英雄"]
].map(([category, word]) => ({ category, word }));

function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function choiceSet(game) {
  return shuffle(WORDS, game.random).slice(0, 3).map((item) => ({ ...item }));
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
  game.hintStage = 0;
  game.strokes = [];
  game.guesses = [];
  game.messages = [];
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
    word: null,
    category: null,
    deadline: null,
    startedAt: null,
    hintStage: 0,
    strokes: [],
    guesses: [],
    messages: [],
    turnScores: {},
    lastResult: null,
    ranking: [],
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
  game.hintStage = 0;
}

function selectWord(room, playerId, word, now = Date.now()) {
  requirePlaying(room);
  const game = room.game;
  if (game.phase !== "choosing") throw new Error("现在不是选词阶段");
  if (game.artistId !== playerId) throw new Error("只有本轮画家可以选词");
  const selected = game.wordChoices.find((item) => item.word === String(word || ""));
  if (!selected) throw new Error("请选择提供的词语");
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
  game.lastResult = {
    word: game.word,
    category: game.category,
    artistId: game.artistId,
    artistName: artist?.name || "画家",
    correctPlayers: game.guesses.filter((guess) => guess.correct).map((guess) => ({ playerId: guess.playerId, playerName: guess.playerName, score: game.turnScores[guess.playerId] || 0 })),
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

function tick(room, now = Date.now()) {
  const game = room.game;
  if (!game || game.status !== "playing") return false;
  if (game.phase === "drawing" && game.hintStage === 0 && now >= game.startedAt + DRAW_SECONDS * 500) {
    game.hintStage = 1;
    return true;
  }
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
  if (!game.word) return "";
  let revealed = false;
  return [...game.word].map((char) => {
    if (/\s/.test(char)) return " ";
    if (game.hintStage > 0 && !revealed) { revealed = true; return char; }
    return "＿";
  }).join(" ");
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
  DRAW_SECONDS, CHOOSE_SECONDS, REVEAL_SECONDS, ROUNDS_PER_PLAYER, WORDS,
  createGame, currentArtistId, selectWord, submitGuess, addStroke, undoStroke, clearCanvas, tick, publicRoom
};
