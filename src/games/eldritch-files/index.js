const rules=require("./rules");
const definition={id:"eldritch-files",title:"诡镇调查：午夜档案",icon:"🕯️",description:"1至4名调查员在疯狂吞噬理智前探索宅邸、破解仪式并抵抗神话生物。",clientScript:"/games/eldritch-files.js",minPlayers:1,maxPlayers:4,minimumToStart:1,status:"prototype",defaultSettings:rules.defaults,configure:rules.configure,createGame:(p,s)=>rules.createGame(p,s),publicRoom:rules.publicRoom,actions:{move:rules.move,investigate:rules.investigate,fight:rules.fight,evade:rules.evade,basic:rules.basic,play:rules.play,ability:rules.ability,"end-turn":rules.endTurn}};
module.exports={definition,rules};
