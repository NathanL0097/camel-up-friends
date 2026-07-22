const rules = require("./rules");

const definition = {
  id: "sky-landing",
  title: "云端机组：协同降落",
  icon: "✈️",
  description: "两人分别担任机长与副驾驶，在静默骰子协作中完成一次惊险降落。",
  clientScript: "/games/sky-landing.js",
  minPlayers: 2,
  maxPlayers: 2,
  minimumToStart: 2,
  status: "prototype",
  defaultSettings: rules.defaults,
  configure: rules.configure,
  createGame: (players, settings) => rules.createGame(players, settings),
  publicRoom: rules.publicRoom,
  actions: {
    ready: (room, id) => rules.ready(room, id),
    place: (room, id, payload) => rules.place(room, id, payload),
    "start-reroll": (room, id) => rules.startReroll(room, id),
    "submit-reroll": (room, id, payload) => rules.submitReroll(room, id, payload)
  }
};

module.exports = { definition, rules };
