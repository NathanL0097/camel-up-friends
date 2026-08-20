const { CHARACTERS, TRIAL_COUNTS, makeDeck } = require("./data");

const RED = new Set(["accusation", "evidence", "witness"]);
const BLUE = new Set(["asylum", "matchmaker", "piety", "stocks"]);
const BLACK = new Set(["conspiracy", "night"]);
const clone = (value) => JSON.parse(JSON.stringify(value));

function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function seat(game, playerId) {
  const found = game.seats.find((item) => item.playerId === playerId);
  if (!found) throw new Error("你不在女巫镇中");
  return found;
}
function living(game) { return game.seats.filter((item) => item.alive); }
function nameOf(game, playerId) { return seat(game, playerId).playerName; }
function currentSeat(game) { return game.seats[game.currentIndex]; }
function nextLivingIndex(game, fromIndex) {
  for (let step = 1; step <= game.seats.length; step += 1) {
    const index = (fromIndex + step) % game.seats.length;
    if (game.seats[index].alive) return index;
  }
  return null;
}
function emit(game, type, title, detail = "", duration = 3600, extra = {}) {
  game.eventSeq += 1;
  game.lastEvent = { seq: game.eventSeq, type, title, detail, duration, ...extra };
  game.log.unshift(detail ? `${title}：${detail}` : title);
  game.log = game.log.slice(0, 24);
}
function character(game, playerId) {
  const owner = seat(game, playerId);
  if (owner.character.id !== "martha") return owner.character;
  let index = game.seats.findIndex((item) => item.playerId === playerId);
  for (let step = 1; step < game.seats.length; step += 1) {
    index = (index + 1) % game.seats.length;
    const candidate = game.seats[index];
    if (candidate.alive && candidate.character.id !== "martha") return candidate.character;
  }
  return owner.character;
}
function isCharacter(game, playerId, id) { return character(game, playerId)?.id === id; }
function hiddenTrials(player) { return player.tryals.filter((item) => !item.revealed); }
function currentWitch(player) { return hiddenTrials(player).some((item) => item.kind === "witch"); }
function currentConstable(player) { return hiddenTrials(player).some((item) => item.kind === "constable"); }
function accusationValue(game, player) {
  return player.front.filter((card) => RED.has(card.kind)).reduce((total, card) => total + (card.kind === "evidence" && isCharacter(game, player.playerId, "cotton") ? 1 : card.accusation), 0);
}
function threshold(game, playerId) { return isCharacter(game, playerId, "george") ? 8 : 7; }
function canTarget(game, actorId, targetId) {
  return actorId !== targetId && game.seats.some((item) => item.playerId === targetId && item.alive);
}

function buildTryals(playerCount, random) {
  const counts = TRIAL_COUNTS[playerCount];
  if (!counts) throw new Error("女巫镇标准局需要4至12名玩家");
  return shuffle([
    ...Array.from({ length: counts.innocent }, (_, index) => ({ id: `innocent-${index + 1}`, kind: "innocent", revealed: false })),
    ...Array.from({ length: counts.witch }, (_, index) => ({ id: `witch-${index + 1}`, kind: "witch", revealed: false })),
    { id: "constable-1", kind: "constable", revealed: false }
  ], random);
}

function prepareDeck(playerCount, random) {
  const all = makeDeck();
  const conspiracy = all.find((card) => card.kind === "conspiracy");
  const night = all.find((card) => card.kind === "night");
  const ordinary = shuffle(all.filter((card) => !BLACK.has(card.kind)), random);
  const hands = Array.from({ length: playerCount }, () => []);
  let index = 0;
  while (hands.some((hand) => hand.length < 3)) {
    const card = ordinary.shift();
    hands[index % playerCount].push(card);
    index += 1;
  }
  ordinary.splice(Math.floor(random() * (ordinary.length + 1)), 0, conspiracy);
  const bottomHalfStart = Math.floor(ordinary.length / 2);
  ordinary.splice(bottomHalfStart + Math.floor(random() * (ordinary.length - bottomHalfStart + 1)), 0, night);
  return { deck: ordinary, hands };
}

function createGame(players, _settings = {}, random = Math.random) {
  if (players.length < 4 || players.length > 12) throw new Error("女巫镇标准局需要4至12名玩家");
  const trials = buildTryals(players.length, random);
  const perPlayer = trials.length / players.length;
  const characters = shuffle(CHARACTERS, random).slice(0, players.length);
  const prepared = prepareDeck(players.length, random);
  const seats = players.map((player, index) => {
    const tryals = trials.slice(index * perPlayer, (index + 1) * perPlayer);
    return {
      playerId: player.id, playerName: player.name, alive: true, character: clone(characters[index]),
      hand: prepared.hands[index], tryals, everWitch: tryals.some((item) => item.kind === "witch"),
      front: [], blackCat: false, gavel: false, characterUses: characters[index].id === "samuel" ? 2 : 1,
      conspiracyPick: null, nightChoice: null, lastAction: "在晨雾中醒来"
    };
  });
  const witches = seats.filter((item) => item.everWitch);
  const leader = witches[0];
  const game = {
    status: "playing", phase: "dawn", round: 0, seats, currentIndex: seats.findIndex((item) => item.playerId === leader.playerId),
    actorId: leader.playerId, deck: prepared.deck, discard: [], pendingDraw: 0, pendingTrial: null,
    conspiracy: null, night: null, winner: null, eventSeq: 0, lastEvent: null, log: [], random,
    turnMode: null, eventAcks: [], startedAt: Date.now()
  };
  emit(game, "dawn", "黎明前的秘密集会", `女巫已经互相认出。由一名女巫把黑猫交给镇上一人。`, 5200);
  return game;
}

function requirePlaying(room, playerId) {
  const game = room.game;
  if (!game || game.status !== "playing") throw new Error("本局已经结束");
  const player = seat(game, playerId);
  if (!player.alive) throw new Error("你已经出局，只能旁观");
  return { game, player };
}
function requireTurn(game, playerId) {
  if (game.phase !== "day") throw new Error("现在不是白天行动阶段");
  if (game.actorId !== playerId) throw new Error("还没轮到你行动");
}

function checkVictory(game) {
  const witchTrials = game.seats.flatMap((player) => player.tryals).filter((trial) => trial.kind === "witch");
  if (witchTrials.every((trial) => trial.revealed)) {
    game.status = "finished"; game.phase = "result"; game.actorId = null;
    game.winner = { side: "town", title: "镇民洗清了塞勒姆", detail: "所有女巫审判牌都已公开。" };
    emit(game, "town-win", "镇民获胜", game.winner.detail, 6000);
    return true;
  }
  const alive = living(game);
  if (alive.length && alive.every((player) => player.everWitch)) {
    game.status = "finished"; game.phase = "result"; game.actorId = null;
    game.winner = { side: "witch", title: "女巫接管了小镇", detail: "所有仍存活的玩家都已加入女巫阵营。" };
    emit(game, "witch-win", "女巫获胜", game.winner.detail, 6000);
    return true;
  }
  return false;
}

function firstJohn(game, exceptId) {
  return living(game).find((item) => item.playerId !== exceptId && isCharacter(game, item.playerId, "john"));
}
function eliminate(game, playerId, reason, linked = false) {
  const player = seat(game, playerId);
  if (!player.alive) return;
  const hadMatchmaker = player.front.some((card) => card.kind === "matchmaker") && !isCharacter(game, playerId, "mary");
  const john = firstJohn(game, playerId);
  if (john) {
    john.hand.push(...player.hand);
    john.front.push(...player.front.filter((card) => BLUE.has(card.kind)));
  } else {
    game.discard.push(...player.hand, ...player.front);
  }
  player.hand = [];
  player.front = [];
  player.alive = false;
  player.blackCat = false;
  player.gavel = false;
  player.tryals.forEach((trial) => { trial.revealed = true; });
  player.lastAction = `出局：${reason}`;
  emit(game, "eliminated", `${player.playerName}离开了小镇`, `${reason}。他可以留下三句话。`, 5000, { playerId });

  if (!linked && hadMatchmaker) {
    const matched = living(game).filter((candidate) => candidate.front.some((card) => card.kind === "matchmaker") && !isCharacter(game, candidate.playerId, "mary"));
    if (matched.length === 1) eliminate(game, matched[0].playerId, "媒人的命运纽带断裂", true);
  }
}

function rewardRebecca(game, revealedPlayerId, reason) {
  if (reason === "confess" || reason === "death") return;
  for (const player of living(game)) if (player.playerId !== revealedPlayerId && isCharacter(game, player.playerId, "rebecca")) {
    const card = game.deck.shift();
    if (card && !BLACK.has(card.kind)) player.hand.push(card);
    else if (card) game.deck.unshift(card);
  }
}

function performReveal(game, targetId, trialId, reason = "accusation") {
  const target = seat(game, targetId);
  const trial = target.tryals.find((item) => item.id === trialId && !item.revealed);
  if (!trial) throw new Error("这张审判牌已经公开或不存在");
  trial.revealed = true;
  if (trial.kind === "witch") target.everWitch = true;
  target.front = target.front.filter((card) => !RED.has(card.kind));
  rewardRebecca(game, targetId, reason);
  const labels = { witch: "女巫", constable: "警长", innocent: "不是女巫" };
  emit(game, "trial-reveal", `${target.playerName}的审判牌被揭开`, `结果是“${labels[trial.kind]}”。`, 5000, { playerId: targetId, trial: trial.kind });

  const otherHiddenWitch = hiddenTrials(target).some((item) => item.kind === "witch");
  if (trial.kind === "witch" && !otherHiddenWitch) eliminate(game, targetId, "女巫身份被审判揭露");
  else if (!hiddenTrials(target).length) eliminate(game, targetId, "所有审判牌都已公开");
  return trial;
}

function beginDay(game, starterId) {
  let starterIndex = game.seats.findIndex((item) => item.playerId === starterId && item.alive);
  if (starterIndex < 0) starterIndex = nextLivingIndex(game, Math.max(0, game.currentIndex - 1));
  game.currentIndex = starterIndex;
  game.actorId = game.seats[starterIndex]?.playerId || null;
  game.phase = "day";
  game.turnMode = null;
  game.round += 1;
  game.eventAcks = [];
  skipStocks(game);
}
function skipStocks(game) {
  let guard = 0;
  while (game.status === "playing" && guard < game.seats.length * 3) {
    const active = currentSeat(game);
    const stock = active?.front.find((card) => card.kind === "stocks");
    if (!stock) return;
    active.front = active.front.filter((card) => card.id !== stock.id);
    game.discard.push(stock);
    active.lastAction = "被枷锁困住，跳过回合";
    emit(game, "stocks", `${active.playerName}被迫跳过`, "一张枷锁牌已经移除。", 3200);
    game.currentIndex = nextLivingIndex(game, game.currentIndex);
    game.actorId = currentSeat(game)?.playerId || null;
    guard += 1;
  }
}

function chooseBlackCat(room, playerId, payload = {}) {
  const { game } = requirePlaying(room, playerId);
  if (game.phase !== "dawn" || game.actorId !== playerId) throw new Error("只有主持黎明的女巫可以放置黑猫");
  const target = seat(game, payload.targetId);
  if (!target.alive || isCharacter(game, target.playerId, "mary")) throw new Error("黑猫不能给这名玩家");
  target.blackCat = true;
  target.lastAction = "黑猫停在了门前";
  emit(game, "black-cat", "黑猫选择了第一位主人", `${target.playerName}听见窗外传来一声猫叫。`, 4600, { playerId: target.playerId });
  beginDay(game, target.playerId);
}

function drawOne(game, player) {
  if (!game.deck.length) reshuffleNight(game);
  const card = game.deck.shift();
  if (!card) throw new Error("牌堆暂时无法继续抽取");
  if (card.kind === "conspiracy") {
    game.discard.push(card);
    beginConspiracy(game, player.playerId);
    return "special";
  }
  if (card.kind === "night") {
    beginNight(game, player.playerId, card);
    return "special";
  }
  player.hand.push(card);
  return card;
}
function drawCards(room, playerId) {
  const { game, player } = requirePlaying(room, playerId);
  requireTurn(game, playerId);
  if (game.turnMode) throw new Error("本回合已经选择了行动方式");
  game.turnMode = "draw";
  const drawn = [];
  for (let count = 0; count < 2; count += 1) {
    const result = drawOne(game, player);
    if (result === "special") { game.pendingDraw = 1 - count; break; }
    drawn.push(result);
  }
  if (drawn.length === 2 && isCharacter(game, playerId, "giles") && drawn.every((card) => card.kind === "accusation")) {
    const bonus = drawOne(game, player);
    if (bonus !== "special") drawn.push(bonus);
  }
  player.lastAction = `抽取${drawn.length}张牌`;
  if (game.phase === "day") {
    emit(game, "draw", `${player.playerName}从档案堆抽牌`, `本回合抽取${drawn.length}张，内容只有本人可见。`, 3000, { playerId });
    advanceTurn(game);
  }
}

function beginTrial(game, accuserId, targetId) {
  const accuser = seat(game, accuserId);
  if (isCharacter(game, accuserId, "abigail")) {
    const removed = accuser.front.filter((card) => RED.has(card.kind));
    accuser.front = accuser.front.filter((card) => !RED.has(card.kind));
    game.discard.push(...removed);
  }
  if (isCharacter(game, accuserId, "ann")) {
    for (let index = 0; index < 2; index += 1) {
      const card = game.deck.shift();
      if (card && !BLACK.has(card.kind)) accuser.hand.push(card);
      else if (card) game.deck.unshift(card);
    }
  }
  game.phase = "trial";
  game.actorId = accuserId;
  game.pendingTrial = { accuserId, targetId };
  emit(game, "trial", `${nameOf(game, targetId)}被送上审判席`, `${nameOf(game, accuserId)}必须选择一张尚未公开的审判牌。`, 4200, { playerId: targetId });
}

function playCard(room, playerId, payload = {}) {
  const { game, player } = requirePlaying(room, playerId);
  requireTurn(game, playerId);
  if (game.turnMode === "draw") throw new Error("本回合已经选择抽牌，不能再出牌");
  game.turnMode = "play";
  const card = player.hand.find((item) => item.id === payload.cardId);
  if (!card || BLACK.has(card.kind)) throw new Error("这张牌不在你的可用手牌中");
  const target = seat(game, payload.targetId);
  if (!canTarget(game, playerId, target.playerId)) throw new Error("牌只能打给另一名存活玩家");
  const second = payload.secondTargetId ? seat(game, payload.secondTargetId) : null;
  if ((card.kind === "robbery" || card.kind === "scapegoat") && (!second || !second.alive || second.playerId === target.playerId || second.playerId === playerId)) throw new Error("此牌需要选择两名不同的其他玩家");
  player.hand = player.hand.filter((item) => item.id !== card.id);

  if (RED.has(card.kind) || (card.kind === "alibi" && payload.asWitness && isCharacter(game, playerId, "will"))) {
    if (target.front.some((item) => item.kind === "piety")) {
      player.hand.push(card); throw new Error("虔诚保护着这名玩家，不能对其指控");
    }
    const played = payload.asWitness ? { ...card, kind: "witness", label: "脱罪证词 · 反作证", color: "red", accusation: 7, originalKind: "alibi" } : card;
    target.front.push(played);
    player.lastAction = `对${target.playerName}打出${played.label}`;
    emit(game, "accusation", `${player.playerName}提出${played.label}`, `${target.playerName}当前累计${accusationValue(game, target)}点指控。`, 3200, { playerId: target.playerId, value: played.accusation });
    const total = accusationValue(game, target);
    if ((isCharacter(game, playerId, "thomas") && total === 6) || total >= threshold(game, target.playerId)) beginTrial(game, playerId, target.playerId);
    return;
  }

  if (card.kind === "alibi") {
    const removed = target.front.filter((item) => RED.has(item.kind)).slice(-3);
    const ids = new Set(removed.map((item) => item.id));
    target.front = target.front.filter((item) => !ids.has(item.id));
    game.discard.push(card, ...removed);
  } else if (card.kind === "arson") {
    game.discard.push(card);
    if (!isCharacter(game, target.playerId, "sarah")) { game.discard.push(...target.hand); target.hand = []; }
  } else if (card.kind === "curse") {
    const blue = target.front.find((item) => item.id === payload.blueCardId && BLUE.has(item.kind)) || target.front.find((item) => BLUE.has(item.kind));
    if (!blue) { player.hand.push(card); throw new Error("目标面前没有可被诅咒移除的蓝牌"); }
    target.front = target.front.filter((item) => item.id !== blue.id); game.discard.push(card, blue);
    if (blue.kind === "piety" && accusationValue(game, target) >= threshold(game, target.playerId)) beginTrial(game, playerId, target.playerId);
  } else if (card.kind === "robbery") {
    game.discard.push(card);
    if (!isCharacter(game, target.playerId, "sarah")) { second.hand.push(...target.hand); target.hand = []; }
  } else if (card.kind === "scapegoat") {
    const moved = [...target.front]; target.front = []; second.front.push(...moved); game.discard.push(card);
    if (accusationValue(game, second) >= threshold(game, second.playerId)) beginTrial(game, playerId, second.playerId);
  } else if (BLUE.has(card.kind)) {
    if (card.kind === "matchmaker" && isCharacter(game, target.playerId, "mary")) game.discard.push(card);
    else target.front.push(card);
  } else game.discard.push(card);

  player.lastAction = `对${target.playerName}打出${card.label}`;
  if (game.phase === "day") emit(game, "card-play", `${player.playerName}打出“${card.label}”`, `${target.playerName}受到牌面效果。`, 3000, { playerId: target.playerId, card: card.kind });
}

function endTurn(room, playerId) {
  const { game } = requirePlaying(room, playerId);
  requireTurn(game, playerId);
  if (game.turnMode !== "play") throw new Error("请先打出至少一张牌，或选择抽2张");
  advanceTurn(game);
}
function advanceTurn(game) {
  if (checkVictory(game)) return;
  game.currentIndex = nextLivingIndex(game, game.currentIndex);
  game.actorId = currentSeat(game)?.playerId || null;
  game.turnMode = null;
  game.pendingTrial = null;
  skipStocks(game);
}

function revealTrial(room, playerId, payload = {}) {
  const { game } = requirePlaying(room, playerId);
  if (game.phase === "trial") {
    if (game.actorId !== playerId || game.pendingTrial?.accuserId !== playerId) throw new Error("只有触发审判的玩家可以选择");
    const targetId = game.pendingTrial.targetId;
    performReveal(game, targetId, payload.trialId, "accusation");
    const formerIndex = game.seats.findIndex((item) => item.playerId === playerId);
    game.pendingTrial = null;
    if (checkVictory(game)) return;
    game.currentIndex = formerIndex;
    game.phase = "day"; game.actorId = playerId;
    if (!seat(game, playerId).alive) advanceTurn(game);
    return;
  }
  if (game.phase === "conspiracy-cat") {
    if (game.actorId !== playerId) throw new Error("只有抽到阴谋牌的玩家可以揭示黑猫主人的审判牌");
    const cat = game.seats.find((item) => item.blackCat && item.alive && !isCharacter(game, item.playerId, "mary"));
    if (!cat) return beginConspiracyPassing(game);
    performReveal(game, cat.playerId, payload.trialId, "black-cat");
    if (checkVictory(game)) return;
    beginConspiracyPassing(game);
    return;
  }
  throw new Error("当前没有需要揭示的审判牌");
}

function beginConspiracy(game, drawerId) {
  game.phase = "conspiracy-cat";
  game.actorId = drawerId;
  game.conspiracy = { drawerId, picks: {}, acknowledged: [] };
  const cat = game.seats.find((item) => item.blackCat && item.alive && !isCharacter(game, item.playerId, "mary"));
  emit(game, "conspiracy", "阴谋在小镇蔓延", cat ? `${nameOf(game, drawerId)}先揭示黑猫主人${cat.playerName}的一张审判牌。` : "黑猫没有有效主人，直接开始交换审判牌。", 5200);
  if (!cat) beginConspiracyPassing(game);
}
function beginConspiracyPassing(game) {
  game.phase = "conspiracy-pass";
  game.actorId = null;
  game.seats.forEach((item) => { item.conspiracyPick = null; });
  emit(game, "conspiracy-pass", "所有人同时伸手", "请从左手边存活玩家那里选择1张隐藏审判牌。选择提交前只有你能看到。", 4600);
}
function leftLiving(game, playerId) {
  const index = game.seats.findIndex((item) => item.playerId === playerId);
  return game.seats[nextLivingIndex(game, index)];
}
function conspiracyPick(room, playerId, payload = {}) {
  const { game, player } = requirePlaying(room, playerId);
  if (game.phase !== "conspiracy-pass") throw new Error("现在不是阴谋换牌阶段");
  const left = leftLiving(game, playerId);
  const trial = hiddenTrials(left).find((item) => item.id === payload.trialId);
  if (!trial) throw new Error("只能选择左邻的一张隐藏审判牌");
  player.conspiracyPick = trial.id;
  game.conspiracy.picks[playerId] = { fromId: left.playerId, trialId: trial.id };
  if (living(game).every((item) => game.conspiracy.picks[item.playerId])) resolveConspiracy(game);
}
function resolveConspiracy(game) {
  const transfers = living(game).map((receiver) => ({ receiver, ...game.conspiracy.picks[receiver.playerId] }));
  const moved = [];
  for (const transfer of transfers) {
    const source = seat(game, transfer.fromId);
    const index = source.tryals.findIndex((item) => item.id === transfer.trialId && !item.revealed);
    if (index < 0) continue;
    moved.push({ receiver: transfer.receiver, trial: source.tryals.splice(index, 1)[0] });
  }
  for (const transfer of moved) {
    transfer.receiver.tryals.push(transfer.trial);
    transfer.receiver.tryals = shuffle(transfer.receiver.tryals, game.random);
    if (transfer.trial.kind === "witch") transfer.receiver.everWitch = true;
  }
  game.phase = "conspiracy-result";
  game.actorId = null;
  game.conspiracy.acknowledged = [];
  game.eventAcks = [];
  emit(game, "conspiracy-result", "审判牌已经易手", "查看自己的新审判牌；所有存活玩家确认后继续白天。", 5200);
  checkVictory(game);
}

function beginNight(game, drawerId, nightCard) {
  game.phase = "night-choice";
  game.actorId = null;
  game.night = { drawerId, card: nightCard, targetVotes: {}, protectionId: null, protectSubmitted: false, confession: {}, targetId: null };
  game.seats.forEach((item) => { item.gavel = false; item.nightChoice = null; });
  emit(game, "night", "夜幕降临", "女巫在暗处选择目标；警长同时把保护槌交给另一名玩家。", 5500);
}
function witchLeader(game) { return living(game).find((item) => item.everWitch); }
function chooseNightTarget(room, playerId, payload = {}) {
  const { game, player } = requirePlaying(room, playerId);
  if (game.phase !== "night-choice" || !player.everWitch) throw new Error("只有女巫能在夜里选择目标");
  const target = seat(game, payload.targetId);
  if (!target.alive) throw new Error("夜袭目标必须仍然存活");
  game.night.targetVotes[playerId] = target.playerId;
  player.nightChoice = target.playerId;
  maybeBeginConfession(game);
}
function chooseNightProtection(room, playerId, payload = {}) {
  const { game, player } = requirePlaying(room, playerId);
  if (game.phase !== "night-choice" || !currentConstable(player)) throw new Error("只有当前警长能交出保护槌");
  const target = seat(game, payload.targetId);
  if (!target.alive || target.playerId === playerId) throw new Error("警长只能保护另一名存活玩家");
  game.night.protectionId = target.playerId;
  game.night.protectSubmitted = true;
  target.gavel = true;
  maybeBeginConfession(game);
}
function maybeBeginConfession(game) {
  const witches = living(game).filter((item) => item.everWitch);
  const constable = living(game).find(currentConstable);
  if (!witches.every((item) => game.night.targetVotes[item.playerId])) return;
  if (constable && !game.night.protectSubmitted) return;
  const counts = new Map();
  for (const targetId of Object.values(game.night.targetVotes)) counts.set(targetId, (counts.get(targetId) || 0) + 1);
  const leaderVote = game.night.targetVotes[witchLeader(game)?.playerId];
  game.night.targetId = [...counts.entries()].sort((a, b) => b[1] - a[1] || Number(b[0] !== leaderVote) - Number(a[0] !== leaderVote))[0]?.[0] || leaderVote;
  game.phase = "night-confession";
  game.actorId = null;
  emit(game, "confession", "教堂钟声响起", `${game.night.protectionId ? `${nameOf(game, game.night.protectionId)}获得警长保护。` : "警长已无法行动。"} 所有人现在秘密选择是否忏悔。`, 5200, { protectedId: game.night.protectionId });
}
function nightConfess(room, playerId, payload = {}) {
  const { game, player } = requirePlaying(room, playerId);
  if (game.phase !== "night-confession") throw new Error("现在不是忏悔阶段");
  if (game.night.confession[playerId]) throw new Error("你已经提交夜晚决定");
  if (payload.free && isCharacter(game, playerId, "william") && player.characterUses > 0) {
    player.characterUses -= 1;
    game.night.confession[playerId] = { confessed: true, free: true };
  } else {
    const trial = hiddenTrials(player).find((item) => item.id === payload.trialId);
    if (!trial) throw new Error("请选择自己的一张隐藏审判牌来忏悔");
    performReveal(game, playerId, trial.id, "confess");
    game.night.confession[playerId] = { confessed: true, trialId: trial.id };
  }
  maybeResolveNight(game);
}
function nightPass(room, playerId) {
  const { game } = requirePlaying(room, playerId);
  if (game.phase !== "night-confession") throw new Error("现在不是忏悔阶段");
  if (game.night.confession[playerId]) throw new Error("你已经提交夜晚决定");
  game.night.confession[playerId] = { confessed: false };
  maybeResolveNight(game);
}
function maybeResolveNight(game) {
  if (game.status !== "playing" || game.phase !== "night-confession") return;
  if (!living(game).every((item) => game.night.confession[item.playerId])) return;
  const target = seat(game, game.night.targetId);
  const protectedByGavel = game.night.protectionId === target.playerId;
  const confessed = Boolean(game.night.confession[target.playerId]?.confessed);
  const asylum = target.front.some((card) => card.kind === "asylum");
  if (!protectedByGavel && !confessed && !asylum) eliminate(game, target.playerId, "夜袭成功");
  const detail = protectedByGavel ? `${target.playerName}被警长保护。` : confessed ? `${target.playerName}因忏悔而免于夜袭。` : asylum ? `${target.playerName}躲进庇护所。` : `${target.playerName}没有躲过这次夜袭。`;
  emit(game, "night-result", "清晨揭晓夜袭目标", detail, 6000, { targetId: target.playerId, survived: target.alive });
  if (checkVictory(game)) return;
  reshuffleNight(game, game.night.card);
  game.phase = "night-result";
  game.actorId = null;
  game.eventAcks = [];
}
function reshuffleNight(game, nightCard = null) {
  const night = nightCard || makeDeck().find((card) => card.kind === "night");
  const cards = shuffle([...game.deck.filter((card) => card.kind !== "night"), ...game.discard.filter((card) => card.kind !== "night")], game.random);
  game.discard = [];
  const bottomHalfStart = Math.floor(cards.length / 2);
  cards.splice(bottomHalfStart + Math.floor(game.random() * (cards.length - bottomHalfStart + 1)), 0, night);
  game.deck = cards;
}

function resumeAfterSpecial(game) {
  const drawerId = game.conspiracy?.drawerId || game.night?.drawerId;
  game.conspiracy = null;
  game.night = null;
  if (game.pendingDraw > 0 && seat(game, drawerId).alive) {
    const drawer = seat(game, drawerId);
    const remaining = game.pendingDraw; game.pendingDraw = 0;
    for (let count = 0; count < remaining; count += 1) {
      const result = drawOne(game, drawer);
      if (result === "special") return;
    }
  }
  game.phase = "day";
  game.currentIndex = game.seats.findIndex((item) => item.playerId === drawerId);
  game.actorId = drawerId;
  advanceTurn(game);
}

function ackEvent(room, playerId) {
  const { game } = requirePlaying(room, playerId);
  if (!game.eventAcks.includes(playerId)) game.eventAcks.push(playerId);
  if (game.phase === "conspiracy-result" && living(game).every((item) => game.eventAcks.includes(item.playerId))) resumeAfterSpecial(game);
  else if (game.phase === "night-result" && living(game).every((item) => game.eventAcks.includes(item.playerId))) resumeAfterSpecial(game);
}

function useCharacter(room, playerId, payload = {}) {
  const { game, player } = requirePlaying(room, playerId);
  requireTurn(game, playerId);
  const role = character(game, playerId);
  if (role.id !== "tituba") throw new Error("你的角色没有可在白天主动发动的这项能力");
  if (player.characterUses < 1 || game.turnMode) throw new Error("该能力已经使用，或本回合已经行动");
  player.characterUses -= 1;
  game.phase = "reorder-top";
  game.actorId = playerId;
  game.topPreview = game.deck.slice(0, 5).map((card) => card.id);
  emit(game, "tituba", `${player.playerName}凝视牌堆`, "她正在秘密查看牌堆顶部5张牌。", 3400);
}
function reorderTop(room, playerId, payload = {}) {
  const { game } = requirePlaying(room, playerId);
  if (game.phase !== "reorder-top" || game.actorId !== playerId) throw new Error("现在不能调整牌堆");
  const ids = Array.isArray(payload.cardIds) ? payload.cardIds.map(String) : [];
  if (ids.length !== game.topPreview.length || new Set(ids).size !== ids.length || ids.some((id) => !game.topPreview.includes(id))) throw new Error("必须把看到的5张牌各排列一次");
  const byId = new Map(game.deck.slice(0, 5).map((card) => [card.id, card]));
  game.deck.splice(0, 5, ...ids.map((id) => byId.get(id)));
  delete game.topPreview;
  game.phase = "day";
  game.turnMode = null;
  emit(game, "reordered", "牌堆顺序悄然改变", `${nameOf(game, playerId)}已经完成秘密排列，仍可选择本回合行动。`, 3000);
}
function drawDiscard(room, playerId, payload = {}) {
  const { game, player } = requirePlaying(room, playerId);
  requireTurn(game, playerId);
  if (!isCharacter(game, playerId, "samuel") || player.characterUses < 1 || game.turnMode) throw new Error("你现在不能从弃牌堆取牌");
  const ids = Array.isArray(payload.cardIds) ? [...new Set(payload.cardIds.map(String))].slice(0, 2) : [];
  const cards = ids.map((id) => game.discard.find((card) => card.id === id && !BLACK.has(card.kind))).filter(Boolean);
  if (!cards.length) throw new Error("请选择弃牌堆中1至2张普通牌");
  const selected = new Set(cards.map((card) => card.id));
  game.discard = game.discard.filter((card) => !selected.has(card.id));
  player.hand.push(...cards); player.characterUses -= 1; player.lastAction = `从旧案中取回${cards.length}张牌`;
  emit(game, "discard-draw", `${player.playerName}旧案重提`, `从弃牌堆取回${cards.length}张牌并结束回合。`, 3200);
  advanceTurn(game);
}

function tick() { return false; }

function publicRoom(room, viewerId) {
  const base = { code: room.code, hostId: room.hostId, players: room.players.map(({ token, ...player }) => player), settings: room.settings, game: null };
  if (!room.game) return base;
  const source = room.game;
  const viewer = source.seats.find((item) => item.playerId === viewerId);
  const visibleActorId = source.phase === "dawn" && !viewer?.everWitch ? null : source.actorId;
  const publicGame = {
    status: source.status, phase: source.phase, round: source.round, actorId: visibleActorId,
    turnMode: source.turnMode,
    currentIndex: source.currentIndex, deckCount: source.deck.length, discardCount: source.discard.length,
    winner: clone(source.winner), eventSeq: source.eventSeq, lastEvent: clone(source.lastEvent), log: [...source.log],
    pendingTrial: source.pendingTrial ? { accuserId: source.pendingTrial.accuserId, targetId: source.pendingTrial.targetId } : null,
    eventAcks: [...source.eventAcks],
    seats: source.seats.map((player) => ({
      playerId: player.playerId, playerName: player.playerName, alive: player.alive, character: clone(player.character),
      handCount: player.hand.length, front: clone(player.front), accusation: accusationValue(source, player), threshold: threshold(source, player.playerId),
      hiddenTryalCount: hiddenTrials(player).length, revealedTryals: clone(player.tryals.filter((item) => item.revealed)),
      blackCat: player.blackCat, gavel: player.gavel, lastAction: player.lastAction,
      blackCatImmune: isCharacter(source, player.playerId, "mary"),
      submitted: source.phase === "conspiracy-pass" ? Boolean(source.conspiracy?.picks[player.playerId]) : false
    }))
  };
  if (viewer) {
    publicGame.you = {
      ...publicGame.seats.find((item) => item.playerId === viewerId), hand: clone(viewer.hand), tryals: clone(viewer.tryals),
      everWitch: viewer.everWitch, currentWitch: currentWitch(viewer), currentConstable: currentConstable(viewer), characterUses: viewer.characterUses,
      witchTeam: ["dawn", "night-choice", "night-confession", "night-result"].includes(source.phase) && viewer.everWitch ? source.seats.filter((item) => item.alive && item.everWitch).map((item) => ({ playerId: item.playerId, playerName: item.playerName })) : [],
      leftNeighbor: source.phase === "conspiracy-pass" ? (() => { const left = leftLiving(source, viewerId); return { playerId: left.playerId, playerName: left.playerName, trials: hiddenTrials(left).map((trial) => ({ id: trial.id })) }; })() : null,
      topPreview: source.phase === "reorder-top" && source.actorId === viewerId ? source.deck.slice(0, 5).map(clone) : [],
      discardChoices: isCharacter(source, viewerId, "samuel") ? clone(source.discard.filter((card) => !BLACK.has(card.kind)).slice(-12)) : []
    };
  }
  if (source.conspiracy) publicGame.conspiracy = { drawerId: source.conspiracy.drawerId };
  if (source.phase === "trial" && source.actorId === viewerId) {
    const target = seat(source, source.pendingTrial.targetId);
    publicGame.trialOptions = hiddenTrials(target).map((trial) => ({ id: trial.id }));
  } else if (source.phase === "conspiracy-cat" && source.actorId === viewerId) {
    const cat = source.seats.find((item) => item.blackCat && item.alive && !isCharacter(source, item.playerId, "mary"));
    publicGame.trialOptions = cat ? hiddenTrials(cat).map((trial) => ({ id: trial.id })) : [];
  } else publicGame.trialOptions = [];
  if (source.night) publicGame.night = {
    drawerId: source.night.drawerId, protectionId: ["night-confession", "night-result"].includes(source.phase) ? source.night.protectionId : null,
    targetId: source.phase === "night-result" ? source.night.targetId : null,
    witchSubmitted: Boolean(source.night.targetVotes[viewerId]),
    protectSubmitted: Boolean(viewer?.currentConstable && source.night.protectSubmitted),
    confessionSubmitted: Boolean(source.night.confession[viewerId])
  };
  publicGame.finalReveals = source.status === "finished" ? source.seats.map((player) => ({
    playerId: player.playerId, playerName: player.playerName, everWitch: player.everWitch,
    tryals: clone(player.tryals), character: clone(player.character)
  })) : [];
  return { ...base, game: publicGame };
}

module.exports = {
  createGame, chooseBlackCat, drawCards, playCard, endTurn, revealTrial, conspiracyPick,
  chooseNightTarget, chooseNightProtection, nightConfess, nightPass, useCharacter, reorderTop,
  drawDiscard, ackEvent, tick, publicRoom, accusationValue, threshold, performReveal,
  CHARACTERS, TRIAL_COUNTS, makeDeck
};
