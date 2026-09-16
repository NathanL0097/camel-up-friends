const test = require('node:test');
const assert = require('node:assert/strict');
const {rules, definition} = require('../src/games/colt-express');
function room(count=2) {
  const players=Array.from({length:count},(_,i)=>({id:`p${i}`,name:`玩家${i}`,connected:true}));
  return {code:'PACE01',players,hostId:'p0',game:rules.createGame(players,{},()=>.37)};
}
test('列车简报无人确认也在有界阅读时间后自动推进，2至6人均有效',()=>{
  assert.equal(definition.tick,rules.tick);
  for(let n=2;n<=6;n++) {
    const r=room(n),deadline=r.game.eventDeadline;
    assert.ok(r.game.eventDwell>=9000 && r.game.eventDwell<=20000);
    assert.equal(rules.tick(r,deadline-1),false);
    assert.equal(r.game.phase,'round-briefing');
    assert.equal(rules.tick(r,deadline),true);
    assert.equal(r.game.phase,'planning');
    assert.equal(r.game.eventDeadline,null);
    assert.equal(rules.tick(r,deadline+100000),false);
  }
});
test('列车确认只计在线座位，离线、重连或重复连接不延长公共结果',()=>{
  const r=room(3),deadline=r.game.eventDeadline;
  r.players[2].connected=false;
  rules.acknowledge(r,'p0');
  rules.acknowledge(r,'p0');
  assert.deepEqual(r.game.eventAcks,['p0']);
  assert.equal(r.game.eventDeadline,deadline);
  r.players[2].connected=true;
  rules.tick(r,deadline);
  assert.equal(r.game.phase,'planning');
  const other=room(3);
  other.players[2].connected=false;
  rules.acknowledge(other,'p0'); rules.acknowledge(other,'p1');
  assert.equal(other.game.phase,'planning');
});
test('列车所有人离线仍自动结束公共回放，不自动替玩家作出规则选择',()=>{
  const r=room();
  r.players.forEach(p=>p.connected=false);
  rules.tick(r,r.game.eventDeadline);
  assert.equal(r.game.phase,'planning');
  assert.equal(rules.tick(r,Date.now()+1000000),false);
});
test('旧列车快照补一次期限；公开期限不暴露其他手牌',()=>{
  const r=room(); delete r.game.eventDeadline;
  assert.equal(rules.tick(r,1000),true);
  assert.equal(r.game.eventDeadline,11000);
  assert.equal(rules.tick(r,2000),false);
  const view=rules.publicRoom(r,'p0');
  assert.equal(view.game.eventDeadline,11000);
  assert.equal(view.game.players[1].hand,undefined);
  assert.equal(view.game.players[1].loot[0].value,null);
});
test('完整列车对局无需任何结果确认，行动顺序与五轮终局仍有效',()=>{
  for(let n=2;n<=6;n++) {
    const r=room(n); let steps=0;
    while(r.game.status==='playing' && steps++<700) {
      const g=r.game;
      if(g.eventDeadline) { rules.tick(r,g.eventDeadline); continue; }
      if(g.phase==='planning') {
        const p=g.players.find(p=>p.id===g.actorId),card=p.hand.find(c=>c.kind==='action');
        card?rules.playCard(r,p.id,{cardId:card.id}):rules.drawCards(r,p.id);
      } else if(g.phase==='executing') {
        const o=g.executionOptions[0],type=g.currentAction.cardType;
        const payload=type==='rob'?{lootId:o.id}:type==='punch'?{targetId:o.playerId,destination:o.destinations[0],lootId:o.loot?.[0]?.id}:type==='shoot'?{targetId:o.playerId}:{carIndex:o.carIndex};
        rules.executeAction(r,g.actorId,payload);
      } else assert.fail(`Unexpected phase ${g.phase}`);
    }
    assert.equal(r.game.status,'finished'); assert.equal(r.game.round,5);
    assert.equal(r.game.winner.ranking.length,n);
  }
});
