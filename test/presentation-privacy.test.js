const test=require('node:test');
const assert=require('node:assert/strict');
const witch=require('../src/games/witch-town/rules');
const colt=require('../src/games/colt-express/rules');
const players=n=>Array.from({length:n},(_,i)=>({id:`p${i}`,name:`玩家${i}`,connected:true}));
test('女巫镇隐藏身份标识不编码牌种，普通镇民不能从黎明行动索引识别女巫',()=>{
  const p=players(6),room={code:'SAFE01',players:p,game:witch.createGame(p,{},()=>.37)};
  const town=room.game.seats.find(s=>!s.everWitch),view=witch.publicRoom(room,town.playerId).game;
  assert.equal(view.actorId,null);assert.equal(view.currentIndex,null);
  const cards=room.game.seats.flatMap(s=>s.tryals);
  assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);
  for(const c of cards){assert.match(c.id,/^[0-9a-f-]{36}$/);assert.ok(!/innocent|witch|constable/.test(c.id));}
});
test('列车隧道牌的公共栈与事件不含可推知行动种类的标识',()=>{
  const p=players(2),room={code:'SAFE02',players:p,game:colt.createGame(p,{},()=>.37)},g=room.game;
  const actor=g.players[0],card=actor.hand.find(c=>c.kind==='action');
  g.phase='planning';g.actorId=actor.id;g.planningIndex=0;
  g.planningSteps=[{playerId:actor.id,turnType:'tunnel',turnNumber:0,hidden:true},{playerId:g.players[1].id,turnType:'tunnel',turnNumber:0,hidden:true}];
  colt.playCard(room,actor.id,{cardId:card.id});
  const view=colt.publicRoom(room,g.players[1].id).game;
  assert.equal(view.actionStack[0].cardType,null);
  assert.equal(view.lastEvent.stackCard.cardType,null);
  assert.equal(view.lastEvent.stackCard.sourceCardId,undefined);
  assert.ok(!JSON.stringify(view.actionStack).includes(card.id));
  assert.ok(!JSON.stringify(view.lastEvent).includes(card.id));
});
test('女巫镇连续揭示不会被后续阴谋消息覆盖，展示历史只含已公开事件',()=>{
  const p=players(4),room={code:'SAFE03',players:p,game:witch.createGame(p,{},()=>.37)},g=room.game;
  const cat=g.seats.find(s=>s.character.id!=='mary'),drawer=g.seats.find(s=>s!==cat);
  cat.blackCat=true;g.phase='conspiracy-cat';g.actorId=drawer.playerId;g.conspiracy={drawerId:drawer.playerId,picks:{},acknowledged:[]};
  const trial=cat.tryals.find(t=>t.kind==='innocent');
  witch.revealTrial(room,drawer.playerId,{trialId:trial.id});
  const view=witch.publicRoom(room,drawer.playerId).game;
  assert.ok(view.presentationEvents.some(e=>e.type==='trial-reveal'&&e.trial==='innocent'));
  assert.ok(view.presentationEvents.some(e=>e.type==='conspiracy-pass'));
  assert.ok(view.presentationEvents.every(e=>!e.hand&&!e.tryals&&!e.targetVotes));
});
