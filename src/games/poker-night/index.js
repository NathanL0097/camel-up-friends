const rules = require("./rules");
const definition = {
  id:"poker-night", title:"扑克之夜", icon:"♠️", description:"无限注德州与底池限注奥马哈综合现金桌。", clientScript:"/games/poker-night.js", minPlayers:2, maxPlayers:9, minimumToStart:2, status:"prototype",
  defaultSettings:rules.defaults, configure:rules.configure,
  onReconnect:(_room,player)=>{player.timeCards=rules.EXTENSION_CARDS;},
  createGame:(players,settings)=>rules.createGame(players,settings), publicRoom:rules.publicRoom, tick:rules.tick,
  actions:{ act:(r,id,p)=>rules.act(r,id,p), time:(r,id)=>rules.useTimeCard(r,id), rebuy:(r,id)=>rules.requestRebuy(r,id), approve:(r,id,p)=>rules.approveRebuy(r,id,p), reveal:(r,id,p)=>rules.revealCards(r,id,p) }
};
module.exports={definition,rules};
