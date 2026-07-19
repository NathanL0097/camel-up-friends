const rules = require("./rules");

const definition = {
  id: "camel-race",
  title: "沙漠驼队竞速",
  description: "押注赛段、堆叠前进，在充满意外的沙漠赛道上争夺最多财富。",
  clientScript: "/games/camel-race.js",
  minPlayers: 2,
  maxPlayers: 8,
  minimumToStart: 1,
  status: "prototype",
  createGame(players) {
    return rules.createGame(players);
  },
  publicRoom(room, viewerId) {
    return rules.publicRoom(room, viewerId);
  },
  actions: {
    roll: (room, playerId) => rules.rollDie(room, playerId),
    bet: (room, playerId, payload) => rules.takeLegBet(room, playerId, payload.color),
    tile: (room, playerId, payload) => rules.placeTile(room, playerId, payload.space, payload.type),
    partner: (room, playerId, payload) => rules.enterPartnership(room, playerId, payload.partnerId),
    predict: (room, playerId, payload) => rules.predict(room, playerId, payload.color, payload.type)
  }
};

module.exports = { definition, rules };
