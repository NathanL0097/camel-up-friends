const rules = require("./rules");

const definition = {
  id: "seven-duel",
  title: "文明奇迹：双城对决",
  icon: "🏛️",
  description: "以《七大奇迹：对决》基础规则制作的双人文明发展技术演示。",
  clientScript: "/games/seven-duel.js",
  minPlayers: 2,
  maxPlayers: 2,
  minimumToStart: 2,
  status: "prototype",
  createGame: (players) => rules.createGame(players),
  publicRoom: rules.publicRoom,
  actions: {
    "pick-wonder": (room, id, payload) => rules.pickWonder(room, id, payload.wonderId),
    take: (room, id, payload) => rules.takeCard(room, id, payload),
    "choose-progress": (room, id, payload) => rules.chooseProgress(room, id, payload.tokenId),
    "resolve-special": (room, id, payload) => rules.resolveSpecial(room, id, payload),
    "choose-starter": (room, id, payload) => rules.chooseStarter(room, id, payload.playerId)
  }
};

module.exports = { definition, rules };
