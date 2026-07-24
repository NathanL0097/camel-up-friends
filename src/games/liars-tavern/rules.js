const RANKS = ["A", "K", "Q"];
const TURN_MS = 30_000;
const SHOT_MS = 4_800;

const clone = (value) => JSON.parse(JSON.stringify(value));
const randomInt = (random, max) => Math.floor(random() * max);
function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(random, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function living(game) { return game.players.filter((player) => player.alive); }
function seat(game, playerId) {
  const player = game.players.find((item) => item.playerId === playerId);
  if (!player) throw new Error("你不在这张牌桌");
  return player;
}
function nextLivingIndex(game, fromIndex) {
  for (let step = 1; step <= game.players.length; step++) {
    const index = (fromIndex + step) % game.players.length;
    if (game.players[index].alive) return index;
  }
  return null;
}
function emit(game, type, title, detail = "") {
  game.eventSeq++;
  game.lastEvent = { seq: game.eventSeq, type, title, detail };
  game.log.unshift(detail || title);
  game.log = game.log.slice(0, 18);
}
function makeDeck(playerCount, random) {
  const copies = playerCount <= 4 ? 6 : 9;
  const jokers = playerCount <= 4 ? 2 : 3;
  const deck = [];
  for (const rank of RANKS) for (let i = 0; i < copies; i++) deck.push({ rank });
  for (let i = 0; i < jokers; i++) deck.push({ rank: "JOKER" });
  return shuffle(deck, random).map((card, index) => ({ ...card, uid: `c${index}-${Math.floor(random() * 1e8).toString(36)}` }));
}
function chooseStarter(game, preferredId) {
  const preferred = game.players.findIndex((player) => player.playerId === preferredId && player.alive);
  if (preferred >= 0) return preferred;
  const original = game.players.findIndex((player) => player.playerId === preferredId);
  return nextLivingIndex(game, original < 0 ? game.players.length - 1 : original);
}
function startRound(game, preferredStarterId = null, now = Date.now()) {
  const alive = living(game);
  if (alive.length <= 1) return finish(game);
  game.round++;
  game.phase = "play";
  game.tableRank = RANKS[randomInt(game.random, RANKS.length)];
  game.pileCount = 0;
  game.previousPlay = null;
  game.lastChallenge = null;
  game.mustChallenge = false;
  game.roulette = null;
  const deck = makeDeck(alive.length, game.random);
  const dealCount = alive.length * 5;
  let devilIndex = deck.slice(0, dealCount).findIndex((card) => card.rank === game.tableRank);
  if (devilIndex < 0) {
    const source = deck.findIndex((card, index) => index >= dealCount && card.rank === game.tableRank);
    if (source >= 0) [deck[0], deck[source]] = [deck[source], deck[0]];
    devilIndex = 0;
  }
  deck[devilIndex] = { ...deck[devilIndex], rank: "DEVIL" };
  for (const player of game.players) player.hand = [];
  for (let cardIndex = 0; cardIndex < dealCount; cardIndex++) alive[cardIndex % alive.length].hand.push(deck[cardIndex]);
  game.currentIndex = chooseStarter(game, preferredStarterId);
  if (game.currentIndex == null) game.currentIndex = game.players.findIndex((player) => player.alive);
  game.deadline = now + TURN_MS;
  emit(game, "round", `第 ${game.round} 轮 · ${game.tableRank} 牌局`, `${game.players[game.currentIndex].playerName}率先出牌。恶魔已经混入牌堆。`);
}
function createGame(players, _settings = {}, random = Math.random) {
  const game = {
    status: "playing",
    phase: "setup",
    round: 0,
    tableRank: null,
    players: players.map((player) => ({
      playerId: player.id,
      playerName: player.name,
      alive: true,
      hand: [],
      shots: 0,
      bulletPosition: 1 + randomInt(random, 6),
      lastAction: "等待开牌"
    })),
    currentIndex: 0,
    previousPlay: null,
    lastChallenge: null,
    mustChallenge: false,
    pileCount: 0,
    roulette: null,
    winnerId: null,
    eventSeq: 0,
    lastEvent: null,
    log: [],
    deadline: null,
    random
  };
  const first = game.players[randomInt(random, game.players.length)]?.playerId;
  startRound(game, first, Date.now());
  return game;
}
function active(game, playerId) {
  if (game.status !== "playing") throw new Error("本局已经结束");
  if (game.phase !== "play") throw new Error("正在进行左轮判定");
  const player = seat(game, playerId);
  if (!player.alive) throw new Error("你已经离开牌桌");
  if (game.players[game.currentIndex]?.playerId !== playerId) throw new Error("还没轮到你");
  return player;
}
function play(room, playerId, payload = {}, now = Date.now()) {
  const game = room.game;
  const player = active(game, playerId);
  if (game.mustChallenge) throw new Error("上家已经出完手牌，你必须质疑");
  const ids = Array.isArray(payload.cardIds) ? [...new Set(payload.cardIds.map(String))] : [];
  if (ids.length < 1 || ids.length > 3) throw new Error("每次必须选择1至3张牌");
  const cards = ids.map((id) => player.hand.find((card) => card.uid === id));
  if (cards.some((card) => !card)) throw new Error("选择的牌不在手中");
  if (cards.some((card) => card.rank === "DEVIL") && cards.length !== 1) throw new Error("恶魔牌只能单独打出");
  if (game.previousPlay) game.pileCount += game.previousPlay.cards.length;
  player.hand = player.hand.filter((card) => !ids.includes(card.uid));
  game.previousPlay = { playerId, count: cards.length, cards };
  player.lastAction = `盖下 ${cards.length} 张${game.tableRank}`;
  game.currentIndex = nextLivingIndex(game, game.currentIndex);
  game.mustChallenge = player.hand.length === 0;
  game.deadline = now + TURN_MS;
  emit(game, "play", `${player.playerName}盖下 ${cards.length} 张牌`, `他声称这些都是${game.tableRank}。${game.mustChallenge ? "手牌已经出空，下家必须质疑。" : ""}`);
}
function applyShot(game, playerId, now) {
  const player = seat(game, playerId);
  player.shots++;
  const bullet = player.shots === player.bulletPosition;
  player.lastAction = bullet ? "实弹击发" : `空膛 ${player.shots}/6`;
  if (bullet) {
    player.alive = false;
    player.hand = [];
  }
  game.roulette.current = { playerId, shot: player.shots, bullet };
  game.roulette.nextAt = now + SHOT_MS;
  emit(game, bullet ? "bullet" : "blank", bullet ? `${player.playerName}中弹` : `${player.playerName}幸运躲过`, bullet ? "实弹击发，他的座位陷入黑暗。" : `第${player.shots}次扣动扳机只是空膛。`);
}
function beginRoulette(game, victims, starterId, now) {
  game.phase = "roulette";
  game.deadline = null;
  game.roulette = {
    id: game.eventSeq + 1,
    remaining: [...victims],
    current: null,
    nextAt: now,
    starterId
  };
  const first = game.roulette.remaining.shift();
  applyShot(game, first, now);
}
function challenge(room, playerId, _payload = {}, now = Date.now()) {
  const game = room.game;
  const challenger = active(game, playerId);
  const play = game.previousPlay;
  if (!play) throw new Error("现在没有可以质疑的出牌");
  const accused = seat(game, play.playerId);
  const devil = play.cards.length === 1 && play.cards[0].rank === "DEVIL";
  const truthful = !devil && play.cards.every((card) => card.rank === game.tableRank || card.rank === "JOKER");
  let victims;
  if (devil) victims = living(game).filter((player) => player.playerId !== accused.playerId && player.hand.length > 0).map((player) => player.playerId);
  else victims = [truthful ? challenger.playerId : accused.playerId];
  game.lastChallenge = {
    challengerId: challenger.playerId,
    accusedId: accused.playerId,
    cards: clone(play.cards),
    truthful,
    devil
  };
  challenger.lastAction = `质疑 ${accused.playerName}`;
  emit(game, devil ? "devil" : truthful ? "truth" : "lie", devil ? "恶魔降临" : truthful ? "质疑失败" : "谎言被揭穿", devil ? `${accused.playerName}打出了恶魔牌，其他人都要接受惩罚。` : truthful ? `${accused.playerName}说的是实话，${challenger.playerName}接受左轮判定。` : `${accused.playerName}的谎言被抓住，他必须扣动扳机。`);
  beginRoulette(game, victims, victims[0] || challenger.playerId, now);
}
function finish(game) {
  const winner = living(game)[0];
  game.status = "finished";
  game.phase = "result";
  game.deadline = null;
  game.winnerId = winner?.playerId || null;
  emit(game, "winner", winner ? `${winner.playerName}活到最后` : "酒馆归于寂静", winner ? "最后一名仍坐在桌边的骗子赢得本局。" : "没有人从这张牌桌离开。");
  return true;
}
function tick(room, now = Date.now()) {
  const game = room.game;
  if (!game || game.status !== "playing") return false;
  if (game.phase === "roulette" && game.roulette && now >= game.roulette.nextAt) {
    if (game.roulette.remaining.length) {
      const next = game.roulette.remaining.shift();
      applyShot(game, next, now);
    } else if (living(game).length <= 1) finish(game);
    else startRound(game, game.roulette.starterId, now);
    return true;
  }
  if (game.phase === "play" && game.deadline && now >= game.deadline) {
    const current = game.players[game.currentIndex];
    if (game.previousPlay) challenge(room, current.playerId, {}, now);
    else {
      const card = current.hand.find((item) => item.rank !== "DEVIL") || current.hand[0];
      play(room, current.playerId, { cardIds: [card.uid] }, now);
    }
    return true;
  }
  return false;
}
function publicRoom(room, viewerId) {
  const base = { code: room.code, hostId: room.hostId, players: room.players.map(({ token, ...player }) => player), settings: room.settings, game: null };
  if (!room.game) return base;
  const source = room.game;
  const game = {
    status: source.status,
    phase: source.phase,
    round: source.round,
    tableRank: source.tableRank,
    currentIndex: source.currentIndex,
    previousPlay: source.previousPlay ? { playerId: source.previousPlay.playerId, count: source.previousPlay.count } : null,
    lastChallenge: clone(source.lastChallenge),
    mustChallenge: source.mustChallenge,
    pileCount: source.pileCount,
    roulette: clone(source.roulette),
    winnerId: source.winnerId,
    eventSeq: source.eventSeq,
    lastEvent: clone(source.lastEvent),
    log: [...source.log],
    deadline: source.deadline,
    seats: source.players.map((player) => ({
      playerId: player.playerId,
      playerName: player.playerName,
      alive: player.alive,
      handCount: player.hand.length,
      hand: player.playerId === viewerId ? clone(player.hand) : [],
      shots: player.shots,
      lastAction: player.lastAction
    }))
  };
  game.you = game.seats.find((player) => player.playerId === viewerId);
  game.legal = source.status === "playing" && source.phase === "play" && source.players[source.currentIndex]?.playerId === viewerId
    ? { canPlay: !source.mustChallenge, canChallenge: Boolean(source.previousPlay), mustChallenge: source.mustChallenge }
    : null;
  return { ...base, game };
}

module.exports = { createGame, play, challenge, tick, publicRoom, startRound, RANKS, TURN_MS, SHOT_MS };
