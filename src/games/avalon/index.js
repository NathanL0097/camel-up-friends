const rules = require("./rules");

const definition = {
  id: "avalon",
  title: "阿瓦隆：迷雾圆桌",
  icon: "⚔️",
  description: "5–10人的隐藏身份、组队投票、秘密任务与终局刺杀。",
  clientScript: "/games/avalon.js?v=20260820-1",
  minPlayers: 5,
  maxPlayers: 10,
  minimumToStart: 5,
  status: "open",
  defaultSettings: rules.defaults,
  configure: rules.configure,
  createGame: (players, settings) => rules.createGame(players, settings),
  publicRoom: rules.publicRoom,
  tick: rules.tick,
  actions: {
    "toggle-team": rules.toggleTeam,
    "propose-team": rules.proposeTeam,
    vote: rules.vote,
    "quest-card": rules.questCard,
    "ack-event": rules.ackEvent,
    "lady-inspect": rules.ladyInspect,
    "ack-lady": rules.ackLady,
    assassinate: rules.assassinate
  }
};

module.exports = { definition, rules };
