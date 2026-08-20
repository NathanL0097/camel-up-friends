const rules = require("./rules");

const definition = {
  id: "witch-town",
  title: "女巫镇：1692",
  icon: "🕯️",
  description: "4–12人的隐藏身份、指控审判与阵营转换游戏。",
  clientScript: "/games/witch-town.js?v=20260820-1",
  minPlayers: 4,
  maxPlayers: 12,
  minimumToStart: 4,
  status: "open",
  createGame: (players, settings) => rules.createGame(players, settings),
  publicRoom: rules.publicRoom,
  tick: rules.tick,
  actions: {
    "dawn-cat": rules.chooseBlackCat,
    draw: rules.drawCards,
    play: rules.playCard,
    "end-turn": rules.endTurn,
    "reveal-trial": rules.revealTrial,
    "conspiracy-pick": rules.conspiracyPick,
    "night-target": rules.chooseNightTarget,
    "night-protect": rules.chooseNightProtection,
    "night-confess": rules.nightConfess,
    "night-pass": rules.nightPass,
    "use-character": rules.useCharacter,
    "reorder-top": rules.reorderTop,
    "discard-draw": rules.drawDiscard,
    "ack-event": rules.ackEvent
  }
};

module.exports = { definition, rules };
