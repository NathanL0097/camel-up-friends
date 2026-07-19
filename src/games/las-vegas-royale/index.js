const rules = require("./rules");

const definition = {
  id: "las-vegas-royale",
  title: "拉斯维加斯豪华版",
  description: "掷骰进驻六座赌场，用多数、逼平与特殊板块争夺最高奖金。",
  clientScript: "/games/las-vegas-royale.js",
  minPlayers: 2,
  maxPlayers: 5,
  status: "prototype",
  createGame: rules.createGame,
  publicRoom: rules.publicRoom,
  actions: {
    roll: (room, playerId) => rules.roll(room, playerId),
    place: (room, playerId, payload) => rules.place(room, playerId, payload.face),
    pass: (room, playerId) => rules.pass(room, playerId),
    power: (room, playerId, payload) => rules.usePowerPlay(room, playerId, payload.face),
    resolve: (room, playerId, payload) => rules.resolvePending(room, playerId, payload)
  }
};

module.exports = { definition, rules };
