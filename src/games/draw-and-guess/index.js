const rules = require("./rules");

const definition = {
  id: "draw-and-guess",
  title: "你画我猜",
  icon: "🎨",
  description: "轮流作画、实时猜词，用脑洞和手速争夺最高分。",
  clientScript: "/games/draw-and-guess.js",
  minPlayers: 2,
  maxPlayers: 8,
  minimumToStart: 2,
  status: "prototype",
  createGame(players) {
    return rules.createGame(players);
  },
  publicRoom(room, viewerId) {
    return rules.publicRoom(room, viewerId);
  },
  tick(room, now) {
    return rules.tick(room, now);
  },
  actions: {
    choose: (room, playerId, payload) => rules.selectWord(room, playerId, payload.word),
    guess: (room, playerId, payload) => rules.submitGuess(room, playerId, payload.text),
    draw: (room, playerId, payload) => rules.addStroke(room, playerId, payload),
    undo: (room, playerId) => rules.undoStroke(room, playerId),
    clear: (room, playerId) => rules.clearCanvas(room, playerId)
  }
};

module.exports = { definition, rules };
