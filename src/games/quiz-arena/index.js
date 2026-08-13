const rules = require("./rules");

const definition = {
  id: "quiz-arena",
  title: "站神答题王",
  icon: "⚡",
  description: "轮流守住三颗生命，或在逐字题干中抢下七次正确答案。",
  clientScript: "/games/quiz-arena.js?v=20260814-retired7",
  minPlayers: 2,
  maxPlayers: 6,
  minimumToStart: 2,
  status: "prototype",
  defaultSettings: rules.defaultSettings,
  configure: rules.configure,
  createGame(players, settings, room) { return rules.createGame(players, settings, Math.random, Date.now(), room?.quizHistoryKeys || []); },
  publicRoom: rules.publicRoom,
  tick: rules.tick,
  actions: {
    answer: (room, playerId, payload) => room.game.mode === "buzzer" ? rules.submitBuzz(room, playerId, payload.answer) : rules.submitSurvival(room, playerId, payload.answer),
    skip: (room, playerId) => rules.skipSurvival(room, playerId),
    buzz: (room, playerId) => rules.buzz(room, playerId),
    vote: (room, playerId, payload) => rules.voteCategory(room, playerId, payload.category),
    react: (room, playerId, payload) => rules.react(room, playerId, payload.type),
    challenge: (room, playerId, payload) => rules.chooseChallenge(room, playerId, payload.targetId, payload.type),
    "reroll-challenge": (room, playerId) => rules.rerollChallenge(room, playerId),
    "complete-challenge": (room, playerId) => rules.completeChallenge(room, playerId)
  }
};

module.exports = { definition, rules };
