const rules = require("./rules");

const definition = {
  id: "market-opening",
  title: "开盘！",
  description: "秘密建仓、预测涨跌，并用隐藏消息影响下一轮市场。",
  icon: "📈",
  clientScript: "/games/market-opening.js",
  minPlayers: 2,
  maxPlayers: 6,
  minimumToStart: 1,
  status: "prototype",
  createGame(players) {
    return rules.createGame(players);
  },
  publicRoom(room, viewerId) {
    return rules.publicRoom(room, viewerId);
  },
  actions: {
    submit: (room, playerId, payload) => rules.submitDecision(room, playerId, payload),
    effect: (room, playerId, payload) => rules.chooseEffect(room, playerId, payload.effect)
  }
};

module.exports = { definition, rules };
