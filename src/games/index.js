const { definition: camelRace } = require("./camel-race");
const { definition: lasVegasRoyale } = require("./las-vegas-royale");

const games = new Map([[camelRace.id, camelRace], [lasVegasRoyale.id, lasVegasRoyale]]);

function getGame(gameId) {
  const game = games.get(gameId);
  if (!game) throw new Error("这款游戏暂未开放");
  return game;
}

function listGames() {
  return [...games.values()].map(({ actions: _actions, createGame: _createGame, publicRoom: _publicRoom, minimumToStart: _minimumToStart, ...metadata }) => metadata);
}

module.exports = { DEFAULT_GAME_ID: camelRace.id, getGame, listGames };
