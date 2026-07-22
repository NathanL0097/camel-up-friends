const rules=require("./rules");
const definition={id:"pencil-quest",title:"铅笔勇者：空白地牢",icon:"✏️",description:"在会自行改写的冒险本中探索、寻宝，并用铅笔落点击败纸上怪物。",clientScript:"/games/pencil-quest.js",minPlayers:1,maxPlayers:1,minimumToStart:1,status:"prototype",defaultSettings:rules.defaults,configure:rules.configure,createGame:(p,s)=>rules.createGame(p,s),publicRoom:rules.publicRoom,actions:{"choose-room":rules.chooseRoom,shoot:rules.shoot,skill:rules.skill,potion:rules.potion,"choose-reward":rules.chooseReward}};
module.exports={definition,rules};
