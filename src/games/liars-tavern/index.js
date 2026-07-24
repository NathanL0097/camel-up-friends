const rules = require("./rules");

const definition = {
  id: "liars-tavern",
  title: "骗子酒馆",
  icon: "😈",
  description: "在谎言、质疑与左轮命运之间活到最后。",
  clientScript: "/games/liars-tavern.js",
  minPlayers: 2,
  maxPlayers: 6,
  minimumToStart: 2,
  status: "prototype",
  createGame: (players, settings) => rules.createGame(players, settings),
  publicRoom: rules.publicRoom,
  tick: rules.tick,
  actions: {
    play: rules.play,
    challenge: rules.challenge
  }
};

module.exports = { definition, rules };
