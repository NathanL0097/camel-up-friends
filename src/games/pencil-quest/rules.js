const {HEROES,ENEMIES,BOSSES,RELICS}=require("./data");
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const pick=(a)=>a[Math.floor(Math.random()*a.length)];

function defaults(){return {hero:"knight"};}
function configure(room,id,p={}){if(room.hostId!==id)throw Error("只有房主可以选择角色");if(!HEROES[p.hero])throw Error("未知角色");room.settings.hero=p.hero;}
function route(depth){
  const pools=[["battle","treasure"],["battle","trap"],["camp","battle"],["treasure","battle"],["elite","camp"],["battle","trap"],["treasure","elite"]];
  return pools.slice(0,7).map((pair,i)=>pair.map((type,j)=>({id:`${i+1}-${j}`,depth:i+1,type,revealed:i===0})));
}
function createGame(players,settings={}){
  const hero={...HEROES[settings.hero]||HEROES.knight};
  return {status:"playing",phase:"choose",heroId:players[0].id,hero:{...hero,hp:hero.maxHp,potions:2,gold:0,relics:[],skillReady:true},depth:0,route:route(),choices:[],enemy:null,rewards:[],score:0,shots:0,hits:0,eventSeq:1,lastEvent:{type:"start",title:"空白地牢苏醒了",detail:"选择第一条路线，写下属于你的冒险。"},log:["你把铅笔削尖，走进会自行改写的地牢。"]};
}
function own(g,id){if(g.heroId!==id)throw Error("只有冒险者可以操作");if(g.status!=="playing")throw Error("本局已经结束");}
function emit(g,type,title,detail){g.eventSeq++;g.lastEvent={type,title,detail};g.log.unshift(detail||title);g.log=g.log.slice(0,12);}
function currentChoices(g){return g.route[g.depth]||[];}
function spawn(g,type){
  const base=type==="boss"?pick(BOSSES):pick(ENEMIES),scale=type==="elite"?1.35:1;
  g.enemy={...base,maxHp:Math.ceil(base.hp*scale+g.depth*.7),hp:Math.ceil(base.hp*scale+g.depth*.7),attack:Math.ceil(base.attack+(g.depth>4?1:0)),elite:type==="elite",guardUsed:false};
  g.hero.skillReady=true;g.phase="combat";emit(g,"enemy",`${g.enemy.elite?"精英":""}${g.enemy.name}出现！`,g.enemy.quote);
}
function enter(g,node){
  g.depth++;if(g.hero.relics.includes("thermos"))g.hero.hp=Math.min(g.hero.maxHp,g.hero.hp+1);
  if(g.depth===8){spawn(g,"boss");return;}
  if(node.type==="battle"||node.type==="elite")return spawn(g,node.type);
  if(node.type==="camp"){g.hero.hp=Math.min(g.hero.maxHp,g.hero.hp+6);g.phase="choose";emit(g,"camp","营火噼啪作响","你恢复了6点生命，墨迹般的伤口逐渐褪去。");return revealNext(g);}
  if(node.type==="trap"){const loss=2+Math.floor(Math.random()*3);g.hero.hp-=loss;g.phase="choose";emit(g,"trap","机关从页缝弹出",`你失去${loss}点生命，但及时护住了铅笔。`);if(g.hero.hp<=0)return finish(g,false,"你倒在了布满订书钉的走廊里。");return revealNext(g);}
  reward(g,"宝箱里传来沙沙声");
}
function chooseRoom(room,id,p){const g=room.game;own(g,id);if(g.phase!=="choose")throw Error("现在不能选择路线");const node=currentChoices(g).find(x=>x.id===p.nodeId);if(!node)throw Error("这条路线不存在");enter(g,node);}
function revealNext(g){if(g.depth>=7){g.route.push([{id:"8-0",depth:8,type:"boss",revealed:true}]);}const next=g.route[g.depth];if(next)next.forEach(x=>x.revealed=true);}
function reward(g,title="战利品散落一地"){
  const available=RELICS.filter(x=>!g.hero.relics.includes(x.id));
  g.rewards=available.sort(()=>Math.random()-.5).slice(0,Math.min(3,available.length));g.phase="reward";emit(g,"reward",title,"选择一件遗物，然后继续深入地牢。");
}
function chooseReward(room,id,p){const g=room.game;own(g,id);if(g.phase!=="reward")throw Error("现在没有战利品可选");const item=g.rewards.find(x=>x.id===p.relicId);if(!item)throw Error("无效的遗物");g.hero.relics.push(item.id);if(item.effect==="power")g.hero.power++;if(item.effect==="hp"){g.hero.maxHp+=4;g.hero.hp=Math.min(g.hero.maxHp,g.hero.hp+4);}g.score+=40;g.rewards=[];g.phase="choose";emit(g,"loot",`获得「${item.name}」`,item.desc);revealNext(g);}
function enemyStrike(g,reason){
  if(reason==="miss"&&g.hero.relics.includes("eraser")&&!g.enemy.guardUsed){g.enemy.guardUsed=true;emit(g,"guard","命运被擦掉了","这次落空没有引来敌人的反击。");return;}
  let dmg=g.enemy.attack;if(g.hero.id==="knight"&&!g.enemy.guardUsed){dmg=Math.max(0,dmg-2);g.enemy.guardUsed=true;}
  g.hero.hp-=dmg;emit(g,"hurt",`${g.enemy.name}反击`,`${g.hero.name}受到${dmg}点伤害。`);if(g.hero.hp<=0)finish(g,false,`${g.enemy.name}把你的故事停在了这一页。`);
}
function shoot(room,id,p={}){
  const g=room.game;own(g,id);if(g.phase!=="combat")throw Error("当前没有可以攻击的敌人");const x=Number(p.x),y=Number(p.y);if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)throw Error("无效的落点");
  const r=Math.hypot(x-.5,y-.5),forced=g.hero.id==="ranger"&&!g.hero.skillReady;
  let result=r<=.105?"crit":r<=.255?"hit":r<=.39?"graze":"miss";if(forced&&result==="miss")result="hit";
  g.shots++;if(result!=="miss")g.hits++;
  let damage=0;if(result==="crit")damage=g.hero.power*2+(g.hero.relics.includes("ink")?3:0);else if(result==="hit"||result==="graze"&&g.hero.relics.includes("clover"))damage=g.hero.power;else if(result==="graze")damage=Math.max(1,Math.floor(g.hero.power/2));if(result!=="miss"&&g.hero.relics.includes("sharp"))damage++;
  g.enemy.hp-=damage;emit(g,`shot-${result}`,result==="crit"?"正中靶心！":result==="hit"?"铅芯命中":result==="graze"?"擦边而过":"铅笔落空",damage?`对${g.enemy.name}造成${damage}点伤害。`:`${g.enemy.name}发出嘲笑。`);
  if(g.enemy.hp<=0){g.score+=g.enemy.elite?180:100;if(g.depth===8)return finish(g,true,"最后一页被你亲手写完，地牢在晨光中合拢。");return reward(g);}
  enemyStrike(g,result);
}
function skill(room,id){const g=room.game;own(g,id);if(g.phase!=="combat"||!g.hero.skillReady)throw Error("技能现在无法发动");g.hero.skillReady=false;if(g.hero.id==="alchemist"){g.enemy.hp-=5;emit(g,"skill","爆裂墨水！",`无视靶盘造成5点伤害。`);if(g.enemy.hp<=0){g.score+=g.enemy.elite?180:100;if(g.depth===8)return finish(g,true,"深渊被墨水封进了最后一页。");return reward(g);}}else if(g.hero.id==="ranger")emit(g,"skill","呼吸，瞄准","下一次攻击即使落空也会按普通命中计算。");else {g.hero.hp=Math.min(g.hero.maxHp,g.hero.hp+2);emit(g,"skill","盾面敲击","恢复2点生命；本场首次受伤仍会触发护甲。");}}
function potion(room,id){const g=room.game;own(g,id);if(g.hero.potions<=0)throw Error("药水已经用完");if(g.hero.hp>=g.hero.maxHp)throw Error("生命值已经全满");g.hero.potions--;g.hero.hp=Math.min(g.hero.maxHp,g.hero.hp+6);emit(g,"potion","喝下修正液","恢复6点生命。字迹闻起来有点刺鼻。");}
function finish(g,won,text){g.status="finished";g.outcome=won?"won":"lost";g.phase="result";g.score+=won?600+g.hero.hp*10:0;emit(g,won?"victory":"defeat",won?"地牢通关":"冒险中止",text);}
function publicRoom(room,id){const base={code:room.code,hostId:room.hostId,players:room.players.map(({token,...p})=>p),settings:room.settings,game:null};if(!room.game)return base;const game=JSON.parse(JSON.stringify(room.game));game.accuracy=game.shots?Math.round(game.hits/game.shots*100):0;game.isHero=id===game.heroId;return {...base,game};}
module.exports={defaults,configure,createGame,chooseRoom,shoot,skill,potion,chooseReward,publicRoom,HEROES,RELICS};
