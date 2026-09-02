const { CHARACTERS, ACTION_COUNTS, ACTION_NAMES, ROUND_PATTERNS, EVENTS, EVENT_INFO } = require("./data");

const clone = (value) => JSON.parse(JSON.stringify(value));
function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
const defaults = () => ({ characterSkills: true, roundEvents: true });
function configure(room, playerId, payload = {}) {
  if (room.hostId !== playerId) throw new Error("只有房主可以修改柯尔特列车规则");
  if (room.game) throw new Error("游戏已经开始");
  room.settings = { characterSkills: payload.characterSkills !== false, roundEvents: payload.roundEvents !== false };
}
function seat(game, playerId) {
  const found = game.players.find((player) => player.id === playerId);
  if (!found) throw new Error("你不在这趟列车上");
  return found;
}
function nameOf(game, playerId) { return seat(game, playerId).name; }
function emit(game, type, title, detail, extra = {}, duration = 5200) {
  game.eventSeq += 1;
  game.lastEvent = { seq: game.eventSeq, type, title, detail, duration, ...extra };
  game.log.unshift(`${title}：${detail}`);
  game.log = game.log.slice(0, 32);
}
function lootLabel(loot, reveal = true) {
  const names = { purse: "钱袋", jewel: "珠宝", strongbox: "保险箱" };
  return `${names[loot.type]}${reveal ? ` $${loot.value}` : ""}`;
}
function actionCardDeck(playerId) {
  return Object.entries(ACTION_COUNTS).flatMap(([cardType, count]) => Array.from({ length: count }, (_unused, index) => ({
    id: `${playerId}-${cardType}-${index + 1}`, kind: "action", cardType
  })));
}
function createLootFactory(random) {
  let sequence = 0;
  const purseValues = shuffle([250, 250, 300, 300, 350, 350, 400, 400, 450, 450, 500, 500, 250, 300, 350, 400, 450, 500], random);
  return (type) => ({ id: `loot-${++sequence}`, type, value: type === "purse" ? (purseValues.shift() || 250) : type === "jewel" ? 500 : 1000 });
}
function makeTrain(playerCount, random) {
  const loot = createLootFactory(random);
  const wagonCount = playerCount === 2 ? 3 : playerCount;
  const cars = Array.from({ length: wagonCount }, (_unused, index) => ({
    index, type: "car", name: index === 0 ? "守车" : `客车 ${index}`,
    insideLoot: [loot("purse"), ...(index % 2 ? [loot("jewel")] : [loot("purse")])], roofLoot: [], hasMarshal: false
  }));
  cars.push({ index: wagonCount, type: "locomotive", name: "蒸汽机车", insideLoot: [loot("strongbox")], roofLoot: [], hasMarshal: true });
  return cars;
}
function buildRoundCards(playerCount, settings, random) {
  const patterns = ROUND_PATTERNS[playerCount <= 4 ? "small" : "large"];
  const picked = shuffle(patterns.map((turns, index) => ({ id: `round-${index + 1}`, turns: [...turns] })), random).slice(0, 5);
  const chosenEvents = settings.roundEvents ? shuffle(EVENTS, random).slice(0, 5) : [];
  return picked.map((card, index) => ({ ...card, event: settings.roundEvents && (index === 4 || index % 2 === 1) ? chosenEvents[index] : null }));
}
function planningSteps(game) {
  const n = game.players.length;
  return game.roundCard.turns.flatMap((turnType, turnNumber) => {
    const order = Array.from({ length: n }, (_unused, offset) => {
      const direction = turnType === "reverse" ? -1 : 1;
      return game.players[(game.firstPlayerIndex + direction * offset + n * 3) % n].id;
    });
    return order.flatMap((playerId) => Array.from({ length: turnType === "double" ? 2 : 1 }, (_unused, substep) => ({
      playerId, turnType, turnNumber, substep, hidden: turnType === "tunnel"
    })));
  });
}
function dealRound(game) {
  game.round += 1;
  game.roundCard = game.roundCards[game.round - 1];
  game.actionStack = [];
  game.executionIndex = 0;
  game.currentAction = null;
  game.eventAcks = [];
  game.pendingAfterAck = null;
  for (const player of game.players) {
    const combined = [...player.hand, ...player.drawPile, ...player.discardPile];
    player.hand = [];
    player.discardPile = [];
    player.drawPile = shuffle(combined, game.random);
    player.planningDecisionCount = 0;
    const handSize = game.settings.characterSkills && player.character.id === "doc" ? 7 : 6;
    player.hand.push(...player.drawPile.splice(0, handSize));
  }
  game.planningSteps = planningSteps(game);
  game.planningIndex = 0;
  game.phase = "planning";
  game.actorId = game.planningSteps[0]?.playerId || null;
  const turns = game.roundCard.turns.map((turn) => ({ standard: "明牌", tunnel: "隧道盲牌", double: "连续两次", reverse: "逆向" }[turn])).join(" · ");
  emit(game, "round-start", `第${game.round}轮开始`, `${nameOf(game, game.players[game.firstPlayerIndex].id)}持有先手。行动节奏：${turns}。`, { round: game.round, roundCard: clone(game.roundCard) }, 6200);
}
function createGame(roomPlayers, rawSettings = {}, random = Math.random) {
  if (roomPlayers.length < 2 || roomPlayers.length > 6) throw new Error("柯尔特列车需要2至6名玩家");
  const settings = { ...defaults(), ...rawSettings };
  const characters = shuffle(CHARACTERS, random).slice(0, roomPlayers.length);
  const trainCars = makeTrain(roomPlayers.length, random);
  const firstPlayerIndex = Math.floor(random() * roomPlayers.length);
  const players = roomPlayers.map((roomPlayer, index) => {
    const initialIndex = (index - firstPlayerIndex + roomPlayers.length) % roomPlayers.length % 2 === 0 ? 0 : 1;
    const initialLoot = { id: `initial-${roomPlayer.id}`, type: "purse", value: 250 };
    return {
      id: roomPlayer.id, name: roomPlayer.name, character: clone(characters[index]),
      position: { carIndex: initialIndex, isRoof: false }, hand: [], drawPile: actionCardDeck(roomPlayer.id), discardPile: [],
      loot: [initialLoot], bulletsRemaining: 6, bulletsReceived: [], shotsFired: 0, planningDecisionCount: 0
    };
  });
  const game = {
    status: "playing", phase: "dealing", players, settings, round: 0, roundCards: [], roundCard: null,
    trainCars, actionStack: [], executionIndex: 0, currentAction: null, marshalCarIndex: trainCars.length - 1,
    firstPlayerIndex, actorId: null, planningSteps: [], planningIndex: 0, eventAcks: [], pendingAfterAck: null,
    neutralBullets: 13, eventSeq: 0, lastEvent: null, log: [], winner: null, startedAt: Date.now(), random
  };
  game.roundCards = buildRoundCards(roomPlayers.length, settings, random);
  dealRound(game);
  return game;
}
function requirePlaying(room, playerId) {
  if (!room.game || room.game.status !== "playing") throw new Error("这趟列车劫案已经结束");
  return { game: room.game, player: seat(room.game, playerId) };
}
function requirePlanning(game, playerId) {
  if (game.phase !== "planning") throw new Error("现在不是策划出牌阶段");
  if (game.actorId !== playerId) throw new Error("现在不是你的策划回合");
}
function currentPlanningStep(game) { return game.planningSteps[game.planningIndex] || null; }
function advancePlanning(game) {
  game.planningIndex += 1;
  if (game.planningIndex < game.planningSteps.length) {
    game.actorId = currentPlanningStep(game).playerId;
    return;
  }
  for (const player of game.players) {
    player.drawPile.unshift(...player.hand);
    player.hand = [];
  }
  game.phase = "planning-result";
  game.actorId = null;
  game.eventAcks = [];
  game.pendingAfterAck = "begin-execution";
  emit(game, "planning-complete", "策划阶段结束", `公共行动栈共有${game.actionStack.length}张牌。现在将严格按照出牌先后逐张揭晓。`, { stackSize: game.actionStack.length }, 5200);
}
function playCard(room, playerId, payload = {}) {
  const { game, player } = requirePlaying(room, playerId);
  requirePlanning(game, playerId);
  const card = player.hand.find((item) => item.id === payload.cardId && item.kind === "action");
  if (!card) throw new Error("请选择手中的一张行动牌");
  const step = currentPlanningStep(game);
  const ghostHidden = game.settings.characterSkills && player.character.id === "ghost" && player.planningDecisionCount === 0;
  player.hand = player.hand.filter((item) => item.id !== card.id);
  const stackCard = { id: `${game.round}-${game.actionStack.length + 1}-${card.id}`, sourceCardId: card.id, cardType: card.cardType, ownerId: playerId, isHidden: step.hidden || ghostHidden, turnType: step.turnType, turnNumber: step.turnNumber };
  game.actionStack.push(stackCard);
  player.discardPile.push(card);
  player.planningDecisionCount += 1;
  emit(game, "card-planned", `${player.name}放入行动牌`, stackCard.isHidden ? "牌背朝上，内容暂时保密。" : `公开行动：${ACTION_NAMES[card.cardType]}。`, { playerId, stackCard: { ...stackCard, cardType: stackCard.isHidden ? null : stackCard.cardType } }, 2600);
  advancePlanning(game);
}
function drawCards(room, playerId) {
  const { game, player } = requirePlaying(room, playerId);
  requirePlanning(game, playerId);
  const count = Math.min(3, player.drawPile.length);
  player.hand.push(...player.drawPile.splice(0, count));
  player.planningDecisionCount += 1;
  emit(game, "cards-drawn", `${player.name}补充手牌`, `从牌堆摸取${count}张牌；公共行动栈没有增加。`, { playerId, count }, 2200);
  advancePlanning(game);
}
function sameSpot(a, b) { return a.position.carIndex === b.position.carIndex && a.position.isRoof === b.position.isRoof; }
function applyBelle(game, targets) {
  if (!game.settings.characterSkills || targets.length <= 1) return targets;
  const withoutBelle = targets.filter((player) => player.character.id !== "belle");
  return withoutBelle.length ? withoutBelle : targets;
}
function getMoveOptions(game, playerId) {
  const player = seat(game, playerId);
  const max = game.trainCars.length - 1;
  if (!player.position.isRoof) return [player.position.carIndex - 1, player.position.carIndex + 1]
    .filter((index) => index >= 0 && index <= max).map((carIndex) => ({ carIndex, isRoof: false, distance: 1 }));
  const options = [];
  for (let distance = 1; distance <= 3; distance += 1) for (const direction of [-1, 1]) {
    const carIndex = player.position.carIndex + distance * direction;
    if (carIndex >= 0 && carIndex <= max) options.push({ carIndex, isRoof: true, distance });
  }
  return options;
}
function getShootTargets(game, playerId) {
  const shooter = seat(game, playerId);
  if (shooter.bulletsRemaining <= 0) return [];
  let targets = [];
  if (!shooter.position.isRoof) {
    targets = game.players.filter((target) => target.id !== playerId && !target.position.isRoof && Math.abs(target.position.carIndex - shooter.position.carIndex) === 1);
  } else {
    for (const direction of [-1, 1]) {
      const occupied = game.players.filter((target) => target.id !== playerId && target.position.isRoof && (target.position.carIndex - shooter.position.carIndex) * direction > 0);
      if (!occupied.length) continue;
      const distance = Math.min(...occupied.map((target) => Math.abs(target.position.carIndex - shooter.position.carIndex)));
      targets.push(...occupied.filter((target) => Math.abs(target.position.carIndex - shooter.position.carIndex) === distance));
    }
  }
  if (game.settings.characterSkills && shooter.character.id === "tuco") {
    targets.push(...game.players.filter((target) => target.id !== playerId && target.position.carIndex === shooter.position.carIndex && target.position.isRoof !== shooter.position.isRoof));
  }
  return applyBelle(game, [...new Map(targets.map((target) => [target.id, target])).values()]).map((target) => ({ playerId: target.id, name: target.name, carIndex: target.position.carIndex, isRoof: target.position.isRoof }));
}
function getPunchTargets(game, playerId) {
  const player = seat(game, playerId);
  return applyBelle(game, game.players.filter((target) => target.id !== playerId && sameSpot(player, target))).map((target) => ({
    playerId: target.id, name: target.name,
    destinations: [target.position.carIndex - 1, target.position.carIndex + 1].filter((index) => index >= 0 && index < game.trainCars.length),
    loot: target.loot.map((loot) => ({ id: loot.id, type: loot.type, label: lootLabel(loot, loot.type !== "purse") }))
  }));
}
function locationLoot(game, player) {
  const car = game.trainCars[player.position.carIndex];
  return player.position.isRoof ? car.roofLoot : car.insideLoot;
}
function executionOptions(game, stackCard) {
  const player = seat(game, stackCard.ownerId);
  if (stackCard.cardType === "move") return getMoveOptions(game, player.id);
  if (stackCard.cardType === "shoot") return getShootTargets(game, player.id);
  if (stackCard.cardType === "punch") return getPunchTargets(game, player.id);
  if (stackCard.cardType === "rob") return locationLoot(game, player).map((loot) => ({ id: loot.id, type: loot.type, label: lootLabel(loot, loot.type !== "purse") }));
  if (stackCard.cardType === "marshal") return [game.marshalCarIndex - 1, game.marshalCarIndex + 1].filter((index) => index >= 0 && index < game.trainCars.length).map((carIndex) => ({ carIndex }));
  return [];
}
function receiveNeutralBullets(game, targets) {
  if (!targets.length || game.neutralBullets < targets.length) return 0;
  for (const target of targets) {
    const bullet = { id: `neutral-${game.eventSeq}-${target.id}-${game.neutralBullets}`, kind: "bullet", neutral: true };
    target.drawPile.unshift(bullet);
    target.bulletsReceived.push(bullet);
    game.neutralBullets -= 1;
  }
  return targets.length;
}
function marshalEncounter(game, player) {
  if (!player.position.isRoof && player.position.carIndex === game.marshalCarIndex) {
    player.position.isRoof = true;
    receiveNeutralBullets(game, [player]);
    return true;
  }
  return false;
}
function prepareNextExecution(game) {
  if (game.executionIndex >= game.actionStack.length) return finishRound(game);
  const card = game.actionStack[game.executionIndex];
  game.currentAction = { ...card, isHidden: false };
  game.phase = "executing";
  game.actorId = card.ownerId;
  const options = executionOptions(game, card);
  game.executionOptions = options;
  emit(game, "card-revealed", `行动牌揭晓 · ${ACTION_NAMES[card.cardType]}`, `${nameOf(game, card.ownerId)}开始执行第${game.executionIndex + 1}/${game.actionStack.length}张行动牌。`, { playerId: card.ownerId, cardType: card.cardType, stackIndex: game.executionIndex }, 3800);
  if (card.cardType === "floor") resolveCurrentAction(game, card.ownerId, {});
  else if (!options.length) resolveCurrentAction(game, card.ownerId, { fallback: true });
}
function actionResult(game, card, title, detail, extra = {}) {
  game.phase = "execution-result";
  game.actorId = null;
  game.eventAcks = [];
  game.executionOptions = [];
  emit(game, "card-executed", title, detail, { playerId: card.ownerId, cardType: card.cardType, ...extra }, 5600);
}
function resolveCurrentAction(game, playerId, payload = {}) {
  const card = game.currentAction;
  if (!card || card.ownerId !== playerId) throw new Error("这张行动牌不属于你");
  const player = seat(game, playerId);
  const fallback = (reason) => actionResult(game, card, `${ACTION_NAMES[card.cardType]}没有生效`, reason, { fallback: true });
  if (payload.fallback) return fallback(card.cardType === "shoot" && player.bulletsRemaining <= 0 ? "你的弹巢已经打空，没有子弹可以射出。" : "当前没有任何合法目标，行动牌仍然消耗。" );
  if (card.cardType === "floor") {
    player.position.isRoof = !player.position.isRoof;
    const metMarshal = marshalEncounter(game, player);
    return actionResult(game, card, `${player.name}${player.position.isRoof ? "登上车顶" : "跳入车厢"}`, metMarshal ? "刚落入警长所在车厢，立刻被赶回车顶并获得一颗中立子弹。" : `现在位于${game.trainCars[player.position.carIndex].name}${player.position.isRoof ? "顶部" : "内部"}。`, { position: clone(player.position), marshalEncounter: metMarshal });
  }
  if (card.cardType === "move") {
    const option = game.executionOptions.find((item) => item.carIndex === Number(payload.carIndex));
    if (!option) throw new Error("请选择高亮显示的合法车厢");
    const from = player.position.carIndex;
    player.position.carIndex = option.carIndex;
    const metMarshal = marshalEncounter(game, player);
    return actionResult(game, card, `${player.name}沿列车移动`, `从${game.trainCars[from].name}移动到${game.trainCars[option.carIndex].name}${metMarshal ? "，撞见警长后逃上车顶并吃到一颗中立子弹" : ""}。`, { from, to: option.carIndex, position: clone(player.position), marshalEncounter: metMarshal });
  }
  if (card.cardType === "shoot") {
    const target = game.players.find((item) => item.id === payload.targetId && game.executionOptions.some((option) => option.playerId === item.id));
    if (!target) throw new Error("请选择高亮显示的射击目标");
    player.bulletsRemaining -= 1;
    player.shotsFired += 1;
    const bullet = { id: `bullet-${player.id}-${6 - player.bulletsRemaining}`, kind: "bullet", shooterId: player.id };
    target.drawPile.unshift(bullet);
    target.bulletsReceived.push(bullet);
    let knocked = false;
    const from = target.position.carIndex;
    if (game.settings.characterSkills && player.character.id === "django" && from !== player.position.carIndex) {
      const direction = from > player.position.carIndex ? 1 : -1;
      const destination = from + direction;
      if (destination >= 0 && destination < game.trainCars.length) {
        target.position.carIndex = destination;
        marshalEncounter(game, target);
        knocked = true;
      }
    }
    return actionResult(game, card, `${player.name}击中${target.name}`, `${target.name}收到一颗${player.name}的子弹${knocked ? `，并被姜戈的冲击力推到${game.trainCars[target.position.carIndex].name}` : ""}。`, { targetId: target.id, from, to: target.position.carIndex, knocked });
  }
  if (card.cardType === "punch") {
    const option = game.executionOptions.find((item) => item.playerId === payload.targetId);
    if (!option || !option.destinations.includes(Number(payload.destination))) throw new Error("请选择拳击目标和相邻落点");
    const target = seat(game, option.playerId);
    let dropped = null;
    if (target.loot.length) {
      const lootIndex = target.loot.findIndex((loot) => loot.id === payload.lootId);
      if (lootIndex < 0) throw new Error("请选择让对方掉落的一件战利品");
      [dropped] = target.loot.splice(lootIndex, 1);
      if (game.settings.characterSkills && player.character.id === "cheyenne" && dropped.type === "purse") player.loot.push(dropped);
      else locationLoot(game, target).push(dropped);
    }
    const from = target.position.carIndex;
    target.position.carIndex = Number(payload.destination);
    const metMarshal = marshalEncounter(game, target);
    const stolen = dropped && game.settings.characterSkills && player.character.id === "cheyenne" && dropped.type === "purse";
    return actionResult(game, card, `${player.name}一拳击飞${target.name}`, `${target.name}从${game.trainCars[from].name}被打到${game.trainCars[target.position.carIndex].name}${dropped ? `，${stolen ? "夏安顺手偷走" : "原地掉下"}一件${lootLabel(dropped, dropped.type !== "purse")}` : "，但身上没有战利品可掉"}${metMarshal ? "；落地又撞见警长" : ""}。`, { targetId: target.id, from, to: target.position.carIndex, dropped: dropped ? { type: dropped.type, stolen } : null });
  }
  if (card.cardType === "rob") {
    const pile = locationLoot(game, player);
    const index = pile.findIndex((loot) => loot.id === payload.lootId && game.executionOptions.some((option) => option.id === loot.id));
    if (index < 0) throw new Error("请选择当前位置的一件战利品");
    const [loot] = pile.splice(index, 1);
    player.loot.push(loot);
    return actionResult(game, card, `${player.name}抢到战利品`, `从${game.trainCars[player.position.carIndex].name}${player.position.isRoof ? "顶部" : "内部"}拿走${lootLabel(loot, true)}。`, { loot: clone(loot), carIndex: player.position.carIndex, isRoof: player.position.isRoof });
  }
  if (card.cardType === "marshal") {
    const option = game.executionOptions.find((item) => item.carIndex === Number(payload.carIndex));
    if (!option) throw new Error("请选择警长相邻的一节车厢");
    const from = game.marshalCarIndex;
    game.trainCars[from].hasMarshal = false;
    game.marshalCarIndex = option.carIndex;
    game.trainCars[option.carIndex].hasMarshal = true;
    const victims = game.players.filter((target) => !target.position.isRoof && target.position.carIndex === option.carIndex);
    const bulletCount = receiveNeutralBullets(game, victims);
    victims.forEach((target) => { target.position.isRoof = true; });
    return actionResult(game, card, `${player.name}调动警长`, `警长从${game.trainCars[from].name}进入${game.trainCars[option.carIndex].name}，赶走${victims.length}名强盗${bulletCount ? `并发出${bulletCount}颗中立子弹` : ""}。`, { from, to: option.carIndex, victims: victims.map((target) => target.id) });
  }
  throw new Error("未知行动牌");
}
function executeAction(room, playerId, payload = {}) {
  const { game } = requirePlaying(room, playerId);
  if (game.phase !== "executing" || game.actorId !== playerId) throw new Error("当前没有等待你确认的行动");
  resolveCurrentAction(game, playerId, payload);
}
function connectedPlayerIds(room) {
  const ids = room.players.filter((player) => player.connected !== false).map((player) => player.id);
  return ids.length ? ids : room.game.players.map((player) => player.id);
}
function acknowledge(room, playerId) {
  const { game } = requirePlaying(room, playerId);
  if (!["planning-result", "execution-result", "round-result"].includes(game.phase)) throw new Error("当前没有需要确认的结果");
  if (!game.eventAcks.includes(playerId)) game.eventAcks.push(playerId);
  if (!connectedPlayerIds(room).every((id) => game.eventAcks.includes(id))) return;
  if (game.phase === "planning-result") {
    game.eventAcks = [];
    game.pendingAfterAck = null;
    prepareNextExecution(game);
    return;
  }
  if (game.phase === "execution-result") {
    game.executionIndex += 1;
    game.eventAcks = [];
    prepareNextExecution(game);
    return;
  }
  if (game.pendingAfterAck === "finish-game") finishGame(game);
  else {
    game.firstPlayerIndex = (game.firstPlayerIndex + 1) % game.players.length;
    dealRound(game);
  }
}
function eventTargetsBySpot(game, player) { return game.players.filter((other) => other.id !== player.id && sameSpot(player, other)); }
function applyRoundEvent(game, eventId) {
  const info = EVENT_INFO[eventId];
  if (!eventId || !info) return "本轮没有额外事件。";
  if (eventId === "braking") game.players.filter((player) => player.position.isRoof).forEach((player) => { player.position.carIndex = Math.min(game.trainCars.length - 1, player.position.carIndex + 1); });
  if (eventId === "angry-marshal") {
    const roof = game.players.filter((player) => player.position.isRoof && player.position.carIndex === game.marshalCarIndex);
    receiveNeutralBullets(game, roof);
    if (game.marshalCarIndex > 0) {
      game.trainCars[game.marshalCarIndex].hasMarshal = false;
      game.marshalCarIndex -= 1;
      game.trainCars[game.marshalCarIndex].hasMarshal = true;
      const inside = game.players.filter((player) => !player.position.isRoof && player.position.carIndex === game.marshalCarIndex);
      receiveNeutralBullets(game, inside); inside.forEach((player) => { player.position.isRoof = true; });
    }
  }
  if (eventId === "swivel-arm") game.players.filter((player) => player.position.isRoof).forEach((player) => { player.position.carIndex = 0; });
  if (eventId === "take-it-all") game.trainCars[game.marshalCarIndex].insideLoot.push({ id: `event-strongbox-${game.round}`, type: "strongbox", value: 1000 });
  if (eventId === "passenger-rebellion") receiveNeutralBullets(game, game.players.filter((player) => !player.position.isRoof));
  if (eventId === "pickpocketing") for (const player of game.players) {
    const pile = locationLoot(game, player);
    const purseIndex = pile.findIndex((loot) => loot.type === "purse");
    if (!eventTargetsBySpot(game, player).length && purseIndex >= 0) player.loot.push(...pile.splice(purseIndex, 1));
  }
  if (eventId === "hostage-conductor") for (const player of game.players.filter((item) => item.position.carIndex === game.trainCars.length - 1)) player.loot.push({ id: `ransom-${game.round}-${player.id}`, type: "purse", value: 250 });
  if (eventId === "marshal-revenge") for (const player of game.players.filter((item) => item.position.isRoof && item.position.carIndex === game.marshalCarIndex)) {
    const purses = player.loot.filter((loot) => loot.type === "purse").sort((a, b) => a.value - b.value);
    if (purses[0]) {
      player.loot = player.loot.filter((loot) => loot.id !== purses[0].id);
      game.trainCars[player.position.carIndex].roofLoot.push(purses[0]);
    }
  }
  return info.detail;
}
function finishRound(game) {
  game.currentAction = null;
  game.executionOptions = [];
  const eventId = game.roundCard.event;
  const detail = applyRoundEvent(game, eventId);
  game.phase = "round-result";
  game.actorId = null;
  game.eventAcks = [];
  game.pendingAfterAck = game.round >= 5 ? "finish-game" : "next-round";
  const info = EVENT_INFO[eventId];
  emit(game, "round-event", info ? `${info.icon} ${info.name}` : `第${game.round}轮收工`, detail, { eventId }, 6500);
}
function finishGame(game) {
  const maxShots = Math.max(...game.players.map((player) => player.shotsFired));
  const gunslingers = game.players.filter((player) => player.shotsFired === maxShots && maxShots > 0).map((player) => player.id);
  const ranking = game.players.map((player) => {
    const loot = player.loot.reduce((sum, item) => sum + item.value, 0);
    return { playerId: player.id, playerName: player.name, character: clone(player.character), loot, gunslinger: gunslingers.includes(player.id), total: loot + (gunslingers.includes(player.id) ? 1000 : 0), bulletsReceived: player.bulletsReceived.length };
  }).sort((a, b) => b.total - a.total || a.bulletsReceived - b.bulletsReceived);
  game.status = "finished";
  game.phase = "end";
  game.actorId = null;
  game.winner = { playerIds: ranking.filter((item) => item.total === ranking[0].total && item.bulletsReceived === ranking[0].bulletsReceived).map((item) => item.playerId), ranking };
  emit(game, "game-finished", `${ranking[0].playerName}成为西部最富强盗`, `最终财富$${ranking[0].total}；神枪手奖励已经计入总分。`, { ranking: clone(ranking) }, 8000);
}
function publicRoom(room, viewerId) {
  const game = room.game;
  if (!game) return { code: room.code, hostId: room.hostId, settings: room.settings, players: room.players.map(({ token, ...player }) => player), game: null };
  const viewer = game.players.find((player) => player.id === viewerId);
  const publicPlayers = game.players.map((player) => ({
    id: player.id, name: player.name, character: clone(player.character), position: clone(player.position), handCount: player.hand.length,
    drawCount: player.drawPile.length, lootCount: player.loot.length,
    loot: player.loot.map((loot) => ({ id: loot.id, type: loot.type, value: viewerId === player.id || game.status === "finished" || loot.type !== "purse" ? loot.value : null })),
    bulletsRemaining: player.bulletsRemaining, bulletsReceived: player.bulletsReceived.length, shotsFired: player.shotsFired,
    connected: room.players.find((item) => item.id === player.id)?.connected !== false
  }));
  const actionStack = game.actionStack.map((card, index) => ({
    id: card.id, ownerId: card.ownerId, isHidden: card.isHidden && index >= game.executionIndex,
    cardType: card.isHidden && index >= game.executionIndex && card.ownerId !== viewerId ? null : card.cardType,
    resolved: index < game.executionIndex, current: index === game.executionIndex && game.phase.startsWith("execut")
  }));
  return {
    code: room.code, hostId: room.hostId, settings: room.settings,
    players: room.players.map(({ token, ...player }) => ({ ...player, ...(publicPlayers.find((item) => item.id === player.id) || {}) })),
    game: {
      status: game.status, phase: game.phase, round: game.round, roundCard: clone(game.roundCard), trainCars: clone(game.trainCars), marshalCarIndex: game.marshalCarIndex,
      players: publicPlayers,
      firstPlayerId: game.players[game.firstPlayerIndex].id, actorId: game.actorId, actionStack, executionIndex: game.executionIndex,
      currentAction: game.currentAction ? { ...clone(game.currentAction), ownerName: nameOf(game, game.currentAction.ownerId), name: ACTION_NAMES[game.currentAction.cardType] } : null,
      executionOptions: game.actorId === viewerId ? clone(game.executionOptions || []) : [], eventAcks: [...game.eventAcks], lastEvent: clone(game.lastEvent), log: [...game.log],
      planning: game.phase === "planning" ? { index: game.planningIndex, total: game.planningSteps.length, step: clone(currentPlanningStep(game)) } : null,
      you: viewer ? { id: viewer.id, hand: clone(viewer.hand), character: clone(viewer.character), lootValue: viewer.loot.reduce((sum, loot) => sum + loot.value, 0) } : null,
      winner: game.winner ? clone(game.winner) : null
    }
  };
}

const ActionStackExecutor = Object.freeze({
  prepareNext: prepareNextExecution,
  getOptions: executionOptions,
  execute: resolveCurrentAction
});

module.exports = {
  CHARACTERS, ACTION_NAMES, EVENT_INFO, defaults, configure, createGame, publicRoom, playCard, drawCards, executeAction, acknowledge,
  getMoveOptions, getShootTargets, ActionStackExecutor,
  __test: { applyBelle, getPunchTargets, executionOptions, resolveCurrentAction, applyRoundEvent, dealRound, finishGame, prepareNextExecution }
};
