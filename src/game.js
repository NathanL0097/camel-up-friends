const COLORS = ["red", "blue", "green", "yellow", "purple"];
const CRAZY_COLORS = ["black", "white"];
const ALL_CAMELS = [...COLORS, ...CRAZY_COLORS];
const FINISH = 16;
const BET_VALUES = [5, 3, 3, 2, 1];

function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function createGame(players, random = Math.random) {
  const camels = Object.fromEntries(ALL_CAMELS.map((color) => [color, { space: 0, crazy: CRAZY_COLORS.includes(color) }]));
  const stacks = {};
  for (const color of shuffle(COLORS, random)) {
    const space = 1 + Math.floor(random() * 3);
    camels[color].space = space;
    stacks[space] ||= [];
    stacks[space].push(color);
  }
  for (const color of shuffle(CRAZY_COLORS, random)) {
    const space = FINISH - Math.floor(random() * 3);
    camels[color].space = space;
    stacks[space] ||= [];
    stacks[space].push(color);
  }
  const game = {
    status: "playing",
    turn: 0,
    leg: 1,
    finish: FINISH,
    camels,
    stacks,
    dice: shuffle([...COLORS, "gray"], random),
    rollsRemaining: 5,
    bets: Object.fromEntries(COLORS.map((color) => [color, [...BET_VALUES]])),
    legBets: [],
    predictions: [],
    tiles: [],
    log: ["比赛开始！第一赛段已经启程。"],
    eventSeq: 0,
    lastEvent: null,
    winner: null,
    ranking: [],
    random
  };
  players.forEach((player) => {
    player.coins = 3;
  });
  return game;
}

function getRanking(game) {
  return COLORS.slice().sort((a, b) => {
    const distance = game.camels[b].space - game.camels[a].space;
    if (distance) return distance;
    const stack = game.stacks[game.camels[a].space] || [];
    return stack.indexOf(b) - stack.indexOf(a);
  });
}

function currentPlayer(room) {
  return room.players[room.game.turn % room.players.length];
}

function requireTurn(room, playerId) {
  if (!room.game || room.game.status !== "playing") throw new Error("比赛尚未开始或已经结束");
  if (currentPlayer(room).id !== playerId) throw new Error("还没轮到你");
}

function moveCamel(game, color, amount) {
  return moveCamelInDirection(game, color, amount, 1);
}

function moveCamelInDirection(game, color, amount, direction) {
  const from = game.camels[color].space;
  const source = game.stacks[from];
  const index = source.indexOf(color);
  let moving = source.splice(index);
  if (!source.length) delete game.stacks[from];

  let destination = from + amount * direction;
  const tile = game.tiles.find((item) => item.space === destination);
  if (tile) destination += (tile.type === "oasis" ? 1 : -1) * direction;
  game.stacks[destination] ||= [];
  if (tile?.type === "mirage") game.stacks[destination] = [...moving, ...game.stacks[destination]];
  else game.stacks[destination].push(...moving);
  moving.forEach((camel) => { game.camels[camel].space = destination; });
  return { from, destination, moving, tile };
}

function chooseCrazyCamel(game, rolledColor) {
  const carrying = CRAZY_COLORS.filter((color) => {
    const stack = game.stacks[game.camels[color].space] || [];
    return stack.slice(stack.indexOf(color) + 1).some((camel) => COLORS.includes(camel));
  });
  if (carrying.length === 1) return carrying[0];

  if (game.camels.black.space === game.camels.white.space) {
    const stack = game.stacks[game.camels.black.space] || [];
    const blackIndex = stack.indexOf("black");
    const whiteIndex = stack.indexOf("white");
    if (Math.abs(blackIndex - whiteIndex) === 1) return blackIndex > whiteIndex ? "black" : "white";
  }
  return rolledColor;
}

function advanceTurn(room) {
  room.game.turn = (room.game.turn + 1) % room.players.length;
}

function settleLeg(room) {
  const game = room.game;
  const endedLeg = game.leg;
  const [first, second] = getRanking(game);
  for (const bet of game.legBets) {
    const player = room.players.find((item) => item.id === bet.playerId);
    if (!player) continue;
    const reward = bet.color === first ? bet.value : bet.color === second ? 1 : -1;
    player.coins += reward;
  }
  game.log.unshift(`第 ${game.leg} 赛段结束：${first} 领先，${second} 第二。`);
  game.leg += 1;
  game.dice = shuffle([...COLORS, "gray"], game.random);
  game.rollsRemaining = 5;
  game.bets = Object.fromEntries(COLORS.map((color) => [color, [...BET_VALUES]]));
  game.legBets = [];
  game.tiles = [];
  return { leg: endedLeg, first, second };
}

function finishRace(room) {
  const game = room.game;
  game.status = "finished";
  game.ranking = getRanking(game);
  game.winner = game.ranking[0];
  const last = game.ranking.at(-1);
  for (const prediction of game.predictions) {
    const player = room.players.find((item) => item.id === prediction.playerId);
    if (!player) continue;
    const correct = prediction.type === "winner" ? prediction.color === game.winner : prediction.color === last;
    player.coins += correct ? 8 : -1;
  }
  game.log.unshift(`比赛结束！${game.winner} 赢得冠军。`);
}

function rollDie(room, playerId, random = Math.random) {
  requireTurn(room, playerId);
  const game = room.game;
  if (!game.rollsRemaining) throw new Error("本赛段骰子已经用完");
  const die = game.dice.pop();
  const amount = 1 + Math.floor(random() * 3);
  const rolledCrazyColor = die === "gray" ? (random() < 0.5 ? "white" : "black") : null;
  const color = die === "gray" ? chooseCrazyCamel(game, rolledCrazyColor) : die;
  const direction = die === "gray" ? -1 : 1;
  const result = moveCamelInDirection(game, color, amount, direction);
  game.rollsRemaining -= 1;
  const player = currentPlayer(room);
  player.coins += 1;
  const grayNote = die === "gray" ? `灰骰显示 ${rolledCrazyColor}，${color !== rolledCrazyColor ? `规则改为移动 ${color}` : `移动 ${color}`}` : color;
  game.log.unshift(`${player.name} 掷出 ${grayNote} ${amount} 点，${direction < 0 ? "反向" : "向前"}移动到第 ${result.destination} 格。`);
  if (result.tile) {
    const owner = room.players.find((item) => item.id === result.tile.playerId);
    if (owner) owner.coins += 1;
    game.log.unshift(`触发${result.tile.type === "oasis" ? "绿洲 +1" : "海市蜃楼 -1"}，${owner?.name || "玩家"} 获得 1 金币。`);
  }
  let legEnd = null;
  const raceFinished = result.destination > FINISH || result.destination < 1;
  if (raceFinished) finishRace(room);
  else {
    advanceTurn(room);
    if (!game.rollsRemaining) legEnd = settleLeg(room);
  }
  game.eventSeq += 1;
  game.lastEvent = {
    id: game.eventSeq,
    type: "roll",
    playerId,
    playerName: player.name,
    die,
    color,
    rolledCrazyColor,
    amount,
    direction,
    from: result.from,
    destination: result.destination,
    moving: result.moving,
    tile: result.tile ? { type: result.tile.type, space: result.tile.space } : null,
    legEnd,
    raceFinished
  };
  return { die, color, rolledCrazyColor, amount };
}

function takeLegBet(room, playerId, color) {
  requireTurn(room, playerId);
  if (!COLORS.includes(color)) throw new Error("无效的骆驼颜色");
  const value = room.game.bets[color].shift();
  if (!value) throw new Error("这匹骆驼的赛段投注牌已经被拿完");
  const player = currentPlayer(room);
  room.game.legBets.push({ playerId, color, value });
  room.game.log.unshift(`${player.name} 拿走了 ${color} 的 ${value} 金币赛段投注牌。`);
  advanceTurn(room);
}

function placeTile(room, playerId, space, type) {
  requireTurn(room, playerId);
  space = Number(space);
  if (!["oasis", "mirage"].includes(type)) throw new Error("无效的板块类型");
  if (space < 2 || space > FINISH - 1) throw new Error("板块只能放在第 2 至 15 格");
  if (room.game.stacks[space]?.length) throw new Error("有骆驼的格子不能放板块");
  if (room.game.tiles.some((tile) => Math.abs(tile.space - space) <= 1)) throw new Error("板块不能相邻");
  const old = room.game.tiles.findIndex((tile) => tile.playerId === playerId);
  if (old >= 0) room.game.tiles.splice(old, 1);
  room.game.tiles.push({ playerId, space, type });
  room.game.log.unshift(`${currentPlayer(room).name} 在第 ${space} 格放置了${type === "oasis" ? "绿洲" : "海市蜃楼"}。`);
  advanceTurn(room);
}

function predict(room, playerId, color, type) {
  if (!room.game || room.game.status !== "playing") throw new Error("比赛尚未开始或已经结束");
  if (!COLORS.includes(color) || !["winner", "loser"].includes(type)) throw new Error("预测无效");
  if (room.game.predictions.some((item) => item.playerId === playerId && item.type === type)) throw new Error("每种终局预测只能提交一次");
  room.game.predictions.push({ playerId, color, type });
  room.game.log.unshift(`${room.players.find((item) => item.id === playerId)?.name} 已提交一个秘密终局预测。`);
}

function publicRoom(room) {
  const game = room.game ? { ...room.game, random: undefined } : null;
  const players = room.players.map(({ token: _token, ...player }) => player);
  return { code: room.code, hostId: room.hostId, players, game };
}

module.exports = { COLORS, CRAZY_COLORS, BET_VALUES, FINISH, createGame, getRanking, currentPlayer, rollDie, takeLegBet, placeTile, predict, publicRoom, moveCamel, moveCamelInDirection, chooseCrazyCamel };
