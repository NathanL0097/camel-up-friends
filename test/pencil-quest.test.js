const test=require("node:test");const assert=require("node:assert/strict");const rules=require("../src/games/pencil-quest/rules");
const player={id:"p1",name:"Solo"};
function room(hero="knight"){return {hostId:"p1",players:[player],settings:{hero},game:rules.createGame([player],{hero})};}
test("三名原创冒险者拥有不同属性与技能",()=>{assert.equal(Object.keys(rules.HEROES).length,3);assert.notEqual(rules.HEROES.knight.maxHp,rules.HEROES.ranger.maxHp);});
test("单人地牢开局生成七层二选一路线",()=>{const r=room();assert.equal(r.game.route.length,7);assert.ok(r.game.route.every(x=>x.length===2));assert.equal(r.game.phase,"choose");});
test("只有唯一冒险者可以选择路线与操作",()=>{const r=room();assert.throws(()=>rules.chooseRoom(r,"stranger",{nodeId:"1-0"}),/只有冒险者/);});
test("落笔距离决定暴击命中擦伤和落空",()=>{for(const [x,minimum] of [[.5,6],[.7,3],[.85,1]]){const r=room("ranger");rules.chooseRoom(r,"p1",{nodeId:"1-0"});const hp=r.game.enemy.hp;rules.shoot(r,"p1",{x,y:.5});assert.ok(r.game.enemy===null||r.game.enemy.hp<=hp-minimum);}const r=room();rules.chooseRoom(r,"p1",{nodeId:"1-0"});rules.shoot(r,"p1",{x:0,y:0});const hp=r.game.hero.hp;rules.shoot(r,"p1",{x:0,y:0});assert.ok(r.game.hero.hp<hp);});
test("游侠技能保证下一次落空至少命中",()=>{const r=room("ranger");rules.chooseRoom(r,"p1",{nodeId:"1-0"});const hp=r.game.enemy.hp;rules.skill(r,"p1");rules.shoot(r,"p1",{x:0,y:0});assert.ok(!r.game.enemy||r.game.enemy.hp<hp);});
test("炼金师技能造成固定伤害且每场限一次",()=>{const r=room("alchemist");rules.chooseRoom(r,"p1",{nodeId:"1-0"});const hp=r.game.enemy.hp;rules.skill(r,"p1");assert.equal(r.game.enemy?.hp,hp-5);assert.throws(()=>rules.skill(r,"p1"),/无法发动/);});
test("药水恢复六点但不能超过最大生命",()=>{const r=room();r.game.hero.hp=10;rules.potion(r,"p1");assert.equal(r.game.hero.hp,16);assert.equal(r.game.hero.potions,1);});
test("战斗胜利进入三选一遗物奖励",()=>{const r=room();rules.chooseRoom(r,"p1",{nodeId:"1-0"});r.game.enemy.hp=1;rules.shoot(r,"p1",{x:.5,y:.5});assert.equal(r.game.phase,"reward");assert.equal(r.game.rewards.length,3);rules.chooseReward(r,"p1",{relicId:r.game.rewards[0].id});assert.equal(r.game.phase,"choose");});
test("击败第八层首领会完成冒险并计算分数",()=>{const r=room();r.game.depth=7;r.game.route.push([{id:"8-0",depth:8,type:"boss",revealed:true}]);rules.chooseRoom(r,"p1",{nodeId:"8-0"});r.game.enemy.hp=1;rules.shoot(r,"p1",{x:.5,y:.5});assert.equal(r.game.outcome,"won");assert.ok(r.game.score>=600);});
test("公开状态包含命中率但不会产生其他玩家权限",()=>{const r=room();r.game.shots=4;r.game.hits=3;const p=rules.publicRoom(r,"p1");assert.equal(p.game.accuracy,75);assert.equal(p.game.isHero,true);});
test("单人游戏大厅不会泄露重连令牌",()=>{const r={code:"ABC123",hostId:"p1",players:[{...player,token:"secret"}],settings:{hero:"knight"},game:null};const p=rules.publicRoom(r,"p1");assert.equal(p.game,null);assert.equal(p.players[0].token,undefined);});
