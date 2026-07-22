const { definition: camelRace } = require("./camel-race");
const { definition: marketOpening } = require("./market-opening");
const { definition: drawAndGuess } = require("./draw-and-guess");
const { definition: pokerNight } = require("./poker-night");
const { definition: sevenDuel } = require("./seven-duel");
const { definition: skyLanding } = require("./sky-landing");

const games = new Map([
  [camelRace.id, camelRace],
  [marketOpening.id, marketOpening],
  [drawAndGuess.id, drawAndGuess],
  [pokerNight.id, pokerNight],
  [sevenDuel.id, sevenDuel],
  [skyLanding.id, skyLanding]
]);

function getGame(gameId) {
  const game = games.get(gameId);
  if (!game) throw new Error("这款游戏暂未开放");
  return game;
}

function listGames() {
  return [...games.values()].map(({ actions: _actions, createGame: _createGame, publicRoom: _publicRoom, minimumToStart: _minimumToStart, defaultSettings: _defaultSettings, configure: _configure, tick: _tick, onReconnect: _onReconnect, ...metadata }) => metadata);
}

module.exports = { DEFAULT_GAME_ID: camelRace.id, getGame, listGames };
