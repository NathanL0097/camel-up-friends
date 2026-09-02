const rules = require("./rules");

const definition = {
  id: "colt-express",
  title: "柯尔特列车：西部劫案",
  icon: "🚂",
  description: "2–6人的行动编程、车顶追逐、射击与列车抢劫。",
  clientScript: "/games/colt-express.js?v=20260902-3",
  minPlayers: 2,
  maxPlayers: 6,
  minimumToStart: 2,
  status: "open",
  defaultSettings: rules.defaults,
  configure: rules.configure,
  createGame: (players, settings) => rules.createGame(players, settings),
  publicRoom: rules.publicRoom,
  actions: {
    "play-card": rules.playCard,
    "draw-cards": rules.drawCards,
    "execute-action": rules.executeAction,
    "ack-event": rules.acknowledge
  }
};

module.exports = { definition, rules };
