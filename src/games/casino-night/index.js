const rules = require("./rules");

const definition = {
  id: "casino-night",
  title: "星光赌场之夜",
  icon: "🎰",
  description: "AI 荷官主持单零轮盘、Casino Hold’em 与 Blackjack，仅使用无现金价值的娱乐筹码。",
  clientScript: "/games/casino-night.js",
  minPlayers: 1,
  maxPlayers: 8,
  minimumToStart: 1,
  status: "prototype",
  defaultSettings: rules.defaults,
  configure: rules.configure,
  createGame: rules.createGame,
  publicRoom: rules.publicRoom,
  actions: {
    "select-table": rules.selectTable,
    "grant-chips": rules.grantChips,
    "roulette-bet": rules.rouletteBet,
    "roulette-clear": rules.rouletteClear,
    "roulette-spin": rules.rouletteSpin,
    "reset-round": rules.resetRound,
    "blackjack-bet": rules.blackjackBet,
    "blackjack-deal": rules.blackjackDeal,
    "blackjack-action": rules.blackjackAction,
    "holdem-bet": rules.holdemBet,
    "holdem-deal": rules.holdemDeal,
    "holdem-decision": rules.holdemDecision
  }
};

module.exports = { definition, rules };
